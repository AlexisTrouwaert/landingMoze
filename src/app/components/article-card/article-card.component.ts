import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleListItem, Tag } from '../../model/article.model';

/**
 * Carte de présentation d'un article (liste publique + aperçu admin).
 *
 * Navigation en lien étiré : le titre porte le lien et son pseudo-élément couvre
 * la carte. Ce choix (plutôt qu'un `<a>` englobant côté parent) permet de poser
 * le tag en bouton de filtre par-dessus, sans l'imbrication interdite d'un
 * bouton dans un lien.
 */
@Component({
    selector: 'app-article-card',
    imports: [DatePipe, RouterLink],
    templateUrl: './article-card.component.html',
    styleUrl: './article-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticleCardComponent {
  readonly article = input.required<ArticleListItem>();

  /** Cible de navigation. `null` → carte non cliquable (aperçu de l'éditeur). */
  readonly link = input<string[] | null>(null);

  /**
   * Le tag mis en avant est un filtre cliquable (grille du blog) plutôt qu'une
   * simple étiquette (aperçu). Le parent gère l'action via `tagSelect`.
   */
  readonly interactiveTag = input(false);

  /** Émis au clic sur le tag quand il est interactif. */
  readonly tagSelect = output<Tag>();

  onTagSelect(tag: Tag, event: Event): void {
    // Empêche le lien étiré de se déclencher en même temps que le filtre.
    event.preventDefault();
    event.stopPropagation();
    this.tagSelect.emit(tag);
  }
}
