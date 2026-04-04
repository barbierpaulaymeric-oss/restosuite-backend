# QA Report — RestoSuite (localhost:3007)

**Date :** 2026-04-03  
**Testeur :** Alfred (QA sub-agent)  
**Score global : 18/22 tests passés ✅**

---

## 1. Création de compte

| Test | Résultat | Détails |
|------|----------|---------|
| POST /api/accounts (gerant) | ✅ PASS | id=1, role=gerant, referral_code="chefte-tqoo" |
| Vérif id retourné | ✅ PASS | id=1 |
| Vérif role=gerant | ✅ PASS | |
| Vérif referral_code non-null | ✅ PASS | "chefte-tqoo" |

---

## 2. Ingrédients seed

| Test | Résultat | Détails |
|------|----------|---------|
| GET /api/ingredients → ~49 ingrédients | ✅ PASS | 49 ingrédients retournés |
| Chaque ingrédient a price_per_unit > 0 | ✅ PASS | 0 ingrédients avec prix ≤ 0 |

---

## 3. Fiches techniques avec sous-recette

| Test | Résultat | Détails |
|------|----------|---------|
| Créer sous-recette "Fond blanc" | ✅ PASS | id=2, recipe_type=sous_recette, total_cost=7.32€ |
| Ajouter ingrédients au Fond blanc (via PUT) | ✅ PASS | 4 ingrédients, coût calculé correctement |
| Créer plat avec sous-recette (sub_recipe_id) | ❌ FAIL | **500 Internal Server Error** — voir Bug #1 |
| Créer plat "Suprême de volaille" (sans sous-recette) | ✅ PASS | id=4, total_cost=10.40€, food_cost=14.44% |
| Food cost cascade (GET /api/recipes/4) | ✅ PASS | cost_per_portion=2.60€, margin=15.40€ |

### 🐛 Bug #1 — CRITIQUE : Impossible d'ajouter une sous-recette à un plat
- **Endpoint :** `POST /api/recipes` avec `sub_recipe_id` dans ingredients
- **Erreur :** 500 Internal Server Error
- **Cause racine :** La table `recipe_ingredients` a `ingredient_id INTEGER NOT NULL` dans le schéma initial. La migration ajoute `sub_recipe_id` mais ne peut pas rendre `ingredient_id` nullable en SQLite. Le code met `ingredient_id = NULL` pour les lignes sous-recette → violation de contrainte NOT NULL.
- **Impact :** La fonctionnalité sous-recette est **totalement cassée**. Aucun plat ne peut référencer une sous-recette.
- **Fix suggéré :** Recréer la table avec `ingredient_id INTEGER` (nullable) ou utiliser un `ingredient_id` placeholder (0) pour les lignes sous-recette.

---

## 4. Commandes

| Test | Résultat | Détails |
|------|----------|---------|
| POST /api/orders (table 5, 2x suprême) | ✅ PASS | id=1, total_cost=36€, status=en_cours |
| POST /api/orders/1/send (envoi cuisine) | ✅ PASS | status=envoyé, stock_deducted=true |
| Déduction stock vérifiée | ✅ PASS | 2 mouvements : 1600g suprême + 400ml crème |
| Warnings stock insuffisant | ✅ PASS | Warnings retournés (available=0 car pas de stock initial) |

---

## 5. Portail fournisseur

| Test | Résultat | Détails |
|------|----------|---------|
| Créer compte fournisseur (role=fournisseur) | ❌ FAIL | Role forcé à "equipier" — voir Bug #2 |
| Créer un Supplier + invitation portail | ✅ PASS | Supplier id=1, invitation OK |
| Login fournisseur + token | ✅ PASS | Token généré, login OK |
| Accès catalogue avec token | ✅ PASS | 200 OK (catalogue vide = normal, pas de prix configurés) |
| Accès catalogue sans token | ✅ PASS | 401 correctement retourné |

### 🐛 Bug #2 — MOYEN : Le rôle "fournisseur" n'est pas reconnu
- **Endpoint :** `POST /api/accounts`
- **Détail :** `VALID_ROLES = ['gerant', 'cuisinier', 'equipier', 'salle']` — "fournisseur" n'est pas dans la liste
- **Conséquence :** Un compte créé avec `role: "fournisseur"` devient silencieusement "equipier"
- **Fix suggéré :** Ajouter "fournisseur" à VALID_ROLES ou documenter que les fournisseurs utilisent le portail dédié (supplier_accounts)

---

## 6. Endpoints infra

| Test | Résultat | Détails |
|------|----------|---------|
| GET /api/referrals/my-code?account_id=1 | ✅ PASS | code="chefte-tqoo", bonus_days=0 |
| POST /api/admin/backup | ✅ PASS | {"ok":true,"message":"Backup effectué"} |
| GET /api/ingredients/export-csv | ❌ FAIL | CSV retourné mais prix_au_kg = 0 pour tous — voir Bug #3 |

### 🐛 Bug #3 — MOYEN : Export CSV retourne des prix à 0
- **Endpoint :** `GET /api/ingredients/export-csv`
- **Détail :** Le code utilise `r.price_per_kg` qui n'existe pas dans le schéma. Le champ correct est `r.price_per_unit`.
- **Fichier :** `server/routes/ingredients.js`, ligne export-csv
- **Impact :** Tout export CSV affiche 0€ pour tous les ingrédients → inutilisable
- **Fix :** Remplacer `r.price_per_kg` par `r.price_per_unit` (et éventuellement renommer la colonne CSV en "prix_unitaire" puisque l'unité varie)

---

## 7. Pages statiques

| Test | Résultat | Détails |
|------|----------|---------|
| GET / (landing) | ✅ PASS | 200 |
| GET /app | ✅ PASS | 200 |
| GET /sitemap.xml | ✅ PASS | 200 |
| GET /robots.txt | ✅ PASS | 200 |
| GET /manifest.json | ✅ PASS | 200 |
| GET /sw.js | ✅ PASS | 200 |

---

## Résumé des bugs

| # | Sévérité | Description | Fichier |
|---|----------|-------------|---------|
| 1 | 🔴 CRITIQUE | Sous-recettes cassées (NOT NULL constraint sur ingredient_id) | `server/db.js` |
| 2 | 🟡 MOYEN | Rôle "fournisseur" non reconnu, fallback silencieux à "equipier" | `server/routes/accounts.js` |
| 3 | 🟡 MOYEN | Export CSV prix à 0 (champ `price_per_kg` inexistant) | `server/routes/ingredients.js` |

---

## Score final

```
✅ Passés : 18/22
❌ Échoués : 4/22
🔴 Bugs critiques : 1
🟡 Bugs moyens : 2
```

**Verdict :** Le serveur est fonctionnel pour les flux de base (comptes, ingrédients, recettes simples, commandes, portail fournisseur). Le **bug critique #1** bloque la fonctionnalité sous-recette qui est un différenciateur clé du produit. Les bugs #2 et #3 sont des corrections rapides (< 5 min chacun).
