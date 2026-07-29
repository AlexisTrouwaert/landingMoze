import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environements/environment';
import { LinkPreview } from '../model/link-preview.model';
import { LinkPreviewService } from './link-preview.service';

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let http: HttpTestingController;
  const endpoint = `${environment.blogApiUrl}/link-preview`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LinkPreviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('get() → GET /link-preview avec la cible entièrement encodée', () => {
    const target = 'https://exemple.fr/a?x=1&y=d+e';
    let received: LinkPreview | null | undefined;

    service.get(target).subscribe((preview) => (received = preview));

    const req = http.expectOne((r) => r.url.startsWith(endpoint));
    expect(req.request.method).toBe('GET');
    expect(req.request.url).toBe(`${endpoint}?url=${encodeURIComponent(target)}`);
    // Les deux caractères que l'encodeur d'`HttpParams` aurait laissés filer, et qui
    // découperaient l'URL cible côté serveur.
    expect(req.request.url).toContain('%26');
    expect(req.request.url).toContain('%2B');

    req.flush({ url: target, title: 'Exemple' });
    expect(received?.title).toBe('Exemple');
  });

  it('mémorise la réponse : deux demandes du même lien, un seul aller-retour', () => {
    service.get('https://exemple.fr/a').subscribe();
    http.expectOne((r) => r.url.startsWith(endpoint)).flush({ url: 'https://exemple.fr/a' });

    let second: LinkPreview | null | undefined;
    service.get('https://exemple.fr/a').subscribe((preview) => (second = preview));

    // `expectNone` : la requête ne doit pas être rejouée, la valeur vient du cache.
    http.expectNone((r) => r.url.startsWith(endpoint));
    expect(second?.url).toBe('https://exemple.fr/a');
  });

  it('deux liens distincts → deux requêtes', () => {
    service.get('https://a.fr').subscribe();
    service.get('https://b.fr').subscribe();

    expect(http.match((r) => r.url.startsWith(endpoint)).length).toBe(2);
  });

  it('échec réseau → null, sans propager l’erreur', () => {
    let received: LinkPreview | null | undefined = undefined;
    let errored = false;

    service
      .get('https://exemple.fr/a')
      .subscribe({ next: (p) => (received = p), error: () => (errored = true) });

    http
      .expectOne((r) => r.url.startsWith(endpoint))
      .flush('nope', { status: 500, statusText: 'Server Error' });

    expect(received).toBeNull();
    expect(errored).toBeFalse();
  });

  it('corps vide (204) → null', () => {
    let received: LinkPreview | null | undefined = undefined;

    service.get('https://exemple.fr/a').subscribe((preview) => (received = preview));

    http
      .expectOne((r) => r.url.startsWith(endpoint))
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(received).toBeNull();
  });
});
