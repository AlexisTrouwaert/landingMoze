import {Component, inject, OnInit} from '@angular/core';
import {Meta} from '@angular/platform-browser';
import {Router} from '@angular/router';
import {FunnelService} from "../../services/funnel.service";
import {MetaPixelService} from "../../services/meta-pixel.service";
import {BrevoService} from "../../services/brevo.service";
import {GoogleAnalyticsService} from "../../services/google-analytics.service";
import {SectorStepComponent} from "./steps/sector-step/sector-step.component";
import {InterstitialStepComponent} from "./steps/interstitial-step/interstitial-step.component";
import {SapStepComponent} from "./steps/sap-step/sap-step.component";
import {RedirectStepComponent} from "./steps/redirect-step/redirect-step.component";
import {FloatingDockComponent} from "../../components/floating-dock/floating-dock.component";
import {NAV_GROUPS} from "../../config/nav-groups";
import {ContactPanelService} from "../../services/contact-panel.service";
import {SeoService, SOCIAL_IMAGE_ALT} from "../../services/seo.service";

@Component({
    selector: 'app-funnel',
    imports: [
        FloatingDockComponent,
        SectorStepComponent,
        InterstitialStepComponent,
        SapStepComponent,
        RedirectStepComponent
    ],
    templateUrl: './funnel.component.html',
    styleUrl: './funnel.component.scss'
})
export class FunnelComponent implements OnInit {
  fs = inject(FunnelService);
  private router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly seo = inject(SeoService);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly brevo = inject(BrevoService);
  private readonly ga = inject(GoogleAnalyticsService);
  private readonly contactPanel = inject(ContactPanelService);

  /** Navigation du dock (source partagée — uniformisée avec l'accueil et le blog). */
  readonly navGroups = NAV_GROUPS;

  /** Action d'un lien du dock (ex. « Support » → panneau de contact). */
  onDockAction(action: string): void {
    if (action === 'support') this.contactPanel.open();
  }

  ngOnInit(): void {
    // Description propre à la page : sans elle, `/commencer` reprenait mot pour mot celle de
    // l'accueil figée dans `index.html` — même titre, même description, deux URL : le signal de
    // duplication que Google pénalise, sur la page qui porte l'inscription.
    const description =
      "Créez votre compte Moze en quelques minutes : facturation collaborative, " +
      "facturation électronique (Factur-X) et mise en réseau entre indépendants. Inscription gratuite.";

    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: 'Commencer gratuitement – Moze' });
    this.meta.updateTag({ property: 'og:description', content: description });
    // Vignette de partage : sans elle, le lien d'inscription partagé sur LinkedIn arrivait sans
    // image, donc en carte minuscule.
    this.seo.setSocialImage(SeoService.DEFAULT_SOCIAL_IMAGE, SOCIAL_IMAGE_ALT);

    // Entrée du funnel — fire au premier rendu de /commencer.
    this.metaPixel.trackFunnelStarted();
    this.brevo.trackFunnelStarted();
    this.ga.trackFunnelStarted();
  }

  goHome() {
    // Clic logo dans le header funnel = abandon explicite.
    this.metaPixel.trackFunnelAbandoned(this.fs.currentStep(), 'logo');
    this.brevo.trackFunnelAbandoned(this.fs.currentStep(), 'logo');
    this.ga.trackFunnelAbandoned(this.fs.currentStep(), 'logo');
    this.router.navigate(['/']);
  }
}
