# RestoSuite AI — Business Review

**Date :** 2 avril 2026  
**Auteur :** Consultant business senior — SaaS B2B, FoodTech, stratégie de lancement  
**Statut :** Pré-lancement  
**Verdict global :** Projet à potentiel réel, mais lancement prématuré en l'état. 4-8 semaines de travail critique avant mise en marché.

---

## Table des matières

1. [Positionnement marché](#1-positionnement-marché)
2. [Modèle économique](#2-modèle-économique)
3. [Projections de revenus](#3-projections-de-revenus)
4. [Chances de succès](#4-chances-de-succès)
5. [Go-to-market](#5-go-to-market)
6. [Roadmap business](#6-roadmap-business)
7. [Recommandations stratégiques](#7-recommandations-stratégiques)

---

## 1. Positionnement marché

### 1.1 Analyse concurrentielle détaillée

| Concurrent | Cible | Prix entrée | Forces | Faiblesses vs RestoSuite |
|---|---|---|---|---|
| **Koust** | Indépendants + chaînes | 80€/mois | Fiches techniques matures, menu engineering, scan factures | HACCP en add-on (+38€), pas d'IA vocale, interface datée, prix 2× plus élevé |
| **Melba** | Mid-market premium | 49€/module (cumul ~147€) | Interface moderne, modulaire, IA scan | Coût cumulé x3-4, crédits IA payants, pas de vocal |
| **Inpulse** | Chaînes 5-300 sites | ~150-300€/mois (devis) | IA prédictive best-in-class | Hors budget indépendants, pas de HACCP, pas de fiches simples |
| **ePackPro** | Tous métiers de bouche | ~50-150€/mois | Spécialiste HACCP n°1, sondes IoT | Pas de fiches techniques, pas de food cost, interface datée |
| **Traqfood** | Budget HACCP | 20-45€/mois | Prix imbattable, 23 modules HACCP | HACCP only — pas de fiches techniques, pas de food cost |
| **Yokitup** | Chaînes moyennes | ~100-150€ (devis) | App mobile native, support dédié | Prix opaque, pas de HACCP, orienté chaînes |

**Constat clé :** Le marché est fragmenté. Aucun acteur ne combine fiches techniques + HACCP + IA vocale à moins de 50€/mois. C'est le créneau de RestoSuite.

### 1.2 USP réelle vs perçue

| USP perçue (landing page) | USP réelle (audit produit) | Écart |
|---|---|---|
| "Fiches techniques en 30 secondes" | IA vocale présente mais non démontrable (pas de vidéo) | Moyen — le claim est crédible mais non prouvé |
| "Food cost en temps réel" | Food cost affiche 0€ partout — les prix ingrédients ne sont pas alimentés | **Critique — le cœur de la promesse est cassé** |
| "HACCP complet" | Module solide : températures, nettoyage, traçabilité, dashboard | OK — c'est réel |
| "Tout-en-un à 39€" | Fiches + HACCP = oui. Stock = basique. Commandes = bientôt. Fournisseurs = fiche contact. | Moyen — "tout-en-un" est un stretch |
| "Pensé par un chef" | Fondateur cuisinier pro — authenticité réelle | **Fort — c'est un vrai différenciant** |

**Verdict USP :** L'USP **perçue** est excellente. L'USP **réelle** est incomplète. Le food cost cassé est le problème #1 — c'est comme vendre une voiture sans moteur.

### 1.3 Barrières à l'entrée

**Barrières POUR RestoSuite (avantages) :**
- Stack technique légère (Node.js + SQLite + Gemini) = itération rapide
- Solo-founder cuisinier = crédibilité métier que les concurrents tech n'ont pas
- Prix disruptif (39€ vs 80-150€ marché) = barrière d'entrée basse pour les clients
- IA vocale = feature unique, difficile à copier rapidement (prompt engineering métier)

**Barrières CONTRE RestoSuite (risques) :**
- Notoriété = zéro. Koust/Melba ont des années d'avance en SEO et réputation
- Pas de levée de fonds = pas de force commerciale (salons, outbound, ads)
- SQLite + Render free tier = limites de scaling (pas de concurrence pour l'instant, mais ça viendra)
- Solo-founder = bus factor 1, risque d'épuisement
- Pas d'app mobile native (Melba et Yokitup en ont une)

### 1.4 Taille du marché adressable (France)

| Métrique | Estimation | Méthode |
|---|---|---|
| **TAM** (Total Addressable Market) | **179 000 établissements × ~50€/mois moyen = ~107M€ ARR** | Tous restaurants France × ARPU moyen marché |
| **SAM** (Serviceable Addressable Market) | **~100 000 établissements = ~47M€ ARR** | Restauration traditionnelle + brasseries + dark kitchens (ceux qui ont besoin de fiches techniques + HACCP) |
| **SOM** (Serviceable Obtainable Market) à 3 ans | **~1 000-3 000 établissements = ~470K-1.4M€ ARR** | 1-3% de pénétration réaliste pour un bootstrappé, taux de conversion et churn appliqués |

**Commentaire :** Le SAM de ~47M€ est largement suffisant pour un bootstrappé. Même 0.5% = 235K€ ARR, ce qui est viable pour un solo-founder. Le marché n'est **pas** le problème. L'exécution l'est.

---

## 2. Modèle économique

### 2.1 Évaluation du pricing (39€/79€)

**Le prix de 39€/mois est bien calibré.** Voici pourquoi :

| Critère | Évaluation |
|---|---|
| **vs Koust (80€)** | 51% moins cher pour un périmètre comparable (hors stock avancé) |
| **vs Melba cumulé (147€)** | 73% moins cher pour fiches + HACCP |
| **vs Traqfood (20€)** | 2× plus cher mais scope 3× plus large (fiches + food cost + HACCP) |
| **vs budget indépendant (30-80€/mois total SaaS)** | Dans la fourchette haute pour un petit, basse pour un moyen |
| **Willingness-to-pay estimée** | 29-69€/mois pour la cible primaire — 39€ est pile dedans |

**Le plan Business à 79€/mois** est encore flou. Il annonce multi-établissements, analytics avancés, API — mais ces features ne sont pas livrées. Le risque est de vendre un plan Business vide.

**Recommandation :** Garder 39€ pour le Pro. Reporter le plan Business quand les features associées seront réellement disponibles. Mieux vaut un seul plan solide que deux plans dont un est de la poudre aux yeux.

### 2.2 Pertinence du trial 60 jours

**Les 60 jours sont trop longs.** Analyse :

| Argument | Pour | Contre |
|---|---|---|
| Temps d'adoption restaurateur | Un chef a besoin de temps (formation équipe, saisie initiale) | 60 jours = assez pour créer toutes ses fiches, exporter les PDF, et ne jamais payer |
| Benchmarks SaaS B2B | — | 14 jours (standard), 30 jours (long). 60 jours n'existe presque nulle part |
| Conversion après trial long | Taux de conversion plus bas (urgency diluted) | L'utilisateur oublie qu'il est en trial |
| Lecture seule après expiration | Bonne idée — données pas perdues | Faible trigger de reconversion (un resto avec 20 fiches figées peut vivre sans modifier pendant des mois) |

**Recommandation :** Passer à **30 jours d'essai gratuit** avec accès complet, puis lecture seule. 30 jours est suffisant pour un restaurateur motivé. Si 60 jours est un choix de conviction, ajouter un mécanisme de conversion :
- **J15 :** Email "Vous avez créé X fiches, votre food cost moyen est Y% — passez en Pro pour continuer à optimiser"
- **J25 :** Email "5 jours restants — vos données resteront accessibles en lecture seule"
- **J30 :** Conversion ou verrouillage

### 2.3 LTV/CAC projections

| Métrique | Estimation | Hypothèses |
|---|---|---|
| **ARPU** | ~42€/mois | Mix 80% Pro (39€) + 15% Early Adopter (29€) + 5% Business (79€) |
| **Churn mensuel estimé** | 5-8% | Standard SaaS B2B PME bootstrappé, année 1 |
| **Lifetime moyenne** | 12-20 mois | 1/churn = 12.5-20 mois |
| **LTV** | **504-840€** | ARPU × lifetime |
| **CAC organique** | ~0-20€ | SEO, bouche-à-oreille, réseaux sociaux (pas d'ads) |
| **CAC outbound** | ~100-300€ | Si démarchage terrain, salons (coût temps fondateur) |
| **Ratio LTV/CAC** | **2.5-8×** (organique) / **1.7-8×** (outbound) | >3× est sain pour un SaaS B2B |

**Commentaire :** Le ratio LTV/CAC est potentiellement très bon grâce au budget acquisition ~0€. Le danger est que le CAC "invisible" (temps du fondateur) n'est pas comptabilisé. Un solo-founder qui passe 20h/semaine en acquisition, c'est un coût d'opportunité réel.

### 2.4 Risques du modèle freemium

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Free-riding massif (usage gratuit sans jamais payer) | Élevée | Moyen | Limiter le plan gratuit : 5 fiches, pas d'IA vocale, pas d'export PDF |
| Coûts serveur Gemini AI non contrôlés | Moyenne | Élevé | Rate limiting strict, cache des insights, crédits AI limités en trial |
| Support gratuits chronophage | Élevée | Élevé pour un solo-founder | Self-service max, FAQ, chatbot, communauté |
| Perception "cheap" du prix bas | Faible | Moyen | Le pricing est dans la norme basse, pas absurdement bas |

**La stratégie actuelle (60j gratuit avec TOUT) est trop généreuse.** Un utilisateur peut extraire 100% de la valeur sans jamais payer :
1. S'inscrire
2. Créer toutes ses fiches techniques (30min)
3. Exporter en PDF
4. Ne jamais revenir

**Fix recommandé :** Plan Découverte permanent (5 fiches, HACCP basique, pas de vocale, PDF watermarké) + Trial Pro 30 jours.

### 2.5 Early Adopter strategy (29€ à vie pour 200 premiers)

**C'est une bonne idée avec un défaut majeur.**

✅ **Ce qui marche :**
- Crée de l'urgence (200 places limitées)
- Fidélise les premiers utilisateurs (ils ne churneront jamais à 29€/mois)
- Source de témoignages et feedback
- 29€ × 200 = 5 800€ MRR garanti si tous convertissent

❌ **Le défaut :**
- "À vie" est dangereux juridiquement et économiquement
- Si le produit évolue vers un coût serveur plus élevé (plus d'IA, plus de stockage), ces 200 clients à 29€ deviennent des passifs
- "À vie" signifie tant que l'entreprise existe — et les early adopters le savent

**Recommandation :** Reformuler en **"29€/mois pendant 24 mois garantis"** ou **"29€/mois tant que l'abonnement reste actif, sans interruption"** (ce qui est déjà le cas dans les CGV). Éviter le terme "à vie" — utiliser "tarif fondateur garanti".

---

## 3. Projections de revenus

### Hypothèses communes

| Paramètre | Valeur |
|---|---|
| ARPU Pro | 39€/mois |
| ARPU Early Adopter | 29€/mois |
| ARPU Business | 79€/mois |
| Mix estimé | 70% Pro / 20% Early Adopter / 10% Business |
| ARPU blended | ~38€/mois |
| Churn mensuel Y1 | 7% |
| Churn mensuel Y2 | 5% |
| Churn mensuel Y3 | 3.5% |
| Coûts fixes mensuels | ~50€ (domaine + Render payant éventuel + Gemini API) |
| Coûts variables | ~1-2€/client/mois (IA, stockage) |

### 3.1 Scénario Pessimiste

**Hypothèse :** Acquisition organique uniquement (SEO, contenu), faible conversion, fondateur à mi-temps sur l'acquisition.

| Métrique | M6 | M12 | M24 | M36 |
|---|---|---|---|---|
| Inscrits cumulés (gratuits) | 80 | 200 | 500 | 900 |
| Taux de conversion trial→payant | 6% | 7% | 8% | 8% |
| **Clients payants actifs** | **5** | **12** | **28** | **45** |
| Churn mensuel effectif | 8% | 7% | 6% | 5% |
| **MRR** | **190€** | **456€** | **1 064€** | **1 710€** |
| **ARR** | **2 280€** | **5 472€** | **12 768€** | **20 520€** |
| Break-even | ❌ | ❌ | ❌ (sauf coûts quasi-nuls) | ❌ en rémunération fondateur |

**Commentaire :** Le scénario pessimiste ne génère pas assez de revenus pour en vivre. À 1 710€ MRR après 3 ans, c'est un side-project, pas un business. **Ce scénario arrive si le produit est lancé sans fixer le food cost et sans stratégie d'acquisition minimale.**

### 3.2 Scénario Réaliste

**Hypothèse :** Mix organique + outbound ciblé (démarchage LinkedIn, groupes Facebook CHR, partenariats écoles), fondateur à plein temps, produit corrigé (food cost fonctionnel, vidéo démo).

| Métrique | M6 | M12 | M24 | M36 |
|---|---|---|---|---|
| Inscrits cumulés | 250 | 800 | 2 500 | 5 000 |
| Taux de conversion | 8% | 10% | 12% | 13% |
| **Clients payants actifs** | **18** | **65** | **200** | **380** |
| Churn mensuel effectif | 7% | 6% | 5% | 4% |
| **MRR** | **684€** | **2 470€** | **7 600€** | **14 440€** |
| **ARR** | **8 208€** | **29 640€** | **91 200€** | **173 280€** |
| Break-even (coûts serveur) | ✅ M4 | ✅ | ✅ | ✅ |
| Break-even (SMIC fondateur) | ❌ | ❌ | ✅ ~M18 | ✅ |

**Commentaire :** Le scénario réaliste atteint le SMIC (~1 400€ net) vers M18-20. C'est serré mais viable pour un solo-founder bootstrappé qui vit frugalement. L'ARR dépasse 100K€ vers M26-28.

### 3.3 Scénario Optimiste

**Hypothèse :** Forte traction bouche-à-oreille, article presse spécialisée (L'Hôtellerie Restauration, Néo-Resto), partenariat école hôtelière, référencement France Num, la saisie vocale crée un effet "wow" viral.

| Métrique | M6 | M12 | M24 | M36 |
|---|---|---|---|---|
| Inscrits cumulés | 600 | 2 000 | 6 000 | 12 000 |
| Taux de conversion | 10% | 12% | 14% | 15% |
| **Clients payants actifs** | **50** | **180** | **550** | **1 100** |
| Churn mensuel effectif | 6% | 5% | 4% | 3% |
| **MRR** | **1 900€** | **6 840€** | **20 900€** | **41 800€** |
| **ARR** | **22 800€** | **82 080€** | **250 800€** | **501 600€** |
| Break-even (SMIC) | ✅ ~M9 | ✅ | ✅ | ✅ |
| Embauche possible | ❌ | ✅ M11-12 | ✅ | ✅ |

**Commentaire :** Le scénario optimiste est atteignable mais nécessite plusieurs catalyseurs simultanés (presse, viralité, partenariats). À 500K€ ARR en Y3, RestoSuite devient un vrai SaaS B2B avec possibilité d'embaucher 2-3 personnes.

### 3.4 Synthèse des scénarios

```
ARR à 36 mois :

Pessimiste  ████░░░░░░░░░░░░░░░░░░░░░░░░░░  ~20K€  (side-project)
Réaliste    ██████████████████░░░░░░░░░░░░░░  ~173K€ (viable solo-founder)
Optimiste   ██████████████████████████████████  ~500K€ (scale-up possible)
```

---

## 4. Chances de succès

### 4.1 Score de probabilité : **42/100**

**Décomposition :**

| Facteur | Poids | Score /10 | Pondéré |
|---|---|---|---|
| Product-Market Fit potentiel | 25% | 7/10 | 1.75 |
| Qualité produit actuel | 20% | 5/10 | 1.00 |
| Compétence fondateur (métier) | 15% | 8/10 | 1.20 |
| Compétence fondateur (tech/business) | 15% | 5/10 | 0.75 |
| Ressources (budget, équipe) | 10% | 2/10 | 0.20 |
| Timing marché | 10% | 7/10 | 0.70 |
| Stratégie GTM | 5% | 3/10 | 0.15 |
| **Total** | **100%** | — | **4.2/10 → 42/100** |

**Interprétation :** 42/100 est **en-dessous de la moyenne** mais pas rédhibitoire. Le produit a du potentiel (bon PMF, bon timing), mais les fondamentaux business sont encore faibles (pas de GTM, produit pas vendable, ressources quasi-nulles).

### 4.2 Facteurs de risque majeurs (Top 5)

| # | Risque | Probabilité | Impact | Détail |
|---|---|---|---|---|
| 1 | **Produit lancé trop tôt (food cost cassé)** | Haute | Fatal | Si les premiers utilisateurs voient 0€ partout, ils ne reviennent jamais. Première impression = dernière impression en SaaS. |
| 2 | **Épuisement du solo-founder** | Haute | Fatal | Coder, vendre, supporter, acquérir, gérer — tout seul, à 0€. Le burnout est le killer #1 des bootstrappés. |
| 3 | **Acquisition trop lente** | Haute | Élevé | Sans budget ni équipe commerciale, atteindre 100 clients peut prendre 12-18 mois. La motivation s'érode avant le break-even. |
| 4 | **Concurrent qui copie la saisie vocale** | Moyenne | Élevé | Koust ou Melba peuvent ajouter la saisie vocale en 3-6 mois. Le moat technologique est faible. |
| 5 | **Dépendance Gemini (coûts + disponibilité)** | Moyenne | Moyen | Si Google change les prix de Gemini ou dégrade le service, le différenciant IA est compromis. |

### 4.3 Facteurs de succès majeurs (Top 5)

| # | Facteur | Probabilité | Impact | Détail |
|---|---|---|---|---|
| 1 | **Fondateur cuisinier = crédibilité unique** | Certaine | Élevé | Aucun concurrent n'a un chef dans l'équipe fondatrice. Ça se voit dans les choix produit (pertes, sous-recettes, terminologie). C'est un moat humain. |
| 2 | **Saisie vocale = effet "wow"** | Haute | Élevé | Si bien exécutée et démontrée (vidéo), c'est LE feature qui fait parler. Les chefs montrent à d'autres chefs. |
| 3 | **Prix disruptif** | Certaine | Élevé | 39€ vs 80-150€ = argument massue pour les indépendants budget-contraints. |
| 4 | **HACCP intégré sans surcoût** | Certaine | Moyen | Koust facture 38€ de plus. Melba 49€ de plus. RestoSuite l'inclut. Ça simplifie le pitch. |
| 5 | **Timing marché : digitalisation CHR** | Haute | Moyen | 80% des restaurateurs n'ont pas fini leur transition digitale. Le marché est en expansion, pas saturé. |

### 4.4 Comparaison avec les taux de survie SaaS B2B bootstrappé

| Benchmark | Taux | Source |
|---|---|---|
| Startups qui atteignent 10K€ MRR | ~30% des lancées | MicroConf, Baremetrics |
| SaaS bootstrappés survivant à 3 ans | ~40% | Indie Hackers surveys |
| SaaS bootstrappés atteignant 100K€ ARR | ~15% | Estimated from public data |
| SaaS B2B niche avec PMF clair | ~50-60% de survie à 3 ans | Nathan Latka, SaaS metrics |

**RestoSuite a un PMF clair** (les restaurateurs ont besoin de cet outil, à ce prix). Le principal risque est l'exécution, pas le marché.

**Probabilité de survie à 3 ans : ~35-45%.** C'est au-dessus de la moyenne des startups (20%) mais en-dessous d'un SaaS avec une équipe de 2-3 personnes et un budget minimal (~50-60%).

---

## 5. Go-to-market

### 5.1 Canaux d'acquisition recommandés (budget ~0€)

| Canal | Coût | Effort | Impact estimé | Priorité |
|---|---|---|---|---|
| **SEO / Content Marketing** | 0€ | Élevé (temps) | Fort à M6+ | 🔴 P0 |
| **Groupes Facebook CHR** | 0€ | Moyen | Moyen immédiat | 🔴 P0 |
| **LinkedIn (profil fondateur)** | 0€ | Moyen | Moyen | 🟠 P1 |
| **YouTube (démos vocales)** | 0€ | Moyen | Fort (SEO vidéo) | 🔴 P0 |
| **Programme de parrainage** | ~0€ (1 mois offert) | Faible | Moyen à fort | 🟠 P1 |
| **Partenariats écoles hôtelières** | 0€ | Moyen | Fort à M6+ | 🟠 P1 |
| **Product Hunt / Indie Hackers** | 0€ | Faible | Faible (cible non-restaurateurs) | 🟡 P2 |
| **France Num / chèques numériques** | 0€ | Élevé (dossier admin) | Fort (rembourse l'abonnement) | 🟠 P1 |
| **Salons (EquipHotel, Sirha)** | 100-500€ (visiteur) | Élevé | Fort (contacts directs) | 🟡 P2 (quand MRR > 2K€) |
| **TikTok/Instagram Reels** | 0€ | Moyen | Potentiellement viral | 🟠 P1 |

#### Détail des canaux prioritaires

**SEO (P0) — Articles à écrire en priorité :**
1. "Comment calculer le food cost d'un restaurant" (mot-clé : food cost restaurant)
2. "Modèle fiche technique cuisine gratuit Excel" (capturer le trafic Excel → convertir en outil)
3. "HACCP restaurant : guide complet 2026" (mot-clé : HACCP restaurant)
4. "Comment fixer ses prix de vente en restauration" (calcul marge restaurant)
5. "Gestion des stocks restaurant : méthodes et outils" (stock restaurant)

**YouTube (P0) — Vidéos à faire :**
1. "Je dicte ma recette, l'IA crée ma fiche technique en 30 secondes" — démo vocale pure (le money shot)
2. "Food cost : comment je suis passé de 38% à 28%" — contenu éducatif avec le produit en filigrane
3. "Mon setup HACCP digital à 39€/mois" — montrer le module complet

**Groupes Facebook (P0) :**
- "Chefs et restaurateurs de France" (~50K membres)
- "Restaurateurs indépendants" (~20K)
- "Gestion de restaurant" (~15K)
- **Approche :** Ne pas spammer. Publier du contenu utile (templates, conseils food cost), puis mentionner RestoSuite naturellement. Le fondateur cuisinier a la crédibilité pour ça.

### 5.2 Timeline de lancement idéale

```
SEMAINE 1-2 : FIX CRITIQUE
├── Fixer le food cost (prix ingrédients → calcul automatique)
├── Date pickers en format français
├── Retirer les témoignages "Exemple"
├── Enregistrer 1 vidéo démo (saisie vocale, 60 sec)
└── Corriger le modal fournisseur persistent

SEMAINE 3-4 : PRÉPARATION LANCEMENT
├── Intégrer Stripe (plan Pro 39€ + annuel 31€)
├── Obtenir le SIRET (si pas déjà fait)
├── Créer 5 articles SEO (drafts)
├── Publier la vidéo démo sur la landing page
├── Empty states + message de bienvenue
└── Bouton "Exporter mes données" (RGPD)

SEMAINE 5-6 : BETA PRIVÉE
├── Recruter 10-15 restaurateurs beta (réseau perso, groupes FB)
├── Collecter les retours quotidiennement
├── Fixer les bugs remontés
├── Obtenir 3-5 vrais témoignages
└── Itérer sur le pricing si feedback négatif

SEMAINE 7-8 : LANCEMENT SOFT
├── Publier les vrais témoignages
├── Activer le programme Early Adopter (200 places à 29€)
├── Poster dans 3-5 groupes Facebook
├── Publier les articles SEO
├── Lancer la chaîne YouTube (2-3 vidéos)
└── Annoncer sur LinkedIn (profil personnel)

MOIS 3-6 : ACCÉLÉRATION
├── SEO commence à porter ses fruits
├── Programme parrainage actif
├── Démarchage écoles hôtelières
├── Dossier France Num / chèques numériques
├── Première itération stock avancé
└── Objectif : 50-80 clients payants
```

### 5.3 Quick wins pour les 30 premiers jours

| Action | Effort | Impact | Détail |
|---|---|---|---|
| **1. Vidéo démo 60 sec** | 2h | ×2 conversion landing | Montrer la saisie vocale en action. C'est le USP — il FAUT le montrer. |
| **2. 3 posts dans groupes FB** | 1h | 5-10 signups | Contenu utile + mention RestoSuite. Pas de spam. |
| **3. Profil LinkedIn fondateur** | 2h | 3-5 signups | "Cuisinier pro qui code un outil pour les chefs" — story forte. |
| **4. 1 article SEO "food cost restaurant"** | 4h | Trafic organique M3+ | Long-tail SEO, contenu evergreen. |
| **5. Programme parrainage "1 mois offert"** | 1h | ×1.3 growth organique | Chaque client satisfait recrute. |

### 5.4 Stratégie pour atteindre 100 clients

| Phase | Période | Clients accumulés | Canal principal |
|---|---|---|---|
| **Réseau perso + beta** | M0-M2 | 10-15 | Bouche-à-oreille, réseau cuisinier du fondateur |
| **Groupes FB + LinkedIn** | M2-M4 | 30-40 | Communautés en ligne, contenu |
| **SEO + YouTube** | M4-M8 | 60-80 | Trafic organique qui monte |
| **Parrainage + écoles** | M8-M12 | 100+ | Viralité + partenariats institutionnels |

**Estimation :** 100 clients payants entre M10 et M14 dans le scénario réaliste.

### 5.5 Partenariats potentiels

| Partenaire | Type | Valeur | Comment |
|---|---|---|---|
| **Écoles hôtelières (CFA, lycées pro)** | Distribution | Les élèves apprennent sur RestoSuite → l'utilisent en pro | Offrir l'accès gratuit aux écoles, les diplômés convertissent |
| **CCI / CMA** | Référencement | Recommandation officielle aux créateurs de restaurant | Dossier de référencement, démo |
| **France Num** | Label + aides | Les restaurateurs peuvent financer l'abonnement | S'inscrire comme solution référencée |
| **Comptables spécialisés CHR** | Prescription | Le comptable recommande RestoSuite pour le food cost | Offre partenaire (commission ou accès gratuit) |
| **Fournisseurs alimentaires (Metro, Transgourmet)** | Co-marketing | Intégration catalogue prix | Partenariat API à terme |
| **Consultants HACCP** | Prescription | Le consultant recommande RestoSuite pour la mise en conformité | Offre partenaire |

---

## 6. Roadmap business

### 6.1 Fonctionnalités manquantes critiques pour le lancement

| Feature | Priorité | Bloquant ? | Effort estimé | Justification |
|---|---|---|---|---|
| **Food cost fonctionnel** (prix ingrédients → calcul auto) | 🔴 P0 | **OUI** | 2-3 jours | C'est la promesse #1. Sans ça, pas de produit. |
| **Stripe intégré** (paiement fonctionnel) | 🔴 P0 | **OUI** | 2-3 jours | Pas de paiement = pas de revenus. |
| **SIRET obtenu** | 🔴 P0 | **OUI** | Hors contrôle | Pas de facturation légale sans SIRET. |
| **Vidéo démo** sur landing | 🔴 P0 | Non mais critique | 2h | La saisie vocale doit être VUE pour convaincre. |
| **Dates en format français** | 🔴 P0 | Non mais deal-breaker | 1h | Un outil français avec des dates US = pas crédible. |
| **Retrait/remplacement témoignages fake** | 🟠 P1 | Non | 30min | Détruit la confiance. |
| **Onboarding (empty states + guide)** | 🟠 P1 | Non | 1-2 jours | Sans onboarding, 50%+ des signups n'activent jamais. |
| **Import CSV/Excel** | 🟠 P1 | Non | 2-3 jours | Migration données existantes = friction #1 à l'adoption. |
| **Export données RGPD** | 🟠 P1 | Oui (légal) | 3h | Obligatoire RGPD. |
| **Emails transactionnels** (confirmation, trial expiring) | 🟠 P1 | Non | 1-2 jours | Sans emails, pas de conversion trial. |

### 6.2 Priorités absolues vs nice-to-have

**Semaines 1-4 (MUST HAVE pour lancer) :**
1. Food cost fonctionnel
2. Stripe
3. SIRET
4. Dates françaises
5. Vidéo démo
6. Onboarding minimal
7. Export RGPD
8. Témoignages corrigés

**Mois 2-3 (SHOULD HAVE pour croître) :**
1. Import CSV/Excel
2. Emails transactionnels (trial J1, J15, J25, J30)
3. Scan de factures fournisseur (IA)
4. Stock avancé (seuils d'alerte, inventaire)
5. Programme parrainage

**Mois 4-6 (NICE TO HAVE pour se différencier) :**
1. App mobile (PWA d'abord, native ensuite)
2. Multi-établissement réel
3. Intégration POS/caisse
4. Analytics prédictifs
5. API publique

### 6.3 Ce qui peut faire ou défaire le produit

**MAKE IT :**
- ✅ La saisie vocale qui marche parfaitement (wow factor → viralité)
- ✅ Un food cost précis et visible en 1 clic (proposition de valeur tangible)
- ✅ 10 premiers clients satisfaits qui recommandent (boucle virale)
- ✅ Un article dans L'Hôtellerie Restauration (crédibilité + trafic)

**BREAK IT :**
- ❌ Un food cost qui affiche 0€ au premier essai (mort du produit en 30 sec)
- ❌ Un fondateur qui code 16h/jour sans jamais vendre (pas de clients)
- ❌ Un trial trop long sans conversion mécanique (free-riding massif)
- ❌ Un concurrent qui ajoute la voix en 6 mois avec 10× le marketing

---

## 7. Recommandations stratégiques

### 7.1 Top 10 actions immédiates (cette semaine)

| # | Action | Type | Effort | Impact |
|---|---|---|---|---|
| **1** | **Fixer le food cost.** Chaque ingrédient doit avoir un prix. Le calcul doit fonctionner visiblement. Pré-remplir quelques ingrédients courants avec des prix réalistes. | Code | 2 jours | Fatal si pas fait |
| **2** | **Enregistrer la vidéo démo.** 60 secondes : ouvrir l'app → micro → dicter "125g de beurre, 3 citrons, 180g de sucre" → la fiche se crée → food cost s'affiche. Pas de montage, pas de musique. Raw et crédible. | Marketing | 2h | ×2 conversion |
| **3** | **Corriger les dates en format français** (jj/mm/aaaa) sur tout le module HACCP. | Code | 1h | Crédibilité |
| **4** | **Retirer la section témoignages** de la landing page (ou remplacer par "Bientôt : avis de nos premiers utilisateurs"). | Code | 15min | Confiance |
| **5** | **Clarifier le claim hébergement.** Soit migrer vers Render EU, soit corriger le texte en "hébergé chez Render avec transfert conforme DPF". Ne PAS promettre "hébergé en Europe" si c'est faux. | Légal | 30min | Risque juridique |
| **6** | **Ajouter des empty states** sur chaque page vide : "Créez votre première fiche technique 🎤" avec un CTA bien visible. | Code | 3h | Rétention J1 |
| **7** | **Préparer le dossier SIRET** si pas déjà fait. Micro-entreprise = déclaration en ligne, SIRET en 1-2 semaines. | Admin | 1h | Bloquant |
| **8** | **Configurer Stripe en mode test.** Créer le produit, le prix, le checkout flow. Tester de bout en bout. | Code | 1 jour | Bloquant |
| **9** | **Identifier 10 restaurateurs** dans le réseau perso pour la beta. Écrire un message personnalisé : "Je suis cuisinier, j'ai codé un outil, j'ai besoin de ton feedback honnête." | Vente | 2h | Premiers utilisateurs |
| **10** | **Réduire le trial de 60 à 30 jours.** Ajouter un compteur visible dans l'app ("Il vous reste X jours d'essai"). | Code | 1h | Conversion ↑ |

### 7.2 Top 5 décisions stratégiques à prendre

#### 1. **Faut-il lancer maintenant ou dans 6 semaines ?**

**Recommandation : Dans 6 semaines.** Un lancement prématuré avec un food cost cassé et pas de Stripe est pire qu'un lancement tardif. Les premiers utilisateurs sont les plus cruciaux — s'ils vivent une mauvaise expérience, ils ne reviendront jamais ET diront du mal du produit. Mieux vaut 6 semaines de retard que 6 mois de rattrapage de réputation.

#### 2. **Faut-il garder le plan gratuit permanent ou tout passer en trial ?**

**Recommandation : Plan Découverte gratuit permanent (très limité) + Trial Pro 30 jours.** Le plan gratuit permanent (5 fiches, pas de vocale, PDF watermarké) sert de porte d'entrée et de preuve que le produit marche. Le trial 30j donne accès à tout pour convertir. C'est le meilleur des deux mondes.

#### 3. **Faut-il chercher un associé/CTO ?**

**Recommandation : Pas maintenant.** Le produit est fonctionnel, le fondateur code bien. Un associé à 0€ de budget = dilution sans garantie. Priorité : atteindre 50 clients payants et 2K€ MRR. Ensuite, recruter un freelance part-time (support client, marketing) plutôt qu'un associé.

#### 4. **Faut-il lever des fonds ?**

**Recommandation : Non, pas avant 100K€ ARR.** Le marché est de niche (France, restauration), le ticket moyen est bas (39€), et les VCs ne s'intéresseront pas à un pré-seed sans traction. Le bootstrapping est la bonne stratégie ici. Revenir sur cette question à 100K€ ARR si l'objectif est d'accélérer vers l'international ou d'ajouter une équipe commerciale.

#### 5. **Faut-il viser l'international ?**

**Recommandation : Non, pas avant 2+ ans.** Le marché français à 100K+ établissements est largement suffisant. L'internationalisation ajoute : traduction, devises, réglementation HACCP locale, support multilingue. C'est un piège de dispersion pour un solo-founder. Dominer la France d'abord, international ensuite.

---

## Verdict final

### Ce qui est bon
- **Le positionnement est excellent.** Un outil pour les restaurateurs, par un restaurateur, à un prix imbattable.
- **Le timing est bon.** La digitalisation CHR est en plein boom, le back-of-house est sous-équipé.
- **La saisie vocale est un vrai différenciant.** Personne d'autre ne le fait.
- **Le fondateur connaît son métier.** Ça se voit dans le produit (pertes standard, terminologie pro, sous-recettes).
- **Le code est solide pour un solo-founder.** ~3 700 lignes de routes, architecture clean, SQLite pragmatique.

### Ce qui est inquiétant
- **Le produit n'est pas vendable aujourd'hui.** Food cost cassé, Stripe non connecté, SIRET manquant.
- **Zéro stratégie d'acquisition définie.** Un bon produit sans distribution est un arbre qui tombe dans une forêt vide.
- **Solo-founder à 0€ de budget** = pas de filet de sécurité. Si la traction met 12 mois à venir, le fondateur peut abandonner avant.
- **Le trial de 60 jours est trop généreux** et risque de cannibaliser les conversions.
- **"À vie" dans l'offre early adopter** est juridiquement et économiquement risqué.

### Le résumé en une phrase

> **RestoSuite AI a les bons ingrédients — un marché réel, un produit différencié, un fondateur crédible — mais la recette n'est pas encore prête à servir. 6 semaines de travail focalisé sur les fondamentaux (food cost, paiement, acquisition) feront la différence entre un side-project abandonné et un SaaS B2B viable.**

### Score final

| Dimension | Score |
|---|---|
| Potentiel marché | ⭐⭐⭐⭐ (4/5) |
| Qualité produit actuel | ⭐⭐⭐ (3/5) |
| Modèle économique | ⭐⭐⭐⭐ (3.5/5) |
| Chances de succès | ⭐⭐ (2.5/5) |
| Readiness lancement | ⭐⭐ (2/5) |
| **Score global** | **42/100** |

Le 42 peut monter à **60-65** en 6 semaines avec les 10 actions immédiates. Et un 65 en SaaS bootstrappé, c'est suffisant pour se lancer.

---

*Rapport rédigé le 2 avril 2026. Les projections sont basées sur des benchmarks SaaS B2B bootstrappé et les données de marché CHR France 2024-2026. Les estimations de revenus sont indicatives et dépendent fortement de l'exécution.*
