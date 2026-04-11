# AUDIT DE MATURITÉ — RESTOSUITE

## Résumé Exécutif
**Date : 6 avril 2026**
**Maturité Globale : 2/5 (MVP → BETA)**

RestoSuite est un logiciel SaaS ambitieux et bien structuré pour la gestion restauration, avec une base technique solide mais présentant des lacunes critiques pour la production. Le projet démontre une excellente compréhension des besoins métier (restaurateurs français), une architecture fonctionnelle, mais requiert des investissements significatifs en DevOps, testing, et conformité légale.

---

## 1. DÉPLOIEMENT & DEVOPS — Score : 2/5

### État actuel
- ✅ Hébergé sur **Render (free tier)** avec keep-alive configuré (ping /api/health toutes les 14 min)
- ✅ **SQLite** avec backup automatique (6h + startup) — locaux à la DB
- ✅ **HTTPS** sur restosuite.fr via CNAME OVH
- ✅ **CORS** configuré (app.use(cors()))
- ✅ Variables d'env stockées chez Render (GEMINI_API_KEY, STRIPE_*)

### Points critiques manquants
- ❌ **Aucun Dockerfile** — déploiement manuel, pas de containerisation
- ❌ **Pas de CI/CD** (.github/workflows/, .gitlab-ci.yml absent) — aucun test automatisé
- ❌ **Pas de gestion des secrets** robuste — .env.example minimal, JWT_SECRET hardcodé en dev
- ❌ **Pas de security headers** (CSP, X-Frame-Options, HSTS, X-XSS-Protection)
- ❌ **Pas de helmet.js** ni middleware de sécurité avancés
- ❌ **Backup limité** — 7 derniers backups seulement (compression manquante, pas de test de restore)
- ❌ **Pas d'audit logs** pour les actions sensibles
- ❌ **SQLite limitée** pour multi-utilisateurs concurrents (WAL pragma présent, mais pas de solution distribuée)

### Risques
- Cold starts Render = latence utilisateurs (→ mitigé par keep-alive)
- Perte de DB en cas de crash sans backup récent
- Pas de RTO/RPO défini
- SQLite inadapté pour >100 utilisateurs simultanés

**Recommandations**
1. Ajouter Dockerfile + docker-compose.yml pour déploiement cohérent
2. Implémenter CI/CD (GitHub Actions : lint, tests, deploy sur push)
3. Migrer vers PostgreSQL ou MySQL dès 50+ utilisateurs
4. Ajouter helmet.js + security headers personnalisés
5. Implémenter audit logging (avec rotation des logs)
6. Chiffrer backups hors-site (AWS S3, OVH Object Storage)

---

## 2. TESTING — Score : 1/5

### État actuel
- ❌ **Zéro test unitaire/intégration/e2e**
- ✅ Verification report manuel (VERIFICATION_REPORT.txt) valide la syntaxe JS
- ✅ Quelques try-catch sur routes critiques, validation input présente
- ✅ Code reviews documentées (FEATURES_AUDIT.md, UX_REVIEW.md)

### Architecture de testabilité
- ⚠️ **Code côté serveur** : Couplage DB-routes, pas de couche service isolée
- ⚠️ **Client SPA vanille** : Difficile à tester (state dans localStorage, pas de framework)
- ⚠️ **Pas de mock DB** pour tests isolés

### Estimation de couverture
- **Routes API** : ~20 routes critiques sans test (auth, recipes, stock, purchase-orders)
- **Logique métier** : Food cost cascade (récursive) = zone à haut risque sans test
- **Edge cases** : Aucun test de transaction concurrence, rollback, déduction stock invalide

### Code complexity
- **ai.js** : 909 lignes (appels Gemini, parse vocale, scan facture)
- **recipes.js** : 547 lignes (calcul coût cascade, gestion sous-recettes) → critère test
- **purchase-orders.js** : 513 lignes (workflow commandes fournisseurs)

**Recommandations**
1. Ajouter Jest + supertest (server), Vitest (client vanille)
2. Écrire tests unitaires pour logique métier critique (calcul coûts, déduction stock)
3. Tests d'intégration pour workflows clés (achat fournisseur, commande cuisine)
4. Coverage cible : 60% routes, 80% logique métier
5. Tests e2e Cypress/Playwright (3-4 scénarios utilisateur clés)

