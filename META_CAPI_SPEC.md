# Meta Conversions API (CAPI) — spécification `CompleteRegistration`

> But : compter **toutes** les inscriptions dans Meta, y compris quand le Pixel navigateur
> échoue (bloqueurs de pub, ITP/Safari, navigateur in-app, erreur JS/réseau). Le back envoie
> l'event serveur→serveur au moment où il crée le compte — il connaît donc les inscriptions
> à 100 %. Déduplication avec le Pixel via un `event_id` partagé.

---

## 1. Ce que le front envoie déjà (fait)

Le front génère un `event_id` par inscription, le pose sur le Pixel **et** le joint au DTO d'inscription :

```jsonc
// POST https://app.mozeconnect.fr/mozeapp/inscription   (body, champ ajouté)
{
  "nom": "...", "prenom": "...", "pseudo": "...", "email": "...",
  "telephonePersonnel": "...", "communication": { "secteur": "..." },
  "meta": {
    "eventId": "3f2c…-uuid",   // clé de dédup, MÊME id que le pixel
    "fbp": "fb.1.169....",     // cookie _fbp (null si pas de pixel)
    "fbc": "fb.1.169....",     // cookie _fbc ou reconstruit depuis ?fbclid= (peut être null)
    "adConsent": true          // consentement publicitaire de l'utilisateur (RGPD)
  }
}
```

Côté Pixel navigateur, le même id part avec l'event :
`fbq('track', 'CompleteRegistration', {...}, { eventID: meta.eventId })`.

⚠️ **Prérequis back** : le DTO doit **tolérer ce champ `meta`**. Spring/Jackson l'ignore par
défaut (`fail-on-unknown-properties=false`). Si ton parsing est strict, **ajoute le champ** ou
passe-le en tolérant, sinon l'inscription renverra 400.
👉 À **tester d'abord sur le serveur de test** via `https://www.moze.fr/commencer?test`
(le front route alors vers `nico.by-moze.fr`) avant la prod.

---

## 2. Ce que le back doit faire (à implémenter)

À la **création réussie** d'un compte (`/mozeapp/inscription`), si `meta.adConsent === true` :
envoyer un event `CompleteRegistration` à la Conversions API avec le **même `event_id`**.

### Appel
```
POST https://graph.facebook.com/v21.0/<PIXEL_ID>/events?access_token=<CAPI_ACCESS_TOKEN>
Content-Type: application/json
```

### Payload
```jsonc
{
  "data": [
    {
      "event_name": "CompleteRegistration",
      "event_time": 1720000000,                 // epoch secondes, ~maintenant (< 7 jours)
      "action_source": "website",
      "event_source_url": "https://www.moze.fr/commencer",
      "event_id": "<meta.eventId reçu du front>",  // DÉDUP : identique au pixel
      "user_data": {
        "em":  ["<sha256(email en minuscules, trim)>"],   // hash obligatoire
        "client_ip_address": "<IP de la requête entrante>",
        "client_user_agent": "<User-Agent de la requête entrante>",
        "fbp": "<meta.fbp si présent>",
        "fbc": "<meta.fbc si présent>"
      },
      "custom_data": {
        "content_name": "inscription",
        "sector": "<communication.secteur>"
      }
    }
  ]
}
```

### Règles clés
- **`event_id`** : réutiliser CELUI DU FRONT (`meta.eventId`). C'est ce qui permet à Meta de
  **fusionner** l'event Pixel et l'event serveur → **compté 1 seule fois**.
- **`em`** : SHA-256 de l'email **normalisé** (minuscules + trim). Ne PAS envoyer l'email en clair.
- **`fbp` / `fbc`** : les transmettre tels quels s'ils sont présents (améliorent l'attribution).
  Ne pas les inventer côté back — s'ils sont `null`, les omettre.
- **`client_ip_address` / `client_user_agent`** : ceux de la **requête HTTP entrante** du front
  (pas ceux du serveur). Attention derrière un proxy/CDN : prendre `X-Forwarded-For`.
- **`event_time`** : proche de l'instant (Meta rejette > 7 jours).

---

## 3. RGPD / consentement
- N'envoyer la CAPI **que si `meta.adConsent === true`** (sinon on transmet des données perso à
  Meta sans base légale).
- Si `adConsent === false` : ne rien envoyer (ou event sans données perso + `data_processing_options`,
  décision à valider avec le DPO). La CAPI ne « répare » donc **pas** les refus de consentement,
  seulement les pertes techniques chez les consentis.

---

## 4. Config à récupérer (Events Manager Meta)
- **`PIXEL_ID`** = `2004229900969485` (pixel prod, cf. `environment.prod.ts`).
- **`CAPI_ACCESS_TOKEN`** : Events Manager → Paramètres → Conversions API → *Générer un token
  d'accès* (System User token). À stocker en secret côté serveur (jamais côté front).

---

## 5. Tester
1. Events Manager → **Test Events** → récupérer le `test_event_code`.
2. Ajouter `"test_event_code": "TESTxxxxx"` au payload (au niveau racine, à côté de `data`).
3. Faire une inscription réelle → vérifier que l'event apparaît en temps réel dans Test Events,
   et qu'il est **« Déduplication : Deduplicated »** avec l'event du navigateur (même `event_id`).
4. Vérifier le **score de correspondance** (email + IP + UA + fbp/fbc).

---

## 6. Récap responsabilités
| Étape | Côté |
|---|---|
| Générer `event_id`, poser sur le pixel, joindre `meta` au DTO | ✅ Front (fait) |
| Accepter le champ `meta` (parsing tolérant) | Back |
| Envoyer `CompleteRegistration` à la CAPI avec le même `event_id` (si `adConsent`) | Back |
| Hasher l'email, joindre IP/UA/fbp/fbc | Back |
| Stocker le token CAPI en secret | Back / Infra |

> Doc évolutif — à adapter selon la version de l'API Graph et les décisions RGPD.
