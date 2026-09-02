import { DocxParagraph, readDocx } from './docx';
import { findUrls, linkifyHtml } from './link-detection';

/**
 * Traduction d'un document Word en champs d'article.
 *
 * Les documents de la rédaction suivent une trame constante : un bloc « Métadonnées éditoriales »
 * fait de lignes `Étiquette : valeur`, des sections de publication réseaux sociaux, puis
 * l'article lui-même sous son propre titre de niveau 1. On lit donc les étiquettes pour les
 * champs, et tout ce qui suit le DERNIER titre de niveau 1 pour le corps — ce qui laisse
 * naturellement de côté les posts LinkedIn, Instagram & co., qui les précèdent.
 *
 * Un document qui ne suit pas cette trame reste importable : sans bloc d'étiquettes, on retombe
 * sur le titre du document et son texte, et les champs manquants sont signalés à l'admin.
 */

/** Les champs qu'un import peut renseigner. */
export type ImportField =
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'content'
  | 'tags'
  | 'metaTitle'
  | 'metaDescription'
  | 'coverImageUrl';

/** Libellés affichés — ceux du formulaire, pour que le rapport d'import soit lisible. */
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  title: 'Titre',
  slug: 'Slug',
  excerpt: 'Extrait',
  content: 'Contenu',
  tags: 'Tags',
  metaTitle: 'Meta title',
  metaDescription: 'Meta description',
  coverImageUrl: 'Image de couverture',
};

export interface ImportedArticle {
  readonly values: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    tags?: string[];
    metaTitle?: string;
    metaDescription?: string;
  };
  /** Champs effectivement renseignés par l'import. */
  readonly filled: readonly ImportField[];
  /** Champs restés vides : c'est eux que l'écran signale en rouge. */
  readonly missing: readonly ImportField[];
  /** Le document embarquait des images — elles ne sont pas importées, l'admin doit le savoir. */
  readonly hasImages: boolean;
}

/**
 * Étiquettes reconnues dans le bloc de métadonnées, une fois normalisées.
 *
 * Plusieurs formulations par champ : les documents viennent de personnes différentes, et une
 * trame évolue. Mieux vaut quelques synonymes qu'un champ silencieusement vide.
 */
const LABELS: ReadonlyArray<readonly [ImportField, readonly string[]]> = [
  ['title', ['titre', 'titre de l article', 'titre article']],
  ['slug', ['slug', 'url', 'identifiant']],
  ['excerpt', ['extrait', 'chapo', 'resume', 'accroche']],
  ['tags', ['tags', 'tag', 'mots cles', 'etiquettes']],
  ['metaTitle', ['meta title', 'metatitle', 'titre seo', 'balise title']],
  ['metaDescription', ['meta description', 'metadescription', 'description seo']],
];

/**
 * Forme comparable d'une étiquette : sans accents, sans parenthèses, en minuscules.
 *
 * Les documents précisent volontiers une contrainte entre parenthèses — « Meta title
 * (50 caractères) », « Slug (à saisir manuellement dans le CMS) » — qui ne fait pas partie du
 * nom du champ.
 */
function normalizeLabel(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Découpe une ligne `Étiquette : valeur` sur le PREMIER deux-points.
 *
 * Les valeurs en contiennent souvent — « Meta title : Journée type freelance : pourquoi elle
 * n'existe pas » — et découper sur le dernier, ou sur tous, les amputerait.
 */
function splitLabelled(text: string): { label: string; value: string } | null {
  const at = text.indexOf(':');
  if (at <= 0) return null;

  const label = normalizeLabel(text.slice(0, at));
  const value = text.slice(at + 1).trim();
  // Une phrase ordinaire contenant un deux-points n'est pas une étiquette : au-delà de
  // quelques mots, on n'a affaire qu'à du texte courant.
  if (!label || label.split(' ').length > 5) return null;

  return { label, value };
}

/** Le champ correspondant à une étiquette, s'il y en a un. */
function fieldFor(label: string): ImportField | null {
  for (const [field, aliases] of LABELS) {
    if (aliases.includes(label)) return field;
  }
  return null;
}

/**
 * Corps de l'article, en HTML limité aux balises acceptées par le back.
 *
 * Les titres sont ramenés dans la plage autorisée : le niveau 1 est celui de l'article, déjà
 * rendu par la page — un `h1` de plus dans le contenu casserait la hiérarchie du document.
 */
function toHtml(paragraphs: readonly DocxParagraph[]): string {
  const out: string[] = [];
  let openList: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (openList) out.push(`</${openList}>`);
    openList = null;
  };

  for (const p of paragraphs) {
    if (p.list) {
      if (openList !== p.list) {
        closeList();
        out.push(`<${p.list}>`);
        openList = p.list;
      }
      out.push(`<li>${unwrapParenthesisedUrls(p.html)}</li>`);
      continue;
    }

    closeList();

    if (p.heading >= 1) {
      // 1 et 2 → h2, au-delà → h3 : la whitelist du back n'accepte que ces deux niveaux.
      const tag = p.heading <= 2 ? 'h2' : 'h3';
      out.push(`<${tag}>${unwrapParenthesisedUrls(p.html)}</${tag}>`);
      continue;
    }

    out.push(`<p>${unwrapParenthesisedUrls(p.html)}</p>`);
  }

  closeList();
  return out.join('\n');
}

