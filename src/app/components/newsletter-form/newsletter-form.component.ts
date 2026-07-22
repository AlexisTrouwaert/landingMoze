import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetaPixelService } from '../../services/meta-pixel.service';

/**
 * Formulaire d'inscription newsletter réutilisable : email + double opt-in
 * (consentement e-mails obligatoire, mesure d'ouverture facultative — CNIL),
 * honeypot + rate-limiting local, envoi au form Brevo.
 *
 * Le style est prévu pour un fond sombre (bloc newsletter du blog).
 */
@Component({
  selector: 'app-newsletter-form',
  imports: [FormsModule],
  templateUrl: './newsletter-form.component.html',
  styleUrl: './newsletter-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterFormComponent {
  private readonly metaPixel = inject(MetaPixelService);
  private readonly MAX_ATTEMPTS = 5;
  /** Fenêtre anti-spam glissante (auto-expirée) — évite le ban définitif. */
  private readonly WINDOW_MS = 60 * 60 * 1000; // 1 h

  /** Source transmise au pixel Meta (ex. 'newsletter_blog'). */
  readonly source = input<string>('newsletter');

  emailValue = signal<string>('');
  optInValue = signal<boolean>(false);
  /** Consentement au pixel de suivi (facultatif, distinct de l'opt-in newsletter). */
  pixelConsentValue = signal<boolean>(false);
  honeypotValue = signal<string>('');

  status = signal<'IDLE' | 'SUCCESS' | 'ERROR' | 'LOADING'>('IDLE');
  isShaking = signal<boolean>(false);
  emailError = signal<boolean>(false);
  optInError = signal<boolean>(false);

  onSubmit(event: Event): void {
    event.preventDefault();
    if (typeof localStorage === 'undefined') return;

    this.emailError.set(false);
    this.optInError.set(false);

    // 1. Validation de base
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

    if (!emailRegex.test(this.emailValue())) {
      this.emailError.set(true);
      hasError = true;
    }
    if (!this.optInValue()) {
      this.optInError.set(true);
      hasError = true;
    }

    if (hasError) {
      this.triggerShake();
      return;
    }

    // 2. Honeypot : rempli = bot → on simule le succès sans rien envoyer.
    if (this.honeypotValue()) {
      this.triggerSuccess();
      return;
    }

    // 3. Anti-spam : fenêtre glissante auto-expirée (jamais un ban définitif).
    const recent = this.recentAttempts();
    if (recent.length >= this.MAX_ATTEMPTS) {
      this.status.set('ERROR'); // trop de tentatives récentes → message réel, pas de faux succès
      this.triggerShake();
      return;
    }

    // 4. Envoi via Fetch au form Brevo
    this.status.set('LOADING');

    const bodyParams = new URLSearchParams();
    bodyParams.append('EMAIL', this.emailValue());
    bodyParams.append('OPT_IN', '1');
    // Consentement pixel de suivi (CNIL) — champ _PIXEL_TRACKING_CONSENT. 1 = accepte, 0 = refuse.
    bodyParams.append('_PIXEL_TRACKING_CONSENT', this.pixelConsentValue() ? '1' : '0');
    bodyParams.append('email_address_check', '');
    bodyParams.append('locale', 'fr');

    const brevoUrl =
      'https://c1020106.sibforms.com/serve/MUIFAPCu8l9auir9gfCkLC5J0P0Mxj8KhfZ67iKAc2LnMz7BXxGM_c_jsIyHtnsNJBq6CJ8ZdY2El0-p6nEhayeC1hFc7uRilk0KUJVj3l_l7WBFdoyNKlJbYaux9c2MEM6-RkODXtF3QKfKEj4uVIZB-7PjNvHorEYZUetyaJGlRyjlX0pxWj82chrO3PbomQVHxEZk6PA2wBY6';

    fetch(brevoUrl, {
      method: 'POST',
      body: bodyParams,
      mode: 'no-cors',
    })
      .then(() => {
        // On ne compte QUE les envois réellement partis (pas les erreurs réseau).
        this.recordAttempt(recent);
        this.metaPixel.trackSubscribe({ source: this.source() });
        this.triggerSuccess();
      })
      .catch((error) => {
        console.error('Erreur réseau :', error);
        this.triggerShake();
        this.status.set('IDLE');
      });
  }

  /**
   * Envois réussis dans la fenêtre anti-spam courante (auto-expirée).
   * ⚠️ `mode:'no-cors'` empêche de lire la vraie réponse Brevo (doublon, rejet…) :
   * le « succès » affiché = « requête partie », pas « acceptée ». Pour un vrai
   * statut il faudrait un endpoint back.
   */
  private recentAttempts(): number[] {
    try {
      const raw = localStorage.getItem('nl_attempts');
      const cutoff = Date.now() - this.WINDOW_MS;
      return (raw ? (JSON.parse(raw) as number[]) : []).filter((t) => t > cutoff);
    } catch {
      return [];
    }
  }

  private recordAttempt(recent: number[]): void {
    try {
      localStorage.setItem('nl_attempts', JSON.stringify([...recent, Date.now()]));
    } catch {
      /* localStorage indisponible → on ignore */
    }
  }

  private triggerShake(): void {
    this.isShaking.set(true);
    setTimeout(() => this.isShaking.set(false), 500);
  }

  private triggerSuccess(): void {
    this.status.set('SUCCESS');
    this.emailValue.set('');
    this.optInValue.set(false);
    this.pixelConsentValue.set(false);
  }
}
