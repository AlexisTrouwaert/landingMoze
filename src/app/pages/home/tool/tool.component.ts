import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';

@Component({
  selector: 'app-tool',
  standalone: true,
  imports: [ScrollRevealDirective],
  templateUrl: './tool.component.html',
  styleUrl: './tool.component.scss'
})
export class ToolComponent {
  private router = inject(Router);

  public features = signal([
    {
      t1: 'FACTURATION',
      t2: 'COLLABORATIVE',
      desc: 'Unique en France : collabore sur un même projet avec d\'autres indépendants et co-facture directement depuis Moze, simplement et en toute légalité.',
      badge: 'EXCLUSIF MOZE'
    },
    {
      t1: 'RÉSEAU SOCIAL',
      t2: 'D\'INDÉPENDANTS',
      desc: 'Échange avec les autres Mozeurs, développe ton réseau professionnel en ligne et génère des opportunités business directement sur Moze.',
      badge: 'COMMUNAUTÉ ACTIVE'
    },
    {
      t1: 'APPORT',
      t2: 'D\'AFFAIRES INTÉGRÉ',
      desc: 'Augmente ton chiffre d\'affaires grâce à l\'apport d\'affaires directement dans Moze, réponds à des offres ou propose à ton réseau des missions en échange d\'une commission.',
      badge: 'AUGMENTE TES REVENUS'
    },
    {
      t1: 'SUIVI EN',
      t2: 'TEMPS RÉEL',
      desc: 'Consulte le statut de tes factures en temps réel jusqu\'à l\'encaissement. Tableau de bord clair, synthèse de tes revenus, aucune saisie manuelle.',
      badge: 'SIMPLE ET INTUITIF'
    }
  ]);

  /** Spotlight border — position relative à la carte courante */
  onCardMouseMove(event: MouseEvent): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = event.currentTarget as HTMLElement;
    const rect  = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    card.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }

  onCardMouseLeave(event: MouseEvent): void {
    const card = event.currentTarget as HTMLElement;
    card.style.setProperty('--mx', '-9999px');
    card.style.setProperty('--my', '-9999px');
  }

  goToFunnel() {
    this.router.navigate(['/commencer']);
  }
}
