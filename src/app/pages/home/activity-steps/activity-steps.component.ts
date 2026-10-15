import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollRevealDirective } from '../../../directives/scroll-reveal.directive';
import { MetaPixelService } from '../../../services/meta-pixel.service';

@Component({
    selector: 'app-activity-steps',
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
      pill: 'Devis',
      title: 'Le devis\ncommun',
      desc: 'Vous faites le devis commun : chaque coéquipier y figure avec sa part.',
      theme: 'green'
    },
    {
      num: '02',
      pill: 'Client',
      title: 'Un seul\npaiement',
      desc: 'Le client accepte et paie une seule fois.',
      theme: 'dark'
    },
    {
      num: '03',
      pill: 'Facturation',
      title: 'Une facture\npour chacun',
      desc: 'Chacun reçoit sa facture, générée automatiquement.',
      theme: 'green'
    },
    {
      num: '04',
      pill: 'Paiement',
      title: 'Le paiement\nréparti',
      desc: "Le paiement est réparti : personne n'avance l'argent des autres.",
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
