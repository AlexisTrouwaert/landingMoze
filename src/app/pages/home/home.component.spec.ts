import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { HomeComponent } from './home.component';
import { MetaPixelService } from '../../services/meta-pixel.service';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let pixel: jasmine.SpyObj<MetaPixelService>;
  let originalMM: typeof window.matchMedia;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackViewContent',
      'resetViewContent',
      'trackLeadCTA',
      'trackCustomEvent',
      'trackPageView',
      'trackFunnelStarted',
      'trackPurchase',
      'trackSubscribe',
    ]);
    originalMM = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({
        matches: false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as any)) as any;

    await TestBed.configureTestingModule({
      imports: [HomeComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    window.matchMedia = originalMM;
    fixture?.destroy();
  });

  it('should create and fire trackViewContent on init', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(pixel.trackViewContent).toHaveBeenCalled();
  });

  it('should fire resetViewContent on destroy', () => {
    fixture.detectChanges();
    fixture.destroy();
    expect(pixel.resetViewContent).toHaveBeenCalled();
  });

  it('screenSize() should default to a positive number', () => {
    fixture.detectChanges();
    expect(component.screenSize()).toBeGreaterThan(0);
  });
});
