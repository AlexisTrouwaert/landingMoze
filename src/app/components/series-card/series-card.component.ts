import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ShelfSeries,
  episodeShortLabel,
  formatEpisodeDate,
  totalReadingMinutes,
} from '../../model/series.model';
import { SeriesCoverComponent } from '../series-cover/series-cover.component';
import { SeriesDoneIconComponent } from '../series-done-icon/series-done-icon.component';

/**
 * Carte d'une série sur le rayon du blog.
 *
 * Elle dit chaque chose **une seule fois** : la pile des couvertures montre que c'est une suite,
 * les derniers épisodes disent de quoi elle parle, et le pied de carte ne donne que ce qu'on ne
 * voit pas ailleurs — la date du prochain épisode, ou la durée de lecture d'une série terminée.
 * Pas de compteur « 2 sur 3 publiés » : il répéterait les numéros déjà affichés.
 */
@Component({
  selector: 'app-series-card',
  imports: [RouterLink, SeriesCoverComponent, SeriesDoneIconComponent],
  templateUrl: './series-card.component.html',
  styleUrl: './series-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesCardComponent {
  readonly series = input.required<ShelfSeries>();

  /** Couvertures des épisodes parus, du plus récent au plus ancien. */
  readonly covers = computed(() =>
    [...this.series().episodes]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((e) => e.coverImageUrl),
  );

  /** Les deux derniers épisodes dans l'ordre de lecture : de quoi parle la série, concrètement. */
  readonly latest = computed(() =>
    this.series()
      .episodes.slice(-2)
      .map((e) => ({
        slug: e.slug,
        title: e.title,
        label: episodeShortLabel(e.position, this.series().plannedCount),
      })),
  );

  readonly foot = computed(() => {
    const s = this.series();
    const next = s.upcoming[0];
    if (next) {
      const when = formatEpisodeDate(next.publishedAt);
      return next.position ? `Épisode ${next.position} le ${when}` : `Prochain épisode le ${when}`;
    }
    if (s.plannedCount && s.episodes.length < s.plannedCount) return 'Suite en préparation';
    const count = s.episodes.length;
    return `${count} épisode${count > 1 ? 's' : ''} · ${totalReadingMinutes(s.episodes)} min de lecture`;
  });
}
