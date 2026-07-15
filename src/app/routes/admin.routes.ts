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
    path: 'blog/:id/edit',
    title: 'Admin · Édition – Moze',
    data: { noindex: true },
    canActivate: [adminGuard, passwordChangedGuard],
    loadComponent: () =>
      import('../pages/admin/admin-blog-editor.component').then(
        (m) => m.AdminBlogEditorComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
