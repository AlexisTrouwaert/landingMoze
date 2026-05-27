import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { cleanUrlGuard } from './clean-url.guard';

describe('cleanUrlGuard', () => {
  let originalLocation: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    originalLocation = window.location;
  });

  afterEach(() => {
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    } catch {
      /* ignore */
    }
  });

  function run(queryParams: Record<string, any>): boolean | any {
    const route = { queryParams } as unknown as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() =>
      cleanUrlGuard(route, state)
    );
  }

  it('should allow navigation when no attachment_id is present', () => {
    expect(run({})).toBe(true);
    expect(run({ foo: 'bar' })).toBe(true);
  });

  it('should block and redirect when attachment_id is present', () => {
    const hrefHolder: { value: string } = { value: '' };
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...window.location,
          set href(v: string) {
            hrefHolder.value = v;
          },
          get href() {
            return hrefHolder.value;
          },
        },
      });
    } catch {
      // Si on ne peut pas redéfinir, on skip ce test.
      pending('window.location non redéfinissable dans ce navigateur');
      return;
    }

    expect(run({ attachment_id: '123' })).toBe(false);
    expect(hrefHolder.value).toBe('/');
  });

  it('should also block when attachment_id is empty string', () => {
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, href: '' },
      });
    } catch {
      pending('window.location non redéfinissable');
      return;
    }
    expect(run({ attachment_id: '' })).toBe(false);
  });
});
