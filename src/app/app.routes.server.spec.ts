import { RenderMode } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

/**
 * Ces règles décident de ce que reçoivent les robots. Une route repassée en `Client` par
 * inadvertance ne casse rien au clic — le site fonctionne — mais renvoie une coquille vide à
 * l'indexation, et le défaut peut vivre des mois sans être vu. D'où ce filet.
 */
describe('serverRoutes', () => {
  const find = (path: string) => serverRoutes.find((r) => r.path === path);

  /** Doit rester aligné sur `public/sitemap.xml`. */
  const INDEXABLE = [
    '',
    'commencer',
    'cgv-cgu',
    'mentions-legales',
    'politique-confidentialite',
  ];

  for (const path of INDEXABLE) {
    it(`/${path} est prérendu au build`, () => {
      expect(find(path)?.renderMode).toBe(RenderMode.Prerender);
    });
  }

  it('le blog est rendu à la demande (contenu frais depuis l’API)', () => {
    expect(find('blog')?.renderMode).toBe(RenderMode.Server);
    expect(find('blog/:slug')?.renderMode).toBe(RenderMode.Server);
  });

  it('l’admin et la désinscription restent en rendu client', () => {
    expect(find('admin')?.renderMode).toBe(RenderMode.Client);
    expect(find('admin/**')?.renderMode).toBe(RenderMode.Client);
    expect(find('desinscription')?.renderMode).toBe(RenderMode.Client);
  });

  /**
   * La balise `robots` de `SeoService` n'est posée qu'après exécution du JavaScript : sur une
   * page en rendu client, elle ne protège que des robots qui en exécutent. L'en-tête, lui, part
   * avec la réponse.
   */
  for (const path of ['admin', 'admin/**', 'desinscription']) {
    it(`/${path} part avec un en-tête noindex`, () => {
      const headers = (find(path) as { headers?: Record<string, string> })?.headers;
      expect(headers?.['X-Robots-Tag']).toBe('noindex, nofollow');
    });
  }

  it('les pages publiques ne portent pas cet en-tête', () => {
    for (const path of ['', 'commencer', 'blog', 'blog/:slug']) {
      const headers = (find(path) as { headers?: Record<string, string> })?.headers;
      expect(headers?.['X-Robots-Tag']).withContext(`/${path}`).toBeUndefined();
    }
  });

  /**
   * Sans `status`, le routeur produirait une 302 : Google la lit comme provisoire et garde
   * l'ancienne adresse en réserve, au lieu de reporter ses signaux sur l'accueil.
   */
  it('/home redirige en 301, pas en 302', () => {
    const home = find('home');
    expect(home?.renderMode).toBe(RenderMode.Server);
    expect((home as { status?: number })?.status).toBe(301);
  });

  it('une URL inconnue répond 404, et n’est pas redirigée', () => {
    const wildcard = find('**');
    expect(wildcard?.renderMode).toBe(RenderMode.Server);
    expect((wildcard as { status?: number })?.status).toBe(404);
  });

  it('le joker ferme la marche', () => {
    expect(serverRoutes[serverRoutes.length - 1].path).toBe('**');
  });
});
