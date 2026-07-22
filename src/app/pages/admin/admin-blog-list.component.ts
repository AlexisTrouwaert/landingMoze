import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { Article, MAX_FEATURED } from '../../model/article.model';
import { AuthService } from '../../services/auth.service';
import { BlogService } from '../../services/blog.service';

type StatusFilter = 'active' | 'all' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

@Component({
    selector: 'app-admin-blog-list',
    imports: [DatePipe, RouterLink, ReactiveFormsModule, ConfirmDialogComponent],
    templateUrl: './admin-blog-list.component.html',
    styleUrl: './admin-blog-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminBlogListComponent {
  private readonly blog = inject(BlogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly items = signal<Article[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly statusFilter = signal<StatusFilter>('active');

  readonly filterMenuOpen = signal(false);
  readonly archiveTarget = signal<Article | null>(null);
  readonly deleteTarget = signal<Article | null>(null);

  /**
   * Nombre d'articles à la une. Compté globalement via l'endpoint des épinglés
   * (et non depuis `items()`, qui est filtré par la recherche et le statut).
   */
  readonly featuredCount = signal(0);
  readonly maxFeatured = MAX_FEATURED;

  /** Message renvoyé par l'API si l'épinglage est refusé (limite atteinte…). */
  readonly featureError = signal<string | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchValue = signal('');
  private search = '';

  /** Chips de filtre. « Actifs » (défaut) masque les archivés. */
  readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Actifs' },
    { value: 'DRAFT', label: 'Brouillons' },
    { value: 'PUBLISHED', label: 'Publiés' },
    { value: 'ARCHIVED', label: 'Archivés' },
    { value: 'all', label: 'Tous' },
  ];

  readonly currentFilterLabel = computed(
    () =>
      this.filters.find((f) => f.value === this.statusFilter())?.label ??
      'Filtrer',
  );

  readonly archiveMessage = computed(() => {
    const a = this.archiveTarget();
    return a
      ? `Archiver « ${a.title} » ?\n\nIl n'apparaîtra plus dans la liste par défaut, mais restera accessible via le filtre « Archivés ».`
      : '';
  });

  readonly deleteMessage = computed(() => {
    const a = this.deleteTarget();
    return a
      ? `Supprimer définitivement « ${a.title} » ?\n\nCette action est irréversible.`
      : '';
  });

  constructor() {
    // Mise à jour immédiate (pour l'affichage du bouton ✕).
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((term) => this.searchValue.set(term));
    // Rechargement débounce (pour limiter les appels API).
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.search = term.trim();
        this.reload();
      });
    this.reload();
    this.loadFeaturedCount();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  toggleFilterMenu(): void {
    this.filterMenuOpen.update((v) => !v);
  }

  closeFilterMenu(): void {
    this.filterMenuOpen.set(false);
  }

  selectStatus(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.closeFilterMenu();
    this.reload();
  }

  /** Réinitialise le filtre de statut à « Actifs » (défaut). */
  resetFilter(): void {
    this.selectStatus('active');
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(false);
    this.blog
      .adminList({ search: this.search || undefined, status: this.statusFilter() })
      .subscribe({
        next: (articles) => {
          this.items.set(articles);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  /**
   * Recharge le nombre d'épinglés. L'endpoint public des « à la une » renvoie
   * exactement l'ensemble épinglé (seuls des articles publiés sont épinglables).
   */
  private loadFeaturedCount(): void {
    this.blog.featured().subscribe({
      next: (list) => this.featuredCount.set(list.length),
      error: () => this.featuredCount.set(0),
    });
  }

  /** Épingle / retire de la une, en remontant le message du back si refus. */
  toggleFeature(a: Article): void {
    this.featureError.set(null);
    const op = a.featuredAt
      ? this.blog.unfeature(a.id)
      : this.blog.feature(a.id);
    op.subscribe({
      next: () => {
        this.reload();
        this.loadFeaturedCount();
      },
      error: (err) => this.featureError.set(this.extractError(err)),
    });
  }

  /** Message lisible renvoyé par l'API (sinon repli générique). */
  private extractError(err: unknown): string {
    const msg = (err as { error?: { message?: string | string[] } })?.error
      ?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    return msg || "L'opération a échoué.";
  }

  togglePublish(a: Article): void {
    const op =
      a.status === 'PUBLISHED' ? this.blog.unpublish(a.id) : this.blog.publish(a.id);
    op.subscribe({ next: () => this.reload(), error: () => this.error.set(true) });
  }

  // --- Archivage (modale dédiée) ---
  archive(a: Article): void {
    this.archiveTarget.set(a);
  }
  confirmArchive(): void {
    const a = this.archiveTarget();
    if (!a) return;
    this.blog.archive(a.id).subscribe({
      next: () => {
        this.archiveTarget.set(null);
        this.reload();
      },
      error: () => {
        this.archiveTarget.set(null);
        this.error.set(true);
      },
    });
  }
  cancelArchive(): void {
    this.archiveTarget.set(null);
  }

  unarchive(a: Article): void {
    this.blog.unarchive(a.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set(true),
    });
  }

  // --- Suppression définitive (modale dédiée) ---
  remove(a: Article): void {
    this.deleteTarget.set(a);
  }
  confirmDelete(): void {
    const a = this.deleteTarget();
    if (!a) return;
    this.blog.remove(a.id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.reload();
      },
      error: () => {
        this.deleteTarget.set(null);
        this.error.set(true);
      },
    });
  }
  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/admin/login']);
  }
}
