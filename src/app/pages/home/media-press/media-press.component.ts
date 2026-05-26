import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { animate, group, query, stagger, style, transition, trigger } from '@angular/animations';

export type MediaCategory = 'TV' | 'Radio' | 'Presse' | 'Podcast';

export interface MediaItem {
  /** Identifiant stable utilisé pour le tracking et la sélection. */
  id: string;
  /** Catégorie d'apparition. Définit le groupe dans la liste. */
  category: MediaCategory;
  /** Nom du média / chaîne / radio / podcast. */
  name: string;
  /** Émission, sujet ou intitulé de l'épisode. */
  show: string;
  /** Date du passage (format libre). Optionnel pour la presse. */
  date?: string;
  /** À true si le passage n'a pas encore eu lieu — mis en avant dans la liste. */
  upcoming?: boolean;
  /** Lien externe (rediffusion, podcast Spotify, article…). Optionnel. */
  link?: string;
  /** Chemin du logo (webp/svg) affiché dans l'écran et la liste. Optionnel. */
  logo?: string;
  /**
   * Localisation du média sur la carte de France pointillée affichée derrière
   * le téléphone. Coordonnées dans le viewBox SVG (0 0 320 380), centrées sur
   * une ville. Si omis → point pulsant masqué.
   */
  location?: { x: number; y: number; city: string };
}

export interface MediaGroup {
  category: MediaCategory;
  label: string;
  items: MediaItem[];
}

@Component({
  selector: 'app-media-press',
  standalone: true,
  imports: [],
  templateUrl: './media-press.component.html',
  styleUrl: './media-press.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    /* Logo du téléphone : fade-up-strong à chaque changement de média actif.
       Le trigger est lié à activeMediaId() → toute mutation déclenche la
       transition * => *. Remplace l'ancien pattern @for [array]; track id qui
       recréait le DOM et provoquait le warning NG0956. */
    trigger('logoSwap', [
      /* :enter explicite + * => * : Angular ne déclenche pas toujours `* => *`
         lors du tout premier rendu (void → state). Avec `:enter` on garantit
         le fade-in initial. */
      transition(':enter, * => *', [
        style({ opacity: 0, transform: 'translateY(10px) scale(0.96)' }),
        animate('0.55s cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        )
      ])
    ]),

    /* Quote-content : :enter + * => * sur activeMediaId. Les enfants
       (meta/text/foot) sont animés en stagger pour retrouver le décalage
       visuel d'avant (0.55s / 0.60s avec delays 0 / 80ms / 160ms). */
    trigger('quoteSwap', [
      transition(':enter, * => *', [
        group([
          query('.quote-meta, .quote-text, .quote-foot', [
            style({ opacity: 0, transform: 'translateY(8px)' }),
            stagger(80, [
              animate('0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                style({ opacity: 1, transform: 'translateY(0)' })
              )
            ])
          ], { optional: true })
        ])
      ])
    ])
  ]
})
export class MediaPressComponent implements OnInit, OnDestroy {

