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

  it('should redirect unknown URLs to the root', () => {
    const wildcard = routes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBe('');
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
    }
  });
});
