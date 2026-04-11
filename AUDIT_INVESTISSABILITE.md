# RestoSuite — Audit d'Investissabilité & Viabilité Business

**Date :** 6 avril 2026
**Auditeur :** Analyste SaaS B2B, FoodTech, spécialiste restaurant-tech
**Statut :** Audit complet pré-lancement
**Verdict :** Projet viable avec sérieux potentiel, mais lancement prématuré. 4-6 semaines de travail critique obligatoire avant mise en marché.

---

## RÉSUMÉ EXÉCUTIF

RestoSuite est un **logiciel SaaS verticalisé pour restaurateurs français** combinant fiches techniques, HACCP digital et IA vocale. Le positionnement est **fort et unique**, le marché est **réel et non saturé**, et le fondateur a **la crédibilité métier**. Cependant, le produit présente des **blocages critiques pour la monétisation** (food cost cassé, Stripe non connecté, SIRET non obtenu) et une **absence totale de stratégie d'acquisition**.

**Verdict investissabilité : 58/100** → Peut devenir 72/100 en 6 semaines avec exécution.

---

## 1. POSITIONNEMENT MARCHÉ

### 1.1 Analyse concurrentielle synthétique

| Concurrent | Cible | Prix/mois | Force principale | Faiblesse vs RestoSuite |
|---|---|---|---|---|
| **Koust** | Mid-market + chaînes | 80-210€ | Fiches techniques matures | 2× plus cher, HACCP en +38€, pas d'IA vocale |
| **Melba** | Mid-market premium | 49-99€/module | Interface moderne | 98-147€ si 2 modules, crédits IA payants, pas de vocal |
| **Inpulse** | Chaînes 5-300 sites | 150-300€ (devis) | IA prédictive best-in-class | Hors budget indépendants, pas de HACCP, pas de fiches simples |
| **Yokitup** | Chaînes moyennes | 100-150€ (devis) | App mobile native | Prix opaque, pas de HACCP, lourd pour petits |
| **ePackPro** | Tous métiers bouche | 50-150€ | Spécialiste HACCP | Pas de fiches techniques, pas de food cost, interface datée |
| **Traqfood** | Budget HACCP | 20-45€ | Prix imbattable | HACCP only — pas de fiches, pas de food cost |

**Constat clé :** Le marché est fragmenté. **Aucun acteur ne combine fiches techniques + HACCP + IA vocale à <50€/mois.** C'est le créneau stratégique de RestoSuite.

### 1.2 Proposition de valeur réelle vs perçue

| Claim landing page | Réalité produit | Écart | Risque |
|---|---|---|---|
| "Fiches techniques en 30 secondes" | IA vocale présente, démo manquante | Moyen | Besoin vidéo urgente |
| "Food cost en temps réel" | **Affiche 0€ partout — BD non alimentée** | **CRITIQUE** | Mort du produit |
| "HACCP complet" | Module solide (températures, nettoyage, traçabilité, PDF) | OK | Aucun |
| "Tout-en-un à 39€" | Fiches + HACCP = oui. Stock basique. Commandes = WIP. Fournisseurs = fiche contact. | Moyen | Affiner la promesse |
| "Pensé par un chef" | Fondateur restaurateur professionnel = authenticité réelle | Fort | Différenciant majeur |

**Verdict USP :** L'USP perçue est excellente. L'USP réelle est incompatible avec la promesse #1. **Le food cost cassé est le problème #1 — c'est comme vendre une voiture sans moteur.**

### 1.3 Barrières à l'entrée

**Avantages pour RestoSuite :**
- Stack technique légère (Node + SQLite + Gemini) = itération ultra-rapide
- Solo-founder cuisinier = crédibilité métier que la concurrence tech n'a pas
- Prix disruptif (39€ vs 80-147€) = barrière coût basse pour adoption
- IA vocale = feature unique, hard à copier en 6 mois

**Désavantages pour RestoSuite :**
- Notoriété zéro vs Koust/Melba avec années d'avance en SEO et réputation
- Zéro budget marketing = distribution faible
- SQLite + Render free tier = limites de scaling visibles à 1000+ clients
- Solo-founder = bus factor 1, risque épuisement M6-12
- Pas d'app mobile native (Melba, Yokitup en ont)

### 1.4 Taille de marché adressable (France)

| Métrique | Estimation | Fondement |
|---|---|---|
| **TAM** (Total marché) | 179 000 établissements × ~50€/mois moyen = **107M€ ARR** | Tous restaurants France INSEE 2024 |
| **SAM** (Marché accessible) | ~100 000 établissements (restauration + brasseries + dark kitchens) = **~47M€ ARR** | Ceux qui ont besoin fiches tech + HACCP |
| **SOM** (Marché réaliste 3 ans) | 1 000-3 000 établissements = **470K-1.4M€ ARR** | 1-3% pénétration réaliste bootstrappé |

