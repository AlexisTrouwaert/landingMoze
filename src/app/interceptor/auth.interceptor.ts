import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environements/environment';
import { AuthService } from '../services/auth.service';

/**
 * Sur les appels authentifiés du back blog (admin + gestion de compte) :
 * ajoute `Authorization: Bearer <token>`. Sur un 401 de ces appels (session
 * invalide/expirée) : déconnecte et redirige vers /admin/login.
 *
 * Le login (`/auth/login`) n'a pas de token ; les lectures publiques (`/blog`)
 * non plus.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const base = environment.blogApiUrl;

  const isLogin = req.url === `${base}/auth/login`;
  const isAuthenticated =
    req.url.startsWith(`${base}/admin`) ||
    (req.url.startsWith(`${base}/auth/`) && !isLogin);

  const token = auth.token();
  const request =
    isAuthenticated && token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((err) => {
      if (err?.status === 401 && isAuthenticated) {
        auth.logout();
        void router.navigate(['/admin/login']);
      }
      return throwError(() => err);
    }),
  );
};
