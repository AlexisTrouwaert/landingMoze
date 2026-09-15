import { Routes } from '@angular/router';

/**
 * Page « Tarifs » — deuxième page du silo thématique, après `/facturation-electronique`.
 *
 * `/tarifs` et non `/offres` : c'est le mot que les gens tapent, et celui qu'ils cherchent dans
 * une barre de navigation. La section de l'accueil garde son ancre `#offres`, les liens existants
 * continuent donc de fonctionner.
 */
export const TARIFS_ROUTES: Routes = [
  {
    path: '',
    title: 'Tarifs : nos formules pour indépendants – Moze',
    loadComponent: () =>
      import('../pages/tarifs/tarifs.component').then((m) => m.TarifsComponent),
  },
];
