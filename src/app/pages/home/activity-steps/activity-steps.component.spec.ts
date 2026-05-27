import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ActivityStepsComponent } from './activity-steps.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('ActivityStepsComponent', () => {
  let fixture: ComponentFixture<ActivityStepsComponent>;
  let component: ActivityStepsComponent;
  let router: Router;
  let pixel: jasmine.SpyObj<MetaPixelService>;
  let originalMM: typeof window.matchMedia;

  function mockMatch(matchers: Record<string, boolean>) {
    window.matchMedia = ((q: string) => {
      const matches = Object.entries(matchers).some(
        ([k, v]) => v && q.includes(k)
      );
      return {
        matches,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as any;
    }) as any;
  }

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackLeadCTA',
    ]);
    originalMM = window.matchMedia;
    mockMatch({}); // pas de hover none, pas de reduced motion
    await TestBed.configureTestingModule({
      imports: [ActivityStepsComponent],
      providers: [
        provideRouter([]),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivityStepsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = originalMM;
  });

  it('should create with 4 steps', () => {
    expect(component).toBeTruthy();
    expect(component.steps().length).toBe(4);
  });

  it('every step should have num, pill, title, desc and theme', () => {
    component.steps().forEach((s) => {
      expect(s.num).toMatch(/^\d{2}$/);
      expect(s.pill).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.desc).toBeTruthy();
      expect(['green', 'dark']).toContain(s.theme);
    });
  });

  it('goToFunnel() should track + navigate', () => {
    spyOn(router, 'navigate');
    component.goToFunnel();
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_generic');
    expect(router.navigate).toHaveBeenCalledWith(['/commencer']);
  });

  it('onCardMouseMove should apply a perspective transform', () => {
    const card = document.createElement('div');
    spyOn(card, 'getBoundingClientRect').and.returnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect);
    component.onCardMouseMove({
      currentTarget: card,
      clientX: 200,
      clientY: 0,
    } as any);
    expect(card.style.transform).toContain('perspective(900px)');
    expect(card.style.transform).toContain('rotateX');
    expect(card.style.transform).toContain('rotateY');
  });

  it('onCardMouseMove should bail out when hover:none', () => {
    mockMatch({ 'hover: none': true });
    const card = document.createElement('div');
    component.onCardMouseMove({
      currentTarget: card,
      clientX: 1,
      clientY: 1,
    } as any);
    expect(card.style.transform).toBe('');
  });

  it('onCardMouseMove should bail out when prefers-reduced-motion', () => {
    mockMatch({ reduce: true });
    const card = document.createElement('div');
    component.onCardMouseMove({
      currentTarget: card,
      clientX: 1,
      clientY: 1,
    } as any);
    expect(card.style.transform).toBe('');
  });

  it('onCardMouseLeave should reset transform', () => {
    const card = document.createElement('div');
    card.style.transform = 'rotateX(5deg)';
    component.onCardMouseLeave({ currentTarget: card } as any);
    expect(card.style.transform).toBe('');
  });

  it('onCardMouseLeave should be a no-op on hover:none', () => {
    mockMatch({ 'hover: none': true });
    const card = document.createElement('div');
    card.style.transform = 'rotateX(5deg)';
    component.onCardMouseLeave({ currentTarget: card } as any);
    expect(card.style.transform).toBe('rotateX(5deg)');
  });
});
