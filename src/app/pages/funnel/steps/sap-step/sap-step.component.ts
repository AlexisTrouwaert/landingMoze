import { Component, inject, signal } from '@angular/core';

import {FunnelService} from "../../../../services/funnel.service";
import { ConfirmDialogComponent } from "../../../../components/confirm-dialog/confirm-dialog.component";

@Component({
    selector: 'app-sap-step',
    imports: [ConfirmDialogComponent],
    templateUrl: './sap-step.component.html',
    styleUrl: './sap-step.component.scss'
})
export class SapStepComponent {
  fs = inject(FunnelService);

  /** Ouverture de la modale d'info sur le crédit d'impôt immédiat. */
  readonly showInfo = signal(false);

  selectOption(hasSap: boolean) {
    this.fs.setHasSapNumber(hasSap);
  }

  openInfo() {
    this.showInfo.set(true);
  }
}
