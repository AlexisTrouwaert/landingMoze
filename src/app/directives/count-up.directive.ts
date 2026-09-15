import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';

/**
 * Fait défiler un nombre de 0 jusqu'à sa valeur, à la première entrée dans le viewport.
 *
 * **La valeur finale reste écrite dans le gabarit**, et c'est tout l'intérêt : la directive lit
 * le texte déjà rendu, le mémorise, puis l'anime. Le HTML servi contient donc « 12 000 € », pas
 * un zéro ni un conteneur vide — ni les moteurs ni les robots sans JavaScript ne voient la
 * différence. Une implémentation qui écrirait la valeur depuis le TypeScript aurait l'effet
 * inverse.
 *
 * Le format est conservé tel quel : préfixe, suffixe et séparateurs de milliers sont réinjectés
 * à chaque image, seul le nombre change.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnDestroy {

  /** Durée de l'animation. */
  @Input() countUpDuration = 1100;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);

  private observer: IntersectionObserver | null = null;
  private frame = 0;

  constructor() {
    // Ni `IntersectionObserver` ni `requestAnimationFrame` n'existent au rendu serveur, où la
    // valeur finale est de toute façon déjà en place : il n'y a rien à y faire.
    if (!isPlatformBrowser(this.platformId)) return;

    // `matchMedia` est lu ici et non dans une garde CSS : l'animation étant écrite en JavaScript,
    // c'est au JavaScript de respecter la préférence.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const node = this.el.nativeElement;
    const texte = (node.textContent ?? '').trim();
    const analyse = this.analyser(texte);
    if (!analyse) return;

    this.observer = new IntersectionObserver((entrees) => {
      const entree = entrees[0];
      if (!entree?.isIntersecting) return;
      this.observer?.disconnect();
      this.observer = null;
      this.animer(node, analyse);
    }, { threshold: 0.4 });

    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  /**
   * Sépare le nombre de ce qui l'entoure.
   *
   * Les espaces insécables des séparateurs de milliers sont retirés pour la lecture, puis
   * reconstitués à l'affichage par `toLocaleString('fr-FR')` — « 12 000 € » revient bien « 12 000 € »
   * et non « 12000 € ».
   */
  private analyser(texte: string): { avant: string; valeur: number; apres: string } | null {
    const correspondance = texte.match(/[\d   ]*\d/);
    if (!correspondance) return null;

    const brut = correspondance[0];
    const valeur = Number(brut.replace(/[  \s]/g, ''));
    if (!Number.isFinite(valeur) || valeur === 0) return null;

    const debut = correspondance.index ?? 0;
    return {
      avant: texte.slice(0, debut),
      valeur,
      apres: texte.slice(debut + brut.length),
    };
  }

  private animer(
    node: HTMLElement,
    { avant, valeur, apres }: { avant: string; valeur: number; apres: string },
  ): void {
    const depart = performance.now();

    const etape = (maintenant: number) => {
      const avancement = Math.min((maintenant - depart) / this.countUpDuration, 1);
      // Même courbe que le reste du silo, pour que le chiffre s'arrête comme le reste arrive.
      const adouci = 1 - Math.pow(1 - avancement, 3);
      const courant = Math.round(valeur * adouci);

      node.textContent = `${avant}${courant.toLocaleString('fr-FR')}${apres}`;

      if (avancement < 1) {
        this.frame = requestAnimationFrame(etape);
      } else {
        this.frame = 0;
        // Restitution à l'identique : on ne laisse pas le formatage automatique décider du
        // rendu final, il pourrait différer d'une espace du texte d'origine.
        node.textContent = `${avant}${valeur.toLocaleString('fr-FR')}${apres}`;
      }
    };

    this.frame = requestAnimationFrame(etape);
  }
}
