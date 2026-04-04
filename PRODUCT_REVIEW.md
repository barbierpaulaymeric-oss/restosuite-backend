# RestoSuite — Product Review

**Date :** 2 avril 2026  
**Évaluateur :** Consultant SaaS / Product Manager senior — spécialisation B2B restauration  
**Version testée :** v1.0  
**Environnement :** localhost:3007 (desktop + mobile 375px)

---

## Résumé exécutif

RestoSuite est un produit **surprenamment complet pour un solo-founder**. Le périmètre fonctionnel couvre les fiches techniques, le HACCP, le stock, les fournisseurs et l'analytics — c'est large. L'UX est cohérente, le dark theme est maîtrisé, et l'ensemble fait plus « produit » que « prototype ». Cependant, plusieurs points critiques empêchent un lancement commercial immédiat : des données de test visibles (coûts à 0€, témoignages factices labellisés), un SIRET manquant, et des modules annoncés mais non livrés (Commandes, Portail Fournisseur). Le potentiel est réel — il faut resserrer l'exécution.

**Note globale : 6.5/10** — Solide fondation, pas encore prêt à vendre.

---

## 1. UX/UI Review — 7/10

### Points forts
- **Cohérence visuelle remarquable.** Le dark theme bleu nuit / orange est appliqué uniformément sur toute l'app. Pas de rupture de style entre les modules. C'est rare pour un projet solo.
- **Navigation claire.** 5 onglets principaux (Fiches, Stock, HACCP, Fournisseurs, Plus) — immédiatement compréhensible. Pas de surcharge cognitive.
- **Bottom nav mobile.** Passage automatique en bottom bar sur mobile avec icônes + labels. C'est le bon pattern pour un outil "tablette en cuisine".
- **Cards et tableaux bien structurés.** Les fiches techniques affichent clairement : portions, coût total, coût/portion, prix de vente, food cost, marge. La table ingrédients (brut/net/perte/coût/notes) est professionnelle.
- **HACCP dashboard.** Les cards de température avec statuts colorés (OK vert, Manquant orange, >4h rouge) sont très lisibles. Le plan de nettoyage avec progress bar est bien pensé.
- **Module Analytics.** Vue d'ensemble dense mais lisible : KPI cards en haut, sections Food Cost, Stock, Fournisseurs, HACCP Compliance, Insights IA.

### Points faibles
- **Date pickers en format US (mm/dd/yyyy).** C'est un outil 100% français — ça doit être en jj/mm/aaaa. Visible sur HACCP Températures, Nettoyage, Traçabilité. **Bug critique pour la cible.**
- **Modal fournisseur persistante.** Quand on clique sur un fournisseur, la modal d'édition s'ouvre. Si on navigue vers une autre page (via la nav), la modal reste superposée. Il faut cliquer "Annuler" explicitement. **Bug UX notable.**
- **Pas de confirmation de suppression visible.** Le bouton "Supprimer" sur les fiches techniques est présent mais sans guard (pas de "Êtes-vous sûr ?").
- **Le label "Perte" est tronqué à "Pert" dans le formulaire de nouvelle fiche.** Problème de largeur sur le champ.
- **Pas de breadcrumb cohérent.** La fiche technique a "← Fiches techniques" mais le HACCP a des tabs sans retour arrière.
- **Aucun onboarding.** Première connexion = écran vide. Pas de wizard, pas de sample data guidée, pas de tooltip.
- **Food cost à 0.0% en vert.** C'est techniquement "dans la plage" mais visuellement trompeur — ça devrait être grisé ou signalé comme "non calculé".

### Accessibilité
- Contraste texte clair sur fond sombre : acceptable mais limite sur certains labels secondaires (gris clair sur bleu nuit).
- Zones tactiles des boutons "Relever" (HACCP) : bien dimensionnées (~44px+). OK pour tablette.
- Pas de `aria-label` visible sur les étoiles de notation fournisseur.

### Verdict UX
**Fait "produit early stage" — pas prototype, pas encore premium.** Comparable à un Koust v1 ou un Melba early beta. Suffisant pour une beta privée, pas pour un lancement marketing agressif.

---

