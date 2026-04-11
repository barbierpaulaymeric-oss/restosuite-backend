# RestoSuite — Plan d'Action 6 Semaines (Priorités Critical Path)

## 🚨 BLOCKERS CRITIQUES (Fix avant tout autre) — SEMAINE 1-2

### P0 : Food cost fonctionnel
**Pourquoi :** C'est la promesse #1. Affiche 0€ actuellement = produit invendable.
**What :** Alimenter la BD avec prix réels des 49 ingrédients seed
**Who :** Fondateur (code)
**Effort :** 2-3 jours
**Deadline :** EOD Jour 3
**Checklist :**
- [ ] Vérifier que `ingredients.price` est bien mappé dans recettes
- [ ] Alimenter base avec ~49 prix (déjà seeded) OR créer script seed avec prix REELS 2026
- [ ] Tester : créer recette 5 ingrédients → vérifier food cost = non-zéro
- [ ] Tester : modifier prix ingrédient → food cost met à jour
- [ ] Export PDF : vérifier food cost s'affiche

**Acceptance :** Food cost affiche ≥ 1€ sur test recette

---

### P0 : Vidéo démo saisie vocale
**Pourquoi :** USP (saisie vocale) n'est pas démontré = aucun proof de concept
**What :** Video 60 secondes : ouvrir app → dicter "125g beurre, 3 citrons, 180g sucre" → fiche se crée → food cost affiche
**Who :** Fondateur (enregistrement)
**Effort :** 2 heures
**Deadline :** EOD Jour 3
**Checklist :**
- [ ] Enregistrer voix + écran (ScreenFlow ou OBS)
- [ ] Raw footage, pas de montage (authentique, pas poli)
- [ ] Compresser MP4 < 30MB
- [ ] Upload à `client/demo-video.mp4`
- [ ] Intégrer dans landing.html + subscribe.js
- [ ] Test : lancer video dans 3 navigateurs

**Acceptance :** Video jouable sur landing.html avec autoplay mute

---

### P0 : Stripe LIVE configuré
**Pourquoi :** Actuellement mode test = zéro monétisation possible
**What :** Créer produit + prix Stripe en LIVE, configurer webhook, tester checkout de bout en bout
**Who :** Fondateur (DevOps)
**Effort :** 1 jour
**Deadline :** EOD Jour 5
**Checklist :**
- [ ] Créer Stripe account LIVE (pas test) OU utiliser existant si déjà fait
- [ ] Créer Product `prod_...` et Price `price_...` en LIVE (39€/mois)
- [ ] Copier clés secret + public dans .env Render
- [ ] Redéployer Render
- [ ] Tester checkout complet (inscription → essai → créer checkout → suivre → webhook reçu)
- [ ] Vérifier subscriptions table update automatique

**Acceptance :** Payment reçu dans Stripe LIVE après checkout test

---

### P0 : SIRET obtenu
**Pourquoi :** Facturation légale obligatoire pour vendre
**What :** Micro-entreprise registration (si pas déjà fait) → récupérer SIRET
**Who :** Fondateur (admin)
**Effort :** 2 heures + délai administration (1-2 semaines)
**Deadline :** Dossier soumis Jour 2
**Checklist :**
- [ ] Vérifier si SIRET déjà existant (studio Soulbound Games = 930 269 063)
- [ ] Si non : soumettre micro-entreprise via URSSAF online
- [ ] Ajouter SIRET aux mentions légales du site
- [ ] Mettre à jour "Mentions légales" page avec structure legale

**Acceptance :** SIRET actif OU dépôt confirmé par URSSAF

---

### P0 : Reset password par email
**Pourquoi :** Utilisateur oublie mot de passe → stuck = première friction perdue
**What :** Ajouter route POST `/api/auth/forgot-password` + email template
**Who :** Fondateur (code)
**Effort :** 3 heures
**Deadline :** EOD Jour 7
**Checklist :**
- [ ] Route `/api/auth/forgot-password` (génère token JWT 15min)
- [ ] Envoyer email avec lien reset
- [ ] Route POST `/api/auth/reset-password?token=...` (réinitialise password)
- [ ] Template email professionnelle
- [ ] Test e2e : demander reset → vérifier email → cliquer → nouveau password → login OK

**Acceptance :** Reset flow fonctionne de bout en bout

---

## 🟡 POLISH CRITIQUE (Semaine 2-3)

