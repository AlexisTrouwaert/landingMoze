# Note pour l'ops — deux problématiques SEO côté serveur (moze.fr)

*25 août 2026 — constats vérifiés sur la production. Cette note décrit les problèmes et le
résultat attendu ; le choix de la mise en œuvre (Apache, autre) te revient.*

---

## 1. Le site existe en double : `moze.fr` et `www.moze.fr`

**Constat.** Les deux hôtes servent l'intégralité du site en HTTP 200, sans renvoi de l'un vers
l'autre. Vérifié sur la page d'accueil, `/commencer` et les articles de blog. Seul le
HTTP → HTTPS est redirigé, mais **en restant sur le même hôte** : un visiteur qui entre par
`moze.fr` y navigue de bout en bout.

**Pourquoi c'est un problème.** Pour un moteur de recherche, deux hôtes qui servent le même
contenu sont deux sites concurrents : les liens entrants, l'historique et le budget d'exploration
se répartissent entre les deux au lieu de s'additionner. La balise canonique (déjà en place,
pointant `www`) limite la casse mais reste une indication que Google peut ignorer — pas une
instruction. La Search Console remonte déjà ~10 pages « en double » à cause de cette situation.

**Résultat attendu.**

- Une seule adresse répond : **`www.moze.fr`** (tout le site — canoniques, sitemap, données
  structurées — la déclare déjà comme référence ; basculer vers l'apex obligerait à tout
  réécrire et contredirait ce que Google a enregistré).
- Toute autre variante (`http://moze.fr`, `https://moze.fr`, `http://www.moze.fr`) renvoie vers
  son équivalent `https://www.moze.fr/...` **définitivement (301) et en un seul saut** — pas de
  cascade `http://moze.fr/x` → `https://moze.fr/x` → `https://www.moze.fr/x`.
- Le chemin et les paramètres de requête (`?utm_...`) sont conservés à travers le renvoi.

**Critère de recette.** Pour chacune des quatre variantes d'une même adresse, la réponse est soit
la 301 attendue, soit le 200 final ; et le nombre total de réponses HTTP entre l'adresse de départ
et la page finale ne dépasse jamais deux (un renvoi + une arrivée).

---

## 2. Les adresses de l'ancien site (Wix) sont mortes

**Constat.** Environ 25 pages encore présentes dans l'index de Google renvoient « introuvable ».
Quatre familles, correspondant chacune à une section de l'ancien site :

| Famille | Exemple | Contenu d'origine |
|---|---|---|
| `/service-a-la-personne/{ville}` | `/service-a-la-personne/sablet`, `/l'isle-sur-la-sorgue` | Pages locales ménage / jardinage |
| `/mozeurs` et `/mozeurs/{prenom-nom}` | `/mozeurs/stephane-manyri` | Annuaire et fiches d'intervenants |
| `/post/{slug}` | `/post/comment-enlever-la-rouille-de-ses-outils` | Ancien blog |
| `/moze-place` | `/moze-place` | Page produit historique |

**Pourquoi c'est un problème.** Chaque visiteur ou robot qui suit un vieux lien (moteur, réseau
social, newsletter, site partenaire) tombe dans le vide, et la notoriété accumulée par ces pages
au fil des années se perd au lieu d'être transférée vers les pages actuelles.

**Résultat attendu.**

- Un mécanisme, au niveau serveur, capable de renvoyer chaque ancienne adresse vers une page de
  destination choisie, en **301 et en un seul saut** (en cohérence avec le point 1 : jamais
  « ancienne adresse → www → destination » en deux temps).
- La liste précise `ancienne adresse → destination` sera fournie à part : elle dépend d'un export
  Search Console en cours et d'un arbitrage métier sur les pages villes.
- Cas particuliers à couvrir :
  - les adresses avec apostrophe circulent tantôt en clair (`l'isle-sur-la-sorgue`), tantôt
    encodées (`l%27isle-sur-la-sorgue`) — les deux formes doivent trouver leur destination ;
  - les paramètres de campagne (`?utm_source=...`) sont conservés à travers le renvoi ;
  - une adresse réellement inconnue doit **rester une vraie « introuvable » (404)** — jamais
    renvoyée en masse vers l'accueil, ce que Google requalifie en erreur déguisée.

**Critère de recette.** Chaque adresse de la liste fournie répond 301 vers sa destination exacte ;
une adresse inventée répond 404.

---

## 3. Pour information (pas d'action demandée, mais à savoir)

- L'application Node émet déjà l'en-tête **HSTS** (`Strict-Transport-Security: max-age=31536000`,
  sans `includeSubDomains`) sur ses réponses — à prendre en compte si un en-tête équivalent existe
  ou serait ajouté côté serveur web, pour éviter un doublon ou une contradiction.
- Une route **`/rss.xml`** (flux RSS du blog) est prête côté application Node ; elle sera branchée
  lors de la prochaine intervention sur `server.ts`, à coordonner avec vous si un déploiement est
  prévu.
- L'ordre des deux chantiers compte : le point 1 doit être en place **avant** le point 2, sans quoi
  chaque ancienne adresse subirait deux renvois en cascade.
