# RestoSuite — Revue UX/UI Exhaustive

**Évaluateur :** Expert UX/UI & Product Designer Senior (SaaS B2B)  
**Date :** 2 avril 2026  
**Version évaluée :** Code frontend client (SPA + landing page)  
**Méthodologie :** Analyse du code source (HTML, CSS, JS views) + screenshots live (desktop/mobile)

---

## 1. Design & UX

### 1.1 Cohérence visuelle globale

**Score : 8/10**

Le design system est solide et bien structuré. Les design tokens sont clairement définis dans `:root` avec une nomenclature cohérente (`--color-*`, `--bg-*`, `--text-*`, `--space-*`, `--radius-*`). L'utilisation d'Inter + JetBrains Mono est un choix pertinent — professionnel sans être clinique, et le mono pour les données numériques est exactement ce qu'il faut en SaaS métier.

**Points forts :**
- Palette de couleurs cohérente (navy + orange accent) qui fonctionne bien en dark mode
- Système de tokens CSS complet et bien nommé (spacing base 4px, typographie scalable)
- Composants réutilisables (`.card`, `.btn`, `.badge`, `.form-control`) au look cohérent
- Code couleur pour le food cost (vert < 30%, jaune 30-35%, rouge > 35%) — immédiatement lisible
- Les composants HACCP (zone cards, cleaning checklist) reprennent le même langage visuel

**Points faibles :**
- La landing page a son propre CSS inline (`<style>`) dupliquant partiellement le design system de `style.css`. Risque de divergence à terme
- Certains styles inline dans les vues JS (`style="display:flex;gap:8px;margin-bottom:16px"`) cassent la maintenabilité
- Le portail fournisseur utilise une couleur accent différente (`--supplier-accent: #4A90D9`) — bien en termes de différentiation, mais le switch de contexte visuel pourrait être plus marqué

### 1.2 Qualité du dark mode

**Score : 9/10**

Excellent. C'est le meilleur aspect du design. Le dark mode n'est pas un simple "inverser les couleurs" — c'est un vrai design pensé dark-first.

**Points forts :**
- 3 niveaux de surface (`--bg-sunken`, `--bg-base`, `--bg-elevated`) qui créent une hiérarchie de profondeur naturelle
- Contraste texte respectueux : `#F7F5F2` (primary), `#9CA3AF` (secondary), `#6B7280` (tertiary) — suffisant sans agresser
- Les ombres sont calibrées pour le dark (`rgba(0,0,0,0.2-0.25)`) — pas trop lourdes
- Le backdrop-filter sur le header landing (`blur(16px)`) est un beau détail
- L'animation `mic-pulse` en rouge lors de l'enregistrement contraste bien sur le fond sombre

**Points faibles :**
- Pas de light mode disponible. Pour un SaaS B2B utilisé en cuisine (parfois en plein jour avec un éclairage cru), un toggle serait un must
- Les `tbody tr:nth-child(odd/even)` alternent entre `--bg-base` et `--bg-sunken` — la différence est subtile, presque invisible. Augmenter le contraste entre les rows

### 1.3 Typographie, espacements, hiérarchie

**Score : 7.5/10**

**Points forts :**
- Échelle typographique bien définie (xs à 4xl) avec bump responsive à 768px
- Letter-spacing tight sur les headings, wide sur les labels — classique et efficace
- JetBrains Mono pour toutes les données numériques (prix, températures, quantités) — aide la lisibilité des chiffres
- Labels des formulaires en uppercase + tracking wide = bon pattern pour les formulaires de saisie

**Points faibles :**
- Les `section-title` (uppercase, xs, tertiary) sont trop discrets. En contexte cuisine (environnement bruyant, attention partagée), ils devraient être plus visibles
- Les espaces entre les sections dans le formulaire de recette sont parfois irréguliers (inline `style="margin-top:8px"`)
- Les empty states ont un bon copy mais la taille du texte descriptif (`var(--text-base)`) pourrait être un poil plus grande pour mieux guider
- L'absence de `max-width` sur les paragraphes de description dans les vues (sauf landing) rend la lecture fatigante sur grand écran

### 1.4 Navigation et architecture de l'information

**Score : 8/10**

**Points forts :**
- Bottom tab bar mobile → top bar desktop : le bon pattern pour une app mobile-first utilisée en cuisine
- 6 entrées de nav max (Fiches, Stock, Commandes, HACCP, Fournisseurs, Plus) — respecte la règle du ±5 items
- HACCP a sa propre sous-navigation (Dashboard, Températures, Nettoyage, Traçabilité) — bonne granularité
- Le routeur hash-based est simple et robuste, avec gestion du 404
- La page "Plus" sert de hub pour les modules secondaires (Analytics, Équipe, Service) — bon pattern