### Corriger dates en format français
**Effort :** 1 heure
**Deadline :** EOD Jour 3
**Where :** Tous les modules (HACCP surtout)
**Change :** `new Date().toLocaleDateString('fr-FR')` partout
**Checklist :**
- [ ] HACCP temperatures : jj/mm/aaaa
- [ ] HACCP cleaning : jj/mm/aaaa
- [ ] Exports PDF : jj/mm/aaaa

---

### Retirer / corriger témoignages
**Effort :** 30 minutes
**Deadline :** Jour 1
**Why :** Détruit crédibilité si pas sourçables
**Option 1 :** Retirer tous les témoignages de la landing page
**Option 2 :** Ajouter vrais témoignages des beta users (plus tard)
**Checklist :**
- [ ] Vérifier que tous les témoignages ont source vérifiable OR retirer
- [ ] Si retirer : ajouter texte "Bientôt : avis de nos premiers utilisateurs"

---

### Réduire trial de 60 à 30 jours + emails reconversion
**Effort :** 2 heures
**Deadline :** Jour 5
**Reason :** 60j = free-riding, 30j = sweet spot
**Checklist :**
- [ ] Changer `trial_days = 30` dans code
- [ ] Ajouter compteur visible "Vous avez X jours d'essai restants"
- [ ] Template email J15 : "Vous avez créé X fiches, margin moyen Y%, passez Pro"
- [ ] Template email J25 : "5 jours restants, vos données restent accessibles"
- [ ] Template email J30 : "Essai expiré, passez Pro pour continuer"
- [ ] Scheduler : envoyer emails via cron (SendGrid ou Nodemailer)

---

## 🟢 ONBOARDING EXCELLENCE (Semaine 3-4)

### Empty states + guide
**Effort :** 3 heures
**Where :** Chaque page vide
**Checklist :**
- [ ] Dashboard vide : "Créez votre première fiche 🎤 avec l'IA"
- [ ] Recipes vide : "Aucune recette. Commencez ici →"
- [ ] Stock vide : "Aucun produit. Importer →"
- [ ] HACCP vide : "Aucun relevé. Ajouter premier relevé →"
- [ ] Visuels attractifs + CTA clairs

### First-run experience
**Effort :** 2 heures
**Checklist :**
- [ ] Post-onboarding : modale "Bravo! Ensuite :" avec 3 prochaines étapes
- [ ] Sample data option : "Charger des données exemple pour tester ?"
- [ ] Video démo accessible depuis dashboard
- [ ] Tour d'interface (Shepherd.js ou similaire) optionnel

---

## 📊 ACQUISITION LAUNCH (Semaine 3-8)

### Email outreach réseau perso
**Effort :** 2 heures
**When :** EOD Semaine 2
**Checklist :**
- [ ] Identifier 10 restaurateurs du réseau perso
- [ ] Email personnalisé : "J'ai développé un outil pour les cuisiniers, teste toi le premier ?"
- [ ] Link directe à version démo ou signup accès beta

### 3 posts Facebook CHR
**Effort :** 1 heure
**When :** Semaine 4
**Checklist :**
- [ ] Groupes : "Restaurateurs Indépendants France", "CHR Numériques", "Cuiso Tech"
- [ ] Post #1 : "Food cost sans Excel? Vidéo →" (avec démo video)
- [ ] Post #2 : "HACCP digital gratuit pour 60 jours"
- [ ] Post #3 : "Fiches techniques en parlant à l'IA ?"

### LinkedIn article + profile update
**Effort :** 2 heures
**When :** Semaine 3
**Checklist :**
- [ ] Headline : "Cuisinier professionnel | Fondateur de RestoSuite"
- [ ] Article : "Pourquoi j'ai quitté la cuisine pour coder un logiciel" (authentique)
- [ ] Link vers landing page

### 3 articles SEO (draft)
**Effort :** 4 heures × 3 = 12 heures
**When :** Semaine 5-8 (1 par semaine)
**Topics :**
- Article #1 : "Calculer le food cost restaurant : guide 2026" (800 mots)
- Article #2 : "HACCP obligatoire : checklist complète" (800 mots)
- Article #3 : "Gestion stock restaurant : Excel vs logiciel" (800 mots)
**Checklist :**
- [ ] Chaque article = blog post à `client/blog/`
- [ ] Optimisé SEO (meta, H2, internal links)
- [ ] Publier une par semaine
- [ ] Share sur LinkedIn

---

## ✅ CHECKLIST PRE-LAUNCH (EOD Semaine 3)

