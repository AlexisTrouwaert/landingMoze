import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import {
  MediaItem,
  MediaPressComponent,
} from './media-press.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('MediaPressComponent', () => {
  let fixture: ComponentFixture<MediaPressComponent>;
  let component: MediaPressComponent;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackCustomEvent',
    ]);
    await TestBed.configureTestingModule({
      imports: [MediaPressComponent, NoopAnimationsModule],
      providers: [{ provide: MetaPixelService, useValue: pixel }],
    }).compileComponents();
    fixture = TestBed.createComponent(MediaPressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.pauseCarousel();
  });

  it('should create with first media active', () => {
    expect(component).toBeTruthy();
    expect(component.activeMediaId()).toBe(component.medias()[0].id);
  });

  it('groupedMedias should contain each category once and in order TV/Radio/Presse/Podcast', () => {
    const order = component.groupedMedias().map((g) => g.category);
    expect(order).toEqual(['TV', 'Radio', 'Presse', 'Podcast']);
  });

  it('activeMedia should reflect activeMediaId', () => {
    const second = component.medias()[1];
    component.activeMediaId.set(second.id);
    expect(component.activeMedia()?.id).toBe(second.id);
  });

  it('selectMedia should set activeMediaId and fire MediaInteraction', () => {
    const target = component.medias()[2];
    component.selectMedia(target.id);
    expect(component.activeMediaId()).toBe(target.id);
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('MediaInteraction', {
      category: target.category,
      media_id: target.id,
      media_name: target.name,
      action: 'select',
    });
  });

  it('onMediaLinkOpen should fire open_link event', () => {
    const m = component.medias()[0];
    component.onMediaLinkOpen(m);
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('MediaInteraction', {
      category: m.category,
      media_id: m.id,
      media_name: m.name,
      action: 'open_link',
    });
  });

  it('onActiveMediaLinkOpen should fire open_link for the active media', () => {
    component.onActiveMediaLinkOpen();
    const m = component.activeMedia()!;
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('MediaInteraction', {
      category: m.category,
      media_id: m.id,
      media_name: m.name,
      action: 'open_link',
    });
  });

  it('isUpcoming returns false for past dates', () => {
    const fake: MediaItem = {
      id: 'past',
      category: 'TV',
      name: 'x',
      show: 'y',
      date: '01/01/2000',
      upcoming: true,
    };
    expect(component.isUpcoming(fake)).toBe(false);
  });

  it('isUpcoming returns true for future dates', () => {
    const fake: MediaItem = {
      id: 'future',
      category: 'TV',
      name: 'x',
      show: 'y',
      date: '01/01/2999',
      upcoming: true,
    };
    expect(component.isUpcoming(fake)).toBe(true);
  });

  it('isUpcoming returns false when upcoming flag missing', () => {
    expect(
      component.isUpcoming({
        id: 'a',
        category: 'TV',
        name: 'x',
        show: 'y',
      })
    ).toBe(false);
  });

  it('isUpcoming returns true when upcoming is set but date is missing/unparseable', () => {
    expect(
      component.isUpcoming({
        id: 'a',
        category: 'TV',
        name: 'x',
        show: 'y',
        upcoming: true,
      })
    ).toBe(true);
  });

  it('upcomingLabel returns J-X for future dates', () => {
    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + 5);
    const dd = String(target.getDate()).padStart(2, '0');
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const yy = target.getFullYear();
    const label = component.upcomingLabel({
      id: 'a',
      category: 'TV',
      name: 'x',
      show: 'y',
      upcoming: true,
      date: `${dd}/${mm}/${yy}`,
    });
    expect(label).toBe('J - 5');
  });

  it('upcomingLabel returns JOUR J when target is today', () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = now.getFullYear();
    const label = component.upcomingLabel({
      id: 'a',
      category: 'TV',
      name: 'x',
      show: 'y',
      upcoming: true,
      date: `${dd}/${mm}/${yy}`,
    });
    expect(label).toBe('JOUR J');
  });

  it('upcomingLabel returns À VENIR when upcoming but no parseable date', () => {
    expect(
      component.upcomingLabel({
        id: 'a',
        category: 'TV',
        name: 'x',
        show: 'y',
        upcoming: true,
      })
    ).toBe('À VENIR');
  });

  it('upcomingLabel returns empty string when not upcoming', () => {
    expect(
      component.upcomingLabel({
        id: 'a',
        category: 'TV',
        name: 'x',
        show: 'y',
      })
    ).toBe('');
  });

  it('pauseCarousel should not throw and resumeCarousel should restart', () => {
    expect(() => {
      component.pauseCarousel();
      component.resumeCarousel();
    }).not.toThrow();
  });

  it('selectMedia followed by 3.5s pause should auto-advance and resume carousel', fakeAsync(() => {
    const first = component.medias()[0].id;
    const second = component.medias()[1].id;
    component.selectMedia(first);
    tick(3500);
    expect(component.activeMediaId()).toBe(second);
    component.pauseCarousel();
  }));
});
