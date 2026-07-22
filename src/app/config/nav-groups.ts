import { DockGroup } from '../components/floating-dock/floating-dock.component';

/**
 * Navigation partagée du dock flottant (accueil, blog, tunnel) — une seule source
 * pour uniformiser toutes les barres de navigation.
 *
 * Les liens sans `route` ni `action` ciblent des sections de l'accueil (ancres) :
 * sur l'accueil → scroll fluide ; ailleurs → le dock redirige vers `/#id`.
 */
export const NAV_GROUPS: DockGroup[] = [
  {
    title: 'Découvrir',
    links: [
      { id: 'etapes', label: 'Étapes', icon: 'steps', desc: 'Comment ça marche' },
      { id: 'outils', label: 'Outils', icon: 'tools', desc: 'Tout ce que Moze offre' },
      { id: 'offres', label: 'Offres', icon: 'offres', desc: 'Nos formules' },
      { id: 'presse', label: 'Presse', icon: 'news', desc: 'On parle de nous' },
      { id: 'avis', label: 'Avis', icon: 'star', desc: 'La parole aux membres' },
      { id: 'app', label: "L'app", icon: 'app', desc: 'iOS & Android' },
      { id: 'support', label: 'Support', icon: 'support', desc: "Une question ? On t'aide", action: 'support' },
    ],
  },
  {
    links: [
      { id: 'blog', label: 'Blog', route: '/blog' },
      { id: 'faq', label: 'FAQ' },
      { id: 'app', label: "L'app" },
    ],
  },
];
