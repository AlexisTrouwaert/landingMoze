import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SectorStepComponent } from './sector-step.component';
import { FunnelService, SectorType } from '../../../../services/funnel.service';
import { MetaPixelService } from '../../../../services/meta-pixel.service';

describe('SectorStepComponent', () => {
  let fixture: ComponentFixture<SectorStepComponent>;
  let component: SectorStepComponent;
  let fs: FunnelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectorStepComponent],
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

    fixture = TestBed.createComponent(SectorStepComponent);
    component = fixture.componentInstance;
    fs = TestBed.inject(FunnelService);
    fixture.detectChanges();
  });

  it('should create with no hover and DEFAULT image', () => {
    expect(component).toBeTruthy();
    expect(component.hoveredSector()).toBeNull();
    expect(component.currentImage()).toBe(component.imageMap['DEFAULT']);
  });

  const sectors: SectorType[] = [
    'SANTE',
    'SAP',
    'BTP',
    'CREATIF',
    'CONSEIL',
    'IMMO',
    'AUTRE',
  ];

  sectors.forEach((s) => {
    it(`onMouseEnter('${s}') should switch image to the matching one`, () => {
      component.onMouseEnter(s);
      expect(component.hoveredSector()).toBe(s);
      expect(component.currentImage()).toBe(component.imageMap[s]);
    });
  });

  it('onMouseLeave should clear hovered sector and revert to DEFAULT', () => {
    component.onMouseEnter('SAP');
    component.onMouseLeave();
    expect(component.hoveredSector()).toBeNull();
    expect(component.currentImage()).toBe(component.imageMap['DEFAULT']);
  });

  it('select(sector) should delegate to FunnelService.setSector', () => {
    const spy = spyOn(fs, 'setSector');
    component.select('BTP');
    expect(spy).toHaveBeenCalledWith('BTP');
  });

  it('imageMap should contain DEFAULT plus all SectorType entries', () => {
    expect(component.imageMap['DEFAULT']).toBeTruthy();
    sectors.forEach((s) => expect(component.imageMap[s]).toBeTruthy());
  });
});
