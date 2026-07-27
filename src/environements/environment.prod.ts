export const environment = {
  production: true,
  /**
   * Origine publique du site, sans barre oblique finale.
   * Sert à construire les URL absolues d'`og:url` et de `<link rel="canonical">` :
   * les crawlers sociaux n'exécutent pas de JS et ne résolvent pas les chemins
   * relatifs, et le rendu serveur n'a pas de `window.location` pour les déduire.
   */
  siteUrl: 'https://www.moze.fr',
  apiUrl: 'https://app.mozeconnect.fr',
  // apiUrl: 'https://nico.by-moze.fr'
  /** Back dédié au blog. Domaine public confirmé par l'ops. */
  blogApiUrl: 'https://blog-api.moze.fr',
  /** Pixel Meta de production — compte du patron (Pixel Moze Connect). */
  metaPixelId: '2004229900969485',
  /** Clé Marketing Automation Brevo (tracker on-site). */
  brevoKey: 'ghrjzu3w1m702ttnl2trie95',
  /** ID de mesure Google Analytics 4 (propriété prod Moze). Vide = GA désactivé. */
  gaMeasurementId: 'G-39M2T9JEQP'
};
