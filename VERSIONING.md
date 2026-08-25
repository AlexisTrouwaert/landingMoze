# Règles de versionnage — landing Moze (front) & landingMoze-back

Les deux dépôts suivent le **versionnage sémantique** (SemVer) : `MAJEUR.MINEUR.CORRECTIF`,
par exemple `1.4.2`. Le numéro vit dans le champ `version` du `package.json` de chaque dépôt —
c'est la source de vérité.

## Point de départ (bootstrap, 25/08/2026)

- **1.0.0** désigne rétroactivement l'état en production à cette date. Aucun tag n'a été posé
  (le commit exact déployé n'est pas identifiable a posteriori) ; c'est une base de référence.
- **1.1.0** est la version en préparation dans les deux dépôts (compteur de vues, données
  structurées, redirections d'anciens slugs, flux RSS…). Le premier tag git sera posé à son
  déploiement.

## Quel chiffre incrémenter ?

| On incrémente | Quand | Exemples concrets sur ce projet |
|---|---|---|
| **MAJEUR** (`2.0.0`) | Rupture : ce qui existait cesse de fonctionner sans intervention — contrat d'API front↔back cassé, migration de données irréversible, refonte qui change les URL publiques | Renommage d'un endpoint `/blog` consommé par le front ; passage SQLite → PostgreSQL avec migration manuelle ; refonte des routes publiques |
| **MINEUR** (`1.2.0`) | Nouvelle fonctionnalité, rétro-compatible | Compteur de vues ; sélecteur de liens internes ; flux RSS ; nouvelle page |
| **CORRECTIF** (`1.1.1`) | Correction de bug ou ajustement sans nouvelle fonctionnalité | Fix d'alignement de colonnes ; slug tronqué en plein mot ; balise meta corrigée |

Règles de départage, dans l'ordre :

1. **En cas de doute entre MINEUR et CORRECTIF** : si la release ajoute quelque chose que
   l'utilisateur (ou l'admin) peut *faire* ou *voir* de nouveau, c'est MINEUR. Si elle répare ou
   ajuste l'existant, c'est CORRECTIF.
2. **Le SEO/contenu technique suit la même grille** : ajouter le JSON-LD = MINEUR (nouvelle
   capacité) ; corriger un JSON-LD invalide = CORRECTIF.
3. **Une release qui mélange fixes et fonctionnalités** prend le plus haut niveau concerné
   (fonctionnalités + fixes = MINEUR).
4. Incrémenter un chiffre **remet à zéro** ceux de droite : `1.4.2` + rupture → `2.0.0`.

## Front et back : deux numéros indépendants, un contrat commun

- Chaque dépôt a **son propre numéro** et avance à son rythme : un fix purement front
  n'incrémente pas le back, et inversement.
- **Exception — le contrat d'API** : quand un changement du back impose un changement du front
  (nouveau champ obligatoire, endpoint renommé, format de réponse modifié), les deux releases
  sont **liées et déployées ensemble**, chacune avec son incrément (MINEUR si l'ancien front
  continue de fonctionner pendant la transition, MAJEUR sinon). Le lien est noté dans le message
  de release (« requiert back ≥ 1.2.0 »).
- L'ordre de déploiement d'une release liée : **back d'abord, front ensuite** (le back tolère un
  front en retard via ses champs optionnels ; l'inverse n'est pas garanti).

## Le geste de release (automatisé)

Le niveau d'incrément est **déduit des commits** depuis le dernier tag par
`scripts/release.mjs`. Trois commandes, identiques dans les deux dépôts :

```bash
npm run release:dry
```

Analyse seule : liste les commits classés par niveau, annonce le numéro qui serait posé, ne
modifie rien. À lancer avant toute release pour vérifier le verdict.

```bash
npm run release
```

Même analyse, puis demande confirmation et applique : `package.json` + `package-lock.json`,
commit et tag `vX.Y.Z`. Refuse de tourner si l'arbre de travail n'est pas propre — un tag doit
désigner exactement ce qui part en production.

```bash
npm run release:prod-win
```

Release **puis** construction de l'artefact, en une commande. L'archive porte automatiquement le
numéro qui vient d'être posé, dans `build/prod/` et sous un nom identique de part et d'autre :

| Dépôt | Nom produit |
|---|---|
| Front | `FRONT-landing-PROD-v1.2.0-<horodatage>.tar.gz` |
| Back | `BACK-landing-PROD-v1.2.0-<horodatage>.tar.gz` |

L'horodatage (`AAAAMMJJhhmmss`) distingue deux constructions d'une même version : reconstruire
n'écrase jamais l'archive précédente.

## Vérifier quelle version tourne réellement

