import { Routes } from '@angular/router';

/**
 * Page « Facturation collaborative » — troisième page du silo.
 *
 * Le titre porte « facturer à plusieurs » autant que le terme métier : personne ne cherche
 * « facturation collaborative » sans savoir que ça existe, alors que « facturer à plusieurs sur
 * un même projet » est la formulation de celui qui a le problème et pas encore la solution.
 */
export const FACTURATION_COLLABORATIVE_ROUTES: Routes = [
  {
    path: '',
    title: 'Facturer à plusieurs : un devis commun, une facture pour chacun – Moze',
    loadComponent: () =>
      import('../pages/facturation-collaborative/facturation-collaborative.component').then(
        (m) => m.FacturationCollaborativeComponent,
      ),
  },
];
