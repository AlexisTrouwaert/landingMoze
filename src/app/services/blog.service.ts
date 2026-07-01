import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environements/environment';
import { Article, ArticleInput, ArticlePage, Tag } from '../model/article.model';

/**
 * Accès HTTP au back blog : lecture publique + opérations admin.
 * Le token admin est ajouté automatiquement par `authInterceptor`.
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

  /** Tous les tags (autocomplétion de l'éditeur). */
  adminTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.base}/admin/blog/tags`);
  }

  renameTag(id: string, name: string): Observable<Tag> {
    return this.http.put<Tag>(`${this.base}/admin/blog/tags/${id}`, { name });
  }

  deleteTag(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/admin/blog/tags/${id}`,
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
