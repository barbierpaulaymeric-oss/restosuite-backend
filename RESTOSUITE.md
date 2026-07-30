# RESTOSUITE — Document Maître

_Dernière mise à jour : 30 juillet 2026_

---

## 1. Vision

**RestoSuite** — Le premier assistant cuisine propulsé par l'IA.
Tagline : « Votre cuisine tourne. Vos chiffres suivent. »

Un logiciel SaaS tout-en-un pour les restaurateurs : fiches techniques avec food cost automatique, gestion des stocks, HACCP digital, commandes, suivi de lot, et intelligence artificielle (saisie vocale, scan de facture, suggestions menu).

**Studio :** Soulbound Games (Paul-Aymeric Barbier)
**SIREN :** 930 269 063
**Domaine :** www.restosuite.fr

---

## 2. Stack Technique

| Composant | Techno |
|-----------|--------|
| Backend | Node.js + Express |
| Base de données | SQLite (better-sqlite3-multiple-ciphers — chiffrement SQLCipher opt-in via `DB_ENCRYPTION_KEY`) |
| IA | Google Gemini 2.5 Flash |
| Paiement | Stripe |
| PDF | pdfkit |
| Auth | JWT (jsonwebtoken) + bcryptjs, cookie HttpOnly + CSRF |
| Hébergement | Render (keep-alive ping) — persistance : voir `docs/operations/persistence.md` |
| Frontend | SPA vanilla JS (bundle esbuild committé) |
| PWA | Service Worker **limité à /app** + manifest.json |
| Mobile | Capacitor 8 (`fr.restosuite.app`, UI dédiée `mobile/www`) |
| QR Codes | qrcode (npm) |
| Upload | multer |

**Décision d'architecture (2026-07-30)** : SQLite est la base assumée
(mono-instance, disque persistant Render `/data`, sauvegardes 6 h vérifiées
`quick_check`). **PostgreSQL n'est PAS pris en charge** — `server/db-adapter.js`
est une esquisse expérimentale non branchée ; une migration ne se justifiera
que si le multi-site ou la montée en charge est confirmé.

---

## 3. Architecture

```
www.restosuite.fr/          → landing.html (site vitrine)
www.restosuite.fr/app       → index.html (SPA logiciel)
www.restosuite.fr/menu      → menu.html (menu public QR code)
www.restosuite.fr/blog/     → articles SEO
www.restosuite.fr/demo-presentation.html → slides démo
```

**Repo GitHub :** github.com/barbierpaulaymeric-oss/restosuite-backend
**Render service ID :** srv-d762e6mdqaus73cdfa80

---

## 4. Fonctionnalités

