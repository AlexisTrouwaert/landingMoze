import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, of, shareReplay, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environements/environment';
import { PersistentCircuitBreaker } from '../common/circuit-breaker';
import { SITE_HOST, internalBlogSlug } from '../common/internal-links';
import { ArticleCard } from '../model/article.model';
import { LinkPreview } from '../model/link-preview.model';
import { BlogService } from './blog.service';

/**
 * Récupère l'aperçu d'un lien externe auprès du back, qui fait le fetch — le navigateur ne peut
 * pas lire le `<head>` d'un site tiers (CORS l'interdit).
 *
 * Lecture publique : pas de `withCredentials`, contrairement aux routes `/admin` et `/auth`
 * (cf. `authInterceptor`).
 *
 * Le cache n'est pas une optimisation de confort : un même lien peut être cité plusieurs fois
 * dans un article, et chaque carte demanderait sinon son propre aller-retour — que le back paie
 * en fetch réseau vers la cible, sans cache de son côté. On mémorise l'Observable (et non la
 * valeur) avec `shareReplay`, si bien que des cartes affichées simultanément partagent une seule
 * requête au lieu d'en déclencher une chacune.
 */
/**
 * Échecs consécutifs au-delà desquels on cesse d'interroger le back.
 *
 * Un article peut citer une dizaine de liens, et chaque carte demande son aperçu. Si l'endpoint
 * est absent ou en panne, cela produit une rafale d'erreurs identiques depuis la même adresse IP
 * — ce qu'un pare-feu applicatif (CrowdSec et consorts) lit comme un scan et sanctionne par un
 * bannissement du visiteur. Le disjoncteur coupe après quelques échecs : la page continue de
 * s'afficher, simplement sans aperçus.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Durée de la coupure avant de retenter — le service rétabli reprend seul. */
const COOLDOWN_MS = 10 * 60 * 1000;

/** Décalage entre deux requêtes simultanées, pour laisser un échec ouvrir le disjoncteur. */
const STAGGER_MS = 120;

/** Au-delà, l'attente n'apporte plus rien : le disjoncteur a déjà tranché. */
const MAX_STAGGER_SLOTS = 6;

@Injectable({ providedIn: 'root' })
export class LinkPreviewService {
  private readonly http = inject(HttpClient);
  private readonly blog = inject(BlogService);
  private readonly endpoint = `${environment.blogApiUrl}/link-preview`;

  private readonly cache = new Map<string, Observable<LinkPreview | null>>();

  /** Coupure partagée entre onglets et rechargements (cf. `PersistentCircuitBreaker`). */
  private readonly breaker = new PersistentCircuitBreaker(
    'moze-lp-down-until',
    MAX_CONSECUTIVE_FAILURES,
    COOLDOWN_MS,
  );
  /** Requêtes en vol, qui sert à échelonner les départs. */
  private inFlight = 0;

  /** @returns l'aperçu, ou `null` si le back refuse l'URL (400), reste muet, ou est injoignable. */
  get(url: string): Observable<LinkPreview | null> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    // Un lien vers un de nos articles : la donnée est en base, inutile d'aller lire notre propre
    // page en HTTP pour n'en tirer que le domaine. On la demande en une fois pour tous les liens
    // internes de la page (cf. `internalCard`).
    const slug = internalBlogSlug(url);
    if (slug) {
      const local$ = this.internalCard(url, slug);
      this.cache.set(url, local$);
      return local$;
    }

    if (this.breaker.isOpen()) return of(null);

    // Les cartes d'un article se montent toutes en même temps : sans décalage, une dizaine de
    // requêtes partiraient avant que la première n'échoue, et le disjoncteur ne servirait à rien.
    // Le premier départ n'attend pas (`of`, synchrone) : la carte visible à l'écran ne doit rien
    // perdre en réactivité, seules les suivantes s'échelonnent.
    const slot = Math.min(this.inFlight++, MAX_STAGGER_SLOTS);
    const gate$ = slot === 0 ? of(0) : timer(slot * STAGGER_MS);

    const request$ = gate$.pipe(
      switchMap(() => {
        // Réexaminé après l'attente : les premiers départs ont pu ouvrir le disjoncteur.
        if (this.breaker.isOpen()) return of(null);

        // Encodage explicite plutôt que l'option `params` : l'encodeur d'`HttpParams` laisse
        // volontairement passer quelques caractères tels quels, dont le `+`, que le serveur relit
        // ensuite comme une espace — l'URL cible arriverait déformée.
        return this.http
          .get<LinkPreview>(`${this.endpoint}?url=${encodeURIComponent(url)}`, {
            observe: 'response',
          })
          .pipe(
            // Corps vide (204) : ce n'est pas une erreur, il n'y a simplement rien à montrer.
            map((response) => {
              this.breaker.recordSuccess();
              return response.body ?? null;
            }),
            catchError(() => {
              this.breaker.recordFailure();
              return of(null);
            }),
          );
      }),
      finalize(() => {
        this.inFlight = Math.max(0, this.inFlight - 1);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cache.set(url, request$);
    return request$;
  }

  // --- Liens internes : la donnée vient de notre base, pas d'un scraping ------------------

  /** Slugs inscrits pour le prochain envoi groupé. */
  private readonly pendingSlugs = new Set<string>();
  /** Envoi groupé en cours de constitution ; `null` quand il n'y en a pas. */
  private batch$: Observable<Map<string, ArticleCard>> | null = null;

  /**
   * Carte d'un article interne, servie par un appel **groupé**.
   *
   * Les cartes d'une page se montent toutes dans le même tour de boucle : `timer(0)` laisse
   * chacune inscrire son slug, puis une seule requête part pour l'ensemble. Dix liens internes
   * coûtent donc une requête, là où `/link-preview` en aurait coûté dix — chacune faisant aller
   * le serveur relire son propre site.
   */
  private internalCard(url: string, slug: string): Observable<LinkPreview | null> {
    this.pendingSlugs.add(slug);

    if (!this.batch$) {
      this.batch$ = timer(0).pipe(
        switchMap(() => {
          const slugs = [...this.pendingSlugs];
          // Vidé avant l'envoi : les cartes qui arriveraient après (navigation vers un autre
          // article) constituent un nouveau groupe, elles ne s'ajoutent pas à celui-ci.
          this.pendingSlugs.clear();
          this.batch$ = null;
          return this.blog.cards(slugs);
        }),
        map((cards) => new Map(cards.map((card) => [card.slug, card]))),
        // Échec silencieux : pas de carte, le lien reste dans le texte.
        catchError(() => of(new Map<string, ArticleCard>())),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.batch$.pipe(
      map((bySlug) => {
        const card = bySlug.get(slug);
        // Slug absent : article dépublié ou lien mort. Pas de carte plutôt qu'une carte vide.
        if (!card) return null;

        return {
          // L'adresse citée par l'auteur, pas celle qu'on aurait reconstruite.
          url,
          title: card.title,
          description: card.excerpt || undefined,
          imageUrl: card.coverImageUrl || undefined,
          siteName: SITE_HOST,
        } satisfies LinkPreview;
      }),
    );
  }
}
