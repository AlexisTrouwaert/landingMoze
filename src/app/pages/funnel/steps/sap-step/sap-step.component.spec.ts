import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SapStepComponent } from './sap-step.component';
import { FunnelService } from '../../../../services/funnel.service';
import { MetaPixelService } from '../../../../services/meta-pixel.service';

describe('SapStepComponent', () => {
  let fixture: ComponentFixture<SapStepComponent>;
  let component: SapStepComponent;
  let fs: FunnelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SapStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MetaPixelService,
          useValue: jasmine.createSpyObj('MetaPixelService', [
            'trackFunnelStep1Completed',
            'trackFunnelStep2Completed',
            'trackFunnelAbandoned',
          ]),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SapStepComponent);
    component = fixture.componentInstance;
    fs = TestBed.inject(FunnelService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('selectOption(true) should delegate to FunnelService.setHasSapNumber', () => {
    const spy = spyOn(fs, 'setHasSapNumber');
    component.selectOption(true);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('selectOption(false) should delegate with false', () => {
    const spy = spyOn(fs, 'setHasSapNumber');
    component.selectOption(false);
    expect(spy).toHaveBeenCalledWith(false);
  });

  // L'info passe désormais par une vraie modale (ConfirmDialog), plus par alert().
  it('openInfo() ouvre la modale d\'info (fermée au départ)', () => {
    expect(component.showInfo()).toBe(false);
    component.openInfo();
    expect(component.showInfo()).toBe(true);
  });
});
