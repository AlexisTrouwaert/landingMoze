import { Routes } from '@angular/router';

export const CGV_ROUTES: Routes = [
  {
    path: '',
    title: 'CGU – Moze',
    loadComponent: () => import('../pages/cgv/cgv.component').then(m => m.CgvComponent)
  }
];

export const MENTION_ROUTES: Routes = [
  {
    path: '',
    title: 'Mentions légales – Moze',
    loadComponent: () => import('../pages/mention/mention.component').then(m => m.MentionComponent)
  }
];

export const POLITIQUE_ROUTES: Routes = [
  {
    path: '',
    title: 'Politique de confidentialité – Moze',
    loadComponent: () => import('../pages/politique/politique.component').then(m => m.PolitiqueComponent)
  }
];
