# RestoSuite — Propositions de Logo

> 5 directions créatives. Chaque proposition inclut une version horizontale (icône + texte) et une icône seule.
> Palette : Bleu ardoise `#1B2A4A`, Orange cuivre `#E8722A`, Crème `#F7F5F2`
> Typo : Inter (font-family dans les SVG)

---

## Proposition 1 : Couteau + Graphique

**Direction créative :** Un couteau de chef stylisé vu de profil, dont la lame se transforme en courbe ascendante (comme un graphique de croissance). Le manche est solide et géométrique, la lame s'affine en une ligne qui monte — fusion de l'outil du chef et de la data. Le trait est épais pour rester lisible en petit. L'accent orange marque le point culminant de la courbe.

### Logo horizontal (icône + texte)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 48" fill="none">
  <!-- Knife icon: handle + blade curving up as data line -->
  <g>
    <!-- Handle -->
    <rect x="2" y="20" width="14" height="12" rx="2" fill="#1B2A4A"/>
    <!-- Bolster -->
    <rect x="16" y="18" width="3" height="16" rx="1" fill="#1B2A4A"/>
    <!-- Blade as ascending curve -->
    <path d="M19 34 L19 22 Q28 20 36 18 Q44 15 50 10 L50 34 Z" fill="#1B2A4A"/>
    <!-- Data curve accent on spine -->
    <path d="M19 22 Q28 20 36 17 Q44 13 50 8" stroke="#E8722A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <!-- Accent dot at peak -->
    <circle cx="50" cy="8" r="2.5" fill="#E8722A"/>
  </g>
  <!-- Text -->
  <text x="62" y="35" font-family="Inter, sans-serif" font-weight="600" font-size="28" fill="#1B2A4A" letter-spacing="-0.5">Resto<tspan font-weight="700">Suite</tspan></text>
</svg>
```

### Icône seule
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <!-- Handle -->
  <rect x="4" y="24" width="12" height="10" rx="2.5" fill="#1B2A4A"/>
  <!-- Bolster -->
  <rect x="16" y="22" width="3" height="14" rx="1" fill="#1B2A4A"/>
  <!-- Blade ascending -->
  <path d="M19 36 L19 26 Q27 23 34 19 Q40 15 44 10 L44 36 Z" fill="#1B2A4A"/>
  <!-- Data curve -->
  <path d="M19 26 Q27 23 34 18 Q40 13 44 8" stroke="#E8722A" stroke-width="3" stroke-linecap="round" fill="none"/>
  <!-- Peak dot -->
  <circle cx="44" cy="8" r="3" fill="#E8722A"/>
</svg>
```

### Notes
- La métaphore est immédiate : outil de cuisine + croissance business
- Le couteau est universel dans la restauration, pas un cliché comme la toque
- Le dot orange au sommet attire l'œil et fonctionne comme point focal même en 16px
- En petit, la silhouette reste reconnaissable (triangle + point)

---

## Proposition 2 : Toque abstraite

**Direction créative :** Une toque de chef radicalement simplifiée en formes géométriques. La partie haute est composée de 3 barres verticales de hauteurs croissantes — évoquant à la fois les plis de la toque et un bar chart de dashboard. La base est un rectangle arrondi. Le tout est compact et iconique, pas illustratif.

### Logo horizontal (icône + texte)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 48" fill="none">
  <!-- Toque icon -->
  <g>
    <!-- Base band -->
    <rect x="6" y="34" width="30" height="6" rx="2" fill="#1B2A4A"/>
    <!-- Bar columns (toque puffs = data bars) -->
    <rect x="8" y="20" width="7" height="14" rx="1.5" fill="#1B2A4A"/>
    <rect x="17" y="14" width="7" height="20" rx="1.5" fill="#1B2A4A"/>
    <rect x="26" y="8" width="7" height="26" rx="1.5" fill="#E8722A"/>
  </g>
  <!-- Text -->
  <text x="48" y="35" font-family="Inter, sans-serif" font-weight="600" font-size="28" fill="#1B2A4A" letter-spacing="-0.5">Resto<tspan font-weight="700">Suite</tspan></text>
</svg>
```

### Icône seule
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <!-- Base band -->
  <rect x="6" y="36" width="36" height="7" rx="2.5" fill="#1B2A4A"/>
  <!-- Bar columns -->
  <rect x="8" y="22" width="9" height="14" rx="2" fill="#1B2A4A"/>
  <rect x="19.5" y="14" width="9" height="22" rx="2" fill="#1B2A4A"/>
  <rect x="31" y="6" width="9" height="30" rx="2" fill="#E8722A"/>
</svg>
```

