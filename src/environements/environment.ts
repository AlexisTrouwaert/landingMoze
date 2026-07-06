/**
 * Environnement DÉVELOPPEMENT (par défaut sur ng serve).
 * Au build prod, ce fichier est remplacé par environment.prod.ts
 * via la config `fileReplacements` dans angular.json.
 */
export const environment = {
  production: false,
  apiUrl: 'https://app.mozeconnect.fr',
  /** Pixel Meta dédié aux tests locaux — compte perso, ne pollue pas la prod. */
  metaPixelId: '949083607920305',
  /** Clé Marketing Automation Brevo (tracker on-site). Vide = tracker désactivé. À renseigner. */
  brevoKey: '',
  /** ID de mesure Google Analytics 4 (G-XXXXXXXXXX). Vide = GA désactivé. Propriété de test perso. */
  gaMeasurementId: 'G-N344GPCKE8'
};
