import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FunnelComponent } from './funnel.component';
import { FunnelService } from '../../services/funnel.service';
import { MetaPixelService } from '../../services/meta-pixel.service';

describe('FunnelComponent', () => {
  let fixture: ComponentFixture<FunnelComponent>;
  let component: FunnelComponent;
  let pixel: jasmine.SpyObj<MetaPixelService>;
  let router: Router;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackFunnelStarted',
      'trackFunnelAbandoned',
      'trackFunnelStep1Completed',
      'trackFunnelStep2Completed',
    ]);

    await TestBed.configureTestingModule({
      imports: [FunnelComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FunnelComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('ngOnInit should fire trackFunnelStarted', () => {
    fixture.detectChanges();
    expect(pixel.trackFunnelStarted).toHaveBeenCalledTimes(1);
  });

  it('goHome() should fire FunnelAbandoned (logo) then navigate to / after a short delay', fakeAsync(() => {
    fixture.detectChanges();
    const fs = TestBed.inject(FunnelService);
    spyOn(router, 'navigate');

    component.goHome();

    expect(pixel.trackFunnelAbandoned).toHaveBeenCalledWith(fs.currentStep(), 'logo', 'facturation');
    expect(router.navigate).not.toHaveBeenCalled(); // délai pas encore écoulé
    tick(300);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  }));

  it('back() from step 1 should fire abandon (back_button) then navigate to / after a short delay', fakeAsync(() => {
    fixture.detectChanges(); // ngOnInit → startFunnel → step 1
    spyOn(router, 'navigate');

    component.back();

    expect(pixel.trackFunnelAbandoned).toHaveBeenCalledWith(1, 'back_button', 'facturation');
    expect(router.navigate).not.toHaveBeenCalled();
    tick(300);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  }));

  it('back() from a later step should step back, without abandon nor navigation', () => {
    fixture.detectChanges();
    const fs = TestBed.inject(FunnelService);
    fs.nextStep(); // step 2
    pixel.trackFunnelAbandoned.calls.reset();
    spyOn(router, 'navigate');

    component.back();

    expect(fs.currentStep()).toBe(1);
    expect(pixel.trackFunnelAbandoned).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
