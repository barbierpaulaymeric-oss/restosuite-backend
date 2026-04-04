# RESTOSUITE AI — Document Maître

_Dernière mise à jour : 4 avril 2026_

---

## 1. Vision

**RestoSuite AI** — Le premier assistant cuisine propulsé par l'IA.
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
| Base de données | SQLite (better-sqlite3) |
| IA | Google Gemini 2.5 Flash |
| Paiement | Stripe |
| PDF | pdfkit |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Hébergement | Render (free tier + keep-alive ping) |
| Frontend | SPA vanilla JS |
| PWA | Service Worker + manifest.json |
| QR Codes | qrcode (npm) |
| Upload | multer |

**Coût mensuel : 0€** (Render free + Gemini quota gratuit)
**Marge nette estimée : ~95%**

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
- **Auth** — inscription email/mdp, JWT 30 jours, login PIN rapide pour équipiers
- **Onboarding** — wizard 7 étapes (profil, restaurant, salle, équipe, frigos, fournisseurs, première fiche)
- **Fiches techniques** — recettes avec ingrédients, sous-recettes imbriquées, food cost cascade
- **49 ingrédients seed** — prix marché France 2026
- **Saisie vocale IA** — dicter une recette → fiche technique complète
- **Gestion des stocks** — dashboard, réception, mouvements, alertes stock bas
- **Commandes** — prise de commande par table, envoi cuisine, déduction stock automatique
- **Interface salle** — login PIN, grille tables, prise de commande simplifiée
- **HACCP** — températures, nettoyage, traçabilité, alertes DLC, export PDF
- **Suivi de lot** — bon de livraison fournisseur → réception → traçabilité lot → stock
- **Portail fournisseur** — auth token, catalogue, notifications prix, bons de livraison
- **Scan facture IA** — photo → extraction produits/prix/lots via Gemini Vision
- **Mercuriale** — suivi prix fournisseurs, alertes variation >10%, graphique SVG
- **Suggestions menu IA** — plats rentables, plats à améliorer, suggestion du jour
- **QR code commande** — page menu publique, commande client → validation serveur
- **PWA** — installable iPhone/Android, icône écran d'accueil, cache offline
- **Landing page** — site vitrine avec SEO, structured data, vidéo démo
- **Blog SEO** — 3 articles (food cost, HACCP, stock)
- **Light/dark mode**
- **Export PDF** — fiches techniques, HACCP (fonctionne même après expiration trial)
- **Import/Export CSV** — ingrédients
- **Auto-save** — brouillon recettes (localStorage)
- **Rate limiting** — 200/15min global, 30/h IA, 20/15min auth
- **Backup DB** — automatique toutes les 6h + au démarrage
- **Keep-alive** — ping toutes les 14 min (plus de cold start Render)
- **Alertes proactives** — DLC, stock bas, températures hors seuil, livraisons en attente

### 🔜 À faire
- Vidéo démo professionnelle (en cours)
- Tests end-to-end complets
- Emails transactionnels (J+1, J+15, J+25, J+30)
- Multi-établissement réel (plan Business)
- Marketplace fournisseur + Stripe Connect
- Intégration POS/caisse
- API publique

---

## 5. Pricing

| Plan | Prix | Détails |
|------|------|---------|
| Essai gratuit | 0€ | 60 jours, accès complet |
| Pro | 39€/mois | 1 établissement, toutes fonctionnalités |
| Business | 79€/mois | Multi-sites, support prioritaire |
| Fondateur | 29€/mois à vie | 200 premiers clients |

**Après expiration trial :** mode lecture seule, export PDF toujours actif (obligation légale HACCP).

---

## 6. Identité Visuelle

- **Couleurs :** Orange `#E8722A` (accent), Dark `#0F1923` (fond), Texte `#F7F5F2`
- **Font :** Inter
- **Logo :** Couteau + bar chart + point orange (PNG transparent, versions outline)
- **Style :** Dark mode par défaut, light mode disponible

Détails complets dans `BRAND.md`.

---

## 7. Base de Données

### Tables principales
`restaurants`, `accounts`, `subscriptions`, `ingredients`, `suppliers`, `supplier_prices`, `recipes`, `recipe_ingredients`, `recipe_steps`, `stock`, `stock_movements`, `orders`, `order_items`, `tables`

### Tables HACCP
`temperature_zones`, `temperature_logs`, `cleaning_tasks`, `cleaning_logs`, `traceability_logs`

### Tables fournisseur
`supplier_accounts`, `supplier_catalog`, `price_change_notifications`, `delivery_notes`, `delivery_note_items`

### Tables système
`price_history`, `referrals` (inactif)

---

## 8. Routes API

### Auth
- `POST /api/auth/register` — inscription email/mdp
- `POST /api/auth/login` — connexion email/mdp
- `POST /api/auth/pin-login` — login rapide PIN
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

### Commandes
- `GET/POST /api/orders`
- `POST /api/orders/:id/send` — envoi cuisine + déduction stock

### HACCP
- `GET/POST /api/haccp/temperatures`
- `GET/POST /api/haccp/cleaning`
- `GET/POST /api/haccp/traceability`
- `GET /api/haccp/export/*` — exports PDF

### Livraisons
- `GET /api/deliveries` — liste bons
- `PUT /api/deliveries/:id/receive` — réception
- `GET /api/deliveries/dlc-alerts`

### Portail fournisseur (auth x-supplier-token)
- `POST /api/supplier-portal/delivery-notes`
- `GET /api/supplier-portal/delivery-notes`

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

## 12. Git Commits (chronologique récent)

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
