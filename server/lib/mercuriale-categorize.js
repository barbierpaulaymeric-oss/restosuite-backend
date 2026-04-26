'use strict';

// ═══════════════════════════════════════════
// Auto-categorize a French product name into one of 11 brasserie buckets.
//
// The mercuriale import (supplier portal) extracts arbitrary product names from
// PDFs and Excel sheets. To keep the review UI scannable we slot each row into
// a known category up front; the supplier can correct any mis-classification
// inline before saving. Order matters: more specific buckets come first so
// "saumon fumé" lands in `Charcuterie` rather than `Poissons`.
// ═══════════════════════════════════════════

const CATEGORIES = [
  'Viandes',
  'Poissons',
  'Légumes',
  'Fruits',
  'Produits laitiers',
  'Épicerie',
  'Boissons',
  'Surgelés',
  'Charcuterie',
  'Condiments',
  'Autre',
];

// Keyword groups. All matched as lowercase substrings, accent-insensitive.
const RULES = [
  {
    cat: 'Surgelés',
    keywords: ['surgelé', 'surgele', 'congelé', 'congele', 'iqf', 'glacé minute'],
  },
  {
    cat: 'Charcuterie',
    keywords: [
      'jambon', 'saucisson', 'chorizo', 'pâté', 'pate ', 'rillette', 'terrine',
      'salami', 'mortadelle', 'coppa', 'bresaola', 'lardon', 'bacon', 'andouille',
      'boudin', 'cervelas', 'saumon fumé', 'saumon fume', 'magret fumé', 'pancetta',
    ],
  },
  {
    cat: 'Viandes',
    keywords: [
      'boeuf', 'bœuf', 'entrecote', 'entrecôte', 'faux-filet', 'rumsteak', 'bavette',
      'onglet', 'tournedos', 'paleron', 'jarret', 'gigot', 'agneau', 'mouton',
      'porc', 'travers', 'echine', 'échine', 'poitrine de porc', 'haché', 'hache ',
      'volaille', 'poulet', 'dinde', 'canard', 'magret', 'cuisse', 'aile',
      'suprême', 'supreme', 'lapin', 'pintade', 'caille', 'veau', 'escalope',
      'foie', 'rognon', 'côte de', 'cote de',
    ],
  },
  {
    cat: 'Poissons',
    keywords: [
      'saumon', 'cabillaud', 'lieu', 'merlu', 'colin', 'morue', 'sardine', 'maquereau',
      'thon', 'bar ', 'dorade', 'daurade', 'sole', 'turbot', 'lotte', 'truite',
      'rouget', 'limande', 'flétan', 'fletan', 'saint-pierre', 'st-pierre',
      'coquille', 'st jacques', 'saint-jacques', 'crevette', 'gambas', 'langoustine',
      'homard', 'crabe', 'tourteau', 'moule', 'huître', 'huitre', 'palourde',
      'bulot', 'encornet', 'calamar', 'calmar', 'poulpe', 'seiche', 'anchois',
    ],
  },
  {
    cat: 'Produits laitiers',
    keywords: [
      'lait', 'crème', 'creme', 'beurre', 'fromage', 'yaourt', 'yogourt', 'faisselle',
      'mascarpone', 'ricotta', 'parmesan', 'comté', 'comte', 'gruyère', 'gruyere',
      'emmental', 'mozzarella', 'cheddar', 'roquefort', 'camembert', 'brie',
      'feta', 'chèvre', 'chevre', 'reblochon', 'tomme', 'fourme', 'morbier',
      'oeuf', 'œuf',
    ],
  },
  {
    cat: 'Légumes',
    keywords: [
      'tomate', 'pomme de terre', 'pdt', 'patate', 'oignon', 'echalote', 'échalote',
      'ail ', 'carotte', 'courgette', 'aubergine', 'poivron', 'concombre', 'salade',
      'laitue', 'roquette', 'mesclun', 'mâche', 'mache', 'épinard', 'epinard',
      'chou', 'brocoli', 'choux-fleur', 'chou-fleur', 'haricot', 'petit pois',
      'fève', 'feve', 'lentille', 'pois chiche', 'champignon', 'cèpe', 'cepe',
      'girolle', 'morille', 'shiitake', 'navet', 'radis', 'betterave', 'panais',
      'topinambour', 'céleri', 'celeri', 'fenouil', 'poireau', 'asperge', 'artichaut',
      'endive', 'cresson', 'persil', 'basilic', 'coriandre', 'menthe', 'estragon',
      'thym', 'romarin', 'sauge', 'aneth', 'ciboulette',
    ],
  },
  {
    cat: 'Fruits',
    keywords: [
      'pomme ', 'poire ', 'banane', 'orange', 'citron', 'pamplemousse', 'mandarine',
      'clémentine', 'clementine', 'fraise', 'framboise', 'myrtille', 'mûre', 'mure',
      'cassis', 'groseille', 'cerise', 'abricot', 'pêche', 'peche', 'nectarine',
      'prune', 'mirabelle', 'reine-claude', 'raisin', 'kiwi', 'mangue', 'ananas',
      'papaye', 'fruit de la passion', 'litchi', 'figue', 'datte', 'grenade',
      'melon', 'pastèque', 'pasteque', 'avocat', 'noix de coco',
    ],
  },
  {
    cat: 'Boissons',
    keywords: [
      'vin', 'champagne', 'bière', 'biere', 'cidre', 'eau', 'jus', 'sirop',
      'soda', 'limonade', 'café', 'cafe', 'thé', 'the ', 'infusion', 'tisane',
      'whisky', 'vodka', 'gin', 'rhum', 'cognac', 'armagnac', 'pastis', 'liqueur',
      'porto', 'martini', 'campari', 'spritz', 'kir',
    ],
  },
  {
    cat: 'Condiments',
    keywords: [
      'sel ', 'poivre', 'épice', 'epice', 'moutarde', 'mayonnaise', 'ketchup',
      'vinaigre', 'huile', 'sauce soja', 'tabasco', 'worcestershire', 'cornichon',
      'câpre', 'capre', 'olive', 'tapenade', 'pesto', 'harissa', 'curry', 'safran',
      'paprika', 'piment', 'cumin', 'gingembre', 'curcuma', 'cannelle',
    ],
  },
  {
    cat: 'Épicerie',
    keywords: [
      'farine', 'sucre', 'pâte', 'pate ', 'pâtes ', 'pates ', 'riz', 'semoule',
      'quinoa', 'boulgour', 'couscous', 'polenta', 'biscotte', 'pain ', 'baguette',
      'brioche', 'levure', 'chocolat', 'cacao', 'miel', 'confiture', 'compote',
      'conserve', 'tomate pelée', 'concentré', 'concentre', 'bouillon', 'fond ',
      'fond de', 'gélatine', 'gelatine', 'agar', 'maizena', 'amidon',
    ],
  },
];

