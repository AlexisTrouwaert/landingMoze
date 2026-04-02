import {Injectable, isDevMode} from '@angular/core';

// Déclaration de la fonction fbq pour éviter les erreurs TypeScript
declare let fbq: any;

@Injectable({
  providedIn: 'root'
})
export class MetaPixelService {
  private leadTracked = false;
  private purchaseTracked = false;
  private viewContentTracked = false;

  trackLead(): void {
    if (!this.leadTracked && typeof fbq !== 'undefined') {
      fbq('track', 'Lead');
      this.leadTracked = true;
    }
  }

  trackPurchase(): void {
    if (!this.purchaseTracked && typeof fbq !== 'undefined') {
      fbq('track', 'Purchase');
      this.purchaseTracked = true;
    }
  }

  trackViewContent(): void {
    if (this.viewContentTracked) return;

    if (typeof fbq !== 'undefined') {
      fbq('track', 'ViewContent');
      this.viewContentTracked = true;
    } else {
      if (isDevMode()) {
        console.warn('Meta Pixel (fbq) introuvable.');
      }
    }
  }

  /**
   * Optionnel : reset le flag si tu as besoin de re-tracker
   * lors d'une navigation spécifique sans recharger la page
   */
  resetViewContent(): void {
    this.viewContentTracked = false;
  }
}
