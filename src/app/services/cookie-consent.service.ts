import { Injectable, signal } from '@angular/core';

interface ConsentChoices {
  advertising: boolean;
}

const STORAGE_KEY = 'moze_consent_v2';

@Injectable({ providedIn: 'root' })
export class CookieConsentService {

  /** true = l'utilisateur a fait un choix (accepté) */
  readonly consentDecided    = signal<boolean>(this.hasDecided());

  /** true = consentement publicitaire accordé */
  readonly advertisingConsent = signal<boolean>(this.getChoice('advertising'));

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
    this.save({ advertising: true });
    this.advertisingConsent.set(true);
    this.consentDecided.set(true);
  }

  /** Refuse les cookies optionnels — seuls les cookies fonctionnels restent actifs */
  refuseAll(): void {
    this.save({ advertising: false });
    this.advertisingConsent.set(false);
    this.consentDecided.set(true);
  }

  /** Réinitialise les préférences (lien "Gérer mes cookies" dans le footer) */
  reset(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    this.advertisingConsent.set(false);
    this.consentDecided.set(false);
  }

  private save(choices: ConsentChoices): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choices)); } catch { /* */ }
  }
}
