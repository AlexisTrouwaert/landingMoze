import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';
import { MetaPixelService } from '../../../services/meta-pixel.service';

@Component({
  selector: 'app-activity-steps',
  standalone: true,
  imports: [ScrollRevealDirective],
  templateUrl: './activity-steps.component.html',
  styleUrl: './activity-steps.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityStepsComponent {
  private router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);

  public steps = signal([
    {
      num: '01',
      pill: 'Facturation',
      title: 'Facture\ntes clients',
      desc: "Crée et envoie une facture conforme en moins de 20 secondes. Seul ou à plusieurs sur un même projet.",
      theme: 'green'
    },
    {
      num: '02',
      pill: 'Collaboration',
      title: 'Collabore\nlégalement',
      desc: "Partage un projet avec d'autres Mozeurs, co-facture simplement, en toute conformité légale.",
      theme: 'dark'
    },
    {
      num: '03',
      pill: 'Réseau',
      title: 'Connecte\nton réseau',
      desc: "Rejoins notre réseau social d'indépendants. Échange, recommande, et crée des opportunités business.",
      theme: 'green'
    },
    {
      num: '04',
      pill: 'Business',
      title: 'Augmente\ntes revenus',
      desc: "Utilise le système d'apport d'affaires directement dans l'outil. Recommande et encaisse des commissions.",
      theme: 'dark'
    }
  ]);

  /** Tilt 3D de la carte selon la position du curseur — bypass Angular CD pour fluidité maximale */
  onCardMouseMove(event: MouseEvent): void {
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cx = rect.width  / 2;
    const cy = rect.height / 2;

    const rotX = ((y - cy) / cy) * -5;
    const rotY = ((x - cx) / cx) *  5;

    card.style.transition = 'transform 0.08s linear, box-shadow 0.08s linear';
    card.style.transform  = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px)`;
  }

  /** Retour doux à la position neutre */
  onCardMouseLeave(event: MouseEvent): void {
    if (window.matchMedia('(hover: none)').matches) return;
    const card = event.currentTarget as HTMLElement;
    card.style.transition = 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.55s cubic-bezier(0.16, 1, 0.3, 1)';
    card.style.transform  = '';
  }

  goToFunnel(): void {
    this.metaPixel.trackLeadCTA('inscription_generic');
    this.router.navigate(['/commencer']);
  }
}
