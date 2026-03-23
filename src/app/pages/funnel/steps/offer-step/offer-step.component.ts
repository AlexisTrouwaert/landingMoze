import {Component, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import {FunnelService} from "../../../../services/funnel.service";
import {Router} from "@angular/router";
import {MetaPixelService} from "../../../../services/meta-pixel.service";

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

  constructor() {
    this.metaPixelService.trackPurchase();
  }

  isCoop() {
    return this.fs.finalOfferPrice() > 10;
  }

  getOfferDescription(): string {
    if (this.isCoop()) {
      return "Tout est centralisé. Moins d'allers-retours. Plus de fluidité. Pas d'exclusivité.";
    }
    return "Simple. Clair. Sans engagement.";
  }

  register() {
    const user = this.fs.userInfo();

    if (!user?.email) {
      console.error("❌ Aucun email trouvé pour la souscription.");
      return;
    }

    this.isSubmittingOffer.set(true);
    const email = user.email;
    const origine = window.location.hostname;

    const request$ = this.isCoop()
      ? this.fs.subscribeCustom(email, this.fs.hasSapNumber() ?? false, true, origine)
      : this.fs.subscribePremium(email, origine);

    request$.subscribe({
      next: (response: any) => {
        this.isSubmittingOffer.set(false);
        window.location.href = response as string;
      },
      error: (err) => {
        this.isSubmittingOffer.set(false);
        console.error("❌ ERREUR lors de la souscription à l'offre :", err);
      }
    });
  }

  private redirectToApp() {
    this.isSubmittingOffer.set(false);
    // window.location.href = 'https://nico.by-moze.fr/connexion';
    window.location.href = 'https://app.mozeconnect.fr/connexion';
  }

  private handleError(err: any) {
    this.isSubmittingOffer.set(false);
    console.error("Erreur lors de la souscription à l'offre :", err);
  }
}
