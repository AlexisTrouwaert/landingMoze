import type { SiteEvent } from '../model/event.model';

/** Ce que `Organization` du balisage dit de Moze quand il organise. */
export const MOZE_ORGANIZATION = { '@type': 'Organization', name: 'Moze', url: 'https://www.moze.fr' };

/**
 * Pourquoi un évènement n'a **pas** de balisage `Event` — les trois cas de la spec (section 05),
 * ou `null` s'il est éligible.
 *
 * Google écarte des résultats enrichis les évènements réservés aux membres, ceux sans
 * composante physique, et ceux sans adresse postale (`location.address` et sa rue sont exigés).
 * Mieux vaut aucun balisage qu'un balisage refusé : la Search Console le compte en erreur.
 */
export function jsonLdIneligibility(event: SiteEvent): string | null {
  if (event.access === 'sur-invitation') return 'sur invitation';
  if (event.mode === 'en-ligne') return 'entièrement en ligne';
  if (!event.street?.trim() || !event.city?.trim()) return 'sans adresse postale';
  if (!event.startAt) return 'sans date';
  return null;
}

/** Statut schema.org — cycle de vie de la spec (section 03). */
function eventStatus(event: SiteEvent): string {
  switch (event.status) {
    case 'POSTPONED':
      return 'https://schema.org/EventPostponed';
    case 'CANCELLED':
      return 'https://schema.org/EventCancelled';
    default:
      // Publié, complet et passé : l'évènement a lieu (ou a eu lieu) comme prévu.
      return 'https://schema.org/EventScheduled';
  }
}

/**
 * Un instant ISO réécrit **avec le décalage de Paris** (`2026-10-08T18:30:00+02:00`).
 *
 * L'API renvoie de l'UTC (`…Z`), valide pour Google, mais la spec veut l'heure locale lisible
 * dans le balisage : c'est elle qu'un humain vérifie en le relisant.
 */
function withParisOffset(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00';
  const local = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  const offsetMin = Math.round((Date.parse(`${local}Z`) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/**
 * Le balisage `Event` d'un évènement publié, **déduit des champs, jamais saisi à la main**
 * (spec, section 05). `null` s'il n'est pas éligible (cf. `jsonLdIneligibility`).
 *
 * `images` : les adresses d'image à déclarer — la dérivée 1200×630 servie par le back, faute
 * encore des trois cadrages (16:9, 4:3, 1:1) que recommande la spec.
 */
export function eventJsonLd(
  event: SiteEvent,
  pageUrl: string,
  images: readonly string[],
): Record<string, unknown> | null {
  if (jsonLdIneligibility(event)) return null;

  const organizer = event.organizerName
    ? {
        '@type': 'Organization',
        name: event.organizerName,
        ...(event.organizerUrl ? { url: event.organizerUrl } : {}),
      }
    : MOZE_ORGANIZATION;

  // Co-organisé : les deux marques à égalité (spec, section 04) — Moze figure aux côtés du tiers,
  // sauf si c'est lui que l'on a déjà saisi comme organisateur.
  const organizers =
    event.roleMoze === 'co-organisateur' && !/^moze$/i.test(event.organizerName?.trim() ?? '')
      ? [organizer, MOZE_ORGANIZATION]
      : organizer;

  const free = event.access === 'libre' || event.access === 'sur-inscription';
  const price = free ? 0 : event.priceCents !== null ? event.priceCents / 100 : undefined;

  const performers = event.partners
    .filter((p) => p.role === 'intervenant')
    .map((p) => ({ '@type': 'Person', name: p.name }));

  // `undefined` disparaît à la sérialisation : pas de champ plutôt qu'une valeur inventée.
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.summary || event.tagline || undefined,
    startDate: withParisOffset(event.startAt!),
    endDate: event.endAt ? withParisOffset(event.endAt) : undefined,
    eventStatus: eventStatus(event),
    previousStartDate:
      event.status === 'POSTPONED' && event.previousStartAt
        ? withParisOffset(event.previousStartAt)
        : undefined,
    eventAttendanceMode:
      event.mode === 'hybride'
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venueName ?? undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.street,
        postalCode: event.postalCode ?? undefined,
        addressLocality: event.city,
        addressRegion: event.region ?? undefined,
        addressCountry: event.country ?? 'FR',
      },
    },
    image: images.length ? images : undefined,
    organizer: organizers,
    performer: performers.length ? performers : undefined,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: price !== undefined ? 'EUR' : undefined,
      availability:
        event.status === 'FULL' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: event.registrationUrl ?? pageUrl,
    },
    url: pageUrl,
  };
}
