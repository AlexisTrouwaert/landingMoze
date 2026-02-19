import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FunnelService} from "../../../../services/funnel.service";

@Component({
  selector: 'app-sap-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sap-step.component.html',
  styleUrl: './sap-step.component.scss'
})
export class SapStepComponent {
  fs = inject(FunnelService);

  selectOption(hasSap: boolean) {
    this.fs.setHasSapNumber(hasSap);
  }

  openInfo() {
    alert("Le crédit d'impôt immédiat permet à vos clients particuliers de ne payer que 50% de la facture instantanément.");
  }
}