**Points faibles :**
- Pas de breadcrumb. Quand on est dans `#/haccp/temperatures`, le seul moyen de revenir au dashboard HACCP est la sous-nav. Un breadcrumb simple aiderait
- Le lien "retour" sur les pages détail (`back-link`) ramène toujours à `#/` — devrait revenir à la page précédente (ex: `#/haccp` si on vient de là)
- La vue Service (`#/service`) est un monde à part (plein écran, pas de nav) — la transition est abrupte. Un petit indicateur "vous êtes en mode Service" serait bienvenu
- Le role `salle` est automatiquement redirigé vers `/service` sans possibilité de naviguer — correct fonctionnellement mais aucun message explicatif

### 1.5 Responsive / Mobile

**Score : 8.5/10**

**Points forts :**
- Vrai mobile-first : le CSS part du mobile et ajoute via `@media (min-width: 768px)`
- Touch-optimized : `min-height: 44px` sur les boutons, `-webkit-tap-highlight-color: transparent`, `scale(0.95)` sur `:active`
- `safe-area-inset-bottom` pour les encoches iPhone — bien pensé
- Les grids s'adaptent proprement (`repeat(auto-fill, minmax(...)`)
- La kitchen view et le service view gèrent bien le mobile (tabs de switch entre panneaux)
- `user-scalable=no` sur l'index.html pour comportement app-like

**Points faibles :**
- Le formulaire de recette est dense sur mobile : la ligne d'ajout d'ingrédient (nom + qty + unit + perte + notes + bouton) est un flex-wrap qui fonctionne mais n'est pas optimal. Un flow en 2 lignes serait plus lisible
- Les tables (`<table>`) dans le recipe detail sont scrollables horizontalement (`overflow-x: auto`) mais il n'y a aucun indicateur visuel de scroll (shadow ou fade)
- La landing page en mobile affiche correctement le hero mais les sections en dessous apparaissent vides (le reveal animation ne se déclenche pas si l'observer ne capte pas les éléments)

### 1.6 Accessibilité

**Score : 6/10**

**Points forts :**
- `aria-label="Menu"` sur le toggle mobile de la landing
- `@media (prefers-reduced-motion: reduce)` désactive les animations — excellent
- `lang="fr"` sur le `<html>` — correct pour les lecteurs d'écran
- Focus visible par défaut sur les inputs (outline accent)

**Points faibles :**
- **Aucun `aria-label` sur les boutons icon-only** (les `.btn-icon`, `.ing-remove`, `.pin-key--delete`). Les lecteurs d'écran ne savent pas à quoi servent ces boutons
- Les cartes cliquables (`.card` avec `onclick="location.hash=..."`) sont des `<div>` au lieu de `<a>` ou `<button>` — pas navigables au clavier
- Le pin pad n'a pas de `role="group"` ni d'`aria-label` indiquant "Saisie du code PIN"
- Les toasts n'ont pas de `role="alert"` ni `aria-live="polite"`
- Les couleurs seules indiquent le statut (vert/jaune/rouge sur les zone cards HACCP) — pas accessible aux daltoniens. Les icônes textuelles (✅ OK, ⚠️ ALERTE) compensent partiellement
- Pas de skip-to-content link
- Les `select` customisés n'ont pas de `label` correctement associé dans certains cas (formulaire d'ajout d'ingrédient)

### 1.7 Micro-interactions et feedback utilisateur

**Score : 8/10**

**Points forts :**
- Système de toasts bien implémenté (slide-in animation, 3 variantes colorées, auto-dismiss)
- Animation de pulsation sur le bouton micro pendant l'enregistrement — feedback temps réel
- Animation `shake` sur les dots PIN en cas d'erreur — immédiatement compréhensible
- Hover effects cohérents sur les cartes (`translateY(-1px)`, ombre progressive)
- Le header de la landing change d'opacité au scroll — subtil mais agréable
- Scroll reveal sur la landing (IntersectionObserver) — donne de la vie à la page
- Les transitions CSS utilisent des cubic-bezier personnalisés (`0.4, 0, 0.2, 1`) — fluides

**Points faibles :**
- Pas de skeleton loading (juste un spinner). Pour les listes de fiches techniques, un skeleton serait plus "app native"
- Pas de feedback visuel lors du save d'une fiche (le bouton ne change pas d'état entre clic et confirmation toast)
- L'autocomplete des ingrédients apparaît/disparaît sans transition
- Pas de confirmation avant les actions destructrices (suppression d'ingrédient = immédiat, pas d'undo)