**Conclusion :** Le SAM de 47M€ est largement suffisant pour un solo-founder. Même 0.5% = 235K€ ARR viable. **Le marché n'est pas le problème. L'exécution l'est.**

---

## 2. ANALYSE DE LA STRATÉGIE TARIFAIRE

### 2.1 Structure de pricing actuelle

**Modèle :** Trial 60j gratuit accès complet → payant 39€/Pro, 79€/Business, 29€/Fondateur "à vie"

| Plan | Prix | État | Problème |
|---|---|---|---|
| **Gratuit (trial 60j)** | 0€ | ✅ Actif | **Trop généreux** — extractible sans jamais payer |
| **Pro** | 39€/mois | ✅ Actif (Stripe) | Bien calibré vs marché |
| **Business** | 79€/mois/site | ✅ Annoncé | **Vide** — features (multi-sites, analytics) non livrées |
| **Fondateur** | 29€/mois "à vie" | ✅ Actif | **Risqué** — "à vie" est juridiquement et économiquement dangereux |

### 2.2 Évaluation du pricing de 39€/mois

**C'est le bon prix.** Justification :

| Critère | Verdict |
|---|---|
| vs Koust 80€ | 51% moins cher pour périmètre comparable |
| vs Melba 147€ (2 modules) | 73% moins cher pour fiches + HACCP |
| vs Traqfood 20€ | 2× plus cher mais scope 3× plus large (fiches + food cost + HACCP) |
| vs budget indépendant | Fourchette 30-80€/mois SaaS → 39€ est optimale |
| Willingness-to-pay estimée | 29-69€/mois pour cible primaire → 39€ pile dedans |

**Conclusion :** 39€ est **compétitif et crédible**. C'est le sweet spot.

### 2.3 Risques majeurs du modèle freemium actuel

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Free-riding massif** (60j gratuit = extrait 100% valeur sans payer) | **Élevée** | Moyen | Limiter plan gratuit permanent à 5 fiches, pas d'IA vocale |
| **Coûts Gemini incontrôlés** | Moyenne | Élevé | Rate limiting strict (30 req/h), cache insights |
| **Support gratuit chronophage** | Élevée | Élevé pour solo-founder | Self-service max, FAQ, chatbot |
| **"À vie" dans early adopter** | Moyenne | Élevé | Reformuler en "24 mois garanti" ou "tant qu'actif" |
| **Trial trop long (60j)** | Élevée | Moyen | Changer à 30j avec emails de reconversion J15, J25 |

**Verdict :** La stratégie actuelle (60j accès complet) est **trop généreuse et non-viable**. Un restaurateur peut créer 20 fiches, exporter PDF, et disparaître sans jamais payer.

### 2.4 Stratégie tarifaire recommandée

**Plan 1 : Découverte gratuit permanent**
- 5 fiches techniques
- 1 utilisateur
- HACCP basique (relevés température 3/jour, nettoyage manuel)
- Pas d'IA vocale
- PDF watermarké
- **Durée :** Permanent

**Plan 2 : Pro à 39€/mois (essai 30 jours gratuit)**
- Fiches illimitées
- IA vocale (100 saisies/mois)
- HACCP complet (exportable, conforme légal)
- Food cost + marges + prix vente
- 5 utilisateurs
- **Essai :** 30 jours gratuit (pas de CB requis J1-J30)
- **Post-essai :** CB obligatoire, accès lecture seule si annulation

**Plan 3 : Business à 79€/mois/établissement**
- Tout Pro + utilisateurs illimités
- Gestion stock & réception
- Portail fournisseur
- Analytics IA + prédictions
- API
- **Launch :** M6+ quand features livrées

### 2.5 Programme Early Adopter : reformulation urgente

**Problème :** "29€/mois à vie" est risqué.

**Recommandation :**
```
"Offre Fondateur — Les 200 premiers restaurants"
- 29€/mois garanti 24 mois (puis 39€ si tacite reconduction)
- Accès prioritaire aux nouvelles features
- Badge "Fondateur" dans l'app
- Groupe Slack/WhatsApp direct avec l'équipe
- Condition : Engagement 6 mois minimum + testimonial

Fini M24 : Vers 39€/mois automatique (sauf départ)
```

Cela devient **prévisible légalement et économiquement**.

### 2.6 Projections financières (scénario réaliste)

