/**
 * Évènements — spécification « Événements moze.fr » v1.0, étape « identité, temps et lieu,
 * cycle de vie ». Miroir des types du back (`src/events/event-lifecycle.ts`), qui fait foi.
 *
 * Le type s'appelle `SiteEvent` et non `Event` : ce dernier est l'évènement du DOM, présent
 * partout en global, et un import oublié compilerait sans rien signaler.
 */

/** Statut enregistré. `PAST` n'en fait pas partie : il est calculé par le back. */
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'FULL' | 'POSTPONED' | 'CANCELLED';

/** Statut affiché : l'enregistré, ou `PAST` trois heures après la fin. */
export type EventDisplayStatus = EventStatus | 'PAST';

export const EVENT_STATUS_LABELS: Record<EventDisplayStatus, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'À venir',
  FULL: 'Complet',
  POSTPONED: 'Reporté',
  CANCELLED: 'Annulé',
  PAST: 'Passé',
};

export type EventType =
  | 'afterwork'
  | 'atelier'
  | 'petit-dejeuner'
  | 'conference'
  | 'table-ronde'
  | 'salon'
  | 'webinaire'
  | 'portes-ouvertes'
  | 'autre';

/** « Autre » en dernier : le nom en toutes lettres se saisit dans `typeLabel`. */
export const EVENT_TYPES: readonly { value: EventType; label: string }[] = [
  { value: 'afterwork', label: 'Afterwork' },
  { value: 'atelier', label: 'Atelier' },
  { value: 'petit-dejeuner', label: 'Petit-déjeuner' },
  { value: 'conference', label: 'Conférence' },
  { value: 'table-ronde', label: 'Table ronde' },
  { value: 'salon', label: 'Salon' },
  { value: 'webinaire', label: 'Webinaire' },
  { value: 'portes-ouvertes', label: 'Portes ouvertes' },
  { value: 'autre', label: 'Autre' },
];

/** Longueur du type en toutes lettres (`TYPE_LABEL_MAX` du back). */
export const TYPE_LABEL_MAX = 40;

export type EventMode = 'presentiel' | 'en-ligne' | 'hybride';

export const EVENT_MODES: readonly { value: EventMode; label: string }[] = [
  { value: 'presentiel', label: 'Présentiel' },
  { value: 'en-ligne', label: 'En ligne' },
  { value: 'hybride', label: 'Hybride' },
];

/** Rôle de Moze dans l'évènement (spec, section 04). */
export type RoleMoze = 'organisateur' | 'co-organisateur' | 'partenaire' | 'relais';

export const ROLES_MOZE: readonly { value: RoleMoze; label: string; hint: string }[] = [
  { value: 'organisateur', label: 'Organisateur', hint: 'Moze conçoit, finance et reçoit.' },
  { value: 'co-organisateur', label: 'Co-organisateur', hint: 'Moze porte l’évènement avec un tiers, à égalité.' },
  { value: 'partenaire', label: 'Partenaire', hint: 'Moze contribue — intervention, lot, financement — sans organiser.' },
  { value: 'relais', label: 'Relais', hint: 'Moze publie l’évènement d’un tiers, sans y contribuer.' },
];

export type EventAccess = 'libre' | 'sur-inscription' | 'sur-invitation' | 'payant';

export const EVENT_ACCESS: readonly { value: EventAccess; label: string }[] = [
  { value: 'libre', label: 'Entrée libre' },
  { value: 'sur-inscription', label: 'Sur inscription' },
  { value: 'sur-invitation', label: 'Sur invitation' },
  { value: 'payant', label: 'Payant' },
];

export type PartnerRole = 'lieu-accueil' | 'soutien' | 'media' | 'communaute-invitee' | 'intervenant';

/** Libellés au pluriel : ils titrent les groupes de la rubrique « Qui organise ». */
export const PARTNER_ROLES: readonly { value: PartnerRole; label: string; group: string }[] = [
  { value: 'intervenant', label: 'Intervenant', group: 'Interviennent' },
  { value: 'lieu-accueil', label: 'Lieu d’accueil', group: 'Nous accueille' },
  { value: 'communaute-invitee', label: 'Communauté invitée', group: 'Communautés invitées' },
  { value: 'soutien', label: 'Soutien', group: 'Avec le soutien de' },
  { value: 'media', label: 'Média', group: 'Partenaires médias' },
];

