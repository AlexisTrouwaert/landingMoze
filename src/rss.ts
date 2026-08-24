import { escapeXml } from './sitemap';

/**
 * Construction du flux RSS du blog (`rss.xml`).
 *
 * Même architecture que `sitemap.ts` : la sérialisation vit ici, testable sans Express, et le
 * serveur ne s'occupe que du cache et du repli. Le flux est servi par `server.ts` sur le domaine
 * public — les agrégateurs, lecteurs RSS et crawlers IA le découvrent via le
 * `<link rel="alternate">` d'`index.html`.
 */

/**
 * Ce que la liste publique du blog renvoie, réduit à ce dont le flux a besoin. Tous les champs
 * hors `slug` sont optionnels : `SitemapArticle[]` (le type sous lequel `server.ts` collecte les
 * articles) reste ainsi assignable tel quel, les objets réels portant les champs à l'exécution.
 */
export interface RssArticle {
  readonly slug: string;
  readonly title?: string | null;
  readonly excerpt?: string | null;
  readonly publishedAt?: string | null;
}

/**
 * Un flux RSS annonce les nouveautés, pas les archives : les lecteurs relèvent le fil
 * régulièrement, servir tout l'historique ne ferait que l'alourdir.
 */
export const MAX_RSS_ITEMS = 50;

/** Date RFC 822 (exigée par RSS 2.0), ou `null` si la valeur d'entrée est inexploitable. */
function rfc822(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

/**
 * Sérialise les articles en `rss.xml`.
 *
 * Les articles sont retriés par date de publication décroissante plutôt que pris dans l'ordre de
 * l'API : le contrat RSS, c'est « le plus récent d'abord », et il n'a pas à dépendre du tri de la
 * liste publique. `lastBuildDate` reprend la date du plus récent — pas d'horloge ici, la même
 * entrée produit toujours la même sortie (testable, cacheable).
 */
export function buildRss(articles: readonly RssArticle[], siteUrl: string): string {
  const sorted = articles
    .filter((article) => !!article.slug)
    .slice()
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, MAX_RSS_ITEMS);

  const items = sorted
    .map((article) => {
      const url = `${siteUrl}/blog/${article.slug}`;
      const lines = [
        `      <title>${escapeXml(article.title || article.slug)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      ];

      const pubDate = rfc822(article.publishedAt);
      if (pubDate) lines.push(`      <pubDate>${pubDate}</pubDate>`);
      if (article.excerpt) lines.push(`      <description>${escapeXml(article.excerpt)}</description>`);

      return `    <item>\n${lines.join('\n')}\n    </item>`;
    })
    .join('\n');

  const lastBuild = rfc822(sorted[0]?.publishedAt);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Moze</title>
    <link>${escapeXml(siteUrl)}/blog</link>
    <atom:link href="${escapeXml(siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Conseils, obligations et actualités des indépendants et micro-entrepreneurs, par Moze.</description>
    <language>fr</language>
${lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
}
