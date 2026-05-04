import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./routes/home.routes').then(m => m.HOME_ROUTES)
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
{ path: '**', redirectTo: '' }
];
