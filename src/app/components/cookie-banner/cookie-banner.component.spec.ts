import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CookieBannerComponent } from './cookie-banner.component';

describe('CookieBannerComponent', () => {
  let fixture: ComponentFixture<CookieBannerComponent>;
  let component: CookieBannerComponent;
  let originalMM: typeof window.matchMedia;

  function mockDesktop(isDesktop: boolean) {
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes('min-width: 561px') ? isDesktop : false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as any)) as any;
  }

  beforeEach(async () => {
    originalMM = window.matchMedia;
    await TestBed.configureTestingModule({
      imports: [CookieBannerComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    window.matchMedia = originalMM;
  });

  function build() {
    fixture = TestBed.createComponent(CookieBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    mockDesktop(false);
    build();
    expect(component).toBeTruthy();
  });

  it('should start with drawer view on desktop', () => {
    mockDesktop(true);
    build();
    expect(component.viewState()).toBe('drawer');
  });

  it('should start with pill view on mobile', () => {
    mockDesktop(false);
    build();
    expect(component.viewState()).toBe('pill');
  });

  it('desktop: drawer should auto-collapse to pill after 10s', fakeAsync(() => {
    mockDesktop(true);
    build();
    expect(component.viewState()).toBe('drawer');
    tick(10000);
    expect(component.viewState()).toBe('pill');
    // clean up the loop timer
    fixture.destroy();
  }));

  it('mobile: pill should switch to pill-active after 5s and back after 10 more', fakeAsync(() => {
    mockDesktop(false);
    build();
    tick(5000);
    expect(component.viewState()).toBe('pill-active');
    tick(10000);
    expect(component.viewState()).toBe('pill');
    fixture.destroy();
  }));

  it('showDrawer() should open the drawer and clear pending timers', fakeAsync(() => {
    mockDesktop(false);
    build();
    component.showDrawer();
    expect(component.viewState()).toBe('drawer');
    tick(20000);
    // viewState reste drawer (la loop ne reprend que via showPill)
    expect(component.viewState()).toBe('drawer');
    fixture.destroy();
  }));

  it('showPill() should reset to pill and restart the loop', fakeAsync(() => {
    mockDesktop(true);
    build();
    component.showDrawer();
    component.showPill();
    expect(component.viewState()).toBe('pill');
    tick(5000);
    expect(component.viewState()).toBe('pill-active');
    fixture.destroy();
  }));

  it('ngOnDestroy should clear active timer (no late state change)', fakeAsync(() => {
    mockDesktop(false);
    build();
    component.ngOnDestroy();
    tick(60000);
    expect(component.viewState()).toBe('pill');
  }));
});
