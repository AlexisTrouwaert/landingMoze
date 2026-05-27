import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { SeoService } from './seo.service';

describe('SeoService', () => {
  let events$: Subject<any>;
  let metaUpdateSpy: jasmine.Spy;
  let metaRemoveSpy: jasmine.Spy;
  let activatedRouteSnapshot: any;

  beforeEach(() => {
    events$ = new Subject<any>();
    activatedRouteSnapshot = { firstChild: null, data: {} };

    const routerMock = {
      events: events$.asObservable(),
    };

    const activatedRouteMock = {
      snapshot: activatedRouteSnapshot,
    };

    const metaMock = {
      updateTag: jasmine.createSpy('updateTag'),
      removeTag: jasmine.createSpy('removeTag'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: Meta, useValue: metaMock },
      ],
    });

    metaUpdateSpy = metaMock.updateTag;
    metaRemoveSpy = metaMock.removeTag;
  });

  it('should be created', () => {
    const service = TestBed.inject(SeoService);
    expect(service).toBeTruthy();
  });

  function flush() {
    const tb = TestBed as any;
    if (typeof tb.flushEffects === 'function') {
      tb.flushEffects();
    } else if (typeof tb.tick === 'function') {
      tb.tick();
    }
  }

  it('should remove robots meta tag by default (no route data)', () => {
    TestBed.inject(SeoService);
    flush();
    expect(metaRemoveSpy).toHaveBeenCalledWith('name="robots"');
    expect(metaUpdateSpy).not.toHaveBeenCalled();
  });

  it('should add noindex robots meta tag when data.noindex is true', () => {
    activatedRouteSnapshot.data = {};
    activatedRouteSnapshot.firstChild = {
      firstChild: null,
      data: { noindex: true },
    };

    TestBed.inject(SeoService);
    events$.next(new NavigationEnd(1, '/legal', '/legal'));
    flush();

    expect(metaUpdateSpy).toHaveBeenCalledWith({
      name: 'robots',
      content: 'noindex, nofollow',
    });
  });

  it('should walk down nested child routes to find data', () => {
    activatedRouteSnapshot.firstChild = {
      firstChild: {
        firstChild: null,
        data: { noindex: true },
      },
      data: {},
    };

    TestBed.inject(SeoService);
    events$.next(new NavigationEnd(1, '/a/b', '/a/b'));
    flush();

    expect(metaUpdateSpy).toHaveBeenCalledWith({
      name: 'robots',
      content: 'noindex, nofollow',
    });
  });

  it('should remove robots meta when noindex is missing', () => {
    activatedRouteSnapshot.firstChild = {
      firstChild: null,
      data: {},
    };

    TestBed.inject(SeoService);
    events$.next(new NavigationEnd(1, '/home', '/home'));
    flush();

    expect(metaRemoveSpy).toHaveBeenCalledWith('name="robots"');
  });
});
