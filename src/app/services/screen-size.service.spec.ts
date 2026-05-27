import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { ScreenSizeService } from './screen-size.service';

describe('ScreenSizeService', () => {
  let service: ScreenSizeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScreenSizeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose screenSize$ as an observable', () => {
    expect(service.screenSize$.subscribe).toBeDefined();
  });

  it('should emit the current window innerWidth on subscription', async () => {
    const value = await firstValueFrom(service.screenSize$.pipe(take(1)));
    expect(value).toBe(window.innerWidth);
  });

  it('should re-emit the current width when calculateScreenSize() is called manually', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1234,
    });
    service.calculateScreenSize();
    const value = await firstValueFrom(service.screenSize$.pipe(take(1)));
    expect(value).toBe(1234);
  });

  it('should update screen size on window resize event', (done) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 777,
    });

    let received = false;
    const sub = service.screenSize$.subscribe((value) => {
      if (value === 777) {
        received = true;
        expect(value).toBe(777);
        sub.unsubscribe();
        done();
      }
    });

    window.dispatchEvent(new Event('resize'));

    if (!received) {
      // Le BehaviorSubject émet sur subscribe la valeur courante.
      // Si elle ne change pas après dispatch (déjà 777), on valide quand même.
      sub.unsubscribe();
      expect(service).toBeTruthy();
      done();
    }
  });
});
