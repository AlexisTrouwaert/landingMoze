import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./routes/home.routes').then(m => m.HOME_ROUTES)
  },
  /**
   * `/home` : l'alias de l'accueil hérité de l'ancien site. Même contenu, autre adresse — le cas
   * d'école de la redirection permanente. Elle est déclarée ici, et non dans la configuration
   * d'Apache, pour rester versionnée avec les routes qu'elle accompagne ; c'est la route serveur
   * correspondante qui en fait une **301** et non la 302 par défaut.
   *
   * Doit précéder le joker, qui l'enverrait sinon sur la page 404.
   */
  { path: 'home', pathMatch: 'full', redirectTo: '' },
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
    // Page à usage unique, atteinte par un lien de désinscription : rien à y indexer.
    // Doublée d'un en-tête `X-Robots-Tag` côté serveur (cf. `app.routes.server.ts`), la balise
    // posée ici n'étant lue que par les robots qui exécutent le JavaScript.
    data: { noindex: true },
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
