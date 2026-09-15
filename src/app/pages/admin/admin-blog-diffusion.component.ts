import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  POST_SLOTS,
  SOCIAL_NETWORKS,
  SocialNetwork,
  composerPost,
  networkFor,
} from '../../common/social-networks';
import {
  ArticleAnnex,
  ArticleDetail,
  DiffusionState,
} from '../../model/article.model';
import { BlogService } from '../../services/blog.service';
import { environment } from '../../../environements/environment';

/** Un post, prêt à copier, avec ce que son réseau exige. */
interface Post {
  annex: ArticleAnnex;
  network: SocialNetwork;
  /**
   * Ce qui sera copié : le post rédigé **et** l'adresse de l'article (cf. `composerPost`).
   * C'est aussi ce qu'on affiche et ce qu'on compte — le lien pèse sur la limite du réseau.
   */
  texte: string;
  /** Vrai quand le texte dépasse ce que le réseau accepte. */
  trop: boolean;
}

/**
 * Kit de diffusion : tout ce qu'il faut pour aller poster un article sur les réseaux.
 *
 * **Pourquoi cet écran plutôt qu'un onglet de la relecture.** On relit avant de publier, on
 * poste après — parfois le lendemain. Un panneau dans le pupitre aurait obligé à rouvrir la
 * file de relecture d'un article qui n'y est plus.
 *
 * **Pourquoi on copie au lieu de préremplir.** Aucun des trois réseaux externes n'accepte
 * qu'un lien préremplisse le texte d'un post (cf. `social-networks.ts`). Le geste est donc :
 * copier, ouvrir le composeur, coller. L'ordre des instructions compte — voir `copierEtOuvrir`.
 *
 * **Ce que l'écran enregistre.** Une seule chose : « ce post est parti ». Aucune API ne nous
 * confirme qu'un message est en ligne, et prétendre le contraire serait faux. Cette marque
 * suffit pourtant à ce que l'écran soit un suivi et non un presse-papiers : sans elle, c'est
 * Facebook qu'on oublie le vendredi.
 */
