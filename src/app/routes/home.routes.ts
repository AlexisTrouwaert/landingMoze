import { Routes } from '@angular/router';
import { cleanUrlGuard } from '../guard/clean-url.guard';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    canActivate: [cleanUrlGuard],
    loadComponent: () => import('../pages/home/home.component').then(m => m.HomeComponent)
  }
];
