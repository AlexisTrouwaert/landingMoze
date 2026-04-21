import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-activity-steps',
  standalone: true,
  imports: [],
  templateUrl: './activity-steps.component.html',
  styleUrl: './activity-steps.component.scss'
})
export class ActivityStepsComponent {
  private router = inject(Router);

  public steps = signal([
    {
      num: '01',
      pill: 'Facturation',
      title: 'Facture\ntes clients',
      desc: 'Crée et envoie une facture conforme en moins de 20 secondes. Seul ou à plusieurs sur un même projet.',
      theme: 'green'
    },
    {
      num: '02',
      pill: 'Collaboration',
      title: 'Collabore\nlégalement',
      desc: 'Partage un projet avec d’autres Mozeurs, co-facture simplement, en toute conformité légale.',
      theme: 'dark'
    },
    {
      num: '03',
      pill: 'Réseau',
      title: 'Connecte\nton réseau',
      desc: 'Rejoins notre réseau social d’indépendants. Échange, recommande, et crée des opportunités business.',
      theme: 'green'
    },
    {
      num: '04',
      pill: 'Business',
      title: 'Augmente\ntes revenus',
      desc: 'Utilise le système d’apport d’affaires directement dans l’outil. Recommande et encaisse des commissions.',
      theme: 'dark'
    }
  ]);

  goToFunnel() {
    this.router.navigate(['/commencer']);
  }
}
