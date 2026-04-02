import { Component, signal } from '@angular/core';
import {avisData, typeAvis} from "../../../model/avis.model";

@Component({
  selector: 'app-customer-reviews',
  standalone: true,
  imports: [],
  templateUrl: './customer-reviews.component.html',
  styleUrl: './customer-reviews.component.scss'
})
export class CustomerReviewsComponent {
  public reviews = signal<typeAvis[]>(avisData);
}
