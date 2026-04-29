import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './services/seo.service';
import { CookieBannerComponent } from './components/cookie-banner/cookie-banner.component';
import { ContactPanelComponent } from './components/contact-panel/contact-panel.component';
import { CookieConsentService } from './services/cookie-consent.service';
import { MetaPixelService } from './services/meta-pixel.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CookieBannerComponent, ContactPanelComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'landing';

  private readonly seoService  = inject(SeoService);
  private readonly consent     = inject(CookieConsentService);
  private readonly metaPixel   = inject(MetaPixelService);

  constructor() {
    // Charge le Pixel Meta uniquement si le consentement publicitaire est accordé
    effect(() => {
      if (this.consent.advertisingConsent()) {
        this.metaPixel.loadPixel();
      }
    });
  }
}
