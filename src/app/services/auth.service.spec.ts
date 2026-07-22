import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { environment } from '../../environements/environment';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const base = environment.blogApiUrl;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('démarre déconnecté', () => {
    expect(service.isAdmin()).toBe(false);
    expect(service.mustChangePassword()).toBe(false);
  });

  it('login ADMIN → isAdmin true + persistance locale', () => {
    service.login('a@b.fr', 'pw').subscribe();
    const req = http.expectOne(`${base}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.fr', password: 'pw' });
    req.flush({ role: 'ADMIN', mustChangePassword: true });

    expect(service.isAdmin()).toBe(true);
    expect(service.mustChangePassword()).toBe(true);
    expect(localStorage.getItem('moze_blog_role')).toBe('ADMIN');
    expect(localStorage.getItem('moze_blog_must_change')).toBe('true');
  });

  it('changePassword → mustChangePassword repasse à false', () => {
    service.login('a@b.fr', 'pw').subscribe();
    http
      .expectOne(`${base}/auth/login`)
      .flush({ role: 'ADMIN', mustChangePassword: true });
    expect(service.mustChangePassword()).toBe(true);

    service.changePassword('old', 'new').subscribe();
    const req = http.expectOne(`${base}/auth/change-password`);
    expect(req.request.body).toEqual({
      currentPassword: 'old',
      newPassword: 'new',
    });
    req.flush({ success: true });
    expect(service.mustChangePassword()).toBe(false);
  });

  it('logout → POST /auth/logout + état local nettoyé (synchrone)', () => {
    service.login('a@b.fr', 'pw').subscribe();
    http
      .expectOne(`${base}/auth/login`)
      .flush({ role: 'ADMIN', mustChangePassword: false });
    expect(service.isAdmin()).toBe(true);

    service.logout();
    // clearLocal() est synchrone : l'UI est déjà déconnectée.
    expect(service.isAdmin()).toBe(false);
    expect(localStorage.getItem('moze_blog_role')).toBeNull();
    http.expectOne(`${base}/auth/logout`).flush({});
  });

  it('clearLocal → réinitialise sans appel réseau', () => {
    service.login('a@b.fr', 'pw').subscribe();
    http
      .expectOne(`${base}/auth/login`)
      .flush({ role: 'ADMIN', mustChangePassword: false });

    service.clearLocal();
    expect(service.isAdmin()).toBe(false);
    // Aucune requête réseau (http.verify() en afterEach le garantit).
  });
});
