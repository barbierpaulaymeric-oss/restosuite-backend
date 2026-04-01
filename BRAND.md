# RestoSuite AI — Brand Guidelines

> Document créé le 1er avril 2026
> Direction artistique complète — identité visuelle, UI kit, stratégie de marque

---

## Table des matières

1. [Nom & Positionnement](#1-nom--positionnement)
2. [Palette de couleurs](#2-palette-de-couleurs)
3. [Typographie](#3-typographie)
4. [Logo](#4-logo)
5. [Style d'interface (UI Kit)](#5-style-dinterface-ui-kit)
6. [Iconographie](#6-iconographie)
7. [Analyse concurrentielle](#7-analyse-concurrentielle)

---

## 1. Nom & Positionnement

### Le nom : **RestoSuite AI**

**Verdict : on garde.** Voici pourquoi :

- **"Resto"** — immédiatement identifiable par la cible française. Pas d'ambiguïté.
- **"Suite"** — communique "tout-en-un" sans explication. C'est le mot exact que les pros comprennent (cf. Adobe Suite, Google Suite). Ça dit "complet" et "intégré".
- **"AI"** — positionne le produit dans la modernité sans être buzzword. Les chefs ne veulent pas de l'IA pour l'IA, mais ils veulent un outil intelligent. Le "AI" promet que le logiciel travaille POUR eux, pas l'inverse.

Le nom est court (4 syllabes), mémorable, et dit exactement ce que fait le produit. C'est rare. On ne touche pas.

#### Alternatives considérées (et rejetées)

| Nom | Pourquoi non |
|-----|-------------|
| **CuisineOS** | Trop tech, trop froid. Un chef ne dit pas "mon OS". |
| **ChefPilot** | Trop cute, manque de gravitas pour un outil de gestion financière. |
| **RestoCore** | Bon mais "Core" est abstrait. "Suite" est plus parlant. |

### Tagline

> **« Votre cuisine tourne. Vos chiffres suivent. »**

Pourquoi cette tagline :
- Elle parle au quotidien du restaurateur (la cuisine qui tourne = le service)
- Elle promet le résultat (les chiffres suivent = rentabilité sous contrôle)
- Elle est courte, rythme binaire, facile à retenir
- Elle ne mentionne pas l'IA — parce que les chefs s'en foutent de la techno, ils veulent le résultat

#### Variantes contextuelles

- **Page d'accueil :** « Votre cuisine tourne. Vos chiffres suivent. »
- **App Store :** « Gestion complète pour restaurants professionnels »
- **Pitch court :** « Le copilote de gestion des restaurateurs »

### Tone of Voice

**4 adjectifs :**

1. **Direct** — Pas de blabla. On dit les choses.
2. **Expert** — On connaît le métier. On parle comme un pro à un pro.
3. **Rassurant** — L'outil est là pour simplifier, pas compliquer.
4. **Concret** — Toujours des chiffres, des résultats, du tangible.

**Exemples :**

| Situation | ❌ Ne pas écrire | ✅ Écrire |
|-----------|-----------------|----------|
| Onboarding | "Bienvenue dans votre voyage culinaire digital !" | "C'est parti. Ajoutez votre premier ingrédient." |
| Alerte stock | "Il semblerait que certains articles nécessitent votre attention." | "Crème fraîche : stock critique. 2 jours restants." |
| Succès | "Félicitations ! Vous avez accompli une étape importante !" | "Fiche technique enregistrée. Coût matière : 3.20€." |
| Erreur | "Oups ! Quelque chose s'est mal passé." | "Erreur de connexion au fournisseur. Réessayer." |

**Règle d'or :** Chaque mot doit mériter sa place. Si on peut le supprimer sans perdre le sens → on le supprime.

---

## 2. Palette de couleurs

### Philosophie

Les restaurateurs alternent entre cuisines très éclairées (néons) et salles sombres. L'écran est consulté mains mouillées, en plein rush, souvent une tablette posée à côté du pass. Le contraste doit être **immédiat** — aucun effort visuel pour distinguer les éléments critiques.

### Couleurs principales

#### Primaire — Bleu Ardoise Profond
**`#1B2A4A`**

Pourquoi : Le bleu est la couleur de la confiance (banques, santé, SaaS). Mais pas un bleu corporate froid — un bleu ardoise, comme l'ardoise d'un menu. Il ancre le produit dans l'univers de la restauration tout en communiquant fiabilité et sérieux. C'est la couleur de la sidebar, du header, des éléments structurels.

#### Secondaire — Blanc Crème
**`#F7F5F2`**

Pourquoi : Pas un blanc pur (#FFF) qui agresse les yeux sous néon de cuisine. Un blanc légèrement chaud, comme une nappe de bistrot. Repose les yeux, améliore la lisibilité longue durée. Background principal en light mode.

#### Accent — Orange Cuivre
**`#E8722A`**

Pourquoi : Le cuivre des casseroles. Immédiatement "cuisine" sans être cliché. C'est la couleur des CTA, des éléments cliquables, de tout ce qui dit "agis ici". Excellent contraste sur fond sombre ET clair. Ratio WCAG AAA sur `#1B2A4A`.

### Couleurs fonctionnelles

| Fonction | Couleur | HEX | Usage |
|----------|---------|-----|-------|
| **Succès** | Vert Basilic | `#2D8B55` | Validation, stock OK, HACCP conforme |
| **Warning** | Jaune Safran | `#E5A100` | Alertes stock bas, DLC proche |
| **Danger** | Rouge Piment | `#D93025` | Stock critique, HACCP non-conforme, erreurs |
| **Info** | Bleu Ciel | `#4A90D9` | Tooltips, infos complémentaires |

### Backgrounds

| Mode | Surface principale | Surface élevée (cartes) | Surface enfoncée (inputs) | Texte principal | Texte secondaire |
|------|--------------------|-------------------------|---------------------------|-----------------|------------------|
| **Light** | `#F7F5F2` | `#FFFFFF` | `#EDEAE6` | `#1B2A4A` | `#6B7280` |
| **Dark** | `#0F1723` | `#1B2A4A` | `#0A1019` | `#F7F5F2` | `#9CA3AF` |

### CSS — Variables de couleur

```css
:root {
  /* Primaires */
  --color-primary: #1B2A4A;
  --color-primary-light: #2A3F6B;
  --color-primary-dark: #111C33;
  
  /* Secondaire */
  --color-secondary: #F7F5F2;
  
  /* Accent */
  --color-accent: #E8722A;
  --color-accent-hover: #D4611F;
  --color-accent-light: #FFF0E6;
  
  /* Fonctionnelles */
  --color-success: #2D8B55;
  --color-success-light: #E8F5EE;
  --color-warning: #E5A100;
  --color-warning-light: #FFF8E6;
  --color-danger: #D93025;
  --color-danger-light: #FDE8E7;
  --color-info: #4A90D9;
  --color-info-light: #E8F1FB;
  
  /* Surfaces — Light Mode */
  --bg-base: #F7F5F2;
  --bg-elevated: #FFFFFF;
  --bg-sunken: #EDEAE6;
  --text-primary: #1B2A4A;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;
  --border-default: #D1CCC6;
  --border-light: #E5E1DB;
}

[data-theme="dark"] {
  --bg-base: #0F1723;
  --bg-elevated: #1B2A4A;
  --bg-sunken: #0A1019;
  --text-primary: #F7F5F2;
  --text-secondary: #9CA3AF;
  --text-tertiary: #6B7280;
  --border-default: #2A3F6B;
  --border-light: #1E3055;
}
```

---

## 3. Typographie

### Choix des polices

#### Titres — **Inter**
- **Poids :** 600 (SemiBold) pour les H1-H2, 500 (Medium) pour H3-H4
- **Pourquoi Inter :** C'est la police de référence du SaaS moderne. Dessinée spécifiquement pour les écrans, lisibilité parfaite en petit, caractères distinctifs (pas de confusion 1/l/I). Les restaurateurs n'ont pas le temps de plisser les yeux.

#### Corps de texte — **Inter**
- **Poids :** 400 (Regular), 500 (Medium) pour l'emphase
- **Pourquoi la même :** Une seule famille = cohérence maximale, chargement minimal, maintenance zéro. Inter couvre tous les cas d'usage body. Pas besoin de multiplier les fonts.

#### Chiffres / Données financières — **JetBrains Mono**
- **Poids :** 400 (Regular), 500 (Medium)
- **Pourquoi :** Monospace taillée pour la lisibilité des chiffres. Les caractères numériques sont parfaitement alignés en colonnes — crucial pour les tableaux de coûts, les marges, les inventaires. Alternative gratuite supérieure à Roboto Mono (meilleure distinction 0/O, chiffres plus ouverts).

### Échelle typographique (mobile-first)

```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  /* Font families */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
  
  /* Scale — Mobile first (base 16px) */
  --text-xs: 0.75rem;    /* 12px — labels, captions */
  --text-sm: 0.875rem;   /* 14px — body small, secondary info */
  --text-base: 1rem;     /* 16px — body default */
  --text-lg: 1.125rem;   /* 18px — body large, important */
  --text-xl: 1.25rem;    /* 20px — H4 */
  --text-2xl: 1.5rem;    /* 24px — H3 */
  --text-3xl: 1.875rem;  /* 30px — H2 */
  --text-4xl: 2.25rem;   /* 36px — H1 */
  
  /* Line heights */
  --leading-tight: 1.2;   /* Titres */
  --leading-normal: 1.5;  /* Corps */
  --leading-relaxed: 1.7; /* Texte long */
  
  /* Letter spacing */
  --tracking-tight: -0.02em;  /* Titres */
  --tracking-normal: 0;       /* Corps */
  --tracking-wide: 0.02em;    /* Labels, captions uppercase */
}

/* Responsive — Tablet+ */
@media (min-width: 768px) {
  :root {
    --text-xl: 1.375rem;  /* 22px */
    --text-2xl: 1.75rem;  /* 28px */
    --text-3xl: 2.25rem;  /* 36px */
    --text-4xl: 3rem;     /* 48px */
  }
}

/* Headings */
h1 { font: 700 var(--text-4xl)/var(--leading-tight) var(--font-sans); letter-spacing: var(--tracking-tight); }
h2 { font: 600 var(--text-3xl)/var(--leading-tight) var(--font-sans); letter-spacing: var(--tracking-tight); }
h3 { font: 600 var(--text-2xl)/var(--leading-tight) var(--font-sans); }
h4 { font: 500 var(--text-xl)/var(--leading-tight) var(--font-sans); }

/* Body */
body { font: 400 var(--text-base)/var(--leading-normal) var(--font-sans); }

/* Monospace data */
.data-value, .price, .quantity, .percentage {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

### Règles typographiques

- **Minimum 14px** pour tout texte interactif (doigts mouillés sur écran tactile = toucher imprécis)
- **Minimum 16px** pour le body sur mobile (pas de zoom nécessaire)
- **Chiffres toujours en JetBrains Mono** — même dans une phrase, un prix s'affiche en mono
- **Pas de texte justifié** — alignement gauche uniquement (lisibilité scan rapide)
- **Contraste minimum 4.5:1** (WCAG AA) pour tout texte, **7:1** (AAA) pour les données critiques

---

## 4. Logo

### Concept

Le logo combine deux symboles :
1. **Un losange / diamant** — forme géométrique simple qui évoque la précision, la qualité, le "diamant brut" qu'est un restaurant bien géré
2. **Une toque stylisée** — intégrée subtilement dans la partie supérieure du diamant, elle ancre immédiatement le logo dans la restauration

Le tout forme un **badge compact** — comme un label de qualité qu'on mettrait sur une carte. Il fonctionne aussi bien en favicon 16x16 qu'en bannière.

### SVG — Logo principal (Logotype)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" fill="none">
  <!-- Icône : Diamant-Toque -->
  <g transform="translate(0, 4)">
    <!-- Corps du diamant -->
    <path d="M20 4 L36 20 L20 38 L4 20 Z" fill="#E8722A" />
    <!-- Facette supérieure (toque) -->
    <path d="M20 4 L12 14 L20 12 L28 14 Z" fill="#1B2A4A" />
    <!-- Ligne centrale du diamant -->
    <path d="M4 20 L12 14 L20 12 L28 14 L36 20" fill="none" stroke="#1B2A4A" stroke-width="1.5" />
  </g>
  <!-- Texte : RestoSuite -->
  <text x="52" y="28" font-family="Inter, sans-serif" font-weight="600" font-size="22" fill="#1B2A4A" letter-spacing="-0.5">
    Resto<tspan font-weight="700">Suite</tspan>
  </text>
  <!-- Texte : AI -->
  <rect x="188" y="12" width="36" height="24" rx="6" fill="#E8722A" />
  <text x="206" y="29" font-family="Inter, sans-serif" font-weight="700" font-size="14" fill="#FFFFFF" text-anchor="middle">AI</text>
</svg>
```

### SVG — Icône seule (Favicon / App Icon)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
  <!-- Diamant-Toque -->
  <path d="M20 2 L38 20 L20 38 L2 20 Z" fill="#E8722A" />
  <path d="M20 2 L10 14 L20 11 L30 14 Z" fill="#1B2A4A" />
  <path d="M2 20 L10 14 L20 11 L30 14 L38 20" fill="none" stroke="#1B2A4A" stroke-width="2" />
</svg>
```

### Variantes

| Variante | Usage | Spécification |
|----------|-------|--------------|
| **Full color** | Default sur fond clair | Diamant orange + texte bleu ardoise + badge AI orange |
| **Full color (dark)** | Sur fond sombre | Diamant orange + texte blanc `#F7F5F2` + badge AI orange |
| **Monochrome blanc** | Sur photo, overlay | Tout en `#FFFFFF` |
| **Monochrome sombre** | Documents imprimés | Tout en `#1B2A4A` |
| **Favicon** | 16x16, 32x32 | Icône diamant seule, sans texte |
| **App icon** | iOS/Android | Diamant centré sur fond `#1B2A4A`, coins arrondis natifs |

### Zones de protection

- **Espace minimum** autour du logo = hauteur du "AI badge" (24px à l'échelle native) sur tous les côtés
- **Taille minimum** du logotype complet = 120px de large
- **Taille minimum** de l'icône seule = 16px

### Interdits

- ❌ Pas de rotation du logo
- ❌ Pas de dégradés ajoutés
- ❌ Pas de changement de proportions
- ❌ Pas de fond coloré qui entre en conflit (pas de rouge, pas de vert)
- ❌ Ne jamais écrire "RESTOSUITE" tout en majuscules

---

## 5. Style d'interface (UI Kit)

### Principes fondamentaux

1. **Dense mais lisible** — les restaurateurs gèrent des dizaines d'ingrédients, de fiches. L'interface doit montrer beaucoup d'infos sans étouffer.
2. **Touch-first** — zones tactiles minimum 44x44px. Doigts mouillés, écran graisseux.
3. **Scan > Read** — l'info critique doit être visible en 2 secondes max. Couleurs fonctionnelles, icônes, badges.

### Boutons

```css
/* Bouton primaire */
.btn-primary {
  background: var(--color-accent);
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  padding: 12px 24px;
  font: 500 var(--text-base)/1 var(--font-sans);
  min-height: 48px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
.btn-primary:hover {
  background: var(--color-accent-hover);
  box-shadow: 0 2px 8px rgba(232,114,42,0.3);
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

/* Bouton secondaire */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1.5px solid var(--border-default);
  border-radius: 10px;
  padding: 12px 24px;
  font: 500 var(--text-base)/1 var(--font-sans);
  min-height: 48px;
  transition: all 0.15s ease;
}
.btn-secondary:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
}

/* Bouton ghost (tableaux, actions inline) */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  min-height: 36px;
  transition: all 0.15s ease;
}
.btn-ghost:hover {
  background: var(--bg-sunken);
  color: var(--text-primary);
}

/* Bouton danger */
.btn-danger {
  background: var(--color-danger);
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  padding: 12px 24px;
  min-height: 48px;
}
```

**Règles :**
- **border-radius: 10px** — arrondi doux mais pas bulle. Pro, pas playful.
- **min-height: 48px** sur mobile — zone tactile confortable
- **Pas de shadows lourdes** — juste un soupçon pour la hiérarchie
- **Transitions 150ms** — réactif sans être nerveux

### Cartes

```css
.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 16px;
  transition: box-shadow 0.2s ease;
}
.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}

/* Carte recette */
.card-recipe {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  align-items: center;
  gap: 12px;
}
.card-recipe__image {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
}
.card-recipe__cost {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--color-accent);
}

/* Carte fournisseur */
.card-supplier {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-supplier__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--text-sm);
}

/* Carte ingrédient avec indicateur de stock */
.card-ingredient__stock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: var(--text-xs);
  font-weight: 500;
}
.card-ingredient__stock--ok { background: var(--color-success-light); color: var(--color-success); }
.card-ingredient__stock--low { background: var(--color-warning-light); color: var(--color-warning); }
.card-ingredient__stock--critical { background: var(--color-danger-light); color: var(--color-danger); }
```

### Tableaux (données financières)

```css
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}
.table th {
  text-align: left;
  padding: 12px 16px;
  font-weight: 500;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-secondary);
  background: var(--bg-sunken);
  border-bottom: 1px solid var(--border-default);
  position: sticky;
  top: 0;
  z-index: 1;
}
.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}
.table tr:hover td {
  background: var(--bg-sunken);
}

/* Colonnes numériques alignées à droite */
.table td.numeric,
.table th.numeric {
  text-align: right;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* Ligne total */
.table tr.total td {
  font-weight: 600;
  border-top: 2px solid var(--color-primary);
  background: var(--bg-sunken);
}
```

**Règles tableaux :**
- **Headers sticky** — toujours visible même en scroll
- **Colonnes chiffres en mono** et alignées à droite
- **Hover row** — highlight subtil pour suivre la ligne
- **Pas de bordures verticales** — plus clean, plus moderne
- **Mobile :** les tableaux deviennent des cartes empilées sous 640px

### Navigation

#### Mobile — Bottom Tab Bar

```css
.nav-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
}
.nav-bottom__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  text-decoration: none;
  transition: color 0.15s;
}
.nav-bottom__item--active {
  color: var(--color-accent);
}
.nav-bottom__item--active .nav-bottom__icon {
  color: var(--color-accent);
}
```

**5 onglets mobile :**
1. 🏠 Accueil (dashboard)
2. 📋 Fiches (techniques)
3. 📦 Stock
4. 🛒 Commandes
5. ⚙️ Plus (HACCP, analytics, settings)

#### Desktop — Sidebar

```css
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 240px;
  height: 100vh;
  background: var(--color-primary);
  color: #FFFFFF;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  overflow-y: auto;
}
.sidebar--collapsed {
  width: 64px;
}
.sidebar__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  color: rgba(255,255,255,0.7);
  font-size: var(--text-sm);
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s;
  border-left: 3px solid transparent;
}
.sidebar__item:hover {
  background: rgba(255,255,255,0.08);
  color: #FFFFFF;
}
.sidebar__item--active {
  background: rgba(255,255,255,0.12);
  color: #FFFFFF;
  border-left-color: var(--color-accent);
}
```

**Sidebar desktop :**
- Bleu ardoise profond `#1B2A4A` — cohérent avec la marque
- Indicateur actif = barre orange à gauche
- Collapsible en icônes-only pour plus d'espace de travail
- Logo en haut, profil utilisateur en bas

### Formulaires

```css
/* Input text */
.input {
  width: 100%;
  padding: 12px 16px;
  font: 400 var(--text-base)/1.5 var(--font-sans);
  color: var(--text-primary);
  background: var(--bg-sunken);
  border: 1.5px solid var(--border-default);
  border-radius: 10px;
  min-height: 48px;
  transition: all 0.15s ease;
  -webkit-appearance: none;
}
.input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(232,114,42,0.15);
  background: var(--bg-elevated);
}
.input::placeholder {
  color: var(--text-tertiary);
}
.input--error {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 3px rgba(217,48,37,0.1);
}

/* Label */
.label {
  display: block;
  font: 500 var(--text-sm)/1 var(--font-sans);
  color: var(--text-primary);
  margin-bottom: 6px;
}

/* Select */
.select {
  appearance: none;
  width: 100%;
  padding: 12px 40px 12px 16px;
  font: 400 var(--text-base)/1.5 var(--font-sans);
  background: var(--bg-sunken) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") right 12px center no-repeat;
  border: 1.5px solid var(--border-default);
  border-radius: 10px;
  min-height: 48px;
}

/* Toggle */
.toggle {
  position: relative;
  width: 52px;
  height: 28px;
  background: var(--border-default);
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.toggle--active {
  background: var(--color-accent);
}
.toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.toggle--active .toggle__thumb {
  transform: translateX(24px);
}
```

### Bouton Micro (Voice Input)

Le bouton micro est un élément central de l'UX. Les chefs ont les mains occupées — c'est leur raccourci principal.

```css
/* Bouton Micro — Floating Action Button */
.mic-button {
  position: fixed;
  bottom: 84px; /* au-dessus de la bottom nav */
  right: 20px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(232,114,42,0.4);
  transition: all 0.2s ease;
  z-index: 90;
}
.mic-button:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(232,114,42,0.5);
}

/* État actif — écoute en cours */
.mic-button--listening {
  background: var(--color-danger);
  animation: mic-pulse 1.5s ease-in-out infinite;
  box-shadow: 0 4px 16px rgba(217,48,37,0.4);
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 4px 16px rgba(217,48,37,0.4); }
  50% { box-shadow: 0 4px 32px rgba(217,48,37,0.6), 0 0 0 12px rgba(217,48,37,0.1); }
}

/* Icône micro à l'intérieur : 28px */
.mic-button__icon {
  width: 28px;
  height: 28px;
}

/* Desktop : position en bas à droite, même style */
@media (min-width: 768px) {
  .mic-button {
    bottom: 32px;
    right: 32px;
    width: 72px;
    height: 72px;
  }
  .mic-button__icon {
    width: 32px;
    height: 32px;
  }
}
```

**Design du bouton micro :**
- **FAB orange** (Floating Action Button) — impossible à rater
- **Position fixe** en bas à droite, toujours accessible
- **Au repos :** icône micro blanche sur fond orange, shadow prononcée
- **En écoute :** passe au rouge avec une animation de pulsation douce (anneau qui s'étend)
- **Feedback immédiat :** quand l'utilisateur parle, un indicateur de niveau audio en cercle autour du bouton
- **Label au premier lancement :** tooltip "Dictez vos ingrédients" qui disparaît après 3 utilisations

### Micro-interactions

| Action | Animation | Durée | Détail |
|--------|-----------|-------|--------|
| **Ajout d'item** | Slide-in depuis la droite + fade | 200ms | L'item glisse en place |
| **Suppression** | Slide-out vers la gauche + fade | 200ms | Swipe-to-delete sur mobile |
| **Validation** | Checkmark animé (stroke-dasharray) | 400ms | Le ✓ se dessine |
| **Erreur** | Shake horizontal (3 oscillations) | 300ms | L'input secoue légèrement |
| **Loading** | Skeleton shimmer | continu | Blocs gris avec vague de lumière |
| **Pull-to-refresh** | Rotation icône + elastic bounce | 500ms | Naturel, comme une app native |
| **Toggle switch** | Elastic overshoot du thumb | 250ms | Le rond dépasse légèrement puis revient |
| **Changement de tab** | Crossfade du contenu + glissement de l'indicateur actif | 200ms | Fluide, pas de flash blanc |
| **Toast notification** | Slide-in par le haut + auto-dismiss | Apparition 300ms, visible 3s | S'adapte au type (succès vert, erreur rouge) |

**Principes d'animation :**
- **Easing : ease-out** pour les entrées, **ease-in** pour les sorties
- **Jamais plus de 400ms** — au-delà, ça ralentit l'utilisateur
- **Pas d'animation pendant le rush** — option "mode service" qui désactive toutes les animations non-essentielles
- **Reduce motion** respecté : `@media (prefers-reduced-motion: reduce)` → toutes les transitions à 0ms

---

## 6. Iconographie

### Style : Outlined, épaisseur 1.5px

**Pourquoi outlined :**
- Plus léger visuellement que filled → interface moins lourde
- Meilleure lisibilité sur petits écrans quand les icônes sont denses
- Cohérent avec l'approche "clean et pro" de la marque
- Plus facile à coloriser (stroke vs fill)

**Épaisseur 1.5px :** Compromis entre la finesse d'un trait 1px (illisible en petit) et la lourdeur d'un 2px. Optimal à 24px, tient à 20px.

**Set recommandé : [Lucide Icons](https://lucide.dev/)** — fork amélioré de Feather, gratuit MIT, 1400+ icônes, parfaitement cohérent en outlined 1.5px. Compatible React, Vue, et SVG brut.

### Icônes spécifiques au domaine

| Fonction | Icône Lucide | Nom | Alternative |
|----------|-------------|-----|-------------|
| **Fiche technique** | 📄 | `file-text` | `clipboard-list` pour les fiches recette |
| **Ingrédient** | 🥕 | `carrot` (custom) | `circle-dot` avec label |
| **Fournisseur** | 🚚 | `truck` | `building-2` pour le côté entreprise |
| **Stock** | 📦 | `package` | `warehouse` si disponible |
| **Commande** | 🛒 | `shopping-cart` | `clipboard-check` pour commande validée |
| **HACCP** | 🛡️ | `shield-check` | `thermometer` pour les relevés température |
| **Analytics** | 📊 | `bar-chart-3` | `trending-up` pour les tendances |
| **Micro/Voix** | 🎤 | `mic` | `mic-off` pour l'état inactif |
| **Dashboard** | 🏠 | `layout-dashboard` | — |
| **Settings** | ⚙️ | `settings` | — |
| **Recherche** | 🔍 | `search` | — |
| **Ajouter** | ➕ | `plus` | `plus-circle` pour plus de visibilité |
| **Alertes** | 🔔 | `bell` | `bell-ring` pour notification active |
| **Utilisateur** | 👤 | `user` | `chef-hat` (custom) |

### Icônes custom à créer

Pour les éléments très spécifiques au métier, 3 icônes custom à créer en SVG :

1. **Toque de chef** — pour le profil utilisateur / mode chef
2. **Fiche technique** — un document avec une fourchette intégrée
3. **Thermomètre HACCP** — thermomètre avec check intégré

Ces icônes doivent respecter la grille 24x24, stroke 1.5px, style Lucide.

### Émojis vs Icônes

**Pas d'émojis dans l'interface.** Les émojis :
- Rendent différemment sur Android, iOS, et navigateurs
- Sont impossibles à contrôler en taille et alignement
- Donnent un aspect "app de chat", pas "outil pro"

**Exception :** Les émojis peuvent être utilisés dans les messages de la marque (notifications push, emails marketing) pour humaniser le ton. Jamais dans l'UI du produit.

---

## 7. Analyse concurrentielle

### Vue d'ensemble

| Critère | **Koust** | **Inpulse** | **Yokitup** | **Zenchef** |
|---------|-----------|-------------|-------------|-------------|
| **Positionnement** | Gestion achats + marges | IA prédictive chaînes | Gratuit fiches/stock | Réservation + CRM |
| **Cible** | Indépendants + chaînes | Chaînes 5-300 sites | Indépendants (entrée) | Front-of-house |
| **Couleur dominante** | Bleu-vert teal | Violet/Indigo | Orange vif | Bleu clair |
| **Typo** | Sans-serif générique | Moderne, géométrique | Ronde, friendly | Clean, corporate |
| **Ton** | Technique, axé données | Premium, "AI-powered" | Accessible, gratuit | Élégant, hôtellerie |
| **Force visuelle** | Fonctionnel, dense | Moderne, bien exécuté | Simple, direct | Raffiné, photos food |
| **Faiblesse visuelle** | Daté, surchargé | Trop corporate pour indépendants | Cheap, manque de gravitas | Pas de back-of-house |

### Analyse détaillée

#### Koust
- **Ce qui marche :** Focus clair sur les marges et les achats. Le messaging est concret ("5% de marge en plus").
- **Ce qui ne marche pas :** L'interface est visuellement datée — beaucoup de bordures, de tableaux bruts, palette incohérente. Le branding manque de personnalité. On dirait un ERP des années 2010 maquillé en SaaS.
- **Leçon :** Le messaging axé résultats fonctionne. L'exécution visuelle ne suit pas.

#### Inpulse
- **Ce qui marche :** Branding le plus solide du lot. Palette violet/indigo distinctive, site moderne, messaging "AI-powered" crédible. Bonne exécution corporate.
- **Ce qui ne marche pas :** Trop orienté grands groupes (5+ sites). Le chef d'un bistrot ne se reconnaît pas. Le violet est froid, manque l'ancrage "cuisine".
- **Leçon :** L'exécution compte autant que le produit. Mais on peut faire mieux en étant plus "métier".

#### Yokitup
- **Ce qui marche :** Positionnement "gratuit" imparable pour l'acquisition. Orange énergique, approche directe.
- **Ce qui ne marche pas :** Le branding fait "startup étudiant". Pas de gravitas pour un outil qu'on confie ses données financières. L'orange est un peu criard, manque de profondeur.
- **Leçon :** L'accessibilité attire, mais il faut inspirer confiance pour retenir.

#### Zenchef
- **Ce qui marche :** Le branding le plus "premium" — belles photos, ton élégant, UI soignée. Forte identité.
- **Ce qui ne marche pas :** Zenchef est front-of-house (réservation, CRM). Pas de concurrence directe sur le back-of-house. Mais le niveau de polish est la référence.
- **Leçon :** Ce niveau de qualité visuelle est attendu par les restaurateurs modernes. C'est le standard à atteindre.

### Positionnement RestoSuite AI — Comment se différencier

| Axe | Concurrents | RestoSuite AI |
|-----|-------------|---------------|
| **Couleur** | Bleu/violet/orange vif | **Bleu ardoise + orange cuivre** — ancré dans la cuisine, pas dans la tech |
| **Ton** | Corporate OU cheap | **Expert et direct** — parle comme un chef, pas comme un marketeur |
| **Interface** | Dense ou simpliste | **Dense et lisible** — on montre tout, mais proprement |
| **IA** | Buzzword ou absent | **Invisible mais utile** — l'IA est dans le produit, pas dans le marketing |
| **Scope** | Spécialisé (stock OU résa OU fiches) | **Tout-en-un** — le nom "Suite" dit tout |
| **Voix** | Absent chez tous | **Voice-first** — le micro est un différenciateur majeur |

**La promesse unique :**
> Là où Koust est un tableur amélioré, Inpulse un outil corporate, et Yokitup un outil gratuit limité — **RestoSuite AI est le bras droit du chef.** Il comprend le métier, il parle le langage, il a la densité d'un outil pro et l'intelligence d'un copilote.

---

## Annexe — Tokens de design (résumé)

```css
:root {
  /* Spacing scale (base 4px) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  
  /* Border radius */
  --radius-sm: 6px;    /* Badges, tags */
  --radius-md: 10px;   /* Boutons, inputs */
  --radius-lg: 12px;   /* Cartes */
  --radius-xl: 16px;   /* Modals, panels */
  --radius-full: 9999px; /* Avatars, toggles */
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --shadow-accent: 0 4px 16px rgba(232,114,42,0.3);
  
  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;
  
  /* Z-index scale */
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-fixed: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-popover: 60;
  --z-tooltip: 70;
  --z-mic-button: 90;
  --z-nav: 100;
  --z-toast: 110;
}
```

---

## Checklist d'implémentation

- [ ] Configurer les CSS custom properties (couleurs, typo, spacing)
- [ ] Importer les Google Fonts (Inter + JetBrains Mono)
- [ ] Créer le composant Button (primary, secondary, ghost, danger)
- [ ] Créer le composant Card (recipe, ingredient, supplier)
- [ ] Créer le composant Table (avec headers sticky et colonnes mono)
- [ ] Implémenter la Bottom Nav mobile (5 onglets)
- [ ] Implémenter la Sidebar desktop (collapsible)
- [ ] Créer le composant Input/Select/Toggle
- [ ] Implémenter le Mic Button (FAB + animation pulse)
- [ ] Intégrer Lucide Icons
- [ ] Créer les 3 icônes custom (toque, fiche technique, thermomètre HACCP)
- [ ] Implémenter le dark mode (toggle + media query)
- [ ] Tester les contrastes WCAG sur toutes les combinaisons couleur
- [ ] Tester sur tablette en condition cuisine (luminosité, doigts mouillés)

---

*Document de référence pour toute l'équipe produit et développement. Toute déviation doit être validée par le design lead.*
