import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environements/environment';
import { LinkPreview } from '../model/link-preview.model';

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
@Injectable({ providedIn: 'root' })
export class LinkPreviewService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.blogApiUrl}/link-preview`;

  private readonly cache = new Map<string, Observable<LinkPreview | null>>();

  /** @returns l'aperçu, ou `null` si le back refuse l'URL (400) ou reste muet. */
  get(url: string): Observable<LinkPreview | null> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    // Encodage explicite plutôt que l'option `params` : l'encodeur d'`HttpParams` laisse
    // volontairement passer quelques caractères tels quels, dont le `+`, que le serveur relit
    // ensuite comme une espace — l'URL cible arriverait déformée.
    const request$ = this.http
      .get<LinkPreview>(`${this.endpoint}?url=${encodeURIComponent(url)}`, {
        observe: 'response',
      })
      .pipe(
        // Corps vide (204) : ce n'est pas une erreur, il n'y a simplement rien à montrer.
        map((response) => response.body ?? null),
        catchError(() => of(null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(url, request$);
    return request$;
  }
}
