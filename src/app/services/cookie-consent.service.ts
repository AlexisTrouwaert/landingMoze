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

  /** Accepte les catégories sélectionnées par l'utilisateur */
  acceptSelected(advertising: boolean): void {
    this.save({ advertising });
    this.advertisingConsent.set(advertising);
    this.consentDecided.set(true);
  }

  /** Refuse tout et expulse l'utilisateur — pas de sauvegarde, bannière réapparaît à la prochaine visite */
  refuseAll(): void {
    window.location.href = 'https://www.google.fr';
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
