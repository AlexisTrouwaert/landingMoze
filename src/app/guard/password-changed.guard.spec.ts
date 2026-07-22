import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { passwordChangedGuard } from './password-changed.guard';
import { AuthService } from '../services/auth.service';

describe('passwordChangedGuard', () => {
  let auth: { mustChangePassword: jasmine.Spy };
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    auth = { mustChangePassword: jasmine.createSpy('mustChangePassword') };
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  const run = () =>
    TestBed.runInInjectionContext(() =>
      passwordChangedGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  it('mot de passe déjà changé → true', () => {
    auth.mustChangePassword.and.returnValue(false);
    expect(run()).toBe(true);
  });

  it('mot de passe à changer → redirige vers /admin/compte', () => {
    auth.mustChangePassword.and.returnValue(true);
    const tree = {} as UrlTree;
    router.createUrlTree.and.returnValue(tree);
    expect(run()).toBe(tree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/compte']);
  });
});
