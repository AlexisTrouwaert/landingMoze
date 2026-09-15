import {
  EVENT_ACCESS,
  EVENT_MODES,
  EVENT_TYPES,
  PARTNER_ROLES,
  ROLES_MOZE,
  TYPE_LABEL_MAX,
} from '../model/event.model';
import type { EventInput, EventPartner, PartnerRole } from '../model/event.model';
import { estVrai, normalizeLabel } from './article-intake';
import { parisLocalToIso } from './event-time';
import { isGoogleMapsUrl } from './google-maps';

/**
 * Vocabulaire commun aux deux portes d'entrée des évènements : le texte collé depuis une
 * conversation avec une IA, et le document Word importé dans l'éditeur.
 *
 * Les deux lisent des paires « étiquette : valeur ». Les étiquettes et leur conversion vivent
 * ici, une seule fois : sans ce point de rencontre, « billetterie » serait comprise par l'une et
 * pas par l'autre, et la même date lue différemment selon le chemin emprunté.
 *
 * Les étiquettes reprennent les noms de la spécification (`accroche`, `lieu.acces`,
 * `inscription.jauge`…) : une fois normalisés — sans accents, points ni tirets bas —, ils
 * tombent sur les mêmes alias que la forme courte (« lieu acces », « inscription jauge »).
 */

export type EventField =
  | 'title'
  | 'slug'
  | 'type'
  | 'typeLabel'
  | 'tagline'
  | 'summary'
  | 'coverImageAlt'
  | 'startAt'
  | 'endAt'
  | 'day'
  | 'hours'
  | 'mode'
  | 'venueName'
  | 'street'
  | 'postalCode'
  | 'city'
  | 'region'
  | 'country'
  | 'accessInfo'
  | 'wheelchairAccessible'
  | 'mapUrl'
  | 'roleMoze'
  | 'organizerName'
  | 'organizerUrl'
  | 'organizerContact'
  | 'partner'
  | 'speaker'
  | 'access'
  | 'priceLabel'
  | 'price'
  | 'registrationUrl'
  | 'capacity'
  | 'registrationGoal'
  | 'registrationDeadline'
  | 'registrationInfo';

/**
 * Étiquettes reconnues, sous leur forme normalisée (`normalizeLabel`).
 *
 * **C'est le vocabulaire qui filtre, pas la position** — même raison que pour les articles : un
 * document écrit volontiers « Ce qu'on retient : … », qui ressemble trait pour trait à une
 * étiquette. Seuls les libellés connus deviennent des champs.
 */
export const EVENT_FIELD_LABELS: ReadonlyArray<readonly [EventField, readonly string[]]> = [
  ['title', ['titre', 'titre de l evenement', 'nom de l evenement']],
  // Pas « adresse » seule : c'est la rue.
  ['slug', ['slug', 'adresse de l evenement', 'adresse de la page', 'url']],
  ['type', ['type', 'type d evenement', 'typologie']],
  ['typeLabel', ['type precis', 'nom du type', 'autre type']],
  ['tagline', ['accroche', 'promesse']],
  ['summary', ['resume', 'chapo']],
  ['coverImageAlt', ['texte alternatif', 'alt', 'texte alt']],
  ['startAt', ['debut', 'date de debut', 'commence']],
  ['endAt', ['fin', 'date de fin', 'termine']],
  ['day', ['date', 'jour']],
  ['hours', ['horaires', 'horaire', 'heures']],
  ['mode', ['mode', 'mode de participation', 'format']],
  ['venueName', ['lieu', 'nom du lieu', 'lieu nom', 'salle']],
  ['street', ['rue', 'adresse', 'lieu adresse', 'lieu rue', 'voie']],
  ['postalCode', ['code postal', 'cp', 'lieu code postal']],
  ['city', ['ville', 'commune', 'lieu ville']],
  ['region', ['region', 'departement', 'lieu region']],
  ['country', ['pays', 'lieu pays']],
  ['accessInfo', ['acces au lieu', 'lieu acces', 'comment venir', 'venir', 'stationnement']],
  ['wheelchairAccessible', ['pmr', 'accessibilite pmr', 'lieu accessibilite pmr', 'accessible pmr']],
  ['mapUrl', ['google maps', 'lien google maps', 'maps', 'plan']],
  ['roleMoze', ['role moze', 'role de moze']],
  ['organizerName', ['organisateur', 'organisateur nom', 'organise par']],
  ['organizerUrl', ['site organisateur', 'site de l organisateur', 'organisateur url', 'organisateur site']],
  ['organizerContact', ['contact', 'contact organisateur', 'organisateur contact']],
  ['partner', ['partenaire', 'partenaires']],
  ['speaker', ['intervenant', 'intervenante', 'intervenants']],
  ['access', ['acces', 'conditions d acces']],
  ['priceLabel', ['tarif', 'mention tarifaire', 'tarif mention']],
  ['price', ['prix']],
  ['registrationUrl', ['billetterie', 'inscription', 'lien d inscription', 'inscription url']],
  ['capacity', ['jauge', 'inscription jauge', 'places', 'capacite']],
  ['registrationGoal', ['objectif inscrits', 'objectif d inscrits', 'inscription objectif inscrits']],
  ['registrationDeadline', ['date limite', 'date limite d inscription', 'inscription date limite']],
  ['registrationInfo', ['apres inscription', 'apres l inscription', 'ce qu on recoit']],
];

