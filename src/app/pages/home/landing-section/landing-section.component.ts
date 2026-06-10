import { ChangeDetectionStrategy, Component, inject, Signal, computed, ElementRef, ViewChild, afterNextRender, OnDestroy, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MetaPixelService } from '../../../services/meta-pixel.service';
import { LandingNavService } from '../../../services/landing-nav.service';

@Component({
  selector: 'app-landing-section',
  standalone: true,
  imports: [],
  templateUrl: './landing-section.component.html',
  styleUrl: './landing-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingSectionComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private readonly metaPixel = inject(MetaPixelService);
  readonly nav = inject(LandingNavService);

  private readonly videoId = 'ykgoxiYz208';

  public readonly videoPlaying = signal(false);

  public readonly videoUrl: Signal<SafeResourceUrl> = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${this.videoId}?rel=0&modestbranding=1&autoplay=1`)
  );

  playVideo(): void {
    this.videoPlaying.set(true);
    this.metaPixel.trackCustomEvent('VideoPlay', {
      content_name: 'hero_video',
      content_id: this.videoId,
    });
  }

  // === LOGIQUE DU CARROUSEL MOBILE ===
  @ViewChild('carousel') carouselRef!: ElementRef<HTMLUListElement>;
  public activeSlide = signal(0);

  private scrollInterval: any;
  private resumeTimeout: any; // Timer pour le délai avant reprise

  constructor() {
    afterNextRender(() => {
      this.startAutoScroll();
    });
  }

  ngOnDestroy() {
    this.clearAllTimers();
  }

  startAutoScroll() {
    this.clearAllTimers();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.scrollInterval = setInterval(() => {
      if (window.innerWidth > 768) return;

      const el = this.carouselRef?.nativeElement;
      if (el) {
        const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
        if (isAtEnd) {
          el.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
        }
      }
    }, 3500);
  }

  clearAllTimers() {
    if (this.scrollInterval) clearInterval(this.scrollInterval);
    if (this.resumeTimeout) clearTimeout(this.resumeTimeout);
  }

  pauseAutoScroll() {
    // L'utilisateur touche l'écran : on coupe tout immédiatement
    this.clearAllTimers();
  }

  resumeAutoScroll() {
    this.clearAllTimers();
    this.resumeTimeout = setTimeout(() => {
      this.startAutoScroll();
    }, 3000);
  }

  onScroll() {
    if (window.innerWidth > 768) return;
    const el = this.carouselRef?.nativeElement;
    if (el) {
      const index = Math.round(el.scrollLeft / el.clientWidth);
      if (this.activeSlide() !== index) {
        this.activeSlide.set(index);
      }
    }
  }

  goToSlide(index: number) {
    // Quand on clique sur un point, on met aussi en pause l'auto-scroll
    this.pauseAutoScroll();
    const el = this.carouselRef?.nativeElement;
    if (el) {
      el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    }
    this.resumeAutoScroll();
  }
  // ===================================

}
