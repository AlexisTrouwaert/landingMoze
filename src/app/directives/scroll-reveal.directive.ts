import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
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
  private readonly platformId = inject(PLATFORM_ID);
  private obs!: IntersectionObserver;

  readonly visible     = signal(false);
  readonly activeDelay = signal(0);   // internal — effacé après reveal

  ngOnInit(): void {
    /**
     * Rien à faire au rendu serveur : ni `window`, ni `requestAnimationFrame`, ni
     * `IntersectionObserver` n'y existent.
     *
     * L'absence de cette garde ne s'est vue que le jour où l'accueil est passé en hydratation
     * incrémentale. Auparavant, les sections qui portent la directive étaient en `@defer` sans
     * trigger `hydrate` : le serveur n'en rendait que le placeholder, `ngOnInit` n'y tournait
     * jamais, et l'appel à `window` restait sans conséquence. Une fois les sections rendues côté
     * serveur, il levait une exception qui laissait chaque `@for` vide — cartes de
     * fonctionnalités, formules et questions sortaient en `<div class="cards-grid"><!--container--></div>`.
     *
     * On sort sans toucher à `visible()`, qui reste `false` : le HTML servi porte donc
     * `sr-hidden` (`opacity: 0`). Le contenu est bien dans le document — c'est tout ce que
     * demandent les robots — et l'animation de révélation se déroule normalement à
     * l'hydratation, exactement comme avant.
     */
    if (!isPlatformBrowser(this.platformId)) return;

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
