# Audit complet RestoSuite — Sécurité, Technique, Légal/RGPD, Landing/SEO

**Date : 9 juin 2026**
**Périmètre :** code réel du dépôt `restosuite-backend` (serveur Node/Express/SQLite ~34 200 lignes, ~80 fichiers de routes ; client SPA vanilla JS ~68 700 lignes ; apps Capacitor iOS/Android ; landing + blog + pages légales). Déploiement Render (Frankfurt), SMTP OVH, IA Google Gemini, paiements Stripe.

**Échelle de sévérité :**
- **CRITIQUE** — faille exploitable ou non-conformité légale active en production
- **MAJEUR** — risque significatif (sécurité, données, juridique, performance) à corriger rapidement
- **MINEUR** — défaut réel mais à impact limité ou mitigé par ailleurs
- **INFO** — point d'attention, dette, ou simple constat

---

## Résumé exécutif

Le socle de sécurité est **nettement au-dessus de la moyenne pour un SaaS de cette taille** : aucune injection SQL trouvée (paramétrage systématique + whitelists de colonnes), aucun IDOR cross-tenant identifié sur ~80 fichiers de routes audités, JWT fail-closed sans secret hardcodé, CSRF par double-submit dans le JWT, rate limiting en couches, uploads bornés, webhook Stripe signé, `npm audit` serveur à **0 vulnérabilité**. Les rapports de pentest internes précédents ont visiblement été traités sérieusement (les fixes sont tracés dans le code).

Les vrais problèmes sont ailleurs :

1. **RGPD — le droit à l'effacement est incomplet** : la suppression de compte ne purge que ~22 tables sur 76, laissant notamment des **données de santé du personnel** (`staff_health_records`) en base. C'est le point le plus grave de l'audit.
2. **Légal — emails de relance sans aucun lien de désinscription**, et **politique de confidentialité muette sur ce qui part chez Google Gemini** et sur Umami.
3. **Architecture — `server/index.js` (prod) duplique `server/app.js` (testé)** : l'artefact testé n'est pas celui déployé, et ils ont déjà divergé.
4. **Performance — bundle de 1,6 Mo non minifié** (`minify: false` dans le build), ~60 % de gain immédiat disponible.
5. **Sauvegardes — copie de fichier brute d'une base SQLite en mode WAL, sur le même disque** : backups potentiellement corrompus et inutiles en cas de perte du disque Render.

**Décompte : 3 CRITIQUE · 8 MAJEUR · 14 MINEUR · 9 INFO.**

---

## 1. SÉCURITÉ

### 1.1 JWT et authentification

**Ce qui est bien fait (vérifié) :**
- Pas de secret hardcodé. `JWT_SECRET` exigé ≥ 32 caractères au démarrage, fail-closed (`server/app.js:30-36`, `server/index.js:17-24`). Les seules valeurs en dur sont dans les helpers de test (`server/tests/helpers/env.js:4`), ce qui est normal.
- Algorithme HS256 (signature HMAC avec secret), `jti` unique par token + **blacklist de révocation** persistée en DB avec nettoyage opportuniste (`server/routes/auth.js:57-81`), claim `csrf` par token.
- Cookie `jwt` **HttpOnly + Secure + SameSite=Strict** (`server/routes/auth.js:29-40`), le cookie prime sur le header Bearer dans `requireAuth` (`auth.js:194-222`).
- Lockout PIN à deux étages : par IP+cible en mémoire (5 essais/15 min) **et** par compte persisté en DB (`failed_pin_attempts`, `pin_locked_until`, 10 essais/30 min) — résiste à la rotation d'IP (`auth.js:120-165`).
- `register` : politique de mot de passe (8+, majuscule, chiffre), pas de PIN par défaut (fix pentest C2.1), consentement strict `accepted_terms === true`.

**Problèmes :**

