import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environements/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  const base = environment.blogApiUrl;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['clearLocal']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('requête /admin → withCredentials = true', () => {
    http.get(`${base}/admin/blog`).subscribe();
    const req = ctrl.expectOne(`${base}/admin/blog`);
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
  });

  it('lecture publique /blog → sans credentials', () => {
    http.get(`${base}/blog`).subscribe();
    const req = ctrl.expectOne(`${base}/blog`);
    expect(req.request.withCredentials).toBe(false);
    req.flush([]);
  });

  it('401 sur /admin → clearLocal + redirection /admin/login', () => {
    http.get(`${base}/admin/blog`).subscribe({ error: () => {} });
    ctrl
      .expectOne(`${base}/admin/blog`)
      .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    expect(auth.clearLocal).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
  });

  it('401 sur le login → PAS de clearLocal (erreur remontée au formulaire)', () => {
    http.post(`${base}/auth/login`, {}).subscribe({ error: () => {} });
    ctrl
      .expectOne(`${base}/auth/login`)
      .flush('bad', { status: 401, statusText: 'Unauthorized' });
    expect(auth.clearLocal).not.toHaveBeenCalled();
  });
});
