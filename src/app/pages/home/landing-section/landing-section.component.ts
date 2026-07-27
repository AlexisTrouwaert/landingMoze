import { ChangeDetectionStrategy, Component, inject, Signal, computed, DestroyRef, ElementRef, NgZone, ViewChild, afterNextRender, OnDestroy, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MetaPixelService } from '../../../services/meta-pixel.service';

@Component({
    selector: 'app-landing-section',
    imports: [],
    templateUrl: './landing-section.component.html',
    styleUrl: './landing-section.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingSectionComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

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

  /** Identifiant de la frame en attente pour la lecture du défilement. */
  private scrollRaf = 0;

  constructor() {
    afterNextRender(() => {
      this.bindCarouselScroll();
      this.startAutoScroll();
    });
  }

  ngOnDestroy() {
    this.clearAllTimers();
  }

  /**
   * Suit la diapositive active pendant le défilement du carrousel.
   *
   * L'écouteur est posé à la main, et non par un `(scroll)` dans le gabarit :
   * une liaison de gabarit s'exécute dans la zone Angular, donc chacun des
   * ~60 événements par seconde émis pendant un `scrollBy` fluide — ou pendant
   * un glissement du doigt — déclenchait une détection de changements sur
   * l'application entière. Ici, hors zone, avec une seule lecture par frame
   * (`scrollLeft` et `clientWidth` forcent un recalcul de mise en page), et un
   * retour dans la zone seulement quand la diapositive change vraiment : quatre
   * fois par tour de carrousel au lieu de plusieurs dizaines par seconde.
   */
  private bindCarouselScroll(): void {
    const el = this.carouselRef?.nativeElement;
    if (!el) return;

    this.zone.runOutsideAngular(() => {
      el.addEventListener('scroll', this.onCarouselScroll, { passive: true });
    });

    this.destroyRef.onDestroy(() => {
      el.removeEventListener('scroll', this.onCarouselScroll);
      if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
    });
  }

  private readonly onCarouselScroll = (): void => {
    if (this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      const el = this.carouselRef?.nativeElement;
      if (!el || !el.clientWidth) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      if (this.activeSlide() === index) return;
      this.zone.run(() => this.activeSlide.set(index));
    });
  };

  startAutoScroll() {
    this.clearAllTimers();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Hors zone : le minuteur tourne en permanence, y compris sur desktop où le
    // corps ressort aussitôt (le carrousel n'existe qu'en dessous de 768px).
    // Dans la zone, ce tic à vide réveillait quand même une détection de
    // changements complète toutes les 3,5 s. Le test de largeur reste à
    // l'intérieur pour que le carrousel reprenne après un redimensionnement.
    this.zone.runOutsideAngular(() => {
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
    });
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

  goToFunnel(): void {
    this.metaPixel.trackLeadCTA('inscription_generic');
    this.router.navigate(['/commencer']);
  }

  goToOffres(): void {
    this.metaPixel.trackCustomEvent('ViewOffers', { source: 'hero_cta' });
    const tarifSection = document.querySelector('app-tarif');
    if (tarifSection) {
      tarifSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
