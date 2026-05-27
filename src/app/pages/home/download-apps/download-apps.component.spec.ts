import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DownloadAppsComponent } from './download-apps.component';
import { MetaPixelService } from '../../../services/meta-pixel.service';

describe('DownloadAppsComponent', () => {
  let fixture: ComponentFixture<DownloadAppsComponent>;
  let component: DownloadAppsComponent;
  let pixel: jasmine.SpyObj<MetaPixelService>;

  beforeEach(async () => {
    pixel = jasmine.createSpyObj<MetaPixelService>('MetaPixelService', [
      'trackCustomEvent',
    ]);
    await TestBed.configureTestingModule({
      imports: [DownloadAppsComponent],
      providers: [{ provide: MetaPixelService, useValue: pixel }],
    }).compileComponents();
    fixture = TestBed.createComponent(DownloadAppsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('appleStoreUrl points to apps.apple.com', () => {
    expect(component.appleStoreUrl).toContain('apps.apple.com');
  });

  it('playStoreUrl points to play.google.com', () => {
    expect(component.playStoreUrl).toContain('play.google.com');
  });

  it('onAppStoreClick fires AppStoreClick', () => {
    component.onAppStoreClick();
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('AppStoreClick', {
      store: 'app_store',
    });
  });

  it('onPlayStoreClick fires GooglePlayClick', () => {
    component.onPlayStoreClick();
    expect(pixel.trackCustomEvent).toHaveBeenCalledWith('GooglePlayClick', {
      store: 'google_play',
    });
  });
});
