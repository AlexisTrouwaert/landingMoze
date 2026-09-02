import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environements/environment';
import { PersistentCircuitBreaker } from '../common/circuit-breaker';
import {
  AdminFeaturedItem,
  AdminStats,
  Article,
  ArticleCard,
  ArticleInput,
  ArticleListItem,
  ArticlePage,
  BulkAction,
  BulkResult,
  Tag,
} from '../model/article.model';

/** Échecs consécutifs du ping de vue au-delà desquels on arrête d'appeler (cf. `countView`). */
const MAX_VIEW_PING_FAILURES = 2;

/** Durée de la coupure avant de retenter — le service rétabli reprend seul. */
const VIEW_PING_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Accès HTTP au back blog : lecture publique + opérations admin.
 * La session (cookie httpOnly) est jointe automatiquement par `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.blogApiUrl;

  // ---- Public ----

  list(
    page = 1,
    size = 10,
    search?: string,
    tags?: string[],
  ): Observable<ArticlePage> {
    const params: Record<string, string | number> = { page, size };
    if (search) params['search'] = search;
    if (tags && tags.length) params['tags'] = tags.join(',');
    return this.http.get<ArticlePage>(`${this.base}/blog`, { params });
  }

  createTag(name: string): Observable<Tag> {
    return this.http.post<Tag>(`${this.base}/admin/blog/tags`, { name });
  }

  getBySlug(slug: string): Observable<Article> {
    return this.http.get<Article>(`${this.base}/blog/${slug}`);
  }

  /**
   * Cartes d'articles publiés, par slug — pour illustrer les liens internes d'un article.
   *
   * Une requête pour tous les liens d'une page, contre un aller-retour par lien si l'on passait
   * par `/link-preview` : ce dernier ferait aller le serveur lire son propre site en HTTP, pour
   * n'en ramener que le nom de domaine. Les slugs inconnus sont absents de la réponse.
   */
  cards(slugs: readonly string[]): Observable<ArticleCard[]> {
    if (!slugs.length) return of([]);
    return this.http.get<ArticleCard[]>(`${this.base}/blog/cards`, {
      params: { slugs: slugs.join(',') },
    });
  }

  /**
   * Signale une consultation d'article (compteur de vues, visible en admin).
   *
   * Disjoncteur : après deux échecs d'affilée, on cesse d'appeler pour le reste de la session.
   * Sans lui, un back qui ne connaît pas encore la route renverrait une 404 à **chaque** article
   * consulté ; une douzaine de lectures rapprochées suffisent alors à faire passer le visiteur
   * pour un scanner aux yeux du pare-feu applicatif, qui bannit son adresse IP. Le compteur est
   * une statistique de confort : il ne vaut pas ce risque.
   */
  countView(slug: string): Observable<void> {
    if (this.viewPingBreaker.isOpen()) return of(void 0);

    return this.http.post<void>(`${this.base}/blog/${slug}/view`, {}).pipe(
      tap({
        next: () => this.viewPingBreaker.recordSuccess(),
        error: () => this.viewPingBreaker.recordFailure(),
      }),
    );
  }

  /**
   * Coupure partagée entre onglets et rechargements : un compteur en mémoire repartirait de zéro
   * à chaque page, et chaque onglet relancerait le quota d'échecs pour son compte.
   */
  private readonly viewPingBreaker = new PersistentCircuitBreaker(
    'moze-view-down-until',
    MAX_VIEW_PING_FAILURES,
    VIEW_PING_COOLDOWN_MS,
  );

  /**
   * Articles épinglés « à la une » (max 5), du plus récemment épinglé au plus
   * ancien. Appel séparé de `list()` : un article épinglé n'est pas forcément
   * dans la première page de la liste.
   */
  featured(): Observable<ArticleListItem[]> {
    return this.http.get<ArticleListItem[]>(`${this.base}/blog/featured`);
  }

  /**
   * Tags du filtre public. Si `search` est fourni, les tags renvoyés (et leurs
   * compteurs) sont adaptés aux articles qui matchent la recherche (facettes).
   */
  publicTags(search?: string): Observable<Tag[]> {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    return this.http.get<Tag[]>(`${this.base}/blog/tags`, { params });
  }

  // ---- Admin ----

  adminList(
    opts: { search?: string; status?: string } = {},
  ): Observable<Article[]> {
    const params: Record<string, string> = {};
    if (opts.search) params['search'] = opts.search;
    if (opts.status) params['status'] = opts.status;
    return this.http.get<Article[]>(`${this.base}/admin/blog`, { params });
  }

  adminGet(id: string): Observable<Article> {
    return this.http.get<Article>(`${this.base}/admin/blog/${id}`);
  }

  /** Compteurs du tableau de bord (statuts + épinglés), en un appel. */
  adminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/admin/blog/stats`);
  }

  /**
   * La une vue de l'admin : les articles épinglés, et pour chacun l'échange programmé qui pèse
   * dessus. L'endpoint public ne transporte pas cette information — sans elle, un article sur
   * le départ serait indistinguable des autres.
   */
  adminFeatured(): Observable<AdminFeaturedItem[]> {
    return this.http.get<AdminFeaturedItem[]>(
      `${this.base}/admin/blog/featured`,
    );
  }

  /**
   * Applique une action à une sélection d'articles en une seule requête
   * (le back fait un `updateMany`, pas N mises à jour).
   */
  bulk(action: BulkAction, ids: string[]): Observable<BulkResult> {
    return this.http.post<BulkResult>(`${this.base}/admin/blog/bulk`, {
      action,
      ids,
    });
  }

  /** Tous les tags (autocomplétion de l'éditeur). */
  adminTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.base}/admin/blog/tags`);
  }

  renameTag(id: string, name: string): Observable<Tag> {
    return this.http.put<Tag>(`${this.base}/admin/blog/tags/${id}`, { name });
  }

  deleteTag(
    id: string,
    force = false,
  ): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/admin/blog/tags/${id}`,
      force ? { params: { force: 'true' } } : {},
    );
  }

  create(input: ArticleInput): Observable<Article> {
    return this.http.post<Article>(`${this.base}/admin/blog`, input);
  }

  update(id: string, input: ArticleInput): Observable<Article> {
    return this.http.put<Article>(`${this.base}/admin/blog/${id}`, input);
  }

  remove(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/admin/blog/${id}`,
    );
  }

  /**
   * Publie l'article — tout de suite, ou à l'échéance donnée (ISO). Une date future le laisse
   * masqué du public jusque-là, puis il paraît daté de cette heure (cf. back, `publish`).
   *
   */
  publish(id: string, at?: string): Observable<Article> {
    return this.http.post<Article>(
      `${this.base}/admin/blog/${id}/publish`,
      at ? { at } : {},
    );
  }

  unpublish(id: string): Observable<Article> {
    return this.http.post<Article>(
      `${this.base}/admin/blog/${id}/unpublish`,
      {},
    );
  }

  /**
   * Épingle à la une (400 si déjà 5 épinglés, ou si l'article n'est pas publié).
   *
   * `replaces` désigne l'article qui cède sa place. Le back choisit le moment : article déjà
   * paru → échange immédiat ; article encore programmé → échange mémorisé et appliqué à
   * l'échéance, l'ancien restant affiché jusque-là.
   */
  feature(id: string, replaces?: string): Observable<Article> {
    return this.http.post<Article>(
      `${this.base}/admin/blog/${id}/feature`,
      replaces ? { replaces } : {},
    );
  }

  unfeature(id: string): Observable<Article> {
    return this.http.post<Article>(
      `${this.base}/admin/blog/${id}/unfeature`,
      {},
    );
  }

  archive(id: string): Observable<Article> {
    return this.http.post<Article>(`${this.base}/admin/blog/${id}/archive`, {});
  }

  unarchive(id: string): Observable<Article> {
    return this.http.post<Article>(
      `${this.base}/admin/blog/${id}/unarchive`,
      {},
    );
  }

  upload(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(
      `${this.base}/admin/blog/upload`,
      form,
    );
  }
}