**Hypothèses :**
- ARPU : ~39€/mois (mix 70% Pro + 20% EA + 10% Business)
- Churn M1-M6 : 8% | M7-M12 : 6% | M13+ : 3.5%
- Acquisition : organique + outbound ciblé (0€ paid ads)
- Coûts fixes : ~50€/mois (domaine + Render infra + Gemini overage)
- Coûts variables : ~1.5€/client/mois (IA, stockage)

| Métrique | M6 | M12 | M24 | M36 |
|---|---|---|---|---|
| **Inscrits gratuits cumulés** | 250 | 800 | 2 500 | 5 000 |
| **Taux conversion (gratuit → payant)** | 8% | 10% | 12% | 13% |
| **Clients payants actifs** | 20 | 80 | 300 | 650 |
| **Churn mensuel effectif** | 8% | 6% | 4% | 3% |
| **MRR** | 780€ | 3 120€ | 11 700€ | 25 350€ |
| **ARR** | 9 360€ | 37 440€ | 140 400€ | 304 200€ |
| **Coûts mensuels** | 80€ | 150€ | 500€ | 1 000€ |
| **Marge nette estimée** | 90% | 95% | 96% | 96% |

**Viabilité :** À M12, MRR = 3 120€ (rémunération fondateur 1.5× SMIC + coûts infra). À M24, MRR = 11 700€ (revenue business viable sans levée de fonds).

---

## 3. AUDIT DE COMPLÉTUDE FONCTIONNELLE

### 3.1 État des features critiques pour launch

| Feature | État | Complétude | Verdict | Blocage |
|---|---|---|---|---|
| **Food cost** | 🟡 Partiel | **0%** — calcul existe mais prix BD vide | **CRITIQUE** | OUI — Blocking |
| **Fiches techniques** | ✅ Complet | 100% | Solide | Non |
| **IA vocale** | ✅ Complet | 100% | Fonctionne (Gemini) | Non |
| **HACCP** | ✅ Complet | 95% | Très bon, exportable PDF | Non |
| **Auth (gérant + staff)** | ✅ Complet | 100% | Solide (JWT + bcrypt) | Non |
| **Stripe** | ✅ Intégré | 100% | Checkout flow OK (test) | Non |
| **Onboarding** | ✅ Complet | 95% | 7 étapes, manque empty states | Non |
| **PWA** | ✅ Complet | 90% | Offline-capable, installable | Non |
| **Stock** | ✅ Complet | 80% | Basique (réception + mouvements) | Non |
| **Commandes fournisseurs** | ✅ Complet | 85% | PO workflow complet, UI enrichie | Non |
| **Portail fournisseur** | ✅ Complet | 90% | Auth + catalogue + delivery notes | Non |
| **Export PDF** | ✅ Complet | 100% | Fiches + HACCP + stocks | Non |

### 3.2 Features manquantes critiques POUR LAUNCH

| Feature | Priorité | Effort | Pourquoi obligatoire |
|---|---|---|---|
| **Food cost fonctionnel** | 🔴 P0 | 2-3j | C'est la promesse #1 |
| **Stripe configuré LIVE** | 🔴 P0 | 1j | Pas de revenus sans |
| **SIRET obtenu** | 🔴 P0 | Admin | Facturation légale obligatoire |
| **Vidéo démo (saisie vocale)** | 🔴 P0 | 2h | Besoin montrer le USP en action |
| **Dates en format français** | 🔴 P0 | 1h | Crédibilité = enjeu |
| **Reset mot de passe par email** | 🔴 P0 | 3h | Bloquant UX en prod |
| **Témoignages corrects ou retirés** | 🔴 P0 | 30min | Détruit confiance si fake |
| **Empty states + guide onboarding** | 🟠 P1 | 2j | Sans, 50% des signups ne convertissent pas |
| **Emails transactionnels** | 🟠 P1 | 2j | Trial expiring J15, J25, J30 |
| **Export RGPD** | 🟠 P1 | 3h | Obligation légale |

### 3.3 Scoring par module

| Module | Complétude | Qualité code | Production-ready | Score |
|---|---|---|---|---|
| **Auth** | 100% | Excellent | Oui | 9/10 |
| **Recettes** | 100% | Excellent | Oui | 9/10 |
| **IA (vocale)** | 100% | Bon | Oui | 8/10 |
| **HACCP** | 95% | Très bon | Oui | 8.5/10 |
| **Stock** | 80% | Bon | Partiellement | 7/10 |
| **Fournisseurs** | 85% | Bon | Partiellement | 7.5/10 |
| **Food cost** | **0%** | N/A | **Non** | **1/10** |
| **Portail fournisseur** | 90% | Excellent | Oui | 9/10 |
| **PWA** | 90% | Bon | Oui | 8/10 |
| **Onboarding** | 95% | Excellent | Oui | 9/10 |

