import {Component, inject, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {FunnelService, FunnelType} from "../../services/funnel.service";
import {MetaPixelService} from "../../services/meta-pixel.service";
import {SectorStepComponent} from "./steps/sector-step/sector-step.component";
import {InterstitialStepComponent} from "./steps/interstitial-step/interstitial-step.component";
import {SapStepComponent} from "./steps/sap-step/sap-step.component";
import {RedirectStepComponent} from "./steps/redirect-step/redirect-step.component";
import {SphereStepComponent} from "./steps/sphere-step/sphere-step.component";
import {FunnelStepperComponent} from "./funnel-stepper/funnel-stepper.component";
import {FloatingDockComponent} from "../../components/floating-dock/floating-dock.component";

@Component({
  selector: 'app-funnel',
  standalone: true,
  imports: [
    SectorStepComponent,
    InterstitialStepComponent,
    SapStepComponent,
    RedirectStepComponent,
    SphereStepComponent,
    FunnelStepperComponent,
    FloatingDockComponent
  ],
  templateUrl: './funnel.component.html',
  styleUrl: './funnel.component.scss'
})
export class FunnelComponent implements OnInit {
  fs = inject(FunnelService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private readonly metaPixel = inject(MetaPixelService);

  ngOnInit(): void {
    // Le type de tunnel est porté par la route (data.funnelType) :
    // /commencer → 'facturation', /rejoindre → 'reseau'. Défaut sûr = facturation.
    const type = (this.route.snapshot.data['funnelType'] as FunnelType) ?? 'facturation';
    this.fs.startFunnel(type);

    // Entrée du funnel — fire au premier rendu (event distinct selon le funnel).
    this.metaPixel.trackFunnelStarted(type);
  }

  /** Petit délai avant de quitter le funnel : laisse partir le pixel d'abandon et adoucit la transition. */
  private readonly RETURN_HOME_DELAY_MS = 300;

  goHome() {
    // Clic logo dans le header funnel = abandon explicite.
    this.leaveFunnel('logo');
  }

  /**
   * Bouton "Retour" (présent à toutes les étapes).
   * - Step 1 : on quitte le funnel → retour accueil + abandon explicite.
   * - Sinon : simple recul d'une étape (navigation interne, pas un abandon).
   */
  back() {
    if (this.fs.currentStep() === 1) {
      this.leaveFunnel('back_button');
    } else {
      this.fs.previousStep();
    }
  }

  /** Sortie du funnel vers l'accueil : abandon tracké, puis navigation après un court délai. */
  private leaveFunnel(reason: 'logo' | 'back_button'): void {
    this.metaPixel.trackFunnelAbandoned(this.fs.currentStep(), reason, this.fs.funnelType());
    setTimeout(() => this.router.navigate(['/']), this.RETURN_HOME_DELAY_MS);
  }
}
