import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

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

  /**
   * `fakeAsync` : les demandes simultanées sont volontairement échelonnées (cf. `STAGGER_MS`),
   * la seconde ne part donc pas dans le même tour de boucle que la première.
   */
  it('deux liens distincts → deux requêtes', fakeAsync(() => {
    service.get('https://a.fr').subscribe();
    service.get('https://b.fr').subscribe();

    tick(1000);

    expect(http.match((r) => r.url.startsWith(endpoint)).length).toBe(2);
  }));

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

  /**
   * Incident de production : un endpoint absent, une dizaine de liens dans l'article, donc une
   * rafale d'erreurs identiques depuis la même IP en quelques secondes — lue comme un scan par
   * le pare-feu applicatif, qui bannissait le visiteur. Le disjoncteur borne les dégâts.
   */
  describe('disjoncteur', () => {
    const fail = (n: number) => {
      for (let i = 0; i < n; i++) {
        service.get(`https://exemple.fr/echec-${i}`).subscribe();
        http
          .expectOne((r) => r.url.startsWith(endpoint))
          .flush(null, { status: 404, statusText: 'Not Found' });
      }
    };

    it('cesse d’interroger le back après trois échecs d’affilée', () => {
      fail(3);

      let received: unknown = 'jamais renseigne';
      service.get('https://exemple.fr/apres').subscribe((p) => (received = p));

      // Plus aucune requête : c'est ce qui empêche la rafale de 404.
      http.expectNone((r) => r.url.startsWith(endpoint));
      // Et la carte reçoit bien une réponse — elle ne reste pas en attente.
      expect(received).toBeNull();
    });

    it('une réponse qui aboutit remet le compteur à zéro', () => {
      fail(2);

      service.get('https://exemple.fr/ok').subscribe();
      http
        .expectOne((r) => r.url.startsWith(endpoint))
        .flush({ url: 'https://exemple.fr/ok', title: 'OK' });

      // Le quota d'échecs est reparti de zéro : la requête suivante part normalement.
      service.get('https://exemple.fr/suivant').subscribe();
      http.expectOne((r) => r.url.startsWith(endpoint)).flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
