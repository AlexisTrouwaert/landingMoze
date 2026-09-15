/**
 * Ce que chaque réseau demande, et où l'on va le lui donner.
 *
 * **Pourquoi copier-coller et non préremplir.** Aucun des trois réseaux externes n'accepte
 * qu'un lien prérempli le texte d'un post : LinkedIn a retiré les paramètres correspondants,
 * Facebook l'interdit par politique depuis 2017, Instagram n'expose aucun lien de partage web.
 * Le presse-papiers n'est donc pas un pis-aller — c'est la seule voie que les plateformes
 * laissent ouverte. On copie, on ouvre le composeur, l'humain colle.
 *
 * MozePlace est notre produit : rien n'empêche d'y ajouter un jour un `/feed?texte=…` qui
 * préremplirait le post. D'ici là, même geste que pour les autres.
 */

export interface SocialNetwork {
  /** Emplacement d'annexe correspondant (cf. `ANNEX_BLOCKS`). */
  slot: string;
  label: string;
  /**
   * Longueur au-delà de laquelle le réseau tronque ou refuse. Nulle quand elle n'est pas
   * contraignante — mieux vaut ne rien annoncer qu'un chiffre inventé.
   */
  limit: number | null;
  /**
   * Page où l'on va coller. **À vérifier une fois depuis votre navigateur** et à remplacer
   * par l'adresse de votre page : celles-ci sont des points d'entrée génériques, et les
   * plateformes les font dériver.
   *
   * Vide ⇒ pas de bouton d'ouverture, seulement la copie. Un bouton qui ouvre la mauvaise
   * page vaut moins que pas de bouton.
   */
  composerUrl: string | null;
  /** Ce qu'il faut préparer en plus du texte, dit à l'écran. */
  besoin: string | null;
  /**
   * Ajouter l'adresse de l'article au post. Faux seulement là où un lien ne sert à rien :
   * Instagram l'afficherait en texte brut, non cliquable, au milieu de la légende.
   */
  lien: boolean;
}

export const SOCIAL_NETWORKS: readonly SocialNetwork[] = [
  {
    // L'emplacement garde son ancien identifiant : c'est la clé des annexes déjà enregistrées
    // en base. Le renommer les rendrait orphelines ; seul le libellé suit le nom du produit.
    slot: 'moze-connect',
    label: 'MozePlace',
    limit: null,
    composerUrl: 'https://place.mozeconnect.fr/feed',
    besoin: null,
    lien: true,
  },
  {
    slot: 'linkedin',
    label: 'LinkedIn',
    limit: 3000,
    // Ouvre directement la fenêtre de rédaction, sans passer par le fil.
    composerUrl: 'https://www.linkedin.com/sharing/compose',
    besoin: "L'aperçu du lien vient des balises Open Graph de l'article.",
    lien: true,
  },
  {
    slot: 'instagram',
    label: 'Instagram',
    limit: 2200,
    composerUrl: 'https://www.instagram.com/',
    besoin:
      "Une image est obligatoire, au format carré ou portrait. Aucun lien cliquable dans la légende : l'adresse de l'article n'y est donc pas ajoutée.",
    lien: false,
  },
  {
    slot: 'facebook',
    label: 'Facebook',
    limit: 63206,
    composerUrl: 'https://business.facebook.com/latest/composer',
    besoin: "L'aperçu du lien vient des balises Open Graph de l'article.",
    lien: true,
  },
];

/**
 * Repère à écrire dans un post pour y placer l'adresse de l'article ailleurs qu'à la fin.
 * Entre accolades : aucune chance d'apparaître par hasard dans un texte rédigé.
 */
export const LIEN_ARTICLE = '{lien}';

/**
 * Le texte tel qu'on le collera : le post rédigé, et l'adresse de l'article.
 *
 * - Le repère `{lien}` fixe l'emplacement quand la rédaction l'a prévu ;
 * - sinon l'adresse va à la fin, sur sa propre ligne — là où les réseaux en tirent l'aperçu ;
 * - un post qui contient déjà l'adresse exacte n'en reçoit pas une seconde ;
 * - pour un réseau sans lien (Instagram), le repère est retiré plutôt que laissé en clair.
 *
 * Calculé à l'affichage et non enregistré : l'adresse suit le slug, qui peut changer après la
 * rédaction, et le domaine, qui diffère entre développement et production.
 */
export function composerPost(
  corps: string,
  url: string | null,
  network: SocialNetwork,
): string {
  const lien = network.lien ? url : null;

  if (corps.includes(LIEN_ARTICLE)) {
    return corps
      .split(LIEN_ARTICLE)
      .join(lien ?? '')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (!lien || corps.includes(lien)) return corps;
  return `${corps.trimEnd()}\n\n${lien}`;
}

/** Les emplacements qui sont des posts, dans l'ordre où l'on publie. */
export const POST_SLOTS: readonly string[] = SOCIAL_NETWORKS.map((n) => n.slot);

export function networkFor(slot: string): SocialNetwork | undefined {
  return SOCIAL_NETWORKS.find((n) => n.slot === slot);
}
