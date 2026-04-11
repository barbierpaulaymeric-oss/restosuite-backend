# RestoSuite — Index d'Audit Complet (6 avril 2026)

## Documents générés

### 1. EXECUTIVE_SUMMARY_FR.md (4.5 KB) — À LIRE EN PREMIER
**Durée :** 5 minutes
**Pour qui :** C-level, VCs, angel investors, décideurs
**Contenu :** Verdict en 1 page, score investissabilité, actions immédiates, risques top 5

**Points clés :**
- Score 58/100 actuellement (→ 72/100 en 6 semaines)
- Blocker critique : food cost affiche 0€ = invendable
- Marché excellent (47M€ SAM), produit 80% livré, acquisition inexistante
- Recommandation : Fixer blockers avant lancer

---

### 2. AUDIT_INVESTISSABILITE.md (31 KB) — FULL ANALYSIS
**Durée :** 45 minutes
**Pour qui :** Investors, business advisors, founders évaluation complète
**Contenu :** 13 sections, 12 000 mots, scoring granulaire, comparaison concurrence

**Structure :**
- Sect. 1 : Positionnement marché vs 6 concurrents (Koust, Melba, Inpulse, etc.)
- Sect. 2 : Stratégie tarifaire (39€ bien calibré, 60j trial trop long)
- Sect. 3 : Audit fonctionnalités (food cost 0%, autres 80-100%)
- Sect. 4 : Leviers croissance (acquisition, rétention, expansion)
- Sect. 5 : Moat technique (IA vocale 6/10, data flywheel inexploité)
- Sect. 6 : GTM readiness (landing page OK, onboarding 95%, 5 blockers)
- Sect. 7-12 : Scoring détaillé par catégorie
- Sect. 13 : Verdict final + recommandations

**Key takeaway :** Tout est bon SAUF food cost cassé + acquisition inexistante. 6 semaines suffisent pour devenir vendable.

---

### 3. ACTION_PLAN_6WEEKS.md (11 KB) — ROADMAP TACTIQUE
**Durée :** 10 minutes (pour fondateur : 40-60h travail)
**Pour qui :** Fondateur, CTO, équipe engineering
**Contenu :** Checklist détaillée jour par jour, P0-P1-P2, deadlines, acceptance criteria

**Phases :**
1. **Semaine 1-2 (BLOCKERS)** : Food cost + vidéo + Stripe + SIRET + email reset
2. **Semaine 2-3 (POLISH)** : Dates françaises + témoignages + trial 30j + empty states
3. **Semaine 3-4 (ONBOARDING)** : Guide + sample data
4. **Semaine 3-8 (ACQUISITION)** : Réseau perso + Facebook + LinkedIn + SEO
5. **Semaine 6 (LAUNCH)** : Soft launch Early Adopter

**KPIs cibles :**
- M1 : 50 inscrits, 3-5 payants, 150-250€ MRR
- M3 : 100+ inscrits, 5-10 payants, NPS > 40
- M6 : 300+ inscrits, 50-80 payants, 2K€ MRR

---

## Documents existants (pour contexte)

### Autres documents du projet (à relire pour approfondissement)

**RESTOSUITE.md** (13 KB)
- Vision, architecture, features livrées vs TODO
- Stack technique (Node + Express + SQLite + Gemini)
- Pricing et identité visuelle

**BUSINESS_REVIEW.md** (12 KB - archived)
- Analyse concurrentielle détaillée
- Sizing marché (TAM/SAM/SOM)
- Modèle économique évaluation
- Projections 3 scénarios (pessimiste, réaliste, optimiste)

**PRICING_STUDY.md** (12 KB - archived)
- Détail concurrent tous les 6 (prix, features, positioning)
- 3 scénarios tarifaires (agressif, aligné marché, premium)
- Comparaison Scénario B recommandé
- Early adopter strategy

**FEATURES_AUDIT.md** (10 KB - archived)
- Checklist fonctionnalités 135+ endpoints
- État par module (authentification, recettes, HACCP, stock, etc.)
- Manques identifiés (password reset, imports, versioning)
- Stack technique détaillé

**UX_REVIEW.md** (25 KB - archived)
- Audit UX complète, heatmaps visuelles
- Score 8.5/10
- 40+ recommendations par module

