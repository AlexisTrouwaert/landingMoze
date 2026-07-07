import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { MetaPixelService } from '../../../../services/meta-pixel.service';

@Component({
    selector: 'app-redirect-step',
    imports: [],
    templateUrl: './redirect-step.component.html',
    styleUrl: './redirect-step.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RedirectStepComponent {
  private readonly metaPixel = inject(MetaPixelService);

  isConfirmed = signal(false);

  toggleConfirmation(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.isConfirmed.set(input.checked);
  }

  goToConnexion(): void {
    if (!this.isConfirmed()) return;
    this.redirectWithTracking('mozeconnect', 'https://app.mozeconnect.fr/connexion');
  }

  goToPlace(): void {
    if (!this.isConfirmed()) return;
    this.redirectWithTracking('mozeplace', 'https://place.mozeconnect.fr/authentification');
  }

  /**
   * Envoie l'event de destination puis redirige UNE seule fois, dès que Meta
   * confirme l'envoi (eventCallback). Filet de sécurité : navigue au plus tard
   * après 1s si le callback ne se déclenche pas (pixel bloqué, refus cookies…).
   */
  private redirectWithTracking(
    destination: 'mozeconnect' | 'mozeplace',
    url: string
  ): void {
    let navigated = false;
    const go = (): void => {
      if (navigated) return;
      navigated = true;
      window.location.href = url;
    };

    setTimeout(go, 1000);
    this.metaPixel.trackFunnelDestination(destination, go);
  }
}
