import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
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

  // ⚠️ DONNÉES PROVISOIRES — à remplacer à la main par les vraies sphères
  // et leurs liens d'invitation MozePlace (inviteLink). Tant que inviteLink
  // vaut '#', la redirection retombe sur la destination MozePlace générique.
  readonly spheres = signal<Sphere[]>([
    {
      id: 'tech',
      name: 'Tech & Dev',
      emoji: '💻',
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
      emoji: '👷',
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
      emoji: '🩺',
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
      emoji: '🎨',
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
      emoji: '💰',
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
      emoji: '🏡',
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
      emoji: '📊',
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
      emoji: '🍳',
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
      emoji: '🧘',
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
      emoji: '📸',
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
      emoji: '👗',
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
      emoji: '🎉',
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
  private readonly FEATURED_ZONE = 340; // hauteur réservée à la vedette (px) — plus serré = liste plus proche
  private readonly PEEK = 62;            // chevauchement en mode empilé (px)
  private readonly ROW_FANNED = 96;      // hauteur de ligne quand la liste est dépliée à plat (px)
  private readonly STACK_RATIO = 0.8;    // décroissance → pile bornée (mode empilé)
  readonly STACK_HEIGHT = 720;           // hauteur du tapis en mode empilé (px)

  /** Hauteur du tapis quand la liste est dépliée à plat : doit contenir TOUTES les sphères. */
  readonly fanHeight = computed(() =>
    `${this.FEATURED_ZONE + Math.max(0, this.spheres().length - 1) * this.ROW_FANNED + 24}px`
  );

  /** Style d'une carte selon son slot et l'état (empilé / déplié à plat). */
  slotStyle(slot: number): Record<string, string> {
    if (slot === 0) {
      return {
        transform: 'translateY(0) scale(1)',
        opacity: '1',
        filter: 'blur(0)',
        'z-index': '100'
      };
    }

    // Déplié au survol : liste À PLAT — toutes les cartes pleine taille, espacées, visibles.
    if (this.hovered()) {
      const y = this.FEATURED_ZONE + (slot - 1) * this.ROW_FANNED;
      return {
        transform: `translateY(${y}px) scale(1)`,
        opacity: '1',
        filter: 'blur(0)',
        'z-index': `${90 - slot}`
      };
    }

    // Empilé (borné) : profondeur qui fuit, somme géométrique des décalages.
    const y = this.FEATURED_ZONE + this.PEEK * (1 - Math.pow(this.STACK_RATIO, slot)) / (1 - this.STACK_RATIO);
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
    afterNextRender(() => this.startAuto());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearTimers();
    if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
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
    this.rotation.update(r => r + dir);
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