  /**
   * Liste des passages médias.
   * Pour ajouter / retirer un média : éditer ce tableau, rien d'autre à toucher.
   */
  public readonly medias = signal<MediaItem[]>([
    // ─── TV ───
    {
      id: 'bsmart-tv',
      category: 'TV',
      name: 'BSMART TV',
      show: 'Émission Smart Impact',
      date: '12/06/2026',
      upcoming: true,
      logo: '/assets/images/medias/bsmart-tv.webp',
      location: { x: 485, y: 255, city: 'Paris' }
    },
    {
      id: 'bfm-business',
      category: 'TV',
      name: 'BFM Business',
      show: 'Le Pitch : Moze, une plateforme dédiée aux indépendants',
      date: '22/05/2026',
      link: 'https://www.bfmtv.com/economie/replay-emissions/le-pitch/video-le-pitch-moze-une-plateforme-dediee-aux-independants-22-05_VN-202605220109.html',
      logo: '/assets/images/medias/bfm-business.webp',
      location: { x: 485, y: 255, city: 'Paris' }
    },

    // ─── Radio ───
    {
      id: 'europe-1',
      category: 'Radio',
      name: 'Europe 1',
      show: 'Moze : la plateforme qui permet aux artisans de travailler ensemble',
      date: 'Diffusé',
      link: 'https://www.europe1.fr/emissions/initiatives-en-france/moze-la-plateforme-qui-permet-aux-artisans-de-travailler-ensemble-933395',
      logo: '/assets/images/medias/europe-1.svg',
      location: { x: 485, y: 255, city: 'Paris' }
    },
    {
      id: 'radio-classique',
      category: 'Radio',
      name: 'Radio Classique',
      show: 'Matinale éco',
      date: '20/05/2026 — 6h15',
      link: 'https://smartlinks.audiomeans.fr/l/comment-j-ai-reussi--d9b5010caef0/ludovic-feher-cofondateur-de-moze-85062437730e',
      logo: '/assets/images/medias/radio-classique.webp',
      location: { x: 485, y: 255, city: 'Paris' }
    },
    {
      id: 'rcf',
      category: 'Radio',
      name: 'Radio RCF',
      show: 'La chronique du jour',
      date: '16/05/2026',
      link: 'https://www.rcf.fr/economie-et-societe/leco-en-commun',
      logo: '/assets/images/medias/rcf.webp',
      location: { x: 645, y: 515, city: 'Lyon' }
    },

    // ─── Presse ───
    {
      id: 'vaucluse-matin',
      category: 'Presse',
      name: 'Vaucluse Matin',
      show: 'Article presse',
      date: 'Mai 2026',
      link: '/assets/medias/vaucluse-matin.pdf',
      logo: '/assets/images/medias/vaucluse-matin.webp',
      location: { x: 660, y: 735, city: 'Avignon' }
    },

    // ─── Podcasts ───
    {
      id: 'on-refait-le-taff',
      category: 'Podcast',
      name: 'On refait le Taff',
      show: 'Entrepreneuriat : Liberté totale ou profonde solitude ?',
      date: 'Diffusé',
      link: 'https://open.spotify.com/episode/6WCtO3918dARgVuAddLhI1',
      logo: '/assets/images/medias/on-refait-le-taff.webp',
      location: { x: 525, y: 70, city: 'Lille' }
    },
    {
      id: 'creativa-story',
      category: 'Podcast',
      name: 'Creativa Story',
      show: 'Applications innovantes pour développer le service aux particuliers',
      date: 'Diffusé',
      link: 'https://open.spotify.com/episode/2LpCURkGfBd3aZ09qufn41?si=gG1EckZ2Q4qcCR5y8YV4gQ&nd=1&dlsi=54a79d131a104994',
      logo: '/assets/images/medias/creativa-story.webp',
      location: { x: 680, y: 720, city: 'Vaucluse' }
    }
  ]);

  /** Ordre d'affichage des catégories dans la liste. */
  private readonly categoryOrder: MediaCategory[] = ['TV', 'Radio', 'Presse', 'Podcast'];

  /** Libellé visible de chaque catégorie. */
  private readonly categoryLabels: Record<MediaCategory, string> = {
    TV: 'TV',
    Radio: 'Radio',
    Presse: 'Presse',
    Podcast: 'Podcasts'
  };

  /**
   * Renvoie le path SVG (viewBox 24×24) correspondant à la catégorie. Utilisé
   * dans l'en-tête de groupe de la liste. Style stroke uniquement, currentColor.
   */
  public readonly categoryIcons: Record<MediaCategory, string> = {
    // Télévision : poste + antenne
    TV: 'M3 8h18v11H3zM8 21h8M8 8l4-5M16 8l-4-5',
    // Radio : ondes + bouton
    Radio: 'M4 11h16v9H4zM7 16h.01M12 16h.01M17 16h.01M8 11l8-5M6 8l12-3',
    // Presse : journal
    Presse: 'M4 4h13v16H4zM17 8h3v12H7M8 8h5M8 12h5M8 16h5',
    // Podcast : micro
    Podcast: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8'
  };

  /** Médias regroupés par catégorie, prêts à être bouclés dans le template. */
  public readonly groupedMedias = computed<MediaGroup[]>(() =>
    this.categoryOrder
      .map(cat => ({
        category: cat,
        label: this.categoryLabels[cat],
        items: this.medias().filter(m => m.category === cat)
      }))
      .filter(g => g.items.length > 0)
  );

  public readonly activeMediaId = signal<string>(this.medias()[0]?.id ?? '');

  public readonly activeMedia = computed<MediaItem | undefined>(() =>
    this.medias().find(m => m.id === this.activeMediaId())
  );

  private readonly hostEl: ElementRef<HTMLElement> = inject(ElementRef);

  /**
   * Synchronise le scroll de la liste avec le média actif : à chaque changement
   * d'activeMediaId, on amène la station correspondante dans la zone visible.
   */
  private readonly syncScrollEffect = effect(() => {
    const id = this.activeMediaId();
    if (!id) return;

    /* requestAnimationFrame plutôt que queueMicrotask : lire offsetTop /
       clientHeight pendant un microtask force un layout synchrone si le DOM
       a été modifié (forced reflow). rAF attend que le prochain paint soit
       prêt → la lecture se fait sur un layout déjà calculé, sans coût. */
    requestAnimationFrame(() => {
      const root = this.hostEl.nativeElement;
      const container = root.querySelector<HTMLElement>('.stations-scroll');
      const target = root.querySelector<HTMLElement>(
        `.station[data-media-id="${CSS.escape(id)}"]`
      );
      if (!container || !target) return;

      /* Scroll local au container uniquement (pas la page). On centre le target
         dans la zone visible ; clamp aux bornes pour éviter d'aller au-delà. */
      const targetTop = target.offsetTop - container.offsetTop;
      const desired = targetTop - (container.clientHeight - target.clientHeight) / 2;
      const max = container.scrollHeight - container.clientHeight;
      container.scrollTo({ top: Math.max(0, Math.min(desired, max)), behavior: 'smooth' });
    });
  });

