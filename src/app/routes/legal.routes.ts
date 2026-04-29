import { Routes } from '@angular/router';

export const CGV_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/cgv/cgv.component').then(m => m.CgvComponent)
  }
];

export const MENTION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/mention/mention.component').then(m => m.MentionComponent)
  }
];

export const POLITIQUE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/politique/politique.component').then(m => m.PolitiqueComponent)
  }
];
