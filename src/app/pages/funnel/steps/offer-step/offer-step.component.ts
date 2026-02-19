import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FunnelService} from "../../../../services/funnel.service";
import {Router} from "@angular/router";

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
    // window.location.href = 'https://app.mozeconnect.fr/connexion';
    window.location.href = 'https://nico.by-moze.fr/connexion';
  }
}
