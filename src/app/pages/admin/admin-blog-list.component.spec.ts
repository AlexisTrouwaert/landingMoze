import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environements/environment';
import { AdminFeaturedItem, Article } from '../../model/article.model';
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

  /** Répond au chargement initial (liste + compteurs + une) avec les articles donnés. */
  function init(
    articles: Article[],
    featured: (Article | AdminFeaturedItem)[] = [],
  ): void {
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${base}/admin/blog`).flush(articles);
    http
      .expectOne(`${base}/admin/blog/stats`)
      .flush({ draft: 0, published: articles.length, archived: 0, featured: featured.length });
    http.expectOne(`${base}/admin/blog/featured`).flush(featured);
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

  describe('section « À la une » et accès au blog', () => {
    it('affiche les épinglés en tête, dans l’ordre public, avec leurs actions', () => {
      init(
        [adminArticle('a', 1)],
        [adminArticle('u1', 0), adminArticle('u2', 0)],
      );

      const host = fixture.nativeElement as HTMLElement;
      const section = host.querySelector('.adm-featured');
      expect(section).not.toBeNull();
      expect(section?.textContent).toContain('2/5');

      const items = host.querySelectorAll('.adm-featured__item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Article u1');
      // Chaque entrée offre l'accès public et le retrait direct.
      expect(items[0].querySelector('a[target="_blank"]')?.getAttribute('href')).toBe('/blog/u1');
      expect(items[0].querySelector('.adm-featured__remove')).not.toBeNull();
    });

    it('sans épinglé : pas de section', () => {
      init([adminArticle('a', 1)]);

      expect((fixture.nativeElement as HTMLElement).querySelector('.adm-featured')).toBeNull();
    });

    /**
     * Un article programmé peut être destiné à prendre la place d'un épinglé. L'échange
     * n'aura lieu qu'à sa parution : d'ici là l'ancien reste bien à la une, et c'est le
     * grisé qui prévient qu'il est sur le départ.
     */
    it('un épinglé sur le départ est grisé et annonce son remplaçant', () => {
      const surLeDepart = {
        ...adminArticle('u1', 0),
        replacedBy: {
          id: 'prog',
          title: 'Le prochain',
          publishedAt: '2026-09-15T08:00:00.000Z',
        },
      };
      init([adminArticle('a', 1)], [surLeDepart, adminArticle('u2', 0)]);

      const items = (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll('.adm-featured__item');

      expect(items[0].classList).toContain('is-leaving');
      expect(items[0].textContent).toContain('Le prochain');
      expect(items[0].textContent).toContain('15/09/2026');
      // Il n'a pas quitté la une pour autant : le retrait direct reste offert.
      expect(items[0].querySelector('.adm-featured__remove')).not.toBeNull();
      // Les autres ne sont pas grisés.
      expect(items[1].classList).not.toContain('is-leaving');
    });

    /**
     * L'article programmé qui doit prendre une place n'est pas encore épinglé : son
     * `featuredAt` reste nul jusqu'à la parution. Sans marque dans la liste, l'auteur croit
     * son clic perdu — et re-cliquer épinglerait l'article tout de suite.
     */
    describe('étoile d’un échange en attente', () => {
      const enAttente = () => {
        const a = adminArticle('prog', 0);
        a.publishedAt = new Date(Date.now() + 3600_000).toISOString();
        a.featureReplacesId = 'u1';
        return a;
      };

      it('l’étoile est allumée, en pointillé', () => {
        init([enAttente()], [adminArticle('u1', 0)]);

        const star = (fixture.nativeElement as HTMLElement).querySelector('.row__star')!;
        expect(star.classList).toContain('is-pending');
        expect(star.classList).not.toContain('is-on');
        expect(star.getAttribute('aria-pressed')).toBe('true');
        expect(star.getAttribute('title')).toContain('à la parution');
      });

      it('re-cliquer annule l’intention au lieu d’épingler', () => {
        init([enAttente()], [adminArticle('u1', 0)]);

        (fixture.nativeElement as HTMLElement)
          .querySelector<HTMLButtonElement>('.row__star')!
          .click();

        // `unfeature` efface l'échange en attente ; `feature` l'aurait épinglé sur-le-champ,
        // en gardant l'ancien — donc au-delà de la limite.
        http.expectNone(`${base}/admin/blog/prog/feature`);
        http
          .expectOne(`${base}/admin/blog/prog/unfeature`)
          .flush(adminArticle('prog', 0));
        http
          .expectOne(`${base}/admin/blog/stats`)
          .flush({ draft: 0, published: 1, archived: 0, featured: 1 });
        http.expectOne(`${base}/admin/blog/featured`).flush([adminArticle('u1', 0)]);
      });
    });

    it('retirer depuis la section rafraîchit compteurs et une', () => {
      init([adminArticle('u1', 0)], [adminArticle('u1', 0)]);

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.adm-featured__remove')!
        .click();

      http
        .expectOne(`${base}/admin/blog/u1/unfeature`)
        .flush(adminArticle('u1', 0));
      http
        .expectOne(`${base}/admin/blog/stats`)
        .flush({ draft: 0, published: 1, archived: 0, featured: 0 });
      http.expectOne(`${base}/admin/blog/featured`).flush([]);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.adm-featured')).toBeNull();
    });

    it('un article publié à une date FUTURE est badgé « Programmé »', () => {
      const programme = adminArticle('p1', 0);
      programme.publishedAt = new Date(Date.now() + 3600_000).toISOString();
      init([programme]);

      const badge = (fixture.nativeElement as HTMLElement).querySelector('.row .badge');
      expect(badge?.textContent?.trim()).toBe('Programmé');
      expect(badge?.classList.contains('badge--scheduled')).toBeTrue();
      expect(badge?.getAttribute('title')).toContain('Publication le');
    });

    /**
     * À la limite, l'étoile reste cliquable : elle ouvre la popup d'échange. Un bouton mort
     * n'expliquerait ni la limite, ni comment y remédier.
     */
    describe('épinglage à la limite', () => {
      const cinq = ['u1', 'u2', 'u3', 'u4', 'u5'].map((id) => adminArticle(id, 0));

      /** Charge la liste avec une une pleine (5/5). */
      function initPleine(): void {
        fixture.detectChanges();
        http.expectOne((r) => r.url === `${base}/admin/blog`).flush([adminArticle('neuf', 0)]);
        http
          .expectOne(`${base}/admin/blog/stats`)
          .flush({ draft: 0, published: 6, archived: 0, featured: 5 });
        http.expectOne(`${base}/admin/blog/featured`).flush(cinq);
        fixture.detectChanges();
      }

      it('l’étoile reste active et ouvre la popup au lieu d’épingler', () => {
        initPleine();

        const etoile = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
          '.row .row__star',
        )!;
        expect(etoile.disabled).toBeFalse();

        etoile.click();
        fixture.detectChanges();

        const popup = (fixture.nativeElement as HTMLElement).querySelector('.swap');
        expect(popup).not.toBeNull();
        expect(popup?.textContent).toContain('5/5');
        expect(popup?.querySelectorAll('.swap__choice').length).toBe(5);
        // Rien n'est parti au back tant que le choix n'est pas fait.
        http.expectNone((r) => r.url.includes('/feature'));
      });

      it('le choix libère la place puis épingle le nouvel article', () => {
        initPleine();
        fixture.componentInstance.toggleFeature(adminArticle('neuf', 0));
        fixture.detectChanges();

        (fixture.nativeElement as HTMLElement)
          .querySelectorAll<HTMLButtonElement>('.swap__choice')[2]
          .click();

        // Un seul appel : c'est le back qui libère la place (u3) et épingle dans la foulée
        // — ou qui mémorise l'échange si l'article n'est que programmé.
        const req = http.expectOne(`${base}/admin/blog/neuf/feature`);
        expect(req.request.body).toEqual({ replaces: 'u3' });
        req.flush(adminArticle('neuf', 0));
        http
          .expectOne(`${base}/admin/blog/stats`)
          .flush({ draft: 0, published: 6, archived: 0, featured: 5 });
        http.expectOne(`${base}/admin/blog/featured`).flush(cinq);
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement).querySelector('.swap')).toBeNull();
      });

      it('annuler ne touche à rien', () => {
        initPleine();
        fixture.componentInstance.toggleFeature(adminArticle('neuf', 0));
        fixture.detectChanges();

        fixture.componentInstance.cancelSwap();
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement).querySelector('.swap')).toBeNull();
        http.expectNone((r) => r.url.includes('/feature'));
      });
    });

    it('chaque article publié expose « voir sur le blog » dans ses actions', () => {
      init([adminArticle('a', 1)]);

      const lien = (fixture.nativeElement as HTMLElement).querySelector(
        '.row .col-actions a[target="_blank"]',
      );
      expect(lien).not.toBeNull();
      expect(lien?.getAttribute('href')).toBe('/blog/a');
      expect(lien?.getAttribute('title')).toBe('Voir sur le blog');
    });
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
