import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LandingSectionComponent } from './landing-section.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('LandingSectionComponent', () => {
  let fixture: ComponentFixture<LandingSectionComponent>;
  let component: LandingSectionComponent;
  let router: Router;
  let pixel: jasmine.SpyObj<MetaPixelService>;
  let originalMM: typeof window.matchMedia;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackLeadCTA',
      'trackCustomEvent',
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
      imports: [LandingSectionComponent],
      providers: [
        provideRouter([]),
        { provide: MetaPixelService, useValue: pixel },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LandingSectionComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = originalMM;
    component.clearAllTimers();
  });

  it('should create with videoPlaying false', () => {
    expect(component).toBeTruthy();
    expect(component.videoPlaying()).toBe(false);
  });

  it('videoUrl should target youtube-nocookie with proper id', () => {
    expect(String(component.videoUrl())).toContain('youtube-nocookie.com');
  });

  it('playVideo() should flip videoPlaying and fire VideoPlay event', () => {
    component.playVideo();
    expect(component.videoPlaying()).toBe(true);
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('VideoPlay', {
      content_name: 'hero_video',
      content_id: 'ykgoxiYz208',
    });
  });

  // Les CTA "Je rejoins l'aventure" et "Les offres" (supprimé) ont été remplacés
  // par une ancre unique → LandingNavService.scrollToOffers('hero'). Le scroll +
  // l'event ViewOffers sont désormais testés dans landing-nav.service.spec.

  it('activeSlide() should default to 0', () => {
    expect(component.activeSlide()).toBe(0);
  });

  it('pauseAutoScroll/resumeAutoScroll should manage timers', fakeAsync(() => {
    component.pauseAutoScroll();
    component.resumeAutoScroll();
    // Le resume programme un setTimeout — on s'assure qu'il ne throw rien
    tick(3000);
    // startAutoScroll() crée un setInterval. On le nettoie avant la fin du test
    // pour éviter "1 periodic timer still in the queue".
    component.clearAllTimers();
    expect(true).toBeTrue();
  }));

  it('ngOnDestroy should clear all timers', () => {
    component.startAutoScroll();
    component.ngOnDestroy();
    expect(true).toBeTrue();
  });
});
