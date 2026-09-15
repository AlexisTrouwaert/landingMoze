import { isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { BlogService } from './blog.service';
import { AuthService } from './auth.service';

/** Intervalle d'interrogation, en millisecondes. */
const POLL_MS = 30_000;

/**
 * Signale l'arrivée de brouillons rédigés par l'assistant.
 *
 * **Pourquoi une interrogation régulière et non une connexion permanente.** Un flux SSE ou un
 * WebSocket serait plus élégant, mais la production passe par un proxy qu'on ne maîtrise pas,
 * et les connexions longues y sont ce qui casse en premier — silencieusement. Une requête
 * toutes les trente secondes, sur un endpoint qui ne renvoie qu'un entier, ne se voit pas.
 *
 * **Pourquoi pas de notion de lot.** Le back ne peut pas savoir qu'une série d'articles est
 * terminée : la série vit dans une conversation avec Claude, pas chez lui. Il voit N créations
 * sans lien entre elles. On s'en tient donc à ce qui est vrai — « il y a de quoi relire » —
 * plutôt que d'inventer une fin de lot que personne ne pourrait garantir.
 */
@Injectable({ providedIn: 'root' })
export class ReviewNotifierService {
  private readonly blog = inject(BlogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Brouillons de l'assistant actuellement en attente. */
  readonly count = signal(0);

  /**
   * Combien sont arrivés depuis que l'admin regarde.
   *
   * Distinct de `count` : ouvrir l'admin sur trois brouillons déjà là ne doit pas déclencher
   * de bandeau — ils sont déjà signalés par le compteur. Seule une *arrivée* mérite d'être
   * annoncée. La première interrogation sert donc de référence, sans rien annoncer.
   */
  readonly arrived = signal(0);

  /** Permission des notifications système : `default` tant qu'on n'a rien demandé. */
  readonly permission = signal<NotificationPermission | 'unsupported'>(
    'unsupported',
  );

  /** On peut encore demander l'autorisation — donc proposer de le faire. */
  readonly canAsk = computed(() => this.permission() === 'default');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * On n'interroge que là où ça a un sens : dans l'admin, connecté, et dans un navigateur.
   * Pas sur le site public, pas pendant le rendu serveur, pas sur l'écran de connexion.
   */
  private readonly active = computed(
    () =>
      this.browser &&
      this.auth.isAdmin() &&
      this.url().startsWith('/admin') &&
      !this.url().startsWith('/admin/login'),
  );

  /** `null` tant qu'aucune interrogation n'a abouti — sert de référence initiale. */
  private known: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (this.browser && typeof Notification !== 'undefined') {
      this.permission.set(Notification.permission);
    }

    effect((onCleanup) => {
      if (!this.active()) {
        this.stop();
        return;
      }
      this.poll();
      this.timer = setInterval(() => this.poll(), POLL_MS);
      onCleanup(() => this.stop());
    });
  }

  /**
   * L'admin a pris connaissance de l'arrivée : le bandeau disparaît, le compteur reste.
   * Appelé aussi bien par « Voir » que par la fermeture — dans les deux cas, c'est vu.
   */
  acknowledge(): void {
    this.arrived.set(0);
  }

  /** Force une lecture immédiate, après une action qui a pu changer le compte. */
  refresh(): void {
    if (this.active()) this.poll();
  }

  /**
   * Demande l'autorisation des notifications système.
   *
   * Déclenchée par un clic et jamais autrement : les navigateurs refusent la demande hors
   * geste utilisateur, et une popup d'autorisation surgie sans raison se fait refuser.
   */
  async askPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    try {
      this.permission.set(await Notification.requestPermission());
    } catch {
      // Refus ou contexte non sécurisé : on reste sur le bandeau interne.
    }
  }

  private stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private poll(): void {
    this.blog.pendingReviewCount().subscribe({
      next: ({ count }) => {
        const avant = this.known;
        this.known = count;
        this.count.set(count);

        // Première lecture : on prend la mesure, on n'annonce rien.
        if (avant === null || count <= avant) return;

        const nouveaux = count - avant;
        this.arrived.update((n) => n + nouveaux);
        this.notifySystem(nouveaux);
      },
      // Un back injoignable ne doit pas remplir la console ni alarmer : le compteur
      // garde sa dernière valeur connue et la prochaine tentative aura lieu dans 30 s.
      error: () => undefined,
    });
  }

  private notifySystem(nouveaux: number): void {
    if (this.permission() !== 'granted' || typeof Notification === 'undefined') {
      return;
    }
    try {
      new Notification('Blog Moze', {
        body:
          nouveaux > 1
            ? `${nouveaux} nouveaux brouillons à relire.`
            : 'Un nouveau brouillon à relire.',
        // Une même étiquette : plusieurs arrivées rapprochées remplacent la notification
        // précédente au lieu d'en empiler une pile.
        tag: 'moze-relecture',
      });
    } catch {
      // Certaines plateformes refusent la construction directe (Android notamment).
    }
  }
}
