# Assistant de rédaction dans l'admin du blog — note de cadrage

> **Statut : conception arrêtée, pas encore implémentée.** Discussions des 01–02/09/2026.
> Aucune ligne de code écrite, rien dans le dépôt n'en dépend.

## L'idée

Intégrer Claude **dans `/admin/blog`**. Le rédacteur lance un prompt, Claude produit un ou
plusieurs articles avec leurs dates de parution, un humain relit et valide la programmation à
la fin.

Le back appelle l'API Anthropic ; rien ne sort de l'interface d'administration.

> **Écarté :** relier le Claude Desktop du patron au blog par un connecteur MCP. C'est
> techniquement faisable et le back accepte déjà l'authentification `Bearer`
> (`src/auth/jwt.strategy.ts`), mais ce n'est pas le projet : l'assistant doit vivre dans
> l'admin. La piste reste notée si le besoin change.

---

## 1. Les deux surfaces

| Surface | Rôle |
|---|---|
| **Panneau dans l'éditeur** | Un article. Surtout l'itération : « plus court », « change le titre », « ajoute un exemple ». |
| **Écran assistant dédié** | Le lot. Un prompt, N articles avec leurs dates, relecture, validation finale. |

Les deux partagent le même moteur côté back : mêmes règles, mêmes outils, même validation.

**Ordre de construction** — le panneau d'abord : c'est la brique dont le reste dépend, et il
est utilisable en bout de course dès le premier jour.

---

## 2. Ce qui existe déjà et qu'il ne faut pas réécrire

### L'étape de vérification humaine, c'est l'éditeur

Tout l'aval est construit et testé pour l'import DOCX : pré-remplissage du formulaire, liserés
rouges sur les champs vides, avertissement à la publication, aperçu carte et article complet,
modale de programmation.

Un article produit par Claude, c'est **le même objet dans le même formulaire**. Il n'y a aucun
écran de validation à inventer.

### La programmation

`AdminBlogService.publish(id, at)` pose un `publishedAt` futur ; la lecture publique filtre sur
« déjà paru ». **Il n'y a aucune tâche planifiée dans ce back.** Programmer N articles se
réduit à N appels d'un endpoint qui fonctionne déjà.

### Le contrat de sortie

`importArticleFromDocx` (`src/app/common/article-import.ts`) produit exactement :

```
{ title, slug, excerpt, content, tags, metaTitle, metaDescription }
```

C'est le même objet que doit rendre le modèle, plus la date de parution.

### Les garde-fous d'écriture

Slug unique, historique de slug (redirections 301), sanitization, résolution des tags : tout
vit dans `AdminBlogService.create()`.

> **L'assistant doit passer par ce service, jamais par Prisma directement.**

---

## 3. Piège n° 1 — la whitelist HTML

Le back **filtre le HTML à l'enregistrement contre une whitelist, en silence**
(`src/common/sanitize.ts`).

Un modèle produit spontanément du `<div>`, du `<table>`, du `<figure>`, du `<span style>`, du
`<h1>`. Tout cela disparaît sans erreur : l'article s'enregistre, la mise en forme est mangée,
et personne ne s'en aperçoit avant de relire la page publique.

C'est déjà un point de friction connu côté WYSIWYG. Avec un générateur qui produit plusieurs
articles d'affilée, ça devient **le mode de défaillance principal**.

Deux parades, et il faut les deux :

1. la whitelist exacte inscrite dans les règles données au modèle ;
2. une **validation avant enregistrement qui dit ce qu'elle a retiré**. C'est le point clé :
   aujourd'hui la sanitization retire en silence ; pour que Claude puisse se corriger, il faut
   qu'elle rende un message exploitable (« `<table>` et `<div>` ont été supprimés »). L'échec
   devient bruyant et rattrapable dans la conversation.

---

## 4. Piège n° 2 — les dates. Trois filets.

Le prompt peut porter la date : « sous-traitance lundi 8 h, apport d'affaires mercredi 8 h ».
C'est le bon geste, mais il ouvre un mode de défaillance sérieux.

