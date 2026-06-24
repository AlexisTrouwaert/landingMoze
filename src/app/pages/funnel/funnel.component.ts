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
  standalone: true,
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
    // Param de test → API de test (nico.by-moze.fr). Le flag est capturé au bootstrap
    // (main.ts) car Angular nettoie un param à clé vide (?=test) de l'URL avant ce point ;
    // filet sur l'URL au cas où le param a survécu (?test=1, ?env=test…).
    let isTest = false;
    try { isTest = sessionStorage.getItem('funnel-test-server') === '1'; } catch { /* noop */ }
    if (!isTest && typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      isTest = p.has('test') || p.get('') === 'test'
        || p.get('env') === 'test' || p.get('server') === 'test';
    }
    if (isTest) {
      this.fs.useTestServer(true);
      console.info('[Funnel] Serveur de test actif → nico.by-moze.fr');
    }
    // Entrée du funnel — fire au premier rendu de /commencer.
    this.metaPixel.trackFunnelStarted();
  }

  goHome() {
    // Clic logo dans le header funnel = abandon explicite.
    this.metaPixel.trackFunnelAbandoned(this.fs.currentStep(), 'logo');
    this.router.navigate(['/']);
  }
}
