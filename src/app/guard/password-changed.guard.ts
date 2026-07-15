import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Tant que le mot de passe initial n'est pas changé, redirige vers /admin/compte.
 * À combiner avec `adminGuard` sur les routes du dashboard/éditeur.
 */
export const passwordChangedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.mustChangePassword()
    ? router.createUrlTree(['/admin/compte'])
    : true;
};
