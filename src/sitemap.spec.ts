import {
  articleEntries,
  buildSitemap,
  MAX_ARTICLES,
  staticEntries,
  STATIC_PATHS,
} from './sitemap';

const SITE = 'https://www.moze.fr';

describe('sitemap', () => {
  describe('staticEntries', () => {
    it('reprend toutes les pages fixes, en URL absolues', () => {
      const entries = staticEntries(SITE);

      expect(entries.length).toBe(STATIC_PATHS.length);
      expect(entries.map((e) => e.loc)).toContain(`${SITE}/blog`);
      expect(entries[0].loc).toBe(`${SITE}/`);
    });
  });

  describe('articleEntries', () => {
    it('construit l’URL de l’article ; `lastmod` = date de modification réelle', () => {
      const entries = articleEntries(
        [
          {
            slug: 'mon-article',
            publishedAt: '2026-07-14T09:30:00.000Z',
            updatedAt: '2026-08-02T08:00:00.000Z',
          },
        ],
        SITE,
      );

      expect(entries).toEqual([
        {
          loc: `${SITE}/blog/mon-article`,
          lastmod: '2026-08-02',
        },
      ]);
    });

    it('se replie sur la date de publication sans date de modification', () => {
      const [entry] = articleEntries(
        [{ slug: 'a', publishedAt: '2026-07-14T09:30:00.000Z' }],
        SITE,
      );

      expect(entry.lastmod).toBe('2026-07-14');
    });

    it('omet `lastmod` plutôt que d’inventer une date', () => {
      expect(articleEntries([{ slug: 'a', publishedAt: null }], SITE)[0].lastmod).toBeUndefined();
      expect(articleEntries([{ slug: 'a' }], SITE)[0].lastmod).toBeUndefined();
    });

    it('écarte une entrée sans slug', () => {
      expect(articleEntries([{ slug: '' }, { slug: 'ok' }], SITE).length).toBe(1);
    });

    it('plafonne le nombre d’articles', () => {
      const articles = Array.from({ length: MAX_ARTICLES + 10 }, (_, i) => ({
        slug: `article-${i}`,
      }));

      expect(articleEntries(articles, SITE).length).toBe(MAX_ARTICLES);
    });
  });

  describe('buildSitemap', () => {
    it('produit un urlset valide', () => {
      const xml = buildSitemap([
        { loc: `${SITE}/` },
        { loc: `${SITE}/blog/a`, lastmod: '2026-07-14' },
      ]);

      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBeTrue();
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain(`<loc>${SITE}/blog/a</loc>`);
      expect(xml).toContain('<lastmod>2026-07-14</lastmod>');
      expect(xml.trimEnd().endsWith('</urlset>')).toBeTrue();
      // Deux entrées, donc deux blocs.
      expect(xml.match(/<url>/g)?.length).toBe(2);
    });

    it('n’écrit ni champ absent, ni `priority`/`changefreq` (ignorés par Google)', () => {
      const xml = buildSitemap([{ loc: `${SITE}/blog/a` }]);

      expect(xml).not.toContain('<lastmod>');
      expect(xml).not.toContain('<priority>');
      expect(xml).not.toContain('<changefreq>');
    });

    /**
     * Une esperluette non échappée rend le fichier entier illisible pour le moteur : il refuse
     * le sitemap en bloc, pas seulement l'URL fautive.
     */
    it('échappe les caractères réservés de XML', () => {
      const xml = buildSitemap([{ loc: `${SITE}/blog/a?x=1&y=2` }]);

      expect(xml).toContain('a?x=1&amp;y=2');
      expect(xml).not.toContain('a?x=1&y=2');
    });
  });
});
