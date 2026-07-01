import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protège les routes /admin/** côté front. Protection **cosmétique** : la vraie
 * sécurité est côté back (JWT + rôle ADMIN). Redirige vers /admin/login sinon.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAdmin() ? true : router.createUrlTree(['/admin/login']);
};
