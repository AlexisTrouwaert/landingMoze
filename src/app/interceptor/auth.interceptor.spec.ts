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

  /**
   * Le compteur de vues doit voir la session — le back s'en sert pour ne pas comptabiliser
   * l'équipe qui relit ses propres articles — sans pour autant en dépendre : la route reste
   * publique, un lecteur anonyme n'a rien à envoyer.
   */
  describe('ping de vue', () => {
    it('joint le cookie de session', () => {
      http.post(`${base}/blog/mon-article/view`, {}).subscribe();

      const req = ctrl.expectOne(`${base}/blog/mon-article/view`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('les lectures publiques, elles, restent sans cookie', () => {
      http.get(`${base}/blog/mon-article`).subscribe();

      const req = ctrl.expectOne(`${base}/blog/mon-article`);
      expect(req.request.withCredentials).toBeFalse();
      req.flush({});
    });

    it('un 401 n’y déclenche aucune redirection : la route est publique', () => {
      http.post(`${base}/blog/mon-article/view`, {}).subscribe({ error: () => {} });
      ctrl
        .expectOne(`${base}/blog/mon-article/view`)
        .flush('nope', { status: 401, statusText: 'Unauthorized' });

      expect(auth.clearLocal).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