## 2. Product Completeness — 6/10

### Fonctionnalités solides ✅

| Module | Statut | Commentaire |
|--------|--------|-------------|
| **Fiches techniques** | ✅ Solide | Création manuelle + vocale, ingrédients avec brut/net/perte, procédure par étapes, export PDF, catégorisation |
| **HACCP - Dashboard** | ✅ Solide | Vue consolidée températures + nettoyage + réceptions DLC. Alertes visuelles claires |
| **HACCP - Températures** | ✅ Solide | Multi-zones (frigo, congélo, chambre froide), historique avec filtre, statuts conformité |
| **HACCP - Nettoyage** | ✅ Solide | Tâches quotidiennes/hebdo/mensuelles, check progress, zones + produits |
| **HACCP - Traçabilité** | ✅ Solide | Réceptions avec lot, DLC, T° réception, alertes DLC proches |
| **Multi-comptes** | ✅ Présent | Gérant avec PIN, gestion équipe, rôles visibles |
| **Ingrédients** | ✅ Base ok | Liste avec perte/unité, catégories, recherche |
| **Analytics** | ✅ Impressionnant | Food cost par recette, valeur stock, inflation fournisseurs, conformité HACCP 7j, insights IA (Gemini) |

### Fonctionnalités incomplètes ⚠️

| Module | Problème |
|--------|----------|
| **Coûts ingrédients** | Tous les ingrédients affichent 0,00 € — le food cost ne peut pas se calculer. C'est le cœur de la proposition de valeur et c'est cassé (ou jamais alimenté). |
| **Fournisseurs** | Pas de catalogue produit visible, pas de liaison ingrédient↔fournisseur, pas d'historique prix. Juste une fiche contact basique. |
| **Stock** | Vue basique : 1 seul ingrédient ("Test Tomate 8 kg"). Pas de seuil d'alerte configurable visible, pas d'inventaire automatisé. |
| **Saisie vocale** | Bouton micro présent, impossible de tester sans micro. Pas de demo/preview de ce que l'IA comprend. |
| **Export PDF** | Bouton "Exporter" présent sur fiches et HACCP mais non testable (nécessite données réelles). |
| **Permissions granulaires** | Annoncées mais non vérifiables — un seul compte existe. |

### Fonctionnalités manquantes pour un MVP ❌

| Fonctionnalité | Importance | Présent chez la concurrence |
|----------------|------------|---------------------------|
| **Liaison ingrédient → prix fournisseur** | 🔴 Critique | Koust ✅, Melba ✅, Inpulse ✅ |
| **Import/export données (CSV, Excel)** | 🔴 Critique | Standard marché |
| **Onboarding guidé** | 🟠 Important | Melba ✅ |
| **Notifications (email/push)** | 🟠 Important | DLC expirées, stock bas |
| **Multi-établissement** | 🟡 Nice-to-have (v2) | Koust ✅, Inpulse ✅ |
| **Commandes fournisseurs** | 🟠 Important (annoncé "Bientôt") | Koust ✅ |
| **Intégration caisse/POS** | 🟡 Nice-to-have (v2) | Inpulse ✅ |
| **Historique des modifications** | 🟠 Important | Audit trail pour HACCP |
| **Backup/export données utilisateur** | 🔴 Critique (RGPD) | Obligatoire |

### Comparaison marché

| Critère | RestoSuite | Koust (~79€/mois) | Melba (~69€/mois) | Inpulse (~99€/mois) |
|---------|--------------|--------------------|--------------------|---------------------|
| Fiches techniques | ✅ | ✅ | ✅ | ✅ |
| Food cost automatique | ❌ (cassé) | ✅ | ✅ | ✅ |
| HACCP intégré | ✅ | ❌ (add-on) | ✅ | Partiel |
| Saisie vocale IA | ✅ (différenciant) | ❌ | ❌ | ❌ |
| Gestion commandes | ❌ | ✅ | ✅ | ✅ |
| Multi-établissement | ❌ | ✅ | ✅ | ✅ |
| Prix | 39€/mois | ~79€ | ~69€ | ~99€ |

