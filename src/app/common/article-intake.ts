import { ArticleInput } from '../model/article.model';

/**
 * Structure commune aux deux portes d'entrée : le document Word et le texte collé.
 *
 * Les deux lecteurs produisent **le même objet**, qui alimente le même écran d'arrivée. Sans
 * ce point de rencontre, chaque source aurait son propre chemin jusqu'à la base — et chaque
 * évolution devrait être faite deux fois.
 */

/**
 * Une annexe : ce qui accompagne l'article sans en faire partie.
 *
 * Posts réseaux sociaux, idée d'image, analyse de mot-clé, liens internes retenus. Rien de
 * tout cela n'est publié ; tout sert à un humain, une fois, au moment de diffuser. D'où le
 * choix de garder le texte tel quel plutôt que de le structurer : il est destiné à être
 * **copié**, pas interrogé.
 */
export interface IntakeAnnex {
  /** Identifiant stable quand l'annexe est reconnue (`linkedin`, `seo`…), sinon dérivé du libellé. */
  slot: string;
  /** Libellé d'origine, tel qu'écrit dans le document. C'est lui qu'on affiche. */
  label: string;
  body: string;
}

export interface IntakeArticle {
  input: ArticleInput & { origin: 'ASSISTANT' };
  /** Instant de parution proposé, en ISO. Ne publie rien : il attend une validation. */
  proposedPublishAt: string | null;
  /**
   * Jour de parution lu dans la source, quand elle n'a pas donné d'heure (`AAAA-MM-JJ`).
   *
   * Séparé de `proposedPublishAt` à dessein : le logiciel n'invente pas d'heure. Le jour est
   * proposé, l'heure reste à saisir — et tant qu'elle ne l'est pas, l'article ne peut pas
   * être programmé.
   */
  proposedPublishDay: string | null;
  proposedFeatured: boolean;
  /** Série éditoriale — « Rendez-vous » dans un gabarit, « Catégorie » dans l'autre. */
  series: string | null;
  /** Texte alternatif de la couverture. Donnée **publique**, pas une annexe. */
  coverImageAlt: string | null;
  annexes: IntakeAnnex[];
  /** Ce qui mérite un regard sans empêcher la création. */
  warnings: string[];
}

export interface IntakeResult {
  articles: IntakeArticle[];
  /** Ce qui empêche de créer. */
  errors: string[];
}

// --- Vocabulaire ------------------------------------------------------------

/**
 * Champs d'une ligne, reconnus par leur étiquette.
 *
 * **C'est le vocabulaire qui filtre, pas la position.** Votre prose emploie beaucoup la
 * construction « Formule courte : explication » — « Première vérification : … », « Ce qui
 * change : … » — qui ressemble trait pour trait à une étiquette. Ne retenir que les libellés
 * connus est ce qui empêche ces phrases de passer pour des métadonnées.
 */
export const FIELD_LABELS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['title', ['titre', 'titre de l article', 'titre article']],
  ['slug', ['slug', 'url', 'identifiant']],
  ['excerpt', ['extrait', 'chapo', 'resume', 'accroche']],
  ['tags', ['tags', 'tag', 'mots cles', 'etiquettes']],
  ['metaTitle', ['meta title', 'metatitle', 'titre seo', 'balise title']],
  ['metaDescription', ['meta description', 'metadescription', 'description seo']],
  ['publishAt', ['date de publication', 'date', 'parution']],
  ['series', ['rendez vous', 'categorie', 'rubrique', 'serie']],
  ['coverImageAlt', ['texte alternatif', 'alt', 'texte alt']],
  // « alaune » en un mot : c'est la forme du format collé, « à la une » celle des documents.
  ['featured', ['a la une', 'alaune', 'une', 'mise en avant']],
];

/**
 * Notes internes tenant sur une ligne. Elles deviennent des annexes plutôt que des colonnes :
 * on les lit une fois, on ne les édite jamais, et elles n'ont aucune raison d'alourdir la
 * table des articles.
 */
