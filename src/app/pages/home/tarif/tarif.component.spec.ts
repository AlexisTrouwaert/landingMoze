import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { TarifComponent } from './tarif.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('TarifComponent', () => {
  let fixture: ComponentFixture<TarifComponent>;
  let component: TarifComponent;
  let router: Router;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackLeadCTA',
    ]);
    await TestBed.configureTestingModule({
      imports: [TarifComponent],
      providers: [
        provideRouter([]),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose three offers including a popular and a social one', () => {
    const offers = component.offers();
    expect(offers.length).toBe(3);
    expect(offers.find((o) => o.isPopular)).toBeTruthy();
    expect(offers.find((o) => o.isSocial)).toBeTruthy();
  });

  it('the social offer should route to the réseau funnel', () => {
    const social = component.offers().find((o) => o.isSocial);
    expect(social?.route).toBe('/rejoindre');
  });

  it('Freemium offer should be free', () => {
    const f = component.offers().find((o) => o.name === 'Freemium');
    expect(f?.price).toBe('0€');
  });

  it('goToFunnel() should default to inscription_generic on the facturation funnel', () => {
    spyOn(router, 'navigate');
    pixel.trackLeadCTA.and.callFake((_label: string, _funnel: string, cb?: () => void) => cb?.());
    component.goToFunnel();
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_generic', 'facturation', jasmine.any(Function));
    expect(router.navigate).toHaveBeenCalledWith(['/commencer']);
  });

  it('goToFunnel(label, route) should forward label and derive the funnel from the route', () => {
    spyOn(router, 'navigate');
    pixel.trackLeadCTA.and.callFake((_label: string, _funnel: string, cb?: () => void) => cb?.());

    component.goToFunnel('inscription_freemium', '/commencer');
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_freemium', 'facturation', jasmine.any(Function));

    component.goToFunnel('inscription_reseau_social', '/rejoindre');
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_reseau_social', 'reseau', jasmine.any(Function));
    expect(router.navigate).toHaveBeenCalledWith(['/rejoindre']);
  });
});
