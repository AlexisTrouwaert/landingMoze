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
import {
  AdminStats,
  Article,
  BulkAction,
  MAX_FEATURED,
} from '../../model/article.model';
import { AuthService } from '../../services/auth.service';
import { BlogService } from '../../services/blog.service';

type StatusFilter = 'active' | 'all' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** Action destructrice en attente de confirmation. */
interface PendingAction {
  action: BulkAction;
  ids: string[];
  title: string;
  message: string;
  confirmLabel: string;
}

@Component({
  selector: 'app-admin-blog-list',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './admin-blog-list.component.html',
  styleUrl: './admin-blog-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeMenus()' },
})
export class AdminBlogListComponent {
  private readonly blog = inject(BlogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly items = signal<Article[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly statusFilter = signal<StatusFilter>('active');

  /** Compteurs globaux : indépendants de la recherche et du filtre courant. */
  readonly stats = signal<AdminStats | null>(null);
  readonly maxFeatured = MAX_FEATURED;
  readonly featuredCount = computed(() => this.stats()?.featured ?? 0);
  readonly featuredFull = computed(() => this.featuredCount() >= this.maxFeatured);

  /** Message renvoyé par l'API quand une action est refusée. */
  readonly actionError = signal<string | null>(null);

  /** Une action est en cours : on gèle les boutons pour éviter le double-clic. */
  readonly busy = signal(false);

  /** Identifiant de la ligne dont le menu « ⋯ » est ouvert (une seule à la fois). */
  readonly openMenu = signal<string | null>(null);

  readonly pending = signal<PendingAction | null>(null);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchValue = signal('');
  private search = '';

  /** Lignes fantômes pendant le chargement (le gabarit ne bouge pas). */
  readonly skeletons = [0, 1, 2, 3, 4];

  readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Actifs' },
    { value: 'DRAFT', label: 'Brouillons' },
    { value: 'PUBLISHED', label: 'Publiés' },
    { value: 'ARCHIVED', label: 'Archivés' },
    { value: 'all', label: 'Tous' },
  ];

  // --- Sélection multiple -------------------------------------------------

  private readonly selection = signal<ReadonlySet<string>>(new Set());

  readonly selectedCount = computed(() => this.selection().size);

  /** Articles sélectionnés encore présents dans la liste affichée. */
  private readonly selectedItems = computed(() => {
    const picked = this.selection();
    return this.items().filter((a) => picked.has(a.id));
  });

  readonly allSelected = computed(() => {
    const list = this.items();
    return list.length > 0 && list.every((a) => this.selection().has(a.id));
  });

  readonly someSelected = computed(
    () => this.selectedCount() > 0 && !this.allSelected(),
  );

  /**
   * Sélection entièrement archivée → on propose « restaurer / supprimer »
   * plutôt que « publier / archiver », qui n'auraient pas de sens.
   */
  readonly selectionArchived = computed(() => {
    const picked = this.selectedItems();
    return picked.length > 0 && picked.every((a) => a.status === 'ARCHIVED');
  });

  constructor() {
    // Immédiat : pilote l'affichage du bouton d'effacement.
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((term) => this.searchValue.set(term));
    // Débounce : limite les appels API.
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.search = term.trim();
        // Sans ça, un lot pourrait porter sur des lignes sorties de l'écran :
        // la sélection reste toujours un sous-ensemble de ce qui est affiché.
        this.clearSelection();
        this.reload();
      });
    this.reload();
    this.loadStats();
  }

  isSelected(id: string): boolean {
    return this.selection().has(id);
  }

  toggleOne(id: string): void {
    const next = new Set(this.selection());
    if (!next.delete(id)) next.add(id);
    this.selection.set(next);
  }

  /** Coche / décoche tout ce qui est actuellement affiché. */
  toggleAll(): void {
    this.selection.set(
      this.allSelected() ? new Set() : new Set(this.items().map((a) => a.id)),
    );
  }

  clearSelection(): void {
    this.selection.set(new Set());
  }

  // --- Filtres et recherche -----------------------------------------------

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  selectStatus(value: StatusFilter): void {
    if (this.statusFilter() === value) return;
    this.statusFilter.set(value);
    // La sélection porte sur des lignes qui vont disparaître de l'écran.
    this.clearSelection();
    this.reload();
  }

  /** Les tuiles de compteurs servent aussi de filtres rapides. */
  focusStatus(value: StatusFilter): void {
    this.selectStatus(this.statusFilter() === value ? 'active' : value);
  }

  toggleMenu(id: string): void {
    this.openMenu.update((current) => (current === id ? null : id));
  }

  closeMenus(): void {
    this.openMenu.set(null);
  }

  // --- Chargement ---------------------------------------------------------

  reload(): void {
    this.loading.set(true);
    this.error.set(false);
    this.blog
      .adminList({
        search: this.search || undefined,
        status: this.statusFilter(),
      })
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

  private loadStats(): void {
    this.blog.adminStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.stats.set(null),
    });
  }

  // --- Actions ------------------------------------------------------------

  /**
   * Point d'entrée unique des actions de statut : une ligne ou une sélection
   * passent par le même appel groupé, donc par le même comportement.
   */
  private run(action: BulkAction, ids: string[]): void {
    if (!ids.length || this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.closeMenus();
    this.blog.bulk(action, ids).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.clearSelection();
        this.reload();
        this.loadStats();
        if (res.missing > 0) {
          this.actionError.set(
            res.missing === 1
              ? "1 article n'existait plus et a été ignoré."
              : `${res.missing} articles n'existaient plus et ont été ignorés.`,
          );
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.actionError.set(this.extractError(err));
      },
    });
  }

  publish(a: Article): void {
    this.run('publish', [a.id]);
  }

  unpublish(a: Article): void {
    this.run('unpublish', [a.id]);
  }

  unarchive(a: Article): void {
    this.run('unarchive', [a.id]);
  }

  /** Épinglage : action unitaire (limite de 5, et `featuredAt` porte l'ordre). */
  toggleFeature(a: Article): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.closeMenus();
    const op = a.featuredAt
      ? this.blog.unfeature(a.id)
      : this.blog.feature(a.id);
    op.subscribe({
      next: (updated) => {
        this.busy.set(false);
        // Mise à jour en place de la seule ligne concernée, sans `reload()` :
        // l'épinglage modifie `updatedAt` (clé de tri), un rechargement ferait
        // remonter l'article en tête. Ici il garde sa position dans la liste.
        this.items.update((list) =>
          list.map((it) => (it.id === updated.id ? updated : it)),
        );
        this.loadStats();
      },
      error: (err) => {
        this.busy.set(false);
        this.actionError.set(this.extractError(err));
      },
    });
  }

  // --- Actions destructrices (confirmation) --------------------------------

  askArchive(a: Article): void {
    this.closeMenus();
    this.pending.set({
      action: 'archive',
      ids: [a.id],
      title: "Archiver l'article",
      message: `Archiver « ${a.title} » ?\n\nIl n'apparaîtra plus dans la liste par défaut, mais restera accessible via le filtre « Archivés ».`,
      confirmLabel: 'Archiver',
    });
  }

  askDelete(a: Article): void {
    this.closeMenus();
    this.pending.set({
      action: 'delete',
      ids: [a.id],
      title: 'Supprimer définitivement',
      message: `Supprimer définitivement « ${a.title} » ?\n\nCette action est irréversible.`,
      confirmLabel: 'Supprimer',
    });
  }

  askBulkArchive(): void {
    const ids = [...this.selection()];
    const n = ids.length;
    this.pending.set({
      action: 'archive',
      ids,
      title: 'Archiver la sélection',
      message: `Archiver ${n} article${n > 1 ? 's' : ''} ?\n\nIls n'apparaîtront plus dans la liste par défaut, mais resteront accessibles via le filtre « Archivés ».`,
      confirmLabel: `Archiver (${n})`,
    });
  }

  askBulkDelete(): void {
    const ids = [...this.selection()];
    const n = ids.length;
    this.pending.set({
      action: 'delete',
      ids,
      title: 'Supprimer définitivement',
      message: `Supprimer définitivement ${n} article${n > 1 ? 's' : ''} ?\n\nCette action est irréversible.`,
      confirmLabel: `Supprimer (${n})`,
    });
  }

  confirmPending(): void {
    const p = this.pending();
    this.pending.set(null);
    if (p) this.run(p.action, p.ids);
  }

  cancelPending(): void {
    this.pending.set(null);
  }

  // --- Actions groupées non destructrices ----------------------------------

  bulkPublish(): void {
    this.run('publish', [...this.selection()]);
  }

  bulkUnpublish(): void {
    this.run('unpublish', [...this.selection()]);
  }

  bulkUnarchive(): void {
    this.run('unarchive', [...this.selection()]);
  }

  /** Message lisible renvoyé par l'API (sinon repli générique). */
  private extractError(err: unknown): string {
    const msg = (err as { error?: { message?: string | string[] } })?.error
      ?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    return msg || "L'opération a échoué.";
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/admin/login']);
  }
}