export const ANNEX_LABELS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['image', ['idee d image', 'idee image', 'visuel']],
  ['seo-keyword', ['mot cle principal', 'mot cle']],
  ['seo-rationale', ['justification du mot cle', 'justification']],
  ['seo-queries', ['requetes secondaires', 'requetes']],
  ['seo-cannibalisation', ['verification de cannibalisation', 'cannibalisation']],
];

/** Blocs reconnus, pour un ordre et un libellé stables à l'affichage. */
export const ANNEX_BLOCKS: ReadonlyArray<readonly [string, readonly string[]]> = [
  // Emplacement historique `moze-connect`, aujourd'hui MozePlace : les deux noms y mènent, pour
  // que les documents déjà rédigés et les nouveaux atterrissent au même endroit.
  [
    'moze-connect',
    [
      'post mozeplace',
      'mozeplace',
      'post moze place',
      'moze place',
      'post moze connect',
      'moze connect',
    ],
  ],
  ['linkedin', ['post linkedin', 'linkedin']],
  ['instagram', ['post instagram', 'instagram']],
  ['facebook', ['post facebook', 'facebook']],
  ['internal-links', ['liens internes utilises', 'liens internes']],
];

/**
 * Libellé d'affichage des emplacements connus.
 *
 * Les deux sources nomment les mêmes choses différemment : le document écrit « Post LinkedIn »,
 * le texte collé écrit `--- linkedin`. Sans cette table, la même annexe apparaîtrait sous deux
 * noms selon la porte d'entrée empruntée.
 */
export const ANNEX_TITLES: Readonly<Record<string, string>> = {
  'moze-connect': 'Post MozePlace',
  linkedin: 'Post LinkedIn',
  instagram: 'Post Instagram',
  facebook: 'Post Facebook',
  'internal-links': 'Liens internes',
  image: 'Idée d’image',
  'seo-keyword': 'Mot-clé principal',
  'seo-rationale': 'Justification du mot-clé',
  'seo-queries': 'Requêtes secondaires',
  'seo-cannibalisation': 'Vérification de cannibalisation',
};

/**
 * Ce qui part au back à la création, depuis ce qui a été lu.
 *
 * `IntakeArticle` sépare l'article de ce qui l'accompagne — c'est ce qui permet à l'écran
 * d'arrivée de montrer les deux avant de créer. Le back, lui, prend le tout d'un seul appel :
 * un article dont les posts arriveraient par une seconde requête pourrait exister sans eux si
 * celle-ci échouait.
 *
 * Les champs vides sont **omis** plutôt qu'envoyés à `null` : la validation du back refuse
 * tout champ inconnu, et n'envoyer que ce qu'on sait garde la requête lisible dans un journal.
 */
export function toCreatePayload(
  article: IntakeArticle,
): ArticleInput & { origin: 'ASSISTANT' } {
  return {
    ...article.input,
    ...(article.coverImageAlt ? { coverImageAlt: article.coverImageAlt } : {}),
    ...(article.series ? { series: article.series } : {}),
    ...(article.annexes.length
      ? {
          annexes: article.annexes.map(({ slot, label, body }) => ({
            slot,
            label,
            body,
          })),
        }
      : {}),
  };
}

/** Comment nommer une annexe à l'écran. Le libellé d'origine sert de repli. */
export function annexTitle(annex: { slot: string; label: string }): string {
  return ANNEX_TITLES[annex.slot] ?? annex.label;
}

/**
 * Ordre d'affichage : les emplacements connus d'abord, dans l'ordre de la table, le reste
 * ensuite. Les posts avant les notes SEO — c'est ce qu'on copie, donc ce qu'on cherche.
 */
export function sortAnnexes<T extends { slot: string }>(
  annexes: readonly T[],
): T[] {
  const ordre = Object.keys(ANNEX_TITLES);
  const rang = (slot: string) => {
    const i = ordre.indexOf(slot);
    return i < 0 ? ordre.length : i;
  };
  return [...annexes].sort((a, b) => rang(a.slot) - rang(b.slot));
}

