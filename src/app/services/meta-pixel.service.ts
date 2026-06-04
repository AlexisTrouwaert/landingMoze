import { effect, inject, Injectable, isDevMode } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CookieConsentService } from './cookie-consent.service';
import { environment } from '../../environements/environment';

declare let fbq: any;

@Injectable({ providedIn: 'root' })
export class MetaPixelService {
  private readonly router  = inject(Router);
  private readonly consent = inject(CookieConsentService);

  private loaded = false;

  private purchaseTracked    = false;
  private viewContentTracked = false;

  constructor() {
    // Réagit au signal de consentement publicitaire :
    // - true  → charge le Pixel (1ère fois) ou réautorise (fois suivantes)
    // - false → révoque le consentement côté Meta (script reste chargé mais inactif)
    effect(() => {
      const granted = this.consent.advertisingConsent();
      if (granted) {
        this.loaded ? this.grantConsent() : this.loadPixel();
      } else if (this.loaded) {
        this.revokeConsent();
      }
    });

    // PageView automatique sur changement de route (SPA)
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.trackPageView());
  }

  /**
   * Injecte dynamiquement le Pixel Meta. Appelé automatiquement quand le consentement
   * passe à true. L'ID utilisé dépend de l'environnement (dev = pixel test, prod = pixel patron),
   * swap géré par fileReplacements dans angular.json.
   */
  loadPixel(): void {
    if (this.loaded) return;

    const script = document.createElement('script');
    script.textContent = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${environment.metaPixelId}');
      fbq('track','PageView');
    `;
    document.head.appendChild(script);
    this.loaded = true;
  }

  /** PageView — déclenché automatiquement sur NavigationEnd. */
  trackPageView(): void {
    if (typeof fbq !== 'undefined') fbq('track', 'PageView');
  }

  trackPurchase(): void {
    if (this.purchaseTracked || typeof fbq === 'undefined') return;
    fbq('track', 'Purchase');
    this.purchaseTracked = true;
  }

  trackViewContent(): void {
    if (this.viewContentTracked || typeof fbq === 'undefined') return;
    fbq('track', 'ViewContent');
    this.viewContentTracked = true;
  }

  resetViewContent(): void {
    this.viewContentTracked = false;
  }

  /** Clic CTA d'inscription — fire 'Lead' avec un libellé différenciant. Pas de dedup (chaque clic compte). */
  trackLeadCTA(buttonLabel: string): void {
    if (typeof fbq === 'undefined') return;
    fbq('track', 'Lead', { button_label: buttonLabel });
  }

  /** Inscription newsletter — event standard Meta 'Subscribe'. */
  trackSubscribe(data: Record<string, any> = {}): void {
    if (typeof fbq === 'undefined') return;
    fbq('track', 'Subscribe', data);
  }

  /* ============================================================
     FUNNEL EVENTS — progression entonnoir + abandons
     ============================================================ */

  /** Entrée du funnel — fire dès que la page /commencer s'affiche. */
  trackFunnelStarted(): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', 'FunnelStarted');
  }

  /** Step 1 validée : un secteur a été choisi. */
  trackFunnelStep1Completed(sector: string): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', 'FunnelStep1Completed', { sector });
  }

  /** Step 2 validée : réponse oui/non sur le crédit d'impôt immédiat. */
  trackFunnelStep2Completed(wantsTaxCredit: boolean): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', 'FunnelStep2Completed', { wants_tax_credit: wantsTaxCredit });
  }

  /** Soumission réussie du formulaire d'inscription — event standard Meta. */
  trackCompleteRegistration(data: Record<string, any> = {}): void {
    if (typeof fbq === 'undefined') return;
    fbq('track', 'CompleteRegistration', data);
  }

  /** Abandon du funnel — clic logo (retour home) ou bouton "Retour". */
  trackFunnelAbandoned(fromStep: number, reason: 'logo' | 'back_button'): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', 'FunnelAbandoned', { from_step: fromStep, reason });
  }

  /**
   * Choix de destination après inscription — app de facturation ou réseau social.
   * `onSent` est appelé une fois l'event transmis à Meta (via eventCallback), ou
   * immédiatement si le pixel est absent. Permet de retarder une navigation
   * sortante jusqu'à l'envoi effectif sans risquer de perdre l'event.
   */
  trackFunnelDestination(
    destination: 'mozeconnect' | 'mozeplace',
    onSent?: () => void
  ): void {
    if (typeof fbq === 'undefined') {
      onSent?.();
      return;
    }
    fbq('trackCustom', 'FunnelDestination', { destination }, { eventCallback: onSent });
  }

  /** Event générique — pour les cas non couverts par les helpers dédiés. */
  trackEvent(eventName: string, data: Record<string, any> = {}, eventId?: string): void {
    if (typeof fbq === 'undefined') {
      if (isDevMode()) console.warn('[Meta] fbq introuvable — event "' + eventName + '" ignoré.');
      return;
    }
    const opts = eventId ? { eventID: eventId } : undefined;
    opts ? fbq('track', eventName, data, opts) : fbq('track', eventName, data);
  }

  trackCustomEvent(eventName: string, data: Record<string, any> = {}, eventId?: string): void {
    if (typeof fbq === 'undefined') return;
    const opts = eventId ? { eventID: eventId } : undefined;
    opts ? fbq('trackCustom', eventName, data, opts) : fbq('trackCustom', eventName, data);
  }

  private grantConsent(): void {
    if (typeof fbq !== 'undefined') fbq('consent', 'grant');
  }

  private revokeConsent(): void {
    if (typeof fbq !== 'undefined') fbq('consent', 'revoke');
  }
}
