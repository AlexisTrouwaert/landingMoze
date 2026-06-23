import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('goHome() should fire FunnelAbandoned with logo + current step, then navigate to /', () => {
    fixture.detectChanges();
    const fs = TestBed.inject(FunnelService);
    spyOn(router, 'navigate');

    component.goHome();

    expect(pixel.trackFunnelAbandoned).toHaveBeenCalledWith(fs.currentStep(), 'logo');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
