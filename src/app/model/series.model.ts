/**
 * Séries du blog — une suite d'articles qui se lisent dans l'ordre, publiés à des jours ou des
 * semaines d'écart. Miroir des réponses du back (`src/series/series-view.ts`), qui fait foi.
 *
 * Ce qui se déduit des articles n'est jamais enregistré : épisodes parus, date du prochain,
 * série « complète » arrivent calculés, à l'heure de la lecture.
 */

/** La série d'un article, telle que la liste et l'administration la montrent. */
export interface SeriesRef {
  /** Présent dans les réponses admin seulement. */
  id?: string;
  slug: string;
  title: string;
  /** Nombre d'épisodes annoncé ; `null` = pas de total, on dit « Épisode 2 ». */
  plannedCount: number | null;
}

/**
 * La série d'une carte d'article : de quoi écrire « Série · Ép. 2/3 ». Le numéro est facultatif
 * pour qu'un `Article` complet — l'aperçu de l'éditeur, la une de l'admin — reste une carte.
 */
export interface CardSeriesRef extends SeriesRef {
  position?: number | null;
}

/** Un épisode paru. */
export interface SeriesEpisode {
  position: number | null;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: string;
  readingMinutes: number;
}

/** Un épisode programmé : sa date, jamais son titre ni son adresse. */
export interface UpcomingEpisode {
  position: number | null;
  publishedAt: string;
}

/** Page d'une série (`GET /series/:slug`). */
export interface PublicSeries {
  slug: string;
  title: string;
  pitch: string;
  /**
   * Image de tête, choisie pour la série. Elle passe devant sur la pile de couvertures ; les
   * épisodes remplissent les calques suivants. `null` : la pile n'est faite que d'eux.
   */
  coverImageUrl: string | null;
  plannedCount: number | null;
  /** Tous les épisodes annoncés sont parus, aucun n'est programmé. */
  complete: boolean;
  episodes: SeriesEpisode[];
  upcoming: UpcomingEpisode[];
  lastPublishedAt: string | null;
  updatedAt: string;
}

/** Une série du rayon (`GET /series`). */
export interface ShelfSeries extends PublicSeries {
  /** Le dernier épisode est sorti il y a moins de sept jours. */
  fresh: boolean;
}

/** Ce qu'un article paru sait de sa série (`GET /blog/:slug`). */
export interface ArticleSeriesContext extends SeriesRef {
  complete: boolean;
  /** Numéro de l'article lu. */
  position: number | null;
  /** Épisodes parus, dans l'ordre de lecture. */
  episodes: { position: number | null; slug: string; title: string }[];
  /** Le prochain épisode déjà paru… */
  nextEpisode: SeriesEpisode | null;
  /** … sinon le prochain programmé. */
  nextUpcoming: UpcomingEpisode | null;
}

/**
 * `DRAFT` : l'assistant (ou un humain) en a rédigé le teaser, mais personne n'y a encore posé
 * l'image de tête — la série n'existe pas pour le public. `PUBLISHED` : validée.
 */
export type SeriesStatus = 'DRAFT' | 'PUBLISHED';

/** Ce qu'un signalement peut viser sur le brouillon d'une série : toujours un champ entier. */
export type SeriesFlagField = 'title' | 'pitch' | 'imageIdea';

/** Un champ du brouillon d'une série à faire reprendre par l'assistant (`/admin/series/:id/flags`). */
export interface SeriesFlag {
  id: string;
  seriesId: string;
  field: SeriesFlagField;
  note: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Une série vue de l'administration (`GET /admin/series`), brouillons compris. */
export interface AdminSeries {
  id: string;
  slug: string;
  title: string;
  pitch: string;
  coverImageUrl: string | null;
  /** Ce que devrait montrer l'image de tête : le brief qu'un humain suit pour la choisir. */
  imageIdea: string;
  status: SeriesStatus;
  plannedCount: number | null;
  createdAt: string;
  updatedAt: string;
  articles: AdminSeriesArticle[];
}

export interface AdminSeriesArticle {
  id: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  seriesPosition: number | null;
}

export interface SeriesInput {
  title?: string;
  pitch?: string;
  /** Adresse de l'image de tête. Chaîne vide : la série n'en a plus. */
  coverImageUrl?: string | null;
  imageIdea?: string;
  plannedCount?: number | null;
}

/**
 * Date d'épisode en français, à l'heure de Paris : « 5 janvier », ou « 5 janvier 2027 » quand
 * l'année n'est pas celle en cours. `Intl` explicite plutôt que le `DatePipe` : l'application ne
 * déclare pas de locale française, et le serveur tourne en UTC.
 */
export function formatEpisodeDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const year = (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' }).format(d);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    ...(year(date) !== year(now) && { year: 'numeric' }),
  }).format(date);
}

/** Temps de lecture cumulé des épisodes parus. */
export function totalReadingMinutes(episodes: readonly { readingMinutes: number }[]): number {
  return episodes.reduce((sum, e) => sum + e.readingMinutes, 0);
}

/** « Épisode 2 sur 3 », ou « Épisode 2 » sans total annoncé. */
export function episodeLabel(position: number | null, plannedCount: number | null): string {
  if (position === null) return 'Épisode';
  return plannedCount ? `Épisode ${position} sur ${plannedCount}` : `Épisode ${position}`;
}

/** « Ép. 2/3 », ou « Ép. 2 » — la version courte des cartes. */
export function episodeShortLabel(position: number | null, plannedCount: number | null): string {
  if (position === null) return '';
  return plannedCount ? `Ép. ${position}/${plannedCount}` : `Ép. ${position}`;
}
