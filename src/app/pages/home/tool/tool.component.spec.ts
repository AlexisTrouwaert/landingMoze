import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ToolComponent } from './tool.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('ToolComponent', () => {
  let fixture: ComponentFixture<ToolComponent>;
  let component: ToolComponent;
  let router: Router;
  let pixel: jasmine.SpyObj<MetaPixelService>;
  let originalMM: typeof window.matchMedia;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackLeadCTA',
    ]);
    originalMM = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({
        matches: false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as any)) as any;
    await TestBed.configureTestingModule({
      imports: [ToolComponent],
      providers: [
        provideRouter([]),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ToolComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = originalMM;
  });

  it('should create with features', () => {
    expect(component).toBeTruthy();
    expect(component.features().length).toBeGreaterThan(0);
  });

  it('every feature should have title chunks, description and badge', () => {
    component.features().forEach((f) => {
      expect(f.t1).toBeTruthy();
      expect(f.t2).toBeTruthy();
      expect(f.desc).toBeTruthy();
      expect(f.badge).toBeTruthy();
    });
  });

  it('goToFunnel() should fire pixel and navigate', () => {
    spyOn(router, 'navigate');
    component.goToFunnel();
    expect(pixel.trackLeadCTA).toHaveBeenCalledWith('inscription_generic');
    expect(router.navigate).toHaveBeenCalledWith(['/commencer']);
  });

  it('onCardMouseMove should set --mx/--my CSS variables', () => {
    const card = document.createElement('div');
    spyOn(card, 'getBoundingClientRect').and.returnValue({
      left: 10,
      top: 20,
      width: 100,
      height: 100,
      right: 110,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON() {},
    } as DOMRect);
    const event = {
      currentTarget: card,
      clientX: 60,
      clientY: 70,
    } as unknown as MouseEvent;
    component.onCardMouseMove(event);
    expect(card.style.getPropertyValue('--mx')).toBe('50px');
    expect(card.style.getPropertyValue('--my')).toBe('50px');
  });

  it('onCardMouseMove should bail out when prefers-reduced-motion is set', () => {
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes('reduce'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      } as any)) as any;
    const card = document.createElement('div');
    const event = {
      currentTarget: card,
      clientX: 10,
      clientY: 10,
    } as unknown as MouseEvent;
    component.onCardMouseMove(event);
    expect(card.style.getPropertyValue('--mx')).toBe('');
  });

  it('onCardMouseLeave should park the spotlight off-card', () => {
    const card = document.createElement('div');
    const event = { currentTarget: card } as unknown as MouseEvent;
    component.onCardMouseLeave(event);
    expect(card.style.getPropertyValue('--mx')).toBe('-9999px');
    expect(card.style.getPropertyValue('--my')).toBe('-9999px');
  });
});