/** Forme comparable d'une étiquette : sans accents, sans parenthèses, en minuscules. */
export function normalizeLabel(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Le nom de champ correspondant à une étiquette, ou `null`. */
export function fieldFor(label: string): string | null {
  for (const [field, alias] of FIELD_LABELS) if (alias.includes(label)) return field;
  return null;
}

/** L'emplacement d'annexe correspondant à une étiquette, ou `null`. */
export function annexSlotFor(
  label: string,
  table: ReadonlyArray<readonly [string, readonly string[]]>,
): string | null {
  for (const [slot, alias] of table) {
    if (alias.some((a) => label === a || label.startsWith(`${a} `))) return slot;
  }
  return null;
}

/** Repli quand un bloc n'est pas reconnu : on garde son libellé, réduit à un identifiant. */
export function slugifyLabel(label: string): string {
  return normalizeLabel(label).replace(/\s+/g, '-').slice(0, 40) || 'annexe';
}

// --- Dates ------------------------------------------------------------------

const MOIS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
];

/**
 * Ce qu'une ligne de date a permis d'établir.
 *
 * Deux résultats distincts, et c'est délibéré : **un jour n'est pas un instant.** Les
 * documents écrivent « Mardi 1er septembre 2026 » sans heure ; compléter à une heure
 * arbitraire produirait une valeur plausible et fausse, qui publierait à l'heure inventée
 * si personne ne la relisait. On rend donc le jour tel quel, et l'heure reste à saisir.
 */
export interface DateLue {
  /** Instant complet, uniquement quand la source en donnait un (avec fuseau). */
  iso: string | null;
  /** Jour seul, au format `AAAA-MM-JJ`, quand la source n'a donné qu'une date. */
  jour: string | null;
  erreur?: string;
}

/**
 * Lit une date de parution, ISO ou française.
 *
 * Une date ISO n'est acceptée qu'avec son fuseau — sans lui elle serait lue comme de l'UTC
 * et l'article paraîtrait décalé de deux heures en été.
 */
export function parseDateFr(brut: string): DateLue {
  const texte = brut.trim();
  if (!texte) return { iso: null, jour: null };

  // Forme ISO — exige un fuseau explicite.
  if (/^\d{4}-\d{2}-\d{2}T/.test(texte)) {
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(texte)) {
      return {
        iso: null,
        jour: null,
        erreur:
          `date « ${texte} » sans fuseau horaire. Attendu par exemple ` +
          '2026-09-14T08:00:00+02:00 (+02:00 en été, +01:00 en hiver).',
      };
    }
    const d = new Date(texte);
    return Number.isNaN(d.getTime())
      ? { iso: null, jour: null, erreur: `date « ${texte} » illisible.` }
      : { iso: d.toISOString(), jour: null };
  }

  // Forme purement numérique : `AAAA-MM-JJ`, un jour sans heure.
  const isoJour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);
  if (isoJour) return { iso: null, jour: texte };

  // Forme française : jour de semaine facultatif, « 1er » toléré, mois en toutes lettres.
  const sansAccent = texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const m = /(\d{1,2})\s*(?:er)?\s+([a-z]+)\s+(\d{4})/.exec(sansAccent);
  if (!m) return { iso: null, jour: null, erreur: `date « ${texte} » non reconnue.` };

  const mois = MOIS.indexOf(m[2]);
  if (mois < 0) return { iso: null, jour: null, erreur: `mois « ${m[2]} » non reconnu.` };

  const jj = String(Number(m[1])).padStart(2, '0');
  const mm = String(mois + 1).padStart(2, '0');
  return { iso: null, jour: `${m[3]}-${mm}-${jj}` };
}

/** `oui`, `x`, `true`… — les façons d'écrire un booléen dans un document. */
export function estVrai(valeur: string): boolean {
  return ['oui', 'yes', 'true', '1', 'o', 'x'].includes(valeur.trim().toLowerCase());
}
