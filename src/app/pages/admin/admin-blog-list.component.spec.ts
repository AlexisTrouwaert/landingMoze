import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environements/environment';
import { Article } from '../../model/article.model';
import { AdminBlogListComponent } from './admin-blog-list.component';

/** Article admin minimal — seuls `id` et `views` comptent pour le tri. */
function adminArticle(id: string, views?: number): Article {
  return {
    id,
    slug: id,
    title: `Article ${id}`,
    excerpt: '',
    content: '',
    coverImageUrl: null,
    coverPosition: 'top',
    author: 'Équipe Moze',
    status: 'PUBLISHED',
    metaTitle: null,
    metaDescription: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    publishedAt: '2026-07-01T00:00:00.000Z',
    featuredAt: null,
    views,
    tags: [],
  };
}

describe('AdminBlogListComponent — compteur de vues et tri', () => {
  let fixture: ComponentFixture<AdminBlogListComponent>;
  let http: HttpTestingController;
  const base = environment.blogApiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminBlogListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(AdminBlogListComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Répond au chargement initial (liste + compteurs) avec les articles donnés. */
  function init(articles: Article[]): void {
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${base}/admin/blog`).flush(articles);
    http
      .expectOne(`${base}/admin/blog/stats`)
      .flush({ draft: 0, published: articles.length, archived: 0, featured: 0 });
    fixture.detectChanges();
  }

  it('affiche le compteur de vues de chaque article', () => {
    init([adminArticle('a', 12), adminArticle('b', 0)]);

    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.row .col-views'),
    ).map((c) => c.textContent?.trim());
    expect(cells).toEqual(['12', '0']);
  });

  it('par défaut, l’ordre de l’API est conservé', () => {
    init([adminArticle('a', 1), adminArticle('b', 99)]);

    expect(fixture.componentInstance.displayedItems().map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('trie du plus vu au moins vu — et inversement', () => {
    init([adminArticle('a', 5), adminArticle('b', 12), adminArticle('c', 0)]);
    const ids = () => fixture.componentInstance.displayedItems().map((i) => i.id);

    fixture.componentInstance.sortMode.set('views-desc');
    expect(ids()).toEqual(['b', 'a', 'c']);

    fixture.componentInstance.sortMode.set('views-asc');
    expect(ids()).toEqual(['c', 'a', 'b']);
  });

  it('un article sans compteur (payload public, vieux cache) vaut zéro', () => {
    init([adminArticle('a', 3), adminArticle('b', undefined)]);

    fixture.componentInstance.sortMode.set('views-asc');
    expect(fixture.componentInstance.displayedItems().map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('le sélecteur de tri pilote la liste affichée', () => {
    init([adminArticle('a', 5), adminArticle('b', 12)]);

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '.adm-sort__select',
    )!;
    select.value = 'views-desc';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const firstTitle = (fixture.nativeElement as HTMLElement).querySelector('.row .row__title');
    expect(firstTitle?.textContent).toContain('Article b');
  });
});
