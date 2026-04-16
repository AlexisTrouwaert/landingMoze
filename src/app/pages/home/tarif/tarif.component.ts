import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tarif',
  standalone: true,
  imports: [],
  templateUrl: './tarif.component.html',
  styleUrl: './tarif.component.scss'
})
export class TarifComponent {
  private router = inject(Router);

  public offers = signal([
    {
      name: 'Indép +',
      subtitle: 'Idéal pour démarrer et facturer efficacement',
      price: '9,90€',
      priceSuffix: 'HT/mois',
      isPopular: false,
      features: [
        'Facturation électronique conforme',
        'Factures illimitées, seul ou à plusieurs',
        'Développement de votre réseau Moze',
        'Apport d\'affaires intégré',
        'Tableau de bord et suivi en temps réel'
      ],
      buttonText: "Je m'inscris"
    },
    {
      name: 'Coop',
      subtitle: 'Pour les prestataires SAP et les collaborations avancées',
      price: '+ 20€',
      priceSuffix: 'HT/mois',
      isPopular: true,
      features: [
        'Tout Indép + inclus',
        'Accès au numéro SAP sans exclusivité',
        'Cadre sécurisé et conforme',
        'Crédit d\'impôt immédiat (SAP)',
        'Développement d\'activité accéléré'
      ],
      buttonText: "Je m'inscris &rarr;"
    }
  ]);

  goToFunnel() {
    this.router.navigate(['/commencer']);
  }
}
