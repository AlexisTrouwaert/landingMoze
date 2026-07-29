import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environements/environment';
import {
  articleEntries,
  buildSitemap,
  SitemapArticle,
  staticEntries,
} from './sitemap';

const browserDistFolder = join(import.meta.dirname, '../browser');

/**
 * Hôtes autorisés à déclencher le rendu serveur.
 *
 * Angular refuse de rendre une page pour un `Host` (ou `X-Forwarded-Host`) qu'il ne reconnaît
 * pas — protection anti-SSRF introduite en v20. **Tant que cette liste est vide, aucun hôte
 * n'est reconnu** : le moteur journalise « Falling back to client side rendering » et sert la
 * coquille `index.csr.html`, en 200. Toutes les pages partaient donc vides chez les robots,
 * accueil prérendu compris — d'où les pages mal indexées.
 *
 * `moze.fr` et `*.moze.fr` couvrent le domaine public et ses sous-domaines (www, préprod).
 * `localhost` couvre le cas où le proxy ne conserve pas l'en-tête `Host` d'origine
 * (`ProxyPreserveHost Off`) : Node voit alors `localhost:4000`. Le port n'entre pas dans la
 * comparaison, seul le nom d'hôte compte.
 *
 * ⚠️ Un hôte hors liste reçoit désormais une **400**, plus une page vide : toute nouvelle
 * origine servie par le proxy doit être ajoutée ici, ou passée par `NG_ALLOWED_HOSTS`.
 */
const ALLOWED_HOSTS = (process.env['NG_ALLOWED_HOSTS'] ?? 'moze.fr,*.moze.fr,localhost')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const app = express();
const angularApp = new AngularNodeAppEngine({
  // Derrière le reverse proxy (Apache/nginx) : on fait confiance à ses en-têtes
  // X-Forwarded-* (host / proto / for) pour que le SSR lise le vrai host et
  // protocole du client. Sans ça, Angular avertit à chaque requête. Sûr ici car
  // le process n'est joignable que via le proxy (bind 127.0.0.1:4000).
  trustProxyHeaders: true,
  allowedHosts: ALLOWED_HOSTS,
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * En-têtes de sécurité (défense en profondeur) — appliqués à TOUTES les réponses
 * (pages SSR + fichiers statiques). Complètent les <meta> de index.html par de
 * vrais en-têtes HTTP (plus fiables, non ignorables). Volontairement NON cassants :
 *  - CSP minimale (frame-ancestors / object-src / base-uri) → anti-clickjacking +
 *    blocage <object>/<base> injectés, SANS restreindre script/img/connect : le
 *    Pixel Meta, GA, Brevo et l'API blog continuent de fonctionner tels quels.
 *    (Un durcissement `script-src` par nonce est un chantier séparé.)
 *  - HSTS sans includeSubDomains : la politique domaine-wide reste à l'ops (Apache).
 * NB : si le reverse proxy Apache pose déjà l'un de ces en-têtes, retirer le doublon d'un côté.
 */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  );
  next();
});

/**
 * `sitemap.xml` — pages fixes + articles de blog publiés.
 *
 * Servi ici et non par le back : un sitemap ne peut déclarer que des URL de son propre domaine.
 * Celui du blog vit sur `blog-api.moze.fr`, il ne peut donc pas déclarer `www.moze.fr`.
 *
 * Déclaré avant `express.static` pour prendre le pas sur un éventuel fichier du même nom.
 */
const SITEMAP_TTL_MS = 15 * 60 * 1000;
/**
 * Taille de page de l'API blog — le sitemap la parcourt entièrement.
 *
 * Ne pas dépasser 50 : `ListArticlesQueryDto` du back borne `size` à cette valeur, et rend une
 * 400 au-delà. Le sitemap se retrouverait alors sans le moindre article, sans que rien d'autre
 * ne le signale que la ligne de log du repli.
 */
const SITEMAP_PAGE_SIZE = 50;

let sitemapCache: { xml: string; expiresAt: number } | null = null;

/** Tous les articles publiés, page par page. Lève si l'API ne répond pas. */
async function fetchArticles(): Promise<SitemapArticle[]> {
  const collected: SitemapArticle[] = [];

  for (let page = 1; ; page++) {
    const response = await fetch(
      `${environment.blogApiUrl}/blog?page=${page}&size=${SITEMAP_PAGE_SIZE}`,
      // Un sitemap ne vaut pas de faire patienter : au-delà, on sert ce qu'on a.
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error(`API blog: ${response.status}`);

    const { items = [], total = 0 } = (await response.json()) as {
      items?: SitemapArticle[];
      total?: number;
    };

    collected.push(...items);

    // La condition d'arrêt porte sur `items.length` autant que sur `total` : une API qui
    // renverrait un total farfelu ne doit pas faire tourner la boucle indéfiniment.
    if (!items.length || collected.length >= total) break;
  }

  return collected;
}

app.get('/sitemap.xml', async (_req, res) => {
  const now = Date.now();
  if (sitemapCache && sitemapCache.expiresAt > now) {
    res.type('application/xml').send(sitemapCache.xml);
    return;
  }

  const entries = staticEntries(environment.siteUrl);

  try {
    const articles = await fetchArticles();
    entries.push(...articleEntries(articles, environment.siteUrl));
  } catch (error) {
    // API muette : on sert les pages fixes plutôt qu'une erreur. Un sitemap incomplet reste
    // exploitable par un moteur ; une 500 lui fait abandonner le fichier entier. Et on ne met
    // pas ce résultat dégradé en cache, pour retenter à la requête suivante.
    console.error('sitemap.xml : articles indisponibles', error);
    res.type('application/xml').send(buildSitemap(entries));
    return;
  }

  const xml = buildSitemap(entries);
  sitemapCache = { xml, expiresAt: now + SITEMAP_TTL_MS };
  res.type('application/xml').send(xml);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