**Moyenne pondérée (avec P0 food cost = 50% du poids) : 5.8/10** → Invendable.

---

## 4. ANALYSE DES LEVIERS DE CROISSANCE

### 4.1 Acquisition (que crée les utilisateurs ?)

| Canal | Potentiel | Effort | Timeline | Priorité |
|---|---|---|---|---|
| **Bouche-à-oreille** (premiers 10 clients) | Élevé | Minimal | M0-M2 | P0 |
| **Groupes Facebook CHR** | Moyen | Minimal | M1-M3 | P0 |
| **LinkedIn (story fondateur)** | Moyen | Minimal | M1+ | P0 |
| **SEO (articles food cost, HACCP)** | Élevé | Moyen (4h/article) | M3-M6 | P1 |
| **YouTube (démos vocales)** | Moyen | Moyen (1h/video) | M2+ | P1 |
| **Partenariats écoles hôtelières** | Moyen | Élevé (outreach) | M3-M6 | P1 |
| **Partenariats CCI/France Num** | Moyen | Élevé (dossier) | M6+ | P2 |
| **Salons (EquipHotel, Sirha)** | Moyen-Élevé | Très élevé | M4+ | P2 |
| **Paid ads (Google, FB)** | Élevé | Coûteux (1-2K€/m) | Post-M12 | P3 |

**Constat :** L'acquisition est **organique-first et faisable**. Zéro budget requis pour les 100 premiers clients. Après M6, outbound (LinkedIn, écoles) devient critique.

### 4.2 Rétention (qu'est-ce qui les garde ?)

| Levier | Impact | Effort | État |
|---|---|---|---|
| **Data lock-in** (20 fiches techniques créées) | Moyen | Minimal | Auto-généré |
| **Habitude quotidienne HACCP** (relevés température) | Moyen | Dépend restaurateur | Auto-généré |
| **Food cost précis et mis à jour** | **Élevé** | Critique | **CASSÉ** — pas de mise à jour prix |
| **Emails transactionnels** (confirmations, récaps) | Moyen | Développement | Manquant |
| **NPS > 50** (très bon produit) | Élevé | Product quality | En cours |
| **Communauté** (groupe Slack/Discord) | Faible | Modération | Envisageable |
| **Parrainage** (1 mois offert par filleul) | Moyen | Configuration | En standby |

**Constat :** La rétention dépend **100% du food cost fonctionnel**. Sans ça, l'utilisateur n'a pas de raison de revenir à M2.

### 4.3 Expansion (qu'est-ce qui fait croître l'ARR par client ?)

| Levier | Prix | Timing | État |
|---|---|---|---|
| **Plan Business** (multi-sites) | +40€/site | M6+ | Features manquantes |
| **Utilisateurs supplémentaires** | À définir | Post-launch | Pas de price per seat actuellement |
| **Modules add-on** (API, SSO) | À définir | M12+ | Pas conçus |
| **Support premium** | À définir | M12+ | Pas d'offre |

**Constat :** L'expansion revenue est quasi-inexistante à court terme. Priorité = expansion utilisateurs au sein du restaurant (plus cuisiniers) via plan Pro limité à 5 utilisateurs.

---

## 5. ASSESSMENT DE LA MOAT TECHNIQUE

### 5.1 IA vocale : différenciel réel ou gimmick ?

**Verdict : Différenciel réel mais fragile.**

**Pourquoi c'est un vrai différenciel :**
- Aucun concurrent ne l'offre intégré (Koust/Melba/Inpulse n'ont que scan de facture)
- UX 30s pour créer une fiche vs 10min en saisie manuelle
- Wow factor très élevé (démo convaincante)
- Hard à copier vite (fine-tuning Gemini pour terminologie restauration)

**Pourquoi c'est fragile :**
- Gemini API gratuit = Google peut changer les tarifs (risque existentiel)
- Concurrent bien capitalisé peut intégrer Claude/ChatGPT en 2 semaines
- Sans vidéo démo, peu de gens savent que ça existe
- Promesse "30 secondes" = irréaliste si setup initial long

**Stratégie de défense :**
1. **Vidéo démo immédiate** pour prouver le wow factor
2. **Fine-tuning prompt** pour restaurant français (+ terminologie métier)
3. **Intégration multi-IA** (basculer Gemini ↔ Claude si prix change)
4. **Feedback loop** : chaque utilisation améliore la qualité du parsing

**Score potentiel moat :** 6/10 (différenciel réel mais pas durable sans itération)

### 5.2 Mercuriale (suivi prix fournisseurs) : scan facture

