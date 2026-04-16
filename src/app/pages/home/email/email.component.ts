import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-email',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email.component.html',
  styleUrl: './email.component.scss'
})
export class EmailComponent {
  private router = inject(Router);
  private readonly MAX_ATTEMPTS = 5;

  emailValue = signal<string>('');
  optInValue = signal<boolean>(false);
  honeypotValue = signal<string>(''); // Notre Honeypot Angular

  status = signal<'IDLE' | 'SUCCESS' | 'ERROR' | 'LOADING'>('IDLE');
  isShaking = signal<boolean>(false);
  emailError = signal<boolean>(false);
  optInError = signal<boolean>(false);

  goToFunnel(): void {
    this.router.navigate(['/commencer']);
  }

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

    // 2. Sécurité : Rate Limiting & Honeypot local
    const isBanned = localStorage.getItem('isBanned') === 'true';
    if (isBanned || this.honeypotValue()) {
      if (this.honeypotValue()) localStorage.setItem('isBanned', 'true');
      this.triggerSuccess();
      return;
    }

    let attempts = parseInt(localStorage.getItem('submissionCount') || '0', 10);
    if (attempts >= this.MAX_ATTEMPTS) {
      localStorage.setItem('isBanned', 'true');
      this.status.set('ERROR');
      this.triggerShake();
      return;
    }

    // 3. Envoi via Fetch
    this.status.set('LOADING');
    localStorage.setItem('submissionCount', (attempts + 1).toString());

    const bodyParams = new URLSearchParams();
    bodyParams.append('EMAIL', this.emailValue());
    bodyParams.append('OPT_IN', '1');
    bodyParams.append('email_address_check', '');
    bodyParams.append('locale', 'fr');

    const brevoUrl = 'https://c1020106.sibforms.com/serve/MUIFAPCu8l9auir9gfCkLC5J0P0Mxj8KhfZ67iKAc2LnMz7BXxGM_c_jsIyHtnsNJBq6CJ8ZdY2El0-p6nEhayeC1hFc7uRilk0KUJVj3l_l7WBFdoyNKlJbYaux9c2MEM6-RkODXtF3QKfKEj4uVIZB-7PjNvHorEYZUetyaJGlRyjlX0pxWj82chrO3PbomQVHxEZk6PA2wBY6';

    fetch(brevoUrl, {
      method: 'POST',
      body: bodyParams,
      mode: 'no-cors'
    }).then(() => {
      this.triggerSuccess();
    }).catch((error) => {
      console.error("Erreur réseau :", error);
      this.triggerShake();
      this.status.set('IDLE');
    });
  }

  private triggerShake() {
    this.isShaking.set(true);
    setTimeout(() => this.isShaking.set(false), 500);
  }

  private triggerSuccess() {
    this.status.set('SUCCESS');
    this.emailValue.set('');
    this.optInValue.set(false);
  }
}
