import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FunnelService, SectorType} from "../../../../services/funnel.service";

@Component({
  selector: 'app-sector-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sector-step.component.html',
  styleUrl: './sector-step.component.scss'
})
export class SectorStepComponent {
  fs = inject(FunnelService);

  // Pour savoir quel bouton est survolé (null = aucun)
  hoveredSector = signal<SectorType | null>(null);

  /**
   * MAPPING DES IMAGES
   * Les images doivent être dans le dossier src/assets/tunnel/
   */
  imageMap: Record<string, string> = {
    DEFAULT: 'assets/images/tunnel/ACTIVITE.png',

    // Images spécifiques au survol
    SANTE: 'assets/images/tunnel/SANTE.png',
    SAP: 'assets/images/tunnel/SAP.png',
    BTP: 'assets/images/tunnel/BTP.png',
    CREATIF: 'assets/images/tunnel/COM.png',
    CONSEIL: 'assets/images/tunnel/FORMATION.png',
    IMMO: 'assets/images/tunnel/IMMOBILIER.png',
    AUTRE: 'assets/images/tunnel/AUTRES ACTIVITES.png',
  };

  // Image courante calculée dynamiquement
  currentImage = computed(() => {
    const sector = this.hoveredSector();
    if (sector && this.imageMap[sector]) {
      return this.imageMap[sector];
    }
    return this.imageMap['DEFAULT'];
  });

  select(sector: SectorType) {
    this.fs.setSector(sector);
  }

  onMouseEnter(sector: SectorType) {
    this.hoveredSector.set(sector);
  }

  onMouseLeave() {
    this.hoveredSector.set(null);
  }
}