/**
 * Retire les parenthèses qui **encadrent une URL**, et elles seules.
 *
 * Les documents de la rédaction écrivent volontiers « Ancre « … » — (https://moze.fr/blog/x) » :
 * la parenthèse fermante finit collée à l'adresse, qui devient alors un lien mort. On ne touche
 * qu'aux paires dont le contenu est **exactement** une URL — « (voir le blog) » ou « (cf. RGPD) »
 * gardent les leurs, et une parenthèse ouverte à l'intérieur d'une adresse
 * (`…/wiki/Foo_(bar)`) n'est pas concernée puisque la paire ne l'encadre pas.
 */
export function unwrapParenthesisedUrls(text: string): string {
  return text.replace(/\(([^()\s]+)\)/g, (whole, inner: string) => {
    const urls = findUrls(inner);
    // Une seule URL, et elle occupe tout l'intérieur : la paire n'entoure rien d'autre.
    return urls.length === 1 && urls[0].text === inner ? inner : whole;
  });
}

/** Découpe une liste de tags saisie en une ligne. */
function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,;·]|\s+—\s+/)
        .map((t) => t.trim().replace(/^[#-]\s*/, ''))
        .filter(Boolean),
    ),
  ];
}

/**
 * Lit un document Word et en tire les champs d'un article.
 *
 * @throws {DocxReadError} si le fichier n'est pas un `.docx` lisible.
 */
export async function importArticleFromDocx(file: Blob): Promise<ImportedArticle> {
  const { paragraphs, core, hasImages } = await readDocx(file);

  // --- Champs étiquetés -------------------------------------------------
  const values: Record<string, string> = {};
  for (const p of paragraphs) {
    if (p.heading >= 1) continue; // un titre de section n'est pas une étiquette

    const parsed = splitLabelled(p.text);
    if (!parsed?.value) continue;

    const field = fieldFor(parsed.label);
    // Première occurrence retenue : la trame place les métadonnées en tête, et une phrase du
    // corps pourrait ressembler à une étiquette.
    if (field && !values[field]) values[field] = parsed.value;
  }

  // --- Corps de l'article -----------------------------------------------
  // Tout ce qui suit le dernier titre de niveau 1. Ce titre est celui de l'article ; ce qui le
  // précède est l'appareil éditorial (métadonnées, posts réseaux sociaux).
  let start = -1;
  paragraphs.forEach((p, i) => {
    if (p.heading === 1) start = i;
  });

  const body = start >= 0 ? paragraphs.slice(start + 1) : paragraphs.filter((p) => !splitLabelled(p.text));

  // Les adresses tapées en texte brut deviennent de vrais liens. Word ne pose un `w:hyperlink`
  // que sur une adresse explicitement liée : une URL simplement écrite dans le texte arrivait
  // donc inerte, sans se distinguer d'une phrase à la relecture. Le rendu public les
  // transformait déjà à l'affichage (`linkifyHtml`) — autant que l'éditeur montre la même chose.
  // `DOMParser` plutôt que le `document` global : ce module est compilé aussi pour le SSR.
  const host = new DOMParser().parseFromString('<body></body>', 'text/html');
  const content = linkifyHtml(toHtml(body), host);

  // Le titre de niveau 1 fait foi s'il n'y avait pas d'étiquette « Titre ».
  if (!values['title'] && start >= 0) values['title'] = paragraphs[start].text;
  if (!values['title'] && core.title) values['title'] = core.title;

  // --- Bilan --------------------------------------------------------------
  const result: ImportedArticle['values'] = {
    title: values['title'] || undefined,
    slug: values['slug'] || undefined,
    excerpt: values['excerpt'] || undefined,
    content: content || undefined,
    tags: values['tags'] ? parseTags(values['tags']) : undefined,
    metaTitle: values['metaTitle'] || undefined,
    metaDescription: values['metaDescription'] || undefined,
  };

  const all: ImportField[] = [
    'title',
    'slug',
    'excerpt',
    'content',
    'tags',
    'metaTitle',
    'metaDescription',
    'coverImageUrl',
  ];

  const isFilled = (field: ImportField): boolean => {
    // La couverture n'est jamais importée : une image de document Word n'a ni le cadrage ni le
    // poids attendus d'une couverture, et le fichier ne dit pas laquelle choisir.
    if (field === 'coverImageUrl') return false;
    const value = result[field as keyof typeof result];
    return Array.isArray(value) ? value.length > 0 : !!value;
  };

  return {
    values: result,
    filled: all.filter(isFilled),
    missing: all.filter((f) => !isFilled(f)),
    hasImages,
  };
}