**PRODUCT_REVIEW.md** (19 KB - archived)
- Deep dive produit
- Readiness 6.5/10
- Improvements stratégiques

---

## Recommandations de lecture par persona

### VCs / Angel Investors
**Ordre :** EXECUTIVE_SUMMARY → AUDIT_INVESTISSABILITE (sect. 1-2, 8-9) → RESTOSUITE.md
**Temps :** 30 minutes
**Verdict à chercher :** Score 58→72, blockers fixables, marché réel
**Questions résolvables :**
- Taille marché? (SAM 47M€)
- Compétitif vs ? (Meilleur rapport qualité/prix vs tous)
- Viabilité unitaire? (95% margin, LTV/CAC > 3×)
- Quand profitable? (M9-10, viable sans levée)
- Risques? (Food cost cassé NOW, acquisition inexistante)

### Fondateur / CTO
**Ordre :** EXECUTIVE_SUMMARY → ACTION_PLAN_6WEEKS → AUDIT_INVESTISSABILITE
**Temps :** 2-3 heures (+ 40-60h execution)
**Checklist d'exécution :** ACTION_PLAN_6WEEKS
**Deep dives par problème :** AUDIT sect. spécifiques

### Business Advisor / Consultant
**Ordre :** AUDIT_INVESTISSABILITE complet → ACTION_PLAN → debrief avec fondateur
**Temps :** 2-3 heures
**Rôle :** Challenger, structurer roadmap, tracking KPIs

### Partenaires potentiels (écoles, CCI, distributeurs)
**Ordre :** EXECUTIVE_SUMMARY (sect. "Le produit en 30 sec") → RESTOSUITE.md (sect. features)
**Temps :** 10 minutes
**Message clé :** Outil SaaS complet pour restaurateurs 39€/mois, 100K marché France

---

## Score investissabilité détaillé

```
CATÉGORIE                    SCORE      VERDICT
─────────────────────────────────────────────────
Marché adressable            8.5/10     ✅ EXCELLENT
  ├─ TAM/SAM sizing         9/10        Huge, non-saturé
  ├─ Compétiteurs           8/10        Marché fragmenté, créneau vide
  └─ Fondateur crédibilité  8/10        Restaurateur pro = authentique

Produit & Tech              5.2/10      🟡 FAIBLE (fixable)
  ├─ Food cost             1/10        ❌ CRITIQUE — affiche 0€
  ├─ Fiches techniques      9/10        ✅ Mature
  ├─ IA vocale             8/10        ✅ Unique, non-démo
  ├─ HACCP                 8.5/10       ✅ Solide
  ├─ Architecture          7/10        ✅ Clean, scalable
  └─ Testing               2/10        ❌ Aucun test auto

Modèle économique           6.5/10      🟡 ACCEPTABLE
  ├─ Pricing               8/10        ✅ 39€ bien calibré
  ├─ Margins               9/10        ✅ 95% brut
  ├─ LTV/CAC               7/10        ✅ > 3×
  ├─ Trial strategy        4/10        🟡 60j trop long
  └─ Expansion levers      3/10        ❌ Quasi-inexistant

Acquisition strategy        3.5/10      ❌ FAIBLE
  ├─ Canaux ID'd           6/10        🟡 Identifiés, pas exécutés
  ├─ Marketing assets      2/10        ❌ Zéro stratégie
  ├─ SEO                   3/10        🟡 Articles planifiés
  ├─ Brand building        2/10        ❌ Zéro notoriété
  └─ Partenariats          1/10        ❌ Aucun discuté

Opérations & Fondateur      4.5/10      🟡 RISQUÉ
  ├─ Solo-founder capacity 5/10        🟡 Full-stack capable
  ├─ Burnout risk (M6-12)  3/10        🟡 ÉLEVÉ sans freelance
  ├─ Support strategy      2/10        ❌ Aucun documenté
  └─ Business acumen       6/10        🟡 OK, amélio nécessaire

Viabilité financière        6/10        🟡 ACCEPTABLE
  ├─ M12 projection        7/10        ✅ 37K ARR possible
  ├─ Runway                4/10        🟡 Bootstrapped = tendu
  ├─ Break-even timing     7/10        ✅ M9-10
  └─ Scale path            5/10        🟡 Unclear post-M12

─────────────────────────────────────────────────
SCORE GLOBAL               58/100       Potentiel ✅, Readiness ❌
```

