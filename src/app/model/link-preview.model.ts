/**
 * Aperçu d'un lien externe cité dans un article, construit côté back à partir des métadonnées
 * Open Graph de la page cible (`GET /link-preview?url=…`).
 *
 * Tous les champs sauf `url` peuvent manquer : le back promet toujours un aperçu, quitte à le
 * réduire au seul domaine quand la cible refuse de répondre aux robots — c'est le cas de X,
 * LinkedIn et TikTok. La carte se rabat alors sur son format compact.
 *
 * Doit rester aligné sur `LinkPreview` du back (landingMoze-back, `link-preview.service.ts`).
 */
export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  /** Absente quand la cible ne publie pas d'image : la carte passe en format compact. */
  imageUrl?: string;
  /** À défaut d'`og:site_name`, le back renvoie le domaine — donc pratiquement toujours présent. */
  siteName?: string;
}
