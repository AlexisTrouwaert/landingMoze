import { Injectable, signal } from '@angular/core';

interface ConsentChoices {
  /** Publicité & réseaux sociaux (Meta Pixel, Brevo). */
  advertising: boolean;
  /** Mesure d'audience (Google Analytics). */
  analytics: boolean;
}

const STORAGE_KEY = 'moze_consent_v2';

@Injectable({ providedIn: 'root' })
export class CookieConsentService {

  /** true = l'utilisateur a fait un choix (accepté / refusé / enregistré) */
  readonly consentDecided     = signal<boolean>(this.hasDecided());

  /** true = consentement publicitaire accordé (Meta, Brevo) */
  readonly advertisingConsent = signal<boolean>(this.getChoice('advertising'));

  /** true = consentement mesure d'audience accordé (Google Analytics) */
  readonly analyticsConsent   = signal<boolean>(this.getChoice('analytics'));

  private hasDecided(): boolean {
    try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
  }

  private getChoice(category: keyof ConsentChoices): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      return (JSON.parse(stored) as ConsentChoices)[category] ?? false;
    } catch { return false; }
  }

  /** Accepte toutes les catégories optionnelles */
  acceptAll(): void {
    this.persist({ advertising: true, analytics: true });
  }

  /** Refuse les cookies optionnels — seuls les cookies fonctionnels restent actifs */
  refuseAll(): void {
    this.persist({ advertising: false, analytics: false });
  }

  /** Enregistre un choix granulaire (toggles du drawer). */
  setChoices(choices: ConsentChoices): void {
    this.persist(choices);
  }

  /** Réinitialise les préférences (lien "Gérer mes cookies" dans le footer) */
  reset(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    this.advertisingConsent.set(false);
    this.analyticsConsent.set(false);
    this.consentDecided.set(false);
  }

  /** Sauvegarde + met à jour les signaux + marque le choix comme fait. */
  private persist(choices: ConsentChoices): void {
    this.save(choices);
    this.advertisingConsent.set(choices.advertising);
    this.analyticsConsent.set(choices.analytics);
    this.consentDecided.set(true);
  }

  private save(choices: ConsentChoices): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choices)); } catch { /* */ }
  }
}
