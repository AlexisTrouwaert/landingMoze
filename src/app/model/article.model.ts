export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** Auteur de la rédaction : l'admin dans l'éditeur, ou Claude via le serveur MCP. */
export type ArticleOrigin = 'HUMAN' | 'ASSISTANT';

/** Ce qu'un signalement de relecture peut viser. `content` désigne un passage du corps. */
export type FlagField =
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'metaTitle'
  | 'metaDescription'
  | 'content';

/**
 * Un endroit de l'article que le relecteur veut voir retouché.
 *
 * `quote` porte le texte visé pour un passage — c'est l'ancrage, et il est volontairement
 * textuel : des positions ne survivraient pas à une réécriture. `orphaned` est recalculé par
 * le serveur à chaque lecture ; il dit que le texte cité n'existe plus.
 */
export interface ArticleFlag {
  id: string;
  articleId: string;
  field: FlagField;
  quote: string | null;
  note: string | null;
  resolvedAt: string | null;
  createdAt: string;
  orphaned: boolean;
}

/** Position de l'image de couverture par rapport au texte (le texte va à l'opposé). */
export type CoverPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  /** Nombre d'articles publiés portant ce tag (renseigné par le filtre public). */
  count?: number;
}

/** Article complet (page article + édition admin). */
export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  /**
   * Texte alternatif de la couverture — décrit l'**image**, pas l'article.
   *
   * Public : lu par les lecteurs d'écran et repris en `og:image:alt` au partage. Le titre y
   * était posé jusqu'ici, ce qui faisait annoncer deux fois la même phrase sans rien
   * apprendre de la photo.
   */
  coverImageAlt: string | null;
  coverPosition: CoverPosition;
  /** Série éditoriale — « Les cas qu'on croit compliqués », épisode 2. */
  series: string | null;
  author: string;
  status: ArticleStatus;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /**
   * Ce qui accompagne l'article sans en faire partie : posts réseaux, idée d'image, notes
   * SEO. **Réservé à l'admin** — la réponse publique ne les embarque pas.
   *
   * Réduites ici à leur état : c'est `ArticleDetail` qui porte les textes.
   */
  annexes?: ArticleAnnexState[];
  /** Épinglé « à la une » : non-null = épinglé (la date sert d'ordre). */
  featuredAt: string | null;
  /**
   * Échange « à la une » en attente : l'article que celui-ci remplacera à sa parution.
   * Renseigné quand on programme un article à la une alors que les 5 emplacements sont pris —
   * l'ancien reste affiché jusqu'à l'échéance. Réservé aux réponses admin.
   */
  featureReplacesId?: string | null;
  /**
   * Qui a rédigé l'article. Réservé aux réponses admin. Fixé à la création et jamais modifié :
   * retoucher un article de l'assistant n'en fait pas un article humain.
   */
  origin?: ArticleOrigin;
  /**
   * Date de parution **proposée** par l'assistant, en attente de validation humaine.
   * À ne pas confondre avec `publishedAt`, qui programme réellement : celle-ci ne met rien
   * en ligne. C'est le pupitre de relecture qui la transforme en publication.
   */
  proposedPublishAt?: string | null;
  /** « À la une » **proposé** par l'assistant. N'épingle rien tant qu'un humain n'a pas validé. */
  proposedFeatured?: boolean;
  /**
   * Temps de lecture estimé, en minutes. Calculé par le back à partir du
   * contenu : la liste publique ne transporte pas `content`, le front ne peut
   * donc pas le déduire lui-même.
   */
  readingMinutes?: number;
  /**
   * Nombre de consultations publiques. Statistique réservée à l'admin :
   * seules les réponses de l'API admin la transportent — absente (donc
   * `undefined`) sur tout ce qui vient des endpoints publics.
   */
  views?: number;
  tags: Tag[];
}

/** Nombre maximum d'articles épinglés (doit rester aligné avec le back). */
export const MAX_FEATURED = 5;

/** Carte d'article dans la liste publique (sans le `content`). */
export type ArticleListItem = Pick<
  Article,
  | 'id'
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'coverImageUrl'
  | 'author'
  | 'publishedAt'
  | 'readingMinutes'
  | 'tags'
>;

/**
 * Ce qu'il faut pour illustrer un lien interne cité dans un article (`GET /blog/cards`).
 * Volontairement minimal : ni contenu, ni tags, ni dates — une carte n'en a pas l'usage.
 */
