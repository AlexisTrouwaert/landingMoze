export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

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
  coverPosition: CoverPosition;
  author: string;
  status: ArticleStatus;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** Épinglé « à la une » : non-null = épinglé (la date sert d'ordre). */
  featuredAt: string | null;
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
  coverPosition?: CoverPosition;
  author?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
}
