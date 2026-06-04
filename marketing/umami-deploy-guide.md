# Déploiement Umami sur Render + activation sur restosuite.fr

> **Umami** = analytics web self-hosted, open source, **RGPD-friendly par design**
> (pas de cookie, pas de donnée perso → **aucune bannière de consentement requise**).
> Repo officiel : https://github.com/umami-software/umami
> Doc : https://docs.umami.is

Ce guide se fait en ~5 min côté Render. Le code RestoSuite est **déjà prêt** :
il suffit de renseigner 2 valeurs à la fin (voir Phase 4).

---

## Prérequis techniques (pour info)

| Besoin            | Valeur                                            |
|-------------------|---------------------------------------------------|
| Node.js           | ≥ 18.18                                            |
| Base de données   | PostgreSQL ≥ 12.14                                 |
| Port applicatif   | 3000 (Render le mappe automatiquement)            |
| Build             | `pnpm build` (ou `npm run build`)                 |
| Start             | `pnpm start` (ou `npm start`)                     |
| Variables d'env   | `DATABASE_URL`, `APP_SECRET` (voir Phase 3)        |

> Le déploiement le plus simple sur Render utilise **l'image Docker officielle**
> `ghcr.io/umami-software/umami:postgresql-latest` — pas besoin de gérer le build
> Node/pnpm soi-même. C'est l'option recommandée ci-dessous.

---

## Phase 1 — Créer la base PostgreSQL (free tier)

1. Dashboard Render → **New +** → **PostgreSQL**.
2. Réglages :
   - **Name** : `restosuite-umami-db`
   - **Database** : `umami` (ou laisser par défaut)
   - **Region** : **Frankfurt** (même région que le service, latence + RGPD UE)
   - **Plan** : **Free** (256 Mo — largement suffisant pour de l'analytics)
3. **Create Database**, puis attendre que le statut passe à *Available*.
4. Ouvrir la base → onglet **Connections** → copier l'**Internal Database URL**
   (format `postgresql://user:pass@dpg-xxxx/umami`).
   → On l'appellera `DATABASE_URL` en Phase 3.

> ⚠️ Le plan PostgreSQL Free de Render **expire après 30 jours** (il faut le recréer)
> et se met en pause après inactivité. Pour de l'analytics qui doit durer, prévoir
> de passer la base en plan payant (~7 $/mois) une fois le besoin confirmé.

---

## Phase 2 — Déployer Umami en Web Service

1. Dashboard Render → **New +** → **Web Service**.
2. Choisir **Deploy an existing image from a registry** (le plus simple) :
   - **Image URL** : `ghcr.io/umami-software/umami:postgresql-latest`
   - *(Alternative « depuis GitHub » : fork de `umami-software/umami`, Runtime Node,
     Build `pnpm install && pnpm build`, Start `pnpm start` — plus lent, à éviter.)*
3. Réglages du service :
   - **Name** : `restosuite-analytics`
   - **Region** : **Frankfurt** (⚠️ la MÊME que la base, sinon l'Internal URL ne marche pas)
   - **Instance Type** : **Free** pour tester (le service s'endort après 15 min
     d'inactivité ; passer en **Starter ~7 $/mois** pour qu'il reste toujours actif —
     recommandé en prod, sinon le 1er visiteur après une pause ne sera pas tracké).
4. Renseigner les variables d'environnement → **Phase 3**.
5. **Create Web Service**. Au 1er démarrage, Umami crée les tables automatiquement.

---

## Phase 3 — Variables d'environnement

Dans le Web Service → onglet **Environment** → ajouter :

| Clé            | Valeur                                                                 |
|----------------|------------------------------------------------------------------------|
| `DATABASE_URL` | L'Internal Database URL copiée en Phase 1                              |
| `APP_SECRET`   | Une chaîne aléatoire longue et unique (sécurise les tokens d'auth)     |
| `DATABASE_TYPE`| `postgresql` *(requis avec l'image Docker)*                            |

Générer un `APP_SECRET` solide (à coller dans la valeur) :

```bash
openssl rand -hex 32
```

> Optionnel : `DISABLE_TELEMETRY=1` pour qu'Umami n'envoie aucune télémétrie
> anonyme à ses auteurs.

Sauvegarder → Render redéploie automatiquement.

---

## Phase 3 bis — Première connexion Umami

1. Une fois le service *Live*, ouvrir son URL :
   `https://restosuite-analytics.onrender.com` (l'URL exacte est affichée en haut
   de la page du service Render).
2. Se connecter avec le compte par défaut : **identifiant `admin` / mot de passe `umami`**.
3. **Changer immédiatement le mot de passe** (Settings → Profile).
4. **Settings → Websites → Add website** :
   - **Name** : `RestoSuite`
   - **Domain** : `www.restosuite.fr`
5. Cliquer sur le site créé → **Edit / Get tracking code**. Noter :
   - **l'URL du service** (= `UMAMI_URL`, ex. `https://restosuite-analytics.onrender.com`)
   - le **Website ID** (UUID, = `WEBSITE_ID`, ex. `b1f2c3d4-5678-90ab-cdef-1234567890ab`)

---

## Phase 4 — Activer le tracking côté RestoSuite (1 fichier à éditer)

Tout le code est déjà en place. Le script Umami est chargé par un **chargeur unique**
`client/js/umami.js`, inclus sur la landing, toutes les pages blog et l'app.
**Il n'y a qu'un seul fichier à modifier** pour tout activer.

1. Ouvrir `client/js/umami.js` et remplacer les 2 constantes :

   ```js
   var UMAMI_URL  = 'https://restosuite-analytics.onrender.com'; // URL du service Render
   var WEBSITE_ID = 'b1f2c3d4-5678-90ab-cdef-1234567890ab';       // Website ID Umami
   ```

   Tant que ces valeurs contiennent `PLACEHOLDER`, le chargeur ne fait **rien**
   (aucune requête réseau, aucun risque). Dès qu'elles sont renseignées, le tracking
   démarre partout.

2. Bumper la version du Service Worker pour invalider le cache :
   dans `client/sw.js`, incrémenter `CACHE_NAME` (`restosuite-vNN`).

3. Commit + push. Render redéploie RestoSuite. C'est tout.

> Pas besoin de rebuild du bundle : `umami.js` est un fichier statique servi tel quel.

---

## Évènements déjà instrumentés (`data-umami-event`)

Visibles dans Umami → onglet **Events** dès activation :

| Évènement            | Où                                                              |
|----------------------|----------------------------------------------------------------|
| `cta-essai-gratuit`  | Tous les boutons d'essai gratuit de la landing (→ `/app#register`) |
| `inscription-submit` | Bouton « Créer mon compte » du formulaire d'inscription (app)  |
| `blog-click`         | Toutes les cartes d'articles de la page blog (`/blog/`)         |

> `inscription-submit` nécessite que le chargeur soit aussi présent dans l'app —
> c'est le cas (`client/index.html`), pour mesurer le funnel complet
> landing → clic CTA → inscription.

---

## Récap des fichiers RestoSuite touchés

- `client/js/umami.js` *(nouveau — chargeur, SEUL fichier à éditer pour activer)*
- `client/landing.html` *(chargeur + `cta-essai-gratuit` sur les CTA)*
- `client/index.html` *(chargeur dans l'app, pour `inscription-submit`)*
- `client/blog/*.html` *(chargeur sur les 22 pages + `blog-click` sur les cartes)*
- `client/js/views/login.js` *(`inscription-submit` sur le bouton d'inscription)*
- `client/sw.js` *(bump de version du cache)*
