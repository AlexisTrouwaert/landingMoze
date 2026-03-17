import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { MetaTrackingService } from '../../services/meta-tracking.service';

const REDIRECTION_MAP: Record<string, { event: string; url: string }> = {
  'devis': { event: 'ClicEmailBienvenue_Facture', url: 'https://app.mozeconnect.fr/devis/nouveau' },
  'profil': { event: 'ClicEmailBienvenue_Profil', url: 'https://app.mozeconnect.fr/mon-profil' },
  'dashboard': { event: 'ClicEmailBienvenue_Dashboard', url: 'https://app.mozeconnect.fr/dashboard' }
};

const DEFAULT_URL = 'https://app.mozeconnect.fr/dashboard';

@Component({
  selector: 'app-redirection',
  standalone: true,
  templateUrl: './redirection.component.html',
  styleUrl: './redirection.component.scss'
})
export class RedirectionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private metaTrackingService = inject(MetaTrackingService);
  private document = inject(DOCUMENT);

  ngOnInit(): void {
    const cible = this.route.snapshot.queryParamMap.get('cible') || '';
    const targetConfig = REDIRECTION_MAP[cible];

    if (targetConfig) {
      this.metaTrackingService.trackEvent('trackCustom', targetConfig.event);
      setTimeout(() => {
        this.document.location.href = targetConfig.url;
      }, 300);
    } else {
      setTimeout(() => {
        this.document.location.href = DEFAULT_URL;
      }, 300);
    }
  }
}