**Différenciant clé :** La saisie vocale IA est unique sur le marché français. Le HACCP intégré au même prix que les fiches techniques est aussi un avantage. Le prix agressif à 39€ est bien positionné en entrée de gamme.

---

## 3. Landing Page — 7.5/10

### Proposition de valeur ✅
- **"Vos fiches techniques en 30 secondes"** — Clair, concis, chiffré. Excellent.
- **"Le premier assistant cuisine pensé par un chef"** — Bon positionnement émotionnel.
- Le badge "🎤 Saisie vocale propulsée par l'IA" est bien placé au-dessus du titre.
- La fiche technique mockup à droite du hero est un excellent choix — ça montre le produit immédiatement.

### Pricing ✅
- Deux plans simples : Gratuit 60j et Pro 39€/mois.
- Le badge "Populaire" sur le plan Pro est standard et efficace.
- "Sans engagement, annulable à tout moment" est bien mis en avant.
- **Problème :** Le bouton "S'abonner — 39€/mois" pointe vers `#` (lien mort).

### CTA
- "Démarrer gratuitement" en orange sur fond sombre : très visible. Répété 3 fois (hero, pricing, footer CTA).
- "Aucune carte bancaire requise" — bon réducteur de friction, présent 2 fois.
- Le CTA final "Prêt à simplifier votre cuisine ?" est un bon closer.

### Design
- Le header est propre : logo + 3 liens (Fonctionnalités, Tarifs, FAQ) + CTA.
- Les 6 features cards (Saisie Vocale IA, Coûts en temps réel, Export PDF Pro, Multi-comptes, HACCP, Gestion Stock) sont claires.
- Le flow "3 étapes" est un bon pattern de réassurance.
- **Sections vides sur mobile.** De grands espaces bleu nuit apparaissent entre les sections — semble être du contenu qui ne se charge pas ou des images manquantes.

### Points faibles
- **Témoignages labellisés "Exemple".** C'est honnête mais ça détruit toute crédibilité. Soit les retirer, soit les remplacer par de vrais retours beta-testeurs. Un témoignage factice labellisé est pire que pas de témoignage.
- **Pas de vidéo/démo.** Pour un produit dont le USP est la saisie vocale, ne pas montrer une vidéo de 30 secondes est une occasion ratée.
- **Pas de logo clients / press / certifications.** Barre de logos partenaires absente.
- **Le footer montre "© 2026 Paul-Aymeric Barbier"** — Pas de nom d'entreprise. Ça fait solo-project, pas SaaS professionnel.
- **La nav FAQ fonctionne** mais les réponses sont en accordion fermé par défaut — standard.

### Mobile landing page
- Le header se compresse bien mais le hamburger menu est absent — les liens nav disparaissent.
- La fiche technique mockup se superpose mal au hero text sur petit écran.
- Grandes zones vides visibles.

---

## 4. Business Model — 6/10

### Freemium 60 jours + lecture seule

**Le modèle est intéressant mais risqué :**

✅ **60 jours c'est bien** — Plus long que les 14 jours standards SaaS. Un restaurateur met du temps à adopter un outil (formation équipe, saisie données). 30 jours serait trop court, 60 est réaliste.

✅ **Lecture seule après expiration** — Bon : les données ne disparaissent pas, ce qui réduit la peur de l'engagement. L'utilisateur peut revenir souscrire sans avoir tout perdu.

⚠️ **Risque de free-riding.** 60 jours gratuits + toutes les features = beaucoup de valeur extraite sans payer. Un restaurant peut créer toutes ses fiches techniques en 2 semaines, exporter les PDF, et ne jamais payer.

⚠️ **Pas de trigger de conversion clair.** Qu'est-ce qui pousse à payer au jour 61 ? Si tout est en lecture seule, un petit resto avec 20 fiches figées n'a peut-être pas besoin de modifier quoi que ce soit pendant des mois.

### Prix : 39€/mois

✅ **Bien positionné en entrée de gamme.** Koust est à ~79€, Melba ~69€, Inpulse ~99€. À 39€, RestoSuite est le moins cher du marché avec un scope comparable (fiches + HACCP).

