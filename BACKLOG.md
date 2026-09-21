# Backlog — admin du blog

Ce qui est décidé mais pas encore commencé. Chaque entrée dit **le besoin**, **l'état actuel du
code** et **ce que ça implique** : de quoi s'y remettre sans refaire l'enquête.

---

## ✅ Relecture : relire aussi les posts réseaux

*Ajouté le 15/09/2026 — **fait le 15/09/2026**.*

### Ce qui a été livré

- **Relecture** : bloc « Posts réseaux » sous le texte, posts dépliés dans l'ordre de diffusion,
  texte rédigé (sans le lien de la Diffusion), compteur de caractères et nombre de retouches par
  post. « Signaler le passage sélectionné » déduit la cible de l'endroit surligné
  (`data-flag-zone`) : corps ou tel post, jamais à cheval sur deux.
- **Back** : `ArticleFlag.annexSlot` (migration `20260915120350_article_flag_annex`),
  `field: 'annex'` ; la citation se cherche dans le texte du post visé, et un post retiré rend le
  signalement orphelin. Nouvelle route `PUT /admin/blog/:id/annexes/:slot` (un seul post), ouverte
  à l'assistant sur brouillon uniquement ; un texte réécrit perd sa marque « Diffusé », pas
  « Écarté ». Créer un signalement reste réservé à l'administrateur.
- **Assistant (MCP)** : `lire_article` renvoie les posts, `lister_retouches` dit quel post est
  visé, nouvel outil `modifier_post` ; `mcp/CLAUDE.md` décrit la marche à suivre des retouches.
- **Décisions** : posts dépliés ; réécrire efface « Diffusé ».
- **Éditeur (ajouté ensuite, le même jour)** : carte « Retouches pour l'assistant » sous le
  texte — passage sélectionné dans l'éditeur, ou champ entier (titre, extrait, adresse, balises
  moteurs), liste des retouches ouvertes avec modification et retrait. Composant partagé
  `app-article-flags`, **utilisé aussi par la relecture** (ses boutons à côté du titre et sous
  chaque post l'appellent ; saisie et liste sont les mêmes dans les deux écrans). Désactivé hors
  brouillon et tant que des modifications ne sont pas enregistrées (la citation se cherche dans
  la version enregistrée).

*Ce qui suit est l'analyse d'origine, conservée pour mémoire.*

### Le besoin

Dans « Relecture », afficher les posts rédigés pour les réseaux (MozePlace, LinkedIn, Instagram,
Facebook) à côté de l'article, **en gardant « Signaler le passage sélectionné »** : on doit pouvoir
surligner une phrase d'un post et la signaler, comme on le fait déjà dans le corps de l'article.

Aujourd'hui, les posts ne se relisent qu'une fois l'article publié, sur l'écran Diffusion. Une
erreur repérée à ce moment-là se corrige à la main, sans passer par l'assistant.

### Ce qui existe déjà

- **Les posts** sont des annexes (`ArticleAnnex`, emplacements `moze-connect`, `linkedin`,
  `instagram`, `facebook`). La relecture charge déjà leur texte à la sélection d'un article
  (`loadNotes` → `adminGet`, cf. `admin-blog-review.component.ts`), pour les notes de rédaction.
  Il suffit de ne plus les filtrer.
- **Le signalement** vise un champ de l'article (`FLAG_FIELDS` : `title`, `slug`, `excerpt`,
  `metaTitle`, `metaDescription`, `content`). Pour `content`, la citation (`quote`) est recherchée
  dans le corps à chaque lecture ; absente, le signalement devient « orphelin »
  (`admin-flags.service.ts`, `stillPresent`).
- **La sélection** est bornée à l'aperçu du corps (`previewBox` dans le pupitre).

### Ce que ça implique

**Front — relecture**
- Afficher chaque post dans un bloc à part, texte brut sélectionnable, dans l'ordre de diffusion.
- Généraliser `flagSelection()` : savoir **dans quel bloc** la sélection a été faite (corps ou
  tel post), au lieu de la borner au seul `previewBox`.
- Montrer le texte **rédigé**, sans l'adresse de l'article que la Diffusion ajoute à la copie
  (`composerPost`) : une citation prise dans la version avec lien ne se retrouverait pas en base.

**Back — signalements**
- Permettre de viser une annexe : par exemple `field: 'annex'` + une colonne `annexSlot`
  (migration), plutôt qu'un `field` libre du type `annex:linkedin` qu'on ne pourrait pas valider.
- `stillPresent` doit chercher la citation dans le corps **de l'annexe visée**, pas dans
  `article.content` — sinon tout signalement sur un post serait aussitôt orphelin.
- Si l'annexe est supprimée par une réimportation, le signalement doit rester visible et être dit
  orphelin, comme pour un passage disparu.

**Assistant (serveur MCP) — le vrai morceau**
- L'assistant ne sait **rien** des posts aujourd'hui : aucun outil ne lit ni n'écrit d'annexe
  (`lire_article`, `modifier_article`, `lister_retouches` n'en parlent pas). Un post signalé
  resterait donc sans suite.
- Il faudra lui permettre de lire les posts et d'en réécrire un. Côté back, la route
  `PUT /admin/blog/:id/annexes` est aujourd'hui **réservée à l'ADMIN** : l'ouvrir au rôle
  `ASSISTANT` (brouillons seulement, comme les autres routes) ou créer une route plus étroite qui
  ne remplace qu'**un** post.
- Mettre à jour `mcp/CLAUDE.md` (marche à suivre des retouches) et `lister_retouches`, pour que
  le signalement indique quel réseau est visé.

### Questions à trancher avant de commencer

1. Les posts dans la relecture : tous dépliés, ou repliés avec le premier ouvert ?
2. Réécrire un post efface-t-il sa marque « Diffusé » ? Aujourd'hui oui (la marque ne survit que
   si le texte est identique) — logique pour un article encore en brouillon, à confirmer.
