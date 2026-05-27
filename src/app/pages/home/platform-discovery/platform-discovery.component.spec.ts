import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlatformDiscoveryComponent } from './platform-discovery.component';

describe('PlatformDiscoveryComponent', () => {
  let fixture: ComponentFixture<PlatformDiscoveryComponent>;
  let component: PlatformDiscoveryComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlatformDiscoveryComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PlatformDiscoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with videoPlaying false', () => {
    expect(component).toBeTruthy();
    expect(component.videoPlaying()).toBe(false);
  });

  it('videoUrl should be a sanitized resource pointing at YouTube nocookie', () => {
    const url = component.videoUrl();
    // SafeResourceUrl is an opaque object — toString gives the original string
    expect(String(url)).toContain('youtube-nocookie.com');
    expect(String(url)).toContain('ykgoxiYz208');
  });

  it('playVideo() should flip videoPlaying to true', () => {
    component.playVideo();
    expect(component.videoPlaying()).toBe(true);
  });
});
