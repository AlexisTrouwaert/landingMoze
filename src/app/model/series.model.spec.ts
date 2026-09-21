import { episodeLabel, episodeShortLabel, formatEpisodeDate } from './series.model';

describe('libellés de série', () => {
  it('« Épisode 2 sur 3 » avec un total annoncé, « Épisode 2 » sans', () => {
    expect(episodeLabel(2, 3)).toBe('Épisode 2 sur 3');
    expect(episodeLabel(2, null)).toBe('Épisode 2');
  });

  it('version courte des cartes', () => {
    expect(episodeShortLabel(4, 6)).toBe('Ép. 4/6');
    expect(episodeShortLabel(2, null)).toBe('Ép. 2');
    expect(episodeShortLabel(null, 6)).toBe('');
  });

  it('date en français, à l’heure de Paris, sans l’année en cours', () => {
    const now = new Date('2026-10-05T10:00:00Z');

    // 23 h 30 UTC le 4 janvier = déjà le 5 à Paris.
    expect(formatEpisodeDate('2027-01-04T23:30:00Z', now)).toBe('5 janvier 2027');
    expect(formatEpisodeDate('2026-10-12T08:00:00Z', now)).toBe('12 octobre');
  });
});
