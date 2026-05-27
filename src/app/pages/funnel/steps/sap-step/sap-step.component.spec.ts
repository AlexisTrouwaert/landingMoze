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

  it('openInfo() should pop an alert with the SAP info copy', () => {
    const spy = spyOn(window, 'alert');
    component.openInfo();
    expect(spy).toHaveBeenCalled();
    expect(spy.calls.mostRecent().args[0]).toContain('crédit');
  });
});
