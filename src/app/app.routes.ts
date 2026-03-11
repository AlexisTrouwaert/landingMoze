import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '' },
  { path: '', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  { path: 'commencer', loadComponent: () => import('./pages/funnel/funnel.component').then(m => m.FunnelComponent) },
  { path : 'cgv-cgu', loadComponent: () => import('./pages/cgv/cgv.component').then(m => m.CgvComponent) },
  { path : 'mentions-legales', loadComponent: () => import('./pages/mention/mention.component').then(m => m.MentionComponent) },
  { path : 'politique-confidentialite', loadComponent: () => import('./pages/politique/politique.component').then(m => m.PolitiqueComponent) },
  { path: 'redirection', loadComponent: () => import('./pages/redirection/redirection.component').then(m => m.RedirectionComponent) }
];
