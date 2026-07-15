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
{ path: '**', redirectTo: '' }
];
