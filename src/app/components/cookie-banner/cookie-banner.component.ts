import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { CookieConsentService } from '../../services/cookie-consent.service';

const SLIDE_UP = trigger('slideUp', [
  transition(':enter', [
    style({ transform: 'translateY(24px)', opacity: 0 }),
    animate('320ms cubic-bezier(0.25, 1, 0.5, 1)',
      style({ transform: 'translateY(0)', opacity: 1 }))
  ]),
  transition(':leave', [
    animate('200ms cubic-bezier(0.4, 0, 0.6, 1)',
      style({ transform: 'translateY(16px)', opacity: 0 }))
  ])
]);

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-banner.component.html',
  styleUrl: './cookie-banner.component.scss',
  animations: [SLIDE_UP]
})
export class CookieBannerComponent {
  consent = inject(CookieConsentService);

  isMinimized        = signal(false);
  advertisingSelected = signal(false);

  minimize(): void { this.isMinimized.set(true);  }
  expand(): void   { this.isMinimized.set(false); }

  toggleAdvertising(): void {
    this.advertisingSelected.update(v => !v);
  }

  accept(): void {
    this.consent.acceptSelected(this.advertisingSelected());
  }
}
