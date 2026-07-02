import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ArticleCardComponent } from '../../components/article-card/article-card.component';
import { ArticleViewComponent } from '../../components/article-view/article-view.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { PromptDialogComponent } from '../../components/prompt-dialog/prompt-dialog.component';
import { TagInputComponent } from '../../components/tag-input/tag-input.component';
import { WysiwygEditorComponent } from '../../components/wysiwyg/wysiwyg-editor.component';
import { Article, ArticleInput, CoverPosition, Tag } from '../../model/article.model';
import { BlogService } from '../../services/blog.service';

@Component({
  selector: 'app-admin-blog-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
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
})
export class AdminBlogEditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly blog = inject(BlogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly id = signal<string | null>(null);
  readonly isEdit = computed(() => this.id() !== null);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploadingCover = signal(false);
  readonly error = signal<string | null>(null);
  readonly allTags = signal<Tag[]>([]);
  readonly tagToDelete = signal<Tag | null>(null);
  readonly tagToRename = signal<Tag | null>(null);
  readonly deleteTagMessage = computed(() => {
    const t = this.tagToDelete();
    return t
      ? `Supprimer le tag « ${t.name} » ?\n\nIl sera retiré de tous les articles. Cette action est irréversible.`
      : '';
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    slug: [''],
    author: [''],
    excerpt: [''],
    coverImageUrl: [''],
    coverPosition: new FormControl<CoverPosition>('top', { nonNullable: true }),
    content: [''],
    metaTitle: [''],
    metaDescription: [''],
    tags: new FormControl<string[]>([], { nonNullable: true }),
  });

  readonly showPreview = signal(true);

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
      metaTitle: v.metaTitle || null,
      metaDescription: v.metaDescription || null,
      createdAt: date,
      updatedAt: date,
      publishedAt: date,
      tags: (v.tags ?? []).map((name) => ({ id: name, name, slug: name })),
    };
  });

  constructor() {
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
    this.showPreview.update((v) => !v);
  }

  // --- Suppression d'un tag global (modale de confirmation) ---
  onTagRemove(tag: Tag): void {
    this.tagToDelete.set(tag);
  }
  cancelTagDelete(): void {
    this.tagToDelete.set(null);
  }
  confirmTagDelete(): void {
    const tag = this.tagToDelete();
    if (!tag) return;
    this.blog.deleteTag(tag.id).subscribe({
      next: () => {
        this.allTags.update((arr) => arr.filter((t) => t.id !== tag.id));
        const current = this.form.controls.tags.value.filter(
          (n) => n.toLowerCase() !== tag.name.toLowerCase(),
        );
        this.form.controls.tags.setValue(current);
        this.tagToDelete.set(null);
      },
      error: () => {
        this.tagToDelete.set(null);
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
            error: () => this.failSave(),
          });
        } else {
          this.done();
        }
      },
      error: () => this.failSave(),
    });
  }

  cancel(): void {
    void this.router.navigate(['/admin/blog']);
  }

  private done(): void {
    void this.router.navigate(['/admin/blog']);
  }

  private failSave(): void {
    this.saving.set(false);
    this.error.set("Échec de l'enregistrement.");
  }
}
