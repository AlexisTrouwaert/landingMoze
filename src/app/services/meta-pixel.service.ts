import { Injectable } from '@angular/core';

// Déclaration de la fonction fbq pour éviter les erreurs TypeScript
declare let fbq: any;

@Injectable({
  providedIn: 'root'
})
export class MetaPixelService {
  private leadTracked = false;
  private purchaseTracked = false;

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
    const win = window as any;
    if (typeof win !== 'undefined' && win.fbq) {
      win.fbq('track', 'ViewContent');
    } else {
      console.warn('Meta Pixel non chargé ou bloqué par un bloqueur de publicités.');
    }
  }
}
