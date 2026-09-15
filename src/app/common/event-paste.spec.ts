import { readEventDate } from './event-intake';
import { parsePastedEvents } from './event-paste';

/**
 * Lecture d'évènements collés : tolérant sur la forme (accents, majuscules, noms de la spec),
 * intraitable sur le fond (date sans fuseau, rôle inconnu, « gratuit »).
 */
describe('parsePastedEvents', () => {
  const COMPLET = [
    'titre: Travailler à plusieurs',
    'type: Afterwork',
    'accroche: Une soirée pour rencontrer ceux avec qui tu factureras demain.',
    'début: 2026-10-08T18:30:00+02:00',
    'fin: 2026-10-08T23:00:00+02:00',
    'mode: Présentiel',
    'lieu: Le 9',
    'rue: Technopôle Agroparc',
    'code postal: 84000',
    'ville: Avignon',
    'pays: France',
    'lieu.acces: Parking devant le bâtiment',
    'pmr: oui',
    "partenaire: Lieu d'accueil | Le 9 | | https://www.agroparc.com",
    'intervenant: Camille Martin | Travailler et facturer à plusieurs',
    'accès: sur inscription',
    'tarif: Entrée libre, sur inscription',
    'billetterie: https://www.billetweb.fr/afterwork',
    'jauge: 90 places',
    'date limite: 6 octobre 2026',
    '---',
    '<h2>Le déroulé</h2><p>18h30 — Accueil</p>',
    '--- linkedin',
    'Un post.',
  ].join('\n');

  it('lit un évènement complet, en normalisant les valeurs', () => {
    const { events, errors } = parsePastedEvents(COMPLET);

    expect(errors).toEqual([]);
    const e = events[0].input;
    expect(e.type).toBe('afterwork');
    expect(e.mode).toBe('presentiel');
    expect(e.country).toBe('FR');
    expect(e.startAt).toBe('2026-10-08T16:30:00.000Z');
    expect(e.access).toBe('sur-inscription');
    expect(e.accessInfo).toBe('Parking devant le bâtiment');
    expect(e.wheelchairAccessible).toBeTrue();
    expect(e.capacity).toBe(90);
    expect(e.partners.map((p) => p.role)).toEqual(['lieu-accueil', 'intervenant']);
    expect(e.partners[0].url).toBe('https://www.agroparc.com');
    expect(e.organizerName).toBe('Moze');
    expect(e.content).toBe('<h2>Le déroulé</h2><p>18h30 — Accueil</p>');
  });

  it('une date limite sans heure couvre la journée entière, et le dit', () => {
    const { events } = parsePastedEvents(COMPLET);

    expect(events[0].input.registrationDeadline).toBe('2026-10-06T23:59:00+02:00');
    expect(events[0].warnings.some((w) => w.includes('23h59'))).toBeTrue();
  });

  it('les sections nommées sont écartées, avec un avertissement', () => {
    const { events } = parsePastedEvents(COMPLET);

    expect(events[0].input.content).not.toContain('Un post');
    expect(events[0].warnings.some((w) => w.includes('linkedin'))).toBeTrue();
  });

  it('« date » et « horaires » donnent début et fin à l’heure de Paris', () => {
    const { events } = parsePastedEvents(
      'titre: Atelier\ndate: jeudi 12 novembre 2026\nhoraires: 14h – 16h30\n---\n<p>x</p>',
    );

    expect(events[0].input.startAt).toBe('2026-11-12T14:00:00+01:00');
    expect(events[0].input.endAt).toBe('2026-11-12T16:30:00+01:00');
  });

  it('refuse ce qui est illisible, en le nommant, et ne crée rien', () => {
    const { events, errors } = parsePastedEvents(
      [
        'titre: X',
        'type: soirée',
        'debut: 2026-10-08T18:30:00',
        'billetterie: www.billetweb.fr',
        'accès: gratuit',
        'partenaire: sponsor | Acme',
        '---',
      ].join('\n'),
    );

    expect(events).toEqual([]);
    expect(errors.length).toBe(5);
  });

  it('type « autre » : le nom du format vient de « type precis »', () => {
    const { events, errors } = parsePastedEvents(
      'titre: Atelier\ntype: autre\ntype précis: Soirée jeux\n---\n<p>x</p>',
    );

    expect(errors).toEqual([]);
    expect(events[0].input.type).toBe('autre');
    expect(events[0].input.typeLabel).toBe('Soirée jeux');
  });

  it('un type hors liste est refusé, avec la façon d’écrire « autre »', () => {
    const { errors } = parsePastedEvents('titre: Atelier\ntype: Soirée jeux\n---\n<p>x</p>');

    expect(errors[0]).toContain('type: autre');
  });

  it('le slug rédigé est gardé, normalisé comme le back l’enregistrera', () => {
    const { events } = parsePastedEvents(
      'titre: Atelier\nslug: Atelier Facture électronique — Avignon 2026-11-19\n---\n<p>x</p>',
    );

    expect(events[0].input.slug).toBe('atelier-facture-electronique-avignon-2026-11-19');
    expect(events[0].warnings.some((w) => w.includes('normalisée'))).toBeTrue();
  });

  it('une adresse complète collée en guise de slug : seul le dernier segment compte', () => {
    const { events } = parsePastedEvents(
      'titre: Atelier\nslug: https://www.moze.fr/evenements/atelier-avignon-2026-11-19\n---\n<p>x</p>',
    );

    expect(events[0].input.slug).toBe('atelier-avignon-2026-11-19');
  });

  it('sans slug, le brouillon se crée et l’adresse calculée est annoncée', () => {
    const { events, errors } = parsePastedEvents('titre: Atelier\n---\n<p>x</p>');

    expect(errors).toEqual([]);
    expect(events[0].input.slug).toBeUndefined();
    expect(events[0].warnings.some((w) => w.includes('« slug: »'))).toBeTrue();
  });

  it('sans lien Google Maps, un avertissement — sauf en ligne', () => {
    const maps = (text: string) =>
      parsePastedEvents(text).events[0].warnings.some((w) => w.startsWith('Maps :'));

    expect(maps('titre: Atelier\nmode: presentiel\n---\n<p>x</p>')).toBeTrue();
    expect(maps('titre: Atelier\nmode: en-ligne\n---\n<p>x</p>')).toBeFalse();
    expect(
      maps('titre: Atelier\ngoogle maps: https://maps.app.goo.gl/abc123\n---\n<p>x</p>'),
    ).toBeFalse();
  });

  it('sans titre : erreur', () => {
    expect(parsePastedEvents('type: atelier\n---\n<p>x</p>').errors[0]).toContain('titre');
  });

  it('plusieurs évènements : l’erreur dit lequel', () => {
    const { errors } = parsePastedEvents('titre: A\n---\n===\ntitre: B\ntype: nope\n---\n');

    expect(errors[0]).toMatch(/^Évènement 2 : /);
  });

  it('une description sans ligne « --- » bloque au lieu de disparaître', () => {
    const { events, errors } = parsePastedEvents(
      'titre: Atelier\napres inscription: Un e-mail.\n<h2>Au programme</h2>\n<p>Viens avec un cas : le tien.</p>',
    );

    expect(events).toEqual([]);
    expect(errors[0]).toContain('---');
  });

  it('un relais sans description ni « --- » reste valable', () => {
    expect(parsePastedEvents('titre: Salon\nrole moze: relais').errors).toEqual([]);
  });

  it('un brouillon incomplet se crée, mais annonce ce qui manquera pour publier', () => {
    const { events, errors } = parsePastedEvents('titre: Atelier\n---\n');

    expect(errors).toEqual([]);
    expect(events[0].warnings.some((w) => w.startsWith('pour publier, il manquera'))).toBeTrue();
  });
});

describe('readEventDate', () => {
  it('lit une date française avec heure, à l’heure de Paris', () => {
    expect(readEventDate('Jeudi 8 octobre 2026 à 18h30').iso).toBe('2026-10-08T18:30:00+02:00');
  });

  it('rend un jour seul sans inventer d’heure', () => {
    expect(readEventDate('8 octobre 2026')).toEqual({ day: '2026-10-08' });
  });
});