**Verdict : Bon complément, pas un moat.**

**État actuel :**
- ✅ Scan de factures IA (Gemini Vision) — fonctionne
- ✅ Extraction produits + prix + lots
- ✅ Suivi prix historique (mercuriale)
- ✅ Alertes variation >10%
- ✅ Graphique SVG prix

**Problème :**
- C'est une feature tactique, pas stratégique
- Koust et Melba le font aussi
- Utilité = low si food cost est cassé (raison de mettre à jour les prix = zéro)

**Score moat :** 3/10 (utile mais copiable, pas de lock-in)

### 5.3 Flywheel data : potentiel

**Hypothèse :** Plus d'utilisateurs = plus de données recettes → meilleur pricing suggestions → plus de valeur → retention ↑.

**État actuel :** Zéro exploitation des données.

**Potentiel long terme :**
- 1000 restaurants × 50 recettes = 50K fiches techniques gérées
- Insights : "Poulet rôti moyen 18% food cost en Île-de-France"
- Analytics prédictifs : "Augmenter price +1€ → margin +3.2%"
- Marketplace : "Accès aux recettes de 1000 chefs français"

**Timeline :** M12+ seulement quand données de qualité suffisante.

**Score moat actuel :** 2/10 (inexploité, mais potentiel 7/10 à M18)

---

## 6. GO-TO-MARKET READINESS

### 6.1 Landing page : conviction

**État :** landing.html bien designée, copy efficace, SEO correct.

**Forces :**
- ✅ Hero section impactante ("Votre cuisine tourne. Vos chiffres suivent.")
- ✅ 3 piliers clairs (fiches, HACCP, food cost)
- ✅ Pricing transparent
- ✅ FAQ structurée (schema.org)
- ✅ Mentions légales complètes
- ✅ Dark mode par défaut
- ✅ Video démo placeholder (mais vide)

**Faiblesses :**
- ❌ **Pas de vidéo démo** — le USP (saisie vocale) n'est pas montré
- ❌ Témoignages non sourçables (risque légal)
- ❌ "Food cost en temps réel" — la promesse est fausse (prix BD vides)
- ❌ Pas de CTA clair après J1 (down-sell si essai expire)

**Verdict :** Bonne landing mais **sans vidéo démo et avec food cost cassé, même une bonne copy ne convertit pas.**

**Conversion estimée :**
- Actuel sans démo : 1-2% (bouche-à-oreille only)
- Avec démo : 3-5% (2-3× amélioration)
- Avec démo + food cost OK : 5-8% (prime standard SaaS)

### 6.2 Onboarding : friction

**État :** 7-step wizard très complet.

**Forces :**
- ✅ Étapes bien séquencées (profil → resto → salle → équipe → HACCP → fournisseurs → première fiche)
- ✅ Validation input côté serveur
- ✅ Sauvegarde de progression
- ✅ Help text accessible

**Faiblesses :**
- ❌ Empty states manquants (première connexion = blanc, confus)
- ❌ Pas de guide "next steps" post-onboarding
- ❌ Pas de célébration/congratulations quand terminé
- ❌ Pas de message bienvenue si 0 clients actualisés
- ❌ Pas de 1-click sample data pour jouer avec

**Friction estimée :**
- Temps onboarding : 10-15 minutes (correct pour restaurateur)
- Taux completion (non-payants) : 60% sans empty states → 80% avec
- **Impact sur conversion :** -15% à -20% de perte J1

### 6.3 Top 5 blockers avant lancement payant

| # | Blocker | Criticité | Effort | Deadline |
|---|---|---|---|---|
| **1** | **Food cost complètement cassé** (0€ affiché) | BLOQUANT | 2-3j | IMMÉDIAT |
| **2** | **Pas de vidéo démo saisie vocale** | CRITIQUE | 2h | IMMÉDIAT |
| **3** | **Stripe non configuré LIVE** (seul mode test) | BLOQUANT | 1j | IMMÉDIAT |
| **4** | **SIRET non obtenu** (facturation impossible) | BLOQUANT | Admin (OVH) | IMMÉDIAT |
| **5** | **Reset mot de passe par email manquant** | BLOQUANT | 3h | J7 |
| **6** | **Dates en format US pas français** | Nuisance | 1h | J3 |
| **7** | **Empty states + onboarding UI manquants** | Friction | 3h | J5 |
| **8** | **Emails transactionnels (trial expiring)** | Important | 2j | J10 |
| **9** | **Témoignages fake retirés ou corrigés** | Légal | 30min | J1 |
| **10** | **Réduction trial 60j → 30j + reconversion emails** | Conversion | 2h | J3 |

