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
import { ArticleCardComponent } from '../../components/article-card/article-card.component';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { ArticleListItem, Tag } from '../../model/article.model';
import { BlogService } from '../../services/blog.service';

@Component({
    selector: 'app-blog-list',
    imports: [RouterLink, ReactiveFormsModule, FloatingDockComponent, ArticleCardComponent],
    templateUrl: './blog-list.component.html',
    styleUrl: './blog-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlogListComponent {
  private readonly blog = inject(BlogService);
  private readonly router = inject(Router);

  readonly items = signal<ArticleListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly search = signal('');
  readonly searchValue = signal('');
  readonly availableTags = signal<Tag[]>([]);
  readonly selectedTags = signal<string[]>([]);
  readonly showAllTags = signal(false);

  readonly canLoadMore = computed(() => this.items().length < this.total());

  /** Nombre de tags "populaires" affichés avant le bouton "+ N autres". */
  private readonly topTagsCount = 8;

  /** Tags affichés : les N plus populaires, ou tous si l'utilisateur a déplié. */
  readonly visibleTags = computed(() =>
    this.showAllTags()
      ? this.availableTags()
      : this.availableTags().slice(0, this.topTagsCount),
  );

  /** Nombre de tags masqués derrière le bouton "+ N autres". */
  readonly hiddenTagsCount = computed(() =>
    Math.max(0, this.availableTags().length - this.topTagsCount),
  );

  /**
   * Tags sélectionnés (objets), toujours visibles dans la barre "Sélection".
   * Résolus depuis un cache pour rester affichés même si la recherche courante
   * a retiré ce tag de la liste des facettes.
   */
  readonly selectedTagObjects = computed(() =>
    this.selectedTags()
      .map((slug) => this.tagCache.get(slug))
      .filter((t): t is Tag => t != null),
  );

  readonly searchControl = new FormControl('', { nonNullable: true });

  private page = 0;
  private readonly size = 9;

  /** Cache slug → Tag pour résoudre les tags sélectionnés hors facettes courantes. */
  private readonly tagCache = new Map<string, Tag>();

  constructor() {
    this.loadTags();
    // Valeur live (affichage du bouton ✕).
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((term) => this.searchValue.set(term));
    // Recherche débounce : résultats + facettes de tags adaptés à la recherche.
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        const s = term.trim();
        this.search.set(s);
        this.loadTags(s || undefined);
        this.resetAndLoad();
      });
    this.loadMore();
  }

  /** (Re)charge les tags du filtre, adaptés à la recherche courante (facettes). */
  private loadTags(search?: string): void {
    this.blog.publicTags(search).subscribe((tags) => {
      for (const t of tags) this.tagCache.set(t.slug, t);
      this.availableTags.set(tags);
      this.showAllTags.set(false);
    });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  toggleTag(slug: string): void {
    this.selectedTags.update((arr) =>
      arr.includes(slug) ? arr.filter((s) => s !== slug) : [...arr, slug],
    );
    this.resetAndLoad();
  }

  isTagSelected(slug: string): boolean {
    return this.selectedTags().includes(slug);
  }

  toggleAllTags(): void {
    this.showAllTags.update((v) => !v);
  }

  clearTags(): void {
    if (!this.selectedTags().length) return;
    this.selectedTags.set([]);
    this.resetAndLoad();
  }

  loadMore(): void {
    this.loading.set(true);
    this.error.set(false);
    this.blog
      .list(
        this.page + 1,
        this.size,
        this.search() || undefined,
        this.selectedTags(),
      )
      .subscribe({
        next: (res) => {
          this.page = res.page;
          this.total.set(res.total);
          this.items.update((cur) => [...cur, ...res.items]);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  private resetAndLoad(): void {
    this.page = 0;
    this.items.set([]);
    this.total.set(0);
    this.loadMore();
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
