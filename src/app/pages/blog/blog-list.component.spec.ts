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

/**
 * Sortie du champ de recherche : le clavier natif masque la moitié de l'écran, alors que les
 * résultats sont déjà là — la recherche est instantanée. La touche « Rechercher » et le
 * défilement doivent donc tous deux rendre l'écran au lecteur.
 *
 * `window.scrollY` est simulé : le navigateur de test ne défile pas de lui-même.
 */
describe('BlogListComponent (fermeture du clavier)', () => {
  let blog: jasmine.SpyObj<BlogService>;
  let fixture: ComponentFixture<BlogListComponent>;
  let input: HTMLInputElement;
  let scrollY = 0;
  let descripteurOrigine: PropertyDescriptor | undefined;

  beforeEach(() => {
    blog = jasmine.createSpyObj<BlogService>('BlogService', ['list', 'publicTags', 'featured']);
    blog.publicTags.and.returnValue(of([]));
    blog.featured.and.returnValue(of([]));
    blog.list.and.returnValue(of({ items: [], total: 0, page: 1, size: 9 }));

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

    descripteurOrigine = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
    scrollY = 0;

    fixture = TestBed.createComponent(BlogListComponent);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input[type="search"]');
  });

  afterEach(() => {
    fixture.destroy();
    if (descripteurOrigine) Object.defineProperty(window, 'scrollY', descripteurOrigine);
    else delete (window as unknown as Record<string, unknown>)['scrollY'];
  });

  /** Défile puis émet l'événement : le navigateur de test ne le fait pas seul. */
  function defiler(y: number): void {
    scrollY = y;
    window.dispatchEvent(new Event('scroll'));
  }

  it('la touche « Rechercher » du clavier sort du champ', () => {
    input.focus();
    expect(document.activeElement).toBe(input);

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(document.activeElement).not.toBe(input);
  });

  it('un défilement franc sort du champ', () => {
    input.focus();
    defiler(200);
    expect(document.activeElement).not.toBe(input);
  });

  it('le défilement d’ouverture du clavier (iOS) ne sort pas du champ', () => {
    // iOS remonte la page de quelques dizaines de pixels pour dégager le champ du clavier.
    // Sans seuil, la saisie serait impossible : le champ se refermerait aussitôt ouvert.
    input.focus();
    defiler(30);
    expect(document.activeElement).toBe(input);
  });

  it('le seuil repart de la position à laquelle on revient dans le champ', () => {
    input.focus();
    defiler(300);
    expect(document.activeElement).not.toBe(input);

    // L'écouteur a été retiré à la sortie : en revenant, le seuil se mesure depuis 300 px,
    // pas depuis le haut de la page.
    input.focus();
    defiler(320);
    expect(document.activeElement).toBe(input);
  });

  it('la saisie n’est pas perdue en refermant le clavier', () => {
    input.focus();
    input.value = 'crédit';
    input.dispatchEvent(new Event('input'));
    defiler(200);

    expect(document.activeElement).not.toBe(input);
    expect(input.value).toBe('crédit');
  });
});
