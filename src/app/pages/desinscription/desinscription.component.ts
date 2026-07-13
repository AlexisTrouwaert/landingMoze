import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { FloatingDockComponent } from '../../components/floating-dock/floating-dock.component';

/**
 * Page de désinscription (Option A, zéro back-end).
 *
 * L'e-mail pointe vers `/desinscription?email={{ contact.EMAIL }}` (tag résolu par
 * Brevo, contrairement à `{{ unsubscribe }}` qui ne s'injecte pas dans un paramètre).
 * La page affiche toujours un bouton de validation ; au clic, on POST vers un
 * formulaire Brevo (comme le formulaire d'inscription, `mode: 'no-cors'`) qui
 * désabonne le contact (attribut `DESABONNE = Oui`, ou automation Brevo de
 * désinscription déclenchée par la soumission).
 */
@Component({
  selector: 'app-desinscription',
  standalone: true,
  imports: [FloatingDockComponent, RouterLink],
  templateUrl: './desinscription.component.html',
  styleUrl: './desinscription.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DesinscriptionComponent {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);

  /**
   * URL du formulaire Brevo « désinscription » (POST du contact avec DESABONNE=Oui).
   * TODO : remplacer par l'URL `https://xxxx.sibforms.com/serve/...` du form Brevo à créer.
   */
  private static readonly BREVO_DESINSCRIPTION_FORM_URL = 'https://c1020106.sibforms.com/serve/MUIFAIWEF94dsZgJUCjVJM1_4Sh3eIWZ2vvndkY-ugF3ZCvfGGIp7pQFR96puYQMXhXRDa9X4vNwCpdQGXrfReimNpv7xqBy1R6KHa7O0q3s0yw78MHP0Smqwe_xSGj38qffVLLoFacSrHgamOLLi2jRD_cWeYlNvLubJimb-OTcpqhqEppiKVWV-LK3INRHPdWgfgns8hnSzsRS';
  private static readonly ATTRIBUT_DESABONNE = 'DESABONNE';

  readonly email = signal<string | null>(null);
  readonly ready = signal<boolean>(false);
  readonly sending = signal<boolean>(false);
  readonly done = signal<boolean>(false);
  readonly error = signal<boolean>(false);

  constructor() {
    // Page utilitaire : on la sort de l'index des moteurs de recherche.
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    afterNextRender(() => {
      if (typeof window !== 'undefined') {
        const email = new URLSearchParams(window.location.search).get('email');
        this.email.set(email && email.includes('@') ? email : null);
      }
      this.ready.set(true);
    });
  }

  goHome(): void { this.router.navigate(['/']); }

  /** Validation utilisateur : POST vers le form Brevo qui désabonne le contact. */
  confirmUnsub(): void {
    const email = this.email();
    if (!email || this.sending() || typeof fetch === 'undefined') return;

    this.error.set(false);
    this.sending.set(true);

    const body = new URLSearchParams();
    body.append('EMAIL', email);
    body.append(DesinscriptionComponent.ATTRIBUT_DESABONNE, 'Oui');
    body.append('email_address_check', ''); // honeypot Brevo
    body.append('locale', 'fr');

    fetch(DesinscriptionComponent.BREVO_DESINSCRIPTION_FORM_URL, { method: 'POST', body, mode: 'no-cors' })
      .then(() => { this.sending.set(false); this.done.set(true); })
      .catch(() => { this.sending.set(false); this.error.set(true); });
  }
}
