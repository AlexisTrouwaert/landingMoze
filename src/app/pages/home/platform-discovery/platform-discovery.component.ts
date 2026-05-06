import { Component, inject, Signal, computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-platform-discovery',
  standalone: true,
  imports: [],
  templateUrl: './platform-discovery.component.html',
  styleUrl: './platform-discovery.component.scss'
})
export class PlatformDiscoveryComponent {
  private sanitizer = inject(DomSanitizer);

  private readonly videoId = 'ykgoxiYz208';

  public readonly videoPlaying = signal(false);

  public readonly videoUrl: Signal<SafeResourceUrl> = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${this.videoId}?rel=0&modestbranding=1&autoplay=1`)
  );

  playVideo(): void {
    this.videoPlaying.set(true);
  }
}