---

## 2. Parcours utilisateur critiques

### 2.1 Onboarding (première connexion)

**Score : 8/10**

Le flow est bien pensé : Landing → Choix Restaurant/Fournisseur → Création compte gérant (nom + PIN) → Wizard 5 étapes (Bienvenue → Restaurant → Zones température → Tour features → Finish).

**Points forts :**
- Le wizard est overlay modal avec progress bar — l'utilisateur sait où il en est
- Les zones température sont pré-remplies avec des valeurs HACCP standard — gain de temps énorme
- Slide animations (left/right) pour la navigation entre étapes — feeling natif
- La dernière étape propose 2 CTA clairs : "Créer ma première fiche" ou "Explorer l'app"
- Le PIN pad est tactile-friendly (gros boutons, feedback visuel immédiat)

**Points faibles :**
- Le wizard sauvegarde uniquement en `localStorage` (zones, restaurant info). Si l'API échoue, les données de configuration sont perdues lors d'un changement de device
- Pas de validation sur l'étape Restaurant (on peut tout laisser vide et passer à la suite) — devrait au minimum exiger le nom du restaurant
- L'étape 4 (features tour) est un carousel à 4 slides que l'utilisateur doit scroller un par un — pourrait être un simple résumé en grille pour aller plus vite
- Pas de possibilité de revoir/relancer l'onboarding si on l'a skip

### 2.2 Création de fiche technique

**Score : 8.5/10**

C'est le cœur du produit et c'est bien fait.

**Points forts :**
- Le bouton micro est central et proéminent — impossible de le louper
- L'ajout d'ingrédient avec autocomplete tire depuis la base existante (pré-remplit perte et unité)
- Support des sous-recettes (sélection depuis un dropdown filtré par type) — puissant pour les cuisines pro
- La section tarification montre le food cost en temps réel pendant l'édition
- Le formulaire gère bien le type de recette (Plat final / Sous-recette / Base) avec affichage conditionnel du prix de vente
- Raccourci clavier Enter pour ajouter une étape de procédure

**Points faibles :**
- L'ajout d'ingrédient est un row horizontal dense (5 champs + bouton). Sur mobile, ça force le wrap et la lisibilité souffre
- Pas de drag-and-drop pour réordonner les ingrédients ou les étapes
- Le calcul du food cost en live ne montre que le prix de vente, pas le coût réel des ingrédients (il faudrait attendre la sauvegarde pour ça)
- Pas de brouillon automatique — si on quitte la page par accident, tout est perdu
- L'UX de la saisie des notes d'ingrédient (petit champ "Notes" en fin de ligne) est peu visible

### 2.3 Saisie vocale

**Score : 7.5/10**

**Points forts :**
- Utilise l'API Web Speech Recognition native (pas de dépendance externe côté client)
- `lang: 'fr-FR'` et `continuous: true` — adapté aux dictées longues
- L'IA backend parse le transcript et remplit automatiquement nom, catégorie, portions, ingrédients, étapes
- Feedback visuel clair : état "Écoute", "Analyse en cours", "Succès" avec couleurs différentes

**Points faibles :**
- Le message de succès "Fiche analysée !" est temporaire — l'utilisateur devrait voir un diff de ce qui a été rempli
- Pas de preview du transcript brut avant l'envoi à l'IA — l'utilisateur ne peut pas corriger avant parsing
- Si la reconnaissance vocale échoue (`no-speech`), le message est technique ("Aucune parole détectée") — devrait être plus guidant ("Approchez-vous du micro et parlez clairement")
- `maxAlternatives: 1` — pourrait offrir un fallback avec des alternatives
- Pas d'indicateur de volume/niveau sonore pendant l'enregistrement

### 2.4 Consultation HACCP

**Score : 9/10**

Le module HACCP est le plus complet et le mieux conçu de l'app.

**Points forts :**
- Dashboard unifié avec 3 sections (Températures, Nettoyage, Traçabilité) — vue d'ensemble en un coup d'œil
- Zone cards avec code couleur + texte de statut (OK, ALERTE, Manquant, >4h) — redondance visuelle = accessible
- Bouton "Relever" gros et tactile directement sur chaque zone card — zéro friction pour l'action critique
- Modal de saisie de température avec validation inline et grand input numérique centré — optimisé pour le terrain
- Checklist de nettoyage avec progress bar + gros checkboxes tactiles (40x40px)
- Alertes DLC avec badge coloré et compteur de jours
- La sous-nav HACCP (pills scrollables) permet de naviguer entre les sous-modules facilement

