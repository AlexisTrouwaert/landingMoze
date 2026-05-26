import {Component, inject} from '@angular/core';
import {Router} from '@angular/router';
import {FunnelService} from "../../services/funnel.service";
import {SectorStepComponent} from "./steps/sector-step/sector-step.component";
import {InterstitialStepComponent} from "./steps/interstitial-step/interstitial-step.component";
import {SapStepComponent} from "./steps/sap-step/sap-step.component";

@Component({
  selector: 'app-funnel',
  standalone: true,
  imports: [
    SectorStepComponent,
    InterstitialStepComponent,
    SapStepComponent
  ],
  templateUrl: './funnel.component.html',
  styleUrl: './funnel.component.scss'
})
export class FunnelComponent {
  fs = inject(FunnelService);
  private router = inject(Router);

  goHome() {
    this.router.navigate(['/']);
  }
}
