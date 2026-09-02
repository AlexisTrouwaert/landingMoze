import { afterNextRender, ChangeDetectionStrategy, Component, effect, EventEmitter, inject, Input, OnDestroy, Output, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface DockLink { id: string; label: string; icon?: string; desc?: string; action?: string; route?: string; }
export interface DockGroup { title?: string; links: DockLink[]; }

/**
 * Barre de navigation horizontale **flottante** (dock), réutilisable.
 *
 * - Landing : logo + navigation à déroulants (`groups`) + CTA optionnel. Liens =
 *   ancres partageables (`/#section`) avec scroll fluide et scroll-spy.
 * - Réutilisable ailleurs : on peut passer `buttonLabel` (ex. "Retour") → un
 *   bouton custom apparaît, `(buttonClick)` est émis au clic.
 *
 * Les sections de la landing étant en `@defer (on idle)`, le scroll réessaie tant
 * que la cible n'est pas rendue (gère aussi l'arrivée via un lien partagé).
 */
@Component({
    selector: 'app-floating-dock',
    imports: [],
    templateUrl: './floating-dock.component.html',
    styleUrl: './floating-dock.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FloatingDockComponent implements OnDestroy {

  /** Navigation : groupe avec `title` = déroulant ; groupe sans `title` = liens directs. */
  @Input() groups: DockGroup[] = [];
  /** Ids de liens à masquer sur la page courante (ex. `['blog']` sur le blog). */
  @Input() hideLinkIds: string[] = [];
  /** Bouton custom (ex. "Retour"). null = pas de bouton. */
  @Input() buttonLabel: string | null = null;
  /** Libellé du CTA (bouton primaire à droite). null = pas de CTA. */
  @Input() ctaLabel: string | null = null;
  /**
   * Lien « déjà inscrit » vers la connexion à l'app, posé juste avant le CTA.
   * Les deux doivent être renseignés pour que le bouton s'affiche : sans adresse
   * il ne mènerait nulle part, sans libellé il ne dirait rien.
   */
  @Input() loginLabel: string | null = null;
  @Input() loginHref: string | null = null;
  /** Émis au clic sur le bouton custom de gauche (ex. "Retour"). */
  @Output() buttonClick = new EventEmitter<void>();
  /** Émis au clic sur le CTA de droite. */
  @Output() ctaClick = new EventEmitter<void>();
  /** Émis au clic sur le logo SI un écouteur est branché (sinon = simple lien vers /). */
  @Output() logoClick = new EventEmitter<Event>();
  /** Émis au clic sur un lien porteur d'une `action` (ex. Support) — le parent gère (pas de scroll). */
  @Output() linkAction = new EventEmitter<string>();

  private readonly router = inject(Router);

  /** Index du déroulant ouvert (null = aucun). */
  readonly openGroup = signal<number | null>(null);
  /** Section visible (scroll-spy). */
  readonly activeId = signal<string>('');
  /** Menu mobile (burger) ouvert ? */
  readonly mobileOpen = signal<boolean>(false);

  /** Groupes réellement affichés : retire les liens masqués (`hideLinkIds`) et les groupes vidés. */
  get visibleGroups(): DockGroup[] {
    if (!this.hideLinkIds.length) return this.groups;
    return this.groups
      .map(g => ({ ...g, links: g.links.filter(l => !this.hideLinkIds.includes(l.id)) }))
      .filter(g => g.links.length > 0);
  }

  private io: IntersectionObserver | null = null;
  private mo: MutationObserver | null = null;

  /** Position de la page au moment du verrouillage, à rendre à la fermeture. */
  private lockedScrollY = 0;

  constructor() {
    afterNextRender(() => {
      this.setupScrollSpy();
      this.scrollToHashOnLoad();
      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('click', this.onDocClick, true);
    });

    // Tiroir ouvert = page figée derrière. Un effet plutôt qu'un appel dans
    // `toggleMobile` : le menu se ferme aussi par Échap, par un clic à côté et par
    // chaque lien — autant de chemins qui oublieraient de déverrouiller.
    effect(() => this.lockPageScroll(this.mobileOpen()));
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
    this.mo?.disconnect();
    // Quitter la page avec le menu ouvert (un lien du tiroir) ne doit pas laisser
    // le `body` figé sur la page suivante.
    this.lockPageScroll(false);
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('click', this.onDocClick, true);
    }
  }

  /**
   * Fige (ou libère) le défilement de la page derrière le tiroir.
   *
   * `position: fixed` et non `overflow: hidden` : Safari iOS ignore le second pour le
   * défilement tactile, et le fond continuait de glisser sous le menu. En contrepartie il
   * faut mémoriser puis rendre la position, sinon la page ressort en haut.
   *
   * Le tiroir, lui, garde son défilement propre (`overflow-y: auto` côté SCSS).
   */
  private lockPageScroll(lock: boolean): void {
    if (typeof document === 'undefined') return;
    const body = document.body;

    if (lock) {
      this.lockedScrollY = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${this.lockedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      return;
    }

    // Ne relâche que ce qu'on a soi-même posé : sans ce test, la fermeture initiale
    // (effet joué au démarrage) remonterait la page en haut.
    if (body.style.position !== 'fixed') return;

    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';

    // Lecture qui force le recalcul de la mise en page : tant que le navigateur n'a pas
    // rendu au document sa hauteur réelle, il croit la page haute d'un écran et ramènerait
    // le défilement à zéro.
    void document.documentElement.scrollHeight;

    // `behavior: 'instant'` obligatoire : la page porte `scroll-behavior: smooth`, et la
    // forme à deux arguments (`scrollTo(0, y)`) s'y soumet — le retour à la position
    // n'aboutissait tout simplement pas. Une animation serait de toute façon fausse ici :
    // on ne se déplace pas, on remet l'écran là où il était.
    window.scrollTo({ top: this.lockedScrollY, behavior: 'instant' });
  }

  private readonly onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { this.openGroup.set(null); this.mobileOpen.set(false); }
  };

  /** Ferme le déroulant / le menu mobile si l'on clique en dehors du dock. */
  private readonly onDocClick = (e: Event): void => {
    if (this.openGroup() === null && !this.mobileOpen()) return;
    if (!(e.target as HTMLElement)?.closest('app-floating-dock')) {
      this.openGroup.set(null);
      this.mobileOpen.set(false);
    }
  };

  toggleGroup(i: number): void {
    this.openGroup.update(cur => (cur === i ? null : i));
  }

  /** Ouvre / ferme le menu mobile (burger). */
  toggleMobile(): void {
    this.mobileOpen.update(v => !v);
    this.openGroup.set(null);
  }

  /** CTA du menu mobile : ferme le menu puis émet l'action. */
  onMobileCta(): void {
    this.mobileOpen.set(false);
    this.ctaClick.emit();
  }

  /** Un lien du groupe correspond-il à la section visible ? (surligne le déroulant) */
  groupActive(group: DockGroup): boolean {
    return group.links.some(l => l.id === this.activeId());
  }

  private allIds(): string[] {
    // Seuls les liens d'ancre (ni route, ni action) ciblent une section scrollable.
    return this.groups.flatMap(g => g.links.filter(l => !l.route && !l.action).map(l => l.id));
  }

  /** Clic sur un lien : soit une `action` déléguée au parent (ex. Support), soit une
   *  ancre partageable (`/#id`) + scroll fluide. Ferme le déroulant dans tous les cas. */
  navigate(event: Event, link: DockLink): void {
    event.preventDefault();
    this.openGroup.set(null);
    this.mobileOpen.set(false);
    if (link.route) { void this.router.navigateByUrl(link.route); return; }
    if (link.action) { this.linkAction.emit(link.action); return; }
    // Ancre de section : présente sur la page courante → scroll fluide ; sinon
    // (blog, tunnel…) → va à l'accueil avec le hash, qui scrollera à l'arrivée.
    const el = typeof document !== 'undefined' ? document.getElementById(link.id) : null;
    if (el) {
      if (typeof history !== 'undefined') history.replaceState(null, '', '#' + link.id);
      this.scrollToId(link.id);
    } else {
      void this.router.navigate(['/'], { fragment: link.id });
    }
  }

  /** Le logo : lien vers / par défaut ; si `logoClick` est écouté, on délègue au parent. */
  onLogoClick(event: Event): void {
    if (this.logoClick.observed) {
      event.preventDefault();
      this.logoClick.emit(event);
    }
  }

  /** Scroll vers l'ancre ; réessaie tant que la section (@defer) n'est pas dans le DOM. */
  private scrollToId(id: string, attempts = 0): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (attempts < 40) setTimeout(() => this.scrollToId(id, attempts + 1), 80);
  }

  /** Arrivée directe avec un `#fragment` (lien partagé) → scroll dès que la cible existe. */
  private scrollToHashOnLoad(): void {
    const hash = (typeof location !== 'undefined' ? location.hash : '').replace('#', '');
    if (hash && this.allIds().includes(hash)) setTimeout(() => this.scrollToId(hash), 60);
  }

  private setupScrollSpy(): void {
    if (typeof IntersectionObserver === 'undefined' || this.allIds().length === 0) return;

    this.io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting && e.target.id) this.activeId.set(e.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    const observeAll = (): void => {
      let allFound = true;
      for (const id of this.allIds()) {
        const el = document.getElementById(id);
        if (el) this.io!.observe(el);
        else allFound = false;
      }
      if (allFound) this.mo?.disconnect();
    };

    observeAll();
    this.mo = new MutationObserver(observeAll);
    this.mo.observe(document.body, { childList: true, subtree: true });
  }
}
