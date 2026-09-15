import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, map, switchMap, tap } from 'rxjs';
import { formatEventDay, isoToParisLocal, parisLocalToIso } from '../../common/event-time';
import { DocxReadError } from '../../common/docx';
import { importEventFromDocx } from '../../common/event-import';
import { googleMapsUrlValidator } from '../../common/google-maps';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { EventViewComponent } from '../../components/event-view/event-view.component';
import { WysiwygEditorComponent } from '../../components/wysiwyg/wysiwyg-editor.component';
import {
  AdminEvent,
  EVENT_ACCESS,
  EVENT_MODES,
  EVENT_STATUS_LABELS,
  EVENT_TYPES,
  EventAccess,
  EventDisplayStatus,
  EventInput,
  EventMode,
  EventPartner,
  EventStatus,
  EventType,
  EventViewData,
  PARTNER_ROLES,
  PartnerRole,
  ROLES_MOZE,
  RoleMoze,
  TYPE_LABEL_MAX,
  forbiddenForPublication,
  missingForPublication,
  publicationWarnings,
} from '../../model/event.model';
import { environment } from '../../../environements/environment';
import { EventService } from '../../services/event.service';

/** Message lisible d'une erreur d'API Nest (`message` peut être une liste de validations). */
function apiMessage(error: unknown, fallback: string): string {
  const message = (error as HttpErrorResponse)?.error?.message as
    | string
    | string[]
    | undefined;
  if (Array.isArray(message)) return message.join(' ');
  return message || fallback;
}

/** Adresse web complète : un lien sans `https://` partirait en relatif sur la page publique. */
const WEB_URL = /^https?:\/\/\S+$/;

/** Site de Moze, organisateur par défaut. */
const MOZE_URL = environment.production ? environment.siteUrl : 'https://www.moze.fr';

/** Panneau du cycle de vie ouvert dans la colonne de réglages. */
type LifecyclePanel = 'postpone' | 'cancel' | null;

/**
 * Création et édition d'un évènement.
 *
 * Même barre collante, mêmes cartes et même WYSIWYG que l'éditeur d'articles. S'y ajoutent ce
 * que la spec exige pour publier — type, accroche, dates, lieu — et, une fois l'évènement en
 * ligne, les gestes de son cycle de vie : complet, reporter, annuler.
 *
 * Les dates se saisissent **à l'heure de Paris**, quel que soit le fuseau du navigateur, et
 * partent vers l'API avec leur décalage (cf. `common/event-time.ts`).
 */
