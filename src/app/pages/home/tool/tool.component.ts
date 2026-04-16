import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tool',
  standalone: true,
  imports: [],
  templateUrl: './tool.component.html',
  styleUrl: './tool.component.scss'
})
export class ToolComponent {
  private router = inject(Router);

  public features = signal([
    {
      t1: 'FACTURATION ILLIMITÉE',
      t2: 'ET CONFORME',
      desc: 'Créez et envoyez vos factures et devis professionnels en quelques secondes. Conformité totale avec la réforme facturation électronique 2026.',
      badge: 'INCLUS DANS TOUTES LES OFFRES'
    },
    {
      t1: 'FACTURATION',
      t2: 'COLLABORATIVE',
      desc: 'Unique sur le marché : collaborez sur un même projet avec d\'autres indépendants et co-facturez directement depuis Moze, sans bricoler et en toute légalité.',
      badge: 'EXCLUSIF MOZE'
    },
    {
      t1: 'AVANCE',
      t2: 'IMMÉDIATE SAP',
      desc: 'Vous êtes dans le service à la personne ? Moze Coop vous donne accès au numéro SAP sans exclusivité, avec gestion du crédit d\'impôt immédiat intégré.',
      badge: 'OFFRE COOP'
    },
    {
      t1: 'RÉSEAU SOCIAL',
      t2: 'D\'INDÉPENDANTS',
      desc: 'Échanges avec les autres Mozeurs, développez votre réseau professionnel en ligne et générez des opportunités business directement sur Moze.',
      badge: 'COMMUNAUTÉ ACTIVE'
    },
    {
      t1: 'APPORT',
      t2: 'D\'AFFAIRES INTÉGRÉ',
      desc: 'Augmente ton chiffre d\'affaires grâce à l\'apport d\'affaires directement sur Moze, répond à des offres ou propose à ton réseau des missions en échange d\'une commission.',
      badge: 'AUGMENTEZ VOS REVENUS'
    },
    {
      t1: 'SUIVI EN',
      t2: 'TEMPS RÉEL',
      desc: 'Consultez le statut de vos factures en temps réel jusqu\'à l\'encaissement. Tableau de bord clair, synthèse de vos revenus, aucune saisie manuelle.',
      badge: 'SIMPLE ET INTUITIF'
    }
  ]);

  goToFunnel() {
    this.router.navigate(['/commencer']);
  }
}
