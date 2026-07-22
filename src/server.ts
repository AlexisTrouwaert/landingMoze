import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine({
  // Derrière le reverse proxy (Apache/nginx) : on fait confiance à ses en-têtes
  // X-Forwarded-* (host / proto / for) pour que le SSR lise le vrai host et
  // protocole du client. Sans ça, Angular avertit à chaque requête. Sûr ici car
  // le process n'est joignable que via le proxy (bind 127.0.0.1:4000).
  trustProxyHeaders: true,
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
