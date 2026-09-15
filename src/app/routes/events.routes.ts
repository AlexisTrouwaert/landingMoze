import { Routes } from '@angular/router';

/**
 * Pas de `title` sur ces routes : le routeur le poserait à la fin de la navigation, par-dessus
 * celui que chaque page pose elle-même (le titre de l'évènement, notamment).
 */
export const EVENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/events/events-page.component').then((m) => m.EventsPageComponent),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('../pages/events/event-page.component').then((m) => m.EventPageComponent),
  },
];
