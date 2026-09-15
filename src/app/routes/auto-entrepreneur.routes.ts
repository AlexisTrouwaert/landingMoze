import { Routes } from '@angular/router';

/**
 * Page « Auto-entrepreneur » — sixième page du silo.
 *
 * `/auto-entrepreneur` et non `/micro-entreprise` : les deux désignent le même régime, mais c'est
 * le premier terme qui est tapé, et de loin. Le second est mentionné dans le corps de la page,
 * ce qui suffit à couvrir la requête sans lui consacrer une URL de plus.
 *
 * L'année vit dans le `title`, pas dans le chemin : les chiffres sont revalorisés chaque année,
 * l'adresse ne doit pas l'être.
 */
export const AUTO_ENTREPRENEUR_ROUTES: Routes = [
  {
    path: '',
    title: 'Auto-entrepreneur 2026 : plafonds, TVA et cotisations – Moze',
    loadComponent: () =>
      import('../pages/auto-entrepreneur/auto-entrepreneur.component').then(
        (m) => m.AutoEntrepreneurComponent,
      ),
  },
];