### Notes
- La double lecture (toque / bar chart) est subtile mais fonctionne — les initiés voient les deux
- Extrêmement lisible en petit : 3 rectangles + 1 barre = reconnaissable même en 16px
- La barre orange (la plus haute) crée un focal point et symbolise la performance
- Rappelle les logos de Stripe, Linear — géométrique, systématique, pro

---

## Proposition 3 : Monogramme RS

**Direction créative :** Les lettres R et S fusionnées dans un monogramme élégant. Le R et le S partagent un trait vertical central. L'ensemble est inscrit dans un cercle fin — évoquant une assiette vue de dessus. Une légère courbe de vapeur part du haut, donnant le côté cuisine sans être littéral. Le monogramme est tracé en traits d'épaisseur uniforme pour un rendu moderne.

### Logo horizontal (icône + texte)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 48" fill="none">
  <!-- Plate circle -->
  <circle cx="24" cy="24" r="21" stroke="#1B2A4A" stroke-width="2" fill="none"/>
  <!-- Monogram R+S sharing middle stroke -->
  <g fill="none" stroke="#1B2A4A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <!-- R: vertical + bowl + leg -->
    <path d="M14 36 L14 12 L22 12 Q28 12 28 17.5 Q28 23 22 23 L14 23"/>
    <path d="M22 23 L28 36"/>
    <!-- S -->
    <path d="M33 14 Q29 12 33 12 Q38 12 38 17 Q38 22 33 24 Q28 26 28 31 Q28 36 33 36 Q37 36 33 34"/>
  </g>
  <!-- Steam accent -->
  <path d="M20 6 Q22 2 24 6" stroke="#E8722A" stroke-width="2" stroke-linecap="round" fill="none"/>
  <!-- Text -->
  <text x="56" y="35" font-family="Inter, sans-serif" font-weight="600" font-size="28" fill="#1B2A4A" letter-spacing="-0.5">Resto<tspan font-weight="700">Suite</tspan></text>
</svg>
```

### Icône seule
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <!-- Plate circle -->
  <circle cx="24" cy="25" r="20" stroke="#1B2A4A" stroke-width="2.5" fill="none"/>
  <!-- R -->
  <g fill="none" stroke="#1B2A4A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 39 L13 13 L21 13 Q28 13 28 19 Q28 25 21 25 L13 25"/>
    <path d="M21 25 L28 39"/>
    <!-- S -->
    <path d="M32 16 Q32 13 35 13 Q39 13 39 18 Q39 23 35 25 Q31 27 31 32 Q31 37 35 37 Q38 37 38 35"/>
  </g>
  <!-- Steam -->
  <path d="M21 7 Q23 2 25 7 M27 5 Q29 1 31 5" stroke="#E8722A" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>
```

### Notes
- Le monogramme est intemporel — ne date pas, ne suit pas de trend
- Le cercle-assiette est subtil : les non-initiés voient un encadrement classique, les restaurateurs font le lien
- Les traits de vapeur en orange apportent la touche cuisine sans être littéral
- Fonctionne comme un sceau / stamp d'authenticité — renforce la confiance

---

## Proposition 4 : Flamme + Data

**Direction créative :** Une flamme de fourneau stylisée en 3 langues de feu de hauteurs différentes — qui forment aussi visuellement un graphique en barres ascendant. La flamme est épurée, géométrique (pas organique/réaliste). Les deux premières langues sont en bleu ardoise, la troisième (la plus haute) en orange cuivre. C'est l'énergie de la cuisine rencontre la précision des données.

### Logo horizontal (icône + texte)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 48" fill="none">
  <!-- Flame/data bars -->
  <g>
    <!-- Burner base line -->
    <rect x="4" y="40" width="36" height="3" rx="1.5" fill="#1B2A4A"/>
    <!-- Flame 1 (shortest) -->
    <path d="M8 40 L8 30 Q8 24 12 22 Q16 24 16 30 L16 40 Z" fill="#1B2A4A"/>
    <!-- Flame 2 (medium) -->
    <path d="M18 40 L18 24 Q18 16 22 14 Q26 16 26 24 L26 40 Z" fill="#1B2A4A"/>
    <!-- Flame 3 (tallest, accent) -->
    <path d="M28 40 L28 16 Q28 8 32 5 Q36 8 36 16 L36 40 Z" fill="#E8722A"/>
  </g>
  <!-- Text -->
  <text x="52" y="35" font-family="Inter, sans-serif" font-weight="600" font-size="28" fill="#1B2A4A" letter-spacing="-0.5">Resto<tspan font-weight="700">Suite</tspan></text>
