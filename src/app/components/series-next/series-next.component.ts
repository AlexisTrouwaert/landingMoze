import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArticleSeriesContext,
  formatEpisodeDate,
} from '../../model/series.model';
import { NewsletterFormComponent } from '../newsletter-form/newsletter-form.component';

/**
 * La fin d'un épisode : ce qui vient après, dans la série.
 *
 * - l'épisode suivant est paru : une carte qui y mène ;
 * - il est programmé : sa date, et de quoi le recevoir par e-mail ;
 * - la série est complète et c'était le dernier : on le dit, avec un retour à la série ;
 * - rien n'est encore prévu : la suite « en préparation », et la même inscription.
 */
@Component({
  selector: 'app-series-next',
  imports: [RouterLink, NewsletterFormComponent],
  templateUrl: './series-next.component.html',
  styleUrl: './series-next.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesNextComponent {
  readonly series = input.required<ArticleSeriesContext>();

  readonly upcomingDate = computed(() => {
    const upcoming = this.series().nextUpcoming;
    return upcoming ? formatEpisodeDate(upcoming.publishedAt) : null;
  });
}
