import { Routes } from '@angular/router';

/**
 * Page « Services à la personne » — quatrième page du silo.
 *
 * `/services-a-la-personne` plutôt que `/sap` ou `/cooperative` : le sigle n'est tapé que par
 * ceux qui connaissent déjà le dispositif, et « Moze Coop » est un nom de marque que personne ne
 * cherche. L'expression complète est celle du besoin.
 */
export const SERVICES_A_LA_PERSONNE_ROUTES: Routes = [
  {
    path: '',
    title: 'Services à la personne : crédit d\'impôt de 50 % – Moze',
    loadComponent: () =>
      import('../pages/services-a-la-personne/services-a-la-personne.component').then(
        (m) => m.ServicesALaPersonneComponent,
      ),
  },
];
