import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FunnelService } from '../../../services/funnel.service';

/**
 * Fil d'Ariane (stepper) du tunnel d'inscription.
 * Lit directement le FunnelService — s'adapte donc au type de funnel :
 *  - 'facturation' : 4 étapes (accent vert)
 *  - 'reseau'      : 3 étapes (accent bleu / --interaction-color)
 * Responsive : libellés sous chaque pastille en desktop, légende compacte
 * "Étape X sur Y" en mobile.
 */
@Component({
  selector: 'app-funnel-stepper',
  standalone: true,
  imports: [],
  templateUrl: './funnel-stepper.component.html',
  styleUrl: './funnel-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FunnelStepperComponent {
  private readonly fs = inject(FunnelService);

  readonly current = this.fs.currentStep;
  readonly maxStep = this.fs.maxStep;
  readonly isReseau = computed(() => this.fs.funnelType() === 'reseau');

  readonly steps = computed<string[]>(() =>
    this.isReseau()
      ? ['Secteur', 'Sphères', 'Inscription', 'C\'est parti']
      : ['Secteur', 'Crédit d\'impôt', 'Inscription', 'C\'est parti']
  );

  /** Étape courante bornée au nombre d'étapes (sécurité d'affichage). */
  readonly displayStep = computed(() =>
    Math.min(Math.max(this.current(), 1), this.steps().length)
  );

  readonly currentLabel = computed(() => this.steps()[this.displayStep() - 1]);

  /** Navigation vers l'étape cliquée (index 0-based). Bloquée par le service si non atteinte. */
  goTo(stepIndex: number): void {
    this.fs.goToStep(stepIndex + 1);
  }
}