---

## Actions immédiate (Cette semaine)

### P0 : DECISION
- [ ] Lire EXECUTIVE_SUMMARY_FR.md (5 min)
- [ ] Lire ACTION_PLAN section blockers (5 min)
- [ ] Décider : Fixer 4 blockers en 2 semaines ET lancer? OU Pivotter? OU Reporter 3 mois?

### P0 : IMPLEMENTATION (Si "YES")
- [ ] Food cost : alimenter BD prix 49 ingrédients (2 jours)
- [ ] Video démo : enregistrer 60 sec saisie vocale (2 heures)
- [ ] Stripe : configurer LIVE (1 jour)
- [ ] Reset password : ajouter email flow (3 heures)

### P1 : TRACTION
- [ ] Contacter 10 restaurateurs réseau (2 heures)
- [ ] Préparer 3 posts Facebook (1 heure)
- [ ] Update LinkedIn profile (30 min)

---

## Questions fréquentes

**Q : Est-ce que c'est viable sans levée de fonds?**
A : Oui. Projection M12 = 37K€ ARR. M24 = 140K€ ARR. Viable pour solo-founder sans investisseurs.

**Q : Combien de temps jusqu'à rentabilité?**
A : M9-10 (break-even), M14-18 (rémunération décente du fondateur). M3 si traction exceeds projections.

**Q : C'est vraiment le food cost qui tue?**
A : OUI. C'est LA promesse #1. Afficher 0€ = produit invendable. Fix = 2-3 jours max.

**Q : Pourquoi 6 semaines et pas 3 mois?**
A : Discipline. 6 semaines = deadline qui force focus. Plus long = scope creep, moins long = incomplete.

**Q : Et si ça échoue?**
A : Skills acquises (code, product, SaaS) transférables. Coût d'opportunité bas (zéro investisseurs). Peut pivoter ou reporter.

**Q : Quel est le vrai risque?**
A : Solo-founder burnout. Solution = recruter freelancer support M3 (~500€/mois).

---

## Contacts + Resources

**Pour questions sur cet audit :**
- Analyste SaaS B2B restaurant-tech
- Basé sur code source complet + 8 audits antérieurs
- Confiance : HAUTE (code examiné à 100%)

**Pour partenariats potentiels :**
- France Num (chèques numériques)
- Écoles hôtelières (distributions)
- CCI/CMA locales (recommandations)

**Pour lancement :**
- Email provider : SendGrid (free tier)
- Analytics : Plausible.io (privacy-friendly)
- Monitoring : Sentry (free tier)
- Video : YouTube ou Cloudflare Stream

---

## Versions antérieures de cet audit

| Date | Score | Verdict |
|---|---|---|
| 2 avril 2026 | 42/100 | Prématuré, 4-8w nécessaires |
| 3 avril 2026 | 45/100 | + features audit, blockers identifiés |
| 5 avril 2026 | 52/100 | + commission strategy, pricing clarifié |
| **6 avril 2026** | **58/100** | **+ full investment assessment, 6w action plan** |

---

## Prochaines étapes (après lancement)

**Si soft launch réussit (M2 traction OK) :**
1. Recruter freelancer support (français, 500€/mois)
2. Accélérer acquisition (LinkedIn outreach, partenariats)
3. Itérer produit basé sur NPS/feedback
4. Passer à Business plan v2 (multi-sites, analytics)

**Si traction faible (M2 < 20 inscrits) :**
1. Analyser : est-ce acquisition ou product?
2. Pivot vers B2B (écoles, CCI) avec même produit
3. Ou repositionner marché vers chaînes moyennes
4. Ou reporter itération major

**À M6 :**
1. Évaluer levée de fonds (Series A) si 100+ clients payants
2. Ou continuer bootstrapping si 50+ clients payants
3. Roadmap 2027 : multi-sites, API, app mobile

---

**Document créé :** 6 avril 2026
**Statut :** CONFIDENTIEL — Business Sensitive
**Distribution :** Fondateur, Investisseurs, Advisors
**Version :** 1.0 FINAL

