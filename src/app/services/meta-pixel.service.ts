import { Injectable, isDevMode } from '@angular/core';

declare let fbq: any;

@Injectable({ providedIn: 'root' })
export class MetaPixelService {
  private loaded = false;
  private leadTracked        = false;
  private purchaseTracked    = false;
  private viewContentTracked = false;

  /** Injecte dynamiquement le Pixel Meta — à appeler uniquement après consentement publicitaire */
  loadPixel(): void {
    if (this.loaded || isDevMode()) return;

    const script = document.createElement('script');
    script.textContent = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','1613979959804319');
      fbq('set','autoConfig',false,'1613979959804319');
      fbq('track','PageView');
      fbq('set','agent','tm-google','1613979959804319');
    `;
    document.head.appendChild(script);
    this.loaded = true;
  }

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
    }
  }

  resetViewContent(): void {
    this.viewContentTracked = false;
  }
}
