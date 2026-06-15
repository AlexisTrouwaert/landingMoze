import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, OnDestroy, signal } from '@angular/core';
import { FunnelService, Sphere } from '../../../../services/funnel.service';

/**
 * Construit une fonction d'easing à partir d'une courbe cubic-bezier (identique à CSS),
 * pour pouvoir synchroniser une animation JS (scroll) avec une transition CSS.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-4) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(t);
  };
}

/**
 * Étape 2 du funnel réseau : choix d'une sphère (communauté).
 *
 * UX "tapis roulant" (desktop) : une seule liste de cartes empilées.
 *  - slot 0 = VEDETTE : la carte est remontée par-dessus la pile et agrandie,
 *    et révèle sa description longue + le bouton "Rejoindre".
 *  - slots suivants = le deck des autres sphères (profondeur : recul, flou, échelle).
 *  - Rotation en file : à chaque passage, la vedette repart en fin de liste et
 *    toutes les cartes montent d'un cran. Auto en boucle (pause au survol/focus)
 *    + manuel (molette desktop / swipe mobile). Cliquer une carte la met en vedette.
 *
 * Mobile : seule la vedette (pleine largeur, swipeable) + des points indicateurs.
 *
 * Le lien d'invitation de la sphère choisie sert ensuite de destination finale.
 */