**Points faibles :**
- La gestion des zones n'est accessible que via l'onboarding. Pas de CRUD visible dans les settings pour ajouter/modifier/supprimer des zones après coup (le `haccp-zones-manager` existe dans le CSS mais semble peu exploité)
- L'historique des températures (page Températures) n'a pas de graphique — juste une liste. Un mini-chart sur 7 jours serait très utile pour détecter les tendances

### 2.5 Prise de commande (salle)

**Score : 8/10**

**Points forts :**
- Layout 3 colonnes desktop (plan de salle | commande | suivi) — efficient
- Plan de salle avec grille de boutons carrés, codes couleur par état (libre/brouillon/envoyé/prêt/en retard)
- Animation pulse rouge sur les tables en retard — urgence visuelle immédiate
- Menu groupé par catégorie avec bouton "+" gros et visible
- Quantités ajustables (+/-) avec boutons tactiles 40x40
- Mobile : tabs pour switcher entre les 3 panneaux — bon compromis
- Notes de commande (allergies) bien positionnées

**Points faibles :**
- 20 tables en dur (`SERVICE_TABLE_COUNT = 20`) — devrait être configurable
- Pas de recherche dans le menu (si la carte a 50+ plats)
- Le panier ne montre pas le total par item si la quantité > 1
- Pas de mode split bill / paiement
- La transition entre "pas de table sélectionnée" et "table sélectionnée" est un simple swap de `hidden` — une micro-animation aiderait

### 2.6 Vue cuisine

**Score : 7.5/10**

**Points forts :**
- Tickets style "bonnes de commande" avec timer et items cochables
- Animation slide-in pour les nouveaux tickets
- Distinction visuelle claire entre items en cours (orange) et prêts (vert)
- Bouton "Prêt" individuel par item + "Tout prêt" global

**Points faibles :**
- Pas de son/vibration à l'arrivée d'un nouveau ticket — en cuisine, l'écran n'est pas toujours dans le champ de vision
- Le polling est à 10 secondes (`SERVICE_POLL_INTERVAL = 10000`) — devrait être en WebSocket pour du temps réel
- Pas de filtre par station (entrées froides / chaud / desserts)
- La vue cuisine ne tourne pas en plein écran automatiquement comme la vue Service

---

## 3. Landing Page

### 3.1 Clarté du message

**Score : 8.5/10**

Le headline "Vos fiches techniques en 30 secondes" est clair, spécifique et orienté bénéfice. Le subtitle "Dictez votre recette, l'IA calcule les coûts. Le premier assistant cuisine pensé par un chef." renforce avec la preuve sociale implicite ("pensé par un chef").

Le tagline footer "Votre cuisine tourne. Vos chiffres suivent." est excellent — mémorable et pertinent.

### 3.2 Hiérarchie visuelle

**Score : 7.5/10**

**Points forts :**
- Hero section avec texte à gauche, mockup app à droite — pattern classique et efficace
- Le mockup montre une vraie fiche technique (Tarte au citron meringuée, 3.20€, food cost 28%) — concret et crédible
- L'animation du micro dans le mockup vend visuellement la feature clé
- Les feature cards en grille 3 colonnes avec icônes accent sont lisibles
- La section "3 étapes" avec connected line est bien exécutée

**Points faibles :**
- Les sections sous le hero utilisent un `reveal` animation (IntersectionObserver) qui rend le contenu invisible tant qu'on n'a pas scrollé. Sur le screenshot, tout le contenu sous le hero est vide — **problème critique** si JS échoue ou si l'observer ne se déclenche pas
- Pas de vraie image/screenshot de l'app — le mockup codé en HTML est bien mais un vrai screenshot de l'app en action serait plus convaincant
- Les sections Features et Pricing sont sur fond `--bg-elevated` (identique) — pas assez de contraste entre elles

### 3.3 CTA efficacité

**Score : 8/10**

- CTA principal "Démarrer gratuitement" bien placé (hero + header + CTA final) — répétition correcte
- CTA secondaire "Découvrir" → scroll to features — bon
- Trust line "Aucune carte bancaire requise" répétée 2 fois — rassure bien
- Le CTA "S'abonner — 39€/mois" sur la pricing card Pro a un handler Stripe intégré — flow direct

