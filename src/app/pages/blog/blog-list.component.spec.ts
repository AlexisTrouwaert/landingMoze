import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { BlogListComponent } from './blog-list.component';
import { BlogService } from '../../services/blog.service';
import { MetaPixelService } from '../../services/meta-pixel.service';
import { ContactPanelService } from '../../services/contact-panel.service';
import { ArticleListItem, ArticlePage } from '../../model/article.model';

describe('BlogListComponent', () => {
  let blog: jasmine.SpyObj<BlogService>;
  let fixtures: ComponentFixture<BlogListComponent>[] = [];

  const item = (id: string): ArticleListItem => ({
    id,
    slug: id,
    title: id,
    excerpt: '',
    coverImageUrl: null,
    author: 'A',
    publishedAt: '2026-01-01',
    tags: [],
  });
  const pageOf = (items: ArticleListItem[], total: number, p = 1): ArticlePage => ({
    items,
    total,
    page: p,
    size: 9,
  });

  beforeEach(() => {
    blog = jasmine.createSpyObj<BlogService>('BlogService', [
      'list',
      'publicTags',
      'featured',
    ]);
    blog.publicTags.and.returnValue(of([]));
    blog.list.and.returnValue(of(pageOf([], 0)));
    blog.featured.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [BlogListComponent],
      providers: [
        provideRouter([]),
        { provide: BlogService, useValue: blog },
        {
          provide: MetaPixelService,
          useValue: jasmine.createSpyObj('MetaPixelService', ['trackLeadCTA']),
        },
        {
          provide: ContactPanelService,
          useValue: jasmine.createSpyObj('ContactPanelService', ['open']),
        },
      ],
    });
  });

  afterEach(() => {
    fixtures.forEach((f) => f.destroy());
    fixtures = [];
  });

  function create(): BlogListComponent {
    const f = TestBed.createComponent(BlogListComponent);
    fixtures.push(f);
    return f.componentInstance;
  }

  it('chargement initial → list(1, 9) + items/total renseignés', () => {
    blog.list.and.returnValue(of(pageOf([item('1'), item('2')], 5)));
    const c = create();
    expect(blog.list).toHaveBeenCalledWith(1, 9, undefined, []);
    expect(c.items().length).toBe(2);
    expect(c.total()).toBe(5);
    expect(c.canLoadMore()).toBe(true);
  });

  it('loadMore() → ajoute la page suivante', () => {
    blog.list.and.returnValue(of(pageOf([item('1')], 3, 1)));
    const c = create();
    blog.list.and.returnValue(of(pageOf([item('2')], 3, 2)));
    c.loadMore();
    expect(c.items().map((i) => i.id)).toEqual(['1', '2']);
  });

  it('loadMore() en erreur → error=true mais la liste déjà chargée est CONSERVÉE', () => {
    blog.list.and.returnValue(of(pageOf([item('1')], 5)));
    const c = create();
    blog.list.and.returnValue(throwError(() => new Error('net')));
    c.loadMore();
    expect(c.error()).toBe(true);
    expect(c.loading()).toBe(false);
    expect(c.items().length).toBe(1); // le composant ne vide PAS la liste
  });

  it('toggleTag() → sélectionne, recharge en page 1 avec le tag, puis désélectionne', () => {
    const c = create();
    blog.list.calls.reset();
    blog.list.and.returnValue(of(pageOf([], 0)));
    c.toggleTag('auto');
    expect(c.isTagSelected('auto')).toBe(true);
    expect(blog.list).toHaveBeenCalledWith(1, 9, undefined, ['auto']);
    c.toggleTag('auto');
    expect(c.isTagSelected('auto')).toBe(false);
  });

  /**
   * Les articles à la une doivent RESTER dans la grille : les en extraire donnait
   * l'impression qu'ils ne faisaient pas partie du blog.
   */
  describe('« à la une »', () => {
    const four = () =>
      blog.list.and.returnValue(
        of(pageOf([item('1'), item('2'), item('3'), item('4')], 4)),
      );

    it('rien d\'épinglé → repli sur les 3 récents, et la grille garde TOUT', () => {
      four();
      const c = create();
      expect(c.showFeatured()).toBe(true);
      expect(c.featuredList().map((i) => i.id)).toEqual(['1', '2', '3']);
      expect(c.gridItems().map((i) => i.id)).toEqual(['1', '2', '3', '4']);
    });

    it('articles épinglés → ils pilotent l\'à la une ET restent dans la grille', () => {
      four();
      blog.featured.and.returnValue(of([item('4'), item('2')]));
      const c = create();
      expect(c.featuredList().map((i) => i.id)).toEqual(['4', '2']);
      expect(c.gridItems().map((i) => i.id)).toEqual(['1', '2', '3', '4']);
    });

    it('échec du chargement des épinglés → repli silencieux sur les 3 récents', () => {
      four();
      blog.featured.and.returnValue(throwError(() => new Error('net')));
      const c = create();
      expect(c.featuredList().map((i) => i.id)).toEqual(['1', '2', '3']);
    });

    it('en mode filtré, pas d\'à la une (mais la grille reste complète)', () => {
      four();
      blog.featured.and.returnValue(of([item('4')]));
      const c = create();
      c.toggleTag('auto');
      expect(c.showFeatured()).toBe(false);
      expect(c.featuredList()).toEqual([]);
    });
  });

  it('recherche (débounce 300ms) → recharge + désactive l\'à la une', fakeAsync(() => {
    const c = create();
    blog.list.calls.reset();
    blog.list.and.returnValue(of(pageOf([item('x')], 1)));
    c.searchControl.setValue('crédit');
    tick(300);
    expect(c.search()).toBe('crédit');
    expect(c.showFeatured()).toBe(false);
    expect(blog.list).toHaveBeenCalledWith(1, 9, 'crédit', []);
    discardPeriodicTasks();
  }));
});