  /* ============================================================
     Carrousel — défile automatiquement à travers tous les médias
     ============================================================ */
  private readonly CAROUSEL_INTERVAL_MS = 6000;
  /** Pause après une sélection manuelle, avant de reprendre le défilement auto. */
  private readonly MANUAL_PAUSE_MS = 3500;

  private carouselId: ReturnType<typeof setInterval> | null = null;
  private resumeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isPaused = false;

  public ngOnInit(): void {
    this.startCarousel();
  }

  public ngOnDestroy(): void {
    this.stopCarousel();
    this.clearResumeTimeout();
  }

  /**
   * Sélection manuelle : met à jour l'actif, stoppe le défilement
   * et planifie une reprise après MANUAL_PAUSE_MS pour laisser le temps de lire.
   */
  public selectMedia(id: string): void {
    this.activeMediaId.set(id);
    this.stopCarousel();
    this.clearResumeTimeout();

    if (this.isPaused) return; // hover-paused : on ne reprogramme rien

    /* Au bout de MANUAL_PAUSE_MS, on avance immédiatement à l'item suivant
       puis on relance la cadence normale. Sans ce next() explicite,
       le setInterval créé par startCarousel() ne fire qu'après CAROUSEL_INTERVAL_MS,
       ce qui ferait un délai total de MANUAL_PAUSE_MS + CAROUSEL_INTERVAL_MS. */
    this.resumeTimeoutId = setTimeout(() => {
      this.resumeTimeoutId = null;
      this.next();
      this.startCarousel();
    }, this.MANUAL_PAUSE_MS);
  }

  /** Mise en pause au survol de la section pour laisser le temps de lire la citation. */
  public pauseCarousel(): void {
    this.isPaused = true;
    this.stopCarousel();
    this.clearResumeTimeout();
  }

  /** Reprise quand le curseur quitte la section. */
  public resumeCarousel(): void {
    this.isPaused = false;
    this.startCarousel();
  }

  /**
   * Parse une date au format "DD/MM/YYYY" (éventuellement suivie d'autres
   * caractères, p.ex. "— 6h15"). Retourne null si non parsable.
   */
  private parseMediaDate(date?: string): Date | null {
    const match = date?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return null;
    const [, d, m, y] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  /**
   * Vrai si le média est marqué `upcoming` ET que sa date est dans le futur
   * (ou aujourd'hui). Dès que la date est passée, on bascule auto en non-upcoming
   * — pas de BDD, calcul fait à chaque render à partir de la date courante.
   * Si la date est absente / non parsable, on respecte le flag `upcoming` brut.
   */
  public isUpcoming(media: MediaItem): boolean {
    if (!media.upcoming) return false;
    const target = this.parseMediaDate(media.date);
    if (!target) return true; // pas de date → fallback : on garde "à venir"

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return target.getTime() >= today.getTime();
  }

  /**
   * Libellé d'un média "à venir". Calcule un J - x depuis la date (format DD/MM/YYYY).
   * Fallback "À VENIR" si la date est absente ou non parsable.
   */
  public upcomingLabel(media: MediaItem): string {
    if (!this.isUpcoming(media)) return '';
    const target = this.parseMediaDate(media.date);
    if (!target) return 'À VENIR';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

    if (diff > 0) return `J - ${diff}`;
    if (diff === 0) return 'JOUR J';
    return 'À VENIR';
  }

  private next(): void {
    const list = this.medias();
    if (list.length === 0) return;
    const currentIndex = list.findIndex(m => m.id === this.activeMediaId());
    const nextIndex = (currentIndex + 1) % list.length;
    this.activeMediaId.set(list[nextIndex].id);
  }

  private startCarousel(): void {
    if (this.isPaused || this.medias().length <= 1) return;
    this.stopCarousel();
    this.carouselId = setInterval(() => this.next(), this.CAROUSEL_INTERVAL_MS);
  }

  private stopCarousel(): void {
    if (this.carouselId !== null) {
      clearInterval(this.carouselId);
      this.carouselId = null;
    }
  }

  private clearResumeTimeout(): void {
    if (this.resumeTimeoutId !== null) {
      clearTimeout(this.resumeTimeoutId);
      this.resumeTimeoutId = null;
    }
  }
}
