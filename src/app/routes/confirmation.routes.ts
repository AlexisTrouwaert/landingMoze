import { Routes } from '@angular/router';

export const CONFIRMATION_ROUTES: Routes = [
  {
    path: '',
    data: { noindex: true },
    loadComponent: () => import('../pages/confirmation/confirmation.component').then(m => m.ConfirmationComponent)
  }
];
