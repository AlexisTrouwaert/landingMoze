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
import { FeaturedSlotsComponent } from '../../components/featured-slots/featured-slots.component';
import { POST_SLOTS } from '../../common/social-networks';
import {
  AdminFeaturedItem,
  AdminStats,
  Article,
  ArticleListItem,
  BulkAction,
  MAX_FEATURED,
} from '../../model/article.model';
import {
  projectFeatured,
  projectionAhead,
  projectionPending,
  projectionTarget,
} from '../../common/featured-projection';
import { AuthService } from '../../services/auth.service';
import { BlogService } from '../../services/blog.service';
import { ReviewNotifierService } from '../../services/review-notifier.service';

type StatusFilter = 'active' | 'all' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** Ordre d'affichage : celui de l'API (récents), ou par compteur de vues. */
type SortMode = 'recent' | 'views-desc' | 'views-asc';

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
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    ConfirmDialogComponent,
    FeaturedSlotsComponent,
  ],
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

  /** Tri d'affichage. Local à l'écran : l'API renvoie toujours la liste par date. */
  readonly sortMode = signal<SortMode>('recent');

  /**
   * Liste affichée : celle de l'API, retriée par vues à la demande.
   * Copie triée (`[...]`) — `items` reste l'ordre de référence de l'API.
   */
  readonly displayedItems = computed(() => {
    const list = this.items();
    const mode = this.sortMode();
    if (mode === 'recent') return list;

    const sign = mode === 'views-desc' ? -1 : 1;
    return [...list].sort((a, b) => sign * ((a.views ?? 0) - (b.views ?? 0)));
  });

  onSortChange(event: Event): void {
    this.sortMode.set((event.target as HTMLSelectElement).value as SortMode);
  }

  /** Compteurs globaux : indépendants de la recherche et du filtre courant. */
  readonly stats = signal<AdminStats | null>(null);

  /**
   * Les articles « à la une », dans leur ordre d'affichage public. Section à part au-dessus de la
   * liste : indépendante du filtre et de la recherche, c'est la vitrine — elle doit se lire d'un
   * coup d'œil sans aller chercher les étoiles ligne à ligne.
   */
  readonly featured = signal<AdminFeaturedItem[]>([]);

  /**
   * Brouillons de l'assistant en attente de relecture.
   *
   * Lu sur le service plutôt que rechargé ici : c'est lui qui interroge en boucle, le badge
   * se met donc à jour tout seul sans qu'on duplique la requête à chaque montage.
   */
  readonly pendingReview = inject(ReviewNotifierService).count;
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
    this.loadFeatured();
  }

  /**
   * Publié avec une date encore à venir : programmé, donc masqué du public jusqu'à l'échéance.
   * Évalué au rendu — le badge ne bascule pas tout seul à l'heure dite, un rechargement suffit.
   */
  isScheduled(a: Article): boolean {
    return (
      a.status === 'PUBLISHED' &&
      !!a.publishedAt &&
      new Date(a.publishedAt).getTime() > Date.now()
    );
  }

  /**
   * Échange « à la une » en attente : l'article est programmé et prendra la place d'un autre
   * à sa parution. Il n'est pas encore épinglé — mais l'étoile doit déjà le dire, sinon
   * l'auteur croit son clic perdu et recommence.
   */
  isFeaturePending(a: Article): boolean {
    return !a.featuredAt && !!a.featureReplacesId;
  }

  /** Étoile « active » : déjà épinglé, ou épinglage décidé pour la parution. */
  isStarOn(a: Article): boolean {
    return !!a.featuredAt || !!a.featureReplacesId;
  }

  // --- Diffusion ------------------------------------------------------------

  /**
   * Les posts de cet article, et combien sont traités.
   *
   * « Traité » = diffusé **ou écarté** : un réseau qu'on a choisi de ne pas utiliser n'est plus
   * du travail en attente, et le compteur doit pouvoir tomber à zéro.
   *
   * La liste ne transporte que `slot` et les deux dates (cf. `LIST_INCLUDE` côté back) : de quoi
   * compter, pas de quoi lire. Le tri entre « post » et « note de rédaction » se fait ici,
   * parce que c'est le front qui sait quels réseaux existent.
   */
  diffusion(a: Article): { total: number; faits: number } | null {
    const posts = (a.annexes ?? []).filter((x) => POST_SLOTS.includes(x.slot));
    if (!posts.length) return null;
    return {
      total: posts.length,
      faits: posts.filter((x) => x.diffusedAt || x.skippedAt).length,
    };
  }

  /**
   * Reste-t-il des posts à envoyer ?
   *
   * Seulement sur un article **publié** : proposer de diffuser un brouillon inviterait à
   * partager un lien qui renvoie sur une page absente.
   */
  aDiffuser(a: Article): boolean {
    if (a.status !== 'PUBLISHED') return false;
    const d = this.diffusion(a);
    return !!d && d.faits < d.total;
  }

  /** Combien d'articles publiés attendent encore d'être diffusés. */
  readonly aDiffuserCount = computed(
    () => this.items().filter((a) => this.aDiffuser(a)).length,
  );

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

  /**
   * Rafraîchit la section « À la une ». L'endpoint admin et non le public : lui seul dit
   * quels articles sont sur le départ, c'est-à-dire remplacés par un article programmé le
   * jour de sa parution. La section les grise au lieu de les faire disparaître d'un coup.
   */
  private loadFeatured(): void {
    this.blog.adminFeatured().subscribe({
      next: (list) => this.featured.set(list),
      error: () => this.featured.set([]),
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
        // Dépublier ou archiver un article épinglé le retire de la une : la section suit.
        this.loadFeatured();
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

  /**
   * Retrait direct depuis la section « À la une ». Même mécanique que `toggleFeature`, mais la
   * section ne transporte que des items de liste publique — l'id suffit au back.
   */
  unfeatureFromBanner(item: ArticleListItem): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.blog.unfeature(item.id).subscribe({
      next: (updated) => {
        this.busy.set(false);
        // La ligne correspondante de la liste (si affichée) perd son étoile, en place.
        this.items.update((list) =>
          list.map((it) => (it.id === updated.id ? updated : it)),
        );
        this.loadStats();
        this.loadFeatured();
      },
      error: (err) => {
        this.busy.set(false);
        this.actionError.set(this.extractError(err));
      },
    });
  }

  /**
   * L'article qu'on cherche à épingler alors que la une est pleine : la popup d'échange est
   * ouverte, en attente du choix de celui qui cède sa place. `null` = fermée.
   */
  readonly featureSwapFor = signal<Article | null>(null);

  /**
   * La une **telle qu'elle sera** quand l'article visé prendra sa place.
   *
   * Un article programmé n'entre à la une qu'à sa parution : d'ici là, les échanges déjà
   * décidés auront joué. Proposer de remplacer un occupant qui sera parti d'ici là ferait
   * choisir sur un état périmé — et l'échange, différé côté back, viserait un article qui
   * n'occupe plus rien.
   */
  readonly swapSlots = computed(() =>
    projectFeatured(
      this.featured(),
      projectionTarget(this.featureSwapFor()?.publishedAt),
    ),
  );

  /** Vrai si cette projection diffère de la une d'aujourd'hui — donc s'il y a lieu de le dire. */
  readonly swapAhead = computed(() => projectionAhead(this.swapSlots()));

  /**
   * Vrai si des échanges sont déjà décidés sur la une, quelle que soit la date visée.
   *
   * Utile même pour un article qui paraît aujourd'hui : la place qu'on lui donne peut être
   * promise à un autre la semaine prochaine, et l'échange se ferait alors dans son dos.
   */
  readonly swapPending = computed(() => projectionPending(this.swapSlots()));


  /**
   * Date en toutes lettres — le jour de la semaine compris, qui n'est pas decoratif : c'est
   * lui qui fait voir qu'un « lundi » a ete resolu sur la mauvaise semaine.
   *
   * `Intl` et non le pipe `date` : l'application n'enregistre aucune donnee de locale, et
   * `| date: ... : 'fr'` leve NG0701 en interrompant le rendu de la vue.
   */
  private readonly longue = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  enClair(iso: string): string {
    return this.longue.format(new Date(iso));
  }

  /** Date d'arrivée en version brève — « 8 sept. » — pour les étiquettes de la une. */
  private readonly jour = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  enJour(iso: string): string {
    return this.jour.format(new Date(iso));
  }

  /**
   * L'auteur a désigné l'article à retirer : on libère la place, puis on épingle le nouveau.
   *
   * Enchaînement en deux temps plutôt qu'un appel d'échange dédié : le back n'en propose pas, et
   * la fenêtre entre les deux est celle d'un aller-retour réseau — sans conséquence, la une
   * n'affichant alors que quatre articles pendant un instant.
   *
   * Reçoit l'identifiant de l'**emplacement** et non celui de l'occupant projeté : c'est
   * l'article épinglé aujourd'hui que le back sait retirer.
   */
  swapFeature(slotId: string): void {
    const target = this.featureSwapFor();
    if (!target || this.busy()) return;

    this.featureSwapFor.set(null);
    this.applyFeature(target, slotId);
  }

  cancelSwap(): void {
    this.featureSwapFor.set(null);
  }

  /**
   * Épinglage : action unitaire (limite de 5, et `featuredAt` porte l'ordre).
   *
   * À la limite, le bouton reste actif et ouvre la popup d'échange — un bouton mort
   * n'expliquerait ni la limite, ni comment y remédier.
   */
  toggleFeature(a: Article): void {
    if (this.busy()) return;
    this.closeMenus();

    if (!this.isStarOn(a) && this.featuredFull()) {
      // La liste des épinglés est déjà chargée (section « À la une » au-dessus) : aucun
      // aller-retour de plus. Si elle manquait, on laisse le back trancher plutôt que d'ouvrir
      // une popup vide.
      if (this.featured().length) {
        this.actionError.set(null);
        this.featureSwapFor.set(a);
        return;
      }
    }

    this.applyFeature(a);
  }

  /**
   * Épingle ou retire. `replaces` désigne l'article qui cède sa place : un seul appel, le
   * back libère et épingle. S'il s'agit d'un article programmé, il mémorise l'échange au
   * lieu de l'appliquer — l'ancien reste à la une jusqu'à la parution.
   */
  private applyFeature(a: Article, replaces?: string): void {
    this.busy.set(true);
    this.actionError.set(null);
    // Un échange en attente s'annule par le même bouton : `unfeature` efface aussi bien
    // l'épinglage que l'intention, sans quoi re-cliquer épinglerait l'article programmé
    // tout de suite — en gardant l'ancien, donc en dépassant la limite.
    const op = this.isStarOn(a)
      ? this.blog.unfeature(a.id)
      : this.blog.feature(a.id, replaces);
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
        this.loadFeatured();
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