@Component({
  selector: 'app-admin-event-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    WysiwygEditorComponent,
    ConfirmDialogComponent,
    EventViewComponent,
  ],
  templateUrl: './admin-event-editor.component.html',
  // La feuille de l'éditeur d'articles d'abord : barre, cartes, champs, image et aperçu y sont
  // déjà dessinés, et le gabarit en reprend les classes. Recopier ces quelque trois cents lignes
  // aurait laissé les deux éditeurs diverger à la première retouche. La seconde feuille ne porte
  // que ce qui est propre aux évènements.
  styleUrls: [
    './admin-blog-editor.component.scss',
    './admin-event-editor.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminEventEditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly events = inject(EventService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly location = inject(Location);

  readonly types = EVENT_TYPES;
  readonly modes = EVENT_MODES;
  readonly rolesMoze = ROLES_MOZE;
  readonly accessOptions = EVENT_ACCESS;
  readonly partnerRoles = PARTNER_ROLES;
  readonly typeLabelMax = TYPE_LABEL_MAX;

  readonly id = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly isEdit = computed(() => this.id() !== null);

  readonly loading = signal(this.isEdit());
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  /** Accusé bref après un enregistrement réussi. */
  readonly saved = signal<string | null>(null);

  // --- État de l'évènement enregistré ----------------------------------------

  readonly status = signal<EventStatus | null>(null);
  readonly effectiveStatus = signal<EventDisplayStatus | null>(null);
  /** Slug enregistré (≠ celui du formulaire tant qu'on n'a pas sauvegardé). */
  readonly slug = signal<string | null>(null);
  /** Le slug enregistré a été saisi à la main : il ne suit plus type, titre et date. */
  readonly slugManual = signal(false);
  readonly publishedAt = signal<string | null>(null);
  readonly previousStartAt = signal<string | null>(null);
  readonly statusReason = signal<string | null>(null);

  readonly isDraft = computed(() => (this.status() ?? 'DRAFT') === 'DRAFT');
  readonly statusLabel = computed(() => {
    const status = this.effectiveStatus();
    return status ? EVENT_STATUS_LABELS[status] : 'Nouveau';
  });
  /** Évènement annoncé, pas encore passé ni annulé : il peut être reporté, annulé, déclaré complet. */
  readonly canChangeCourse = computed(() => {
    const status = this.effectiveStatus();
    return status === 'PUBLISHED' || status === 'FULL' || status === 'POSTPONED';
  });

  readonly previousDay = computed(() => {
    const previous = this.previousStartAt();
    return previous ? formatEventDay(previous) : null;
  });

  // --- Formulaire --------------------------------------------------------------

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(90)]],
    slug: ['', [Validators.maxLength(120)]],
    type: ['' as EventType | ''],
    /** Le nom du format quand le type est « Autre ». */
    typeLabel: ['', [Validators.maxLength(TYPE_LABEL_MAX)]],
    tagline: ['', [Validators.maxLength(140)]],
    summary: ['', [Validators.maxLength(400)]],
    content: [''],
    coverImageUrl: ['', [Validators.maxLength(500)]],
    coverImageAlt: ['', [Validators.maxLength(300)]],
    /** Valeurs de `datetime-local`, lues à l'heure de Paris. */
    start: [''],
    end: [''],
    mode: ['presentiel' as EventMode],
    venueName: ['', [Validators.maxLength(150)]],
    street: ['', [Validators.maxLength(200)]],
    postalCode: ['', [Validators.maxLength(20)]],
    city: ['', [Validators.maxLength(100)]],
    region: ['', [Validators.maxLength(100)]],
    country: ['FR', [Validators.pattern(/^[A-Za-z]{2}$/)]],
    accessInfo: ['', [Validators.maxLength(1000)]],
    wheelchairAccessible: [false],
    mapUrl: ['', [Validators.maxLength(2000), googleMapsUrlValidator]],

    // Organisation — pré-remplie pour le cas le plus courant : Moze organise.
    roleMoze: ['organisateur' as RoleMoze],
    organizerName: ['Moze', [Validators.maxLength(150)]],
    organizerUrl: [MOZE_URL, [Validators.maxLength(500), Validators.pattern(WEB_URL)]],
    organizerLogoUrl: ['', [Validators.maxLength(500)]],
    organizerContact: ['', [Validators.maxLength(200)]],
    partners: this.fb.nonNullable.array<ReturnType<AdminEventEditorComponent['partnerGroup']>>([]),

    // Accès et inscription
    access: ['' as EventAccess | ''],
    priceLabel: ['', [Validators.maxLength(120)]],
    /** En euros, saisi avec une virgule ou un point ; converti en centimes à l'envoi. */
    price: ['', [Validators.pattern(/^\d+([.,]\d{1,2})?$/)]],
    registrationUrl: ['', [Validators.maxLength(1000), Validators.pattern(WEB_URL)]],
    capacity: ['', [Validators.pattern(/^[1-9]\d*$/)]],
    registrationGoal: ['', [Validators.pattern(/^[1-9]\d*$/)]],
    registrationDeadline: [''],
    registrationInfo: ['', [Validators.maxLength(600)]],
  });

  get partners(): FormArray {
    return this.form.controls.partners;
  }

  /** Un partenaire du formulaire. */
  private partnerGroup(partner?: EventPartner) {
    return this.fb.nonNullable.group({
      role: [partner?.role ?? ('intervenant' as PartnerRole)],
      name: [partner?.name ?? '', [Validators.required, Validators.maxLength(150)]],
      url: [partner?.url ?? '', [Validators.maxLength(500), Validators.pattern(WEB_URL)]],
      logoUrl: [partner?.logoUrl ?? ''],
      description: [partner?.description ?? '', [Validators.maxLength(200)]],
    });
  }

  addPartner(): void {
    this.form.controls.partners.push(this.partnerGroup());
    this.markEdited();
  }

  removePartner(index: number): void {
    this.form.controls.partners.removeAt(index);
    this.markEdited();
  }

  movePartner(index: number, delta: -1 | 1): void {
    const target = index + delta;
    const array = this.form.controls.partners;
    if (target < 0 || target >= array.length) return;
    const control = array.at(index);
    array.removeAt(index, { emitEvent: false });
    array.insert(target, control);
    this.markEdited();
  }

  setRoleMoze(role: RoleMoze): void {
    this.form.controls.roleMoze.setValue(role);
    this.markEdited();
  }

  /** Une modification faite par un bouton plutôt qu'au clavier : le formulaire ne la voit pas seul. */
  private markEdited(): void {
    this.form.markAsDirty();
    this.dirty.set(true);
  }

  /** Modifications non enregistrées : garde-fou avant de quitter l'écran. */
  readonly dirty = signal(false);
  readonly leaveOpen = signal(false);
  readonly leaveMessage =
    "Des modifications n'ont pas été enregistrées.\n\nElles seront perdues si vous quittez maintenant.";

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  readonly isOnline = computed(() => this.formValue().mode === 'en-ligne');

  /** Ce qui manque pour publier, recalculé à la frappe. Le back refait la vérification. */
  readonly missing = computed(() => {
    this.formValue();
    return missingForPublication(this.toInput());
  });

  /** Ce qui est interdit (« gratuit », date limite après le début…), recalculé à la frappe. */
  readonly forbidden = computed(() => {
    this.formValue();
    return forbiddenForPublication(this.toInput());
  });

  /** Largeur réelle de l'image, lue à son chargement dans la carte « Image ». */
  readonly imageWidth = signal<number | null>(null);

  /** Les avertissements de la spec : affichés, ils laissent publier. */
  readonly warnings = computed(() => {
    this.formValue();
    return publicationWarnings(this.toInput(), this.imageWidth());
  });

  readonly roleHint = computed(
    () => ROLES_MOZE.find((r) => r.value === this.formValue().roleMoze)?.hint ?? '',
  );

  // --- Adresse publique -----------------------------------------------------

  /**
   * L'adresse complète de l'évènement telle qu'on la collerait dans un message — la même que
   * dans l'éditeur d'articles.
   *
   * L'origine vient du navigateur : `http://localhost:4200` en développement,
   * `https://www.moze.fr` en production. Repli sur `environment.siteUrl` pour le rendu serveur,
   * qui n'a pas de `location`.
   *
   * Suit la saisie en cours plutôt que le slug enregistré : on copie l'adresse qu'aura
   * l'évènement après enregistrement. `null` tant qu'aucun slug n'est connu — le back en
   * dérivera un du type, du titre et de la date, impossible à deviner ici.
   */
  readonly publicUrl = computed(() => {
    const slug = (this.formValue().slug || this.slug() || '').trim();
    if (!slug) return null;

    const origin = typeof location !== 'undefined' ? location.origin : environment.siteUrl;
    return `${origin}/evenements/${slug}`;
  });

  /** Accusé éphémère après la copie (l'icône passe à une coche). */
  readonly urlCopied = signal(false);
  private urlCopiedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Copie l'adresse publique dans le presse-papiers. */
  copyPublicUrl(): void {
    const url = this.publicUrl();
    if (!url || !navigator.clipboard) return;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.urlCopied.set(true);
        if (this.urlCopiedTimer) clearTimeout(this.urlCopiedTimer);
        this.urlCopiedTimer = setTimeout(() => this.urlCopied.set(false), 1500);
      })
      .catch(() => {
        /* presse-papiers refusé (permissions, contexte non sécurisé) : pas d'accusé */
      });
  }

  /**
   * L'adresse change à l'enregistrement d'un évènement déjà passé en ligne : l'ancienne
   * redirigera, mais mieux vaut le savoir avant d'enregistrer.
   */
  readonly slugWillMove = computed(() => {
    const typed = this.formValue().slug.trim();
    return !!this.publishedAt() && this.form.controls.slug.dirty && typed !== (this.slug() ?? '');
  });

  onCoverLoaded(event: Event): void {
    this.imageWidth.set((event.target as HTMLImageElement).naturalWidth || null);
  }

  readonly showPreview = signal(true);

  /** L'évènement tel qu'il s'afficherait, reconstruit à chaque frappe. */
  readonly previewEvent = computed<EventViewData>(() => {
    this.formValue();
    const input = this.toInput();
    return {
      ...input,
      title: input.title || 'Titre de l’évènement',
      content: input.content || '<p><em>La description de l’évènement apparaîtra ici…</em></p>',
      // Un lien invalide ne s'affiche pas : il serait refusé à l'enregistrement.
      mapUrl: this.form.controls.mapUrl.valid ? input.mapUrl : null,
      status: this.effectiveStatus() ?? 'DRAFT',
      statusReason: this.statusReason(),
      previousStartAt: this.previousStartAt(),
    };
  });

  // --- Cycle de vie --------------------------------------------------------------

  readonly panel = signal<LifecyclePanel>(null);
  readonly postponeForm = this.fb.nonNullable.group({
    start: ['', Validators.required],
    end: ['', Validators.required],
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(300)]],
  });
  readonly cancelForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(300)]],
  });
  readonly unpublishOpen = signal(false);
  readonly unpublishMessage =
    'La page publique de cet évènement répondra « introuvable », et il sortira du listing.\n\nRéservé à une publication faite par erreur : un évènement qui n’aura pas lieu s’annule.';

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dirty.set(this.form.dirty));
    this.destroyRef.onDestroy(() => {
      if (this.savedTimer) clearTimeout(this.savedTimer);
      if (this.urlCopiedTimer) clearTimeout(this.urlCopiedTimer);
    });

    const id = this.id();
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.events.adminGet(id).subscribe({
      next: (event) => {
        this.apply(event);
        this.loading.set(false);
        // Arrivée depuis le menu de la liste (« Reporter… », « Annuler… ») : le panneau s'ouvre.
        const action = this.route.snapshot.queryParamMap.get('action');
        if ((action === 'postpone' || action === 'cancel') && this.canChangeCourse()) {
          this.openPanel(action);
        }
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(
          e.status === 404 ? 'Cet évènement n’existe plus.' : 'Le chargement a échoué.',
        );
        this.loading.set(false);
      },
    });
  }

  /** Reporte un évènement enregistré dans le formulaire, qui redevient « propre ». */
  private apply(event: AdminEvent): void {
    this.form.reset({
      title: event.title,
      slug: event.slug,
      type: event.type ?? '',
      typeLabel: event.typeLabel ?? '',
      tagline: event.tagline,
      summary: event.summary,
      content: event.content,
      coverImageUrl: event.coverImageUrl ?? '',
      coverImageAlt: event.coverImageAlt ?? '',
      start: isoToParisLocal(event.startAt),
      end: isoToParisLocal(event.endAt),
      mode: event.mode,
      venueName: event.venueName ?? '',
      street: event.street ?? '',
      postalCode: event.postalCode ?? '',
      city: event.city ?? '',
      region: event.region ?? '',
      country: event.country ?? '',
      accessInfo: event.accessInfo ?? '',
      wheelchairAccessible: event.wheelchairAccessible,
      mapUrl: event.mapUrl ?? '',
      roleMoze: event.roleMoze,
      organizerName: event.organizerName ?? '',
      organizerUrl: event.organizerUrl ?? '',
      organizerLogoUrl: event.organizerLogoUrl ?? '',
      organizerContact: event.organizerContact ?? '',
      access: event.access ?? '',
      priceLabel: event.priceLabel ?? '',
      price: event.priceCents !== null ? String(event.priceCents / 100).replace('.', ',') : '',
      registrationUrl: event.registrationUrl ?? '',
      capacity: event.capacity !== null ? String(event.capacity) : '',
      registrationGoal: event.registrationGoal !== null ? String(event.registrationGoal) : '',
      registrationDeadline: isoToParisLocal(event.registrationDeadline),
      registrationInfo: event.registrationInfo ?? '',
    });
    // `reset` ne sait pas redimensionner un FormArray : la liste est reconstruite à part.
    const partners = this.form.controls.partners;
    partners.clear({ emitEvent: false });
    for (const partner of event.partners ?? []) {
      partners.push(this.partnerGroup(partner), { emitEvent: false });
    }
    partners.markAsPristine();
    this.form.updateValueAndValidity();
    this.applyState(event);
    this.dirty.set(false);
  }

  /** Ce qui ne passe pas par le formulaire : statut, slug, historique d'un report. */
  private applyState(event: AdminEvent): void {
    this.status.set(event.status);
    this.effectiveStatus.set(event.effectiveStatus);
    this.slug.set(event.slug);
    this.slugManual.set(event.slugManual);
    this.publishedAt.set(event.publishedAt);
    this.previousStartAt.set(event.previousStartAt);
    this.statusReason.set(event.statusReason);
    // Un évènement en ligne ne change de date que par un report.
    if (this.isDraft()) this.form.controls.start.enable({ emitEvent: false });
    else this.form.controls.start.disable({ emitEvent: false });
  }

  private toInput(): EventInput {
    const v = this.form.getRawValue();
    const orNull = (s: string) => s.trim() || null;
    const online = v.mode === 'en-ligne';
    return {
      title: v.title.trim(),
      // Envoyé seulement si on y a touché : sinon le back continue de le calculer (type, titre,
      // date) tant que l'évènement n'a pas été en ligne. Vidé, il rend la main au calcul.
      ...(this.form.controls.slug.dirty ? { slug: v.slug.trim() } : {}),
      type: v.type || null,
      typeLabel: v.type === 'autre' ? orNull(v.typeLabel) : null,
      tagline: v.tagline.trim(),
      summary: v.summary.trim(),
      content: v.content,
      coverImageUrl: orNull(v.coverImageUrl),
      // Sans image, un texte alternatif ne décrirait rien.
      coverImageAlt: orNull(v.coverImageUrl) ? orNull(v.coverImageAlt) : null,
      startAt: parisLocalToIso(v.start),
      endAt: parisLocalToIso(v.end),
      mode: v.mode,
      // Un évènement en ligne n'a pas d'adresse : on n'envoie pas celle qui traînerait d'une saisie
      // antérieure, elle ressortirait sur la page si l'on repassait en présentiel sans y penser.
      venueName: online ? null : orNull(v.venueName),
      street: online ? null : orNull(v.street),
      postalCode: online ? null : orNull(v.postalCode),
      city: online ? null : orNull(v.city),
      region: online ? null : orNull(v.region),
      country: online ? null : orNull(v.country)?.toUpperCase() ?? null,
      accessInfo: online ? null : orNull(v.accessInfo),
      wheelchairAccessible: !online && v.wheelchairAccessible,
      mapUrl: online ? null : orNull(v.mapUrl),
      roleMoze: v.roleMoze,
      organizerName: orNull(v.organizerName),
      organizerUrl: orNull(v.organizerUrl),
      organizerLogoUrl: orNull(v.organizerLogoUrl),
      organizerContact: orNull(v.organizerContact),
      partners: v.partners
        .filter((partner) => partner.name.trim())
        .map((partner) => ({
          role: partner.role,
          name: partner.name.trim(),
          url: orNull(partner.url),
          logoUrl: orNull(partner.logoUrl),
          description: orNull(partner.description),
        })),
      access: v.access || null,
      priceLabel: orNull(v.priceLabel),
      // Le prix n'a de sens que pour un accès payant : un reste de saisie n'est pas envoyé.
      priceCents:
        v.access === 'payant' && v.price.trim()
          ? Math.round(Number(v.price.replace(',', '.')) * 100)
          : null,
      registrationUrl: orNull(v.registrationUrl),
      capacity: v.capacity.trim() ? Number(v.capacity) : null,
      registrationGoal: v.registrationGoal.trim() ? Number(v.registrationGoal) : null,
      registrationDeadline: parisLocalToIso(v.registrationDeadline),
      registrationInfo: orNull(v.registrationInfo),
    };
  }

  /** Corps envoyé à l'API. Sur un évènement publié, la date de début n'y figure pas (cf. report). */
  private payload(): Partial<EventInput> {
    const input: Partial<EventInput> = this.toInput();
    if (!this.isDraft()) delete input.startAt;
    return input;
  }

  /** Valide le formulaire ; `false` s'il reste une erreur, alors signalée sous les champs. */
  private checkForm(): boolean {
    if (this.form.valid) return true;
    this.form.markAllAsTouched();
    this.error.set('Corrigez les champs signalés avant d’enregistrer.');
    return false;
  }

  /** Création ou mise à jour, selon qu'on édite déjà un évènement enregistré. */
  private persist(): Observable<AdminEvent> {
    const id = this.id();
    return id
      ? this.events.update(id, this.payload())
      : this.events.create(this.toInput());
  }

  setMode(mode: EventMode): void {
    this.form.controls.mode.setValue(mode);
    this.form.controls.mode.markAsDirty();
    this.dirty.set(true);
  }

  save(): void {
    if (!this.checkForm()) return;
    this.saving.set(true);
    this.error.set(null);

    this.persist().subscribe({
      next: (event) => {
        this.saving.set(false);
        this.adopt(event);
        this.apply(event);
        this.flashSaved('Enregistré');
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiMessage(e, 'L’enregistrement a échoué.'));
      },
    });
  }

  /**
   * Enregistre puis publie. Refusé avant tout appel s'il manque un champ ; le back peut encore
   * refuser si un autre évènement est en ligne, et son message le nomme.
   */
  publish(): void {
    if (!this.checkForm()) return;
    const missing = this.missing();
    const refusal = [
      ...(missing.length ? [`Pour publier, il manque ${this.enumerate(missing)}.`] : []),
      ...this.forbidden(),
    ];
    if (refusal.length) {
      this.error.set(refusal.join(' '));
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.persist()
      .pipe(
        // Adopté avant de publier : si la publication est refusée, l'évènement créé reste celui
        // qu'on édite, et un second clic ne crée pas de doublon.
        tap((event) => {
          this.adopt(event);
          this.apply(event);
        }),
        switchMap((event) => this.events.publish(event.id)),
      )
      .subscribe({
        next: () => {
          this.dirty.set(false);
          void this.router.navigate(['/admin/evenements']);
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(apiMessage(e, 'La publication a échoué.'));
        },
      });
  }

  /**
   * Premier enregistrement : l'écran devient celui de l'édition. L'adresse est remplacée sans
   * navigation — le composant garde sa saisie et son état — et sans empiler l'historique :
   * « précédent » ne doit pas ramener à un formulaire vierge.
   */
  private adopt(event: AdminEvent): void {
    if (this.id()) return;
    this.id.set(event.id);
    this.location.replaceState(`/admin/evenements/${event.id}/edit`);
  }

  // --- Cycle de vie --------------------------------------------------------------

  openPanel(panel: Exclude<LifecyclePanel, null>): void {
    this.panel.set(this.panel() === panel ? null : panel);
    if (panel === 'postpone') {
      const v = this.form.getRawValue();
      this.postponeForm.reset({ start: v.start, end: v.end, reason: '' });
    } else {
      this.cancelForm.reset({ reason: '' });
    }
  }

  markFull(full: boolean): void {
    this.runLifecycle((id) => this.events.markFull(id, full), full ? 'Marqué complet' : 'Rouvert');
  }

  confirmPostpone(): void {
    if (this.postponeForm.invalid) {
      this.postponeForm.markAllAsTouched();
      return;
    }
    const v = this.postponeForm.getRawValue();
    const startAt = parisLocalToIso(v.start);
    const endAt = parisLocalToIso(v.end);
    if (!startAt || !endAt) return;
    this.runLifecycle(
      (id) => this.events.postpone(id, { startAt, endAt, reason: v.reason.trim() }),
      'Évènement reporté',
    );
  }

  confirmCancel(): void {
    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    this.runLifecycle(
      (id) => this.events.cancel(id, this.cancelForm.getRawValue().reason.trim()),
      'Évènement annulé',
    );
  }

  confirmUnpublish(): void {
    this.unpublishOpen.set(false);
    this.runLifecycle((id) => this.events.unpublish(id), 'Repassé en brouillon');
  }

  /**
   * Une transition du cycle de vie. Les saisies en cours dans le formulaire ne sont pas perdues :
   * seul l'état est repris, et les dates quand un report les a changées.
   */
  private runLifecycle(request: (id: string) => Observable<AdminEvent>, done: string): void {
    const id = this.id();
    if (!id) return;
    this.saving.set(true);
    this.error.set(null);

    request(id).subscribe({
      next: (event) => {
        this.saving.set(false);
        this.panel.set(null);
        this.applyState(event);
        const dirty = this.dirty();
        this.form.patchValue(
          { start: isoToParisLocal(event.startAt), end: isoToParisLocal(event.endAt) },
          { emitEvent: true },
        );
        this.dirty.set(dirty);
        this.flashSaved(done);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(apiMessage(e, 'L’opération a échoué.'));
      },
    });
  }

  // --- Import d'un document -----------------------------------------------------

  readonly importing = signal(false);
  /** Bilan du dernier import, affiché sous la barre. `null` = aucun import dans cette session. */
  readonly importReport = signal<{
    filled: readonly string[];
    issues: readonly string[];
    images: boolean;
  } | null>(null);

  /**
   * Importe un document Word et pré-remplit le formulaire — le bouton « Importer… », comme pour
   * les articles, avec les étiquettes du collage (`event-intake.ts`).
   *
   * Les champs lus **écrasent** ceux déjà saisis, les autres restent : l'import est une action
   * explicite sur un brouillon. Les partenaires lus remplacent la liste ; un document qui n'en
   * cite aucun la laisse telle quelle.
   */
  onImportSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // autorise la re-sélection du même fichier
    if (!file) return;

    this.importing.set(true);
    this.error.set(null);

    importEventFromDocx(file)
      .then((result) => {
        this.applyImport(result.values);
        this.importReport.set({
          filled: result.filled,
          issues: result.issues,
          images: result.hasImages,
        });
        this.importing.set(false);
        this.markEdited();
      })
      .catch((err: unknown) => {
        this.importing.set(false);
        this.error.set(
          err instanceof DocxReadError
            ? err.message
            : "Le document n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier .docx.",
        );
      });
  }

  /** Reporte dans le formulaire les seuls champs que l'import a lus. */
  private applyImport(v: Partial<EventInput>): void {
    const text = (value: string | null | undefined) => (value === undefined ? undefined : value ?? '');
    const patch: Record<string, unknown> = {
      title: v.title,
      type: v.type === undefined ? undefined : (v.type ?? ''),
      typeLabel: text(v.typeLabel),
      tagline: v.tagline,
      summary: v.summary,
      content: v.content,
      coverImageAlt: text(v.coverImageAlt),
      start: v.startAt ? isoToParisLocal(v.startAt) : undefined,
      end: v.endAt ? isoToParisLocal(v.endAt) : undefined,
      mode: v.mode,
      venueName: text(v.venueName),
      street: text(v.street),
      postalCode: text(v.postalCode),
      city: text(v.city),
      region: text(v.region),
      country: text(v.country),
      accessInfo: text(v.accessInfo),
      wheelchairAccessible: v.wheelchairAccessible,
      mapUrl: text(v.mapUrl),
      roleMoze: v.roleMoze,
      organizerName: text(v.organizerName),
      organizerUrl: text(v.organizerUrl),
      organizerContact: text(v.organizerContact),
      access: v.access === undefined ? undefined : (v.access ?? ''),
      priceLabel: text(v.priceLabel),
      price:
        v.priceCents === undefined || v.priceCents === null
          ? undefined
          : String(v.priceCents / 100).replace('.', ','),
      registrationUrl: text(v.registrationUrl),
      capacity: v.capacity ? String(v.capacity) : undefined,
      registrationGoal: v.registrationGoal ? String(v.registrationGoal) : undefined,
      registrationDeadline: v.registrationDeadline
        ? isoToParisLocal(v.registrationDeadline)
        : undefined,
      registrationInfo: text(v.registrationInfo),
    };
    // Un évènement publié ne change de date que par un report : le début lu n'est pas appliqué.
    if (!this.isDraft()) delete patch['start'];

    this.form.patchValue(
      Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
    );
    // L'adresse ne part que si son champ a été touché (cf. `toInput`) : lue dans le document,
    // elle compte comme saisie.
    if (v.slug) {
      this.form.controls.slug.markAsDirty();
      this.form.controls.slug.setValue(v.slug);
    }

    if (v.partners?.length) {
      const partners = this.form.controls.partners;
      partners.clear({ emitEvent: false });
      for (const partner of v.partners) partners.push(this.partnerGroup(partner), { emitEvent: false });
      this.form.updateValueAndValidity();
    }
  }

  dismissImportReport(): void {
    this.importReport.set(null);
  }

  // --- Image ---------------------------------------------------------------------

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.error.set(null);
    this.events.upload(file).subscribe({
      next: ({ url }) => {
        this.form.controls.coverImageUrl.setValue(url);
        this.form.controls.coverImageUrl.markAsDirty();
        this.dirty.set(true);
        this.uploading.set(false);
        input.value = '';
      },
      error: (e) => {
        this.uploading.set(false);
        input.value = '';
        this.error.set(apiMessage(e, 'L’envoi de l’image a échoué.'));
      },
    });
  }

  removeCover(): void {
    this.form.controls.coverImageUrl.setValue('');
    this.form.controls.coverImageUrl.markAsDirty();
    this.imageWidth.set(null);
    this.dirty.set(true);
  }

  /** Logo de l'organisateur (`index` absent) ou d'un partenaire. */
  onLogoSelected(event: Event, index?: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.error.set(null);
    this.events.upload(file).subscribe({
      next: ({ url }) => {
        const control =
          index === undefined
            ? this.form.controls.organizerLogoUrl
            : this.form.controls.partners.at(index).controls.logoUrl;
        control.setValue(url);
        this.markEdited();
        this.uploading.set(false);
        input.value = '';
      },
      error: (e) => {
        this.uploading.set(false);
        input.value = '';
        this.error.set(apiMessage(e, 'L’envoi du logo a échoué.'));
      },
    });
  }

  // --- Navigation ----------------------------------------------------------------

  cancel(): void {
    if (this.dirty()) {
      this.leaveOpen.set(true);
      return;
    }
    void this.router.navigate(['/admin/evenements']);
  }

  confirmLeave(): void {
    this.leaveOpen.set(false);
    this.dirty.set(false);
    void this.router.navigate(['/admin/evenements']);
  }

  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  private flashSaved(message: string): void {
    this.saved.set(message);
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.saved.set(null), 2500);
  }

  enumerate(items: string[]): string {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
  }
}
