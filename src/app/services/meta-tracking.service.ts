import { Injectable, isDevMode } from '@angular/core';

declare let fbq: any;

@Injectable({
  providedIn: 'root'
})
export class MetaTrackingService {

  trackEvent(eventName: string, customEventName?: string, data: any = {}): void {
    if (typeof fbq === 'undefined') {
      if (isDevMode()) {
        console.warn('Le script Meta Pixel (fbq) est introuvable.');
      }
      return;
    }

    if (eventName === 'trackCustom' && customEventName) {
      fbq('trackCustom', customEventName, data);
    } else {
      fbq('track', eventName, data);
    }
  }
}
