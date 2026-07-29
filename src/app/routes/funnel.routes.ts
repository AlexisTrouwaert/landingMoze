import { Routes } from '@angular/router';

export const FUNNEL_ROUTES: Routes = [
  {
    path: '',
    // Sans titre propre, la page héritait de celui de l'accueil : deux URL référencées sous le
    // même libellé, que Google lit comme un doublon.
    title: 'Commencer gratuitement – Moze',
    loadComponent: () => import('../pages/funnel/funnel.component').then(m => m.FunnelComponent)
  }
];
