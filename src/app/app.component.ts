import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './services/seo.service';
import { CookieBannerComponent } from './components/cookie-banner/cookie-banner.component';
import { ContactPanelComponent } from './components/contact-panel/contact-panel.component';
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

  private readonly seoService = inject(SeoService);
  // Instancié pour activer l'effect interne (chargement Pixel + PageView SPA + révocation)
  private readonly metaPixel  = inject(MetaPixelService);
}
