import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Le petit insigne d'une série complète : tous les épisodes annoncés sont parus.
 *
 * Une icône plutôt qu'un libellé : il se lit d'un coup d'œil à côté du titre, sans ajouter une
 * ligne de texte de plus à la carte. Le mot reste là pour les lecteurs d'écran et au survol.
 */
@Component({
  selector: 'app-series-done-icon',
  template: `
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.8l2.4 1.75 2.97-.02.92 2.83 2.4 1.74-.92 2.83.92 2.83-2.4 1.74-.92 2.83-2.97-.02L12 22.2l-2.4-1.75-2.97.02-.92-2.83-2.4-1.74.92-2.83-.92-2.83 2.4-1.74.92-2.83 2.97.02z"
      />
      <path d="m8.2 12.2 2.6 2.6 5-5.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="sr-only">Série complète</span>
  `,
  host: { title: 'Série complète' },
  styles: `
    :host {
      display: inline-block;
      flex: 0 0 auto;
      width: 1.15em;
      height: 1.15em;
      margin-top: 0.08em;
      color: #35a06a;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesDoneIconComponent {}
