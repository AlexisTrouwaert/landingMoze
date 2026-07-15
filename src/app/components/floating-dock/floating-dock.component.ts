import { afterNextRender, ChangeDetectionStrategy, Component, EventEmitter, inject, Input, OnDestroy, Output, signal } from '@angular/core';
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
  /** Bouton custom (ex. "Retour"). null = pas de bouton. */
  @Input() buttonLabel: string | null = null;
  /** Libellé du CTA (bouton primaire à droite). null = pas de CTA. */
  @Input() ctaLabel: string | null = null;
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

  private io: IntersectionObserver | null = null;
  private mo: MutationObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.setupScrollSpy();
      this.scrollToHashOnLoad();
      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('click', this.onDocClick, true);
    });
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
    this.mo?.disconnect();
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('click', this.onDocClick, true);
    }
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
    if (typeof history !== 'undefined') history.replaceState(null, '', '#' + link.id);
    this.scrollToId(link.id);
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
