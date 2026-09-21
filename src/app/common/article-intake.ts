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
  /** Numéro d'épisode dans la série. `null` : le back prend la suite du dernier. */
  seriesPosition: number | null;
  /**
   * Nombre d'épisodes annoncé pour la série. Le serveur ne le pose que sur une série qui n'en
   * annonce pas encore : un article ne défait pas le total choisi sur l'écran des séries.
   */
  seriesPlannedCount: number | null;
  /** Texte alternatif de la couverture. Donnée **publique**, pas une annexe. */
  coverImageAlt: string | null;
  annexes: IntakeAnnex[];
  /** Ce qui mérite un regard sans empêcher la création. */
  warnings: string[];
}

/**
 * Le brouillon d'une série, tel qu'un bloc `type: série` le décrit.
 *
 * Un teaser moins son image : l'IA sait écrire un nom, une accroche, un total et ce que
 * devrait montrer l'image de tête, mais elle ne produit pas l'image. La série reste donc un
 * brouillon jusqu'à ce qu'un humain la pose en relecture — c'est ce geste qui la valide.
 */
export interface IntakeSeries {
  title: string;
  pitch: string;
  plannedCount: number | null;
  /** L'idée d'image de tête, lue dans le bloc `--- image`. */
  imageIdea: string;
  warnings: string[];
}

export interface IntakeResult {
  articles: IntakeArticle[];
  /** Les brouillons de série déclarés par leur propre bloc. Toujours vide pour un document Word. */
  series: IntakeSeries[];
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
  // `type: série` : le bloc décrit une série, pas un article (cf. `IntakeSeries`).
  ['type', ['type', 'type de brouillon']],
  ['title', ['titre', 'titre de l article', 'titre article']],
  ['slug', ['slug', 'url', 'identifiant']],
  ['excerpt', ['extrait', 'chapo', 'resume', 'accroche']],
  ['tags', ['tags', 'tag', 'mots cles', 'etiquettes']],
  ['metaTitle', ['meta title', 'metatitle', 'titre seo', 'balise title']],
  ['metaDescription', ['meta description', 'metadescription', 'description seo']],
  ['publishAt', ['date de publication', 'date', 'parution']],
  ['series', ['rendez vous', 'categorie', 'rubrique', 'serie']],
  ['seriesPosition', ['episode', 'numero d episode']],
  ['seriesPlannedCount', ['episodes', 'nombre d episodes', 'total d episodes']],
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

/** « — épisode 2 » en fin de nom de série : l'ancienne façon d'écrire le numéro. */
const EPISODE_SUFFIX = /\s*[—–-]\s*[ée]pisode\s*(\d+)\s*$/i;

/** « (4/6) » — ou « [4/6] » — dans un titre, espaces tolérés. */
const TITLE_FRACTION = /\s*[([]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*[)\]]/;

/** Ponctuation laissée en suspens par le retrait de la numérotation : « … pour les nuls — ». */
const TRAILING_PUNCT = /[\s:–—-]+$/;

/** Ce qu'un titre numéroté « (4/6) » dit de sa série. */
export interface TitreNumerote {
  /** Le titre débarrassé de sa numérotation, la ponctuation recollée. */
  title: string;
  /** Ce qui précède le « (4/6) » : le nom de série que le titre propose. */
  series: string;
  position: number;
  /** Le total annoncé — le « 6 ». */
  plannedCount: number;
}

/**
 * La série qu'un titre trahit : « La facturation pour les nuls (4/6) : choisir son outil ».
 *
 * C'est la façon dont une IA numérote spontanément une suite, malgré la consigne inverse du
 * prompt — autant la lire que la laisser partir en ligne. Même règle que la reprise des
 * anciens articles côté serveur (`series/legacy-series.ts`), pour qu'un même titre donne la
 * même série des deux côtés.
 *
 * Rien n'est conclu d'une numérotation seule : sans nom devant elle, le titre ne nomme aucune
 * série, et on préfère ne rien proposer à proposer n'importe quoi.
 */
export function readTitleNumbering(raw: string): TitreNumerote | null {
  const titre = raw.trim();
  const fraction = TITLE_FRACTION.exec(titre);
  if (!fraction || fraction.index === 0) return null;

  const position = Number(fraction[1]);
  const plannedCount = Number(fraction[2]);
  // « (7/6) » ne décrit rien de cohérent : on laisse le titre tranquille.
  if (position < 1 || plannedCount < position) return null;

  const series = titre.slice(0, fraction.index).replace(TRAILING_PUNCT, '').trim();
  if (!series) return null;

  return {
    // « …pour les nuls (4/6) : choisir » → « …pour les nuls : choisir ».
    title: titre.replace(TITLE_FRACTION, '').replace(/\s+:/, ' :').trim(),
    series,
    position,
    plannedCount,
  };
}

/** La série d'un article, telle que sa source la donne. */
export interface SeriesFields {
  /** Le titre de l'article, sans la numérotation qu'il portait peut-être. */
  title: string;
  series: string | null;
  seriesPosition: number | null;
  /** Nombre d'épisodes annoncé — le « 6 » de « (2/6) ». */
  seriesPlannedCount: number | null;
}

/**
 * La série et le numéro d'épisode lus dans une source, en croisant **l'en-tête et le titre**.
 *
 * L'en-tête prime : c'est ce qui a été écrit exprès. Le titre ne sert que de secours, mais son
 * « (4/6) » en est retiré dans tous les cas dès qu'une série est établie — le site écrit
 * « Épisode 4 sur 6 » de lui-même, et le laisser l'afficherait deux fois.
 *
 * Le numéro vient de la ligne `episode:`, à défaut du « (4/6) » du titre, à défaut de la fin du
 * nom de série (« Les silences du métier — épisode 2 », l'ancienne convention), qui en est alors
 * retirée : la série s'appelle « Les silences du métier ».
 */
export function readSeriesFields(
  series: string | undefined,
  episode: string | undefined,
  titre = '',
  total?: string,
): SeriesFields {
  const text = series?.trim() ?? '';
  const suffix = EPISODE_SUFFIX.exec(text);
  const name = (suffix ? text.slice(0, suffix.index) : text).trim();
  const dansLeTitre = readTitleNumbering(titre);

  const nom = name || dansLeTitre?.series || null;
  const fromLine = /\d+/.exec(episode ?? '');
  const position = Number(
    fromLine?.[0] ?? dansLeTitre?.position ?? suffix?.[1] ?? NaN,
  );
  const annonce = Number(/\d+/.exec(total ?? '')?.[0] ?? dansLeTitre?.plannedCount ?? NaN);

  return {
    title: nom && dansLeTitre ? dansLeTitre.title : titre.trim(),
    series: nom,
    seriesPosition: nom && position >= 1 && position <= 99 ? position : null,
    seriesPlannedCount: nom && annonce >= 1 && annonce <= 99 ? annonce : null,
  };
}

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
    ...(article.series && article.seriesPosition ? { seriesPosition: article.seriesPosition } : {}),
    ...(article.series && article.seriesPlannedCount
      ? { seriesPlannedCount: article.seriesPlannedCount }
      : {}),
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