</svg>
```

### Icône seule
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <!-- Burner base -->
  <rect x="3" y="42" width="42" height="3.5" rx="1.75" fill="#1B2A4A"/>
  <!-- Flame 1 -->
  <path d="M6 42 L6 30 Q6 22 12 18 Q18 22 18 30 L18 42 Z" fill="#1B2A4A"/>
  <!-- Flame 2 -->
  <path d="M19 42 L19 24 Q19 14 25 10 Q31 14 31 24 L31 42 Z" fill="#1B2A4A"/>
  <!-- Flame 3 (accent) -->
  <path d="M32 42 L32 16 Q32 6 38 2 Q44 6 44 16 L44 42 Z" fill="#E8722A"/>
</svg>
```

### Notes
- La flamme = énergie, passion, cuisine — c'est viscéral et immédiat
- Les 3 langues ascendantes = bar chart de performance — double lecture naturelle
- Orange pour la flamme la plus haute = accent qui a du sens (feu = orange)
- Silhouette très distinctive en petit : 3 formes pointues sur une ligne
- Rappelle les logos tech modernes qui utilisent des formes organiques simplifiées (Firefox, Tinder)

---

## Proposition 5 : Carré arrondi — Cuillère + Nœud

**Direction créative :** Un conteneur carré aux coins très arrondis (squircle, comme les app icons iOS) en bleu ardoise. À l'intérieur, un symbole unique : une cuillère stylisée dont le manche se tord en un nœud / boucle — évoquant à la fois l'outil de cuisine et un symbole d'infini / de boucle de feedback (data loop). Le trait est blanc (ou crème sur fond sombre). Simple, mémorable, iconique. Pensez au niveau de simplification du logo Notion ou Linear.

### Logo horizontal (icône + texte)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 48" fill="none">
  <!-- Squircle container -->
  <rect x="2" y="2" width="44" height="44" rx="12" fill="#1B2A4A"/>
  <!-- Spoon with loop handle -->
  <g fill="none" stroke="#F7F5F2" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <!-- Spoon bowl -->
    <ellipse cx="16" cy="14" rx="5.5" ry="4.5"/>
    <!-- Handle going down into loop -->
    <path d="M16 18.5 L16 26 Q16 32 22 32 Q28 32 28 26 Q28 20 22 20 Q16 20 16 26 L16 38"/>
  </g>
  <!-- Orange accent dot -->
  <circle cx="16" cy="38" r="2" fill="#E8722A"/>
  <!-- Text -->
  <text x="58" y="35" font-family="Inter, sans-serif" font-weight="600" font-size="28" fill="#1B2A4A" letter-spacing="-0.5">Resto<tspan font-weight="700">Suite</tspan></text>
</svg>
```

### Icône seule
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <!-- Squircle -->
  <rect x="2" y="2" width="44" height="44" rx="12" fill="#1B2A4A"/>
  <!-- Spoon bowl -->
  <ellipse cx="18" cy="13" rx="6.5" ry="5" fill="none" stroke="#F7F5F2" stroke-width="3" stroke-linecap="round"/>
  <!-- Handle with loop -->
  <path d="M18 18 L18 26 Q18 33 25 33 Q32 33 32 26 Q32 19 25 19 Q18 19 18 26 L18 40" fill="none" stroke="#F7F5F2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Accent dot at base -->
  <circle cx="18" cy="40" r="2.5" fill="#E8722A"/>
</svg>
```

### Notes
- Le squircle donne immédiatement un feeling "app moderne" — Slack, Notion, Linear
- La cuillère est universelle en cuisine, moins cliché que le couteau ou la toque
- La boucle dans le manche = feedback loop / cycle d'amélioration continue (data-driven)
- Le dot orange = point de données, ancre visuelle, et rappel de la marque
- En favicon 16px : carré bleu avec trait blanc = ultra lisible
- Le fond bleu garantit la lisibilité sur fond clair ET sombre (le carré porte sa propre couleur)

---

## Récapitulatif

| # | Nom | Métaphore | Force principale |
|---|-----|-----------|-----------------|
| 1 | Couteau + Graphique | Outil du chef → courbe de croissance | Métaphore directe et forte |
| 2 | Toque abstraite | Plis de toque → bar chart | Double lecture élégante |
| 3 | Monogramme RS | Lettres dans une assiette + vapeur | Intemporel, premium |
| 4 | Flamme + Data | Langues de feu → barres ascendantes | Énergie + performance |
| 5 | Carré + Cuillère-boucle | Cuillère → loop de données | App-native, iconique |

## Recommandation

**Pour un SaaS moderne** → Proposition 5 (Carré + Cuillère) ou Proposition 2 (Toque abstraite). Ce sont les plus "tech-native" et les plus lisibles en petit.

**Pour un positionnement premium/craft** → Proposition 3 (Monogramme RS). Plus classique, plus intemporel.

**Pour un message fort "cuisine meets data"** → Proposition 1 (Couteau) ou Proposition 4 (Flamme). Plus narratifs, plus immédiatement compréhensibles.
