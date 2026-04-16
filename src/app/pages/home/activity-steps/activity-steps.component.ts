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
      title: 'Facturez\nvos clients',
      desc: 'Créez et envoyez une facture conforme en moins de 20 secondes. Seul ou à plusieurs sur un même projet.',
      theme: 'green'
    },
    {
      num: '02',
      pill: 'Collaboration',
      title: 'Collaborez\nlégalement',
      desc: 'Partagez un projet avec d’autres Mazers, co-facturez sans bricoler, en toute conformité légale.',
      theme: 'dark'
    },
    {
      num: '03',
      pill: 'Réseau',
      title: 'Connectez\nvotre réseau',
      desc: 'Rejoignez notre réseau social d’indépendants. Échangez, recommandez, et créez des opportunités business.',
      theme: 'green'
    },
    {
      num: '04',
      pill: 'Business',
      title: 'Augmentez\nvos revenus',
      desc: 'Utilisez le système d’apport d’affaires directement dans l’outil. Recommandez et encaissez des commissions.',
      theme: 'dark'
    }
  ]);

  goToFunnel() {
    this.router.navigate(['/commencer']);
  }
}
