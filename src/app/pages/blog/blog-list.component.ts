import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ArticleCardComponent } from '../../components/article-card/article-card.component';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';
import { NewsletterFormComponent } from '../../components/newsletter-form/newsletter-form.component';
import { FooterComponent } from '../home/footer/footer.component';
import { ArticleListItem, Tag } from '../../model/article.model';
import { BlogService } from '../../services/blog.service';
import { NAV_GROUPS } from '../../config/nav-groups';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { ContactPanelService } from '../../services/contact-panel.service';
import { SeoService, SOCIAL_IMAGE_ALT } from '../../services/seo.service';

@Component({
    selector: 'app-blog-list',
    imports: [
      RouterLink,
      ReactiveFormsModule,
      DatePipe,
      FloatingDockComponent,
      ArticleCardComponent,
      NewsletterFormComponent,
      FooterComponent,
    ],
    templateUrl: './blog-list.component.html',
    styleUrl: './blog-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlogListComponent {
  private readonly blog = inject(BlogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly contactPanel = inject(ContactPanelService);
  private readonly seo = inject(SeoService);
  private readonly meta = inject(Meta);

  /** Navigation du dock (source partagée). Le lien « Blog » est masqué ici. */
  readonly navGroups = NAV_GROUPS;

  readonly items = signal<ArticleListItem[]>([]);
  readonly total = signal(0);
  // Démarre en chargement : le premier fetch part dès le constructeur. Ainsi une
  // arrivée sur /blog par navigation interne affiche le squelette d'emblée, sans
  // frame d'état vide. (Au rendu serveur, le fetch est attendu avant sérialisation
  // → le HTML contient les cartes, pas le squelette.)
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly search = signal('');
  readonly searchValue = signal('');
  readonly availableTags = signal<Tag[]>([]);
  readonly selectedTags = signal<string[]>([]);
  readonly showAllTags = signal(false);

  readonly canLoadMore = computed(() => this.items().length < this.total());

  /** Cartes fantômes du premier chargement (2 rangées sur grand écran). */
  readonly skeletons = [0, 1, 2, 3, 4, 5];

  /**
   * Tout premier chargement de la grille : ni articles, ni erreur, ni résultat
   * vide — seulement des squelettes. Ce qui vient après la grille reste masqué
   * tant que c'est vrai, sinon le footer se retrouve haut dans la page puis se
   * fait repousser à l'arrivée des cartes.
   *
   * Faux dès qu'il y a des articles à l'écran : un « Charger plus » ne fait donc
   * pas disparaître le bas de page.
   */
  readonly firstLoad = computed(
    () => this.loading() && this.items().length === 0,
  );

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

  // ---- « À la une » (carrousel rotatif) ----

  /** Vrai tant qu'aucun filtre n'est actif : l'à la une n'a de sens qu'en navigation libre. */
  readonly showFeatured = computed(
    () => !this.search() && this.selectedTags().length === 0,
  );

  /** Articles épinglés « à la une » par l'admin (max 5). */
  private readonly pinned = signal<ArticleListItem[]>([]);

  /**
   * Articles mis en avant : ceux épinglés par l'admin. Si rien n'est épinglé,
   * repli sur les 3 plus récents pour ne pas laisser le bandeau vide.
   */
  readonly featuredList = computed<ArticleListItem[]>(() => {
    if (!this.showFeatured()) return [];
    const pinned = this.pinned();
    return pinned.length ? pinned : this.items().slice(0, 3);
  });

  /** Index de l'article à la une affiché (0..N-1). */
  readonly featuredIndex = signal(0);

  /** Pause la rotation au survol. */
  readonly paused = signal(false);

  /** Scène du carrousel : cible des gestes de swipe (mobile). */
  private readonly featStage =
    viewChild<ElementRef<HTMLElement>>('featStage');

  /** Article à la une actuellement affiché (null si aucun). */
  readonly currentFeatured = computed<ArticleListItem | null>(() => {
    const list = this.featuredList();
    if (!list.length) return null;
    return list[this.featuredIndex() % list.length] ?? null;
  });

  /**
   * Cartes de la grille : **toute** la liste, y compris les articles à la une.
   * Les extraire donnait l'impression qu'ils ne faisaient pas partie du blog ;
   * le bandeau met en avant, il ne retire pas de la liste.
   */
  readonly gridItems = computed<ArticleListItem[]>(() => this.items());

  readonly searchControl = new FormControl('', { nonNullable: true });

  private page = 0;
  private readonly size = 9;

  /** Cache slug → Tag pour résoudre les tags sélectionnés hors facettes courantes. */
  private readonly tagCache = new Map<string, Tag>();

  /** Minuteur de rotation (navigateur uniquement). */
  private rotateId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Description propre à la page : sans elle, `/blog` reprenait celle de l'accueil figée dans
    // `index.html` — deux URL référencées sous la même description, que Google lit comme un
    // doublon. Posée ici, donc présente dans le HTML rendu côté serveur.
    const description =
      'Conseils, guides et actualités pour les indépendants : facturation, ' +
      "gestion d'activité et mise en réseau. Le blog de Moze.";

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: 'Blog – Moze' });
    this.meta.updateTag({ property: 'og:description', content: description });

    // Vignette de partage : sans elle, un lien vers le blog posté sur LinkedIn n'affichait
    // aucune image. Les crawlers sociaux n'exécutent pas de JavaScript, d'où le constructeur.
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    this.loadTags();
    this.loadFeatured();
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

    // Rotation de l'à la une + gestes de swipe : navigateur uniquement (SSR-safe).
    afterNextRender(() => {
      this.startRotate();
      this.destroyRef.onDestroy(() => this.stopRotate());
      this.bindSwipe();
    });
  }

  // ---- Swipe du carrousel (mobile) ----

  /**
   * Fait glisser l'à la une au doigt. Le geste doit être distingué d'un tap :
   * la carte est un lien vers l'article, un simple appui doit continuer d'ouvrir
   * l'article. On mesure le déplacement au `pointerup` ; au-delà du seuil et
   * si le geste est franchement horizontal, on change de slide et on neutralise
   * le clic fantôme qui suit (capture) pour ne pas naviguer en même temps.
   */
  private bindSwipe(): void {
    const el = this.featStage()?.nativeElement;
    if (!el) return;

    const THRESHOLD = 45; // px : en-deçà, c'est un tap, pas un swipe
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let swiped = false;

    const onDown = (e: PointerEvent) => {
      tracking = true;
      swiped = false;
      startX = e.clientX;
      startY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // Franchement horizontal : évite de capturer un scroll vertical.
      if (Math.abs(dx) >= THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.4) {
        swiped = true;
        if (dx < 0) this.nextFeatured();
        else this.prevFeatured();
      }
    };

    // Capture : intercepte le clic fantôme post-swipe avant qu'il n'atteigne le
    // lien de la carte. Un tap classique laisse `swiped` à false → clic normal.
    const onClick = (e: MouseEvent) => {
      if (swiped) {
        e.preventDefault();
        e.stopPropagation();
        swiped = false;
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', () => (tracking = false));
    el.addEventListener('click', onClick, true);

    this.destroyRef.onDestroy(() => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
    });
  }

  /** Slide suivant, avec rebouclage, et relance du minuteur. */
  nextFeatured(): void {
    const n = this.featuredList().length;
    if (n > 1) {
      this.featuredIndex.update((i) => (i + 1) % n);
      this.startRotate();
    }
  }

  /** Slide précédent, avec rebouclage, et relance du minuteur. */
  prevFeatured(): void {
    const n = this.featuredList().length;
    if (n > 1) {
      this.featuredIndex.update((i) => (i - 1 + n) % n);
      this.startRotate();
    }
  }

  private startRotate(): void {
    this.stopRotate();
    this.rotateId = setInterval(() => {
      if (this.paused()) return;
      const n = this.featuredList().length;
      if (n > 1) this.featuredIndex.update((i) => (i + 1) % n);
    }, 6000);
  }

  private stopRotate(): void {
    if (this.rotateId != null) {
      clearInterval(this.rotateId);
      this.rotateId = null;
    }
  }

  /** Sélection manuelle d'un article à la une (via les points). */
  selectFeatured(i: number): void {
    this.featuredIndex.set(i);
    this.startRotate(); // relance le minuteur après action manuelle
  }

  /**
   * Charge les articles épinglés. En cas d'échec on laisse la liste vide :
   * `featuredList` bascule alors sur les 3 plus récents (dégradation douce).
   */
  private loadFeatured(): void {
    this.blog.featured().subscribe({
      next: (list) => this.pinned.set(list),
      error: () => this.pinned.set([]),
    });
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
    this.featuredIndex.set(0);
    this.loadMore();
  }

  /** CTA du dock → tunnel d'inscription. */
  goToFunnel(): void {
    this.metaPixel.trackLeadCTA('inscription_generic');
    this.router.navigate(['/commencer']);
  }

  /** Action d'un lien du dock (ex. « Support » → panneau de contact). */
  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }
}
