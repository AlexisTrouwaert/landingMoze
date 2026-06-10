import { TestBed } from '@angular/core/testing';

import { LandingNavService } from './landing-nav.service';
import { MetaPixelService } from './meta-pixel.service';

describe('LandingNavService', () => {
  let service: LandingNavService;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(() => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackCustomEvent',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: MetaPixelService, useValue: pixel }],
    });
    service = TestBed.inject(LandingNavService);
  });

  afterEach(() => {
    document.querySelectorAll('app-tarif').forEach((n) => n.remove());
  });

  it('should fire ViewOffers with the source and scroll to app-tarif', () => {
    const tarif = document.createElement('app-tarif');
    const scrollSpy = jasmine.createSpy('scrollIntoView');
    (tarif as any).scrollIntoView = scrollSpy;
    document.body.appendChild(tarif);

    service.scrollToOffers('header');

    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('ViewOffers', {
      source: 'header',
    });
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('should fire ViewOffers with empty data when no source is given', () => {
    service.scrollToOffers();
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('ViewOffers', {});
  });

  it('should not throw when app-tarif is absent from the DOM', () => {
    document.querySelectorAll('app-tarif').forEach((n) => n.remove());
    expect(() => service.scrollToOffers('hero')).not.toThrow();
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('ViewOffers', {
      source: 'hero',
    });
  });
});
