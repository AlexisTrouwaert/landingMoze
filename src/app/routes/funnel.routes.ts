import { Routes } from '@angular/router';

export const FUNNEL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/funnel/funnel.component').then(m => m.FunnelComponent)
  }
];
