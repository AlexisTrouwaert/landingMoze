export const environment = {
  production: true,
  apiUrl: 'https://app.mozeconnect.fr',
  // apiUrl: 'https://nico.by-moze.fr'
  /** Back dédié au blog (POC). ⚠️ TODO : URL publique du back blog en prod. */
  blogApiUrl: 'https://blog-api.mozeconnect.fr',
  /** Pixel Meta de production — compte du patron (Pixel Moze Connect). */
  metaPixelId: '2004229900969485',
  /** Clé Marketing Automation Brevo (tracker on-site). */
  brevoKey: 'ghrjzu3w1m702ttnl2trie95',
  /** ID de mesure Google Analytics 4 (G-XXXXXXXXXX). ⚠️ TODO : coller l'ID prod. Vide = GA désactivé. */
  gaMeasurementId: ''
};