export type ArticleCard = Pick<
  Article,
  'slug' | 'title' | 'excerpt' | 'coverImageUrl'
>;

/** Réponse paginée de `GET /blog`. */
export interface ArticlePage {
  items: ArticleListItem[];
  total: number;
  page: number;
  size: number;
}

/**
 * Un article de la une, vu de l'admin (`GET /admin/blog/featured`).
 *
 * `replacedBy` non-null = un article programmé prendra sa place le jour de sa parution.
 * L'endpoint public ne le dit pas : l'admin, lui, doit voir qu'un des cinq est sur le départ
 * plutôt que de le découvrir disparu.
 */
/** Un occupant à venir d'un emplacement de la une. */
export interface FeaturedSuccessor {
  id: string;
  title: string;
  publishedAt: string | null;
}

export interface AdminFeaturedItem extends Article {
  replacedBy: FeaturedSuccessor | null;
  /**
   * Les occupants à venir de cet emplacement, du plus proche au plus lointain.
   *
   * Les échanges s'enchaînent d'une semaine sur l'autre : sans la file complète, on ne peut
   * pas dire qui occupera la place à une date future — et c'est exactement ce qu'il faut
   * savoir pour programmer un article qui en remplacera un autre.
   */
  succession: FeaturedSuccessor[];
}

/** Compteurs du tableau de bord admin (`GET /admin/blog/stats`). */
export interface AdminStats {
  draft: number;
  published: number;
  archived: number;
  featured: number;
  maxFeatured: number;
  total: number;
}

/**
 * Actions applicables à une sélection d'articles en un seul appel.
 * L'épinglage n'y figure pas : limité à 5 et ordonné par `featuredAt`, il reste
 * une action unitaire.
 */
export type BulkAction =
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'unarchive'
  | 'delete';

/** Résultat de `POST /admin/blog/bulk`. */
export interface BulkResult {
  action: BulkAction;
  requested: number;
  affected: number;
  /** Articles disparus entre l'affichage de la liste et l'action. */
  missing: number;
}

/** Payload de création / édition d'un article (admin). */
export interface ArticleInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  coverPosition?: CoverPosition;
  series?: string | null;
  author?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
  /**
   * Annexes livrées avec l'article. Acceptées **à la création seulement** : elles se
   * remplacent ensuite par `PUT /admin/blog/:id/annexes`, pour qu'il n'existe qu'un chemin
   * vers chaque écriture.
   */
  annexes?: ArticleAnnexInput[];
}

/** Une annexe telle qu'elle voyage vers le back. */
export interface ArticleAnnexInput {
  slot: string;
  label: string;
  body: string;
}

/**
 * Ce que les **listes** transportent d'une annexe : de quoi compter, pas de quoi lire.
 *
 * Deux colonnes suffisent à dire « trois posts sur quatre restent à diffuser », et c'est ce
 * repère qui fait qu'on y pense. Les corps, eux, pèsent plusieurs milliers de caractères
 * qu'une liste n'affiche jamais.
 */
export interface ArticleAnnexState {
  slot: string;
  /**
   * Quand ce texte a été posté sur son réseau. Nul = reste à faire.
   *
   * Posé à la main : aucune API ne nous le confirme. La date dit « je l'ai fait », pas
   * « c'est en ligne » — et c'est la seule chose honnête qu'on puisse enregistrer.
   */
  diffusedAt: string | null;
  /**
   * Quand l'administration a décidé de **ne pas** poster ce texte. Nul = pas de décision.
   *
   * Exclusif de `diffusedAt`. Un post écarté ne compte plus parmi ce qui reste à faire.
   */
  skippedAt: string | null;
}

/** L'état qu'on pose sur un post depuis le kit de diffusion. */
export type DiffusionState = 'pending' | 'diffused' | 'skipped';

/** Une annexe complète, telle que l'ouverture d'un article la renvoie. */
export interface ArticleAnnex extends ArticleAnnexState, ArticleAnnexInput {
  id: string;
}

/**
 * Un article ouvert : ses annexes portent alors leur texte.
 *
 * Distingué d'`Article` parce que la différence est réelle et qu'un seul type la ferait
 * mentir dans un sens ou dans l'autre — soit les listes prétendraient porter les corps, soit
 * l'écran de diffusion ne pourrait plus les lire.
 */
export interface ArticleDetail extends Omit<Article, 'annexes'> {
  annexes?: ArticleAnnex[];
}
