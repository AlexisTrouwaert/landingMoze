import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';

@Component({
  selector: 'app-tarif',
  standalone: true,
  imports: [ScrollRevealDirective],
  templateUrl: './tarif.component.html',
  styleUrl: './tarif.component.scss'
})
export class TarifComponent {
  private router = inject(Router);

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
      buttonText: "Je m'inscris &rarr;"
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
        'Avance immédiate SAP',
      ],
      buttonText: "Je m'inscris &rarr;"
    }
  ]);

  goToFunnel() {
    this.router.navigate(['/commencer']);
  }
}
