import { inject, Injectable } from '@angular/core';
import { MetaPixelService } from './meta-pixel.service';

/**
 * Navigation interne de la landing.
 * Centralise le défilement vers la section tarifs (`app-tarif`), cible commune
 * de tous les CTA "ancre" de la page d'accueil (header, hero, outils, e-mail…).
 */
@Injectable({ providedIn: 'root' })
export class LandingNavService {
  private readonly metaPixel = inject(MetaPixelService);

  /**
   * Fait défiler la page jusqu'à la section tarifs et trace l'intention de
   * consulter les offres (event custom Meta 'ViewOffers'), différenciée par la
   * `source` du CTA cliqué.
   *
   * @param source identifiant du CTA d'origine (ex. 'header', 'hero', 'tool').
   */
  scrollToOffers(source?: string): void {
    this.metaPixel.trackCustomEvent('ViewOffers', source ? { source } : {});
    document.querySelector('app-tarif')?.scrollIntoView({ behavior: 'smooth' });
  }
}
