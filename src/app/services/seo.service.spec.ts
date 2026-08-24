import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { environment } from '../../environements/environment';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let events$: Subject<any>;
  let metaUpdateSpy: jasmine.Spy;
  let metaRemoveSpy: jasmine.Spy;
  let activatedRouteSnapshot: any;

  beforeEach(() => {
    events$ = new Subject<any>();
    activatedRouteSnapshot = { firstChild: null, data: {} };

    const routerMock = {
      events: events$.asObservable(),
    };

    const activatedRouteMock = {
      snapshot: activatedRouteSnapshot,
    };

    const metaMock = {
      updateTag: jasmine.createSpy('updateTag'),
      removeTag: jasmine.createSpy('removeTag'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: Meta, useValue: metaMock },
      ],
    });

    metaUpdateSpy = metaMock.updateTag;
    metaRemoveSpy = metaMock.removeTag;
  });

  it('should be created', () => {
    const service = TestBed.inject(SeoService);
    expect(service).toBeTruthy();
  });

  function flush() {
    const tb = TestBed as any;
    if (typeof tb.flushEffects === 'function') {
      tb.flushEffects();
    } else if (typeof tb.tick === 'function') {
      tb.tick();
    }
  }

  /**
   * Avant la première navigation, il n'y a pas d'adresse courante : le service ne touche à rien
   * plutôt que de poser une canonique arbitraire. Le retrait du `robots` a bien lieu, mais à la
   * navigation — cf. « should remove robots meta when noindex is missing ».
   */
  it('should not touch any tag before the first navigation', () => {
    TestBed.inject(SeoService);
    flush();
    expect(metaRemoveSpy).not.toHaveBeenCalled();
    expect(metaUpdateSpy).not.toHaveBeenCalled();
  });

  it('should add noindex robots meta tag when data.noindex is true', () => {
    activatedRouteSnapshot.data = {};
    activatedRouteSnapshot.firstChild = {
      firstChild: null,
      data: { noindex: true },
    };

    TestBed.inject(SeoService);
    events$.next(new NavigationEnd(1, '/legal', '/legal'));
    flush();

    expect(metaUpdateSpy).toHaveBeenCalledWith({
      name: 'robots',
      content: 'noindex, nofollow',
    });
  });

  it('should walk down nested child routes to find data', () => {
    activatedRouteSnapshot.firstChild = {
      firstChild: {
        firstChild: null,
        data: { noindex: true },
      },
      data: {},
    };

    TestBed.inject(SeoService);
    events$.next(new NavigationEnd(1, '/a/b', '/a/b'));
    flush();

    expect(metaUpdateSpy).toHaveBeenCalledWith({
      name: 'robots',
      content: 'noindex, nofollow',
    });
  });

  it('should remove robots meta when noindex is missing', () => {
    activatedRouteSnapshot.firstChild = {
      firstChild: null,
      data: {},
    };

    TestBed.inject(SeoService);
    events$.next(new NavigationEnd(1, '/home', '/home'));
    flush();

    expect(metaRemoveSpy).toHaveBeenCalledWith('name="robots"');
  });

  /**
   * Canonique et `og:url` : figées sur l'accueil dans `index.html`, elles annonçaient chaque page
   * comme un doublon de la page d'accueil.
   */
  describe('canonique et og:url', () => {
    const canonical = (): string | null =>
      document.head
        .querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.getAttribute('href') ?? null;

    afterEach(() => {
      document.head.querySelector('link[rel="canonical"]')?.remove();
    });

    function navigate(url: string): void {
      TestBed.inject(SeoService);
      events$.next(new NavigationEnd(1, url, url));
      flush();
    }

    it('pose la canonique et og:url sur l’adresse courante', () => {
      navigate('/blog/mon-article');

      expect(canonical()).toBe(`${environment.siteUrl}/blog/mon-article`);
      expect(metaUpdateSpy).toHaveBeenCalledWith({
        property: 'og:url',
        content: `${environment.siteUrl}/blog/mon-article`,
      });
    });

    it('écarte les paramètres de requête et l’ancre', () => {
      navigate('/commencer?utm_source=linkedin&utm_medium=post#form');

      expect(canonical()).toBe(`${environment.siteUrl}/commencer`);
    });

    it('garde la barre oblique de la racine, et une seule', () => {
      navigate('/');
      expect(canonical()).toBe(`${environment.siteUrl}/`);

      navigate('/blog/');
      expect(canonical()).toBe(`${environment.siteUrl}/blog`);
    });

    it('suit la redirection : c’est l’adresse d’arrivée qui fait foi', () => {
      TestBed.inject(SeoService);
      events$.next(new NavigationEnd(1, '/admin', '/admin/login'));
      flush();

      expect(canonical()).toBe(`${environment.siteUrl}/admin/login`);
    });

    it('réutilise la balise existante au lieu d’en empiler une seconde', () => {
      navigate('/blog');
      navigate('/commencer');

      expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
      expect(canonical()).toBe(`${environment.siteUrl}/commencer`);
    });
  });

  describe('données structurées (JSON-LD)', () => {
    const script = (id: string): HTMLScriptElement | null =>
      document.getElementById(`ld-${id}`) as HTMLScriptElement | null;

    afterEach(() => {
      script('test')?.remove();
    });

    it('pose un <script application/ld+json> dans le head', () => {
      TestBed.inject(SeoService).setJsonLd('test', { '@type': 'Article', headline: 'Titre' });

      const tag = script('test');
      expect(tag).not.toBeNull();
      expect(tag!.type).toBe('application/ld+json');
      expect(JSON.parse(tag!.textContent ?? '')).toEqual({
        '@type': 'Article',
        headline: 'Titre',
      });
    });

    it('remplace le bloc du même id au lieu d’en empiler un second', () => {
      const service = TestBed.inject(SeoService);
      service.setJsonLd('test', { a: 1 });
      service.setJsonLd('test', { a: 2 });

      expect(document.querySelectorAll('#ld-test').length).toBe(1);
      expect(JSON.parse(script('test')!.textContent ?? '')).toEqual({ a: 2 });
    });

    it('un contenu ne peut pas fermer le script (échappement de `<`)', () => {
      TestBed.inject(SeoService).setJsonLd('test', { headline: 'a</script><b>' });

      expect(script('test')!.textContent).not.toContain('</script>');
      // Et le JSON reste fidèle une fois relu.
      expect(JSON.parse(script('test')!.textContent ?? '')).toEqual({
        headline: 'a</script><b>',
      });
    });

    it('removeJsonLd retire le bloc — et tolère un id inconnu', () => {
      const service = TestBed.inject(SeoService);
      service.setJsonLd('test', { a: 1 });

      service.removeJsonLd('test');
      expect(script('test')).toBeNull();

      expect(() => service.removeJsonLd('jamais-pose')).not.toThrow();
    });
  });
});