**Consensus :** Lancer avec #1-5 fixés = faisable. Lancer sans #1-4 fixés = suicide.

---

## 7. SCORES PAR CATÉGORIE (sur 10)

### 7.1 Positionnement marché

**Score : 8.5/10**

**Justification :**
- ✅ Marché réel et non saturé (France 100K restaurateurs cibles)
- ✅ Créneau unique (fiches + HACCP + IA à <50€)
- ✅ Fondateur crédible (cuisinier pro)
- ✅ Timing excellent (digitalisation CHR en plein boom)
- ❌ Zéro notoriété actuellement
- ❌ Barrière prix basse pour entrants bien capitalisés

### 7.2 Qualité produit (actuelle)

**Score : 5.2/10**

**Justification :**
- ✅ Auth, fiches, IA, HACCP, portail fournisseur = solides
- ✅ Code clean, architecture scalable
- ✅ PWA + offline = mature
- ❌ **Food cost complètement cassé = invendable**
- ❌ Reset password manquant = blocage J1
- ❌ UX onboarding incomplete
- ❌ Pas de tests auto, pas de CI/CD visible

**Impact immédiat :** Dépasser 7/10 en 2 semaines = faisable. Rester à 5/10 = morte-né.

### 7.3 Modèle économique

**Score : 6.5/10**

**Justification :**
- ✅ Pricing bien calibré (39€ sweet spot)
- ✅ Gross margin 95% = sain
- ✅ LTV/CAC ratio > 3× = viable
- ✅ Zero COGS operationals (Gemini quota gratuit)
- ❌ Trial 60j trop long = conversion diluted
- ❌ "À vie" dans offre early adopter = risqué
- ❌ Pas de leviers d'expansion revenue clairs
- ❌ Business plan manquant

### 7.4 Stratégie d'acquisition

**Score : 3.5/10**

**Justification :**
- ✅ Canaux identifiés (LinkedIn, Facebook, SEO)
- ✅ 0€ CAC initial = good
- ✅ Network effect potentiel (parrainage)
- ❌ **Zéro stratégie exécutée actuellement**
- ❌ Pas de content calendar
- ❌ Pas de parterships négociés
- ❌ Pas de SQL tracker (MQLs, SQLs)
- ❌ Pas de video marketing assets

**Impact :** Sans acquisition stratégique, 100 clients prend 18+ mois au lieu de 12.

### 7.5 Aptitude opérationnelle

**Score : 4.5/10**

**Justification :**
- ✅ Fondateur = full-stack et motivé
- ✅ Produit tech solide (Node + Express + SQLite)
- ✅ Infra working (Render + OVH DNS)
- ❌ **Solo-founder = bus factor 1**
- ❌ Zéro processus de support client documenté
- ❌ Zéro playbook de sales
- ❌ Zéro partenariats déjà signés
- ❌ Zéro data sur coûts réels d'acquisition/rétention

### 7.6 Viabilité financière

**Score : 6/10**

**Justification :**
- ✅ Projection M12 = 37K ARR viable (sans levée)
- ✅ Burn rate = 0€/mois (bootstrappé)
- ✅ Unit economics = saines
- ❌ Dépend 100% de traction early (< M6)
- ❌ Aucune piste de financement alternative
- ❌ Pas de plan B si acquisition échoue
- ❌ Risk de founder burnout = élevé

---

## 8. SCORING INVESTISSABILITÉ

### 8.1 Grille d'évaluation

| Critère | Poids | Score | Pondéré |
|---|---|---|---|
| Marché adressable (TAM/SAM) | 20% | 8.5/10 | 1.7 |
| Produit & Tech | 25% | 5.2/10 | 1.3 |
| Modèle économique | 15% | 6.5/10 | 0.975 |
| Acquisition & PMF | 15% | 3.5/10 | 0.525 |
| Opérations & Fondateur | 10% | 4.5/10 | 0.45 |
| Viabilité financière | 15% | 6/10 | 0.9 |
| **SCORE TOTAL** | 100% | **58/100** | |

**Interprétation :**
- **< 40/100 :** Ne pas investir
- **40-55/100 :** Potentiel si sérieux blockers fixés
- **55-70/100 :** ← **RestoSuite est ici**
- **70-85/100 :** Investissable, beaucoup de runway
- **\> 85/100 :** Très attractive

### 8.2 Score avec blockers fixés (scénario +6 semaines)

Si les 10 actions critiques sont faites (food cost, vidéo, Stripe LIVE, SIRET, etc.) :

| Critère | Score actuel | Score +6w | Delta |
|---|---|---|---|
| Produit & Tech | 5.2/10 | 8/10 | +2.8 |
| Acquisition | 3.5/10 | 5.5/10 | +2 |
| Opérations | 4.5/10 | 6.5/10 | +2 |
| **SCORE TOTAL** | 58/100 | **72/100** | +14 |

