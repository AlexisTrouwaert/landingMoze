import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleSeriesContext, episodeLabel } from '../../model/series.model';
import { SeriesDoneIconComponent } from '../series-done-icon/series-done-icon.component';

/**
 * Le repère de série en tête d'un article : la série (lien vers sa page), le numéro de
 * l'épisode, et les flèches vers le précédent et le suivant déjà parus.
 */
@Component({
  selector: 'app-series-bar',
  imports: [RouterLink, SeriesDoneIconComponent],
  template: `
    @let s = series();
    <nav class="bar" [attr.aria-label]="'Série ' + s.title">
      <a class="bar__series" [routerLink]="['/blog/series', s.slug]">
        <span class="bar__mark" aria-hidden="true"></span>
        <span class="bar__name">{{ s.title }}</span>
        @if (s.complete) {
          <app-series-done-icon />
        }
      </a>
      <span class="bar__pos">{{ label() }}</span>
      <span class="bar__nav">
        @if (previous(); as prev) {
          <a class="bar__arrow" [routerLink]="['/blog', prev.slug]" [attr.aria-label]="'Épisode précédent : ' + prev.title" [title]="prev.title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </a>
        } @else {
          <span class="bar__arrow is-off" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </span>
        }
        @if (s.nextEpisode; as next) {
          <a class="bar__arrow" [routerLink]="['/blog', next.slug]" [attr.aria-label]="'Épisode suivant : ' + next.title" [title]="next.title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </a>
        } @else {
          <span class="bar__arrow is-off" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </span>
        }
      </span>
    </nav>
  `,
  styleUrl: './series-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesBarComponent {
  readonly series = input.required<ArticleSeriesContext>();
  /** Slug de l'article lu : situe l'épisode dans la liste. */
  readonly articleSlug = input.required<string>();

  readonly label = computed(() => episodeLabel(this.series().position, this.series().plannedCount));

  readonly previous = computed(() => {
    const episodes = this.series().episodes;
    const index = episodes.findIndex((e) => e.slug === this.articleSlug());
    return index > 0 ? episodes[index - 1] : null;
  });
}
