import { Routes } from '@angular/router';

/**
 * Page « Apport d'affaires » — créée pour la soirée de lancement du 5 novembre 2026.
 *
 * `/apport-d-affaires` : l'expression exacte que tapent ceux qui cherchent comment rémunérer, ou se
 * faire rémunérer, une recommandation.
 */
export const APPORT_D_AFFAIRES_ROUTES: Routes = [
  {
    path: '',
    title: 'Apport d\'affaires entre indépendants | Moze',
    loadComponent: () =>
      import('../pages/apport-d-affaires/apport-d-affaires.component').then(
        (m) => m.ApportDAffairesComponent,
      ),
  },
];
