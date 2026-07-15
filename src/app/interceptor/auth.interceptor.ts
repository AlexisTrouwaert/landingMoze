import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environements/environment';
import { AuthService } from '../services/auth.service';

/**
 * Appels vers l'API blog qui nécessitent la session (login/logout, gestion de
 * compte, admin) : joint le cookie httpOnly via `withCredentials`. Sur un 401
 * (hors login) : nettoie l'état local et redirige vers /admin/login.
 *
 * Les lectures publiques (`/blog`) n'ont pas besoin du cookie.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const base = environment.blogApiUrl;

  const isLogin = req.url === `${base}/auth/login`;
  const needsSession =
    req.url.startsWith(`${base}/admin`) || req.url.startsWith(`${base}/auth/`);

  const request = needsSession ? req.clone({ withCredentials: true }) : req;

  return next(request).pipe(
    catchError((err) => {
      if (err?.status === 401 && needsSession && !isLogin) {
        auth.clearLocal();
        void router.navigate(['/admin/login']);
      }
      return throwError(() => err);
    }),
  );
};
