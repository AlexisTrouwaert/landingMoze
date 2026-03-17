import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MetaTrackingService } from '../../services/meta-tracking.service';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss'
})
export class ConfirmationComponent implements OnInit {
  private metaTrackingService = inject(MetaTrackingService);

  ngOnInit(): void {
    this.metaTrackingService.trackEvent('Purchase');
  }
}
