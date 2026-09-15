import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReviewNotifierService } from '../../services/review-notifier.service';

/**
 * Bandeau d'arrivée de brouillons rédigés par l'assistant.
 *
 * Posé une seule fois à la racine de l'application plutôt que dans chaque page d'admin :
 * l'arrivée peut survenir pendant qu'on édite un article, et un bandeau qui ne s'afficherait
 * que sur la liste manquerait justement le moment où l'on est occupé ailleurs.
 *
 * Ne rend rien tant que rien n'est arrivé — sur le site public, il n'existe pas.
 */
@Component({
  selector: 'app-review-notice',
  imports: [RouterLink],
  templateUrl: './review-notice.component.html',
  styleUrl: './review-notice.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewNoticeComponent {
  private readonly notifier = inject(ReviewNotifierService);

  readonly arrived = this.notifier.arrived;
  readonly canAsk = this.notifier.canAsk;

  dismiss(): void {
    this.notifier.acknowledge();
  }

  async enableSystem(): Promise<void> {
    await this.notifier.askPermission();
  }
}
