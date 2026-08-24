/**
 * Construction du `sitemap.xml`.
 *
 * Le fichier était statique et ne listait que les pages fixes : aucun article de blog n'y
 * figurait, alors que c'est le seul contenu qui s'enrichit. Les articles ne sont donc découverts
 * que par les liens internes, au rythme du crawl.
 *
 * La partie XML vit ici, séparée du serveur : elle est testable sans lancer Express, et le
 * serveur n'a plus à s'occuper que de la mise en cache et du repli en cas d'API muette.
 */

/** Une entrée de `<urlset>`. */
export interface SitemapEntry {
  /** URL absolue, sur le domaine public. */
  readonly loc: string;
  /** Date au format `AAAA-MM-JJ`. Omise si inconnue — mieux vaut rien qu'une date inventée. */
  readonly lastmod?: string;
  readonly changefreq?: string;
  readonly priority?: string;
}

/** Ce que la liste publique du blog renvoie, réduit à ce dont le sitemap a besoin. */
export interface SitemapArticle {
  readonly slug: string;
  readonly publishedAt?: string | null;
}

/**
 * Chemins fixes et leur périodicité, repris de l'ancien fichier statique.
 *
 * L'admin, la désinscription et la page 404 en sont évidemment absents : le premier est privé,
 * la deuxième à usage unique, la troisième n'existe pas.
 */
export const STATIC_PATHS: readonly {
  path: string;
  changefreq: string;
  priority: string;
}[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/commencer', changefreq: 'monthly', priority: '0.9' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/cgv-cgu', changefreq: 'yearly', priority: '0.3' },
  { path: '/mentions-legales', changefreq: 'yearly', priority: '0.3' },
  { path: '/politique-confidentialite', changefreq: 'yearly', priority: '0.3' },
];

/**
 * Plafond de sécurité. La norme autorise 50 000 URL par fichier ; on s'arrête bien avant, la
 * borne servant surtout à ce qu'une API qui renverrait n'importe quoi ne fasse pas boucler la
 * pagination indéfiniment.
 */
export const MAX_ARTICLES = 5000;

/** Échappe les caractères réservés de XML. Partagé avec le flux RSS (`rss.ts`). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Les entrées des pages fixes, préfixées par l'origine publique. */
export function staticEntries(siteUrl: string): SitemapEntry[] {
  return STATIC_PATHS.map(({ path, changefreq, priority }) => ({
    loc: `${siteUrl}${path}`,
    changefreq,
    priority,
  }));
}

/**
 * Les entrées des articles publiés.
 *
 * `lastmod` vient de la date de publication : la liste publique ne transporte pas la date de
 * modification. Un article retouché ne verra donc pas sa date bouger — c'est une indication pour
 * le moteur, pas un contrat, et une date fausse serait pire qu'une date ancienne.
 */
export function articleEntries(
  articles: readonly SitemapArticle[],
  siteUrl: string,
): SitemapEntry[] {
  return articles
    .filter((article) => !!article.slug)
    .slice(0, MAX_ARTICLES)
    .map((article) => ({
      loc: `${siteUrl}/blog/${article.slug}`,
      lastmod: article.publishedAt?.slice(0, 10) || undefined,
      changefreq: 'monthly',
      priority: '0.7',
    }));
}

/** Sérialise les entrées en `sitemap.xml`. */
export function buildSitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
      if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
      if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority) lines.push(`    <priority>${entry.priority}</priority>`);
      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
