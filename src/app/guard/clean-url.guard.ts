import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Anciennes URL WordPress (`/?attachment_id=123`) → accueil propre.
 *
 * On renvoie un `UrlTree` plutôt que d'écrire dans `window.location` : les
 * gardes s'exécutent aussi pendant le rendu serveur, où `window` n'existe pas.
 * Pas de boucle possible — la navigation redirigée n'a plus le paramètre, donc
 * le second passage laisse filer.
 */
export const cleanUrlGuard: CanActivateFn = (route) =>
  'attachment_id' in route.queryParams ? inject(Router).createUrlTree(['/']) : true;
