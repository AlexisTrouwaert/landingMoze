import { Routes } from '@angular/router';
import {cleanUrlGuard} from "./guard/clean-url.guard";

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '' },
  { path: '**', redirectTo: '' },
  {
    path: '',
    canActivate: [cleanUrlGuard],
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  { path: 'commencer', loadComponent: () => import('./pages/funnel/funnel.component').then(m => m.FunnelComponent) },
  { path: 'cgv-cgu', loadComponent: () => import('./pages/cgv/cgv.component').then(m => m.CgvComponent) },
  { path: 'mentions-legales', loadComponent: () => import('./pages/mention/mention.component').then(m => m.MentionComponent) },
  { path: 'politique-confidentialite', loadComponent: () => import('./pages/politique/politique.component').then(m => m.PolitiqueComponent) },
  // {
  //   path: 'redirection',
  //   loadComponent: () => import('./pages/redirection/redirection.component').then(m => m.RedirectionComponent),
  //   data: { noindex: true }
  // },
  {
    path: 'confirmation',
    loadComponent: () => import('./pages/confirmation/confirmation.component').then(m => m.ConfirmationComponent),
    data: { noindex: true }
  },
];
