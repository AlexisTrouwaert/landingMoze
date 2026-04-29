import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FunnelService } from "../../../../services/funnel.service";
import { Router } from "@angular/router";
import { MetaPixelService } from "../../../../services/meta-pixel.service";
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-offer-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offer-step.component.html',
  styleUrl: './offer-step.component.scss'
})
export class OfferStepComponent {
  fs = inject(FunnelService);
  private router = inject(Router);
  private metaPixelService = inject(MetaPixelService);

  isSubmittingOffer = signal(false);

  readonly isCoop = computed(() => this.fs.finalOfferPrice() > 10);

  readonly offerDescription = computed(() =>
    this.isCoop()
      ? "Tout est centralisé. Moins d'allers-retours. Plus de fluidité. Pas d'exclusivité."
      : "Simple. Clair. Sans engagement."
  );

  async register() {
    const user = this.fs.userInfo();

    if (!user?.email) {
      console.error("❌ Aucun email trouvé pour la souscription.");
      return;
    }

    this.isSubmittingOffer.set(true);
    const email = user.email;
    const origine = window.location.hostname;

    if (window.location.hostname === 'localhost') {
      console.log('[DEV] Souscription ignorée sur localhost.');
      this.isSubmittingOffer.set(false);
      window.location.href = 'https://app.mozeconnect.fr/connexion';
      return;
    }

    const request$ = this.isCoop()
      ? this.fs.subscribeCustom(email, this.fs.hasSapNumber() ?? false, true, origine)
      : this.fs.subscribePremium(email, false, false, origine);

    try {
      const response = await firstValueFrom(request$);
      this.isSubmittingOffer.set(false);
      window.location.href = response as string;
    } catch (err) {
      this.handleError(err);
    }
  }

  private redirectToApp() {
    this.isSubmittingOffer.set(false);
    // window.location.href = 'https://nico.by-moze.fr/connexion';
    window.location.href = 'https://app.mozeconnect.fr/connexion';
  }

  private handleError(err: any) {
    this.isSubmittingOffer.set(false);
    console.error("❌ ERREUR lors de la souscription à l'offre :", err);
  }
}
