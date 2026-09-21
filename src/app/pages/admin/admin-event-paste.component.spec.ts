import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environements/environment';
import { AdminEventPasteComponent } from './admin-event-paste.component';

/**
 * L'écran « Coller un évènement » : ce qu'il envoie, et où il emmène ensuite.
 * L'analyse du texte est couverte par `event-paste.spec.ts` ; ici on vérifie le câblage.
 */
describe('AdminEventPasteComponent — du texte collé aux appels', () => {
  let fixture: ComponentFixture<AdminEventPasteComponent>;
  let http: HttpTestingController;
  let router: Router;
  const base = environment.blogApiUrl;

  /** Un évènement minimal mais valide : titre, dates avec décalage, lieu. */
  const evenement = (titre: string, jour = '08') =>
    [
      `titre: ${titre}`,
      'type: afterwork',
      `debut: 2099-10-${jour}T18:30:00+02:00`,
      `fin: 2099-10-${jour}T20:30:00+02:00`,
      'mode: presentiel',
      'lieu: La Fabrique',
      'ville: Avignon',
      'role moze: organisateur',
      'acces: libre',
      '---',
      '<p>La description.</p>',
    ].join('\n');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminEventPasteComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(AdminEventPasteComponent);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  /** Répond à une création et renvoie la requête, pour l'inspecter. */
  function repond(id: string) {
    const req = http.expectOne({ method: 'POST', url: `${base}/admin/events` });
    req.flush({ id, title: req.request.body.title, status: 'DRAFT' });
    return req;
  }

  it('envoie l’évènement lu, puis ouvre son éditeur', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.texte.set(evenement('Afterwork facturation'));

    expect(fixture.componentInstance.peutCreer()).toBe(true);
    fixture.componentInstance.creer();

    const req = repond('evt-1');
    expect(req.request.body.title).toBe('Afterwork facturation');
    expect(req.request.body.venueName).toBe('La Fabrique');
    expect(req.request.body.startAt).toContain('2099-10-08');
    // Ni statut ni publication : le collage ne fait que des brouillons.
    expect(req.request.body.status).toBeUndefined();

    expect(fixture.componentInstance.texte()).toBe('');
    // Un seul évènement : on va là où on ajoute l'image et où l'on publie.
    expect(navigate).toHaveBeenCalledWith(['/admin/evenements', 'evt-1', 'edit']);
  });

  it('plusieurs évènements : ils partent un par un, et on revient à la liste', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.texte.set(
      `${evenement('Premier afterwork', '08')}\n===\n${evenement('Second afterwork', '15')}`,
    );

    fixture.componentInstance.creer();

    expect(repond('evt-1').request.body.title).toBe('Premier afterwork');
    expect(repond('evt-2').request.body.title).toBe('Second afterwork');
    expect(navigate).toHaveBeenCalledWith(['/admin/evenements']);
  });

  it('un évènement en échec est nommé, et n’emmène pas les autres', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.texte.set(
      `${evenement('Premier afterwork', '08')}\n===\n${evenement('Second afterwork', '15')}`,
    );

    fixture.componentInstance.creer();

    http
      .expectOne({ method: 'POST', url: `${base}/admin/events` })
      .flush({ message: 'Cette adresse existe déjà.' }, { status: 409, statusText: 'Conflict' });
    repond('evt-2');

    expect(fixture.componentInstance.error()).toContain('« Premier afterwork »');
    expect(fixture.componentInstance.error()).toContain('Cette adresse existe déjà.');
    // Le texte reste à l'écran : il y a de quoi reprendre le bloc qui a échoué.
    expect(fixture.componentInstance.texte()).not.toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('une date sans décalage horaire est refusée avant tout appel', () => {
    fixture.componentInstance.texte.set(
      'titre: Sans fuseau\ndebut: 2099-10-08T18:30:00\n---\n<p>Description.</p>',
    );

    expect(fixture.componentInstance.lu()?.errors.length).toBeGreaterThan(0);
    expect(fixture.componentInstance.peutCreer()).toBe(false);

    fixture.componentInstance.creer();
    http.expectNone({ method: 'POST', url: `${base}/admin/events` });
  });
});
