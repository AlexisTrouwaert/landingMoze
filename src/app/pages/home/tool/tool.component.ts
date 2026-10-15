import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';
import { MetaPixelService } from '../../../services/meta-pixel.service';

@Component({
    selector: 'app-tool',
    imports: [ScrollRevealDirective, RouterLink],
    templateUrl: './tool.component.html',
    styleUrl: './tool.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolComponent {
  private router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);

  public features = signal([
    {
      t1: 'FACTURER',
      t2: 'À PLUSIEURS',
      desc: 'Une mission, plusieurs indépendants : un seul devis pour le client, une facture pour chacun, un paiement réparti automatiquement.',
      badge: 'UN DEVIS COMMUN'
    },
    {
      t1: 'APPORT',
      t2: 'D\'AFFAIRES',
      desc: 'Un client vous demande un travail que vous ne faites pas ? Transmettez-le à un confrère de confiance. Votre commission est facturée et payée automatiquement quand le client règle.',
      badge: 'TOUCHEZ UNE COMMISSION',
      route: '/apport-d-affaires'
    },
    {
      t1: 'SERVICES À LA PERSONNE :',
      t2: 'VOS CLIENTS NE PAIENT QUE LA MOITIÉ',
      desc: 'Ménage, jardinage, petit bricolage : grâce à notre coopérative, vos clients profitent du crédit d\'impôt et de l\'avance immédiate, même si vous n\'avez pas d\'agrément.',
      badge: 'OPTION COOPÉRATIVE'
    },
    {
      t1: 'DEVIS ET FACTURES',
      t2: 'ILLIMITÉS',
      desc: 'Créez vos devis et factures en quelques minutes, au format de la facture électronique obligatoire en 2027.',
      badge: 'INCLUS DANS INDÉP +'
    },
    {
      t1: 'UN RÉSEAU',
      t2: 'D\'INDÉPENDANTS',
      desc: 'Échangez avec d\'autres indépendants, trouvez des partenaires de confiance et recommandez-vous les uns les autres.',
      badge: 'GRATUIT'
    },
    {
      t1: 'SUIVI JUSQU\'AU',
      t2: 'PAIEMENT',
      desc: 'Suivez chaque facture jusqu\'à l\'encaissement. Un tableau de bord clair, aucune saisie manuelle.',
      badge: 'SIMPLE'
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
    this.metaPixel.trackLeadCTA('inscription_generic');
    this.router.navigate(['/commencer']);
  }
}