> **Une date résolue dans le passé est aujourd'hui ramenée à « maintenant » par `publish()` —
> donc l'article part en ligne immédiatement.** Un « lundi » mal interprété, une confusion
> d'année, un fuseau mal appliqué, et vous avez une publication non voulue sur un site public.

### Filet 1 — donner la date et le fuseau au modèle

Sans la date du jour et le fuseau (`Europe/Paris`) dans son contexte, « lundi » n'a
littéralement aucun sens pour lui. C'est la cause première, et elle est gratuite à traiter.

### Filet 2 — refuser les dates passées côté serveur

Aujourd'hui `publish()` fait l'inverse, et c'est délibéré : le commentaire du DTO justifie la
tolérance par la dérive d'horloge du poste de l'admin, de quelques secondes.

Ne pas supprimer cette tolérance, la **borner** : refuser au-delà d'une minute dans le passé.
Une date mal interprétée n'est jamais fausse de trente secondes — elle est fausse d'un jour,
d'un mois ou d'un an. Une fenêtre de grâce courte attrape donc toutes les vraies erreurs sans
casser la raison d'être de la tolérance actuelle.

**À vérifier deux fois :**

- **à la lecture du brief**, pour signaler « le lundi 1er septembre est déjà passé » avant
  d'avoir généré trois articles ;
- **à la validation finale**, parce qu'un lot généré mardi et relu jeudi contient des dates
  devenues du passé entre-temps. C'est le scénario le plus probable de tous.

### Filet 3 — réafficher la date résolue en clair

« Programmé pour le **lundi 8 septembre 2026 à 08:00** ». C'est ce qui permet à l'œil humain
d'attraper une mauvaise interprétation avant la validation.

---

## 5. Le parcours complet

```
prompt  →  relecture du brief  →  génération  →  relecture par article  →  validation finale
```

**Le prompt.** « Trois articles sur la facturation collaborative : sous-traitance lundi 8 h,
apport d'affaires mercredi 8 h, cotraitance vendredi 8 h. »

**La relecture du brief.** Avant de dépenser deux minutes de génération, l'assistant répond ce
qu'il a compris : les titres, et les dates **résolues en clair**. Une ligne de conversation, pas
un écran. C'est là qu'on attrape une date mal lue ou un sujet mal cerné, quand ça ne coûte
encore rien.

> *Nuance :* pas d'écran de plan obligatoire — quand vous donnez les sujets, le plan c'est votre
> prompt. Le jour où vous direz « propose-moi 3 sujets », c'est le bot qui choisit, et là un
> vrai écran de plan reprend tout son sens.

**La génération.** Chaque article est **créé en brouillon dans la base immédiatement**. Ça
survit à un rechargement ou un redémarrage, et les articles apparaissent dans la liste admin
normale — rien ne peut se perdre dans un état intermédiaire.

**La relecture.** Une carte par article : titre, date proposée, état. On clique, on arrive dans
**l'éditeur habituel**, on corrige, on revient.

**La validation finale.** Un bouton « Programmer les N articles » qui enchaîne les
`publish(id, at)`. C'est le seul moment où quelque chose devient irréversible.

---

## 6. L'écran final et les couvertures

Claude ne peut pas produire d'image. Les articles arriveront donc **systématiquement** avec la
couverture manquante.

Sur chaque carte : la vignette si elle existe, sinon **un bouton unique** qui ouvre le sélecteur
de fichier. L'envoi passe par l'`upload()` existant, `coverImageUrl` se remplit, la vignette
apparaît. Un clic par article, pas plus.

**Bonus gratuit** — la trame de rédaction contient déjà un champ « Idée d'image ». Si les règles
demandent à Claude de le produire, la carte l'affiche : *« deux indépendantes devant un même
ordinateur portable, espace de coworking lumineux »*. Celui qui cherche la photo sait quoi
chercher.

**Bloquant, sans échappatoire.** Le bouton « Programmer » reste **désactivé** tant qu'une
couverture manque, avec le décompte en clair : « 2 articles sans image ».

