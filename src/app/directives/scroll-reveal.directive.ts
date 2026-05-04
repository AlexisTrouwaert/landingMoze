import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';

@Directive({
  selector: '[appScrollReveal]',
  standalone: true,
  host: {
    '[class.sr-hidden]': '!visible()',
    '[class.sr-visible]': 'visible()',
    // activeDelay pilote le délai : non nul pendant l'animation de reveal,
    // remis à 0 une fois terminée pour ne pas polluer les transitions suivantes (ex: tilt)
    '[style.transition-delay]': 'activeDelay() ? activeDelay() + "ms" : null'
  }
})
export class ScrollRevealDirective implements OnInit, OnDestroy {

  @Input() delay: number     = 0;
  @Input() threshold: number = 0.1;

  private el  = inject(ElementRef<HTMLElement>);
  private obs!: IntersectionObserver;

  readonly visible     = signal(false);
  readonly activeDelay = signal(0);   // internal — effacé après reveal

  ngOnInit(): void {
    // Applique le délai stagger dès l'init
    this.activeDelay.set(this.delay);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.visible.set(true);
      this.activeDelay.set(0);
      return;
    }

    // Double rAF : garantit que sr-hidden est peint avant qu'on commence à observer
    // → élimine le flash où l'élément est visible avant d'être masqué
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              this.visible.set(true);
              // Efface le délai une fois l'animation de reveal terminée
              // (délai stagger + durée de la transition = delay + 800ms)
              setTimeout(() => this.activeDelay.set(0), this.delay + 820);
              this.obs.disconnect();
            }
          },
          { threshold: this.threshold, rootMargin: '0px 0px -40px 0px' }
        );
        this.obs.observe(this.el.nativeElement);
      });
    });
  }

  ngOnDestroy(): void {
    this.obs?.disconnect();
  }
}
