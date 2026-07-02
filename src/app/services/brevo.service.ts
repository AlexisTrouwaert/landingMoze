import { effect, inject, Injectable, isDevMode } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CookieConsentService } from './cookie-consent.service';
import { environment } from '../../environements/environment';

declare let sendinblue: any;

/**
 * Tracker Brevo (ex-Sendinblue) — suivi comportemental on-site + rattachement
 * des events à un contact via identify(). Miroir de MetaPixelService :
 *  - chargement dynamique conditionné au consentement publicitaire ;
 *  - page() automatique sur chaque changement de route (SPA) ;
 *  - events funnel identiques à ceux envoyés à Meta.
 *
 * NB : distinct de subscribeToBrevo() (interstitial-step) qui, lui, poste un
 * formulaire d'inscription à une liste. Ici on fait du tracking, pas de la liste.
 * Brevo n'expose pas de grant/revoke comme Meta : on se contente de ne jamais
 * charger le tracker sans consentement.
 */
@Injectable({ providedIn: 'root' })
export class BrevoService {
  private readonly router  = inject(Router);
  private readonly consent = inject(CookieConsentService);

  private loaded = false;

  constructor() {
    // Charge le tracker une seule fois, dès que le consentement passe à true.
    effect(() => {
      if (this.consent.advertisingConsent() && !this.loaded) this.loadTracker();
    });

    // page() automatique sur chaque NavigationEnd (SPA).
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.trackPage());
  }

  /**
   * Injecte le tracker Brevo. La clé (client_key = clé Marketing Automation) dépend
   * de l'environnement, swap géré par fileReplacements. Ne fait rien tant qu'aucune
   * clé n'est configurée (environment.brevoKey vide).
   */
  loadTracker(): void {
    if (this.loaded || !environment.brevoKey) return;

    const script = document.createElement('script');
    script.textContent = `
      (function() {
        window.sib = { equeue: [], client_key: "${environment.brevoKey}" };
        window.sendinblue = {};
        for (var j = ['track', 'identify', 'trackLink', 'page'], i = 0; i < j.length; i++) {
          (function(k) {
            window.sendinblue[k] = function() {
              var arg = Array.prototype.slice.call(arguments);
              (window.sib[k] || function() { var t = {}; t[k] = arg; window.sib.equeue.push(t); })(arg[0], arg[1], arg[2], arg[3]);
            };
          })(j[i]);
        }
        var n = document.createElement("script"), i = document.getElementsByTagName("script")[0];
        n.type = "text/javascript"; n.id = "sendinblue-js"; n.async = !0;
        n.src = "https://sibautomation.com/sa.js?key=" + window.sib.client_key + "&plugin=marketing";
        i.parentNode.insertBefore(n, i);
        window.sendinblue.page();
      })();
    `;
    document.head.appendChild(script);
    this.loaded = true;
  }

  /** Page vue — déclenchée automatiquement sur NavigationEnd. */
  trackPage(name?: string): void {
    if (typeof sendinblue !== 'undefined') sendinblue.page(name ?? document.title, {});
  }

  /**
   * Rattache le parcours (anonyme jusque-là) à un contact identifié par email.
   * Cœur de la "conversion" : les events passés (via cookie) et futurs se collent
   * à sa fiche. Attributs contact en MAJUSCULES par convention Brevo.
   */
  identify(email: string, attributes: Record<string, any> = {}): void {
    if (typeof sendinblue !== 'undefined') sendinblue.identify(email, attributes);
  }

  /** Event custom générique. `data` = métadonnées de l'event (pas des attributs contact). */
  track(event: string, data: Record<string, any> = {}): void {
    if (typeof sendinblue === 'undefined') {
      if (isDevMode()) console.warn('[Brevo] sendinblue introuvable — event "' + event + '" ignoré.');
      return;
    }
    sendinblue.track(event, {}, { data });
  }

  /* ============================================================
     FUNNEL EVENTS — miroir de MetaPixelService (mêmes points d'appel)
     ============================================================ */

  /** Entrée du funnel — fire dès l'affichage de /commencer. */
  trackFunnelStarted(): void {
    this.track('funnel_started');
  }

  /** Step 1 validée : un secteur a été choisi. */
  trackFunnelStep1Completed(sector: string): void {
    this.track('funnel_step1_completed', { sector });
  }

  /** Step 2 validée : réponse oui/non sur le crédit d'impôt immédiat. */
  trackFunnelStep2Completed(wantsTaxCredit: boolean): void {
    this.track('funnel_step2_completed', { wants_tax_credit: wantsTaxCredit });
  }

  /** Inscription réussie — la "conversion". À coupler avec identify(). */
  trackCompleteRegistration(data: Record<string, any> = {}): void {
    this.track('inscription_complete', data);
  }

  /** Choix de destination après inscription. */
  trackFunnelDestination(destination: 'mozeconnect' | 'mozeplace'): void {
    this.track('funnel_destination', { destination });
  }

  /** Abandon du funnel — clic logo, bouton "Retour", ou blocage honeypot. */
  trackFunnelAbandoned(fromStep: number, reason: 'logo' | 'back_button' | 'honeypot_triggered'): void {
    this.track('funnel_abandoned', { from_step: fromStep, reason });
  }
}
