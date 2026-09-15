import { Routes } from '@angular/router';

/**
 * Page thématique « facturation électronique ».
 *
 * Première d'une série de pages dédiées : l'accueil ne peut se positionner que sur une
 * intention de recherche, et il porte déjà celle de la marque. Les sujets qui ont leur propre
 * demande — la réforme, les tarifs, la facturation collaborative — méritent chacun leur URL,
 * faute de quoi ils restent des sections qu'aucun moteur ne classe séparément.
 *
 * Pas d'année dans le chemin : l'obligation court sur 2026 **et** 2027 selon la taille de
 * l'entreprise, et une URL datée impose une redirection annuelle qui repart de zéro en autorité
 * accumulée. L'année vit dans le `title` et le `<h1>`, qu'on met à jour sans changer d'adresse.
 */
export const FACTURATION_ELECTRONIQUE_ROUTES: Routes = [
  {
    path: '',
    title: 'Facturation électronique 2026-2027 : guide indépendants – Moze',
    loadComponent: () =>
      import('../pages/facturation-electronique/facturation-electronique.component').then(
        (m) => m.FacturationElectroniqueComponent,
      ),
  },
];
