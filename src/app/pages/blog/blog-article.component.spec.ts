import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ParamMap,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Subject } from 'rxjs';

import { environment } from '../../../environements/environment';
import { Article, ArticleListItem } from '../../model/article.model';
import { BlogArticleComponent } from './blog-article.component';

/** Article complet minimal — contenu sans lien externe, pour ne pas déclencher d'aperçus. */
function fullArticle(over: Partial<Article> = {}): Article {
  return {
    id: 'a1',
    slug: 'mon-article',
    title: 'Mon article',
    excerpt: 'Le résumé.',
    content: '<p>Texte</p>',
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
    tags: [{ id: 't1', name: 'TVA', slug: 'tva' }],
    ...over,
  };
}

function listItem(id: string, slug: string): ArticleListItem {
  return {
    id,
    slug,
    title: `Titre ${slug}`,
    excerpt: '',
    coverImageUrl: null,
    author: 'Équipe Moze',
    publishedAt: '2026-07-01T00:00:00.000Z',
    tags: [],
  };
}

describe('BlogArticleComponent', () => {
  let fixture: ComponentFixture<BlogArticleComponent>;
  let http: HttpTestingController;
  let paramMap$: Subject<ParamMap>;
  const base = environment.blogApiUrl;

  beforeEach(() => {
    paramMap$ = new Subject<ParamMap>();

    TestBed.configureTestingModule({
      imports: [BlogArticleComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            snapshot: { firstChild: null, data: {} },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(BlogArticleComponent);
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // `ngOnDestroy` retire le JSON-LD — le DOM de test reste propre entre les specs.
    fixture.destroy();
    http.verify();
  });

  /** Navigue vers le slug et répond à `GET /blog/:slug` avec l'article donné. */
  function load(article: Article): void {
    paramMap$.next(convertToParamMap({ slug: article.slug }));
    http.expectOne(`${base}/blog/${article.slug}`).flush(article);
    fixture.detectChanges();
  }

  it('charge les suggestions par tags communs, article courant exclu', () => {
    load(fullArticle());

    const req = http.expectOne(
      (r) => r.url === `${base}/blog` && r.params.get('tags') === 'tva',
    );
    req.flush({
      items: [listItem('a1', 'mon-article'), listItem('b', 'b'), listItem('c', 'c'), listItem('d', 'd')],
      total: 4,
      page: 1,
      size: 4,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.related().map((i) => i.id)).toEqual(['b', 'c', 'd']);
    expect(fixture.nativeElement.querySelectorAll('.related app-article-card').length).toBe(3);
  });

  it('complète avec les plus récents quand la thématique est trop maigre', () => {
    load(fullArticle());

    http
      .expectOne((r) => r.url === `${base}/blog` && r.params.get('tags') === 'tva')
      .flush({ items: [listItem('b', 'b')], total: 1, page: 1, size: 4 });

    http
      .expectOne((r) => r.url === `${base}/blog` && !r.params.has('tags'))
      .flush({
        items: [listItem('a1', 'mon-article'), listItem('b', 'b'), listItem('e', 'e'), listItem('f', 'f')],
        total: 4,
        page: 1,
        size: 4,
      });
    fixture.detectChanges();

    // Le doublon (b) et l'article courant sont écartés, l'ordre thématique d'abord.
    expect(fixture.componentInstance.related().map((i) => i.id)).toEqual(['b', 'e', 'f']);
  });

  it('sans tag : une seule requête, les plus récents', () => {
    load(fullArticle({ tags: [] }));

    http
      .expectOne((r) => r.url === `${base}/blog` && !r.params.has('tags'))
      .flush({
        items: [listItem('b', 'b'), listItem('c', 'c'), listItem('d', 'd')],
        total: 3,
        page: 1,
        size: 4,
      });
    fixture.detectChanges();

    expect(fixture.componentInstance.related().length).toBe(3);
  });

  describe('JSON-LD', () => {
    const ld = (id: string): unknown => {
      const tag = document.getElementById(`ld-${id}`);
      return tag ? JSON.parse(tag.textContent ?? '') : null;
    };

    /**
     * Répond aux requêtes de suggestions, dont le contenu n'importe pas ici. En séquence : la
     * réponse vide du filtre par tags déclenche la requête de complément « plus récents ».
     */
    function flushRelated(): void {
      http
        .expectOne((r) => r.url === `${base}/blog` && r.params.has('tags'))
        .flush({ items: [], total: 0, page: 1, size: 4 });
      http
        .expectOne((r) => r.url === `${base}/blog` && !r.params.has('tags'))
        .flush({ items: [], total: 0, page: 1, size: 4 });
    }

    it('décrit l’article et le fil d’Ariane dans le HTML', () => {
      load(fullArticle());
      flushRelated();

      const article = ld('article') as Record<string, unknown>;
      expect(article['@type']).toBe('Article');
      expect(article['headline']).toBe('Mon article');
      expect(article['datePublished']).toBe('2026-07-01T00:00:00.000Z');
      expect(article['dateModified']).toBe('2026-07-02T00:00:00.000Z');
      // « Équipe Moze » n'est pas une personne.
      expect((article['author'] as Record<string, unknown>)['@type']).toBe('Organization');

      const breadcrumb = ld('breadcrumb') as Record<string, unknown>;
      const items = breadcrumb['itemListElement'] as Array<Record<string, unknown>>;
      expect(items.length).toBe(3);
      expect(items[1]['item']).toBe(`${environment.siteUrl}/blog`);
      expect(items[2]['name']).toBe('Mon article');
    });

    it('disparaît en quittant la page', () => {
      load(fullArticle());
      flushRelated();
      expect(ld('article')).not.toBeNull();

      fixture.destroy();

      expect(ld('article')).toBeNull();
      expect(ld('breadcrumb')).toBeNull();
    });
  });
});
