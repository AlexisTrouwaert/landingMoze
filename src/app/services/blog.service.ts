import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environements/environment';
import {
  AdminStats,
  Article,
  ArticleInput,
  ArticleListItem,
  ArticlePage,
  BulkAction,
  BulkResult,
  Tag,
} from '../model/article.model';

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
   * Signale une consultation d'article (compteur de vues, visible en admin).
   * Répond 204 quoi qu'il arrive — l'appelant n'a rien à en faire.
   */
  countView(slug: string): Observable<void> {
    return this.http.post<void>(`${this.base}/blog/${slug}/view`, {});
  }

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

  publish(id: string): Observable<Article> {
    return this.http.post<Article>(`${this.base}/admin/blog/${id}/publish`, {});
  }

  unpublish(id: string): Observable<Article> {
    return this.http.post<Article>(
      `${this.base}/admin/blog/${id}/unpublish`,
      {},
    );
  }

  /** Épingle à la une (400 si déjà 5 épinglés, ou si l'article n'est pas publié). */
  feature(id: string): Observable<Article> {
    return this.http.post<Article>(`${this.base}/admin/blog/${id}/feature`, {});
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
