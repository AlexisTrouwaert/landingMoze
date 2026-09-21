import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { AdminSeries, AdminSeriesArticle } from '../../model/series.model';
import { BlogService } from '../../services/blog.service';

/** Message lisible d'une erreur d'API Nest (`message` peut être une liste de validations). */
function apiMessage(error: unknown, fallback: string): string {
  const message = (error as HttpErrorResponse)?.error?.message as string | string[] | undefined;
  if (Array.isArray(message)) return message.join(' ');
  return message || fallback;
}

/**
 * Gestion des séries du blog : ce qui ne se règle pas depuis un article — l'accroche de la
 * série, le nombre d'épisodes annoncé, son nom — et la vue d'ensemble de leurs épisodes, avec
 * leur état et leur date.
 *
 * On n'y crée pas les épisodes : un article rejoint une série depuis son éditeur. Créer une série
 * ici sert à la préparer (accroche, total) avant d'en écrire le premier épisode.
 */
@Component({
  selector: 'app-admin-blog-series',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ConfirmDialogComponent],
  templateUrl: './admin-blog-series.component.html',
  styleUrl: './admin-blog-series.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBlogSeriesComponent {
  private readonly blog = inject(BlogService);
  private readonly fb = inject(FormBuilder);

  readonly series = signal<AdminSeries[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Série en cours d'enregistrement, pour désactiver son bouton. */
  readonly savingId = signal<string | null>(null);
  /** Accusé bref après un enregistrement. */
  readonly savedId = signal<string | null>(null);
  readonly pendingDelete = signal<AdminSeries | null>(null);
  /** Série dont l'image de tête est en cours d'envoi. */
  readonly uploadingId = signal<string | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
  });

  /** Un formulaire par série, reconstruit à chaque chargement. */
  private readonly forms = new Map<string, ReturnType<AdminBlogSeriesComponent['formFor']>>();

  readonly draftCount = computed(() => this.series().filter((s) => s.status === 'DRAFT').length);

  readonly episodeCount = computed(() =>
    this.series().reduce((sum, s) => sum + s.articles.length, 0),
  );

  readonly deleteMessage = computed(() => {
    const s = this.pendingDelete();
    if (!s) return '';
    const n = s.articles.length;
    return n
      ? `Ses ${n} article${n > 1 ? 's' : ''} resteront en ligne, simplement sortis de la série.\n\nLa page de la série répondra « introuvable ».`
      : 'Elle n’a encore aucun épisode.';
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.blog.adminSeries().subscribe({
      next: (series) => {
        this.forms.clear();
        for (const s of series) this.forms.set(s.id, this.formFor(s));
        this.series.set(series);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Le chargement des séries a échoué.');
        this.loading.set(false);
      },
    });
  }

  private formFor(s: AdminSeries) {
    return this.fb.group({
      title: this.fb.nonNullable.control(s.title, [Validators.required, Validators.maxLength(120)]),
      pitch: this.fb.nonNullable.control(s.pitch, [Validators.maxLength(240)]),
      coverImageUrl: this.fb.control<string | null>(s.coverImageUrl),
      imageIdea: this.fb.nonNullable.control(s.imageIdea, [Validators.maxLength(1000)]),
      plannedCount: this.fb.control<number | null>(s.plannedCount, [Validators.min(1), Validators.max(99)]),
    });
  }

  form(s: AdminSeries) {
    return this.forms.get(s.id)!;
  }

  create(): void {
    if (this.createForm.invalid) return;
    this.error.set(null);
    this.blog.createSeries({ title: this.createForm.getRawValue().title.trim() }).subscribe({
      next: () => {
        this.createForm.reset();
        this.load();
      },
      error: (e) => this.error.set(apiMessage(e, 'La création de la série a échoué.')),
    });
  }

  save(s: AdminSeries): void {
    const form = this.form(s);
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const v = form.getRawValue();
    this.savingId.set(s.id);
    this.error.set(null);
    this.blog
      .updateSeries(s.id, {
        title: v.title.trim(),
        pitch: v.pitch.trim(),
        // Chaîne vide plutôt que `null` : c'est ainsi que le serveur retire l'image.
        coverImageUrl: v.coverImageUrl ?? '',
        imageIdea: v.imageIdea.trim(),
        plannedCount: v.plannedCount || null,
      })
      .subscribe({
        next: (updated) => {
          this.savingId.set(null);
          this.series.update((all) => all.map((x) => (x.id === updated.id ? updated : x)));
          this.forms.set(updated.id, this.formFor(updated));
          this.savedId.set(updated.id);
          setTimeout(() => this.savedId.update((id) => (id === updated.id ? null : id)), 2000);
        },
        error: (e) => {
          this.savingId.set(null);
          this.error.set(apiMessage(e, 'L’enregistrement de la série a échoué.'));
        },
      });
  }

  confirmDelete(): void {
    const s = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!s) return;
    this.blog.deleteSeries(s.id).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(apiMessage(e, 'La suppression de la série a échoué.')),
    });
  }

  /**
   * L'image de tête, envoyée puis posée dans le formulaire.
   *
   * Elle n'est pas enregistrée tout de suite : le bouton « Enregistrer » reste le seul geste
   * qui écrit, et l'image se retire encore d'un clic tant qu'il n'a pas été pressé.
   */
  onImage(s: AdminSeries, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadingId.set(s.id);
    this.error.set(null);
    this.blog.upload(file).subscribe({
      next: ({ url }) => {
        this.uploadingId.set(null);
        const control = this.form(s).controls.coverImageUrl;
        control.setValue(url);
        control.markAsDirty();
      },
      error: (e) => {
        this.uploadingId.set(null);
        this.error.set(apiMessage(e, "L'envoi de l'image a échoué."));
      },
    });
  }

  /**
   * Valide un brouillon de série : il apparaît sur le blog dès son premier épisode paru.
   *
   * Seulement sur une série **enregistrée** avec son image : valider ce qui n'est encore que
   * dans le formulaire publierait autre chose que ce qu'on a sous les yeux.
   */
  valider(s: AdminSeries): void {
    if (s.status !== 'DRAFT' || !s.coverImageUrl || this.form(s).dirty) return;
    this.savingId.set(s.id);
    this.error.set(null);
    this.blog.publishSeries(s.id).subscribe({
      next: (maj) => {
        this.savingId.set(null);
        this.series.update((all) => all.map((x) => (x.id === maj.id ? maj : x)));
        this.forms.set(maj.id, this.formFor(maj));
      },
      error: (e) => {
        this.savingId.set(null);
        this.error.set(apiMessage(e, 'La validation de la série a échoué.'));
      },
    });
  }

  /** Retire l'image de tête. Comme l'ajout, effectif à l'enregistrement. */
  retirerImage(s: AdminSeries): void {
    const control = this.form(s).controls.coverImageUrl;
    control.setValue(null);
    control.markAsDirty();
  }

  /** La série a au moins un épisode paru : sa page publique répond. */
  isOnline(s: AdminSeries): boolean {
    const now = Date.now();
    return s.articles.some(
      (a) => a.status === 'PUBLISHED' && !!a.publishedAt && new Date(a.publishedAt).getTime() <= now,
    );
  }

  statusLabel(a: AdminSeriesArticle): string {
    if (a.status === 'DRAFT') return 'Brouillon';
    if (a.status === 'ARCHIVED') return 'Archivé';
    if (a.publishedAt && new Date(a.publishedAt).getTime() > Date.now()) return 'Programmé';
    return 'Publié';
  }

  statusClass(a: AdminSeriesArticle): string {
    const label = this.statusLabel(a);
    return label === 'Publié' ? 'badge--published' : label === 'Archivé' ? 'badge--archived' : '';
  }
}