@Component({
  selector: 'app-admin-blog-diffusion',
  imports: [RouterLink],
  templateUrl: './admin-blog-diffusion.component.html',
  styleUrl: './admin-blog-diffusion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBlogDiffusionComponent {
  private readonly blog = inject(BlogService);
  private readonly route = inject(ActivatedRoute);

  readonly article = signal<ArticleDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Emplacement dont la marque est en cours d'écriture, pour désarmer sa case. */
  readonly busySlot = signal<string | null>(null);

  /** Accusé éphémère après une copie. */
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ouverture du réseau programmée après l'accusé de copie (cf. `copierEtOuvrir`). */
  private ouvertureTimer: ReturnType<typeof setTimeout> | null = null;

  readonly networks = SOCIAL_NETWORKS;

  constructor() {
    // Quitter l'écran pendant l'attente ne doit pas ouvrir un onglet derrière soi.
    inject(DestroyRef).onDestroy(() => {
      if (this.ouvertureTimer) clearTimeout(this.ouvertureTimer);
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set('Article introuvable.');
      return;
    }
    this.blog.adminGet(id).subscribe({
      next: (a) => {
        this.article.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set("Cet article n'a pas pu être chargé.");
      },
    });
  }

  // --- Ce qu'il y a à diffuser ----------------------------------------------

  /** Les posts, dans l'ordre où l'on publie. */
  readonly posts = computed<Post[]>(() => {
    const annexes = this.article()?.annexes ?? [];
    const url = this.url();
    return POST_SLOTS.flatMap((slot) => {
      const annex = annexes.find((a) => a.slot === slot);
      const network = networkFor(slot);
      if (!annex || !network) return [];
      const texte = composerPost(annex.body, url, network);
      return [
        {
          annex,
          network,
          texte,
          trop: network.limit !== null && texte.length > network.limit,
        },
      ];
    });
  });

  readonly diffuses = computed(
    () => this.posts().filter((p) => p.annex.diffusedAt).length,
  );

  readonly ecartes = computed(
    () => this.posts().filter((p) => p.annex.skippedAt).length,
  );

  /** Ce qui attend encore : ni diffusé, ni écarté. */
  readonly restants = computed(
    () => this.posts().length - this.diffuses() - this.ecartes(),
  );

  /** Plus rien à faire — ce qui compte, c'est qu'une décision ait été prise pour chaque post. */
  readonly toutTraite = computed(
    () => this.posts().length > 0 && this.restants() === 0,
  );

  etat(annex: ArticleAnnex): DiffusionState {
    if (annex.diffusedAt) return 'diffused';
    if (annex.skippedAt) return 'skipped';
    return 'pending';
  }

  /** « 1 diffusé », « 2 diffusés » — accord en nombre du participe. */
  pluriel(n: number, mot: string): string {
    return `${n} ${mot}${n > 1 ? 's' : ''}`;
  }

  // --- L'article et son adresse ---------------------------------------------

  /**
   * L'adresse publique, telle qu'on la collera dans un post.
   *
   * L'origine vient du navigateur — `localhost` en développement, `moze.fr` en production —
   * avec repli sur la configuration pour le rendu serveur, qui n'a pas de `location`.
   */
  readonly url = computed(() => {
    const slug = this.article()?.slug;
    if (!slug) return null;
    const origin =
      typeof location !== 'undefined' ? location.origin : environment.siteUrl;
    return `${origin}/blog/${slug}`;
  });

  private readonly longue = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  /** Date brève — « 10 sept. » — pour la marque de diffusion, où l'heure n'apprend rien. */
  private readonly breve = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  enClair(iso: string): string {
    return this.longue.format(new Date(iso));
  }

  enBref(iso: string): string {
    return this.breve.format(new Date(iso));
  }

  // --- Copier, ouvrir, marquer ----------------------------------------------

  /** Copie seule, pour l'adresse, le texte alternatif ou une note. */
  async copier(texte: string, quoi: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texte);
      this.dire(`${quoi} copié`);
    } catch {
      this.dire('La copie a échoué — sélectionnez le texte à la main.');
    }
  }

  /**
   * Copie le post, affiche l'accusé, puis ouvre le composeur du réseau.
   *
   * **La copie se fait pendant le clic, de façon synchrone** : le presse-papiers refuse
   * d'écrire dès que la page perd le focus, ce qui arrive à l'instant où le nouvel onglet
   * s'ouvre.
   *
   * **L'ouverture attend `DELAI_OUVERTURE`**, pour que l'accusé « Texte copié » ait le temps
   * d'être lu avant que l'onglet ne passe au premier plan. La durée n'est pas libre : un
   * `window.open` n'est autorisé que peu après le clic, et Safari — le plus strict — ne le tolère
   * que dans la seconde. Au-delà, le bloqueur de fenêtres le supprime en silence.
   *
   * `window.open` sans `noopener` pour récupérer l'onglet : `null` signifie alors « bloqué »,
   * et on peut le dire. On coupe le lien vers cette page aussitôt après, ce que `noopener`
   * aurait fait — mais en rendant `null` dans tous les cas, il empêchait de détecter un blocage.
   */
  copierEtOuvrir(post: Post): void {
    const cible = post.network.composerUrl;

    if (!copierMaintenant(post.texte)) {
      // Rien dans le presse-papiers : ouvrir le composeur n'avancerait à rien.
      this.dire('La copie a échoué — sélectionnez le texte à la main.');
      return;
    }

    if (!cible) {
      this.dire(`Texte copié — collez-le dans ${post.network.label}`);
      return;
    }

    this.dire(`Texte copié — ouverture de ${post.network.label}…`);

    // Un second clic pendant l'attente remplace le premier : un seul onglet s'ouvre.
    if (this.ouvertureTimer) clearTimeout(this.ouvertureTimer);
    this.ouvertureTimer = setTimeout(() => {
      this.ouvertureTimer = null;
      const onglet = window.open(cible, '_blank');
      if (onglet) {
        onglet.opener = null;
      } else {
        this.dire(
          `Texte copié, mais le navigateur a bloqué l'ouverture de ${post.network.label}. Autorisez les fenêtres pour ce site.`,
          6000,
        );
      }
    }, DELAI_OUVERTURE);
  }

  /**
   * Coche ou décoche « Écarté » ou « Diffusé ».
   *
   * Trois états pour deux cases : aucune cochée = à diffuser. Cocher l'une décoche l'autre ;
   * décocher la case cochée ramène à « à diffuser », pour réparer une erreur de clic.
   *
   * L'autre case est décochée tout de suite, sans attendre le serveur, pour qu'on ne voie
   * jamais les deux cochées ensemble. Si l'écriture échoue, les deux sont remises d'après
   * l'article : le navigateur les a déjà modifiées, et Angular ne les retoucherait pas puisque
   * leur valeur liée, elle, n'a pas bougé.
   */
  basculer(
    post: Post,
    cochee: 'skipped' | 'diffused',
    ecarte: HTMLInputElement,
    diffuse: HTMLInputElement,
  ): void {
    const id = this.article()?.id;
    const actuel = this.etat(post.annex);
    const champ = cochee === 'skipped' ? ecarte : diffuse;
    const voulu: DiffusionState = champ.checked ? cochee : 'pending';
    if (!id || this.busySlot() || voulu === actuel) return;

    if (voulu === 'skipped') diffuse.checked = false;
    if (voulu === 'diffused') ecarte.checked = false;

    const slot = post.annex.slot;
    this.busySlot.set(slot);
    this.blog.markDiffusion(id, slot, voulu).subscribe({
      next: (a) => {
        this.article.set(a);
        this.busySlot.set(null);
      },
      error: () => {
        ecarte.checked = actuel === 'skipped';
        diffuse.checked = actuel === 'diffused';
        this.busySlot.set(null);
        this.error.set("L'état du post n'a pas pu être enregistré.");
      },
    });
  }

  private dire(message: string, duree = 2400): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), duree);
  }
}

/**
 * Attente entre l'accusé de copie et l'ouverture du réseau.
 *
 * Assez pour lire « Texte copié », et nettement sous la seconde au-delà de laquelle Safari ne
 * rattache plus `window.open` au clic (cf. `copierEtOuvrir`).
 */
const DELAI_OUVERTURE = 700;

/**
 * Copie synchrone, par sélection d'un champ temporaire.
 *
 * `execCommand('copy')` est déprécié, mais c'est la seule écriture dans le presse-papiers qui
 * se termine avant la ligne suivante — donc avant l'ouverture d'un onglet. Tous les navigateurs
 * la gardent pour cette raison. Le focus est rendu au bouton cliqué, pour le clavier.
 */
function copierMaintenant(texte: string): boolean {
  const avant = document.activeElement as HTMLElement | null;
  const champ = document.createElement('textarea');
  champ.value = texte;
  champ.setAttribute('readonly', '');
  champ.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(champ);
  champ.select();
  champ.setSelectionRange(0, texte.length); // iOS ignore `select()` seul

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  champ.remove();
  avant?.focus();
  return ok;
}
