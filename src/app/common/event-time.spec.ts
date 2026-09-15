import {
  formatEventSchedule,
  formatEventTime,
  isoToParisLocal,
  parisLocalToIso,
} from './event-time';

describe('event-time', () => {
  describe('parisLocalToIso', () => {
    it('l’été : +02:00', () => {
      expect(parisLocalToIso('2026-10-08T18:30')).toBe('2026-10-08T18:30:00+02:00');
    });

    it('l’hiver : +01:00, quelle que soit la date de saisie', () => {
      expect(parisLocalToIso('2026-12-10T18:30')).toBe('2026-12-10T18:30:00+01:00');
    });

    it('le lendemain du passage à l’heure d’hiver (25 octobre 2026)', () => {
      expect(parisLocalToIso('2026-10-25T18:00')).toBe('2026-10-25T18:00:00+01:00');
      expect(parisLocalToIso('2026-10-24T18:00')).toBe('2026-10-24T18:00:00+02:00');
    });

    it('vide ou invalide : null', () => {
      expect(parisLocalToIso('')).toBeNull();
      expect(parisLocalToIso('demain')).toBeNull();
    });

    it('aller-retour sans perte', () => {
      for (const local of ['2026-10-08T18:30', '2026-01-15T09:05', '2026-03-29T12:00']) {
        expect(isoToParisLocal(parisLocalToIso(local))).toBe(local);
      }
    });
  });

  it('isoToParisLocal lit l’heure de Paris, pas celle du navigateur', () => {
    expect(isoToParisLocal('2026-10-08T16:30:00Z')).toBe('2026-10-08T18:30');
  });

  it('formatEventTime : « 18h30 », « 9h »', () => {
    expect(formatEventTime('2026-10-08T16:30:00Z')).toBe('18h30');
    expect(formatEventTime('2026-10-08T07:00:00Z')).toBe('9h');
  });

  describe('formatEventSchedule', () => {
    it('même jour', () => {
      expect(formatEventSchedule('2026-10-08T16:30:00Z', '2026-10-08T21:00:00Z')).toBe(
        'jeudi 8 octobre 2026 · 18h30 – 23h',
      );
    });

    it('sur deux jours', () => {
      expect(formatEventSchedule('2026-10-08T16:30:00Z', '2026-10-09T15:00:00Z')).toBe(
        'du 8 oct. 2026, 18h30 au 9 oct. 2026, 17h',
      );
    });

    it('sans date', () => {
      expect(formatEventSchedule(null, null)).toBe('Date à venir');
    });
  });
});
