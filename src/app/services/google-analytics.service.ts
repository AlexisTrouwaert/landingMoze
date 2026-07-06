import { effect, inject, Injectable, isDevMode } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CookieConsentService } from './cookie-consent.service';
import { environment } from '../../environements/environment';

declare let gtag: (...args: any[]) => void;

/**
 * Google Analytics 4 (gtag.js) — miroir de MetaPixelService / BrevoService :
 *  - chargement dynamique conditionné au consentement « mesure d'audience » ;
 *  - page_view manuel sur chaque NavigationEnd (SPA, send_page_view désactivé) ;
 *  - events funnel + conversion identiques à ceux envoyés à Meta / Brevo.
 *
 * Rien n'est chargé tant que analyticsConsent() est false OU que
 * environment.gaMeasurementId est vide (même principe que brevoKey).
 * Chaque méthode est un no-op tant que gtag n'est pas chargé.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAnalyticsService {
  private readonly router  = inject(Router);
  private readonly consent = inject(CookieConsentService);

  private loaded = false;

  constructor() {
    // Charge gtag.js une seule fois, dès que le consentement mesure d'audience passe à true.
    effect(() => {
      if (this.consent.analyticsConsent() && !this.loaded) this.loadGtag();
    });

    // page_view automatique sur chaque NavigationEnd (SPA).
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.trackPageView());
  }

  /**
   * Injecte gtag.js. L'ID de mesure dépend de l'environnement (swap fileReplacements).
   * Ne fait rien tant qu'aucun ID n'est configuré (environment.gaMeasurementId vide).
   * send_page_view:false → on gère les page_view manuellement (SPA).
   */
  loadGtag(): void {
    if (this.loaded || !environment.gaMeasurementId) return;
    const id = environment.gaMeasurementId;

    const lib = document.createElement('script');
    lib.async = true;
    lib.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(lib);

    const init = document.createElement('script');
    init.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}', { send_page_view: false });
    `;
    document.head.appendChild(init);
    this.loaded = true;

    // La NavigationEnd initiale a pu passer avant le chargement → 1re page_view manuelle.
    this.trackPageView();
  }

  /** page_view — déclenché automatiquement sur NavigationEnd. */
  trackPageView(): void {
    if (typeof gtag === 'undefined') return;
    gtag('event', 'page_view', {
      page_location: location.href,
      page_path: this.router.url,
      page_title: document.title,
    });
  }

  /* ============================================================
     FUNNEL EVENTS — miroir de MetaPixelService (mêmes points d'appel)
     ============================================================ */

  /** Entrée du funnel — fire dès l'affichage de /commencer. */
  trackFunnelStarted(): void {
    this.event('funnel_started');
  }

  /** Step 1 validée : un secteur a été choisi. */
  trackFunnelStep1Completed(sector: string): void {
    this.event('funnel_step1_completed', { sector });
  }

  /** Step 2 validée : réponse oui/non sur le crédit d'impôt immédiat. */
  trackFunnelStep2Completed(wantsTaxCredit: boolean): void {
    this.event('funnel_step2_completed', { wants_tax_credit: wantsTaxCredit });
  }

  /**
   * Inscription réussie — la conversion. Event GA4 recommandé `sign_up`.
   * À marquer comme « Événement clé » dans l'admin GA4.
   */
  trackSignUp(method: string, data: Record<string, any> = {}): void {
    this.event('sign_up', { method, ...data });
  }

  /** Clic CTA d'inscription — event GA4 recommandé `generate_lead`. */
  trackGenerateLead(data: Record<string, any> = {}): void {
    this.event('generate_lead', data);
  }

  /** Inscription newsletter. */
  trackSubscribe(data: Record<string, any> = {}): void {
    this.event('subscribe', data);
  }

  /** Choix de destination après inscription. */
  trackFunnelDestination(destination: 'mozeconnect' | 'mozeplace'): void {
    this.event('funnel_destination', { destination });
  }

  /** Abandon du funnel — clic logo, bouton "Retour", ou blocage honeypot. */
  trackFunnelAbandoned(fromStep: number, reason: 'logo' | 'back_button' | 'honeypot_triggered'): void {
    this.event('funnel_abandoned', { from_step: fromStep, reason });
  }

  /** Event générique gtag. No-op si gtag pas chargé (pas de consentement / ID absent). */
  private event(name: string, params: Record<string, any> = {}): void {
    if (typeof gtag === 'undefined') {
      if (isDevMode()) console.warn('[GA] gtag introuvable — event "' + name + '" ignoré.');
      return;
    }
    gtag('event', name, params);
  }
}