| # | Sévérité | Constat | Localisation | Fix |
|---|----------|---------|--------------|-----|
| S1 | **MAJEUR** | `POST /api/accounts/login` (legacy) : endpoint **public** qui prend `{id, pin}` sans scoping restaurant, sans lockout par compte (`recordAccountPinAttempt` non appelé), et renvoie nom/rôle/permissions du compte. N'émet pas de JWT, mais c'est un **oracle de brute-force PIN** (10 000 combinaisons, seul le rate-limit IP 20/15 min freine) + fuite d'informations par énumération d'`id` + écriture de `last_login`. | `server/routes/accounts.js:77-111` | Supprimer l'endpoint (le flux moderne passe par `/api/auth/staff-login` → `/staff-pin`) ou y appliquer le même lockout par compte + scoping. |
| S2 | **MAJEUR** | `DELETE /api/accounts/self` (suppression totale du compte + restaurant) lit le Bearer **directement** au lieu de passer par `requireAuth` : **la blacklist JWT n'est pas vérifiée** — un token volé puis « déconnecté » via `/api/auth/logout` peut encore tout supprimer pendant 30 jours. Le cookie HttpOnly n'est pas accepté non plus (incohérent avec le reste). | `server/routes/accounts.js:509-521` | Remplacer par `requireAuth` (qui vérifie `isTokenRevoked`) + exiger une re-saisie du mot de passe avant une action aussi destructive. |
| S3 | MINEUR | Expiration JWT à **30 jours** sans rotation ni refresh token (`JWT_EXPIRY = '30d'`, `auth.js:21`). Mitigé par la blacklist au logout, mais une fuite de token donne 30 jours d'accès. Le token portail fournisseur a la même durée (`supplier-portal.js:55`). | `server/routes/auth.js:21` | Passer à 7 jours + ré-émission glissante, ou access court + refresh. |
| S4 | MINEUR | Aucun `jwt.verify(..., { algorithms: ['HS256'] })` : l'algorithme n'est pas épinglé (`auth.js:211`, `lib/csrf.js:55`, `lib/soft-auth.js`, `routes/accounts.js:517`). jsonwebtoken v9 limite déjà les algos compatibles avec un secret HMAC, mais l'épinglage explicite est la pratique recommandée. | 4 fichiers | Ajouter l'option `algorithms`. |
| S5 | MINEUR | `POST /api/auth/smart-login` (le login principal de l'app !) n'est couvert par **aucun rate-limiter dédié** — ni dans `app.js:130-136` ni dans `index.js:119-127`. Mitigé par le lockout mémoire IP+email (5/15 min, `auth.js:646-651`) et le limiteur global 200/15 min. | `server/index.js:119-127` | Ajouter `app.use('/api/auth/smart-login', authLimiter)`. |

### 1.2 Isolation multi-tenant (IDOR)

Audit exhaustif des ~80 fichiers de `server/routes/` (agent dédié + vérifications manuelles) : **aucun IDOR cross-tenant trouvé**. Le pattern `WHERE id = ? AND restaurant_id = ?` est systématique, y compris dans les UPDATE/DELETE (`accounts.js:308,363,414`, `recipes.js`, `invoices.js`, `crm.js`, `witness-meals.js`, etc.). Les misses cross-tenant renvoient 404 (anti-énumération). Points notables :

- **Portail fournisseur** (`supplier-portal.js`, 2 075 lignes) : le fournisseur ne voit que les paires `(supplier_id, restaurant_id)` résolues par `getSupplierIdentities()` / `identityWhereClause()` (lignes 85-115) — sain. Tokens portail stockés **hashés SHA-256** en DB.
- **API publique** (`public-api.js`) : clés API hashées SHA-256, refusées en query string, scopées `restaurant_id`.
- **Admin** (`admin.js`) : `requireAuth` + whitelist d'emails.
- **Cron** (`cron.js:16-26`) : `CRON_SECRET` obligatoire, **fail-closed (503)** si absent.
- **Menu public / QR code** : `restaurant_id` explicite en query, lectures scopées — exposition volontaire et limitée.
- `POST /api/errors/report` : authentifié, champs tronqués, log plafonné 5 Mio avec rotation (`errors.js:11-29`) — pas de DoS disque.

| # | Sévérité | Constat | Localisation | Fix |
|---|----------|---------|--------------|-----|
| S6 | INFO | Rate limiting IA par compte (60/h) et par tenant (300/h) en mémoire process — documenté comme à migrer vers Redis avant tout scaling horizontal. OK en single-instance Render. | `server/routes/ai-core.js:83-135` | Rien d'urgent. |

### 1.3 Injection SQL

**Aucune injection trouvée.** Toutes les requêtes des routes utilisent des placeholders `?`. Les quatre seuls `SET`/noms de table dynamiques sont construits depuis des **whitelists en dur** :
- `ai-actions.js:69,115` (colonnes recettes/ingrédients autorisées),
- `accounts.js:259-308` (champs de mise à jour contrôlés),
- `accounts.js:544-563` (liste fixe `tenantTables`),
- `invoices.js`, `planning.js` (helpers `setIf` avec whitelist).

Les template literals dans `db-migrations.js` n'interpolent que des constantes internes. RAS.

### 1.4 XSS

- **Serveur** : CSP stricte sur toutes les réponses (`app.js:99` / `index.js`) — `script-src 'self' + cdnjs + js.stripe.com`, `default-src 'self'`, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, HSTS en prod (`app.js:90-104`).
- **Client** : `escapeHtml()` (`client/js/api.js:1073-1082`) appliqué **systématiquement** — sur 612 usages d'`innerHTML` analysés dans `client/js/views/`, aucune interpolation de donnée utilisateur non échappée n'a été trouvée (~962 appels `escapeHtml` dans le bundle). Très bon.

| # | Sévérité | Constat | Localisation | Fix |
|---|----------|---------|--------------|-----|
| S7 | **MAJEUR** | Le client web stocke le JWT en **localStorage** (`restosuite_token`) et l'envoie en `Authorization: Bearer` sur chaque requête (`client/js/views/login.js:12,445`, `client/js/api.js:39-41,229,432,968`). Conséquences : (a) le token est volable par XSS, annulant le bénéfice du cookie HttpOnly que le serveur émet pourtant ; (b) **les requêtes Bearer sont exemptées de la vérification CSRF** (`lib/csrf.js:42-43`), donc la protection CSRF est de facto inactive pour le client web. Le Bearer est nécessaire pour l'app mobile Capacitor (`capacitor.config.ts` : CapacitorHttp natif, pas de cookies) — mais pas pour le web. | `client/js/views/login.js:12` | Sur le web : ne plus persister le token (le cookie HttpOnly + `csrf_token` suffisent, l'infra serveur existe déjà) ; réserver le Bearer aux clients mobiles/API. |
| S8 | INFO | `client/index.html` n'a pas de CSP en meta — sans impact sur le web (header serveur) mais l'app **Capacitor** embarque son propre HTML (`mobile/www`) servi localement **sans** ces headers : ajouter une CSP meta dans le HTML mobile. | `client/index.html`, `mobile/www` | Meta CSP dans les bundles embarqués. |

### 1.5 Rate limiting

Couverture vérifiée (`app.js:106-146`, `index.js:96-141`) : global `/api/` 200/15 min ; auth (login, register, pin-login, staff-login, staff-pin, accounts/login) 20/15 min ; IA 30/h ; admin 30/h ; portail fournisseur 20/15 min (dans `index.js` seulement, voir T1). `trust proxy` correctement réglé à 1 pour Render (`app.js:41`). Manque : `smart-login` (S5) et `logout` dans `index.js` (cosmétique).

### 1.6 Uploads

Les 4 configurations multer ont **`fileSize: 10 Mo` + `fileFilter` par type MIME** (`routes/ai-core.js:141-151`, `routes/recipes.js:21-31`, `routes/ai-scan.js:41-51`, `routes/supplier-portal.js:28-38`). Fichiers stockés en `/tmp` avec purge >24 h au boot (`app.js:163-174`). Le MIME déclaré par le client est falsifiable, mais les fichiers sont parsés (xlsx/IA), jamais re-servis tels quels — risque résiduel faible. RAS.

### 1.7 Secrets

- Grep complet (`api_key|password|secret|token` affectés à des littéraux) : **aucun secret de production dans le code**. Seuls des secrets de test (`tests/helpers/env.js`) et des placeholders.
- `render.yaml` : tous les secrets en `sync: false` (saisis dans le dashboard Render). `.env.example` seulement, pas de `.env` commité.
- Le `WEBSITE_ID` Umami dans `client/js/umami.js:17` est public par nature — OK.

### 1.8 npm audit

- `server/` (prod) : **0 vulnérabilité** (`npm audit --omit=dev`).
- Racine (devDeps build/Capacitor) : 1 **moderate** — `brace-expansion` (ReDoS, GHSA-jxxr-4gwj-5jf2). MINEUR (S9) : `npm audit fix` à la racine.
- INFO (S10) : `xlsx` est installé depuis le tarball CDN SheetJS (`xlsx-0.20.3.tgz`, version corrigeant les CVE 2023/2024 connues) — `npm audit` ne suit pas les advisories pour les dépendances par URL : **surveiller manuellement** les CVE SheetJS.

---

## 2. TECHNIQUE

| # | Sévérité | Constat | Localisation | Fix |
|---|----------|---------|--------------|-----|
| T1 | **MAJEUR** | **`server/index.js` (448 lignes, point d'entrée prod) duplique `server/app.js` (395 lignes, ce que testent les ~60 fichiers de tests)**. Ils ont déjà divergé : `index.js` a des limiters portail fournisseur qu'`app.js` n'a pas ; `app.js` limite `/api/auth/logout`, pas `index.js` ; aucun des deux ne limite `smart-login`. **L'artefact testé n'est pas l'artefact déployé** — toute correction faite dans un seul fichier (CSP, limiter, ordre de middleware) peut silencieusement manquer dans l'autre. | `server/index.js` vs `server/app.js` | Faire d'`index.js` un simple `require('./app')` + `listen()` + tâches périodiques, et porter les différences dans `app.js`. |
| T2 | **MAJEUR** | **Backups SQLite non fiables** : `backupDatabase()` fait un `fs.copyFileSync` du fichier `.db` alors que la base est en **mode WAL** (`db.js:22`) — la copie ignore le fichier `-wal` : transactions récentes perdues, voire copie incohérente si un checkpoint survient pendant la copie. De plus les 7 backups sont stockés **sur le même disque `/data` Render** : une perte du disque emporte la base ET ses backups. | `server/backup.js:18` ; `server/index.js:144-145` | Utiliser l'API native `db.backup()` de better-sqlite3 (ou `VACUUM INTO`), et expédier les backups hors du disque (S3/B2/R2…). |
| T3 | **MAJEUR** | **Bundle client de 1,6 Mo non minifié** : `scripts/build.js:134` passe `minify: false` à esbuild. Total JS ~2 Mo (dont `lucide.min.js` 348 Ko). Pas de code splitting : les ~70 vues partent dans un bundle monolithique chargé en `<script>` bloquant (`client/index.html:114`). Minification seule ≈ −60 % ; c'est la cause directe du « 1,5 Mo » constaté. | `scripts/build.js:134` | `minify: true` (gain immédiat sans risque), puis code splitting par route et `defer`. |
| T4 | MINEUR | **N+1** sur `GET /api/recipes` : `getFullRecipe(r.id)` est appelé pour **chaque** recette de la page (jusqu'à 50), chacun déclenchant plusieurs requêtes (ingrédients + sous-recettes récursives) (`routes/recipes.js:337-347`). Même pattern sur `/availability` (`recipes.js:377`). Impact contenu (better-sqlite3 synchrone en local, pagination max 200), mais croît avec la taille des fiches. | `server/routes/recipes.js:337` | Calculer les coûts en 2-3 requêtes agrégées (JOIN + GROUP BY), ou mettre en cache `total_cost` sur la ligne recette. |
| T5 | MINEUR | `uncaughtException` / `unhandledRejection` sont **capturés sans terminer le process** (`lib/error-tracker.js:63-71`). Après un `uncaughtException`, l'état du process est indéfini (recommandation Node : log puis `process.exit(1)`, Render redémarre). | `server/lib/error-tracker.js:64` | `capture(...)` puis `process.exit(1)` sur `uncaughtException`. |
| T6 | MINEUR | Service Worker : versioning du cache **manuel** (`CACHE_NAME = 'restosuite-v56'`, `client/sw.js:19`) — un déploiement qui oublie le bump laisse les clients sur l'ancien bundle (network-first limite la casse, mais le fallback offline servirait du vieux code). Bons points : `/api/` jamais caché, purge des vieux caches à l'activation, `postMessage sw-update`. | `client/sw.js:19` | Injecter un hash de build dans `CACHE_NAME` via `scripts/build.js`. |
| T7 | MINEUR | `GET /api/health` renvoie `error: e.message` brut en 503 (`app.js:333`) — fuite mineure d'interne (chemin DB, etc.). Le handler d'erreurs global, lui, est propre : **aucune stack trace ne part au client**, juste `{error, request_id}` (`app.js:391`), stack loggée côté serveur/Sentry. | `server/app.js:333` | Remplacer par un message générique. |
| T8 | INFO | Gestion d'erreurs globalement sérieuse : request-id par requête, logger structuré, Sentry optionnel, log d'erreurs rotatif 5 Mio, audit log applicatif (`writeAudit`) sur les mutations sensibles. | — | — |
| T9 | INFO | DB : WAL + `foreign_keys=ON` (`db.js:22-23`), **102 index** dont les index `restaurant_id` par table (`db-schema.js`: 18, `db-migrations.js`: 83). Bonne couverture. | — | — |

---

## 3. LÉGAL / RGPD

### Conforme (vérifié dans les fichiers)
- **Mentions légales** complètes : éditeur (Paul-Aymeric Barbier, micro-entrepreneur, SIREN 930 269 063, adresse), directeur de publication, hébergeur Render (`client/legal/mentions.html`).
- **CGV** complètes : prix (Pro 39 € HT/mois), essai 60 j, rétractation 14 j, résiliation, lecture seule 12 mois puis suppression, droit français (`client/legal/cgv.html`).
- **Privacy** : bases légales art. 6, durées de conservation, 7 droits RGPD + contact + CNIL, sous-traitants Render/Stripe/Google cités, transferts hors UE (DPF + CCT) (`client/legal/privacy.html`).
- **Consentement à l'inscription** : `accepted_terms === true` strict + `terms_accepted_at` horodaté en DB, pour les comptes ET les fournisseurs (`auth.js:248-253,295,439-444,462`) ; testé (`tests/auth.test.js`).
- **Portabilité (art. 20)** : `GET /api/accounts/:id/export` exporte en JSON 20 familles de données scopées tenant (`accounts.js:432-505`).
- **Minimisation vers l'IA** : `scrubPII()` masque emails, téléphones, NIR, numéros de carte avant tout envoi à Gemini (`ai-core.js:549-565`) + anti prompt-injection (`sanitizeForPrompt`, `ai-core.js:572-586`).
- Cookies : uniquement des cookies strictement nécessaires (session) → pas de bandeau requis ; Umami est sans cookie.

### Non-conformités

| # | Sévérité | Constat | Localisation | Fix |
|---|----------|---------|--------------|-----|
| L1 | **CRITIQUE** | **Droit à l'effacement (art. 17) incomplet.** `DELETE /api/accounts/self` purge ~22 tables (`accounts.js:544-567`) mais le schéma en compte **76**. Restent en base après « suppression totale » : `staff_health_records` (**données de santé — catégorie spéciale art. 9**), `witness_meals`, `cooling_logs`, `cooking_records`, `reheating_logs`, `fryer_checks`, `haccp_ccp`, `haccp_hazard_analysis`, `messages`, `supplier_invoices` (+items), `training_records`, `waste_management`, `non_conformities`, `device_push_tokens`, `audit_log`, `ai_learning`, `staff_shifts`, `pest_control`, `equipment_maintenance`, etc. Idem pour la suppression d'un membre (`DELETE /api/accounts/:id`) qui laisse ses `staff_health_records`. Nuance : certains registres HACCP ont une obligation légale de rétention (à documenter comme exception art. 17(3)(b)) — mais la majorité des tables omises n'en relève pas. L'export RGPD (art. 20) a le même angle mort : 20 tables exportées sur 76. | `server/routes/accounts.js:544-567` | Construire la liste des tables tenant **dynamiquement** (PRAGMA + colonne `restaurant_id`) pour la purge ET l'export ; documenter les rétentions légales HACCP. |
| L2 | **CRITIQUE** | **Emails de relance J+1/J+3/J+7 sans aucun lien de désinscription ni flag d'opt-out** (`server/lib/retention-mailer.js:41-164`) : prospection par voie électronique sans moyen d'opposition simple — contraire à l'art. L. 34-5 CPCE et à l'art. 21 RGPD. Ces emails ne sont par ailleurs mentionnés ni dans la privacy ni dans les CGV. | `server/lib/retention-mailer.js` | Lien unsubscribe signé dans chaque email + colonne `accounts.marketing_emails_disabled` vérifiée dans `runRetentionCycle()` + mention dans la privacy. |
| L3 | **MAJEUR** | **Information art. 13 insuffisante sur l'IA** : la privacy ne consacre que quelques mots à Gemini (`client/legal/privacy.html:162`) alors que partent chez Google : transcriptions vocales, contenu des fiches, stats food cost/stock/fournisseurs (`ai-core.js:387-481`, `ai-voice.js:25-40`). Aucune mention du scrubbing PII (pourtant implémenté !) ni de l'usage ou non des données pour l'entraînement des modèles. **Vérifier le tier d'API Google** : sur l'offre payante Gemini API, Google s'engage à ne pas entraîner sur les données ; sur le tier gratuit, **il peut le faire** — c'est déterminant. | `client/legal/privacy.html:162` | Section dédiée « Traitement par Google Gemini » : données envoyées, finalités, scrubbing, engagement no-training (tier payant), base légale. |
| L4 | **MAJEUR** | **Umami actif mais invisible juridiquement et bloqué techniquement** : le loader est configuré en dur (`client/js/umami.js:16-17` → `restosuite-analytics.onrender.com`), or (a) la privacy ne mentionne pas cet analytics (elle affirme même « aucun cookie de traçage » sans décrire la mesure d'audience), et (b) ce domaine **n'est pas dans la CSP** `script-src`/`connect-src` (`app.js:99`, `index.js`) — le script est donc vraisemblablement bloqué en prod (vos stats sont silencieusement vides). Double fix : CSP + paragraphe privacy (Umami, sans cookie, intérêt légitime, hébergé Render Frankfurt). | `client/js/umami.js:16`, `server/app.js:99` | Ajouter le domaine à la CSP des **deux** fichiers serveur + section privacy. |
| L5 | MINEUR | Pas d'**opt-out global de l'IA** : `ai-preferences` ne gère que le tier de modèle (`eco/standard/premium`), pas de `ai_enabled: false` propagé aux routes IA. Bonne pratique (et argument commercial) plus qu'obligation. | `server/routes/ai-preferences.js` | Ajouter une préférence de désactivation par restaurant. |
| L6 | INFO | Privacy « données techniques » (`privacy.html:86-91`) à compléter avec ce que collecte Umami (URL, user-agent, événements). DPA à archiver : Render, OVH, Google Cloud, Stripe (registre des sous-traitants art. 30 — recommandé même en micro-entreprise). | `client/legal/privacy.html:86` | Compléter + tenir un registre des traitements. |

### EU AI Act — classification d'Alto

- **Rôle** : RestoSuite est **déployeur** d'un système d'IA construit sur un GPAI tiers (Gemini) ; les obligations « fournisseur de modèle » incombent à Google.
- **Classification** : Alto (saisie vocale de fiches, suggestions, actions sur recettes, chat contextuel) n'entre **ni dans les pratiques interdites (art. 5) ni dans le haut risque (annexe III)** — la gestion de restaurant n'y figure pas, et Alto n'est pas un composant de sécurité d'un produit régulé (annexe I). → **Risque limité/minimal.**
- **Obligations applicables** :
  - **Art. 50 (transparence)** : l'utilisateur doit savoir qu'il interagit avec une IA — Alto est présenté comme assistant IA dans l'UI et sur la landing : conforme dans l'esprit ; ajouter une mention explicite dans l'interface de chat si absente.
  - **Art. 4 (maîtrise de l'IA, applicable depuis février 2025)** : former/documenter l'usage de l'IA pour le personnel — une page d'aide suffit à cette échelle.
- **Point de vigilance** : les suggestions IA touchant l'**HACCP** (actions correctives, seuils) ont une incidence indirecte de sécurité alimentaire. Garder l'humain dans la boucle (c'est le cas : les actions Alto passent par confirmation et `writeAudit`, `ai-actions.js`) et afficher un disclaimer « ne remplace pas votre plan de maîtrise sanitaire » près des suggestions HACCP. (INFO)

---

## 4. LANDING / SEO

**Très bon niveau d'ensemble** : title/description optimisés, canonical, Open Graph + Twitter complets, **6 blocs JSON-LD** (SoftwareApplication, FAQPage, HowTo…), fonts async + preconnect, lazy-loading des images, `robots.txt` sain (`/api/` disallow, sitemap référencé), 22 articles de blog avec meta + JSON-LD Article. HTTPS forcé (redirect 301 + HSTS, `app.js:80-87,100-102`). **Cohérence prix vérifiée** : 39 €/mois et essai 60 j identiques entre landing (`landing.html:601-648`), backend (`plans.js:15-21`) et CGV. **Aucun témoignage fictif ni claim « X clients » invérifiable** — les promesses fonctionnelles (saisie vocale, 9 modules HACCP, commandes, prédictions, bilan carbone ADEME) correspondent toutes à des routes réelles vérifiées.

| # | Sévérité | Constat | Localisation | Fix |
|---|----------|---------|--------------|-----|
| W1 | MINEUR | `lastmod` du sitemap figés (avril-juin 2026, dates statiques). | `client/sitemap.xml` | Générer le sitemap au build avec les vraies dates. |
| W2 | MINEUR | `app-init.js` chargé sans `defer` sur la landing (bloque le rendu) ; idem `app.bundle.js` dans l'app (`client/index.html:114`). | `client/landing.html:229` | Ajouter `defer`. |
| W3 | INFO | Claims « 23 modules intégrés » (`landing.html:317`) et « 31 actions Alto » (`landing.html:380`) non adossés à une énumération vérifiable dans le code — pas trompeurs (le périmètre réel est même plus large), mais indéfendables tels quels. | `client/landing.html:317,380` | Documenter le décompte ou arrondir (« plus de 20 modules »). |
| W4 | INFO | Screenshots JPG 67-88 Ko ×14 → ~500 Ko convertibles en WebP (−60 %). Lien footer `/confidentialite` incohérent avec les autres liens légaux. | `client/assets/screenshots/`, `landing.html:785` | WebP + normaliser le lien. |

---

## 5. Plan d'action priorisé

**Semaine 1 — légal/RGPD (exposition active) :**
1. L2 — lien de désinscription + flag opt-out dans les emails de relance.
2. L1 — purge ET export RGPD étendus aux 76 tables (génération dynamique de la liste), traitement immédiat de `staff_health_records`.
3. L3/L4 — privacy : sections Gemini (+ vérifier le tier payant de l'API) et Umami ; ajouter Umami à la CSP.

**Semaine 2 — sécurité :**
4. S2 — `DELETE /accounts/self` derrière `requireAuth` + re-saisie du mot de passe.
5. S1 — supprimer/durcir `POST /api/accounts/login` legacy.
6. S7 — abandonner localStorage pour le token sur le web (cookie + CSRF déjà en place).
7. S5/S3/S4 — limiter `smart-login`, raccourcir l'expiration JWT, épingler `algorithms`.

**Semaines 3-4 — technique :**
8. T2 — backups via `db.backup()` + copie hors site (le plus gros risque de perte de données du projet).
9. T1 — fusionner `index.js` dans `app.js`.
10. T3 — `minify: true` (quick win), puis code splitting ; T6 hash de build dans le SW.
11. T4/T5/T7, S9, W1/W2 au fil de l'eau.

---

## Annexe — points contrôlés sans problème détecté

- Injection SQL : paramétrage systématique, whitelists sur les SET dynamiques ✔
- IDOR : isolation `restaurant_id` systématique sur ~80 fichiers de routes, 404 anti-énumération ✔
- Secrets : rien en dur, `render.yaml` en `sync:false` ✔
- `npm audit` serveur : 0 vulnérabilité ✔
- Webhook Stripe : signature `constructEvent` + idempotence ✔
- CORS : allowlist stricte prod (`restosuite.fr`), pas d'écho d'origine arbitraire avec credentials ✔
- Headers : CSP, HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy ✔
- Stack traces : jamais renvoyées au client (sauf `e.message` sur `/api/health`, T7) ✔
- Uploads : 10 Mo + fileFilter sur les 4 configs multer, purge des fichiers temporaires ✔
- XSS : `escapeHtml` systématique sur 612 usages `innerHTML` audités ✔
- Cron : fail-closed sur `CRON_SECRET` ✔
- HACCP/traçabilité/fiches/commandes annoncés = implémentés ✔

*Rapport généré par audit du code source réel (commit `731c628`), recoupé par quatre passes d'analyse indépendantes (isolation tenant, frontend, légal, marketing) et des vérifications manuelles ligne à ligne sur chaque point cité.*
