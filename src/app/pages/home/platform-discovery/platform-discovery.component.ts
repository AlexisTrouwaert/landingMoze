import { Component, inject, Signal, computed } from '@angular/core';
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

  // Remplacer cette valeur par l'ID réel de ta vidéo YouTube (ex: dQw4w9WgXcQ)
  private readonly videoId = 'ykgoxiYz208';

  public readonly videoUrl: Signal<SafeResourceUrl> = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${this.videoId}?rel=0&modestbranding=1`)
  );
}