**Produit :**
- [ ] Food cost = non-zéro ✅
- [ ] Vidéo démo = jouable ✅
- [ ] Stripe LIVE = testé ✅
- [ ] Reset password = fonctionnel ✅
- [ ] Dates = format français ✅
- [ ] Témoignages = corrects ✅
- [ ] Trial = 30j + emails ✅

**Marketing :**
- [ ] Landing page = updated avec vidéo ✅
- [ ] 10 restaurateurs contactés pour beta ✅
- [ ] Facebook : 3 posts planifiés ✅
- [ ] LinkedIn : article de fondateur ✅

**Ops :**
- [ ] SIRET = obtenu ou dépôt en cours ✅
- [ ] Support email = configuré (répondre en 24h) ✅
- [ ] Error monitoring = Sentry ou logs ✅
- [ ] Backups = vérifiés ✅

---

## SEMAINE 4-6 : BETA PRIVÉE & SOFT LAUNCH

### Beta privée (10-15 restaurateurs)
**Effort :** Daily (30 min)
**Checklist :**
- [ ] Ouvrir accès gratuit 90j
- [ ] Daily standup (Slack/WhatsApp) : "Utilisez-vous? Feedback?"
- [ ] Tracker Google Sheets : feature usage, bugs, NPS
- [ ] Fix urgent daily

### Récupérer 3 témoignages authentiques
**Effort :** 3 appels téléphoniques (15 min each)
**When :** Semaine 5-6
**Checklist :**
- [ ] Appeler 3 beta users → demander avis 2 min
- [ ] Filmer ou récupérer quote écrite
- [ ] Permission utilisateur + screenshot profil
- [ ] Ajouter à landing page (vrais noms + restaurants)

### Soft launch public (Early Adopter)
**When :** EOD Semaine 6
**Checklist :**
- [ ] Activation programme "200 premiers à 29€/mois"
- [ ] Landing page = "Offre Early Adopter : 200 places disponibles"
- [ ] Email blast à contactes réseau
- [ ] LinkedIn post : "Nous sommes live 🚀"
- [ ] Posts Facebook groups × 3
- [ ] YouTube 2 vidéos : démo + onboarding

---

## KPIs DE SUCCÈS À TRACKER

| Métrique | Target M6 | Status |
|---|---|---|
| **Inscrits cumulés** | 100+ | [ ] |
| **Clients payants** | 5-10 | [ ] |
| **MRR** | 200-400€ | [ ] |
| **Churn mensuel** | < 10% | [ ] |
| **NPS** | > 40 | [ ] |
| **Email open rate** | > 35% | [ ] |
| **Landing conv rate** | > 3% | [ ] |

---

## CONTINGENCY (Si blockers non fixés)

**Si food cost pas fixé par Jour 5 :**
- Pivot vers B2B (écoles, CCI) où food cost est less critical
- Ou delay launch 3 semaines supplémentaires

**Si Stripe pas LIVE par Jour 7 :**
- Utiliser Paddle ou Lemonsqueezy temporairement
- Ou delay launch jusqu'à Stripe OK

**Si SIRET pas obtenu par J10 :**
- Lancer avec "micro-entreprise en cours d'enregistrement"
- Invoicer manuellement en attendant
- Ou delay facturation de clients jusqu'à SIRET live

---

## BONUS : Outils recommandés

| Besoin | Outil | Budget |
|---|---|---|
| Email transactionnel | SendGrid (free tier) | Gratuit |
| Analytics | Plausible (privacy-friendly) | 10€/mois |
| Error monitoring | Sentry free tier | Gratuit |
| Video hosting | Cloudflare Stream ou YouTube | Gratuit |
| SEO tracking | Google Search Console | Gratuit |
| CRM simple | Airtable + Zapier | Gratuit tier |

---

## Résumé 6 semaines

**Semaine 1-2 :** Fixer blockers (food cost, vidéo, Stripe, SIRET, reset password)
**Semaine 3-4 :** Polish (dates, emails, empty states, onboarding)
**Semaine 5-6 :** Beta privée + acquisition launch (Facebook, LinkedIn, SEO)

**EOD Semaine 6 :** Prêt pour soft launch Early Adopter
**Objectif M1 :** 50 inscrits, 3-5 payants, 150-250€ MRR

---

**Last updated :** 6 avril 2026
**Owner :** Fondateur RestoSuite
**Status :** CRITICAL PATH — aucune déviation