Le numéro ne vit pas que dans le nom du fichier : il est **embarqué dans le build** et
interrogeable une fois déployé. C'est ce qui permet de confirmer, depuis l'extérieur, que
l'artefact attendu est bien en ligne.

| Dépôt | Où lire la version | Source du numéro |
|---|---|---|
| Back | `GET /health` → `{ "version": "1.1.0", ... }` | Le `package.json` livré dans l'archive, lu au démarrage |
| Back | Log PM2 au démarrage : `landingMoze-back v1.1.0 démarré sur ...` | idem |
| Front | `GET /version.json` → `{ "version": "1.1.0", "builtAt": "..." }` | `package.json` au moment du build, figé dans l'artefact |

```bash
curl -s https://blog-api.moze.fr/health
curl -s https://www.moze.fr/version.json
```

Les trois numéros (nom de l'archive, réponse HTTP, tag git) proviennent tous du même
`package.json` : ils ne peuvent pas diverger.

Deux détails d'implémentation :

- **Back** — la version est lue dans le `package.json` que l'archive contient, pas inscrite en
  dur. `process.env.npm_package_version` ne conviendrait pas : il n'est renseigné que sous un
  script npm, alors qu'en production PM2 lance `node dist/main` directement.
- **Front** — l'archive ne contient que la sortie d'`ng build`, où Angular ne copie aucun
  `package.json`. Le hook `postbuild:prod` écrit donc `version.json` dans la sortie navigateur ;
  il est servi tel quel par l'`express.static` du SSR, sans code serveur supplémentaire.

Après vérification, la publication reste un geste manuel : `git push && git push --tags`.

### Pourquoi l'incrément n'est PAS fait par `archive:prod-win` seul

Construire un artefact est une opération **répétable** : on peut builder trois fois pour tester.
Si le build incrémentait la version, on obtiendrait trois numéros et trois tags pour une seule
livraison, dont deux ne correspondraient à rien de déployé. L'incrément est donc porté par
`release`, qui est un acte délibéré et confirmé ; `archive:prod-win` reste sans effet de bord et
se contente d'empaqueter la version courante.

### Options

| Option | Effet |
|---|---|
| `npm run release -- --level=minor` | Force le niveau, court-circuite l'analyse (`patch`, `minor`, `major`) |
| `npm run release -- --yes` | N'attend pas la confirmation (scripts, CI) |
| `npm run release:dry` | Aperçu seul |

### Comment les commits sont classés

| Niveau | Reconnu à | Exemples |
|---|---|---|
| MAJEUR | `BREAKING CHANGE` dans le corps du message, préfixe `feat!:`, ou marqueur `[major]` | `feat!: nouvelle API blog` |
| MINEUR | Préfixe `feat:`, marqueur `[minor]`, ou les mots *ajout, nouveau, nouvelle, mise en place, implémentation* | `ajout scripts sync multi-remotes` |
| CORRECTIF | Préfixe `fix:`, marqueur `[patch]`, ou les mots *fix, correction, corrige, bug, hotfix* | `fix blog GA4` |
| SANS EFFET | Message **commençant par** `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `lint`, `format` | `Lint : passe eslint --fix` |

Deux partis pris à connaître :

- **Le MAJEUR n'est jamais deviné** à partir d'un mot français : « refonte » ne casse pas le
  contrat d'API, et un majeur posé à tort laisse un trou définitif dans la numérotation. Il faut
  un marqueur explicite.
- **Un commit non reconnu compte comme CORRECTIF**, et le script l'affiche comme tel
  (« non classé, correctif par défaut »). Sous-évaluer se rattrape à la release suivante ;
  sur-évaluer, non. Si le verdict est faux, `--level=` tranche.

Pour une classification plus fiable, préfixer les commits par `feat:` / `fix:` (les marqueurs
`[minor]` / `[major]` fonctionnent aussi). Ce n'est pas obligatoire : les messages en français
libre restent compris, avec le repli ci-dessus.

### Première release d'un dépôt

Tant qu'aucun tag `vX.Y.Z` n'existe, le script **ne calcule rien** : il pose le numéro déjà
inscrit dans `package.json` (celui préparé à la main lors du bootstrap) sur le commit courant.
C'est ce qui évite de sauter la version en préparation. Les releases suivantes se calculent à
partir du dernier tag.

### Pré-version

Version d'essai avant mise en production si besoin : `npm version 1.2.0-rc.1` à la main, puis
`npm run archive:prod-win`. Le script de release ne gère que les numéros définitifs.

## Ce qui ne change PAS le numéro

Formatage, commentaires, refactoring interne sans effet observable, mise à jour de dépendances
sans changement de comportement, documentation. Ces commits partent avec la release en cours de
préparation, sans incrément dédié.
