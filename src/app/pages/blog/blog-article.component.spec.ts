import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Subject } from 'rxjs';

import { environment } from '../../../environements/environment';
import { Article, ArticleListItem } from '../../model/article.model';
import { BlogArticleComponent, VIEW_DWELL_MS } from './blog-article.component';

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
    // La déduplication des vues (une par appareil) survivrait d'un spec à l'autre.
    localStorage.clear();
  });

  afterEach(() => {
    // `ngOnDestroy` retire le JSON-LD — le DOM de test reste propre entre les specs.
    fixture.destroy();
    http.verify();
  });

  /** Navigue vers le slug et répond à `GET /blog/:slug` avec l'article donné. */
  function open(article: Article): void {
    paramMap$.next(convertToParamMap({ slug: article.slug }));
    http.expectOne(`${base}/blog/${article.slug}`).flush(article);
    fixture.detectChanges();
  }

  /**
   * `open`, puis avance l'horloge du temps de présence et solde le ping de vue : Karma tourne
   * dans un navigateur, il part donc au premier séjour complet sur un article de la session.
   * À appeler depuis un test `fakeAsync` (l'horloge est simulée).
   */
  function load(article: Article): void {
    open(article);
    tick(VIEW_DWELL_MS);
    http
      .expectOne({ method: 'POST', url: `${base}/blog/${article.slug}/view` })
      .flush(null, { status: 204, statusText: 'No Content' });
  }

  /** Répond « rien » à la requête de suggestions sans filtre de tags. */
  function flushLatest(): void {
    http
      .expectOne((r) => r.url === `${base}/blog` && !r.params.has('tags'))
      .flush({ items: [], total: 0, page: 1, size: 4 });
  }

  it('charge les suggestions par tags communs, article courant exclu', fakeAsync(() => {
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
  }));

  it('complète avec les plus récents quand la thématique est trop maigre', fakeAsync(() => {
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
  }));

  it('sans tag : une seule requête, les plus récents', fakeAsync(() => {
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
  }));

  it('un ancien slug redirige vers l’actuel, sans rien charger d’autre', () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    // L'API résout l'ancien slug mais renvoie l'article avec son slug ACTUEL.
    paramMap$.next(convertToParamMap({ slug: 'ancien-slug' }));
    http
      .expectOne(`${base}/blog/ancien-slug`)
      .flush(fullArticle({ slug: 'slug-actuel' }));
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/blog', 'slug-actuel'], { replaceUrl: true });
    // Ni ping de vue, ni suggestions, ni SEO : la page redirigée ne compte pas.
    http.expectNone((r) => r.url !== `${base}/blog/ancien-slug`);
    expect(fixture.componentInstance.article()).toBeNull();
  });

  it('affiche le fil d’Ariane et le CTA de fin d’article', fakeAsync(() => {
    load(fullArticle({ tags: [] }));
    flushLatest();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const crumbs = host.querySelector('.crumbs');
    expect(crumbs).not.toBeNull();
    expect(crumbs?.textContent).toContain('Accueil');
    expect(crumbs?.textContent).toContain('Blog');
    expect(crumbs?.textContent).toContain('Mon article');

    const cta = host.querySelector<HTMLAnchorElement>('.article-cta__btn');
    expect(cta).not.toBeNull();
    expect(cta?.getAttribute('href')).toBe('/commencer');
  }));

  describe('compteur de vues', () => {
    it('la vue n’est comptée qu’après le temps de présence', fakeAsync(() => {
      open(fullArticle({ tags: [] }));
      flushLatest();

      // Une seconde avant l'échéance : toujours rien.
      tick(VIEW_DWELL_MS - 1000);
      http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/view'));

      tick(1000);
      http
        .expectOne({ method: 'POST', url: `${base}/blog/mon-article/view` })
        .flush(null, { status: 204, statusText: 'No Content' });
    }));

    it('partir avant l’échéance annule le comptage — seul l’article lu compte', fakeAsync(() => {
      open(fullArticle({ tags: [], slug: 'quitte-trop-tot' }));
      flushLatest();

      // Le lecteur repart à mi-parcours…
      tick(VIEW_DWELL_MS / 2);
      open(fullArticle({ tags: [], slug: 'vraiment-lu', id: 'a2' }));
      flushLatest();

      // …et reste sur le second : lui seul est compté.
      tick(VIEW_DWELL_MS);
      http
        .expectOne({ method: 'POST', url: `${base}/blog/vraiment-lu/view` })
        .flush(null, { status: 204, statusText: 'No Content' });
      http.expectNone((r) => r.url.endsWith('/quitte-trop-tot/view'));
    }));

    it('un ping en échec ne condamne pas le comptage pour la session', fakeAsync(() => {
      const article = fullArticle({ tags: [] });

      // 1er séjour : le ping échoue (back redémarré, réseau coupé...).
      open(article);
      flushLatest();
      tick(VIEW_DWELL_MS);
      http
        .expectOne({ method: 'POST', url: `${base}/blog/${article.slug}/view` })
        .flush(null, { status: 503, statusText: 'Service Unavailable' });

      // 2e séjour : le marqueur a été retiré, un nouveau ping doit partir.
      open(article);
      flushLatest();
      tick(VIEW_DWELL_MS);
      http
        .expectOne({ method: 'POST', url: `${base}/blog/${article.slug}/view` })
        .flush(null, { status: 204, statusText: 'No Content' });
    }));

    it('compte une seule vue par appareil, au-delà de la session', fakeAsync(() => {
      const article = fullArticle({ tags: [] });
      load(article); // le premier ping est soldé par le helper
      flushLatest();

      // Retour sur le même article, séjour complet : article rechargé, mais pas de
      // second ping — c'est le http.verify() de l'afterEach qui le garantit aussi.
      open(article);
      flushLatest();
      tick(VIEW_DWELL_MS);

      http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/view'));
    }));

    it('le marqueur est écrit dans localStorage, pas dans sessionStorage', fakeAsync(() => {
      const article = fullArticle({ tags: [] });
      open(article);
      flushLatest();
      tick(VIEW_DWELL_MS);
      http
        .expectOne({ method: 'POST', url: `${base}/blog/${article.slug}/view` })
        .flush(null, { status: 204, statusText: 'No Content' });

      // `sessionStorage` ne suffirait pas : le lecteur qui ferme l'onglet et revient
      // demain recompterait une vue. Une seule par article et par appareil.
      expect(localStorage.getItem(`moze-viewed-${article.slug}`)).not.toBeNull();
      expect(sessionStorage.getItem(`moze-viewed-${article.slug}`)).toBeNull();
    }));
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

    it('décrit l’article et le fil d’Ariane dans le HTML', fakeAsync(() => {
      load(fullArticle());
      flushRelated();

      const article = ld('article') as Record<string, unknown>;
      expect(article['@type']).toBe('BlogPosting');
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
    }));

    it('disparaît en quittant la page', fakeAsync(() => {
      load(fullArticle());
      flushRelated();
      expect(ld('article')).not.toBeNull();

      fixture.destroy();

      expect(ld('article')).toBeNull();
      expect(ld('breadcrumb')).toBeNull();
    }));
  });
});
