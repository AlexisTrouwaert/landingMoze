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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
  ArticleStatus,
  CoverPosition,
  Tag,
} from '../../model/article.model';
import { BlogService } from '../../services/blog.service';

@Component({
    selector: 'app-admin-blog-editor',
    imports: [
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

  /** Slug enregistré (≠ celui du formulaire tant qu'on n'a pas sauvegardé). */
  readonly savedSlug = signal<string | null>(null);

  readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'PUBLISHED':
        return 'Publié';
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
    this.saving.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const input: ArticleInput = {
      title: v.title,
      slug: v.slug || undefined,
      author: v.author,
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
          this.blog.publish(article.id).subscribe({
            next: () => this.done(),
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