⚠️ **Trop bas pour un solo-founder ?** À 39€/mois, il faut ~250 clients payants pour atteindre ~10K€ MRR. L'acquisition client en restauration B2B est lente et coûteuse (terrain, salon, bouche-à-oreille). Le CAC risque de dépasser la LTV pendant longtemps.

⚠️ **Pas de plan annuel visible.** Un plan annuel à -20% (ex: 31€/mois facturé annuellement = 372€/an) réduirait le churn et améliorerait la trésorerie.

⚠️ **Un seul plan payant.** Pas de segmentation (solo / multi-établissement / chaîne). Ça limite l'upsell. Les CGV mentionnent un "Plan Business à 79€ HT / 94.80€ TTC" — mais il n'apparaît nulle part sur la landing page. **Incohérence entre CGV et pricing affiché.**

### Risques business identifiés

1. **SIRET "en cours d'obtention"** — Impossible de facturer légalement sans SIRET. Bloquant pour le lancement payant.
2. **Hébergeur US (Render, San Francisco)** — Les mentions légales le disent clairement. Or la landing page promet "Données hébergées en Europe". **Contradiction potentiellement litigieuse.** La politique de confidentialité mentionne le transfert UE→US avec le Data Privacy Framework, mais la promesse marketing est trompeuse.
3. **Dépendance IA (Gemini)** — Les insights IA sont un différenciant mais aussi un poste de coût variable. Pas de mention du coût par requête ni de limite d'usage.
4. **Pas de Stripe Connect visible** — Le bouton "S'abonner" pointe vers `#`. Stripe n'est pas encore intégré ou pas encore en production.

---

## 5. Points bloquants pour le lancement — 5/10

### Pour lancer une beta demain ⚡

| Bloquant | Sévérité | Effort estimé |
|----------|----------|---------------|
| Le food cost affiche 0€ sur toutes les fiches | 🔴 Critique | Moyen — il faut connecter prix ingrédients → calcul coûts |
| Date pickers en format US | 🔴 Critique | Facile — locale fr-FR sur les date inputs |
| Témoignages marqués "Exemple" | 🟠 Important | Facile — retirer la section ou mettre de vrais retours |
| Modal fournisseur qui persiste entre navigations | 🟠 Important | Facile — fermer la modal sur changement de route |
| Onboarding inexistant | 🟡 Souhaitable | Moyen — au minimum un message de bienvenue + sample data |

**Verdict beta :** Avec 2-3 jours de fix sur le food cost et les date pickers, une beta privée (5-10 restaurateurs invités) est envisageable.

### Pour lancer publiquement dans 2 semaines 🚀