export interface EventPartner {
  role: PartnerRole;
  name: string;
  url: string | null;
  logoUrl: string | null;
  description: string | null;
}

/** Le type affiché : son libellé, ou pour « Autre » le nom saisi — jamais le mot « Autre ». */
export function eventTypeLabel(type: string | null, typeLabel: string | null = null): string {
  if (type === 'autre') return typeLabel?.trim() || 'Évènement';
  return EVENT_TYPES.find((t) => t.value === type)?.label ?? 'Évènement';
}

/**
 * Nombre d'évènements en ligne en même temps. Doit rester aligné sur `MAX_ACTIVE_EVENTS` du
 * back (`src/events/active-events.ts`), qui fait foi et refuse la publication au-delà.
 */
export const MAX_ACTIVE_EVENTS = 1;

/** Carte du listing public. Les dates sont des ISO 8601. */
export interface EventCard {
  id: string;
  slug: string;
  title: string;
  type: EventType | null;
  /** Le nom du type quand `type` vaut `autre`. */
  typeLabel: string | null;
  tagline: string;
  summary: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  startAt: string | null;
  endAt: string | null;
  previousStartAt: string | null;
  mode: EventMode;
  venueName: string | null;
  city: string | null;
  roleMoze: RoleMoze;
  organizerName: string | null;
  access: EventAccess | null;
  status: EventDisplayStatus;
  statusReason: string | null;
  updatedAt: string;
}

/** Page publique d'un évènement. */
export interface SiteEvent extends EventCard {
  content: string;
  street: string | null;
  postalCode: string | null;
  region: string | null;
  country: string | null;
  accessInfo: string | null;
  wheelchairAccessible: boolean;
  mapUrl: string | null;
  organizerUrl: string | null;
  organizerLogoUrl: string | null;
  organizerContact: string | null;
  priceLabel: string | null;
  priceCents: number | null;
  registrationUrl: string | null;
  capacity: number | null;
  registrationDeadline: string | null;
  registrationInfo: string | null;
  partners: EventPartner[];
}

/** `GET /events` : ce qui est à venir, et les archives. */
export interface EventsHub {
  upcoming: EventCard[];
  past: EventCard[];
}

/** Ce dont le rendu a besoin — l'aperçu de l'éditeur le construit depuis le formulaire. */
export type EventViewData = Omit<SiteEvent, 'id' | 'slug' | 'updatedAt'>;

/** Évènement vu de l'admin : statut enregistré (qui décide des actions) et statut affiché. */
export interface AdminEvent extends Omit<SiteEvent, 'status'> {
  status: EventStatus;
  /** Donnée de pilotage : absente de la lecture publique. */
  registrationGoal: number | null;
  effectiveStatus: EventDisplayStatus;
  createdAt: string;
  publishedAt: string | null;
  /** Slug saisi dans l'éditeur : il ne suit plus le titre, le type ni la date. */
  slugManual: boolean;
}

/** Ligne de la liste d'administration : sans le corps ni les partenaires. */
export type AdminEventListItem = Omit<AdminEvent, 'content' | 'partners'>;

/** Corps de création / mise à jour. `null` efface un champ facultatif. */
export interface EventInput {
  title: string;
  /** Adresse saisie à la main. Absente : inchangée. Vide : calculée depuis type, titre et date. */
  slug?: string;
  type: EventType | null;
  typeLabel: string | null;
  tagline: string;
  summary: string;
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  /** ISO 8601 avec décalage horaire — le back refuse une date sans fuseau. */
  startAt: string | null;
  endAt: string | null;
  mode: EventMode;
  venueName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  accessInfo: string | null;
  wheelchairAccessible: boolean;
  mapUrl: string | null;
  roleMoze: RoleMoze;
  organizerName: string | null;
  organizerUrl: string | null;
  organizerLogoUrl: string | null;
  organizerContact: string | null;
  /** Liste complète : elle remplace celle en base. */
  partners: EventPartner[];
  access: EventAccess | null;
  priceLabel: string | null;
  priceCents: number | null;
  registrationUrl: string | null;
  capacity: number | null;
  registrationGoal: number | null;
  registrationDeadline: string | null;
  registrationInfo: string | null;
}

