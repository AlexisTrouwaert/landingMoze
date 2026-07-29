import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./routes/home.routes').then(m => m.HOME_ROUTES)
  },
  {
    path: 'commencer',
    loadChildren: () => import('./routes/funnel.routes').then(m => m.FUNNEL_ROUTES)
  },
  {
    path: 'cgv-cgu',
    loadChildren: () => import('./routes/legal.routes').then(m => m.CGV_ROUTES)
  },
  {
    path: 'mentions-legales',
    loadChildren: () => import('./routes/legal.routes').then(m => m.MENTION_ROUTES)
  },
  {
    path: 'politique-confidentialite',
    loadChildren: () => import('./routes/legal.routes').then(m => m.POLITIQUE_ROUTES)
  },
  {
    path: 'blog',
    loadChildren: () => import('./routes/blog.routes').then(m => m.BLOG_ROUTES)
  },
  {
    path: 'admin',
    loadChildren: () => import('./routes/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: 'desinscription',
    loadComponent: () => import('./pages/desinscription/desinscription.component').then(m => m.DesinscriptionComponent)
  },
  /**
   * URL inconnue → page 404, et non plus `redirectTo: ''`.
   *
   * Le rendu serveur traduisait cette redirection en **302 vers `/`** : la Search Console y
   * voyait autant de « pages avec redirection », et le visiteur atterrissait sur l'accueil sans
   * savoir ce qu'était devenue la page demandée. Le statut 404 est posé par la route serveur
   * correspondante (`app.routes.server.ts`).
   */
  {
    path: '**',
    title: 'Page introuvable – Moze',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
