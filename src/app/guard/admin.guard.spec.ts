import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('adminGuard', () => {
  let auth: { isAdmin: jasmine.Spy };
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    auth = { isAdmin: jasmine.createSpy('isAdmin') };
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
      adminGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  it('admin connecté → true', () => {
    auth.isAdmin.and.returnValue(true);
    expect(run()).toBe(true);
  });

  it('non connecté → redirige vers /admin/login', () => {
    auth.isAdmin.and.returnValue(false);
    const tree = {} as UrlTree;
    router.createUrlTree.and.returnValue(tree);
    expect(run()).toBe(tree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/login']);
  });
});
