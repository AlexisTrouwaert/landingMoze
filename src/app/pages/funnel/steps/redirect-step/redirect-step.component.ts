import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetaPixelService } from '../../../../services/meta-pixel.service';
import { FunnelService } from '../../../../services/funnel.service';

@Component({
  selector: 'app-redirect-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './redirect-step.component.html',
  styleUrl: './redirect-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RedirectStepComponent {
  private readonly metaPixel = inject(MetaPixelService);
  readonly fs = inject(FunnelService);

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
    // Funnel réseau : si une sphère a été choisie, son lien d'invitation est la destination.
    // Tant que le lien est un placeholder ('#') ou absent, on retombe sur MozePlace générique.
    const invite = this.fs.selectedSphere()?.inviteLink;
    const url = invite && invite !== '#'
      ? invite
      : 'https://place.mozeconnect.fr/authentification';
    this.redirectWithTracking('mozeplace', url);
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
    this.metaPixel.trackFunnelDestination(destination, this.fs.funnelType(), go);
  }
}