**Manque :**
- Pas de CTA sticky sur mobile (le header CTA est `display: none` sous 768px, et le hero CTA scroll hors de vue)
- La FAQ et le footer n'ont pas de CTA

### 3.4 Pricing table

**Score : 8.5/10**

**Points forts :**
- 3 plans clairement différenciés (Essai Gratuit / Pro / Business)
- Le plan Pro est visuellement mis en avant (bordure accent + badge "Populaire" + shadow)
- L'essai gratuit est généreux (60 jours, accès complet) — réduit la friction
- L'option annuelle est mentionnée inline sur le Pro ("31€/mois facturé annuellement — Économisez 20%")
- Chaque feature a une icône check verte — scannabilité optimale

**Points faibles :**
- Le plan Business à 79€ a moins de features listées que le Pro — ce qui est contre-intuitif visuellement. Ajouter des lignes type "Tout le plan Pro + ..."
- Pas de toggle mensuel/annuel (le prix annuel est juste un texte sous le prix mensuel)
- Le CTA du plan gratuit ("Démarrer mon essai gratuit") et celui du Pro ("S'abonner") mènent au même endroit (`/app`). L'utilisateur ne sait pas à quoi s'attendre

### 3.5 Crédibilité / Trust signals

**Score : 6.5/10**

**Points forts :**
- "Aucune carte bancaire requise" — fort signal de confiance
- "Données sécurisées, transfert conforme au Data Privacy Framework UE-US" — crédibilise
- 3 témoignages avec étoiles, citations et rôles — structure correcte
- Le label "exemple" sur les testimonials est honnête (ils sont fictifs) — bien, mais c'est aussi un aveu de faiblesse

**Points faibles :**
- **Aucune preuve sociale réelle** : pas de logo clients, pas de nombre d'utilisateurs, pas de reviews vérifiées
- Les témoignages sont clairement factices (badge "exemple") — mieux vaut les retirer que de les laisser labellisés comme faux
- Pas de "as seen in" / press mentions
- Pas de certifications sécurité visibles (RGPD badge, SSL, etc.)
- Le pied de page montre "© 2026 RestoSuite — Paul-Aymeric Barbier" — identifie un individu, pas une entreprise. Réduit la crédibilité perçue pour un SaaS B2B

### 3.6 SEO basics

**Score : 7/10**

**Points forts :**
- `<title>` descriptif et contenant le mot-clé principal
- `<meta description>` avec CTA et bénéfice
- `og:image`, `og:title`, `og:description` présents
- `lang="fr"` sur `<html>`
- Scroll smooth activé
- Structure sémantique (`<header>`, `<nav>`, `<section>`, `<footer>`)

**Points faibles :**
- Aucun `<h2>` ou heading dans les sections n'a d'`id` pour les ancres — les liens nav (`#fonctionnalites`) ciblent des sections mais sans ancre sur le `<h2>` lui-même
- Pas de balise `<meta robots>` ni de `sitemap.xml` mentionné
- Pas de structured data (JSON-LD pour SoftwareApplication)
- Les images n'ont pas de `width`/`height` explicites (CLS potentiel)
- Le CSS est entièrement inline dans le `<style>` — pas de fichier externe cacheble
- Pas de `<link rel="canonical">`

---

## 4. Points forts vs Points faibles

### 🏆 Top 5 Points Forts

1. **Dark mode natif d'excellente qualité** — Le système de 3 niveaux de surface, la palette navy/orange, et le contraste texte sont parmi les meilleurs que j'ai vus dans le SaaS B2B français. C'est un vrai design, pas un thème inversé.

2. **Module HACCP complet et ergonomique** — Le dashboard avec zones de température, checklist de nettoyage, et traçabilité DLC couvre les besoins réglementaires avec une UX pensée pour le terrain (gros boutons, modal de saisie rapide, feedback visuel immédiat).

3. **Architecture mobile-first cohérente** — Bottom tab bar mobile → top bar desktop, touch targets 44px, safe-area-inset, grids responsifs. L'app est clairement pensée pour une tablette en cuisine.

4. **Saisie vocale IA bien intégrée** — Le flow dictée → parsing IA → remplissage auto du formulaire est fluide. Le bouton micro est proéminent et le feedback d'état (écoute/analyse/succès) est clair.

