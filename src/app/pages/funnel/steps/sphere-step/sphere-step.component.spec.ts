import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SphereStepComponent } from './sphere-step.component';
import { FunnelService } from '../../../../services/funnel.service';
import { MetaPixelService } from '../../../../services/meta-pixel.service';

describe('SphereStepComponent', () => {
  let fixture: ComponentFixture<SphereStepComponent>;
  let component: SphereStepComponent;
  let fs: FunnelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SphereStepComponent],
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

    fixture = TestBed.createComponent(SphereStepComponent);
    component = fixture.componentInstance;
    fs = TestBed.inject(FunnelService);
    fixture.detectChanges();
  });

  it('should create with at least one sphere', () => {
    expect(component).toBeTruthy();
    expect(component.spheres().length).toBeGreaterThan(0);
  });

  it('every sphere should have id, name, emoji, location, tags and inviteLink', () => {
    component.spheres().forEach((s) => {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(s.location).toBeTruthy();
      expect(Array.isArray(s.tags)).toBe(true);
      expect(typeof s.inviteLink).toBe('string');
    });
  });

  it('should feature the first sphere by default', () => {
    expect(component.activeSphere()).toEqual(component.spheres()[0]);
  });

  it('select(sphere) should change the active sphere without advancing', () => {
    fs.startFunnel('reseau'); // step 1
    const second = component.spheres()[1];

    component.select(second);

    expect(component.activeSphere()).toEqual(second);
    expect(fs.currentStep()).toBe(1); // pas d'avancement tant qu'on n'a pas validé
  });

  it('select(sphere) should bring it to the featured slot (slot 0) and push the previous one back', () => {
    const all = component.spheres();

    component.select(all[2]);

    expect(component.activeSphere()).toEqual(all[2]);
    expect(component.slotOf(2)).toBe(0);
    // la carte précédemment en vedette recule dans la pile
    expect(component.slotOf(0)).toBeGreaterThan(0);
  });

  it('confirm() should store the active sphere and advance to the next step', () => {
    fs.startFunnel('reseau'); // step 1
    const target = component.spheres()[2];
    component.select(target);

    component.confirm();

    expect(fs.selectedSphere()).toEqual(target);
    expect(fs.currentStep()).toBe(2);
  });
});