---

## 3. DOCUMENTATION — Score : 2/5

### Documentation existante
- ✅ **RESTOSUITE.md** (12,910 bytes) — Master document : vision, stack, features, routes API, deployment
- ✅ **BRAND.md** — Identité visuelle détaillée (couleurs, logo, typographie)
- ✅ **BUSINESS_REVIEW.md** — Analyse produit-marché
- ✅ **UX_REVIEW.md** — Critique UX avec scores (8.5/10)
- ✅ **PRODUCT_REVIEW.md** — Analyse fonctionnalités
- ✅ **QA_REPORT.md** — Bugs identifiés et état
- ✅ **FEATURES_AUDIT.md** — Audit des features livrées
- ✅ **PRICING_STUDY.md** — Étude tarifaire
- ❌ Aucun **README.md** à la racine
- ❌ Aucun **ARCHITECTURE.md** (diagrammes, patterns)
- ❌ Aucun **API_DOCUMENTATION.md** détaillé (format OpenAPI/Swagger absent)
- ❌ Code comments peu denses : ~20% des functions ont JSDoc

### API Docs
- Routes documentées en RESTOSUITE.md (format texte)
- Pas de Swagger/OpenAPI
- Pas de postman collection

### Code comments
- Séparation claire par sections (═══ bandeaux)
- Fonctions critiques (calcul coûts) manquent de JSDoc
- Migrations DB commentées, bonne qualité

**Recommandations**
1. Créer README.md (quickstart, install local, deploy)
2. Générer OpenAPI/Swagger à partir du code (express-openapi-validator)
3. Implémenter JSDoc sur toutes les fonctions métier
4. Créer ARCHITECTURE.md avec diagrammes (C4 model)
5. Documenter les migrations DB (versioning)

---

## 4. ERROR MONITORING & LOGGING — Score : 1/5

### Logging actuel
- ✅ console.log en startup (routes, health check)
- ✅ console.error sur toutes les routes (try-catch patterns)
- ❌ **Aucun service de monitoring externe** (Sentry, DataDog, New Relic, LogRocket)
- ❌ **Pas de structured logging** (winston, pino absent)
- ❌ **Logs stockés en mémoire** = perte à reboot Render
- ❌ **Pas d'alerting** sur erreurs 500, timeouts

### Health checks
- ✅ GET /api/health retourne `{status: 'ok', service: 'RestoSuite', version: '1.1.0', timestamp}`
- ❌ Pas de health checks granulaires (DB connected?, cache OK?)
- ❌ Pas de liveness/readiness probes (k8s-compatible)

### Error handling côté API
- ~15 routes avec try-catch + res.status(500).json({error: '...'})
- Erreurs Gemini loggées mais pas escaladées
- Pas de retry logic sur appels IA

**Recommandations**
1. Implémenter Sentry (gratuit, 5K erreurs/mois)
   - Intégration: `import * as Sentry from "@sentry/node"`
   - Capture exceptions + breadcrumbs
2. Ajouter structured logging (pino ou winston)
3. Créer health checks détaillés (DB alive, API latency)
4. Dashboard de monitoring (Grafana ou équivalent)
5. Alertes sur erreurs critiques (email sysadmin)

---

## 5. INTÉGRITÉ DES DONNÉES & FIABILITÉ — Score : 3/5

### Migrations DB
- ✅ **17 migrations** codées dans db.js (ALTER TABLE progressif)
- ✅ Vérification colonnes avant création (PRAGMA table_info)
- ✅ Index sur email (UNIQUE), foreign keys activées (pragma foreign_keys = ON)
- ❌ Pas de versioning explicite (type Flyway/Liquibase)
- ❌ Pas de rollback automatique en cas d'erreur migration

### Validation input
- ✅ **Email regex** sur /api/auth/register
- ✅ **Longueur password** (min 6 chars)
- ✅ Validation supplier_id, items array sur POST /api/purchase-orders
- ⚠️ **Validation inconsistente** — certaines routes manquent vérifs (exemple : POST /api/recipes sans vérifier name unique)
- ❌ **Pas de schéma validation** (joi, zod, yup absent)