> Raison : **pas de couverture, pas d'`og:image`.** Un article partagé sur LinkedIn ou Facebook
> sortirait sans visuel — exactement le problème réparé côté Meta fin août. La couverture n'est
> pas cosmétique.

Pas de sortie « programmer quand même » sur cet écran : **le blocage dur est sûr parce qu'il
n'enferme personne.** Qui veut vraiment programmer un article sans visuel l'ouvre dans
l'éditeur normal et le programme depuis là, où l'avertissement n'est pas bloquant. Pas
d'impasse, donc pas besoin de porte de sortie.

---

## 7. Les règles : contexte permanent, pas mémoire à piocher

Distinction importante, et contre-intuitive.

**Piocher, c'est une décision du modèle.** Si les règles sont dans un stock qu'il consulte
*quand il juge utile*, il ne le fera pas toujours. Une règle appliquée trois fois sur quatre
n'est pas une règle.

Or les règles ne sont pas de la documentation, ce sont des **contraintes** : whitelist,
longueurs de champs, ton, interdits factuels. C'est donc **le serveur qui les lit à chaque
requête**, pas le modèle qui décide d'aller les chercher.

| Quoi | Où ça vit | Qui décide de le lire |
|---|---|---|
| **Les règles** | table en base, éditable depuis l'admin | le serveur, **toujours** |
| **Le corpus** (articles, tags existants) | la base | le modèle, **à la demande** (outil) |
| **Les préférences apprises** | plus tard, si utile | le modèle |

Le corpus, lui, se pioche légitimement : il est gros, il change, et Claude n'en a besoin que
pour éviter un doublon ou poser un lien interne. Comme il tourne dans le back, ce sont de
simples requêtes Prisma — pas de réseau, pas d'authentification, pas de latence.

**Le coût de tout envoyer à chaque fois est un faux problème** : le bloc de règles ne bouge pas
d'un article à l'autre, la mise en cache du prompt fait tomber son coût d'environ 90 % dès la
deuxième requête. C'est aussi pourquoi les règles doivent vivre **en base et non dans un
fichier du dépôt** : retouchées sans déploiement, et préfixe stable donc cacheable.

---

## 8. Décisions structurantes

### 8.1 Où tourne le modèle → dans le back

Une clé d'API dans un bundle Angular est publique. Module NestJS, `@anthropic-ai/sdk`, clé en
variable d'environnement.

### 8.2 Pas d'agent en v1

Écrire un article à partir d'un brief et de règles est spécifiable d'avance : un appel
structuré par article suffit, avec des **sorties structurées** (`output_config.format`) pour
que le modèle rende exactement les champs attendus. Plus aucun parsing fragile.

Une boucle d'outils se justifierait pour aller chercher de l'information sur le web ou choisir
seul les sujets — phase 2.

### 8.3 Degré d'autonomie → brouillon daté, mise en ligne au clic

Les articles affirment des choses sur la **facturation électronique 2026**, le **crédit d'impôt
SAP**, le statut d'auto-entrepreneur. Une erreur réglementaire publiée sous la signature Moze
est un problème de crédibilité, pas de style. S'ajoute le contexte SEO : le blog sort de deux
mois de réparation, et une salve d'articles faibles est ce que Google sanctionne au titre du
contenu produit à l'échelle.

L'article part donc en **brouillon avec sa date de parution déjà posée** et ne bascule qu'au
clic humain. On garde le « il programme tout seul », on perd seulement l'irréversibilité.

### 8.4 Tracer l'origine

Un booléen en base sur les articles rédigés par l'assistant. Utile pour auditer la qualité
après coup, repérer un défaut systématique dans les règles, et le jour où la question de la
transparence se pose.

---

## 9. Un lot n'est pas une requête HTTP

Plusieurs articles × quelques minutes = timeout. Il faut un **job en base**, pas une requête
qu'on attend.

### 9.1 Le modèle d'états

Deux niveaux :

**Le lot**