/**
 * Ce qui manque pour publier. Copie de `missingForPublication` du back, qui fait foi : ce double
 * ne sert qu'à afficher la liste pendant la saisie, plutôt qu'au refus de la publication.
 */
export function missingForPublication(e: EventInput): string[] {
  const missing: string[] = [];
  const blank = (value: string | null | undefined) => !value?.trim();

  if (blank(e.title)) missing.push('le titre');
  if (blank(e.type)) missing.push('le type');
  else if (e.type === 'autre' && blank(e.typeLabel)) missing.push('le nom du type');
  if (blank(e.tagline)) missing.push("l'accroche");
  if (!e.startAt) missing.push('la date de début');
  if (!e.endAt) missing.push('la date de fin');
  if (e.startAt && e.endAt && new Date(e.endAt).getTime() <= new Date(e.startAt).getTime()) {
    missing.push('une fin postérieure au début');
  }

  if (e.mode !== 'en-ligne') {
    if (blank(e.venueName)) missing.push('le nom du lieu');
    if (blank(e.street)) missing.push('la rue');
    if (blank(e.postalCode)) missing.push('le code postal');
    if (blank(e.city)) missing.push('la ville');
    if (blank(e.country)) missing.push('le pays');
  }

  if (blank(e.organizerName)) missing.push("le nom de l'organisateur");
  if (e.roleMoze === 'relais' && blank(e.organizerUrl)) missing.push("le site de l'organisateur");
  if (blank(e.access)) missing.push("les conditions d'accès");
  if (blank(e.priceLabel)) missing.push('la mention tarifaire');
  if ((e.access === 'sur-inscription' || e.access === 'payant') && blank(e.registrationUrl)) {
    missing.push("l'adresse d'inscription");
  }

  return missing;
}

/** « gratuit », « gratuite », « gratuitement »… — la famille entière, pas « ingratuit ». */
const GRATUIT = /(^|[^a-zà-ÿ])gratuit/i;

/** Ce qui est interdit à la publication. Copie de `forbiddenForPublication` du back, qui fait foi. */
export function forbiddenForPublication(e: EventInput): string[] {
  const forbidden: string[] = [];
  if (e.priceLabel && GRATUIT.test(e.priceLabel)) {
    forbidden.push(
      'La mention tarifaire ne peut pas contenir « gratuit » : écrivez « entrée libre, sur inscription » ou « boissons offertes ».',
    );
  }
  if (
    e.registrationDeadline &&
    e.startAt &&
    new Date(e.registrationDeadline).getTime() > new Date(e.startAt).getTime()
  ) {
    forbidden.push('La date limite d’inscription tombe après le début de l’évènement.');
  }
  return forbidden;
}

/**
 * Le vocabulaire que la charte de l'ICP du Mozeur écarte (spec, section 07), avec ce qu'on écrit
 * à la place. Détecté, pas bloqué : le contexte peut justifier le mot, c'est à la relecture de
 * trancher.
 */
const OFF_CHARTER: readonly { pattern: RegExp; word: string; instead: string; why?: string }[] = [
  { pattern: /(^|[^a-zà-ÿ])communaut[ée]s?(?![a-zà-ÿ])/i, word: '« communauté »', instead: '« les indépendants de… »', why: 'Admis seulement avec une preuve.' },
  { pattern: /(^|[^a-zà-ÿ])r[ée]seaux?(?![a-zà-ÿ])/i, word: '« réseau »', instead: '« travailler à plusieurs »' },
  { pattern: /petits? entrepreneurs?/i, word: '« petits entrepreneurs »', instead: '« indépendants »' },
  { pattern: /auto-?entrepreneurs?/i, word: '« auto-entrepreneur »', instead: '« micro-entrepreneurs »' },
  { pattern: /(^|[^a-zà-ÿ])(plateforme|solution|outil)s?(?![a-zà-ÿ])/i, word: '« outil », « solution »', instead: 'client, revenu ou cadre', why: 'Mots écartés : « plateforme », « solution », « outil ». Entrer par le client, le revenu ou le cadre.' },
  { pattern: /r[ée]volutionnaire|game.?changer/i, word: '« révolutionnaire »', instead: '« concret », « testé »', why: 'Mots écartés : « révolutionnaire », « game changer ». Préférer « concret », « conforme », « simple », « testé ».' },
];

