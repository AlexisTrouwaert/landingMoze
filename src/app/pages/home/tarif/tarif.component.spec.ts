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

  it('should expose two offers including a popular one', () => {
    const offers = component.offers();
    expect(offers.length).toBe(2);
    expect(offers.find((o) => o.isPopular)).toBeTruthy();
  });

  it('Freemium offer should be free', () => {
    const f = component.offers().find((o) => o.name === 'Freemium');
    expect(f?.price).toBe('0€');
  });

  it('goToFunnel() should default tracking label to inscription_generic', () => {
    spyOn(router, 'navigate');
    component.goToFunnel();
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_generic');
    expect(router.navigate).toHaveBeenCalledWith(['/commencer']);
  });

  it('goToFunnel(label) should forward custom label', () => {
    spyOn(router, 'navigate');
    component.goToFunnel('inscription_freemium');
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_freemium');
  });
});