/** Libellés affichés dans les bilans d'import et de collage. */
export const EVENT_FIELD_NAMES: Readonly<Record<EventField, string>> = {
  title: 'titre',
  slug: 'adresse de la page',
  type: 'type',
  typeLabel: 'type précis',
  tagline: 'accroche',
  summary: 'résumé',
  coverImageAlt: 'texte alternatif',
  startAt: 'début',
  endAt: 'fin',
  day: 'date',
  hours: 'horaires',
  mode: 'mode',
  venueName: 'lieu',
  street: 'rue',
  postalCode: 'code postal',
  city: 'ville',
  region: 'région',
  country: 'pays',
  accessInfo: 'accès au lieu',
  wheelchairAccessible: 'PMR',
  mapUrl: 'lien Google Maps',
  roleMoze: 'rôle de Moze',
  organizerName: 'organisateur',
  organizerUrl: 'site de l’organisateur',
  organizerContact: 'contact',
  partner: 'partenaires',
  speaker: 'intervenants',
  access: 'accès',
  priceLabel: 'tarif',
  price: 'prix',
  registrationUrl: 'billetterie',
  capacity: 'jauge',
  registrationGoal: 'objectif d’inscrits',
  registrationDeadline: 'date limite',
  registrationInfo: 'après l’inscription',
};