| Bloquant | Sévérité | Effort estimé |
|----------|----------|---------------|
| SIRET manquant | 🔴 Légal | Hors contrôle (délai administratif) |
| Stripe non connecté (bouton S'abonner mort) | 🔴 Critique | Moyen — intégration Stripe Checkout |
| Contradiction hébergement EU vs Render US | 🔴 Légal | Facile à corriger dans le wording, ou migrer vers Render EU |
| Plan Business dans les CGV mais pas sur la landing | 🟠 Important | Facile — aligner CGV et pricing page |
| Pas d'import CSV/Excel | 🟠 Important | Moyen — crucial pour la migration de données existantes |
| Pas de vidéo démo (saisie vocale) | 🟠 Marketing | Moyen — enregistrer une démo de 30-60 secondes |
| Pas de politique de backup/export RGPD | 🔴 Légal | Facile — ajouter un bouton "Exporter mes données" |

**Verdict lancement public :** Pas réaliste en 2 semaines. Compter plutôt **4-6 semaines** pour résoudre les points légaux (SIRET, RGPD), intégrer Stripe, et polir le food cost.

---

## 6. Recommandations prioritaires

### 🔴 Top 5 — À corriger AVANT le lancement

1. **Fixer le calcul du food cost.** C'est la promesse #1 du produit. Chaque ingrédient doit avoir un prix (même estimé), et le food cost doit se calculer automatiquement. Sans ça, RestoSuite est un éditeur de fiches, pas un outil de gestion.

2. **Résoudre le SIRET et aligner les mentions légales.** Pas de SIRET = pas de facturation = pas de business. Parallèlement, soit migrer vers Render EU, soit corriger le claim "hébergé en Europe" en "hébergé chez Render (US) avec transfert conforme au DPF".

3. **Intégrer Stripe Checkout.** Le bouton "S'abonner" doit fonctionner. Configurer un simple Stripe Checkout avec le plan Pro à 39€/mois + un plan annuel. Ajouter le plan Business à 79€ si c'est dans les CGV.

4. **Corriger les date pickers en format français (jj/mm/aaaa).** Sur toutes les pages HACCP. C'est un outil pour des restaurateurs français — le format US est un deal-breaker de crédibilité.

5. **Retirer ou remplacer les témoignages "Exemple".** Soit supprimer la section testimonials, soit la remplacer par 2-3 citations de vrais beta-testeurs (même anonymisés : "Chef, Paris 11e"). Un faux témoignage labellisé détruit la confiance.

### 🟢 Top 5 — Quick wins (effort faible, impact fort)

1. **Ajouter un message de bienvenue / empty state.** Quand l'utilisateur arrive sur une liste vide, afficher "Créez votre première fiche technique en 30 secondes 🎤" avec un gros CTA. Coût : 1h. Impact : rétention J1 × 2.

2. **Enregistrer une vidéo démo de 30 secondes.** Montrer la saisie vocale en action → embed sur la landing page dans le hero. C'est le USP — il faut le montrer. Coût : 2h. Impact : conversion × 1.5.

3. **Ajouter un plan annuel sur la landing.** "39€/mois ou 31€/mois (facturé 372€/an) — économisez 20%". Coût : 30min de code + config Stripe. Impact : meilleure trésorerie, réduction churn.

4. **Fermer la modal fournisseur sur changement de route.** Fix technique simple (watch sur le router hash, `onhashchange` → close modal). Coût : 15min. Impact : plus de bug UX majeur.

5. **Ajouter un bouton "Exporter mes données" (RGPD).** Un simple export JSON/CSV de toutes les données du compte. Coût : 2-3h. Impact : conformité RGPD + confiance utilisateur.

---

## Tableau récapitulatif des notes

| Section | Note /10 | Commentaire |
|---------|----------|-------------|
| UX/UI | 7/10 | Cohérent et propre, quelques bugs et le format date US |
| Product Completeness | 6/10 | Périmètre large mais food cost cassé et modules annoncés non livrés |
| Landing Page | 7.5/10 | Propval claire, pricing simple, mais témoignages fake et pas de démo vidéo |
| Business Model | 6/10 | Prix bien positionné, modèle freemium sensé, mais risques légaux et Stripe non connecté |
| Readiness (beta) | 5.5/10 | Quelques jours de fix pour une beta privée |
| Readiness (public) | 4/10 | 4-6 semaines minimum pour un lancement public crédible |
| **Note globale** | **6.5/10** | **Fondation solide, exécution à resserrer** |

---

## Conclusion

RestoSuite a le bon positionnement : un outil simple, pas cher, avec un vrai différenciant (saisie vocale IA) et un HACCP intégré que les concurrents facturent en option. Le périmètre fonctionnel est ambitieux pour un solo-founder et l'exécution UI est propre.

Mais le produit n'est **pas vendable aujourd'hui**. Le food cost à 0€ partout, c'est comme vendre une calculatrice qui n'affiche pas les résultats. Le SIRET manquant bloque la facturation. Les témoignages factices et la contradiction sur l'hébergement EU minent la confiance.

**Roadmap recommandée :**
1. **Semaine 1-2 :** Fix food cost, date pickers, modal bug, retirer témoignages, empty states
2. **Semaine 2-3 :** Intégrer Stripe, enregistrer vidéo démo, ajouter plan annuel
3. **Semaine 3-4 :** Beta privée (10 restaurateurs), collecte retours réels
4. **Semaine 5-6 :** Fix retours beta, vrais témoignages, SIRET obtenu → lancement public soft

Le marché est là. Le produit a du potentiel. Il faut juste finir de le rendre vendable.

---

*Rapport généré le 2 avril 2026 — RestoSuite v1.0*
