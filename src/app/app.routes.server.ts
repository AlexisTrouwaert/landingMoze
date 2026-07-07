import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render modes par route (SSR "blog-only").
 * - Le blog est rendu **côté serveur à la demande** (SEO : HTML complet + meta
 *   pour les crawlers, contenu toujours frais depuis l'API).
 * - Tout le reste (landing, funnel, pages légales, admin) reste en **client**
 *   (SPA) : on n'exécute donc pas le funnel / GA / Brevo / l'admin côté serveur.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'blog', renderMode: RenderMode.Server },
  { path: 'blog/:slug', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Client },
];