function normalize(s) {
  if (!s) return '';
  // Strip diacritics so "épicerie" matches "epicerie", and lowercase everything.
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary match against the normalized name with French inflection
// tolerance. Without inflection support, "crevette" would miss "crevettes"
// and "surgele" would miss "surgelees". Without boundaries, "chou" would
// hit "chouette". Trailing inflection group is tight: only the actual French
// plural/feminine suffixes are accepted, and the match still has to end at a
// word boundary — so "lait" matches "laits" but not "laitue", "vin" matches
// "vins" but not "vinaigre".
const INFLECTION_TAIL = '(?:s|es|e|ee|ees|x)?';
function buildKeywordRegex(kw) {
  const norm = normalize(kw).trim();
  if (!norm) return null;
  // Skip the inflection tail when the keyword already contains whitespace —
  // multi-word phrases like "saumon fume" don't decline as a unit.
  const tail = /\s/.test(norm) ? '' : INFLECTION_TAIL;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(norm)}${tail}([^a-z0-9]|$)`);
}

// Pre-compile keyword regexes once at module load.
const COMPILED_RULES = RULES.map(r => ({
  cat: r.cat,
  matchers: r.keywords.map(buildKeywordRegex).filter(Boolean),
}));

function categorize(productName) {
  const n = normalize(productName);
  if (!n) return 'Autre';

  for (const rule of COMPILED_RULES) {
    for (const re of rule.matchers) {
      if (re.test(n)) return rule.cat;
    }
  }
  return 'Autre';
}

module.exports = { categorize, CATEGORIES };