```
en attente → en cours → pause demandée → en pause → terminé / échoué
```

**Chaque article du lot**

```
à faire → en cours → fait / échoué
```

La boucle de génération vérifie le drapeau du lot **entre deux articles**. Reprendre, c'est
repartir du premier `à faire`.

Bénéfice qui tombe tout seul : le **rejeu des articles en échec**. Si le troisième plante sur
une erreur réseau, il reste `à faire`, et « Reprendre » le retente sans refaire les deux
premiers.

### 9.2 Pause et reprise — ce que « pause » peut réellement vouloir dire

**On ne peut pas interrompre proprement une génération en cours.** L'appel est parti, le modèle
écrit. L'abandonner, c'est perdre l'article à moitié écrit — et le payer quand même.

« Pause » signifie donc honnêtement : **on termine l'article en cours, on ne démarre pas le
suivant.** L'effet est différé d'une à deux minutes. D'où trois états visibles, pas deux :

| État | Ce que voit le rédacteur |
|---|---|
| **En cours** | « article 2 sur 5 » |
| **Mise en pause…** | « pause à la fin de l'article en cours » |
| **En pause** | « reprendre » |

Et une action **séparée**, « Arrêter », pour couper tout de suite en acceptant de perdre
l'article en cours. Deux besoins différents, deux boutons.

### 9.3 Empêcher la fermeture — ce qui est possible, et ce qui ne l'est pas

**On ne peut pas empêcher la fermeture d'un onglet.** Le seul levier est `beforeunload`, et les
navigateurs modernes n'affichent que leur propre message générique, non personnalisable, que
l'utilisateur peut toujours confirmer. C'est un ralentisseur, pas une barrière.

**La navigation interne, en revanche, se maîtrise complètement** — et le motif existe déjà dans
l'éditeur : la modale « Quitter sans enregistrer / Continuer l'édition ». On la réutilise.

> **Mais la vraie protection n'est pas le blocage, c'est la persistance.** Si le job vit en
> base et non en mémoire du navigateur, fermer l'onglet ne casse rien : la génération continue
> côté serveur, on revient plus tard, on retrouve l'avancement. Le garde-fou de fermeture
> devient une politesse, pas une nécessité.

C'est aussi ce qui protège du cas que personne n'anticipe : **le redémarrage du serveur en
pleine génération**. Avec un job persisté, le lot repart de l'article suivant au lieu d'être
perdu.

### 9.4 Si les lots tournent la nuit

L'**API Batches** est faite pour ça : asynchrone par nature et **50 % moins chère**.

---

## 10. Quand l'API refuse — quotas et crédits

« Plus de tokens » recouvre quatre situations qu'il ne faut surtout pas traiter pareil.

| | Ce que c'est | Retriable ? |
|---|---|---|
| **429 — limite de débit** | on génère trop vite (tokens par minute) | **oui**, la réponse indique le délai |
| **529 — surcharge** | saturation côté Anthropic | **oui**, quelques secondes |
| **Crédits épuisés** | le compte n'a plus de solde | **non**, il faut recharger |
| **401 — clé invalide** | clé révoquée ou mal configurée | **non** |

Le 429 est de loin le plus fréquent dans un lot : cinq articles à la suite, c'est exactement le
profil qui touche la limite par minute. **Ce n'est pas une panne, c'est le fonctionnement
normal.**

Cas voisin à ne pas confondre : **`stop_reason: "max_tokens"`**, quand la réponse dépasse la
taille autorisée. L'article est tronqué en plein milieu — erreur de génération, pas de
facturation.

### Pas de message dans les cas retriables

Sur un 429 ou un 529, le rédacteur ne voit qu'une attente :

> *« article 3 sur 5 — reprise dans 24 s »*

Afficher « tokens épuisés » là serait un faux signal, et pousserait à recharger un compte qui
va très bien.

### Le message est pour le cas terminal, et il dit quoi faire

> **Crédits épuisés.** Le lot est en pause à l'article 3 sur 5. Les deux premiers sont
> enregistrés en brouillon. Rechargez le compte, puis cliquez sur **Reprendre**.

