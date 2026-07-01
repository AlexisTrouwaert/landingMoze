export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

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
  author: string;
  status: ArticleStatus;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  tags: Tag[];
}

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
  | 'tags'
>;

/** Réponse paginée de `GET /blog`. */
export interface ArticlePage {
  items: ArticleListItem[];
  total: number;
  page: number;
  size: number;
}

/** Payload de création / édition d'un article (admin). */
export interface ArticleInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImageUrl?: string | null;
  author?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
}
