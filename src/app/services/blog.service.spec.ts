import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { BlogService } from './blog.service';
import { environment } from '../../environements/environment';

describe('BlogService', () => {
  let service: BlogService;
  let http: HttpTestingController;
  const base = environment.blogApiUrl;

  // Le disjoncteur du ping de vue persiste dans `localStorage` (partage entre onglets) : sans ce
  // nettoyage, la coupure posée par un test condamnerait les suivants.
  beforeEach(() => localStorage.removeItem('moze-view-down-until'));
  afterEach(() => localStorage.removeItem('moze-view-down-until'));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BlogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() → GET /blog avec page/size + search + tags', () => {
    service.list(2, 5, 'crédit', ['a', 'b']).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/blog`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.get('search')).toBe('crédit');
    expect(req.request.params.get('tags')).toBe('a,b');
    req.flush({ items: [], total: 0, page: 2, size: 5 });
  });

  it('list() sans recherche → pas de param search/tags', () => {
    service.list().subscribe();
    const req = http.expectOne((r) => r.url === `${base}/blog`);
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('tags')).toBe(false);
    req.flush({ items: [], total: 0, page: 1, size: 10 });
  });

  it('getBySlug() → GET /blog/:slug', () => {
    service.getBySlug('mon-article').subscribe();
    const req = http.expectOne(`${base}/blog/mon-article`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('featured() → GET /blog/featured', () => {
    service.featured().subscribe();
    const req = http.expectOne(`${base}/blog/featured`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('feature() → POST /admin/blog/:id/feature', () => {
    service.feature('42').subscribe();
    const req = http.expectOne(`${base}/admin/blog/42/feature`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('unfeature() → POST /admin/blog/:id/unfeature', () => {
    service.unfeature('42').subscribe();
    const req = http.expectOne(`${base}/admin/blog/42/unfeature`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('create() → POST /admin/blog', () => {
    service.create({ title: 'T' }).subscribe();
    const req = http.expectOne(`${base}/admin/blog`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'T' });
    req.flush({});
  });

  it('update() → PUT /admin/blog/:id', () => {
    service.update('42', { title: 'U' }).subscribe();
    const req = http.expectOne(`${base}/admin/blog/42`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('publish() → POST /admin/blog/:id/publish', () => {
    service.publish('42').subscribe();
    const req = http.expectOne(`${base}/admin/blog/42/publish`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteTag(force=false) → DELETE sans param force', () => {
    service.deleteTag('7').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/admin/blog/tags/7`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.has('force')).toBe(false);
    req.flush({ deleted: true, id: '7' });
  });

  it('deleteTag(force=true) → DELETE avec ?force=true', () => {
    service.deleteTag('7', true).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/admin/blog/tags/7`);
    expect(req.request.params.get('force')).toBe('true');
    req.flush({ deleted: true, id: '7' });
  });

  it('upload() → POST /admin/blog/upload avec FormData', () => {
    const file = new File(['x'], 'img.png', { type: 'image/png' });
    service.upload(file).subscribe();
    const req = http.expectOne(`${base}/admin/blog/upload`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ url: 'http://x/img.png' });
  });

  /**
   * Le compteur de vues est une statistique de confort. Si la route est absente du back déployé,
   * il ne doit pas produire une 404 par article consulté : une série d'erreurs identiques depuis
   * une même IP est lue comme un scan par le pare-feu applicatif, qui bannit le visiteur.
   */
  describe('countView — disjoncteur', () => {
    // `error` obligatoire : le service laisse l'erreur remonter (c'est l'appelant qui décide
    // quoi en faire), une souscription nue la ferait éclater hors du test.
    const ping = (slug: string) => service.countView(slug).subscribe({ error: () => {} });
    const failOnce = (slug: string) => {
      ping(slug);
      http
        .expectOne(`${base}/blog/${slug}/view`)
        .flush(null, { status: 404, statusText: 'Not Found' });
    };

    it('cesse d’appeler après deux échecs d’affilée', () => {
      failOnce('a');
      failOnce('b');

      ping('c');
      http.expectNone((r) => r.url.endsWith('/view'));
    });

    it('un appel qui aboutit remet le compteur à zéro', () => {
      failOnce('a');

      ping('b');
      http
        .expectOne(`${base}/blog/b/view`)
        .flush(null, { status: 204, statusText: 'No Content' });

      // Le quota est reparti de zéro : deux nouveaux échecs sont à nouveau tolérés.
      failOnce('c');
      ping('d');
      http.expectOne(`${base}/blog/d/view`).flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
