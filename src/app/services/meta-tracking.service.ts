import { Injectable, isDevMode } from '@angular/core';

declare let fbq: any;

@Injectable({
  providedIn: 'root'
})
export class MetaTrackingService {

  trackEvent(eventName: string, customEventName?: string | null, data: any = {}, eventId?: string | null): void {
    if (typeof fbq === 'undefined') {
      if (isDevMode()) {
        console.warn('Le script Meta Pixel (fbq) est introuvable.');
      }
      return;
    }

    const options = eventId ? { eventID: eventId } : undefined;

    if (eventName === 'trackCustom' && customEventName) {
      options
        ? fbq('trackCustom', customEventName, data, options)
        : fbq('trackCustom', customEventName, data);
    } else {
      options
        ? fbq('track', eventName, data, options)
        : fbq('track', eventName, data);
    }
  }
}
