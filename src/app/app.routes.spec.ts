import { Route } from '@angular/router';
import { routes } from './app.routes';

describe('app.routes', () => {
  it('should declare a root home route (pathMatch full)', () => {
    const home = routes.find((r) => r.path === '');
    expect(home).toBeTruthy();
    expect(home?.pathMatch).toBe('full');
    expect(typeof home?.loadChildren).toBe('function');
  });

  it('should declare /commencer route with lazy children', () => {
    const r = routes.find((x) => x.path === 'commencer');
    expect(r).toBeTruthy();
    expect(typeof r?.loadChildren).toBe('function');
  });

  it('should declare /cgv-cgu route with lazy children', () => {
    const r = routes.find((x) => x.path === 'cgv-cgu');
    expect(r).toBeTruthy();
    expect(typeof r?.loadChildren).toBe('function');
  });

  it('should declare /mentions-legales route with lazy children', () => {
    const r = routes.find((x) => x.path === 'mentions-legales');
    expect(r).toBeTruthy();
    expect(typeof r?.loadChildren).toBe('function');
  });

  it('should declare /politique-confidentialite route with lazy children', () => {
    const r = routes.find((x) => x.path === 'politique-confidentialite');
    expect(r).toBeTruthy();
    expect(typeof r?.loadChildren).toBe('function');
  });

  /**
   * Une URL inconnue doit afficher une page 404, jamais rediriger : le rendu serveur traduisait
   * `redirectTo` en 302, et la Search Console comptait autant de « pages avec redirection ».
   */
  it('should render a 404 page for unknown URLs, not redirect', () => {
    const wildcard = routes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBeUndefined();
    expect(typeof wildcard?.loadComponent).toBe('function');
  });

  it('wildcard must be the last route', () => {
    expect(routes[routes.length - 1].path).toBe('**');
  });

  it('should resolve all lazy chunks without throwing', async () => {
    for (const r of routes) {
      const lazy = (r as Route).loadChildren as undefined | (() => Promise<any>);
      if (lazy) {
        await expectAsync(Promise.resolve(lazy())).toBeResolved();
      }

      // `loadComponent` aussi : le joker 404 charge un composant, pas des enfants — un chemin
      // d'import erroné ne se verrait qu'à la première URL inconnue en production.
      const lazyComponent = (r as Route).loadComponent as
        | undefined
        | (() => Promise<any>);
      if (lazyComponent) {
        await expectAsync(Promise.resolve(lazyComponent())).toBeResolved();
      }
    }
  });
});