Trois informations, toutes actionnables : la cause, où on s'est arrêté, et le fait que rien
n'est perdu.

### Le modèle d'états traite déjà ce cas

Sans rien ajouter : les articles 1 et 2 sont `fait` (brouillons en base, visibles dans la
liste), l'article 3 reste `à faire`, le lot passe `en pause`. « Reprendre » repart de
l'article 3 — même chemin qu'une pause manuelle, un seul mécanisme pour les deux.

### Ce qu'on ne peut pas faire

**Vérifier le solde avant de lancer.** L'API de génération n'expose pas le crédit restant ; les
rapports de consommation demandent une clé d'administration de l'organisation, disproportionné
ici. On découvre donc l'épuisement au moment où il arrive — d'où l'importance de la reprise
propre plutôt que de la prévention.

> Pas d'estimation de coût affichée avant lancement : l'abonnement couvre les tokens, le
> rédacteur n'a pas à arbitrer là-dessus.

---

## 11. Le coût n'est pas un sujet

Hypothèses : article de 1 500 mots ≈ 2 000 tokens de sortie ; règles + corpus en préfixe
≈ 10 000 tokens d'entrée.

Sur **Claude Opus 5** ($5 / $25 par million de tokens) :

| | |
|---|---|
| Sans cache | ≈ **0,11 €** l'article |
| Avec mise en cache du préfixe | ≈ **0,07 €** l'article |
| Un lot de 5 articles | ≈ **0,35 €** |

> Ne pas dégrader le modèle pour économiser trente centimes. Le facteur limitant est la qualité
> éditoriale, pas la facture.

---

## 12. Ce que le document de règles doit contenir

Au-delà de l'évidence (ton, cible, longueur, structure), les contraintes que personne n'écrit
spontanément parce qu'elles sont techniques :

- **la whitelist HTML exacte** — la règle la plus importante du document ;
- **les longueurs maximales** que le back rejette : titre 200, extrait 500, meta title 200,
  meta description 500, slug 120 ;
- **les liens internes** : donner le corpus et demander d'y renvoyer (les cartes d'aperçu
  existent déjà, cf. `/blog/cards`) ;
- **l'idée d'image**, pour alimenter l'étape couverture ;
- **les interdits** : inventer un chiffre, dater une réforme, citer un texte de loi sans
  certitude.

---

## 13. Esquisse d'API (non figée)

```
POST /admin/blog/ai/brief          → relit le brief, résout et renvoie les dates en clair
POST /admin/blog/ai/generate       → crée un job, produit N brouillons
GET  /admin/blog/ai/jobs/:id       → avancement (lot + état de chaque article)
POST /admin/blog/ai/jobs/:id/pause → pause à la fin de l'article en cours
POST /admin/blog/ai/jobs/:id/resume→ repart du premier article « à faire »
POST /admin/blog/ai/jobs/:id/stop  → coupe tout de suite, perd l'article en cours
POST /admin/blog/ai/refine         → itération sur un brouillon (panneau de l'éditeur)
```

Le job appelle `AdminBlogService.create()` pour chaque article. La validation finale enchaîne
les `publish(id, at)`. Tous les garde-fous existants s'appliquent alors sans effort.

---

## 14. Questions encore ouvertes

1. **L'assistant touche-t-il à la une ?** Plutôt non : 5 emplacements, une mécanique d'échange
   différé, c'est une décision éditoriale.
2. **Sujets imposés ou proposés ?** « Écris sur X, Y, Z » est tranché. « Trouve-moi 5 sujets
   pertinents » suppose qu'il connaisse le corpus et, idéalement, qu'il puisse chercher sur le
   web — c'est la porte d'entrée vers un vrai agent, et vers l'écran de plan.
3. **Le sort de l'import DOCX.** Si l'assistant devient la voie normale, le parseur ne sert
   plus qu'à rattraper l'arriéré. Décision prise en attendant : **ne pas le réparer**, les
   documents existants passent par copier-coller.
