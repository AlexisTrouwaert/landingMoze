# CNIL — Pixel de suivi : phase 2 (à traiter plus tard)

> Créé le 2026-07-12. À reprendre **le moment venu** (fin de la période de transition CNIL).
> **Décision actuelle : on laisse comme ça** (modèle transitoire), on y revient plus tard.

---

## État actuel (transition — NE PAS toucher pour l'instant)

- Consentement au pixel géré **nativement par Brevo** (Solution 1 : « Consentement au suivi par pixel par contact » = **Oui**).
- Réglage Brevo « **Suivre les contacts dont le consentement est inconnu** » = **Oui** → modèle **opt-out transitoire** : on continue de tracker l'ancienne base (non-révoquée) le temps de la transition.
- E-mail d'opt-out déjà envoyé à l'ancienne base FR (tag natif `{{ revoke_open_pixel_tracking }}`).
- Case pixel **opt-in** « J'accepte le suivi… » présente dans les 2 formulaires, **MAIS le POST vers Brevo est commenté** (chercher `TODO CNIL pixel`) → la case est **visuelle uniquement**, elle n'envoie encore rien.

---

## À faire plus tard (phase 2)

### 1. ⚠️ CONSTAT (testé le 2026-07-12) : le consentement pixel NE PEUT PAS être posé par le POST `serve`
Test confirmé (F12 → Réseau sur le form Brevo) : **même case cochée**, `_PIXEL_TRACKING_CONSENT` **n'apparaît JAMAIS dans le payload** — alors que `OPT_IN` (case normale) y est bien. Brevo gère le consentement pixel **à part** (attribut système de consentement, avec traçabilité valeur/date/source ; on ne peut pas le « forger » par un POST brut).
→ **Notre approche zéro-back (POST direct vers l'URL `serve`) ne peut PAS poser ce consentement.** Le POST commenté dans le code est donc à **abandonner** en l'état.

### 2. Options pour poser le consentement à l'inscription (à choisir en phase 2)
- **A. API Brevo (petit back) — fiable, colle à l'archi existante.** Un endpoint back met `_PIXEL_TRACKING_CONSENT` via l'API Brevo (comme `META_CAPI_SPEC.md` fait déjà du serveur→serveur). Le **funnel POST déjà vers le back** (`/mozeapp/inscription`) → ajouter l'appel là ; l'accueil devrait être routé via un petit endpoint.
- **B. Contournement par automation (peut-être zéro-back, À TESTER).** POST un attribut **custom normal** (ex. `PIXEL_OPTIN=1/0`, qui LUI apparaît dans le payload) → automation Brevo : déclencheur « PIXEL_OPTIN mis à jour » → action « mettre à jour `_PIXEL_TRACKING_CONSENT` ». ⚠️ Vérifier qu'une automation peut écrire l'attribut **système** de consentement.
- **C. Embarquer le vrai form Brevo** → impraticable (UI custom + funnel). Écarté.

### 3. (Optionnel, plus tard) Basculer « Suivre les inconnus » → Non
Pour arrêter de tracker l'**ancienne** base non-consentie (fin de la tolérance transitoire). Les **nouveaux** seront couverts par le consentement recueilli à l'inscription (option A ou B ci-dessus).

### 4. Fusionner les 2 opt-in (à explorer)
- Aujourd'hui : 2 cases séparées → « J'accepte de recevoir les e-mails » (opt-in newsletter) + « J'accepte le suivi » (opt-in pixel).
- Objectif : voir s'il existe un moyen de **fusionner** en une seule case / une UX plus fluide.
- ⚠️ Contrainte CNIL : le consentement au pixel est **indépendant** de l'envoi de l'e-mail. MAIS un **consentement unique** est admis pour « prospection commerciale directe + pixels aux finalités **connexes** » (personnalisation, fréquence) **si** la prospection est présentée comme **personnalisée** (reco CNIL §4.2). → Fusion envisageable **si formulée correctement**, à valider (idéalement avec le DPO).

---

## Fichiers concernés
- **Accueil** (`.cta-newsletter-container` / `.newsletter-section`) : `src/app/pages/home/email/email.component.{ts,html}`
- **Funnel** : `src/app/pages/funnel/steps/interstitial-step/interstitial-step.component.{ts,html}`

## Infos techniques confirmées (form Brevo newsletter, 2026-07-12)
- URL `serve` = **inchangée** (déjà dans le code, constante `brevoUrl`).
- Champ pixel : `name="_PIXEL_TRACKING_CONSENT"`, `value="1"` (cochée).
- ⚠️ Le champ `_PIXEL_TRACKING_CONSENT` **n'est pas soumis** dans le POST du form (testé F12 le 2026-07-12 : absent du payload **même case cochée**) → Brevo gère ce consentement **en interne** (son JS / la feature), PAS comme un champ standard. C'est LE point qui impose l'option A ou B (section « À faire »).