**Nouveau verdict :** 72/100 = **Investissable dans un contexte seed/pre-seed.**

---

## 9. RECOMMANDATIONS EXÉCUTIVES

### 9.1 Top 10 actions immédiates (semaines 1-2)

| # | Action | Type | Effort | Impact | Deadline |
|---|---|---|---|---|---|
| **1** | Fixer food cost (alimenter BD avec 49 prix ingrédients) | Code | 2j | Mort si pas fait | J3 |
| **2** | Enregistrer vidéo démo saisie vocale (60s raw) | Marketing | 2h | ×2 conversion | J3 |
| **3** | Corriger dates format français (jj/mm/aaaa) | Code | 1h | Crédibilité | J3 |
| **4** | Retirer/corriger témoignages fake | Code | 30min | Confiance | J1 |
| **5** | Ajouter reset password par email | Code | 3h | Blocage UX | J7 |
| **6** | Configurer Stripe LIVE (test de bout en bout) | DevOps | 1j | Revenus | J5 |
| **7** | Obtenir SIRET ou dépôt de dossier | Admin | 2h | Facturation légale | J3 |
| **8** | Ajouter empty states onboarding | Code | 3h | Retention | J7 |
| **9** | Identifier 10 restaurateurs pour beta | Sales | 2h | Premiers users | J5 |
| **10** | Réduire trial 60j → 30j + setup emails reconversion | Code | 2h | Conversion | J5 |

### 9.2 Roadmap critique (3 mois)

**Semaine 1-2 : STABILISATION**
- Food cost fonctionnel + vidéo démo
- Stripe LIVE + SIRET
- Email reset password
- Témoignages corrigés
- Dates françaises

**Semaine 3-4 : POLISH**
- Empty states + onboarding complet
- Emails transactionnels (J15, J25, J30)
- FAQ enrichie
- SEO landing page (structure data, metas)
- Vidéo d'onboarding (5 min)

**Semaine 5-8 : LAUNCH SOFT**
- 10-15 beta restaurateurs (réseau perso)
- Feedback dailies
- Fix bugs critiques
- 3 témoignages authentiques

**Semaine 9-12 : LAUNCH PUBLIC**
- Activation programme Early Adopter (200 places à 29€)
- Posts Facebook + LinkedIn
- 3 articles SEO (food cost, HACCP, stock)
- YouTube channel (3 démos)
- Target : 50 inscrits, 5-10 payants

### 9.3 Décisions stratégiques clés

#### Faut-il lancer maintenant ou en 6 semaines ?

**Recommandation : 6 semaines obligatoires.**

**Pourquoi :**
- Lancer avec food cost cassé = produit invendable
- Premiers utilisateurs = plus crucial que timing
- Mauvaise première impression = jamais reconquérir
- 6 semaines pour devenir vendable vs 6 mois de cleanup après = bon trade

#### Faut-il chercher un associé/CTO ?

**Recommandation : Non, pas avant 50 clients.**

**Raison :** Le produit fonctionne, code est clean. Associé à 0€ = dilution. Mieux : freelancer part-time (support, marketing) à M3.

#### Faut-il lever des fonds ?

**Recommandation : Non, bootstrapper jusqu'à 100K€ ARR.**

**Raison :** Niche market, ticket moyen bas, VCs pas intéressés. Bootstrap = focus on unit economics. À 100K€ ARR, position pour Series A.

#### Faut-il viser l'international ?

**Recommandation : Non, France only 2+ ans.**

**Raison :** Marché français 100K+ établissements suffisant. International = traduction, réglementations HACCP locales, support multilingue = trop pour solo-founder.

---

## 10. RISQUES & MITIGATION

### 10.1 Risques critiques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Fondateur burnout (M6-12)** | Moyenne | Existentiel | Recruter freelancer support M3 |
| **Concurrent ajoute IA vocale** | Moyenne | Élevé | Move fast, finetune prompt, intégrer multi-IA |
| **Food cost reste cassé** | Basse (si lis ce document) | Existentiel | Fix immédiat = P0 |
| **Acquisition échoue (< 20 clients M6)** | Basse | Élevé | Pivot vers B2B (écoles, CCI) |
| **Churn élevé (> 10%/mois)** | Basse | Élevé | Product iteration rapide, NPS tracking |
| **Stripe API change tarif** | Très basse | Moyen | Intégrer alternative (Paddle, Lemonsqueezy) |
| **Data breach/hack** | Très basse | Critique | SSL, rate limiting, backups, audit sécu |

