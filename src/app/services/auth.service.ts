import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environements/environment';

interface LoginResponse {
  role: string;
  mustChangePassword: boolean;
}

const ROLE_KEY = 'moze_blog_role';
const MUST_CHANGE_KEY = 'moze_blog_must_change';

/**
 * Session admin du blog. Le JWT vit dans un cookie **httpOnly** géré par le back
 * (jamais accessible au JS → immunisé au vol par XSS). Le front ne conserve en
 * local que l'état d'affichage (rôle + changement de mdp requis) ; l'autorité
 * reste le cookie : un état local forgé se fait rejeter en 401 par l'API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.blogApiUrl;

  private readonly _role = signal<string | null>(this.read(ROLE_KEY));
  private readonly _mustChangePassword = signal<boolean>(
    this.read(MUST_CHANGE_KEY) === 'true',
  );

  /** Vrai si une session ADMIN est présente (état UI ; l'API tranche vraiment). */
  readonly isAdmin = computed(() => this._role() === 'ADMIN');

  /** Vrai si l'utilisateur doit changer son mot de passe initial. */
  readonly mustChangePassword = computed(() => this._mustChangePassword());

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { email, password })
      .pipe(
        tap(({ role, mustChangePassword }) => {
          this._role.set(role);
          this._mustChangePassword.set(mustChangePassword);
          this.write(ROLE_KEY, role);
          this.write(MUST_CHANGE_KEY, String(mustChangePassword));
        }),
      );
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<{ success: boolean }> {
    return this.http
      .post<{ success: boolean }>(`${this.base}/auth/change-password`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        tap(() => {
          this._mustChangePassword.set(false);
          this.write(MUST_CHANGE_KEY, 'false');
        }),
      );
  }

  changeEmail(
    password: string,
    newEmail: string,
  ): Observable<{ success: boolean; email: string }> {
    return this.http.post<{ success: boolean; email: string }>(
      `${this.base}/auth/change-email`,
      { password, newEmail },
    );
  }

  /** Déconnexion : demande au back d'effacer le cookie, puis nettoie l'état local. */
  logout(): void {
    // Best-effort : on ignore l'erreur éventuelle (ex. cookie déjà expiré).
    this.http.post(`${this.base}/auth/logout`, {}).subscribe({ error: () => {} });
    this.clearLocal();
  }

  /** Nettoie uniquement l'état local (sans appel réseau) — utilisé sur un 401. */
  clearLocal(): void {
    this._role.set(null);
    this._mustChangePassword.set(false);
    this.remove(ROLE_KEY);
    this.remove(MUST_CHANGE_KEY);
  }

  // Accès localStorage défensif (compatible SSR / pré-rendu).
  private read(key: string): string | null {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(key)
      : null;
  }
  private write(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  }
  private remove(key: string): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  }
}
