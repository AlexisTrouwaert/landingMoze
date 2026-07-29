import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render modes par route.
 * - Les pages **référencées** sont prérendues au build : leur contenu ne dépend d'aucune donnée
 *   de requête, autant le figer en HTML statique. C'est ce qui met le logo du dock dans le
 *   document initial — en rendu client il n'apparaissait qu'une fois toute la chaîne JS
 *   exécutée, ce qui plafonnait le LCP mobile.
 *
 *   Ces quatre-là sont exactement les URL de `public/sitemap.xml` avec l'accueil : en
 *   `RenderMode.Client` elles partaient en coquille de 5 Ko, sans titre propre ni `<h1>` — on
 *   demandait leur indexation en ne livrant rien à indexer. Le rendu client reste le défaut pour
 *   tout ce qui n'a pas vocation à être trouvé par un moteur.
 *
 * - Le blog est rendu **côté serveur à la demande** (SEO : HTML complet + meta pour les
 *   crawlers, contenu toujours frais depuis l'API).
 *
 * - L'admin et la désinscription demeurent en **client** : pages privées ou à usage unique, que
 *   les robots n'ont pas à voir, et dont le rendu serveur n'apporterait rien. Elles sont
 *   déclarées explicitement, faute de quoi le joker ci-dessous les servirait en 404.
 *
 * - Tout le reste est une **URL inconnue** : rendue par le serveur, avec un vrai **404**. Ce
 *   joker était auparavant en `RenderMode.Client`, et le routeur y répondait par un
 *   `redirectTo: ''` — soit une 302 vers l'accueil pour chaque adresse morte, comptée comme
 *   « page avec redirection » par la Search Console.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'commencer', renderMode: RenderMode.Prerender },
  { path: 'cgv-cgu', renderMode: RenderMode.Prerender },
  { path: 'mentions-legales', renderMode: RenderMode.Prerender },
  { path: 'politique-confidentialite', renderMode: RenderMode.Prerender },
  { path: 'blog', renderMode: RenderMode.Server },
  { path: 'blog/:slug', renderMode: RenderMode.Server },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'desinscription', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
