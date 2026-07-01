import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environements/environment';

interface LoginResponse {
  token: string;
  role: string;
  mustChangePassword: boolean;
}

const TOKEN_KEY = 'moze_blog_token';
const ROLE_KEY = 'moze_blog_role';
const MUST_CHANGE_KEY = 'moze_blog_must_change';

/**
 * Session admin du blog (côté landing). Le token JWT est conservé en mémoire
 * (signal) + `localStorage` pour persister la session entre rechargements.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.blogApiUrl;

  private readonly _token = signal<string | null>(this.read(TOKEN_KEY));
  private readonly _role = signal<string | null>(this.read(ROLE_KEY));
  private readonly _mustChangePassword = signal<boolean>(
    this.read(MUST_CHANGE_KEY) === 'true',
  );

  /** Vrai si une session ADMIN valide est présente. */
  readonly isAdmin = computed(
    () => this._role() === 'ADMIN' && !!this._token(),
  );

  /** Vrai si l'utilisateur doit changer son mot de passe initial. */
  readonly mustChangePassword = computed(() => this._mustChangePassword());

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { email, password })
      .pipe(
        tap(({ token, role, mustChangePassword }) => {
          this._token.set(token);
          this._role.set(role);
          this._mustChangePassword.set(mustChangePassword);
          this.write(TOKEN_KEY, token);
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

  logout(): void {
    this._token.set(null);
    this._role.set(null);
    this._mustChangePassword.set(false);
    this.remove(TOKEN_KEY);
    this.remove(ROLE_KEY);
    this.remove(MUST_CHANGE_KEY);
  }

  token(): string | null {
    return this._token();
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
