'use strict';

// Keyword-based product categorizer for the supplier mercuriale import.
// Pure JS, deterministic, no DB or network access. Used by routes/supplier-portal.js
// to fill in `category` whenever the source file (Excel/CSV) or LLM output
// (PDF/image) didn't supply one.
//
// Order matters: more specific buckets win.
//  - Surgelés before Poissons so "filet de saumon surgelé" → freezer
//  - Charcuterie before Viandes so "saucisson" → Charcuterie, "saucisse" → Viandes
//  - Huiles/Vinaigres + Condiments before Épicerie sèche so "huile d'olive"
//    doesn't end up in groceries

const CATEGORIES = [
  'Viandes',
  'Poissons',
  'Légumes',
  'Fruits',
  'Produits laitiers',
  'Épicerie sèche',
  'Boissons',
  'Surgelés',
  'Boulangerie',
  'Charcuterie',
  'Condiments/Sauces',
  'Huiles/Vinaigres',
  'Autre',
];

const RULES = [
  { cat: 'Surgelés', words: ['surgelé', 'surgele', 'congelé', 'congele', 'glace ', 'sorbet'] },
  { cat: 'Charcuterie', words: ['jambon', 'saucisson', 'rillette', 'pâté', 'pate de', 'terrine', 'lardon', 'chorizo', 'salami', 'mortadelle', 'bacon', 'coppa', 'andouille', 'boudin', 'rosette', 'merguez', 'foie gras'] },
  { cat: 'Poissons', words: ['saumon', 'cabillaud', 'thon', 'lieu', 'merlu', 'sole', 'bar ', 'dorade', 'daurade', 'truite', 'sardine', 'maquereau', 'anchois', 'rouget', 'lotte', 'sandre', 'brochet', 'colin', 'hareng', 'morue', 'haddock', 'crevette', 'gambas', 'langoustine', 'homard', 'crabe', 'tourteau', 'moule', 'huître', 'huitre', 'palourde', 'coquille', 'st-jacques', 'st jacques', 'saint-jacques', 'poulpe', 'calamar', 'encornet', 'seiche', 'poisson', 'fruits de mer', 'fruit de mer', 'turbot'] },
  { cat: 'Viandes', words: ['boeuf', 'bœuf', 'veau', 'agneau', 'mouton', 'porc', 'cochon', 'poulet', 'poularde', 'chapon', 'pintade', 'canard', 'magret', 'dinde', 'lapin', 'caille', 'pigeon', 'gibier', 'sanglier', 'cerf', 'chevreuil', 'biche', 'entrecôte', 'entrecote', 'rumsteck', 'faux-filet', 'faux filet', 'bavette', 'onglet', 'paleron', 'gigot', 'côtelette', 'cotelette', 'côte de', 'cote de', 'travers', 'filet mignon', 'rôti', 'roti', 'haché', 'hache', 'steak', 'escalope', 'tournedos', 'tartare', 'saucisse', 'foie', 'rognon', 'tripe', 'ris de'] },
  { cat: 'Produits laitiers', words: ['lait', 'beurre', 'crème', 'creme', 'yaourt', 'fromage', 'comté', 'comte', 'gruyère', 'gruyere', 'emmental', 'parmesan', 'mozzarella', 'feta', 'chèvre', 'chevre', 'brebis', 'roquefort', 'camembert', 'brie', 'reblochon', 'tomme', 'cantal', 'munster', 'fourme', 'bleu', 'mascarpone', 'ricotta', 'fromage blanc', 'faisselle', 'œuf', 'oeuf', 'oeufs', 'œufs'] },
  { cat: 'Boulangerie', words: ['pain', 'baguette', 'brioche', 'viennoiserie', 'croissant', 'pain au chocolat', 'pain de mie', 'tartine', 'biscotte', 'bun', 'fougasse', 'ciabatta', 'focaccia', 'pita', 'tortilla', 'wrap', 'tarte', 'gâteau', 'gateau', 'biscuit', 'macaron', 'praliné', 'praline', 'feuilletage', 'pâte feuilletée', 'pate feuilletee', 'farine', 'levure'] },
  { cat: 'Huiles/Vinaigres', words: ['huile', 'vinaigre'] },
  { cat: 'Condiments/Sauces', words: ['moutarde', 'ketchup', 'mayonnaise', 'sauce', 'pesto', 'tapenade', 'aïoli', 'aioli', 'béarnaise', 'bearnaise', 'hollandaise', 'tabasco', 'soja', 'worcestershire', 'sel', 'poivre', 'épice', 'epice', 'curry', 'paprika', 'cumin', 'muscade', 'cannelle', 'safran', 'piment', 'herbes de provence', 'fond de', 'bouillon', 'concentré de tomate', 'concentre de tomate', 'cornichon', 'câpre', 'capre', 'condiment', 'wasabi', 'miso'] },
  { cat: 'Légumes', words: ['tomate', 'concombre', 'courgette', 'aubergine', 'poivron', 'carotte', 'oignon', 'échalote', 'echalote', 'ail', 'poireau', 'pomme de terre', 'patate', 'navet', 'radis', 'betterave', 'céleri', 'celeri', 'fenouil', 'chou', 'brocoli', 'chou-fleur', 'chou fleur', 'épinard', 'epinard', 'salade', 'laitue', 'roquette', 'mâche', 'mache', 'cresson', 'endive', 'haricot vert', 'petit pois', 'fève', 'feve', 'champignon', 'pleurote', 'shiitake', 'cèpe', 'cepe', 'girolle', 'morille', 'truffe', 'asperge', 'artichaut', 'potiron', 'butternut', 'courge', 'olive', 'avocat', 'persil', 'basilic', 'coriandre', 'menthe', 'estragon', 'thym', 'romarin', 'sauge', 'aneth', 'ciboulette', 'cerfeuil', 'légume', 'legume'] },
  { cat: 'Fruits', words: ['pomme', 'poire', 'banane', 'orange', 'citron', 'pamplemousse', 'mandarine', 'clémentine', 'clementine', 'kiwi', 'ananas', 'mangue', 'papaye', 'fruit de la passion', 'litchi', 'fraise', 'framboise', 'mûre', 'mure', 'myrtille', 'cassis', 'groseille', 'cerise', 'abricot', 'pêche', 'peche', 'nectarine', 'prune', 'mirabelle', 'figue', 'datte', 'raisin', 'melon', 'pastèque', 'pasteque', 'rhubarbe', 'grenade', 'kaki', 'fruit'] },
  { cat: 'Boissons', words: ['eau', 'soda', 'jus de', 'limonade', 'thé', 'the ', 'tisane', 'café', 'cafe', 'expresso', 'vin ', 'bière', 'biere', 'champagne', 'crémant', 'cremant', 'cidre', 'whisky', 'vodka', 'rhum', 'gin ', 'cognac', 'armagnac', 'liqueur', 'apéritif', 'aperitif', 'sirop'] },
  { cat: 'Épicerie sèche', words: ['riz', 'pâtes', 'pates', 'spaghetti', 'penne', 'fusilli', 'tagliatelle', 'lasagne', 'linguine', 'ravioli', 'gnocchi', 'semoule', 'couscous', 'boulgour', 'quinoa', 'lentille', 'pois chiche', 'haricot sec', 'flageolet', 'sucre', 'chocolat', 'cacao', 'amande', 'noisette', 'noix', 'pistache', 'pignon', 'sésame', 'sesame', 'tournesol', 'lin', 'chia', 'flocon', 'céréale', 'cereale', 'conserve'] },
];