/** Le champ d'une étiquette (brute ou normalisée), ou `null`. */
export function eventFieldFor(label: string): EventField | null {
  const normalized = normalizeLabel(label);
  for (const [field, aliases] of EVENT_FIELD_LABELS) {
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

/** Longueurs refusées par le back (cf. `event.dto.ts`), vérifiées avant l'envoi. */
const MAX: Partial<Record<EventField, number>> = {
  title: 90,
  slug: 120,
  typeLabel: TYPE_LABEL_MAX,
  tagline: 140,
  summary: 400,
  coverImageAlt: 300,
  venueName: 150,
  street: 200,
  postalCode: 20,
  city: 100,
  region: 100,
  accessInfo: 1000,
  organizerName: 150,
  organizerContact: 200,
  priceLabel: 120,
  registrationInfo: 600,
};

/** Longueur d'un slug : celle que retient le back (`slugify`). */
const SLUG_MAX = 80;

/**
 * Un slug tel que le back l'enregistrera : sans accents, en minuscules, mots séparés par des
 * tirets, coupé au dernier mot entier avant 80 caractères. Copie de `slugify` du back, qui fait
 * foi — ce double ne sert qu'à montrer l'adresse avant de créer.
 */
export function toEventSlug(value: string): string {
  const full = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (full.length <= SLUG_MAX) return full;
  const cut = full.slice(0, SLUG_MAX);
  const lastHyphen = cut.lastIndexOf('-');
  return full[SLUG_MAX] === '-' || lastHyphen <= 0 ? cut : cut.slice(0, lastHyphen);
}

/** Une valeur d'énumération sous sa forme d'URL : « Petit-déjeuner » → `petit-dejeuner`. */
function asKey(value: string): string {
  return normalizeLabel(value).replace(/\s+/g, '-');
}

/** Formes courantes qui ne sont pas la valeur canonique. */
const ENUM_ALIASES: Readonly<Record<string, string>> = {
  // accès
  'entree-libre': 'libre',
  'inscription': 'sur-inscription',
  'invitation': 'sur-invitation',
  // mode
  'en-presentiel': 'presentiel',
  'sur-place': 'presentiel',
  'distanciel': 'en-ligne',
  'visio': 'en-ligne',
  'mixte': 'hybride',
  // rôles des partenaires
  'lieu-d-accueil': 'lieu-accueil',
  'accueil': 'lieu-accueil',
  'soutiens': 'soutien',
  'medias': 'media',
  'communaute': 'communaute-invitee',
  'communautes-invitees': 'communaute-invitee',
  'intervenante': 'intervenant',
  'intervenants': 'intervenant',
  // types
  'petit-dej': 'petit-dejeuner',
  'table-ronde-debat': 'table-ronde',
  'journee-portes-ouvertes': 'portes-ouvertes',
};

function readEnum<T extends string>(
  value: string,
  allowed: readonly { value: T }[],
): T | null {
  const key = asKey(value);
  const canonical = ENUM_ALIASES[key] ?? key;
  return allowed.find((option) => option.value === canonical)?.value ?? null;
}

function allowedList(allowed: readonly { value: string }[]): string {
  return allowed.map((option) => option.value).join(', ');
}

/** Pays écrits en toutes lettres — ceux qu'un évènement Moze a une chance de croiser. */
const COUNTRIES: Readonly<Record<string, string>> = {
  france: 'FR',
  belgique: 'BE',
  suisse: 'CH',
  luxembourg: 'LU',
  monaco: 'MC',
};

const WEB_URL = /^https?:\/\/\S+$/;

const MONTHS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
];

const pad = (n: number | string) => String(n).padStart(2, '0');

/** « 18h30 », « 18:30 », « 9h » → `18:30`, `09:00` ; `null` sinon. */
function readTime(text: string): string | null {
  const m = /(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i.exec(text);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2] ?? '0');
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** Ce qu'une valeur de date a permis d'établir. */
interface ReadDate {
  /** Instant complet, avec décalage. */
  iso?: string;
  /** Jour seul, `AAAA-MM-JJ`, quand la source n'a pas donné d'heure. */
  day?: string;
  error?: string;
}

/**
 * Lit une date d'évènement.
 *
 * - ISO avec décalage (`2026-10-08T18:30:00+02:00`) : tel quel.
 * - ISO **sans** décalage : refusé. C'est la règle bloquante de la spec, et c'est une forme de
 *   machine — rien ne dit à quel fuseau elle pensait.
 * - Français (« jeudi 8 octobre 2026 à 18h30 ») : heure **de Paris**, où ont lieu les
 *   évènements ; le décalage est calculé pour la date, été comme hiver. C'est ainsi qu'un humain
 *   écrit une date dans un document, et il n'y a pas d'ambiguïté à lever.
 * - Jour seul : rendu comme tel. L'appelant décide s'il manque une heure.
 */
export function readEventDate(raw: string): ReadDate {
  const text = raw.trim();
  if (!text) return {};

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(text)) {
      return {
        error: `« ${text} » n'a pas de décalage horaire : écrire par exemple 2026-10-08T18:30:00+02:00 (+01:00 en hiver).`,
      };
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime())
      ? { error: `« ${text} » n'est pas une date lisible.` }
      : { iso: date.toISOString() };
  }

  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoDay) return { day: text };

  const plain = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const m = /(\d{1,2})\s*(?:er)?\s+([a-z]+)\s+(\d{4})(.*)$/.exec(plain);
  if (!m) return { error: `« ${text} » n'est pas une date reconnue.` };

  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return { error: `mois « ${m[2]} » non reconnu.` };

  const day = `${m[3]}-${pad(month + 1)}-${pad(Number(m[1]))}`;
  const time = readTime(m[4]);
  return time ? { iso: parisLocalToIso(`${day}T${time}`) ?? undefined } : { day };
}

