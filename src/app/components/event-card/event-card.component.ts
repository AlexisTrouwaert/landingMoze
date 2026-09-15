import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { capitalize, formatEventSchedule } from '../../common/event-time';
import { EVENT_STATUS_LABELS, EventCard, eventTypeLabel } from '../../model/event.model';

/**
 * Carte d'un évènement dans le listing `/evenements`. Toute la carte est un lien vers sa page.
 *
 * `featured` : la grande carte du prochain évènement, image à côté du texte. Sinon, la vignette
 * des archives.
 */
@Component({
  selector: 'app-event-card',
  imports: [RouterLink],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventCardComponent {
  readonly event = input.required<EventCard>();
  readonly featured = input(false);

  readonly typeLabel = computed(() => eventTypeLabel(this.event().type, this.event().typeLabel));
  readonly schedule = computed(() =>
    capitalize(formatEventSchedule(this.event().startAt, this.event().endAt)),
  );

  /** Pastille d'état — seulement quand elle apprend quelque chose : « À venir » va de soi ici. */
  readonly statusLabel = computed(() => {
    const status = this.event().status;
    return status === 'PUBLISHED' || status === 'PAST' ? null : EVENT_STATUS_LABELS[status];
  });

  readonly place = computed(() => {
    const e = this.event();
    if (e.mode === 'en-ligne') return 'En ligne';
    return [e.venueName, e.city].filter((part) => part?.trim()).join(', ') || null;
  });

  /** Le résumé est fait pour les vignettes ; l'accroche le remplace s'il manque. */
  readonly blurb = computed(() => this.event().summary || this.event().tagline);
}