@Component({
  selector: 'app-sphere-step',
  standalone: true,
  imports: [],
  templateUrl: './sphere-step.component.html',
  styleUrl: './sphere-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SphereStepComponent implements OnDestroy {
  private readonly fs = inject(FunnelService);
  private readonly host = inject(ElementRef);

  // ⚠️ DONNÉES PROVISOIRES — à remplacer à la main par les vraies sphères
  // et leurs liens d'invitation MozePlace (inviteLink). Tant que inviteLink
  // vaut '#', la redirection retombe sur la destination MozePlace générique.
  readonly spheres = signal<Sphere[]>([
    {
      id: 'tech',
      name: 'Tech & Dev',
      description: "L'entraide des indépendants du numérique.",
      longDescription:
        "Développeurs, designers, product et data : une communauté pour échanger sur tes projets, " +
        "trouver des partenaires de mission et décrocher des recommandations.",
      location: 'France',
      tags: ['Développement', 'Web', 'Design', 'Data'],
      memberCount: 128,
      inviteLink: '#'
    },
    {
      id: 'btp',
      name: 'Artisans du BTP',
      description: 'Le réseau des artisans du bâtiment.',
      longDescription:
        "Maçons, électriciens, plombiers, menuisiers… Partage tes chantiers, trouve de la " +
        "main-d'œuvre de confiance et capte des opportunités locales.",
      location: 'Île-de-France',
      tags: ['BTP', 'Artisanat', 'Rénovation'],
      memberCount: 86,
      inviteLink: '#'
    },
    {
      id: 'sante',
      name: 'Santé & Bien-être',
      description: 'Praticiens et indépendants du soin.',
      longDescription:
        "Kinés, ostéos, sophrologues, thérapeutes : échange sur ta pratique, fais-toi " +
        "recommander des patients et mutualise un cabinet entre pairs.",
      location: 'France',
      tags: ['Santé', 'Paramédical', 'Bien-être'],
      memberCount: 64,
      inviteLink: '#'
    },
    {
      id: 'creatif',
      name: 'Créatifs & Com',
      description: 'Graphistes, rédacteurs et créateurs.',
      longDescription:
        "Graphistes, rédacteurs, vidéastes, community managers : collabore sur des projets " +
        "et réponds à des appels plus ambitieux à plusieurs.",
      location: 'France',
      tags: ['Communication', 'Création', 'Marketing'],
      memberCount: 152,
      inviteLink: '#'
    },
    {
      id: 'finance',
      name: 'Finance & Compta',
      description: 'Experts du chiffre et de la gestion.',
      longDescription:
        "Comptables, gestionnaires de paie et conseillers : partage tes outils, tes bonnes " +
        "pratiques et recommande-toi des clients entre pros du chiffre.",
      location: 'France',
      tags: ['Comptabilité', 'Gestion', 'Paie'],
      memberCount: 73,
      inviteLink: '#'
    },
    {
      id: 'immo',
      name: 'Immobilier',
      description: 'Agents, mandataires et courtiers.',
      longDescription:
        "Mandataires, agents et courtiers : échange tes mandats, tes contacts et développe " +
        "ton apport d'affaires sur tout le territoire.",
      location: 'France',
      tags: ['Immobilier', 'Courtage', 'Transaction'],
      memberCount: 95,
      inviteLink: '#'
    },
    {
      id: 'conseil',
      name: 'Conseil & Stratégie',
      description: 'Consultants et coachs business.',
      longDescription:
        "Consultants, coachs et formateurs : monte des offres communes, partage des leads " +
        "et apprends des autres indépendants du conseil.",
      location: 'France',
      tags: ['Conseil', 'Stratégie', 'Formation'],
      memberCount: 58,
      inviteLink: '#'
    },
    {
      id: 'food',
      name: 'Food & Restauration',
      description: 'Traiteurs, chefs et métiers de bouche.',
      longDescription:
        "Chefs à domicile, traiteurs et artisans de bouche : trouve des extras, partage " +
        "tes adresses de fournisseurs et tes prestations.",
      location: 'France',
      tags: ['Cuisine', 'Traiteur', 'Événementiel'],
      memberCount: 41,
      inviteLink: '#'
    },
    {
      id: 'coach',
      name: 'Coachs & Bien-être',
      description: 'Sport, yoga et accompagnement.',
      longDescription:
        "Coachs sportifs, profs de yoga et praticiens bien-être : mutualise des créneaux, " +
        "échange des clients et organise des événements ensemble.",
      location: 'France',
      tags: ['Sport', 'Yoga', 'Bien-être'],
      memberCount: 67,
      inviteLink: '#'
    },
    {
      id: 'photo',
      name: 'Photo & Vidéo',
      description: 'Photographes et vidéastes.',
      longDescription:
        "Photographes, vidéastes et monteurs : partage du matériel, sous-traite des tournages " +
        "et complète tes équipes pour les gros projets.",
      location: 'France',
      tags: ['Photo', 'Vidéo', 'Montage'],
      memberCount: 88,
      inviteLink: '#'
    },
    {
      id: 'mode',
      name: 'Mode & Artisanat d\'art',
      description: 'Créateurs et artisans d\'art.',
      longDescription:
        "Créateurs, couturiers et artisans d'art : échange tes ateliers, tes matières " +
        "premières et tes points de vente pour grandir ensemble.",
      location: 'France',
      tags: ['Mode', 'Artisanat', 'Création'],
      memberCount: 39,
      inviteLink: '#'
    },
    {
      id: 'event',
      name: 'Événementiel',
      description: 'Wedding planners, DJ et prestataires.',
      longDescription:
        "Wedding planners, DJ, décorateurs et prestataires : monte des offres clé en main " +
        "et recommande-toi des prestations entre métiers complémentaires.",
      location: 'France',
      tags: ['Événementiel', 'Mariage', 'Animation'],
      memberCount: 54,
      inviteLink: '#'
    }
  ]);

  /** Index de rotation : la carte dont l'index ≡ rotation (mod N) est en vedette (slot 0). */
  readonly rotation = signal(0);

  /** Survol/focus de la liste → on déplie le deck (cartes écartées, à plat). */
  readonly hovered = signal(false);

  /** Index DOM de la carte qui vient de quitter la vedette : garde sa mise en page "spread"
      le temps de l'animation de sortie (le contenu se fond) avant de revenir au compact. */
  readonly leavingIndex = signal<number | null>(null);
  private leaveTimer: any = null;

  private get count(): number { return this.spheres().length; }

  readonly activeSphere = computed<Sphere | undefined>(() => {
    const list = this.spheres();
    if (list.length === 0) return undefined;
    return list[((this.rotation() % list.length) + list.length) % list.length];
  });

  /** Position d'une carte (par index DOM) dans la pile : 0 = vedette, puis 1,2,… vers le fond. */
  slotOf(index: number): number {
    const n = this.count;
    return ((index - this.rotation()) % n + n) % n;
  }

  // --- Réglages visuels (faciles à ajuster pour le polish) ---
  /** Hauteur réelle de la vedette, mesurée en JS (varie selon le texte) : cale le deck
      juste en dessous ET sert de cible pour animer la hauteur (entrée/sortie). */
  readonly featuredHeight = signal(0);   // 0 = pas encore mesurée → la vedette prend height:auto
  private readonly STACK_GAP = 6;        // empilé : deck quasi collé juste sous la vedette (au repos)
  private readonly FAN_GAP = 56;         // survol : le deck redescend pour s'étaler à plat
  private readonly PEEK = 62;            // chevauchement en mode empilé (px)
  private readonly ROW_FANNED = 96;      // hauteur de ligne quand la liste est dépliée à plat (px)
  private readonly STACK_RATIO = 0.8;    // décroissance → pile bornée (mode empilé)
  readonly STACK_HEIGHT = 720;           // hauteur du tapis en mode empilé (px)

  /** Hauteur du tapis quand la liste est dépliée à plat : doit contenir TOUTES les sphères. */
  readonly fanHeight = computed(() =>
    `${(this.featuredHeight() || 220) + this.FAN_GAP + Math.max(0, this.spheres().length - 1) * this.ROW_FANNED + 24}px`
  );

  /** Style d'une carte selon son slot et l'état (empilé / déplié à plat). */
  slotStyle(slot: number): Record<string, string> {
    if (slot === 0) {
      return {
        height: this.featuredHeight() > 0 ? `${this.featuredHeight()}px` : 'auto',
        transform: 'translateY(0) scale(1)',
        opacity: '1',
        filter: 'blur(0)',
        'z-index': '100'
      };
    }

    // Déplié au survol : liste À PLAT — toutes les cartes pleine taille, espacées, visibles.
    if (this.hovered()) {
      const y = (this.featuredHeight() || 220) + this.FAN_GAP + (slot - 1) * this.ROW_FANNED;
      return {
        transform: `translateY(${y}px) scale(1)`,
        opacity: '1',
        filter: 'blur(0)',
        'z-index': `${90 - slot}`
      };
    }

    // Empilé (borné) : profondeur qui fuit, somme géométrique des décalages.
    // slot - 1 : la 1ʳᵉ carte du deck est pile sous la vedette (offset 0), les suivantes s'empilent dessous
    const y = (this.featuredHeight() || 220) + this.STACK_GAP + this.PEEK * (1 - Math.pow(this.STACK_RATIO, slot - 1)) / (1 - this.STACK_RATIO);
    const scale = Math.max(0.7, 1 - slot * 0.05);
    const blur = Math.min(8, (slot - 1) * 1.1);
    const opacity = Math.max(0.18, 1 - slot * 0.13);
    return {
      transform: `translateY(${y}px) scale(${scale})`,
      opacity: `${opacity}`,
      filter: `blur(${blur}px)`,
      'z-index': `${90 - slot}`
    };
  }

  // ===== Pastille d'identité (monogramme + dégradé de marque) =====
  // Les sphères n'ont pas d'icône/emoji fournie : on génère une pastille
  // déterministe à partir du nom (initiales) et de l'id (dégradé). Si une sphère
  // définit `emoji`, il prend le pas (surcharge ponctuelle).
  private static readonly STOP = new Set(
    ['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'aux', 'au', 'd', 'l', '&']
  );

  /** Dégradés de marque (clair → foncé) ; texte blanc lisible sur chacun. */
  private static readonly SWATCHES: ReadonlyArray<{ from: string; to: string }> = [
    { from: '#2f6fd6', to: '#1f4fb0' }, // bleu
    { from: '#0e8fb8', to: '#0c6f86' }, // bleu cyan (marque)
    { from: '#0f8f7a', to: '#0b6f5f' }, // teal / vert
    { from: '#6b5bd6', to: '#4a3fb0' }, // indigo
    { from: '#c0468f', to: '#97306e' }, // magenta
    { from: '#f0654f', to: '#c5392b' }  // corail
  ];

  /** Initiales : première lettre des 2 premiers mots significatifs, sinon 2 premières lettres. */
  initials(name: string): string {
    const words = (name ?? '')
      .split(/[\s'’\-]+/)
      .filter(w => w && !SphereStepComponent.STOP.has(w.toLowerCase()));
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (words[0] ?? name ?? '').slice(0, 2).toUpperCase();
  }

  /** Dégradé déterministe d'une sphère (hash de l'id → palette). */
  private swatchOf(sphere: Sphere): { from: string; to: string } {
    const key = sphere.id || sphere.name || '';
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    const palette = SphereStepComponent.SWATCHES;
    return palette[Math.abs(h) % palette.length];
  }

  /** Fond dégradé de la pastille (lié en inline sur .orb-emoji). */
  gradientOf(sphere: Sphere): string {
    const { from, to } = this.swatchOf(sphere);
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  /** Couleur d'accent (départ du dégradé) → bordure / halo / fond de la vedette. */
  accentOf(sphere: Sphere): string {
    return this.swatchOf(sphere).from;
  }

  /** Couleur d'accent foncée (fin du dégradé) → bouton CTA de la vedette (contraste blanc). */
  accentStrongOf(sphere: Sphere): string {
    return this.swatchOf(sphere).to;
  }

  // --- MESURE DE LA HAUTEUR DE LA VEDETTE (cale le deck + anime la hauteur) ---
  private measureRaf: number | null = null;
  private readonly onResize = () => this.scheduleMeasure();

  /** Planifie une mesure après le prochain rendu (DOM à jour). */
  private scheduleMeasure(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    if (this.measureRaf !== null) cancelAnimationFrame(this.measureRaf);
    this.measureRaf = requestAnimationFrame(() => {
      this.measureRaf = null;
      this.measureFeatured();
    });
  }

  /** Lit la hauteur réelle (contenu) de la carte vedette et la stocke. */
  private measureFeatured(): void {
    const root = this.host.nativeElement as HTMLElement;
    const el = root.querySelector('.orb.is-featured') as HTMLElement | null;
    if (!el) return;
    const h = el.scrollHeight;
    if (h > 0 && Math.abs(h - this.featuredHeight()) > 1) this.featuredHeight.set(h);
  }

  // --- AUTO-DÉFILEMENT / SCROLL INFINI ---
  private readonly AUTO_MS = 5000;
  private readonly RESUME_MS = 9000;
  private autoTimer: any = null;
  private resumeTimer: any = null;
  private isEngaged = false;
  private destroyed = false;
  private touchStartX = 0;

  // Scroll vers le haut synchronisé avec la transition de la carte
  // (même durée/courbe que $dur-morph / $ease-soft dans le SCSS).
  private readonly SCROLL_SYNC_MS = 900;
  private readonly easeMorph = cubicBezier(0.4, 0, 0.2, 1);
  private scrollRaf: number | null = null;

  constructor() {
    // Re-mesure la hauteur de la vedette à chaque changement (rotation/données),
    // après mise à jour du DOM (rAF) → le deck se recale et la hauteur s'anime.
    effect(() => {
      this.rotation();
      this.spheres();
      this.scheduleMeasure();
    });
    afterNextRender(() => {
      this.startAuto();
      this.measureFeatured();
      // Re-mesure une fois les polices chargées (le texte peut changer de hauteur après coup)
      const fonts = typeof document !== 'undefined' ? (document as any).fonts : null;
      if (fonts?.ready?.then) fonts.ready.then(() => this.measureFeatured());
      if (typeof window !== 'undefined') window.addEventListener('resize', this.onResize);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearTimers();
    if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
    if (this.measureRaf !== null) cancelAnimationFrame(this.measureRaf);
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onResize);
  }

  private startAuto(): void {
    this.clearTimers();
    if (this.destroyed || this.count <= 1) return;
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.autoTimer = setInterval(() => this.advance(1), this.AUTO_MS);
  }

  private clearTimers(): void {
    if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
    if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = null; }
  }

  private pauseAuto(): void {
    if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
  }

  private pauseAndResumeLater(): void {
    this.pauseAuto();
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      if (!this.isEngaged) this.startAuto();
    }, this.RESUME_MS);
  }

  /** Fait tourner la file (dir=1 : la vedette part au fond, tout monte d'un cran). */
  private advance(dir: number): void {
    this.markLeaving(this.rotation());
    this.rotation.update(r => r + dir);
  }

  /** Marque la carte actuellement vedette comme "sortante" (conserve son spread pendant l'anim). */
  private markLeaving(prevRotation: number): void {
    const n = this.count;
    if (n === 0) return;
    this.leavingIndex.set(((prevRotation % n) + n) % n);
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = setTimeout(() => this.leavingIndex.set(null), 900);
  }

  // --- Interactions ---
  onEngage(): void {
    this.isEngaged = true;
    this.hovered.set(true);   // déplie le deck
    this.pauseAuto();
    if (this.resumeTimer) { clearTimeout(this.resumeTimer); this.resumeTimer = null; }
  }

  onDisengage(): void {
    this.isEngaged = false;
    this.hovered.set(false);  // replie le deck
    this.startAuto();
  }

  /** Clic sur une carte / un point → cette sphère devient la vedette (slot 0). */
  select(sphere: Sphere): void {
    const idx = this.spheres().findIndex(s => s.id === sphere.id);
    if (idx < 0) return;
    const alreadyFeatured = sphere.id === this.activeSphere()?.id;
    if (!alreadyFeatured) this.markLeaving(this.rotation());
    this.rotation.set(idx);
    this.pauseAndResumeLater();
    // Carte non vedette → on remonte en haut, en synchro avec la montée de la carte en vedette.
    if (!alreadyFeatured) this.animateScrollTop();
  }

  /**
   * Scroll vers le haut de la page, calé sur la même durée et la même courbe
   * que la transition de la carte (montée en vedette) → mouvement synchronisé.
   */
  private animateScrollTop(): void {
    if (typeof window === 'undefined') return;
    if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
    const start = window.scrollY;
    if (start <= 0) { this.scrollRaf = null; return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / this.SCROLL_SYNC_MS);
      window.scrollTo(0, start * (1 - this.easeMorph(p)));
      this.scrollRaf = p < 1 ? requestAnimationFrame(tick) : null;
    };
    this.scrollRaf = requestAnimationFrame(tick);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? 0;
    this.pauseAuto();
  }

  onTouchEnd(event: TouchEvent): void {
    const dx = (event.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
    if (dx <= -40) this.advance(1);
    else if (dx >= 40) this.advance(-1);
    this.pauseAndResumeLater();
  }

  /** Validation de la vedette → enregistrement + avancée vers l'inscription. */
  confirm(): void {
    this.clearTimers();
    const sphere = this.activeSphere();
    if (sphere) this.fs.setSphere(sphere);
  }
}