### Transaction safety
- ✅ **db.transaction()** utilisé sur opérations multi-step (accounts.js, deliveries.js, menu.js, orders.js)
- ✅ Exemple: déduction stock + création order wrappés dans transaction
- ⚠️ **Non systématique** — certains workflows devraient être transactionnels (ex: POST /api/purchase-orders/receive)

### Data integrity
- ✅ **Contraintes FK** (ON DELETE CASCADE où approprié)
- ✅ **Waste percent** et calculs cascades documentés
- ⚠️ **Données orphelines possibles** si suppression stock sans vérif références
- ❌ **Pas de soft deletes** (archived_at, deleted_at) → audit trail limité

### Backup/Restore
- ✅ Backup auto 6h + startup (copyFileSync)
- ✅ Rotation 7 derniers backups
- ❌ **Pas de test de restore** documenté
- ❌ Pas de chiffrement backups
- ❌ Pas de backup hors-site (→ risque perte totale)

**Recommandations**
1. Implémenter joi/zod validation middleware global
2. Ajouter versioning migrations explicite (db_version table)
3. Systématiser db.transaction() sur toutes opérations critiques
4. Ajouter soft deletes (archived_at) pour audit trail
5. Tester restore backup mensuellement
6. Externaliser backups chiffrés (S3, OVH Object Storage)
7. Implémenter row-level locking pour stock concurrent

---

## 6. CONFORMITÉ LÉGALE & RGPD (FRANCE) — Score : 2/5

### RGPD & Protection données
- ✅ **Politique de confidentialité** (privacy.html, 50KB, mise à jour 1er avril 2026)
- ✅ Section "Vos droits" (accès, rectification, suppression, portabilité)
- ✅ **DPO désigné** : contact@restosuite.fr
- ✅ Données collectées listées (email, PIN, rôle, données métier)
- ❌ **Pas d'API de suppression de compte** (DPIA manquant)
- ❌ **Pas d'export de données** implémenté (sauf admin export-db en .db binaire)
- ❌ **Pas de consent management** (cookies, analytics)
- ❌ **Pas de data retention policy** explicite (combien de jours on garde les logs?)

