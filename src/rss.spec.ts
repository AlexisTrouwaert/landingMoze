import { buildRss, MAX_RSS_ITEMS, RssArticle } from './rss';

const SITE = 'https://www.moze.fr';

describe('rss', () => {
  const article = (over: Partial<RssArticle> = {}): RssArticle => ({
    slug: 'mon-article',
    title: 'Mon article',
    excerpt: 'Le résumé.',
    publishedAt: '2026-07-14T09:30:00.000Z',
    ...over,
  });

  it('produit un canal RSS 2.0 valide, auto-référencé', () => {
    const xml = buildRss([article()], SITE);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBeTrue();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(`<atom:link href="${SITE}/rss.xml" rel="self"`);
    expect(xml).toContain(`<link>${SITE}/blog</link>`);
    expect(xml.trimEnd().endsWith('</rss>')).toBeTrue();
  });

  it('décrit l’article : titre, lien permanent, date RFC 822, résumé', () => {
    const xml = buildRss([article()], SITE);

    expect(xml).toContain('<title>Mon article</title>');
    expect(xml).toContain(`<link>${SITE}/blog/mon-article</link>`);
    expect(xml).toContain(`<guid isPermaLink="true">${SITE}/blog/mon-article</guid>`);
    expect(xml).toContain('<pubDate>Tue, 14 Jul 2026 09:30:00 GMT</pubDate>');
    expect(xml).toContain('<description>Le résumé.</description>');
  });

  it('trie du plus récent au plus ancien, quel que soit l’ordre d’entrée', () => {
    const xml = buildRss(
      [
        article({ slug: 'ancien', publishedAt: '2026-01-01T00:00:00.000Z' }),
        article({ slug: 'recent', publishedAt: '2026-08-01T00:00:00.000Z' }),
      ],
      SITE,
    );

    expect(xml.indexOf('blog/recent')).toBeLessThan(xml.indexOf('blog/ancien'));
    // `lastBuildDate` suit le plus récent — pas d'horloge dans la sérialisation.
    expect(xml).toContain('<lastBuildDate>Sat, 01 Aug 2026 00:00:00 GMT</lastBuildDate>');
  });

  it('omet les champs inexploitables plutôt que d’inventer', () => {
    const xml = buildRss(
      [article({ title: null, excerpt: null, publishedAt: 'pas-une-date' })],
      SITE,
    );

    // Titre absent → le slug fait foi (un item RSS sans titre est ignoré par les lecteurs).
    expect(xml).toContain('<title>mon-article</title>');
    expect(xml).not.toContain('<pubDate>');
    expect(xml).not.toContain('<lastBuildDate>');
    // La description du canal, elle, est toujours là — c'est l'item qui n'en a pas.
    expect(xml.split('<item>')[1]).not.toContain('<description>');
  });

  it('écarte une entrée sans slug et plafonne le nombre d’items', () => {
    const beaucoup = Array.from({ length: MAX_RSS_ITEMS + 10 }, (_, i) =>
      article({ slug: `article-${i}` }),
    );

    const xml = buildRss([article({ slug: '' }), ...beaucoup], SITE);

    expect(xml.match(/<item>/g)?.length).toBe(MAX_RSS_ITEMS);
  });

  /**
   * Une esperluette non échappée rend le XML entier illisible : le lecteur rejette le flux en
   * bloc, pas seulement l'item fautif.
   */
  it('échappe les caractères réservés de XML', () => {
    const xml = buildRss([article({ title: 'Vite & bien <fort>' })], SITE);

    expect(xml).toContain('Vite &amp; bien &lt;fort&gt;');
    expect(xml).not.toContain('& bien <fort>');
  });
});
