import { Routes } from '@angular/router';

/**
 * Page « Freelance » — première page persona du silo.
 *
 * Le titre porte « gérer son activité » et non « logiciel de facturation » : ce dernier est le
 * terrain de l'accueil, et deux URL sur la même requête se neutralisent. Celle-ci vise les
 * recherches de problème, pas de produit.
 */
export const FREELANCE_ROUTES: Routes = [
  {
    path: '',
    title: 'Freelance : gérer son activité au quotidien – Moze',
    loadComponent: () =>
      import('../pages/freelance/freelance.component').then((m) => m.FreelanceComponent),
  },
];