3. Même besoin dans l'**éditeur** (signalement impossible là-bas aujourd'hui, même pour le corps) ?

---

## ✅ Évènements depuis Claude Desktop (serveur MCP)

*Ajouté le 15/09/2026 — **fait le 16/09/2026**.*

### Ce qui a été livré

- **Back** : `GET`, `GET :id`, `POST` et `PUT :id` de `/admin/events` rouverts à
  `ADMIN_ET_ASSISTANT`. L'assistant ne modifie qu'un brouillon (`assertBrouillonPourAssistant`,
  tenu par `EventsService.update`). Publier, reporter, annuler, complet, supprimer, image : ADMIN.
- **`Event.origin`** (`HUMAN` | `ASSISTANT`, mêmes valeurs que `Article.origin` et non `ADMIN`),
  fixé par le rôle à la création (migration `20260916080000_event_origin`). La liste admin
  affiche « rédigé par l'assistant ».
- **Fiche admin** : `publicationCheck` (`missing`, `forbidden`) joint à la lecture, la création et
  la modification — l'assistant dit ce qui manque sans le deviner.
- **MCP** : `mcp/src/evenements.ts` — `lister_evenements`, `lire_evenement`, `creer_evenement`,
  `modifier_evenement`. Champs en français, calqués sur le format de collage. Chaque réponse finit
  par le bilan : ce qui manque, ce qui bloque, ce qui est à vérifier (Maps, jauge, charte).
- **Décisions** : (1) les règles vivent dans `mcp/CLAUDE.md` § « Évènements » **et** dans le prompt
  du collage ; chacun renvoie à l'autre (doc de `admin-event-paste.component.ts`, tête de la
  section). Pas de source commune possible : deux dépôts. (2) Pas de date de publication proposée :
  publier un évènement reste un geste humain.

**Pour que ça marche** : relancer le back (migration + routes) puis Claude Desktop (outils).

*Ce qui suit est l'analyse d'origine, conservée pour mémoire.*

### Le besoin

Rédiger les évènements depuis Claude Desktop, comme les articles, au lieu de copier la réponse de
l'IA dans `/admin/evenements/coller` — collage qui perd des lignes (la ligne `---` disparaît quand
on copie depuis le rendu de la conversation, et la description arrive vide).

### Ce qui existe déjà

- **Le serveur MCP** (`landingMoze-back/mcp/src/index.ts`) n'a que les 7 outils du blog : rien sur
  les évènements.
- **Le back** ferme toute l'administration des évènements à l'assistant :
  `admin-events.controller.ts` porte `@Roles(Role.ADMIN)` sur la classe. Le rôle `ASSISTANT`
  prend un 403 partout.
- **Le format et les règles** existent déjà, dans le prompt de l'écran de collage
  (`admin-event-paste.component.html`) : n'invente rien, jamais de lien Google Maps non fourni,
  dates avec décalage horaire, jamais « gratuit », slug pensé pour Google, charte.

### Ce que ça implique

**Back**
- Rouvrir à `ADMIN_ET_ASSISTANT` seulement lister, lire, créer et modifier. Publier, reporter,
  annuler, marquer complet et supprimer restent à l'`ADMIN`.
- Limiter l'assistant aux brouillons, comme `assertBrouillonPourAssistant` pour les articles.
- Ajouter `origin` (`ADMIN` | `ASSISTANT`) sur `Event`, pour savoir d'où vient un brouillon.

**Serveur MCP**
- Quatre outils : `lister_evenements`, `lire_evenement`, `creer_evenement` (les champs du format
  de collage, dont `slug`), `modifier_evenement` (refus hors brouillon).
- Renvoyer dans la réponse ce qui manque pour publier et les points « À vérifier ».
- Reporter les règles du prompt dans `mcp/CLAUDE.md`.

### Questions à trancher avant de commencer

1. Une seule source pour les règles de rédaction : aujourd'hui elles vivraient à deux endroits
   (gabarit du collage et `mcp/CLAUDE.md`) et finiraient par se contredire.
2. L'assistant peut-il proposer une date de publication, comme `proposer_programmation` pour les
   articles, ou la publication reste-t-elle entièrement manuelle ?

---

## ✅ Éditeur d'articles : rail des réglages qui défile

*Ajouté le 15/09/2026 — **fait le 16/09/2026**.*

La règle du rail vit maintenant dans `admin-blog-editor.component.scss`, partagée par les deux
éditeurs (l'ancienne condition `min-height: 900px` a disparu). La liste de suggestions des tags est
en `position: fixed`, recalée au défilement et ouverte vers le haut quand la place manque
(`tag-input.component.ts`) : elle n'est plus rognée par le rail.

*Analyse d'origine :*

L'éditeur d'évènements a son rail `.ed-side` épinglé et défilant (molette au-dessus = le rail
défile, pas la page). L'éditeur d'articles ne l'a pas : la liste de suggestions de tags s'ouvre
vers le bas **dans** le rail et serait rognée par son `overflow`. Préalable : faire s'ouvrir cette
liste en couche au-dessus (position fixe ou portail), puis reprendre la règle de
`admin-event-editor.component.scss`.
