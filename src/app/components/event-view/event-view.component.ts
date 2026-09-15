import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { capitalize, formatEventDay, formatEventSchedule } from '../../common/event-time';
import {
  EVENT_ACCESS,
  EventPartner,
  EventViewData,
  PARTNER_ROLES,
  eventMapsUrl,
  eventTypeLabel,
  formatPrice,
} from '../../model/event.model';

/**
 * Page d'un évènement, dans l'ordre des rubriques de la spec : bandeau d'état, ouverture (type,
 * titre, accroche, date, lieu, bouton d'inscription), visuel, corps, qui organise, infos
 * pratiques, inscription.
 *
 * Partagé par la page publique et l'aperçu de l'éditeur, qui affichent ainsi la même chose.
 * Les rubriques de l'étape suivante (public visé, pourquoi venir, déroulé, FAQ, récapitulatif)
 * viendront s'insérer ici.
 */
@Component({
  selector: 'app-event-view',
  templateUrl: './event-view.component.html',
  styleUrl: './event-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventViewComponent {
  readonly event = input.required<EventViewData>();

  readonly typeLabel = computed(() => eventTypeLabel(this.event().type, this.event().typeLabel));

  readonly schedule = computed(() => {
    const e = this.event();
    return capitalize(formatEventSchedule(e.startAt, e.endAt));
  });

  /** Date d'origine d'un report, telle qu'elle avait été annoncée. */
  readonly previousDay = computed(() => {
    const previous = this.event().previousStartAt;
    return previous ? formatEventDay(previous) : null;
  });

  readonly pastSentence = computed(() => {
    const start = this.event().startAt;
    return start
      ? `Cet évènement a eu lieu le ${formatEventDay(start)}.`
      : 'Cet évènement a eu lieu.';
  });

  /** « Le 9 — Living Lab, Avignon », ou « En ligne ». */
  readonly place = computed(() => {
    const e = this.event();
    if (e.mode === 'en-ligne') return 'En ligne';
    const where = [e.venueName, e.city].filter((part) => part?.trim()).join(', ');
    if (!where) return null;
    return e.mode === 'hybride' ? `${where} · et en ligne` : where;
  });

  /** Les infos pratiques n'ont de sens que pour un lieu physique renseigné. */
  readonly hasPractical = computed(() => {
    const e = this.event();
    return e.mode !== 'en-ligne' && !!(e.venueName || e.street || e.city || e.accessInfo);
  });

  // --- Organisation --------------------------------------------------------------

  /**
   * La mention d'organisation sous le titre, selon le rôle de Moze (spec, section 04). Rien quand
   * Moze organise seul : sa marque est déjà partout sur la page. Pour un relais, elle est la
   * première chose à dire — le visiteur doit voir d'un coup d'œil qui reçoit.
   */
  readonly organizedBy = computed(() => {
    const e = this.event();
    const name = e.organizerName?.trim();
    if (!name) return null;
    switch (e.roleMoze) {
      case 'co-organisateur':
        return /^moze$/i.test(name) ? null : `Co-organisé par Moze et ${name}`;
      case 'partenaire':
        return `Organisé par ${name}, avec la participation de Moze`;
      case 'relais':
        return `Organisé par ${name}`;
      default:
        return null;
    }
  });

  /** Les partenaires regroupés par rôle, dans l'ordre des rôles puis de saisie. */
  readonly partnerGroups = computed(() =>
    PARTNER_ROLES.map((role) => ({
      label: role.group,
      partners: this.event().partners.filter((p: EventPartner) => p.role === role.value),
    })).filter((group) => group.partners.length),
  );

  readonly hasOrganisation = computed(
    () => !!this.event().organizerName?.trim() || this.event().partners.length > 0,
  );

  /** Adresse e-mail ou téléphone : le lien qui convient, ou rien. */
  readonly contactHref = computed(() => {
    const contact = this.event().organizerContact?.trim();
    if (!contact) return null;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return `mailto:${contact}`;
    if (/^[+\d][\d\s.-]{6,}$/.test(contact)) return `tel:${contact.replace(/[\s.-]/g, '')}`;
    return null;
  });

  // --- Inscription ------------------------------------------------------------------

  readonly accessLabel = computed(
    () => EVENT_ACCESS.find((a) => a.value === this.event().access)?.label ?? null,
  );

  readonly price = computed(() => {
    const e = this.event();
    return e.access === 'payant' && e.priceCents !== null ? formatPrice(e.priceCents) : null;
  });

  readonly deadline = computed(() => {
    const deadline = this.event().registrationDeadline;
    return deadline ? formatEventDay(deadline) : null;
  });

  /**
   * Le bouton d'inscription, s'il y a lieu : pas pour un évènement annulé ou passé, pas sans
   * billetterie. Complet, il mène à la liste d'attente — la spec veut que la page reste ouverte.
   */
  readonly registration = computed(() => {
    const e = this.event();
    if (!e.registrationUrl || e.status === 'CANCELLED' || e.status === 'PAST') return null;
    return {
      url: e.registrationUrl,
      label: e.status === 'FULL' ? 'Rejoindre la liste d’attente' : 'S’inscrire',
    };
  });

  readonly hasRegistration = computed(() => {
    const e = this.event();
    return !!(e.access || e.priceLabel || e.registrationUrl || e.capacity || e.registrationInfo);
  });

  /** Pas d'itinéraire vers un évènement annulé : l'adresse reste lisible, le bouton inviterait à s'y rendre. */
  readonly mapsUrl = computed(() =>
    this.event().status === 'CANCELLED' ? null : eventMapsUrl(this.event()),
  );
}
