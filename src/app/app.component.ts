import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { SeoService } from './services/seo.service';
import { CookieBannerComponent } from './components/cookie-banner/cookie-banner.component';
import { ContactPanelComponent } from './components/contact-panel/contact-panel.component';
import { ReviewNoticeComponent } from './components/review-notice/review-notice.component';
import { MetaPixelService } from './services/meta-pixel.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { ReviewNotifierService } from './services/review-notifier.service';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        CookieBannerComponent,
        ContactPanelComponent,
        ReviewNoticeComponent,
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'landing';

  private readonly seoService = inject(SeoService);
  // Instancié pour activer l'effect interne (chargement Pixel + PageView SPA + révocation)
  private readonly metaPixel  = inject(MetaPixelService);
  // Idem GA4 : effect interne (chargement gtag + page_view SPA), gated sur analyticsConsent.
  private readonly googleAnalytics = inject(GoogleAnalyticsService);
  // Idem : l'effect interne démarre l'interrogation dès qu'on entre dans l'admin connecté,
  // et l'arrête en sortant. Rien ne part sur le site public ni au rendu serveur.
  private readonly reviewNotifier = inject(ReviewNotifierService);

  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    /**
     * Retour en haut de page à chaque navigation.
     *
     * Fait à la main, et non par `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`.
     * L'option a été essayée : elle s'installe bien — `history.scrollRestoration` passe à
     * `'manual'`, preuve que le `RouterScroller` d'Angular est instancié — mais elle ne défile
     * jamais. Relevé au changement de route, `scrollY` reste rigoureusement à sa valeur d'origine
     * pendant 1,6 s, sans passer par zéro : le `ViewportScroller` est sans effet dans cette
     * configuration SSR. Pire, l'option laisse `scrollRestoration` sur `'manual'`, ce qui prive
     * en plus le retour arrière de la restitution native du navigateur.
     *
     * Deux exceptions, sans quoi le remède serait pire :
     * - `popstate` — sur un retour arrière, on rend la main au navigateur, qui restitue la
     *   position d'où l'on venait.
     * - une URL avec fragment — le dock gère ses propres ancres (`scrollToId`, avec réessais) ;
     *   remonter en haut ici lui couperait l'herbe sous le pied.
     */
    if (!isPlatformBrowser(this.platformId)) return;

    let declencheur: string = 'imperative';

    this.router.events.pipe(takeUntilDestroyed()).subscribe((evenement) => {
      if (evenement instanceof NavigationStart) {
        declencheur = evenement.navigationTrigger ?? 'imperative';
        return;
      }

      if (!(evenement instanceof NavigationEnd)) return;
      if (declencheur === 'popstate') return;
      if (this.router.parseUrl(evenement.urlAfterRedirects).fragment) return;

      window.scrollTo(0, 0);
    });
  }
}
