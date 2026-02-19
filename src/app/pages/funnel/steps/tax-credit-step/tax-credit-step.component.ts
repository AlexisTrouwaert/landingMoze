import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FunnelService} from "../../../../services/funnel.service";

@Component({
  selector: 'app-tax-credit-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tax-credit-step.component.html',
  styleUrl: './tax-credit-step.component.scss'
})
export class TaxCreditStepComponent {
  fs = inject(FunnelService);

  selectOption(wantsCredit: boolean) {
    this.fs.setWantsTaxCredit(wantsCredit);
  }
}