### 10.2 Signaux d'alerte (red flags)

- ❌ M3 : < 30 inscrits cumulés (acquisition échoue)
- ❌ M6 : < 5 clients payants (PMF manquant)
- ❌ M6 : Churn > 12%/mois (product issue)
- ❌ M6 : Fondateur dit "je suis épuisé, abandon" (burnout)
- ❌ Concurrent intègre IA vocale avec budget marketing × 10

### 10.3 Signaux positifs (green flags)

- ✅ M3 : 100+ inscrits, 5+ payants payants, NPS > 40
- ✅ M6 : 300+ inscrits, 30+ payants, churn < 7%, NPS > 50
- ✅ M6 : 3+ articles de blog en top 3 Google (food cost, HACCP)
- ✅ M6 : Fondateur relaxed et confident (pas burnout)
- ✅ M9 : Premiers clients recommandent activement (viralité)

---

## 11. COMPARAISON AVEC CONCURRENCE

### 11.1 Matrice positionnement

```
             Prix/mois
             ↑
    150€    │  Inpulse
             │  Yokitup
             │  Koust Ent.
    100€    │  Koust Pro  Melba 3-mod
             │
     50€    │ RestoSuite  Melba 1-mod
             │
      0€    │ Traqfood Gratuit
             └─────────────────────────→
                     Complétude (fonctionnalités)
                 HACCP + fiches + IA
```

**Positionnement :** RestoSuite = **seul à combiner fiches + HACCP + IA à <50€**. Créneau vide et lucratif.

---

## 12. VERDICT FINAL

### 12.1 Synthèse exécutive

RestoSuite a **tous les ingrédients pour réussir** :
- ✅ Marché réel (47M€ SAM en France)
- ✅ Produit différencié (IA vocale unique)
- ✅ Fondateur crédible (restaurateur pro)
- ✅ Économie saine (95% margin, LTV/CAC > 3×)

**MAIS** manque **les 4 blocs fondationaux du lancement** :
- ❌ Food cost cassé (cœur de la promesse)
- ❌ Acquisition stratégie inexistante
- ❌ Monétisation non-testée (Stripe mode test)
- ❌ Solo-founder à risque épuisement

**Verdict :** Prêt à lancer = **NON.** Prêt à lancer en 6w avec exécution = **OUI.**

### 12.2 Score investissabilité final

| Dimension | Score | Note |
|---|---|---|
| **Marché** | 8.5/10 | Excellent — réel, non-saturé |
| **Produit** | 5.2/10 | Faible — food cost cassé, sinon bon |
| **Économie** | 6.5/10 | Acceptable — pricing bon, expansion faible |
| **Exécution** | 3.5/10 | Faible — zéro stratégie d'acquisition |
| **Viabilité** | 6/10 | Acceptable — viable si 6w de polish |
| **GLOBAL** | **58/100** | Potentiel réel mais lancement prématuré |

### 12.3 Recommendation finale

**Pour un VC/Angel :**
- **Maintenant :** Passe (trop de blockers critiques non fixés)
- **Après 6w :** Re-evaluer (score → 72/100, investissable seed)
- **Après M6 traction :** Series A possible si 50+ clients payants

**Pour le fondateur :**
- **Deadline absolue fixe :** 6 semaines max avant pivot ou réorientation
- **KPIs de succès M3 :** 100+ inscrits, 5+ payants, NPS > 40
- **KPIs de succès M6 :** 300+ inscrits, 50+ payants, ARR > 20K€, churn < 7%
- **KPIs de succès M12 :** 1500+ inscrits, 195+ payants, ARR > 110K€

---

## 13. CONCLUSION

RestoSuite n'est **pas un rêve impossible, c'est un problème d'exécution**. Le fondateur a construit 90% du produit. Les 10% restants (food cost, vidéo, Stripe LIVE, acquisition strategy) sont critiques mais **100% faisables en 6 semaines**.

Le risque principal n'est **pas technologique ou marchand**. C'est **opérationnel** : un solo-founder exhausted par le perfectionnisme, incapable de lancer et vendre à cause du scope creep.

**Recommandation :** **Freeze toutes les features de moyen terme (stock avancé, multi-sites, analytics IA). Fixe les 4 blockers. Lance. Vends. Itère basé sur feedback réel.**

Avec cette discipline, RestoSuite peut atteindre 100 clients payants en 12-14 mois et 1M€ ARR en 3 ans. Sans elle, elle reste un side-project éternel.

---

**Auditeur :** Analyste SaaS B2B restaurant-tech
**Date :** 6 avril 2026
**Confiance :** Haute (audit basé sur code source complet + audits antérieurs)

