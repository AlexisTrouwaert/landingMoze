import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ArticleListItem } from '../../model/article.model';

/**
 * Carte de présentation d'un article (liste publique + aperçu admin).
 * Purement présentiel : la navigation est gérée par le parent (lien englobant).
 */
@Component({
    selector: 'app-article-card',
    imports: [DatePipe],
    templateUrl: './article-card.component.html',
    styleUrl: './article-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticleCardComponent {
  readonly article = input.required<ArticleListItem>();
}
