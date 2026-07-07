import {Component, inject, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {FunnelService} from "../../services/funnel.service";
import {MetaPixelService} from "../../services/meta-pixel.service";
import {SectorStepComponent} from "./steps/sector-step/sector-step.component";
import {InterstitialStepComponent} from "./steps/interstitial-step/interstitial-step.component";
import {SapStepComponent} from "./steps/sap-step/sap-step.component";
import {RedirectStepComponent} from "./steps/redirect-step/redirect-step.component";

@Component({
    selector: 'app-funnel',
    imports: [
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
  private readonly metaPixel = inject(MetaPixelService);

  ngOnInit(): void {
    // Entrée du funnel — fire au premier rendu de /commencer.
    this.metaPixel.trackFunnelStarted();
  }

  goHome() {
    // Clic logo dans le header funnel = abandon explicite.
    this.metaPixel.trackFunnelAbandoned(this.fs.currentStep(), 'logo');
    this.router.navigate(['/']);
  }
}
