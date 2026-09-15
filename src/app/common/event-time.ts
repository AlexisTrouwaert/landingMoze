/**
 * Dates des évènements : saisies, stockées et affichées **à l'heure de Paris**.
 *
 * Les évènements ont lieu en France ; leur heure est celle du lieu, pas celle du navigateur qui
 * les consulte, ni celle du serveur qui rend la page (en UTC en production). D'où `Intl` avec un
 * fuseau explicite partout, plutôt que le `DatePipe` d'Angular — qui n'accepte qu'un décalage
 * fixe, faux une moitié de l'année.
 *
 * Distinct de `datetime-local.ts`, qui travaille à l'heure du navigateur : juste pour programmer
 * un article depuis l'admin, faux pour l'heure d'une soirée à Avignon.
 */

export const EVENT_TIME_ZONE = 'Europe/Paris';

const pad = (n: number) => String(n).padStart(2, '0');

/** Les composantes d'un instant, lues à Paris. */
function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Décalage de Paris sur UTC à cet instant, en minutes (+60 l'hiver, +120 l'été). */
function parisOffsetMinutes(date: Date): number {
  const p = parisParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Valeur d'un `<input type="datetime-local">` lue comme heure de Paris → ISO avec décalage.
 * `2026-10-08T18:30` → `2026-10-08T18:30:00+02:00`. `null` si vide ou invalide.
 *
 * Le décalage est celui **de la date saisie**, pas du jour de la saisie : une soirée de décembre
 * programmée en septembre est à +01:00. Calculé en deux passes pour tomber juste à la veille d'un
 * changement d'heure.
 */
export function parisLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local ?? '');
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);

  let offset = parisOffsetMinutes(new Date(wall));
  offset = parisOffsetMinutes(new Date(wall - offset * 60000));

  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${local}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** L'inverse : un instant ISO → valeur de `datetime-local` à l'heure de Paris. `''` si vide. */
export function isoToParisLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = parisParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: EVENT_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDayFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: EVENT_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** « jeudi 8 octobre 2026 » */
export function formatEventDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** « 18h30 », « 9h » — l'usage français, sans les minutes à zéro. */
export function formatEventTime(iso: string): string {
  const p = parisParts(new Date(iso));
  return p.minute ? `${p.hour}h${pad(p.minute)}` : `${p.hour}h`;
}

/**
 * La date et les horaires en une ligne.
 *  - même jour : « jeudi 8 octobre 2026 · 18h30 – 23h » ;
 *  - sur plusieurs jours : « du 8 oct. 2026, 18h30 au 9 oct. 2026, 17h ».
 */
export function formatEventSchedule(startIso: string | null, endIso: string | null): string {
  if (!startIso) return 'Date à venir';
  const start = new Date(startIso);
  if (!endIso) return `${formatEventDay(startIso)} · ${formatEventTime(startIso)}`;

  const end = new Date(endIso);
  const sameDay = shortDayFormat.format(start) === shortDayFormat.format(end);
  if (sameDay) {
    return `${formatEventDay(startIso)} · ${formatEventTime(startIso)} – ${formatEventTime(endIso)}`;
  }
  return `du ${shortDayFormat.format(start)}, ${formatEventTime(startIso)} au ${shortDayFormat.format(end)}, ${formatEventTime(endIso)}`;
}

/** Majuscule initiale, pour une date en tête de ligne. */
export function capitalize(text: string): string {
  return text ? text[0].toLocaleUpperCase('fr-FR') + text.slice(1) : text;
}
