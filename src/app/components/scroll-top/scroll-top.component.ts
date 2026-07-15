import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { CookieConsentService } from '../../services/cookie-consent.service';

/**
 * Bouton flottant « retour en haut ».
 *
 * Réutilisable et autonome : il n'apparaît qu'une fois la page suffisamment
 * défilée, puis ramène en haut avec un scroll fluide (respecte
 * `prefers-reduced-motion`). Positionné en bas à droite, sous les éléments
 * prioritaires (cookie-banner, panneau contact). Tant que les cookies ne sont
 * pas choisis, il se décale vers le haut pour ne pas chevaucher le bandeau.
 */
@Component({
    selector: 'app-scroll-top',
    imports: [],
    templateUrl: './scroll-top.component.html',
    styleUrl: './scroll-top.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScrollTopComponent implements OnDestroy {

  /** Le bouton n'est visible (et cliquable) qu'au-delà de ce seuil de scroll. */
  private static readonly THRESHOLD = 500;

  /** Page suffisamment défilée pour afficher le bouton ? */
  readonly visible = signal(false);

  private readonly consent = inject(CookieConsentService);
  /** Cookies pas encore choisis → le bandeau occupe le coin : on remonte le bouton. */
  readonly cookiesPending = computed(() => !this.consent.consentDecided());

  constructor() {
    afterNextRender(() => {
      this.onScroll();
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('scroll', this.onScroll);
  }

  private readonly onScroll = (): void => {
    this.visible.set(window.scrollY > ScrollTopComponent.THRESHOLD);
  };

  scrollToTop(): void {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
}
