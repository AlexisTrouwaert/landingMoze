import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Couverture d'une série : une pile de trois cartes — la série se voit comme une suite avant
 * même d'être lue.
 *
 * **Devant, l'image de tête de la série** quand elle en a une : c'est le visuel choisi pour
 * elle, celui qui doit accrocher l'œil sur le rayon. Derrière, les épisodes les plus récents.
 * Sans image de tête, le dernier épisode reprend la place de devant.
 *
 * La pile ne montre que des images : un épisode sans couverture est sauté plutôt que de
 * creuser un aplat au milieu des autres. Les calques restés vides gardent leur aplat clair,
 * de sorte qu'une série sans aucune image garde la forme d'une pile.
 */
@Component({
  selector: 'app-series-cover',
  template: `
    <span class="layer layer--back" [class.layer--img]="!!back()">
      @if (back(); as src) {
        <img [src]="src" alt="" loading="lazy" />
      }
    </span>
    <span class="layer layer--mid" [class.layer--img]="!!mid()">
      @if (mid(); as src) {
        <img [src]="src" alt="" loading="lazy" />
      }
    </span>
    <span class="layer layer--front" [class.layer--img]="!!front()">
      @if (front(); as src) {
        <img [src]="src" alt="" [attr.loading]="eager() ? null : 'lazy'" />
      }
    </span>
    @if (fresh()) {
      <span class="fresh">Nouvel épisode</span>
    }
  `,
  styleUrl: './series-cover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesCoverComponent {
  /** Images des épisodes parus, du plus récent au plus ancien. `null` = épisode sans image. */
  readonly covers = input.required<readonly (string | null)[]>();
  /** Image de tête de la série. Elle passe devant les couvertures d'épisodes. */
  readonly head = input<string | null>(null);
  /** Pastille « Nouvel épisode ». */
  readonly fresh = input(false);
  /** Image de devant chargée d'emblée : la couverture de la page d'une série est au-dessus du pli. */
  readonly eager = input(false);

  /**
   * Les trois images de la pile, dans l'ordre d'empilement. L'image de tête d'abord, les
   * couvertures d'épisodes ensuite, les manquantes écartées — au-delà de trois, le reste ne
   * se verrait pas.
   */
  private readonly pile = computed(() =>
    [this.head(), ...this.covers()].filter((src): src is string => !!src).slice(0, 3),
  );

  readonly front = computed(() => this.pile()[0] ?? null);
  readonly mid = computed(() => this.pile()[1] ?? null);
  readonly back = computed(() => this.pile()[2] ?? null);
}
