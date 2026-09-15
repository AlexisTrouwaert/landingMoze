import { DockGroup } from '../components/floating-dock/floating-dock.component';

/**
 * Navigation partagée du dock flottant (accueil, blog, tunnel) — une seule source
 * pour uniformiser toutes les barres de navigation.
 *
 * Les liens sans `route` ni `action` ciblent des sections de l'accueil (ancres) :
 * sur l'accueil → scroll fluide ; ailleurs → le dock redirige vers `/#id`.
 */
/**
 * Connexion à l'application, pour les visiteurs déjà inscrits.
 *
 * Moze Place, et non Moze Connect. Source unique : le bouton « Déjà inscrit ? » de la barre
 * et le rappel de connexion du tunnel (`sector-step`) doivent mener au même endroit.
 */
export const APP_LOGIN_URL = 'https://place.mozeconnect.fr/authentification';

/**
 * Deux déroulants, et non un seul.
 *
 * « Découvrir » avait fini par accumuler onze entrées, mêlant les ancres de l'accueil et les
 * pages du silo. Mesuré sur une fenêtre de 720 px, le panneau atteignait 645 px et se terminait
 * à 719 px — un pixel de marge, avec `overflow-y: visible` : la page `/auto-entrepreneur` à venir
 * l'aurait fait déborder, rendant les dernières entrées inatteignables.
 *
 * La séparation suit une frontière réelle, pas un simple équilibrage de longueurs :
 * - **Découvrir** — les ancres de l'accueil. On y reste sur la même page, on y défile.
 * - **Solutions** — les pages dédiées. On les ouvre, elles ont leur propre URL.
 *
 * « Tarifs » sort des deux et rejoint les liens directs de la barre : c'est l'entrée la plus
 * cherchée d'une navigation, la reléguer dans un déroulant lui coûte des visites.
 */
export const NAV_GROUPS: DockGroup[] = [
  {
    title: 'Découvrir',
    links: [
      { id: 'etapes', label: 'Étapes', icon: 'steps', desc: 'Comment ça marche' },
      { id: 'outils', label: 'Outils', icon: 'tools', desc: 'Tout ce que Moze offre' },
      { id: 'presse', label: 'Presse', icon: 'news', desc: 'On parle de nous' },
      { id: 'avis', label: 'Avis', icon: 'star', desc: 'La parole aux membres' },
      { id: 'app', label: "L'app", icon: 'app', desc: 'iOS & Android' },
      { id: 'support', label: 'Support', icon: 'support', desc: "Une question ? On t'aide", action: 'support' },
    ],
  },
  {
    /**
     * Les pages du silo. Chacune porte un `route` — le dock y navigue au lieu de défiler, et
     * l'ancre du lien compte pour la page qu'elle vise. Leur présence ici leur vaut un lien
     * depuis toutes les pages du site : c'est ce maillage qui fait remonter une page neuve.
     */
    title: 'Solutions',
    links: [
      // Une icône par thème, et non le pictogramme générique repris cinq fois : dans un
      // déroulant, c'est l'icône qu'on balaie avant de lire les libellés.
      { id: 'facturation-collaborative', label: 'Facturation collaborative', icon: 'collaboratif', desc: 'Facturer à plusieurs', route: '/facturation-collaborative' },
      { id: 'facture-electronique', label: 'Facture électronique', icon: 'facture', desc: 'Réforme 2026-2027', route: '/facturation-electronique' },
      { id: 'services-a-la-personne', label: 'Services à la personne', icon: 'domicile', desc: 'Crédit d\'impôt de 50 %', route: '/services-a-la-personne' },
      { id: 'freelance', label: 'Freelance', icon: 'freelance', desc: 'Gérer son activité', route: '/freelance' },
      { id: 'auto-entrepreneur', label: 'Auto-entrepreneur', icon: 'taux', desc: 'Plafonds, TVA, cotisations', route: '/auto-entrepreneur' },
    ],
  },
  {
    links: [
      // Ancien lien « Offres », devenu une route vers la page dédiée, plus riche que la section
      // de l'accueil. La section garde son `id="offres"` : les liens `/#offres` déjà diffusés
      // continuent de fonctionner.
      { id: 'offres', label: 'Tarifs', route: '/tarifs' },
      { id: 'blog', label: 'Blog', route: '/blog' },
      { id: 'evenements', label: 'Évènements', route: '/evenements' },
      { id: 'faq', label: 'FAQ' },
      { id: 'app', label: "L'app" },
    ],
  },
];