### ✅ Livrées
- **Auth gérant** — inscription email/mdp, JWT 30 jours
- **Auth staff** — mot de passe restaurant → sélection membre → PIN 4 chiffres → JWT
- **Auth fournisseur** — email/mdp entreprise → sélection membre → PIN scopé par entreprise
- **Onboarding** — wizard 7 étapes (profil, restaurant, salle, équipe, frigos, fournisseurs, première fiche)
- **Fiches techniques** — recettes avec ingrédients, sous-recettes imbriquées, food cost cascade
- **49 ingrédients seed** — prix marché France 2026
- **Saisie vocale IA** — dicter une recette → fiche technique complète
- **Gestion des stocks** — dashboard, réception, mouvements, alertes stock bas
- **Commandes fournisseurs** — bons de commande matières premières (brouillon → envoyée → confirmée → réceptionnée), suggestions automatiques basées sur stock bas, réception avec mise à jour stock/prix. Accessible depuis Fournisseurs ou Plus (pas dans la nav principale).
- **Interface salle** — login PIN, grille tables, prise de commande tablette, suivi commandes temps réel, envoi en cuisine avec déduction stock
- **Interface cuisine** — écran dédié plein écran (#/kitchen), tickets commandes temps réel, alerte sonore, marquage préparation/prêt. Rôle `cuisinier` auto-redirigé.
- **Commandes QR (public)** — menu digital, commande client par QR code → validation serveur (utilise les anciennes tables orders/order_items)
- **HACCP** — températures, nettoyage, traçabilité, alertes DLC, export PDF
- **Suivi de lot** — bon de livraison fournisseur → réception → traçabilité lot → stock
- **Portail fournisseur** — auth email/mdp entreprise + PIN membre, catalogue, notifications prix, bons de livraison
- **Scan facture IA** — photo → extraction produits/prix/lots via Gemini Vision
- **Mercuriale** — suivi prix fournisseurs, alertes variation >10%, graphique SVG
- **Suggestions menu IA** — plats rentables, plats à améliorer, suggestion du jour
- **QR code commande** — page menu publique, commande client → validation serveur
- **PWA** — installable iPhone/Android, icône écran d'accueil, cache offline
- **Landing page** — site vitrine avec SEO, structured data, vidéo démo
- **Blog SEO** — 21 articles + index (CTA vers l'inscription avec attribution `?src=blog&article=…`)
- **Command palette** — Ctrl+K pour navigation rapide entre modules
- **Simulateur de prix** — slider interactif sur les fiches techniques
- **Modales de confirmation** — remplacement de tous les `confirm()` natifs
- **Light/dark mode**
- **Export PDF** — fiches techniques, HACCP (fonctionne même après expiration trial)
- **Import/Export CSV** — ingrédients
- **Auto-save** — brouillon recettes (localStorage)
- **Rate limiting** — 200/15min global, 30/h IA, 20/15min auth
- **Backup DB** — automatique toutes les 6h + au démarrage
- **Keep-alive** — ping toutes les 14 min (plus de cold start Render)
- **Alertes proactives** — DLC, stock bas, températures hors seuil, livraisons en attente

### États réels (2026-07-30)
- **Multi-site : MASQUÉ.** Le lien de navigation est retiré et la création est
  bloquée côté serveur par un feature flag (`MULTISITE_ENABLED`, désactivé) :
  plus aucun restaurant orphelin ne peut être créé. La route affiche
  « Bientôt disponible ». Réactivation = implémenter la vraie tenancy
  (org ↔ sites) puis passer le flag. Ne pas présenter le multi-site comme
  disponible.
- **Chiffrement au repos : ✅ ACTIF en production** (`DB_ENCRYPTION_KEY` définie,
  constaté au dashboard Render le 2026-07-30). « Données chiffrées » est exact.
  `GET /api/health/persistence` (`encrypted_at_rest`) le re-vérifie.
- **Domaine apex `restosuite.fr` : ✅ RÉPARÉ** (certificat émis, `restosuite.fr`
  → 301 → `www` → 200). Voir `docs/operations/domain-apex.md`.
- **Persistance : ✅ disque `/data` (1 GB) + snapshots Render quotidiens (7 j).**
  Mes sauvegardes locales (`server/backup.js`, 6 h) restent sur le même disque ;
  les snapshots Render fournissent le filet hors-instance. `DB_PATH` non défini
  (le code résout `/data/restosuite.db` automatiquement) — voir persistence.md.

### 🔜 À faire
- Emails transactionnels de fin d'essai (J+15, J+25, J+30)
- Marketplace fournisseur + Stripe Connect
- Intégration POS/caisse
- API publique

---

## 5. Pricing (offre actuelle — une seule)

| Plan | Prix | Détails |
|------|------|---------|
| Essai gratuit | 0€ | 60 jours, accès complet, sans carte bancaire |
| Pro | 39€ HT/mois | 1 établissement, toutes fonctionnalités, sans engagement (TVA : franchise en base, art. 293 B) |

Les anciens plans « Business 79€ » et « Fondateur 29€ à vie » n'existent plus
(retirés des CGV — audit homogénéité 2026-07-05). Ne pas les réintroduire dans
un document sans décision explicite.

**Après expiration trial :** mode lecture seule, export PDF toujours actif (obligation légale HACCP).

---

## 6. Identité Visuelle (DA actuelle — vert/crème)

- **Couleurs :** Vert d'action `#1F7A4D` (CTA), vert de marque `#2D8B5E`,
  crème `#FAF8F5` (fond), papier `#F4F1EA`, encre `#2A2A28`, or `#D4A843` (accents)
- **Fonts :** Inter (texte), Fraunces (titres éditoriaux), Caveat (accents
  manuscrits), JetBrains Mono (chiffres)
- **Style :** clair, éditorial, grain léger — landing + app + identité Android alignées (v64)

L'ancienne identité orange/dark (`BRAND.md`) est obsolète — ne plus s'y référer
pour de nouveaux supports sans décision.

---

## 7. Base de Données

### Tables principales
`restaurants`, `accounts`, `subscriptions`, `ingredients`, `suppliers`, `supplier_prices`, `recipes`, `recipe_ingredients`, `recipe_steps`, `stock`, `stock_movements`, `orders`, `order_items`, `tables`, `purchase_orders`, `purchase_order_items`

### Tables HACCP
`temperature_zones`, `temperature_logs`, `cleaning_tasks`, `cleaning_logs`, `traceability_logs`

### Tables fournisseur
`supplier_accounts`, `supplier_catalog`, `price_change_notifications`, `delivery_notes`, `delivery_note_items`

### Tables système
`price_history`, `referrals` (inactif)

---

## 8. Routes API

### Auth (gérant + staff)
- `POST /api/auth/register` — inscription email/mdp (gérant)
- `POST /api/auth/login` — connexion email/mdp (gérant)
- `POST /api/auth/pin-login` — login rapide PIN (legacy)
- `POST /api/auth/staff-login` — mot de passe restaurant → liste équipiers
- `POST /api/auth/staff-pin` — sélection équipier + PIN → JWT
- `PUT /api/auth/staff-password` — gérant définit le mot de passe staff
- `GET /api/auth/me` — infos utilisateur

### Onboarding
- `PUT /api/onboarding/step/:n` — étapes 1-7

### Recettes
- `GET/POST/PUT/DELETE /api/recipes`
- `GET /api/recipes/:id/flat-ingredients` — liste plate pour déduction stock

### Ingrédients / Fournisseurs / Prix
- `GET/POST/PUT/DELETE /api/ingredients`
- `GET /api/ingredients/export-csv`
- `GET/POST/PUT/DELETE /api/suppliers`
- `GET/POST /api/prices`

### Stock
- `GET/POST /api/stock`
- `POST /api/stock/reception`
- `GET /api/stock/movements`

### Commandes table (legacy, pour QR code)
- `GET/POST /api/orders`
- `POST /api/orders/:id/send` — envoi cuisine + déduction stock

### Commandes fournisseurs
- `GET/POST /api/purchase-orders` — CRUD bons de commande
- `PUT /api/purchase-orders/:id` — mise à jour statut/items
- `POST /api/purchase-orders/:id/receive` — réception → stock + prix
- `GET /api/purchase-orders/suggest` — suggestions basées sur stock bas

### HACCP
- `GET/POST /api/haccp/temperatures`
- `GET/POST /api/haccp/cleaning`
- `GET/POST /api/haccp/traceability`
- `GET /api/haccp/export/*` — exports PDF

### Livraisons
- `GET /api/deliveries` — liste bons
- `PUT /api/deliveries/:id/receive` — réception
- `GET /api/deliveries/dlc-alerts`

### Portail fournisseur
- `POST /api/supplier-portal/company-login` — login entreprise email/mdp → liste membres
- `POST /api/supplier-portal/quick-login` — login entreprise (auto-login si 1 membre)
- `POST /api/supplier-portal/member-pin` — PIN scopé par entreprise → token
- `POST /api/supplier-portal/invite` — créer accès fournisseur (email/mdp + PIN membre)
- `POST /api/supplier-portal/accounts/add-member` — ajouter membre à une entreprise
- `GET/DELETE /api/supplier-portal/accounts` — gérer comptes fournisseurs
- `GET/POST/PUT/DELETE /api/supplier-portal/catalog` — catalogue produits
- `POST /api/supplier-portal/delivery-notes` — créer bon de livraison
- `GET /api/supplier-portal/delivery-notes` — lister bons de livraison

### IA
- `POST /api/ai/voice-parse` — saisie vocale
- `POST /api/ai/scan-invoice` — scan facture
- `GET /api/ai/menu-suggestions` — suggestions menu

### Menu public (pas d'auth)
- `GET /api/menu` — carte du restaurant
- `POST /api/menu/order` — commande client QR

### Autres
- `GET /api/alerts/daily-summary`
- `GET /api/analytics/*`
- `GET /api/health`
- `POST /api/stripe/webhook`

---

## 9. Infra & Déploiement

### Variables d'environnement (Render)
```
GEMINI_API_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_ID
STRIPE_WEBHOOK_SECRET
```

### DNS (OVH)
- CNAME `www` → `restosuite-backend.onrender.com`
- Redirection `restosuite.fr` → `https://www.restosuite.fr`

### Stripe
- Produit : `prod_UG2hePdIEskvJ6`
- Prix : `price_1THWbhGjYOwZRnSFgXxC2Z2x` (39€/mois)
- Webhook : `https://restosuite-backend.onrender.com/api/stripe/webhook`

---

## 10. Scores & Reviews

| Critère | Score | Date |
|---------|-------|------|
| UX | 8.5/10 | 3 avril |
| Business | ~55/100 | 3 avril |
| Produit | 6.5/10 | 2 avril |
| Audit code | 0 erreurs | 5 avril |

Détails dans `UX_REVIEW.md`, `BUSINESS_REVIEW.md`, `PRODUCT_REVIEW.md`.

---

## 11. Go-to-Market (0€ budget)

### Canaux prioritaires
1. **Réseau PA** — collègues restaurateurs, bouche à oreille
2. **Facebook groups CHR** — groupes de restaurateurs français
3. **LinkedIn** — storytelling "le cuisinier qui code avec l'IA"
4. **SEO** — 3 articles blog déjà en place, continuer
5. **YouTube** — démos vocales du logiciel
6. **TikTok/Instagram** — Reels 30s "l'IA fait ça en 30 secondes"

### Partenariats possibles
- France Num (chèques numériques pour restaurants)
- Écoles hôtelières
- CCI locales

### Objectifs M3
- 50 inscriptions
- 10 clients Pro (390€ MRR)
- 5 articles SEO
- Présence Facebook/LinkedIn active

---

## 12. Sessions de travail récentes

### Session 30 juillet 2026 (Claude — exécution audit du 30/07)
- **Funnel réparé** — le CTA « S'abonner » de la landing ne POST plus Stripe sans
  auth : intention `subscribe` en sessionStorage → inscription/connexion →
  reprise automatique vers `#/subscribe` (`consumePostLoginIntent`, app.js).
  Erreurs Stripe visibles (plus de redirection silencieuse), page subscribe
  passée sur `API.request` (CSRF/cookie corrects).
- **Service worker limité à `/app`** (v65) — la landing/blog ne sont plus
  contrôlés ni rechargés ; anciens SW racine désenregistrés ; mise à jour de
  l'app par bannière « Recharger » au lieu du reload forcé.
- **44 CTA blog** → inscription directe avec attribution
  (`?src=blog&article=<slug>&pos=…#register`) + events Umami.
- **Perf landing** — WebP responsive (−70 %), fontes réduites aux graisses
  utilisées, `landing.min.css` + versionnage `?v=<hash>` (build.js), en-têtes de
  cache différenciés (server/app.js).
- **Accessibilité landing** — `<main>` + skip link, contrastes AA
  (`--text-tertiary` #726D60, badge prix en `--color-green-text`), dimensions
  d'images, FAQ « import de recettes » corrigée (Excel/CSV ≠ scan factures).
- **Persistance** — `server/db-path.js` (résolution unique), backup respecte
  `DB_PATH` + `quick_check`, script `restore-backup.js` testé, garde
  anti-disque-éphémère en prod, `GET /api/health/persistence`.
- **Analytics** — colonnes `acquisition_*` sur accounts, table `product_events`
  (sans PII), events serveur (account_created, first_recipe, activated,
  checkout_started, paid), `GET /api/admin/funnel`.
- **Qualité** — audits npm à 0 (patch brace-expansion≥5 via patch-package +
  shim minimatch), clés Gemini/Stripe neutralisées en test + garde réseau,
  `forceExit` retiré, tests de contrat mockés (Gemini, webhook Stripe),
  smoke tests Playwright (landing, funnel inscription, intention abonnement,
  modules mobile) — 864 tests Jest + 27 E2E verts.
- **Android** — test instrumenté corrigé (`fr.restosuite.app`), release sans
  keystore = échec explicite (plus de fallback debug silencieux), CI Android.
- **Bugs corrigés au passage** — « Passer » l'étape 1 de l'onboarding ne casse
  plus `accounts.name` (500) ; le tour guidé ne recouvre plus la page
  d'abonnement lors d'une reprise d'intention.

### Session 5 avril 2026 (Claude Opus)
- **Commandes fournisseurs** — Remplacement du module commandes table par un système de bons de commande matières premières (tables `purchase_orders` + `purchase_order_items`, route `purchase-orders.js`, workflow brouillon→envoyée→confirmée→réceptionnée)
- **Séparation salle/cuisine** — Écran cuisine dédié (`kitchen.js`) à la route `#/kitchen`, plein écran avec tickets temps réel, alertes sonores, détection retards. Rôle `cuisinier` auto-redirigé.
- **Auth staff 2 niveaux** — Mot de passe restaurant (bcrypt) → team picker → PIN 4 chiffres → JWT. Filtrage nav par `data-roles`, route guard dans router.js, modules invisibles si non autorisé.
- **Auth fournisseur entreprise** — Remplacement du login par PIN global par un système email/mdp par entreprise fournisseur → sélection membre → PIN scopé. Colonnes `email`, `password_hash`, `contact_name` ajoutées à `suppliers`. Routes `company-login`, `quick-login`, `member-pin`, `accounts/add-member`. PIN unique par entreprise (plus de collision inter-fournisseurs).
- **Vidéo démo** — Régénérée (67s, 1080p, musique ambient, 14 slides)
- **Retrait badge AI** — Supprimé de tout le site (HTML, CSS, screenshots, vidéo, PDF), recentrage titres
- **Logo outline** — Contour blanc épaissi (5-6px) pour lisibilité fond sombre
- **Bugs fixés** — Typo `ingName` dans PUT recipes, CSV header ingredients, supplier DELETE manquant
- **UX** — Command palette (Ctrl+K), simulateur prix, modales de confirmation custom, dashboard enrichi
- **Validation serveur** — try-catch + validation input sur toutes les routes
- **SEO** — Open Graph, structured data enrichi, FAQ schema, async font loading

### Commits historiques

```
124d9e0 fix: SIREN 930269063 in legal mentions
c3802ec fix: smart unit conversion, merged recipe view, stock product count + supplier name
951c74f feat: demo presentation (12 slides)
e80ab0f fix: public menu API response format
8abd042 feat: AI menu suggestions, QR code ordering
47bc207 feat: keep-alive, daily alerts, invoice scan, mercuriale
8e3b8bd feat: email/password auth + 7-step onboarding
0af9212 feat: demo video
255e46a feat: delivery notes with lot tracking
880aa52 fix: sub-recipes, export CSV, fournisseur role
7d98382 feat: SEO blog (3 articles)
3122a16 feat: rate limiting, DB backup
```
