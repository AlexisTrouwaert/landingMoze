import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ContactPanelService } from '../../../services/contact-panel.service';
import { CookieConsentService } from '../../../services/cookie-consent.service';

@Component({
    selector: 'app-footer',
    imports: [],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FooterComponent {

  /** Retire le fond bleu foncé du footer (ex. sur le blog). */
  readonly flat = input(false);

  private router = inject(Router);
  contactPanel  = inject(ContactPanelService);
  cookieConsent = inject(CookieConsentService);

  blog(){
    this.router.navigate(['/blog']);
  }

  cgv(){
    this.router.navigate(['/cgv-cgu']);
  }

  confidentialite(){
    this.router.navigate(['/politique-confidentialite']);
  }

  mention(){
    this.router.navigate(['/mentions-legales']);
  }

  auto(){
    window.open('https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html', '_blank');
  }
}