/** Ce que la lecture des paires a produit. */
export interface EventFieldsRead {
  /** Valeurs converties, prêtes pour `EventInput`. Un champ illisible en est absent. */
  values: Partial<EventInput>;
  /** Les champs effectivement renseignés, dans l'ordre de première lecture. */
  filled: EventField[];
  /** Valeurs refusées — le champ est laissé de côté. */
  errors: string[];
  /** Ce qui mérite un regard sans rien empêcher. */
  warnings: string[];
  /** Étiquettes non reconnues, telles qu'écrites. */
  unknown: string[];
}

/**
 * Convertit des paires « étiquette : valeur » en champs d'évènement.
 *
 * Première occurrence retenue pour un champ simple : un document place ses métadonnées en tête,
 * et une phrase du corps pourrait ressembler à une étiquette. Les partenaires et intervenants,
 * eux, s'additionnent — une ligne par personne ou structure.
 */
export function readEventFields(
  pairs: readonly { label: string; value: string }[],
): EventFieldsRead {
  const values: Partial<EventInput> = {};
  const filled: EventField[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const unknown: string[] = [];
  const partners: EventPartner[] = [];
  let day: string | null = null;
  let hours: string | null = null;
  let startDay: string | null = null;

  const mark = (field: EventField) => {
    if (!filled.includes(field)) filled.push(field);
  };

  for (const { label, value: rawValue } of pairs) {
    const field = eventFieldFor(label);
    const value = rawValue.trim();
    if (!field) {
      unknown.push(label.trim());
      continue;
    }
    if (!value) continue;

    const name = EVENT_FIELD_NAMES[field];
    const max = MAX[field];
    if (max && value.length > max) {
      errors.push(`${name} : ${value.length} caractères, maximum ${max}.`);
      continue;
    }

    // Les champs répétables d'abord.
    if (field === 'partner' || field === 'speaker') {
      const partner = readPartner(value, field === 'speaker' ? 'intervenant' : null);
      if (typeof partner === 'string') errors.push(partner);
      else {
        partners.push(partner);
        mark(field);
      }
      continue;
    }

    if (filled.includes(field)) continue; // première occurrence retenue
    const errorsBefore = errors.length;

    switch (field) {
      case 'slug': {
        // Une adresse complète collée par erreur : on n'en garde que le dernier segment.
        const slug = toEventSlug(value.replace(/^https?:\/\/[^/]+\/(evenements\/)?/i, ''));
        if (!slug) {
          errors.push(`adresse de la page « ${value} » : aucun mot utilisable.`);
        } else {
          values.slug = slug;
          if (slug !== value) warnings.push(`adresse de la page normalisée : « ${slug} ».`);
        }
        break;
      }
      case 'type': {
        const type = readEnum(value, EVENT_TYPES);
        if (type) values.type = type;
        else {
          errors.push(
            `type « ${value} » inconnu. Attendu : ${allowedList(EVENT_TYPES)} — pour un autre format, « type: autre » et « type precis: ${value} ».`,
          );
        }
        break;
      }
      case 'mode': {
        const mode = readEnum(value, EVENT_MODES);
        if (mode) values.mode = mode;
        else errors.push(`mode « ${value} » inconnu. Attendu : ${allowedList(EVENT_MODES)}.`);
        break;
      }
      case 'roleMoze': {
        const role = readEnum(value, ROLES_MOZE);
        if (role) values.roleMoze = role;
        else errors.push(`rôle de Moze « ${value} » inconnu. Attendu : ${allowedList(ROLES_MOZE)}.`);
        break;
      }
      case 'access': {
        if (/gratuit/i.test(value)) {
          errors.push(`accès « ${value} » : écrire « libre » ou « sur-inscription », jamais « gratuit ».`);
          break;
        }
        const access = readEnum(value, EVENT_ACCESS);
        if (access) values.access = access;
        else errors.push(`accès « ${value} » inconnu. Attendu : ${allowedList(EVENT_ACCESS)}.`);
        break;
      }
      case 'startAt':
      case 'endAt':
      case 'registrationDeadline': {
        const read = readEventDate(value);
        if (read.error) {
          errors.push(`${name} : ${read.error}`);
        } else if (read.iso) {
          values[field] = read.iso;
          if (field === 'startAt') startDay = read.iso;
        } else if (read.day) {
          if (field === 'registrationDeadline') {
            // « Jusqu'au 6 octobre » : le jour entier compte.
            values.registrationDeadline = parisLocalToIso(`${read.day}T23:59`);
            warnings.push('date limite sans heure : fixée à 23h59 ce jour-là.');
          } else if (field === 'startAt') {
            day = day ?? read.day; // l'heure peut venir de « horaires »
            startDay = read.day;
          } else {
            errors.push(`${name} : « ${value} » n'a pas d'heure.`);
          }
        }
        break;
      }
      case 'day': {
        const read = readEventDate(value);
        if (read.error) errors.push(`date : ${read.error}`);
        else if (read.day) day = read.day;
        else if (read.iso) {
          // Une date avec heure sous « date » : c'est un début.
          values.startAt = values.startAt ?? read.iso;
        }
        break;
      }
      case 'hours':
        hours = value;
        break;
      case 'country': {
        const code = COUNTRIES[normalizeLabel(value)] ?? value.toUpperCase();
        if (/^[A-Z]{2}$/.test(code)) values.country = code;
        else errors.push(`pays « ${value} » : attendu un code à deux lettres (FR, BE…).`);
        break;
      }
      case 'wheelchairAccessible': {
        const no = ['non', 'no', 'false', '0', 'n'].includes(value.toLowerCase());
        if (estVrai(value) || no) values.wheelchairAccessible = !no;
        else errors.push(`PMR « ${value} » : attendu oui ou non.`);
        break;
      }
      case 'mapUrl':
        if (isGoogleMapsUrl(value)) values.mapUrl = value;
        else errors.push(`lien Google Maps « ${value} » : ce n'est pas une adresse Google Maps.`);
        break;
      case 'organizerUrl':
      case 'registrationUrl':
        if (WEB_URL.test(value)) values[field] = value;
        else errors.push(`${name} « ${value} » : adresse complète attendue, commençant par https://.`);
        break;
      case 'price': {
        const amount = Number(value.replace(/€|eur(os)?/gi, '').replace(',', '.').trim());
        if (Number.isFinite(amount) && amount >= 0) values.priceCents = Math.round(amount * 100);
        else errors.push(`prix « ${value} » : attendu un montant en euros.`);
        break;
      }
      case 'capacity':
      case 'registrationGoal': {
        const n = /^\s*(\d+)/.exec(value);
        if (n && Number(n[1]) > 0) values[field] = Number(n[1]);
        else errors.push(`${name} « ${value} » : attendu un nombre entier.`);
        break;
      }
      default:
        // Les champs de texte libre : titre, accroche, lieu, contact…
        (values as Record<string, unknown>)[field] = value;
    }

    // Marqué rempli seulement s'il l'est vraiment : un début réduit à un jour attend encore son
    // heure, et une seconde ligne « debut » complète doit pouvoir la donner.
    if (errors.length === errorsBefore && field in values) mark(field);
  }

  // « Date : jeudi 8 octobre 2026 » + « Horaires : 18h30 – 23h » — la façon naturelle d'écrire.
  if (hours && (day || startDay) && (!values.startAt || !values.endAt)) {
    const base = (day ?? startDay ?? '').slice(0, 10);
    const [from, to] = hours.split(/\s*(?:–|—|-|à|a)\s*/).map(readTime);
    if (from && !values.startAt) values.startAt = parisLocalToIso(`${base}T${from}`) ?? undefined;
    if (to && !values.endAt) values.endAt = parisLocalToIso(`${base}T${to}`) ?? undefined;
    if (!from) errors.push(`horaires « ${hours} » : attendu par exemple « 18h30 – 23h ».`);
    if (values.startAt) mark('startAt');
    if (values.endAt) mark('endAt');
  } else if (day && !values.startAt) {
    errors.push('une date est donnée sans heure : ajouter « horaires: 18h30 – 23h » ou un début complet.');
  }

  // Un début ou une fin posés par « date » ou « horaires » comptent comme renseignés.
  if (values.startAt) mark('startAt');
  if (values.endAt) mark('endAt');
  if (partners.length) values.partners = partners;

  return { values, filled, errors, warnings, unknown };
}

/**
 * Une ligne de partenaire : `rôle | nom | précision | site`, ou pour un intervenant
 * `nom | fonction | site`. L'adresse est reconnue où qu'elle soit. Renvoie un message d'erreur
 * si la ligne est inexploitable.
 */
function readPartner(value: string, fixedRole: PartnerRole | null): EventPartner | string {
  const parts = value.split('|').map((part) => part.trim());
  const url = parts.find((part) => WEB_URL.test(part)) ?? null;
  const rest = parts.filter((part) => part && part !== url);

  let role = fixedRole;
  if (!role) {
    role = readEnum(rest[0] ?? '', PARTNER_ROLES);
    if (!role) {
      return `partenaire « ${value} » : le premier élément doit être un rôle (${allowedList(PARTNER_ROLES)}).`;
    }
    rest.shift();
  }

  const [name, description] = rest;
  if (!name) return `partenaire « ${value} » : nom manquant.`;
  if (name.length > 150) return `partenaire « ${name.slice(0, 30)}… » : nom trop long (150 max).`;

  return {
    role,
    name,
    url,
    logoUrl: null,
    description: description ? description.slice(0, 200) : null,
  };
}

/**
 * Un `EventInput` complet à partir des champs lus, avec les valeurs par défaut de l'éditeur :
 * présentiel, en France, organisé par Moze tant que rien ne dit le contraire.
 */
export function toEventInput(values: Partial<EventInput>, content = ''): EventInput {
  const roleMoze = values.roleMoze ?? 'organisateur';
  const mozeOrganizes = roleMoze === 'organisateur' && !values.organizerName;
  return {
    title: values.title ?? '',
    // Absent, le back la calcule depuis le type, le titre et la date.
    ...(values.slug ? { slug: values.slug } : {}),
    type: values.type ?? null,
    // Le nom en toutes lettres n'a de sens que pour « autre ».
    typeLabel: values.type === 'autre' ? (values.typeLabel ?? null) : null,
    tagline: values.tagline ?? '',
    summary: values.summary ?? '',
    content,
    coverImageUrl: null,
    coverImageAlt: values.coverImageAlt ?? null,
    startAt: values.startAt ?? null,
    endAt: values.endAt ?? null,
    mode: values.mode ?? 'presentiel',
    venueName: values.venueName ?? null,
    street: values.street ?? null,
    postalCode: values.postalCode ?? null,
    city: values.city ?? null,
    region: values.region ?? null,
    country: values.country ?? 'FR',
    accessInfo: values.accessInfo ?? null,
    wheelchairAccessible: values.wheelchairAccessible ?? false,
    mapUrl: values.mapUrl ?? null,
    roleMoze,
    organizerName: mozeOrganizes ? 'Moze' : (values.organizerName ?? null),
    organizerUrl: mozeOrganizes ? 'https://www.moze.fr' : (values.organizerUrl ?? null),
    organizerLogoUrl: null,
    organizerContact: values.organizerContact ?? null,
    partners: values.partners ?? [],
    access: values.access ?? null,
    priceLabel: values.priceLabel ?? null,
    priceCents: values.priceCents ?? null,
    registrationUrl: values.registrationUrl ?? null,
    capacity: values.capacity ?? null,
    registrationGoal: values.registrationGoal ?? null,
    registrationDeadline: values.registrationDeadline ?? null,
    registrationInfo: values.registrationInfo ?? null,
  };
}
