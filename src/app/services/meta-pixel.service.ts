import { effect, inject, Injectable, isDevMode } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CookieConsentService } from './cookie-consent.service';
import { environment } from '../../environements/environment';

declare let fbq: any;

/** Type de tunnel — sert à distinguer les events Meta des 2 funnels. */
export type FunnelKind = 'facturation' | 'reseau';

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

  /**
   * Clic CTA d'inscription — fire 'Lead' avec un libellé différenciant. Pas de dedup (chaque clic compte).
   * `onSent` est appelé une fois l'event transmis à Meta (eventCallback), ou au plus tard après
   * un court délai de secours — garantit que la navigation se fait même si Meta ne rappelle jamais
   * (adblocker, réseau lent, consentement révoqué côté fbq).
   */
  trackLeadCTA(buttonLabel: string, funnel: FunnelKind, onSent?: () => void): void {
    if (typeof fbq === 'undefined') {
      onSent?.();
      return;
    }
    const payload = { button_label: buttonLabel, funnel };
    if (!onSent) {
      fbq('track', 'Lead', payload);
      return;
    }
    // Garde anti-double-appel : callback Meta OU timeout, le premier qui arrive gagne.
    let done = false;
    const fire = () => { if (!done) { done = true; onSent(); } };
    const timer = setTimeout(fire, 400);
    fbq('track', 'Lead', payload, {
      eventCallback: () => { clearTimeout(timer); fire(); }
    });
  }

  /** Inscription newsletter — event standard Meta 'Subscribe'. */
  trackSubscribe(data: Record<string, any> = {}): void {
    if (typeof fbq === 'undefined') return;
    fbq('track', 'Subscribe', data);
  }

  /* ============================================================
     FUNNEL EVENTS — progression entonnoir + abandons
     ============================================================ */

  /** Entrée du funnel — fire dès que la page du tunnel s'affiche. */
  trackFunnelStarted(funnel: FunnelKind = 'facturation'): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', this.funnelEventName('FunnelStarted', funnel));
  }

  /** Step 1 validée : un secteur a été choisi. */
  trackFunnelStep1Completed(sector: string, funnel: FunnelKind = 'facturation'): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', this.funnelEventName('FunnelStep1Completed', funnel), { sector });
  }

  /** Step 2 validée : réponse oui/non sur le crédit d'impôt immédiat. */
  trackFunnelStep2Completed(wantsTaxCredit: boolean): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', 'FunnelStep2Completed', { wants_tax_credit: wantsTaxCredit });
  }

  /**
   * Soumission réussie du formulaire d'inscription.
   * - Funnel facturation : event standard Meta 'CompleteRegistration' (optimisation pub).
   * - Funnel réseau : event custom distinct 'CompleteRegistrationReseau'.
   */
  trackCompleteRegistration(data: Record<string, any> = {}, funnel: FunnelKind = 'facturation'): void {
    if (typeof fbq === 'undefined') return;
    if (funnel === 'reseau') {
      fbq('trackCustom', 'CompleteRegistrationReseau', data);
    } else {
      fbq('track', 'CompleteRegistration', data);
    }
  }

  /** Abandon du funnel — clic logo (retour home), bouton "Retour", ou blocage honeypot. */
  trackFunnelAbandoned(fromStep: number, reason: 'logo' | 'back_button' | 'honeypot_triggered', funnel: FunnelKind = 'facturation'): void {
    if (typeof fbq === 'undefined') return;
    fbq('trackCustom', this.funnelEventName('FunnelAbandoned', funnel), { from_step: fromStep, reason });
  }

  /**
   * Choix de destination après inscription — app de facturation ou réseau social.
   * `onSent` est appelé une fois l'event transmis à Meta (via eventCallback), ou
   * immédiatement si le pixel est absent. Permet de retarder une navigation
   * sortante jusqu'à l'envoi effectif sans risquer de perdre l'event.
   */
  trackFunnelDestination(
    destination: 'mozeconnect' | 'mozeplace',
    funnel: FunnelKind = 'facturation',
    onSent?: () => void
  ): void {
    if (typeof fbq === 'undefined') {
      onSent?.();
      return;
    }
    fbq('trackCustom', this.funnelEventName('FunnelDestination', funnel), { destination }, { eventCallback: onSent });
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

  /**
   * Nom d'event custom du funnel. Le funnel réseau utilise des noms distincts
   * (suffixe "Reseau") pour être segmentable dans Meta sans toucher au tracking
   * historique de la facturation.
   */
  private funnelEventName(base: string, funnel: FunnelKind): string {
    return funnel === 'reseau' ? `${base}Reseau` : base;
  }

  private grantConsent(): void {
    if (typeof fbq !== 'undefined') fbq('consent', 'grant');
  }

  private revokeConsent(): void {
    if (typeof fbq !== 'undefined') fbq('consent', 'revoke');
  }
}
