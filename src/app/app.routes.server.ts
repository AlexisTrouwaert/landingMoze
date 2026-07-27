import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render modes par route.
 * - L'accueil est **prérendu au build** : son contenu ne dépend d'aucune donnée
 *   de requête, donc autant le figer en HTML statique. C'est ce qui met le logo
 *   du dock dans le document initial — en rendu client il n'apparaissait qu'une
 *   fois toute la chaîne JS exécutée, ce qui plafonnait le LCP mobile.
 * - Le blog est rendu **côté serveur à la demande** (SEO : HTML complet + meta
 *   pour les crawlers, contenu toujours frais depuis l'API).
 * - Tout le reste (funnel, pages légales, admin) reste en **client** (SPA) : on
 *   n'exécute donc pas le funnel / GA / Brevo / l'admin côté serveur.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'blog', renderMode: RenderMode.Server },
  { path: 'blog/:slug', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Client },
];
