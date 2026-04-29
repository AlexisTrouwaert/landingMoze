import { Routes } from '@angular/router';

export const REDIRECTION_ROUTES: Routes = [
  {
    path: '',
    data: { noindex: true },
    loadComponent: () => import('../pages/redirection/redirection.component').then(m => m.RedirectionComponent)
  }
];
