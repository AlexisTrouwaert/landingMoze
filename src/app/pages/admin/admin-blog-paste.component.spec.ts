import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environements/environment';
import { AdminSeries } from '../../model/series.model';
import { AdminBlogPasteComponent } from './admin-blog-paste.component';

/**
 * L'écran « Coller » de bout en bout : ce qu'il lit du texte, et surtout **l'ordre et le
 * contenu des appels** qu'il en tire. L'analyse elle-même est couverte par
 * `article-paste.spec.ts` ; ici on vérifie le câblage, c'est-à-dire ce qui arrive réellement
 * au serveur — séries d'abord, articles ensuite, propositions à la suite de leur article.
 */
describe('AdminBlogPasteComponent — du texte collé aux appels', () => {
  let fixture: ComponentFixture<AdminBlogPasteComponent>;
  let http: HttpTestingController;
  let router: Router;
  const base = environment.blogApiUrl;

  /** Une série déjà validée, telle que `GET /admin/series` la renvoie. */
  const validee: AdminSeries = {
    id: 'ser-1',
    slug: 'se-faire-payer-sans-se-facher',
    title: 'Se faire payer sans se fâcher',
    pitch: 'Son accroche, écrite et relue.',
    coverImageUrl: 'https://exemple.test/tete.jpg',
    imageIdea: 'Son idée d’image.',
    status: 'PUBLISHED',
    plannedCount: 3,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z',
    articles: [],
  };

  const BLOC_SERIE = [
    'type: série',
    'titre: Facturer sans trembler',
    'episodes: 3',
    'accroche: Trois épisodes pour ne plus courir après ses factures.',
    '--- image',
    'Un bureau clair, une pile de factures rangée sur le côté.',
  ].join('\n');

  /** Un épisode complet : date proposée, « à la une », et ses posts. */
  const EPISODE = [
    'titre: Poser le cadre',
    'serie: Facturer sans trembler',
    'episode: 1',
    'tags: facturation',
    'date: 2099-10-05T08:00:00+02:00',
    'alaune: oui',
    '---',
    '<p>Le corps de l’article.</p>',
    '',
    '--- linkedin',
    'Le post LinkedIn.',
  ].join('\n');

  /** Un épisode qui rejoint la série déjà validée. */
  const EPISODE_SERIE_VALIDEE = [
    'titre: Un épisode de plus',
    'serie: Se faire payer sans se fâcher',
    'episode: 4',
    '---',
    '<p>Le corps.</p>',
  ].join('\n');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminBlogPasteComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(AdminBlogPasteComponent);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    // Le composant lit les séries connues à sa construction.
    http.expectOne(`${base}/admin/series`).flush([validee]);
  });

  afterEach(() => http.verify());

  /** Répond à la création d'un article et renvoie la requête, pour l'inspecter. */
  function repondArticle(id: string) {
    const req = http.expectOne({ method: 'POST', url: `${base}/admin/blog` });
    req.flush({ id, title: req.request.body.title, status: 'DRAFT' });
    return req;
  }

  it('annonce ce qu’il va créer', () => {
    fixture.componentInstance.texte.set(`${BLOC_SERIE}\n===\n${EPISODE}`);

    expect(fixture.componentInstance.peutCreer()).toBe(true);
    expect(fixture.componentInstance.libelleCreation()).toBe('Créer 1 brouillon et 1 série');
  });

  it('crée la série d’abord, puis l’article, puis sa proposition', () => {
    fixture.componentInstance.texte.set(`${BLOC_SERIE}\n===\n${EPISODE}`);

    fixture.componentInstance.creer();

    // 1. La série, en premier : un article ne doit jamais arriver avant elle.
    const serie = http.expectOne({ method: 'POST', url: `${base}/admin/series` });
    expect(serie.request.body).toEqual({
      title: 'Facturer sans trembler',
      pitch: 'Trois épisodes pour ne plus courir après ses factures.',
      imageIdea: 'Un bureau clair, une pile de factures rangée sur le côté.',
      plannedCount: 3,
    });
    serie.flush({ ...validee, id: 'ser-2', slug: 'facturer-sans-trembler', status: 'DRAFT' });

    // 2. L'article, marqué comme écrit par l'assistant, rattaché à sa série.
    const article = repondArticle('art-1');
    expect(article.request.body.title).toBe('Poser le cadre');
    expect(article.request.body.origin).toBe('ASSISTANT');
    expect(article.request.body.series).toBe('Facturer sans trembler');
    expect(article.request.body.seriesPosition).toBe(1);
    expect(article.request.body.seriesPlannedCount).toBe(3);
    expect(article.request.body.annexes.map((a: { slot: string }) => a.slot)).toEqual(['linkedin']);
    // Ni date ni « une » dans la création : ce sont des propositions, pas des décisions.
    expect(article.request.body.status).toBeUndefined();
    expect(article.request.body.publishedAt).toBeUndefined();

    // 3. La proposition, juste après son article.
    const proposition = http.expectOne({
      method: 'POST',
      url: `${base}/admin/blog/art-1/proposal`,
    });
    expect(proposition.request.body.featured).toBe(true);
    expect(proposition.request.body.publishAt).toContain('2099-10-05');
    proposition.flush({ id: 'art-1' });
  });

  it('ne réécrit pas une série déjà validée, mais lui rattache l’épisode', () => {
    fixture.componentInstance.texte.set(EPISODE_SERIE_VALIDEE);

    fixture.componentInstance.creer();

    // Aucun POST ni PUT sur la série : elle a été validée, un collage n'est pas une validation.
    http.expectNone({ method: 'POST', url: `${base}/admin/series` });
    http.expectNone({ method: 'PUT', url: `${base}/admin/series/ser-1` });

    const article = repondArticle('art-2');
    expect(article.request.body.series).toBe('Se faire payer sans se fâcher');
    expect(article.request.body.seriesPosition).toBe(4);
  });

  it('série décochée : l’article part seul, sans série', () => {
    fixture.componentInstance.texte.set(`${BLOC_SERIE}\n===\n${EPISODE}`);
    fixture.componentInstance.retoucher('facturer-sans-trembler', { actif: false });

    fixture.componentInstance.creer();

    http.expectNone({ method: 'POST', url: `${base}/admin/series` });
    const article = repondArticle('art-3');
    expect(article.request.body.series).toBeUndefined();
    expect(article.request.body.seriesPosition).toBeUndefined();
    // Le titre reste nettoyé : refuser la série ne rend pas « (1/3) » souhaitable dans un titre.
    expect(article.request.body.title).toBe('Poser le cadre');

    http.expectOne({ method: 'POST', url: `${base}/admin/blog/art-3/proposal` }).flush({});
  });

  it('tout est passé : le texte est vidé et on part en relecture', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.texte.set(EPISODE_SERIE_VALIDEE);

    fixture.componentInstance.creer();
    repondArticle('art-4');

    expect(fixture.componentInstance.texte()).toBe('');
    expect(navigate).toHaveBeenCalledWith(['/admin/blog/relecture']);
  });

  it('un article en échec est nommé, et n’emmène pas les autres', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.texte.set(
      `titre: Premier\n---\n<p>Un.</p>\n===\ntitre: Second\n---\n<p>Deux.</p>`,
    );

    fixture.componentInstance.creer();

    http
      .expectOne({ method: 'POST', url: `${base}/admin/blog` })
      .flush({ message: 'Ce slug existe déjà.' }, { status: 409, statusText: 'Conflict' });
    repondArticle('art-5');

    expect(fixture.componentInstance.error()).toContain('« Premier »');
    expect(fixture.componentInstance.error()).toContain('Ce slug existe déjà.');
    expect(fixture.componentInstance.error()).toContain('1 créé(s), 1 en échec');
    // Le texte reste à l'écran : il y a de quoi reprendre le bloc qui a échoué.
    expect(fixture.componentInstance.texte()).not.toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un texte refusé ne déclenche aucun appel', () => {
    // Une date déjà passée : l'analyse refuse tout le lot.
    fixture.componentInstance.texte.set(
      'titre: Un titre\ndate: 2020-01-01T08:00:00+01:00\n---\n<p>Un corps.</p>',
    );

    expect(fixture.componentInstance.lu()?.errors.length).toBeGreaterThan(0);
    expect(fixture.componentInstance.peutCreer()).toBe(false);

    fixture.componentInstance.creer();
    http.expectNone({ method: 'POST', url: `${base}/admin/blog` });
  });
});
