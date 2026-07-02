import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Article } from '../../model/article.model';

/**
 * Rendu complet d'un article (page publique + aperçu admin).
 * `back` (défaut true) affiche le lien « Tous les articles » — masqué en aperçu.
 */
@Component({
  selector: 'app-article-view',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './article-view.component.html',
  styleUrl: './article-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleViewComponent {
  readonly article = input.required<Article>();
  readonly back = input(true);
}