5. **Système de rôles et permissions granulaire** — Gérant/Cuisinier/Salle/Équipier avec permissions par feature (view_costs, edit_recipes, view_suppliers, export_pdf). Le PIN pad pour le login multi-compte est parfait pour un contexte restaurant (plusieurs employés, un seul device).

### 🔧 Top 10 Améliorations Prioritaires (par impact décroissant)

| # | Amélioration | Impact | Effort |
|---|---|---|---|
| 1 | **Fix le reveal animation de la landing** — Les sections sous le hero sont invisibles si JS est lent ou si l'observer ne se trigger pas. Ajouter un fallback CSS (`.reveal { opacity: 1 }` dans un `<noscript>` ou un timeout) | 🔴 Critique — la landing est le premier contact | Faible |
| 2 | **Ajouter un auto-save / brouillon sur le formulaire de recette** — L'utilisateur perd tout si il quitte la page par accident | 🔴 Élevé — friction majeure sur le parcours cœur | Moyen |
| 3 | **Améliorer l'accessibilité** — Ajouter `aria-label` sur tous les boutons icon-only, `role="alert"` sur les toasts, rendre les cartes cliquables navigables au clavier (`<a>` ou `tabindex`) | 🔴 Élevé — conformité et utilisabilité | Moyen |
| 4 | **Ajouter un light mode** — Les cuisines pro ont souvent un éclairage cru (néons blancs). Un dark mode seul peut poser des problèmes de lisibilité dans certains contextes | 🟠 Élevé — segment utilisateur large | Élevé |
| 5 | **Remplacer le polling par WebSocket pour la cuisine** — 10 secondes de latence sur les commandes est inacceptable en service. Un ticket qui arrive avec 10s de retard = plats en retard | 🟠 Élevé — impact opérationnel direct | Moyen |
| 6 | **Ajouter une notification sonore en vue cuisine** — En cuisine, l'écran est rarement dans le champ de vision. Un son + vibration à l'arrivée d'un ticket est indispensable | 🟠 Élevé — sans ça, la feature est peu utilisable en conditions réelles | Faible |
| 7 | **Refactorer le formulaire d'ajout d'ingrédient pour mobile** — Passer de 5 champs en ligne à un flow en 2 rangées ou un mini-modal | 🟡 Moyen — friction mobile sur le parcours cœur | Faible |
| 8 | **Retirer les témoignages factices de la landing** — Le badge "exemple" détruit la crédibilité. Mieux vaut pas de témoignages que des faux assumés. Les remplacer par des métriques ("60 jours gratuits", "Créé par un chef pro") | 🟡 Moyen — trust et conversion landing | Faible |
| 9 | **Ajouter un CTA sticky mobile sur la landing** — Le bouton "Démarrer gratuitement" disparaît quand on scroll. Un sticky bottom bar sur mobile améliorerait significativement la conversion | 🟡 Moyen — conversion mobile | Faible |
| 10 | **Ajouter des skeleton loaders** — Remplacer le spinner générique par des skeletons sur les listes (fiches, stock, commandes) pour un feeling plus natif et un perceived performance amélioré | 🟢 Modéré — polish et perception de qualité | Faible |

---

## 5. Score Global

| Critère | Score |
|---|---|
| Cohérence visuelle | 8/10 |
| Dark mode | 9/10 |
| Typographie & hiérarchie | 7.5/10 |
| Navigation & IA | 8/10 |
| Responsive / Mobile | 8.5/10 |
| Accessibilité | 6/10 |
| Micro-interactions | 8/10 |
| Onboarding | 8/10 |
| Parcours fiche technique | 8.5/10 |
| Saisie vocale | 7.5/10 |
| HACCP | 9/10 |
| Prise de commande | 8/10 |
| Vue cuisine | 7.5/10 |
| Landing page | 7.5/10 |
| Trust & crédibilité | 6.5/10 |

### **Score global : 7.8 / 10**

**Résumé :** RestoSuite est un produit remarquablement bien construit pour un SaaS B2B de niche. Le design system est solide, le dark mode est de très haute qualité, et les modules métier (HACCP, fiches techniques, commandes) couvrent les besoins réels avec une UX pensée pour le terrain. Les principaux axes d'amélioration sont l'accessibilité (le point le plus faible), la landing page (fix le reveal + retirer les faux témoignages), et quelques optimisations temps réel pour la cuisine (WebSocket, sons). Le produit est prêt pour une mise en marché — les 10 améliorations listées le pousseraient facilement au-dessus de 8.5/10.

---

*Rapport généré le 2 avril 2026 — Revue code source + live testing*