// LLM/spreadsheet hints get coerced back to one of CATEGORIES so the UI dropdown
// stays consistent. Any unknown string falls back to keyword matching.
const HINT_NORMALIZE = {
  viande: 'Viandes',
  viandes: 'Viandes',
  charcuterie: 'Charcuterie',
  poisson: 'Poissons',
  poissons: 'Poissons',
  'poissons/fruits de mer': 'Poissons',
  'fruit de mer': 'Poissons',
  'fruits de mer': 'Poissons',
  'marée': 'Poissons',
  maree: 'Poissons',
  legume: 'Légumes',
  legumes: 'Légumes',
  'légume': 'Légumes',
  'légumes': 'Légumes',
  fruit: 'Fruits',
  fruits: 'Fruits',
  laitier: 'Produits laitiers',
  laitiers: 'Produits laitiers',
  cremerie: 'Produits laitiers',
  'crémerie': 'Produits laitiers',
  'crèmerie': 'Produits laitiers',
  fromage: 'Produits laitiers',
  fromages: 'Produits laitiers',
  'produits laitiers': 'Produits laitiers',
  epicerie: 'Épicerie sèche',
  'épicerie': 'Épicerie sèche',
  'epicerie seche': 'Épicerie sèche',
  'épicerie sèche': 'Épicerie sèche',
  boisson: 'Boissons',
  boissons: 'Boissons',
  vin: 'Boissons',
  surgele: 'Surgelés',
  'surgelé': 'Surgelés',
  surgeles: 'Surgelés',
  'surgelés': 'Surgelés',
  congele: 'Surgelés',
  'congelé': 'Surgelés',
  boulangerie: 'Boulangerie',
  pain: 'Boulangerie',
  pains: 'Boulangerie',
  patisserie: 'Boulangerie',
  'pâtisserie': 'Boulangerie',
  'pâtisseries': 'Boulangerie',
  'pains & pâtisseries': 'Boulangerie',
  'pains et pâtisseries': 'Boulangerie',
  viennoiserie: 'Boulangerie',
  condiment: 'Condiments/Sauces',
  condiments: 'Condiments/Sauces',
  sauce: 'Condiments/Sauces',
  sauces: 'Condiments/Sauces',
  'condiments/sauces': 'Condiments/Sauces',
  huile: 'Huiles/Vinaigres',
  huiles: 'Huiles/Vinaigres',
  vinaigre: 'Huiles/Vinaigres',
  vinaigres: 'Huiles/Vinaigres',
  'huiles/vinaigres': 'Huiles/Vinaigres',
  autre: 'Autre',
  divers: 'Autre',
};

function normalizeHint(hint) {
  if (!hint || typeof hint !== 'string') return null;
  const k = hint.toLowerCase().trim();
  if (!k) return null;
  if (HINT_NORMALIZE[k]) return HINT_NORMALIZE[k];
  for (const c of CATEGORIES) {
    if (c.toLowerCase() === k) return c;
  }
  return null;
}

function categorize(productName, hint) {
  const fromHint = normalizeHint(hint);
  if (fromHint) return fromHint;

  if (!productName || typeof productName !== 'string') return 'Autre';
  const name = productName.toLowerCase();

  for (const rule of RULES) {
    for (const w of rule.words) {
      if (name.includes(w)) return rule.cat;
    }
  }
  return 'Autre';
}

module.exports = { CATEGORIES, categorize, normalizeHint };
