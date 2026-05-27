import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';
import { MetaPixelService } from '../../../services/meta-pixel.service';

@Component({
  selector: 'app-tarif',
  standalone: true,
  imports: [ScrollRevealDirective],
  templateUrl: './tarif.component.html',
  styleUrl: './tarif.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TarifComponent {
  private router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);

  public offers = signal([
    {
      name: 'Freemium',
      subtitle: 'L\'essentiel pour démarrer et facturer efficacement',
      pricePrefix: '',
      price: '0€',
      priceSuffix: '/mois',
      isPopular: false,
      features: [
        'Facturation électronique conforme',
        'Factures illimitées, seul',
        'Développement de ton réseau Moze',
        'Tableau de bord et suivi en temps réel'
      ],
      buttonText: "Je m'inscris &rarr;",
      trackingLabel: 'inscription_freemium'
    },
    {
      name: 'Indép +',
      subtitle: 'Pour aller plus loin et développer ton activité',
      pricePrefix: 'À partir de ',
      price: '9,90€',
      priceSuffix: 'HT/mois',
      isPopular: true,
      features: [
        'Freemium',
        'Apport d\'affaires intégré',
        'Factures collaboratives',
        'Accès à l\'avance immédiate SAP',
      ],
      buttonText: "Je m'inscris &rarr;",
      trackingLabel: 'inscription_indep_plus'
    }
  ]);

  goToFunnel(buttonLabel: string = 'inscription_generic') {
    this.metaPixel.trackLeadCTA(buttonLabel);
    this.router.navigate(['/commencer']);
  }
}
