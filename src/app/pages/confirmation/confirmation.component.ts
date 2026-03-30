import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');

    this.metaTrackingService.trackEvent(
      'Purchase',
      null,
      {},
      sessionId
    );
  }
}
