import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  IMPORT_FIELD_LABELS,
  ImportField,
  importArticleFromDocx,
} from '../../common/article-import';
import { DocxReadError } from '../../common/docx';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ArticleCardComponent } from '../../components/article-card/article-card.component';
import { ArticleViewComponent } from '../../components/article-view/article-view.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { PromptDialogComponent } from '../../components/prompt-dialog/prompt-dialog.component';
import { TagInputComponent } from '../../components/tag-input/tag-input.component';
import { WysiwygEditorComponent } from '../../components/wysiwyg/wysiwyg-editor.component';
import {
  Article,
  ArticleInput,
  ArticleListItem,
  ArticleStatus,
  CoverPosition,
  MAX_FEATURED,
  Tag,
} from '../../model/article.model';
import { BlogService } from '../../services/blog.service';
import { environment } from '../../../environements/environment';

/** Auteur affiché quand le champ est laissé vide. */
const DEFAULT_AUTHOR = 'Équipe Moze';

/** Tag ajouté par défaut quand l'article n'en a aucun (après confirmation). */
const DEFAULT_TAG = 'Moze';

/**
 * Une `Date` au format d'un `<input type="datetime-local">` : heure LOCALE, sans fuseau.
 * `toISOString()` ne convient pas — il bascule en UTC, et « demain 8 h » deviendrait 6 h.
 */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
    selector: 'app-admin-blog-editor',
    imports: [
        DatePipe,
        ReactiveFormsModule,
        RouterLink,
        WysiwygEditorComponent,
        TagInputComponent,
        ConfirmDialogComponent,
        PromptDialogComponent,
        ArticleCardComponent,
        ArticleViewComponent,
    ],
    templateUrl: './admin-blog-editor.component.html',
    styleUrl: './admin-blog-editor.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '(document:keydown.escape)': 'closeMenu()' },
})
export class AdminBlogEditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly blog = inject(BlogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Repère d'un pixel placé avant la barre : sa sortie de l'écran = « on a défilé ». */
  private readonly topSentinel =
    viewChild<ElementRef<HTMLElement>>('topSentinel');
  private readonly previewSection =
    viewChild<ElementRef<HTMLElement>>('previewSection');

  /** La barre ne prend son relief qu'une fois détachée du haut de page. */
  readonly scrolled = signal(false);

  readonly id = signal<string | null>(null);
  readonly isEdit = computed(() => this.id() !== null);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploadingCover = signal(false);
  readonly error = signal<string | null>(null);
  readonly allTags = signal<Tag[]>([]);
  readonly tagToDelete = signal<Tag | null>(null);
  /** Nb d'articles portant le tag (renvoyé par le back au 1er refus) → confirmation forcée. */
  readonly tagDeleteCount = signal<number | null>(null);
  readonly tagToRename = signal<Tag | null>(null);
  readonly deleteTagMessage = computed(() => {
    const t = this.tagToDelete();
    if (!t) return '';
    const count = this.tagDeleteCount();
    if (count !== null) {
      return `Le tag « ${t.name} » est utilisé par ${count} article(s).\n\nLe supprimer le retirera de ces ${count} article(s). Cette action est irréversible.`;
    }
    return `Supprimer le tag « ${t.name} » ?\n\nS'il est utilisé par des articles, il en sera retiré. Cette action est irréversible.`;
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    slug: ['', [Validators.maxLength(120)]],
    author: ['', [Validators.maxLength(120)]],
    excerpt: ['', [Validators.maxLength(500)]],
    coverImageUrl: ['', [Validators.maxLength(500)]],
    coverPosition: new FormControl<CoverPosition>('top', { nonNullable: true }),
    content: [''],
    metaTitle: ['', [Validators.maxLength(200)]],
    metaDescription: ['', [Validators.maxLength(500)]],
    tags: new FormControl<string[]>([], { nonNullable: true }),
  });

  /**
   * Statut de l'article chargé — le formulaire ne le porte pas (il n'est pas
   * modifiable directement), mais l'écran doit dire ce qu'on est en train
   * d'éditer : un brouillon ou un article en ligne.
   */
  readonly status = signal<ArticleStatus | null>(null);
  readonly isPublished = computed(() => this.status() === 'PUBLISHED');

  /** Date de publication de l'article ouvert (ISO), future quand il est programmé. */
  readonly articlePublishedAt = signal<string | null>(null);

  /**
   * Publié avec une date encore à venir : masqué du public jusqu'à l'échéance. Évalué à
   * l'affichage — l'étiquette ne bascule pas d'elle-même à l'heure dite, un rechargement suffit.
   */
  readonly isScheduled = computed(() => {
    const at = this.articlePublishedAt();
    return (
      this.status() === 'PUBLISHED' && !!at && new Date(at).getTime() > Date.now()
    );
  });

  /** Slug enregistré (≠ celui du formulaire tant qu'on n'a pas sauvegardé). */
  readonly savedSlug = signal<string | null>(null);

  // --- Adresse publique -----------------------------------------------------

  /**
   * L'adresse complète de l'article telle qu'on la collerait dans un message.
   *
   * L'origine vient du navigateur : `http://localhost:4200` en développement,
   * `https://www.moze.fr` en production, sans réglage à tenir à jour. Repli sur
   * `environment.siteUrl` pour le rendu serveur, qui n'a pas de `location`.
   *
   * Suit la saisie en cours plutôt que le slug enregistré : on copie l'adresse
   * qu'aura l'article après enregistrement. `null` tant qu'aucun slug n'est connu
   * — le back en dérivera un du titre, impossible à deviner ici.
   */
  readonly publicUrl = computed(() => {
    const slug = (this.formValue().slug || this.savedSlug() || '').trim();
    if (!slug) return null;

    const origin =
      typeof location !== 'undefined' ? location.origin : environment.siteUrl;
    return `${origin}/blog/${slug}`;
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

  // --- « À la une » --------------------------------------------------------

  /** Épinglage de l'article ouvert (`null` = pas à la une). */
  readonly featuredAt = signal<string | null>(null);
  readonly isFeatured = computed(() => this.featuredAt() !== null);
  readonly featureBusy = signal(false);
  readonly maxFeatured = MAX_FEATURED;

  /**
   * Les articles épinglés quand la limite est atteinte : plutôt qu'un refus sec du back, on
   * affiche la une telle qu'elle est et l'auteur choisit lequel cède sa place. `null` = fermé.
   */
  readonly featureSwapChoices = signal<ArticleListItem[] | null>(null);

  /**
   * Intention « à la une » d'un article pas encore en ligne : mémorisée pendant la rédaction,
   * appliquée automatiquement à la publication. Le back n'épingle que des articles publiés — la
   * une ne montre que des pages qui existent —, l'intention comble l'attente.
   */
  readonly pendingFeature = signal(false);
  /** L'article choisi pour céder sa place à la publication (une pleine au moment du choix). */
  readonly pendingSwap = signal<ArticleListItem | null>(null);
  /** Vrai quand la modale d'échange sert l'intention (pas l'action immédiate). */
  private swapForLater = false;

  /**
   * Épingle ou retire l'article ouvert. Publié : action immédiate. Pas encore publié (nouveau,
   * brouillon, en cours de rédaction) : enregistre l'intention, appliquée à la mise en ligne —
   * re-cliquer l'annule.
   */
  toggleFeature(): void {
    if (this.featureBusy()) return;

    const id = this.id();
    if (id && this.isPublished()) {
      this.featureBusy.set(true);

      // Épinglé, ou échange mémorisé sur un article programmé : dans les deux cas le clic
      // annule, et `unfeature` efface l'un comme l'autre côté back.
      if (this.isFeatured() || this.pendingFeature()) {
        this.blog.unfeature(id).subscribe({
          next: (a) => {
            this.featuredAt.set(a.featuredAt);
            this.pendingFeature.set(false);
            this.pendingSwap.set(null);
            this.featureBusy.set(false);
          },
          error: () => {
            this.featureBusy.set(false);
            this.error.set('Le retrait de la une a échoué.');
          },
        });
        return;
      }

      // La limite se vérifie AVANT de tenter : à 5/5, on propose l'échange plutôt qu'une erreur.
      this.blog.featured().subscribe({
        next: (list) => {
          if (list.length >= MAX_FEATURED) {
            this.featureBusy.set(false);
            this.swapForLater = false;
            this.featureSwapChoices.set(list);
            return;
          }
          this.featureNow(id);
        },
        // Liste indisponible : on tente quand même, le back tranchera.
        error: () => this.featureNow(id),
      });
      return;
    }

    // --- Intention, pour un article pas encore en ligne ---
    if (this.pendingFeature()) {
      this.pendingFeature.set(false);
      this.pendingSwap.set(null);
      return;
    }

    this.featureBusy.set(true);
    this.blog.featured().subscribe({
      next: (list) => {
        this.featureBusy.set(false);
        if (list.length >= MAX_FEATURED) {
          this.swapForLater = true;
          this.featureSwapChoices.set(list);
          return;
        }
        this.pendingFeature.set(true);
      },
      // Liste indisponible : l'intention est retenue, la limite se re-vérifiera à la publication.
      error: () => {
        this.featureBusy.set(false);
        this.pendingFeature.set(true);
      },
    });
  }

  // --- Import d'un document -------------------------------------------------

  readonly importing = signal(false);
  /** Champs qu'un import n'a pas su remplir : signalés en rouge dans le formulaire. */
  readonly importMissing = signal<readonly ImportField[]>([]);
  /** Bilan du dernier import, affiché sous la barre. `null` = aucun import dans cette session. */
  readonly importReport = signal<{ filled: number; missing: string[]; images: boolean } | null>(
    null,
  );

  readonly importFieldLabels = IMPORT_FIELD_LABELS;

  /**
   * Les champs signalés par l'import qui sont **encore** vides.
   *
   * Recalculé à chaque frappe : un champ qu'on vient de compléter perd son liseré rouge
   * immédiatement. Sans ça, l'avertissement de publication réclamerait éternellement une
   * couverture déjà choisie.
   */
  readonly missingNow = computed<ImportField[]>(() => {
    const flagged = this.importMissing();
    if (!flagged.length) return [];

    const v = this.formValue();
    const vide = (field: ImportField): boolean => {
      if (field === 'tags') return !v.tags?.length;
      // Le contenu vient de l'éditeur riche : du HTML sans texte reste vide aux yeux du lecteur.
      if (field === 'content') return !v.content?.replace(/<[^>]*>/g, '').trim();
      return !String(v[field] ?? '').trim();
    };

    return flagged.filter(vide);
  });

  /** Vrai si ce champ est signalé ET toujours vide — sert au liseré rouge. */
  isMissing(field: ImportField): boolean {
    return this.missingNow().includes(field);
  }

  /** Libellés des champs encore vides, pour l'avertissement de publication. */
  readonly missingLabels = computed(() =>
    this.missingNow().map((f) => IMPORT_FIELD_LABELS[f]),
  );

  /**
   * Importe un document Word et pré-remplit le formulaire.
   *
   * Les champs déjà saisis sont écrasés : l'import est une action explicite sur un article en
   * préparation, pas une fusion — laisser cohabiter deux sources donnerait un article composite
   * dont personne ne saurait dire d'où vient quoi.
   */
  onImportSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // autorise la re-sélection du même fichier
    if (!file) return;

    this.importing.set(true);
    this.error.set(null);

    importArticleFromDocx(file)
      .then((result) => {
        const v = result.values;
        this.form.patchValue({
          ...(v.title !== undefined ? { title: v.title } : {}),
          ...(v.slug !== undefined ? { slug: v.slug } : {}),
          ...(v.excerpt !== undefined ? { excerpt: v.excerpt } : {}),
          ...(v.content !== undefined ? { content: v.content } : {}),
          ...(v.metaTitle !== undefined ? { metaTitle: v.metaTitle } : {}),
          ...(v.metaDescription !== undefined ? { metaDescription: v.metaDescription } : {}),
          ...(v.tags !== undefined ? { tags: v.tags } : {}),
        });

        this.importMissing.set(result.missing);
        this.importReport.set({
          filled: result.filled.length,
          missing: result.missing.map((f) => IMPORT_FIELD_LABELS[f]),
          images: result.hasImages,
        });
        this.importing.set(false);
        this.dirty.set(true);
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

  /** Ferme le bilan d'import : les liserés rouges disparaissent avec lui. */
  dismissImportReport(): void {
    this.importReport.set(null);
    this.importMissing.set([]);
  }

  // --- Avertissement : publier avec des champs vides ------------------------

  readonly missingWarningOpen = signal(false);
  /** Ce qu'on relancera si l'admin passe outre : publication simple ou programmée. */
  private missingWarningNext: (() => void) | null = null;

  /**
   * Interpose l'avertissement quand des champs signalés sont encore vides.
   *
   * @returns `true` si la modale a pris la main — l'appelant doit alors s'arrêter là.
   */
  private warnIfMissing(next: () => void): boolean {
    if (!this.missingNow().length) return false;

    this.missingWarningNext = next;
    this.missingWarningOpen.set(true);
    return true;
  }

  /** « Publier » : l'admin assume les champs vides. */
  confirmMissingWarning(): void {
    this.missingWarningOpen.set(false);
    const next = this.missingWarningNext;
    this.missingWarningNext = null;
    // Les liserés ont fait leur office : ils ne doivent pas réapparaître à l'enregistrement suivant.
    this.importMissing.set([]);
    this.importReport.set(null);
    next?.();
  }

  /** « Corriger » : retour au formulaire, les champs vides restent signalés. */
  cancelMissingWarning(): void {
    this.missingWarningOpen.set(false);
    this.missingWarningNext = null;
  }

  // --- Publication programmée ----------------------------------------------

  readonly scheduleOpen = signal(false);
  readonly scheduleValue = signal('');
  /** Échéance retenue (ISO), consommée par la prochaine publication. */
  private scheduleAtIso: string | null = null;

  /** Par défaut : demain 8 h — l'heure du café, pas celle du clic. */
  openSchedule(): void {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    this.scheduleValue.set(toDatetimeLocal(d));
    this.scheduleOpen.set(true);
  }

  cancelSchedule(): void {
    this.scheduleOpen.set(false);
  }

  onScheduleInput(event: Event): void {
    this.scheduleValue.set((event.target as HTMLInputElement).value);
  }

  /**
   * Valide l'échéance puis publie : un article en préparation passe par l'enregistrement
   * habituel (`save(true)`), un article déjà publié/programmé ne change que sa date.
   */
  confirmSchedule(): void {
    const parsed = new Date(this.scheduleValue());
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      this.error.set('La date de programmation doit être dans le futur.');
      return;
    }

    this.error.set(null);
    this.scheduleOpen.set(false);
    this.scheduleAtIso = parsed.toISOString();

    if (this.isEdit() && this.isPublished()) {
      this.reschedule();
      return;
    }
    // Programmer, c'est publier — simplement plus tard. Même avertissement, et la date choisie
    // est conservée le temps de la confirmation (`scheduleAtIso` n'est lu qu'à l'envoi).
    if (this.warnIfMissing(() => this.save(true))) return;

    this.save(true);
  }

  /** Reprogrammation d'un article déjà publié : la date seule change, sans ré-enregistrer. */
  private reschedule(): void {
    const id = this.id();
    const at = this.scheduleAtIso;
    this.scheduleAtIso = null;
    if (!id || !at) return;

    this.saving.set(true);
    this.blog.publish(id, at).subscribe({
      next: (a) => {
        this.saving.set(false);
        this.articlePublishedAt.set(a.publishedAt);
      },
      error: (err) => this.failSave(err),
    });
  }

  /** Annule une programmation : l'article paraît immédiatement (cf. back, `publish` sans date). */
  publishNow(): void {
    const id = this.id();
    if (!id || this.saving()) return;

    this.saving.set(true);
    this.blog.publish(id).subscribe({
      next: (a) => {
        this.saving.set(false);
        this.articlePublishedAt.set(a.publishedAt);
      },
      error: (err) => this.failSave(err),
    });
  }

  /**
   * Épingle l'article, éventuellement en échange d'un autre. Un seul appel : c'est le back
   * qui décide si l'échange a lieu maintenant (article déjà paru) ou attend l'échéance
   * (article programmé — l'ancien reste alors à la une entre-temps).
   */
  private featureNow(id: string, replaces?: string): void {
    this.featureBusy.set(true);
    this.blog.feature(id, replaces).subscribe({
      next: (a) => {
        this.featuredAt.set(a.featuredAt);
        // Échange mémorisé plutôt qu'appliqué : le bouton doit dire « à la publication »,
        // pas retomber sur « Mettre à la une » comme si le clic n'avait rien fait.
        this.pendingFeature.set(!a.featuredAt && !!a.featureReplacesId);
        this.featureBusy.set(false);
      },
      error: (err) => {
        this.featureBusy.set(false);
        this.error.set(this.extractError(err) ?? 'La mise à la une a échoué.');
      },
    });
  }

  /**
   * L'auteur a choisi l'article qui cède sa place. Sur un article publié : retrait puis épinglage
   * immédiats. Sur un article en préparation : le choix est mémorisé, l'échange aura lieu à la
   * mise en ligne.
   */
  swapFeature(replaced: ArticleListItem): void {
    if (this.swapForLater) {
      this.swapForLater = false;
      this.featureSwapChoices.set(null);
      this.pendingSwap.set(replaced);
      this.pendingFeature.set(true);
      return;
    }

    const id = this.id();
    if (!id) return;

    this.featureSwapChoices.set(null);
    this.featureNow(id, replaced.id);
  }

  cancelSwap(): void {
    this.swapForLater = false;
    this.featureSwapChoices.set(null);
  }

  /**
   * Applique l'intention « à la une » une fois l'article en ligne : retrait de l'article choisi
   * (si échange), puis épinglage. En cas d'échec, l'article EST publié — on reste sur la page
   * avec l'explication, plutôt que de filer vers la liste comme si tout avait réussi.
   */
  private applyPendingFeature(id: string): void {
    if (!this.pendingFeature()) {
      this.done();
      return;
    }

    const replaced = this.pendingSwap();
    this.pendingFeature.set(false);
    this.pendingSwap.set(null);

    // Un seul appel : le back libère la place et épingle si l'article paraît déjà, ou
    // mémorise l'échange s'il est programmé — l'ancien reste alors à la une jusqu'à
    // l'échéance, plutôt que de laisser la vitrine à quatre articles.
    this.blog.feature(id, replaced?.id).subscribe({
      next: () => this.done(),
      error: () =>
        this.stayWithError(
          replaced
            ? "Article publié, mais l'échange à la une a échoué — réessayez depuis la liste."
            : 'Article publié, mais la mise à la une a échoué — réessayez depuis la liste.',
        ),
    });
  }

  private stayWithError(message: string): void {
    this.saving.set(false);
    this.error.set(message);
  }

  readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'PUBLISHED':
        return this.isScheduled() ? 'Programmé' : 'Publié';
      case 'ARCHIVED':
        return 'Archivé';
      case 'DRAFT':
        return 'Brouillon';
      default:
        return 'Nouveau';
    }
  });

  /** Modifications non enregistrées : garde-fou avant de quitter la page. */
  readonly dirty = signal(false);
  readonly leaveOpen = signal(false);
  readonly leaveMessage =
    "Des modifications n'ont pas été enregistrées.\n\nElles seront perdues si vous quittez maintenant.";

  /** Menu « ⋯ » de la barre (dépublier, voir en ligne). */
  readonly menuOpen = signal(false);

  /** Modale « aucun tag → tag par défaut » et intention d'enregistrement en attente. */
  readonly defaultTagOpen = signal(false);
  readonly defaultTag = DEFAULT_TAG;
  private pendingPublish = false;

  readonly showPreview = signal(false);
  readonly previewMode = signal<'card' | 'article'>('card');

  /** Valeur live du formulaire → aperçu réactif. */
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Date affichée dans l'aperçu (celle de l'article si publié, sinon aujourd'hui). */
  private readonly previewPublishedAt = signal(new Date().toISOString());

  /** Article reconstruit depuis le formulaire, pour la carte et l'aperçu complet. */
  readonly previewArticle = computed<Article>(() => {
    const v = this.formValue();
    const date = this.previewPublishedAt();
    return {
      id: 'preview',
      slug: v.slug || 'apercu',
      title: v.title || 'Titre de l’article',
      excerpt: v.excerpt || '',
      content:
        v.content || '<p><em>Le contenu de l’article apparaîtra ici…</em></p>',
      coverImageUrl: v.coverImageUrl || null,
      coverPosition: v.coverPosition,
      author: v.author || 'Équipe Moze',
      status: 'DRAFT',
      featuredAt: null, // l'aperçu n'est jamais épinglé
      metaTitle: v.metaTitle || null,
      metaDescription: v.metaDescription || null,
      createdAt: date,
      updatedAt: date,
      publishedAt: date,
      // Le back le calcule pour les listes ; ici c'est l'aperçu qui le fournit,
      // sinon la carte d'aperçu n'afficherait pas ce que verra le visiteur.
      readingMinutes: this.readingMinutes(),
      tags: (v.tags ?? []).map((name) => ({ id: name, name, slug: name })),
    };
  });

  /**
   * Nombre de mots du contenu : le HTML est dépouillé de ses balises, ce qui
   * suffit pour un ordre de grandeur (on ne cherche pas la précision d'un
   * compteur de traitement de texte).
   */
  readonly wordCount = computed(() => {
    const text = (this.formValue().content ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, '');
    return text.split(/\s+/).filter(Boolean).length;
  });

  /** ~200 mots/minute, la moyenne usuelle en lecture d'écran. */
  readonly readingMinutes = computed(() =>
    Math.max(1, Math.ceil(this.wordCount() / 200)),
  );

  constructor() {
    // Observateur plutôt qu'écouteur de `scroll` : aucun calcul à chaque pixel,
    // et `afterNextRender` ne s'exécute pas côté serveur (rendu SSR).
    afterNextRender(() => {
      const sentinel = this.topSentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(([entry]) =>
        this.scrolled.set(!entry.isIntersecting),
      );
      observer.observe(sentinel);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // Toute frappe rend le formulaire « sale » ; le pré-remplissage à l'ouverture
    // d'un article existant est neutralisé juste après le patch.
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.dirty.set(true));

    this.blog.adminTags().subscribe((tags) => this.allTags.set(tags));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.id.set(id);
      this.loading.set(true);
      this.blog.adminGet(id).subscribe({
        next: (a) => {
          this.form.patchValue({
            title: a.title,
            slug: a.slug,
            author: a.author,
            excerpt: a.excerpt,
            coverImageUrl: a.coverImageUrl ?? '',
            coverPosition: a.coverPosition ?? 'top',
            content: a.content,
            metaTitle: a.metaTitle ?? '',
            metaDescription: a.metaDescription ?? '',
            tags: a.tags.map((t) => t.name),
          });
          // `patchValue` a émis sur `valueChanges` : on repart d'un formulaire
          // propre, sinon l'écran annonce des modifications dès l'ouverture.
          this.dirty.set(false);
          this.status.set(a.status);
          this.savedSlug.set(a.slug);
          this.featuredAt.set(a.featuredAt);
          // Échange mémorisé côté back (article programmé à la une) : l'intention doit
          // survivre au rechargement, sinon le bouton repasserait à « Mettre à la une »
          // alors qu'elle est bien enregistrée.
          this.pendingFeature.set(!!a.featureReplacesId);
          this.articlePublishedAt.set(a.publishedAt);
          if (a.publishedAt) this.previewPublishedAt.set(a.publishedAt);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Article introuvable.');
          this.loading.set(false);
        },
      });
    }
  }

  onTagCreate(name: string): void {
    this.blog.createTag(name).subscribe({
      next: (newTag) => {
        this.allTags.update((tags) => [...tags, newTag]);

        // Ajoute le tag au formulaire
        const current = [...this.form.controls.tags.value, newTag.name];
        this.form.controls.tags.setValue(current);
      },
      error: () => this.error.set('Erreur lors de la création du tag.')
    });
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingCover.set(true);
    this.blog.upload(file).subscribe({
      next: ({ url }) => {
        this.form.patchValue({ coverImageUrl: url });
        this.uploadingCover.set(false);
        input.value = '';
      },
      error: () => {
        this.uploadingCover.set(false);
        this.error.set("Échec de l'upload de la couverture.");
      },
    });
  }

  /** Retire la couverture (vidée → enregistrée à `null` côté back au save). */
  removeCover(): void {
    this.form.patchValue({ coverImageUrl: '' });
  }

  /** Options de position de l'image de couverture (le texte se place à l'opposé). */
  readonly coverPositions: { value: CoverPosition; label: string }[] = [
    { value: 'top', label: 'Haut' },
    { value: 'bottom', label: 'Bas' },
    { value: 'left', label: 'Gauche' },
    { value: 'right', label: 'Droite' },
  ];

  setCoverPosition(position: CoverPosition): void {
    this.form.controls.coverPosition.setValue(position);
  }

  togglePreview(): void {
    const opening = !this.showPreview();
    this.showPreview.set(opening);
    // Seule l'ouverture déplace la page : à la fermeture, on reste où on est.
    if (opening) this.revealPreview();
  }

  setPreviewMode(mode: 'card' | 'article'): void {
    const wasClosed = !this.showPreview();
    this.previewMode.set(mode);
    this.showPreview.set(true);
    if (wasClosed) this.revealPreview();
  }

  /**
   * Amène le panneau d'aperçu juste sous la barre collante.
   *
   * Le défilement attend le rendu du panneau : tant qu'il n'est pas dans le DOM,
   * le document est trop court et le navigateur bute sur son bas — le panneau
   * s'arrêtait alors au milieu de l'écran au lieu de remonter en haut. C'est
   * aussi pour ça que le panneau réserve une hauteur d'écran (cf. le SCSS).
   *
   * Le défilement lui-même est délégué au CSS (`scroll-behavior: smooth` global,
   * neutralisé par le réglage « animations réduites ») et `scroll-margin-top`
   * réserve la hauteur de la barre.
   */
  private revealPreview(): void {
    afterNextRender(
      () =>
        this.previewSection()?.nativeElement.scrollIntoView({ block: 'start' }),
      { injector: this.injector },
    );
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Retire l'article de la ligne sans quitter l'éditeur. */
  unpublish(): void {
    const id = this.id();
    if (!id || this.saving()) return;
    this.closeMenu();
    this.saving.set(true);
    this.error.set(null);
    this.blog.unpublish(id).subscribe({
      next: (a) => {
        this.status.set(a.status);
        this.saving.set(false);
      },
      error: (err) => this.failSave(err),
    });
  }

  // --- Suppression d'un tag global (modale de confirmation) ---
  onTagRemove(tag: Tag): void {
    this.tagToDelete.set(tag);
    this.tagDeleteCount.set(null);
  }
  cancelTagDelete(): void {
    this.tagToDelete.set(null);
    this.tagDeleteCount.set(null);
  }
  confirmTagDelete(): void {
    const tag = this.tagToDelete();
    if (!tag) return;
    // `force` seulement après que le back a signalé le tag comme utilisé (2ᵉ confirmation).
    const force = this.tagDeleteCount() !== null;
    this.blog.deleteTag(tag.id, force).subscribe({
      next: () => {
        this.allTags.update((arr) => arr.filter((t) => t.id !== tag.id));
        const current = this.form.controls.tags.value.filter(
          (n) => n.toLowerCase() !== tag.name.toLowerCase(),
        );
        this.form.controls.tags.setValue(current);
        this.tagToDelete.set(null);
        this.tagDeleteCount.set(null);
      },
      error: (err) => {
        // Garde-fou back : tag encore utilisé → on garde la modale ouverte et on
        // affiche le nombre d'articles impactés pour une confirmation explicite.
        if (err?.status === 409 && typeof err.error?.count === 'number') {
          this.tagDeleteCount.set(err.error.count);
          return;
        }
        this.tagToDelete.set(null);
        this.tagDeleteCount.set(null);
        this.error.set('Impossible de supprimer le tag.');
      },
    });
  }

  // --- Renommage d'un tag global (modale de saisie) ---
  onTagRename(tag: Tag): void {
    this.tagToRename.set(tag);
  }
  cancelTagRename(): void {
    this.tagToRename.set(null);
  }
  confirmTagRename(name: string): void {
    const tag = this.tagToRename();
    if (!tag) return;
    const old = tag.name;
    this.blog.renameTag(tag.id, name).subscribe({
      next: (updated) => {
        this.allTags.update((arr) =>
          arr.map((t) => (t.id === tag.id ? updated : t)),
        );
        const current = this.form.controls.tags.value.map((n) =>
          n.toLowerCase() === old.toLowerCase() ? updated.name : n,
        );
        this.form.controls.tags.setValue(current);
        this.tagToRename.set(null);
      },
      error: () => {
        this.tagToRename.set(null);
        this.error.set('Renommage impossible (nom déjà utilisé ?).');
      },
    });
  }

  save(publish: boolean): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Mettre en ligne un article dont l'import a laissé des trous mérite une confirmation. Ne
    // concerne que la publication : enregistrer un brouillon incomplet est normal, c'est même
    // l'usage — on écrit en plusieurs fois.
    if (publish && this.warnIfMissing(() => this.save(true))) return;

    // Aucun tag : on propose d'ajouter le tag par défaut avant d'enregistrer,
    // plutôt que de publier un article non classé sans le dire.
    if (!this.form.controls.tags.value.length) {
      this.pendingPublish = publish;
      this.defaultTagOpen.set(true);
      return;
    }
    this.performSave(publish);
  }

  /** L'admin accepte le tag par défaut : on l'ajoute puis on enregistre. */
  confirmDefaultTag(): void {
    this.defaultTagOpen.set(false);
    this.form.controls.tags.setValue([DEFAULT_TAG]);
    this.performSave(this.pendingPublish);
  }

  /** L'admin préfère saisir ses propres tags : on annule l'enregistrement. */
  cancelDefaultTag(): void {
    this.defaultTagOpen.set(false);
  }

  private performSave(publish: boolean): void {
    this.saving.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const input: ArticleInput = {
      title: v.title,
      slug: v.slug || undefined,
      // Auteur par défaut si le champ est vide.
      author: v.author.trim() || DEFAULT_AUTHOR,
      excerpt: v.excerpt,
      content: v.content,
      coverImageUrl: v.coverImageUrl || null,
      coverPosition: v.coverPosition,
      metaTitle: v.metaTitle || null,
      metaDescription: v.metaDescription || null,
      tags: v.tags,
    };

    const id = this.id();
    const op = id ? this.blog.update(id, input) : this.blog.create(input);
    op.subscribe({
      next: (article) => {
        if (publish) {
          // L'échéance de programmation, si l'admin en a choisi une, part avec la publication ;
          // puis l'intention « à la une » s'applique (cf. applyPendingFeature).
          const at = this.scheduleAtIso;
          this.scheduleAtIso = null;
          this.blog.publish(article.id, at ?? undefined).subscribe({
            next: (published) => {
              this.status.set('PUBLISHED');
              this.articlePublishedAt.set(published.publishedAt);
              this.applyPendingFeature(published.id);
            },
            error: (err) => this.failSave(err),
          });
        } else {
          this.done();
        }
      },
      error: (err) => this.failSave(err),
    });
  }

  /** Retour à la liste — demande confirmation si des modifications sont en cours. */
  cancel(): void {
    if (this.dirty()) {
      this.leaveOpen.set(true);
      return;
    }
    this.done();
  }

  confirmLeave(): void {
    this.leaveOpen.set(false);
    this.done();
  }

  cancelLeave(): void {
    this.leaveOpen.set(false);
  }

  private done(): void {
    void this.router.navigate(['/admin/blog']);
  }

  private failSave(err?: unknown): void {
    this.saving.set(false);
    this.error.set(this.extractError(err) ?? "Échec de l'enregistrement.");
  }

  /** Récupère le message d'erreur réel du back (NestJS : { message: string | string[] }). */
  private extractError(err: unknown): string | null {
    const msg = (err as { error?: { message?: string | string[] } } | null)?.error
      ?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    return typeof msg === 'string' ? msg : null;
  }
}