### CGV & Mentions légales
- ✅ **mentions.html** présent (SIREN: 930 269 063, adresse, contact)
- ✅ **cgv.html** présent (conditions d'utilisation)
- ✅ **privacy.html** complet (mais sans consent widget)
- ✅ Logo + SIREN sur landing page
- ❌ Pas de signature électronique CGV (checkbox accept à l'inscription)

### NF525 & Certification caisse
- ❌ **AUCUNE mention** de NF525 (obligatoire pour les systèmes de caisse en France)
- ❌ Pas d'interface caisse certifiée (module "service" ne semble pas NF525-compliant)
- ⚠️ Si RestoSuite veut servir de caisse → certification obligatoire (CNIL)
- ⚠️ Archivage inviolable des tickets (6 ans légalement) = pas implémenté

### HACCP & Hygiène
- ✅ Module HACCP complet (températures, nettoyage, traçabilité)
- ✅ Export PDF HACCP (obligation France)
- ✅ DLC tracking et alertes
- ⚠️ Tampon numérique HACCP manquant (signature responsable absent)
- ❌ Pas de conformité légale explicite vs réglementation EU/FR

**Recommandations**
1. Implémenter API suppression de compte (DPIA + soft delete)
2. Créer export RGPD complet (CSV/JSON)
3. Ajouter consentement cookies (Usercentrics/OneTrust)
4. Data retention policy dans privacy.html
5. **Si caisse** : engager audit NF525 (Cabinet Taltech, Gesquis)
6. Ajouter signature numérique HACCP (API caID/eIDAS)
7. Documenter archivage inviolable 6 ans (audit trail à la DB level)
8. Validation légale avec cabinet spécialisé

---

## 7. INTERNATIONALIZATION — Score : 1/5

### État actuel
- ❌ **Aucune i18n implémentée** (i18next, fluent, intl.js absent)
- ✅ **Interface 100% français** hardcodé
- ✅ Dates au format FR (.toLocaleDateString('fr-FR'))
- ✅ Devise EUR (€) en affichage
- ❌ Aucun support anglais/espagnol/allemand
- ❌ Strings hardcodés dans JS/HTML (pas de .json de traduction)

### Exemples hardcodés
- "Essai gratuit 60 jours" (login.js)
- "Réservé au gérant" (API 403)
- Tous menus/boutons en français natif

### Risque international
- Bloquerait expansion UE (Allemagne, Italie, Belgique)
- Code difficile à refactorer pour multi-lang plus tard (interdépendances)

**Recommandations**
1. **Si français-only futur** : ajouter juste documentation i18n-friendly (exports strings constants)
2. **Si expansion UE** : implémenter i18next + JSON per language
   - Créer `/locales/fr.json`, `/locales/en.json`, etc.
   - Intégrer i18n middleware côté server (accept-language header)
3. Refactorer hardcoded strings → clés i18n
4. Format monétaire/date dépendant locale

---

## 8. ARCHITECTURE & MAINTENABILITÉ — Score : 3/5

### Structure actuelle
```
server/
  ├── index.js (206 lignes, express + rate limit + routes)
  ├── db.js (705 lignes, schema + 17 migrations)
  ├── backup.js (31 lignes)
  ├── routes/ (31 fichiers, 9,217 lignes total)
  │   ├── auth.js (357 lignes)
  │   ├── recipes.js (547 lignes, calcul coûts critiques)
  │   ├── ai.js (909 lignes, appels Gemini)
  │   ├── analytics.js (858 lignes)
  │   └── [28 autres...]
  ├── middleware/
  │   └── trial.js (77 lignes, logique trial)
  └── utils/ (utilitaires)

client/
  ├── index.html (SPA shell)
  ├── js/
  │   ├── app.js (356 lignes, bootstrap)
  │   ├── api.js (516 lignes, fetch wrapper)
  │   ├── router.js (114 lignes, SPA routes)
  │   ├── utils.js (72 lignes)
  │   └── views/ (14 fichiers, logique écrans)
  ├── css/style.css (~4,500 lignes)
  └── assets/, legal/, blog/
```

### Points forts architecturaux
- ✅ **Séparation clair** routes/middleware/db
- ✅ **Réutilisabilité** functions calcul coûts, formatage dates
- ✅ **Patterns Express standards** (route handlers, express.Router)
- ✅ **State management** localStorage + JWT (simple mais fragile)
- ✅ **PWA ready** (manifest.json, sw.js, installable)
- ✅ **Rate limiting** global + per-route (auth, IA)

### Faiblesses critiques
- ❌ **Pas de couche service** — logique métier mélangée aux routes
  - Exemple: calcRecipeCost() dans recipes.js, pas réutilisable
  - Difficulté à tester sans mocking DB
- ❌ **Pas de DI (dependency injection)** — couplage DB/routes serré
- ❌ **Client SPA vanille** → pas de framework (React/Vue), state fragile
  - Risque: localStorage corrompu = app cassée
  - Difficile collaborer (2+ devs sur même vue = conflits)
- ❌ **Routes monolithiques** — certains fichiers route >500 lignes
- ❌ **Pas de types TypeScript** — IDE intellisense limité, refactoring risqué
- ❌ **Hardcoded config** — JWT_SECRET, GEMINI_KEY en process.env

### Montée en charge
- **Actuellement** : Single instance Render, SQLite → OK pour 10-50 utilisateurs
- **50-200 users** : SQLite bottleneck, besoin PostgreSQL
- **200+ users** : Load balancer, API stateless, Redis session, CDN frontend
- **Architecturalement** : Express scalable, client SPA scalable, mais DB est goulot

### Courbe d'apprentissage 2-3 devs
- ✅ Stack simple (Express, vanilla JS) → facile onboarding
- ⚠️ Pas de framework = chacun invente son pattern (risque divergence)
- ⚠️ 9K lignes routes sans doc → besoin pair programming initial
- ⚠️ Pas de test = régressions invisibles lors refactoring

**Recommandations**
1. **Extraction services** (RecipeService, StockService, etc.)
2. **Dependency Injection container** (inversify ou simple DI)
3. **TypeScript** pour type-safety
4. **Client framework** (Lit.js pour PWA légère, ou Preact)
5. **Modulariser routes** (routes/recipes/index.js, routes/recipes/service.js)
6. **Doc interne** (architecture.md, design decisions)
7. **Pair programming onboarding** pour nouveau dev (2-3 jours)

---

## TABLEAU RÉCAPITULATIF

| Catégorie | Score | Justification |
|-----------|-------|---------------|
| **Déploiement & DevOps** | 2/5 | Render free OK, mais Dockerfile/CI-CD manquants, pas de secrets robustes, backup basique |
| **Testing** | 1/5 | Zéro test automatisé, architecture non testable actuellement |
| **Documentation** | 2/5 | RESTOSUITE.md bon, mais pas README, API Docs, ARCHITECTURE, JSDoc limité |
| **Monitoring & Logging** | 1/5 | Aucun service monitoring (Sentry), logs console perdus à reboot |
| **Intégrité données** | 3/5 | Transactions utilisées, validation input OK, backup basic, pas soft deletes |
| **RGPD & Compliance** | 2/5 | Privacy OK, mais pas suppression compte/export données, NF525 absent, pas consent |
| **Internationalization** | 1/5 | 100% français hardcodé, blockerait expansion UE |
| **Architecture & Maintenance** | 3/5 | Bien structurée mais monolithique, SPA vanille fragile, pas DI ni types |
| | | |
| **MATURITÉ GLOBALE** | **2/5** | **MVP vers BETA** |

---

## NIVEAUX DE MATURITÉ (1-5)

### 1 = Prototype
- Proof of concept, 1 dev, aucun test, unsafe data
- → **RestoSuite était ici en janvier 2026**

### 2 = MVP (Produit minimum viable)
- **← RestoSuite ICI (avril 2026)**
- Fonctionnalités core OK, pas de devops robuste, zéro test, compliance lacunaire
- Acceptable pour early adopters (10-20 utilisateurs), risqué pour production

### 3 = BETA (Produit viable)
- Nécessiterait : CI/CD + tests + monitoring + DB scalable + RGPD complet
- Estimation effort : 3-4 sprints (2 devs, 8-10 semaines)

### 4 = Production
- Enterprise readiness : HA/DR, compliance certifié, SLA 99.9%
- Estimation effort : +2-3 sprints post-BETA

### 5 = Enterprise
- Multi-tenancy, compliance multi-pays, certifications NF525/ISO

---

## VERDICT FINAL

**RestoSuite = MVP AMBITIEUX mais FRAGILE**

### Prêt pour
- ✅ Closed alpha (10-20 restaurateurs beta-testeurs)
- ✅ Démo live aux prospects
- ✅ Collecte feedback produit

### PAS prêt pour
- ❌ Lancement public (Product Hunt, etc.)
- ❌ Clients payants en production
- ❌ SLA garantis (disponibilité, support)
- ❌ Respect légal France (RGPD strict, NF525)

### Action urgente (avant lancement) : 2-3 semaines
1. **Dockerfile + push Docker Hub** (déploiement standardisé)
2. **GitHub Actions CI** (lint, tests basiques)
3. **Sentry integration** (error monitoring 5 min)
4. **RGPD API** : endpoint suppression compte + export data (1 jour)
5. **README.md** (quickstart, setup local)
6. **Password random JWT_SECRET** production

### Feuille de route post-MVP (2-3 mois)
- Mois 1 : Tests (40-50% coverage), TypeScript, monitoring
- Mois 2 : PostgreSQL migration, multi-site réel, DI refactoring
- Mois 3 : Compliance audit (RGPD, NF525 si caisse), onboarding 1er client payant

---

## FICHIERS CLÉS À CONSULTER

**Deployment**: `/sessions/modest-cool-mendel/mnt/restosuite/server/index.js` (206L)
**Database**: `/sessions/modest-cool-mendel/mnt/restosuite/server/db.js` (705L)
**Critical logic**: `/sessions/modest-cool-mendel/mnt/restosuite/server/routes/recipes.js` (547L)
**Documentation**: `/sessions/modest-cool-mendel/mnt/restosuite/RESTOSUITE.md` (master doc)
**RGPD**: `/sessions/modest-cool-mendel/mnt/restosuite/client/legal/privacy.html`

---

**Audit réalisé par : Claude (LLM)**
**Modèle : claude-haiku-4.5**
**Date : 6 avril 2026**
