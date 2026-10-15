import { Routes } from '@angular/router';

/**
 * Page « Co-traitance entre artisans » — la déclinaison bâtiment de « Facturer à plusieurs ».
 *
 * Le vocabulaire des artisans (« co-traitance », « chantier ») n'est employé que sur cette page :
 * c'est celui de leurs recherches, pas celui du reste du site.
 */
export const CO_TRAITANCE_ARTISANS_ROUTES: Routes = [
  {
    path: '',
    title: 'Facture de co-traitance entre artisans | Moze',
    loadComponent: () =>
      import('../pages/co-traitance-artisans/co-traitance-artisans.component').then(
        (m) => m.CoTraitanceArtisansComponent,
      ),
  },
];