/**
 * Un avertissement, en deux temps pour se lire d'un coup d'œil : le sujet (« Maps »), puis ce
 * qu'il faut faire (« lien absent »). L'explication, plus longue, ne s'affiche qu'au survol.
 */
export interface PublicationWarning {
  topic: string;
  fix: string;
  why?: string;
}

/** Forme d'une ligne, pour les listes de texte (écran de collage). */
export function warningText(w: PublicationWarning): string {
  return `${w.topic} : ${w.fix}`;
}

/** Marge minimale de l'objectif d'inscrits sur la jauge (spec : en dessous, salle aux trois quarts vide). */
const GOAL_MARGIN = 0.2;

/** Largeur d'image en dessous de laquelle Google ignore le visuel. */
export const MIN_IMAGE_WIDTH = 1920;

/**
 * Les **avertissements** de la spec (section 06) : affichés dans l'administration, ils laissent
 * publier. Calculés ici seulement — le back n'en a pas besoin, puisqu'ils ne bloquent rien.
 *
 * `imageWidth` : largeur réelle de l'image, lue par l'éditeur une fois l'image chargée.
 */
export function publicationWarnings(
  e: EventInput,
  imageWidth: number | null = null,
): PublicationWarning[] {
  const warnings: PublicationWarning[] = [];

  if (e.capacity && e.registrationGoal && e.registrationGoal < e.capacity * (1 + GOAL_MARGIN)) {
    warnings.push({
      topic: 'Inscrits',
      fix: `visez ${Math.ceil(e.capacity * (1 + GOAL_MARGIN))} pour ${e.capacity} places`,
      why: 'On compte 30 à 40 % de défection sur une entrée libre : un objectif trop proche de la jauge laisse la salle à moitié vide.',
    });
  }

  if (e.coverImageUrl && imageWidth !== null && imageWidth < MIN_IMAGE_WIDTH) {
    warnings.push({
      topic: 'Image',
      fix: `${imageWidth} px, ${MIN_IMAGE_WIDTH} px minimum`,
      why: `Google ignore les visuels de moins de ${MIN_IMAGE_WIDTH} px de large.`,
    });
  }

  // Le lien n'est jamais rédigé par l'IA (il serait deviné) : son absence est normale après un
  // collage, mais la recherche sur l'adresse peut tomber à côté du lieu.
  if (e.mode !== 'en-ligne' && !e.mapUrl?.trim()) {
    warnings.push({
      topic: 'Maps',
      fix: 'lien absent',
      why: 'Sans lien, « Voir sur Google Maps » cherche l’adresse et peut tomber à côté du lieu. Collez le lien « Partager » de Maps.',
    });
  }

  const text = [e.title, e.tagline, e.summary, e.content.replace(/<[^>]*>/g, ' ')].join(' \n ');
  for (const rule of OFF_CHARTER) {
    if (rule.pattern.test(text)) {
      warnings.push({ topic: 'Charte', fix: `${rule.word} → ${rule.instead}`, why: rule.why });
    }
  }

  return warnings;
}

/** Prix affichable d'un montant en centimes : « 15 € », « 12,50 € ». */
export function formatPrice(cents: number): string {
  const euros = cents / 100;
  return `${euros.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(euros) ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

/**
 * Lien du bouton « Voir sur Google Maps » : celui saisi, ou à défaut une recherche sur
 * l'adresse — l'URL documentée par Google (`maps/search/?api=1`), stable et sans clé d'API.
 * `null` pour un évènement en ligne ou sans adresse : un bouton qui chercherait « Avignon »
 * n'aiderait personne à trouver la salle.
 */
export function eventMapsUrl(
  e: Pick<SiteEvent, 'mapUrl' | 'mode' | 'venueName' | 'street' | 'postalCode' | 'city'>,
): string | null {
  if (e.mapUrl) return e.mapUrl;
  if (e.mode === 'en-ligne' || !e.street?.trim() || !e.city?.trim()) return null;

  const query = [e.venueName, e.street, [e.postalCode, e.city].filter(Boolean).join(' ')]
    .filter((part) => part?.trim())
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
