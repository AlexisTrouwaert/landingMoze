import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environements/environment';
import {
  AdminEvent,
  AdminEventListItem,
  EventInput,
  EventsHub,
  SiteEvent,
} from '../model/event.model';

/**
 * Accès HTTP aux évènements : lecture publique + gestion admin.
 * Même back que le blog ; la session (cookie httpOnly) est jointe par `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.blogApiUrl;

  // ---- Public ----

  /** Ce qui est à venir, et les archives — la page `/evenements` en un appel. */
  hub(): Observable<EventsHub> {
    return this.http.get<EventsHub>(`${this.base}/events`);
  }

  /** Un évènement publié, quel que soit son état (404 pour un brouillon). */
  bySlug(slug: string): Observable<SiteEvent> {
    return this.http.get<SiteEvent>(`${this.base}/events/${encodeURIComponent(slug)}`);
  }

  // ---- Admin ----

  adminList(): Observable<AdminEventListItem[]> {
    return this.http.get<AdminEventListItem[]>(`${this.base}/admin/events`);
  }

  adminGet(id: string): Observable<AdminEvent> {
    return this.http.get<AdminEvent>(`${this.base}/admin/events/${id}`);
  }

  create(input: EventInput): Observable<AdminEvent> {
    return this.http.post<AdminEvent>(`${this.base}/admin/events`, input);
  }

  update(id: string, input: Partial<EventInput>): Observable<AdminEvent> {
    return this.http.put<AdminEvent>(`${this.base}/admin/events/${id}`, input);
  }

  /** Supprime un brouillon (le back refuse un évènement publié). */
  remove(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/admin/events/${id}`,
    );
  }

  // ---- Cycle de vie : une route par transition, chacune avec ce qu'elle exige ----

  /** Brouillon → en ligne. Refusé s'il manque un champ, ou si la limite est atteinte. */
  publish(id: string): Observable<AdminEvent> {
    return this.http.post<AdminEvent>(`${this.base}/admin/events/${id}/publish`, {});
  }

  /** Retour en brouillon : la page publique répondra 404. */
  unpublish(id: string): Observable<AdminEvent> {
    return this.http.post<AdminEvent>(`${this.base}/admin/events/${id}/unpublish`, {});
  }

  markFull(id: string, full: boolean): Observable<AdminEvent> {
    return this.http.post<AdminEvent>(`${this.base}/admin/events/${id}/full`, { full });
  }

  /** Report : dates ISO avec décalage ; la date d'origine est conservée par le back. */
  postpone(
    id: string,
    input: { startAt: string; endAt: string; reason: string },
  ): Observable<AdminEvent> {
    return this.http.post<AdminEvent>(`${this.base}/admin/events/${id}/postpone`, input);
  }

  cancel(id: string, reason: string): Observable<AdminEvent> {
    return this.http.post<AdminEvent>(`${this.base}/admin/events/${id}/cancel`, { reason });
  }

  upload(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/admin/events/upload`, form);
  }
}
