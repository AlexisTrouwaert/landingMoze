import { Component, inject, Signal, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing-section',
  standalone: true,
  imports: [],
  templateUrl: './landing-section.component.html',
  styleUrl: './landing-section.component.scss'
})
export class LandingSectionComponent {
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);

  private readonly videoId = 'ykgoxiYz208';

  public readonly videoUrl: Signal<SafeResourceUrl> = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${this.videoId}?rel=0&modestbranding=1`)
  );

  goToFunnel(): void {
    this.router.navigate(['/commencer']);
  }

  goToOffres(): void {
    const tarifSection = document.querySelector('app-tarif');
    if (tarifSection) {
      tarifSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
