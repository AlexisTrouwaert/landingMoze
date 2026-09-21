import { Routes } from '@angular/router';
import { adminGuard } from '../guard/admin.guard';
import { passwordChangedGuard } from '../guard/password-changed.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Connexion admin – Moze',
    data: { noindex: true },
    loadComponent: () =>
      import('../pages/admin/admin-login.component').then(
        (m) => m.AdminLoginComponent,
      ),
  },
  {
    path: 'compte',
    title: 'Admin · Mon compte – Moze',
    data: { noindex: true },
    canActivate: [adminGuard],
    loadComponent: () =>
      import('../pages/admin/admin-account.component').then(
        (m) => m.AdminAccountComponent,
      ),
  },
  {
    path: 'blog',
    title: 'Admin · Articles – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-list.component').then(
        (m) => m.AdminBlogListComponent,
      ),
  },
  {
    path: 'blog/coller',
    title: 'Admin · Coller un article – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-paste.component').then(
        (m) => m.AdminBlogPasteComponent,
      ),
  },
  {
    path: 'blog/relecture',
    title: 'Admin · Relecture – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-review.component').then(
        (m) => m.AdminBlogReviewComponent,
      ),
  },
  {
    path: 'blog/series',
    title: 'Admin · Séries – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-series.component').then(
        (m) => m.AdminBlogSeriesComponent,
      ),
  },
  {
    path: 'blog/new',
    title: 'Admin · Nouvel article – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-editor.component').then(
        (m) => m.AdminBlogEditorComponent,
      ),
  },
  {
    // Écran d'après-publication : on y vient une fois l'article en ligne, souvent le
    // lendemain. Une route à part, donc, et pas un onglet de l'éditeur.
    path: 'blog/:id/diffusion',
    title: 'Admin · Diffusion – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-diffusion.component').then(
        (m) => m.AdminBlogDiffusionComponent,
      ),
  },
  {
    path: 'blog/:id/edit',
    title: 'Admin · Édition – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-editor.component').then(
        (m) => m.AdminBlogEditorComponent,
      ),
  },
  {
    path: 'evenements',
    title: 'Admin · Évènements – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-event-list.component').then(
        (m) => m.AdminEventListComponent,
      ),
  },
  {
    path: 'evenements/coller',
    title: 'Admin · Coller un évènement – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-event-paste.component').then(
        (m) => m.AdminEventPasteComponent,
      ),
  },
  {
    path: 'evenements/new',
    title: 'Admin · Nouvel évènement – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-event-editor.component').then(
        (m) => m.AdminEventEditorComponent,
      ),
  },
  {
    path: 'evenements/:id/edit',
    title: 'Admin · Édition d’évènement – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-event-editor.component').then(
        (m) => m.AdminEventEditorComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
