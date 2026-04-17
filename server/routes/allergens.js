const { Router } = require('express');
const { db, all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// ═══════════════════════════════════════════
// 14 allergènes réglementaires INCO (UE)
// ═══════════════════════════════════════════
const INCO_ALLERGENS = [
  { id: 1,  code: 'gluten',      name: 'Gluten',           icon: '🌾', description: 'Blé, seigle, orge, avoine, épeautre, kamut' },
  { id: 2,  code: 'crustaces',   name: 'Crustacés',        icon: '🦐', description: 'Crevettes, crabes, homard, langoustines' },
  { id: 3,  code: 'oeufs',       name: 'Œufs',             icon: '🥚', description: 'Œufs et produits à base d\'œufs' },
  { id: 4,  code: 'poissons',    name: 'Poissons',         icon: '🐟', description: 'Poissons et produits à base de poissons' },
  { id: 5,  code: 'arachides',   name: 'Arachides',        icon: '🥜', description: 'Cacahuètes et produits à base d\'arachides' },
  { id: 6,  code: 'soja',        name: 'Soja',             icon: '🫘', description: 'Soja et produits à base de soja' },
  { id: 7,  code: 'lait',        name: 'Lait',             icon: '🥛', description: 'Lait et produits laitiers (lactose inclus)' },
  { id: 8,  code: 'fruits_coque',name: 'Fruits à coque',   icon: '🌰', description: 'Amandes, noisettes, noix, cajou, pécan, pistache, macadamia' },
  { id: 9,  code: 'celeri',      name: 'Céleri',           icon: '🥬', description: 'Céleri et produits à base de céleri' },
  { id: 10, code: 'moutarde',    name: 'Moutarde',         icon: '🟡', description: 'Moutarde et produits à base de moutarde' },
  { id: 11, code: 'sesame',      name: 'Sésame',           icon: '⚪', description: 'Graines de sésame et produits à base de sésame' },
  { id: 12, code: 'sulfites',    name: 'Sulfites',         icon: '🍷', description: 'Anhydride sulfureux et sulfites (>10mg/kg ou 10mg/l)' },
  { id: 13, code: 'lupin',       name: 'Lupin',            icon: '🌿', description: 'Lupin et produits à base de lupin' },
  { id: 14, code: 'mollusques',  name: 'Mollusques',       icon: '🦪', description: 'Moules, huîtres, escargots, calamars, poulpe' }
];

// GET /api/allergens — Liste des 14 allergènes INCO
router.get('/', (req, res) => {
  res.json(INCO_ALLERGENS);
});

// GET /api/allergens/ingredients/:id — Allergènes d'un ingrédient (parsed from text field)
router.get('/ingredients/:id', requireAuth, (req, res) => {
  try {
    const ingredient = get('SELECT allergens FROM ingredients WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), req.user.restaurant_id]);
    if (!ingredient) return res.status(404).json({ error: 'Ingrédient non trouvé' });

    const parsed = parseAllergenText(ingredient.allergens);
    res.json({ ingredient_id: Number(req.params.id), allergens: parsed });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/allergens/ingredients/:id — Mettre à jour les allergènes d'un ingrédient
router.put('/ingredients/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const ingredient = get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [id, req.user.restaurant_id]);
    if (!ingredient) return res.status(404).json({ error: 'Ingrédient non trouvé' });

    const { allergen_codes } = req.body; // Array of codes like ['gluten', 'lait', 'oeufs']
    if (!Array.isArray(allergen_codes)) {
      return res.status(400).json({ error: 'allergen_codes must be an array' });
    }

    // Validate codes
    const validCodes = INCO_ALLERGENS.map(a => a.code);
    const invalid = allergen_codes.filter(c => !validCodes.includes(c));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Codes invalides: ${invalid.join(', ')}` });
    }

    // Store as comma-separated names for backward compatibility
    const allergenNames = allergen_codes.map(code => {
      const a = INCO_ALLERGENS.find(x => x.code === code);
      return a ? a.name : code;
    });
    const allergenText = allergenNames.length > 0 ? allergenNames.join(', ') : null;

    run('UPDATE ingredients SET allergens = ? WHERE id = ? AND restaurant_id = ?', [allergenText, id, req.user.restaurant_id]);

    // Audit trail (allergen declaration is regulatory under INCO)
    try {
      const { writeAudit } = require('../audit-log');
      writeAudit({
        restaurant_id: req.user.restaurant_id,
        account_id: req.user.id,
        table_name: 'ingredients',
        record_id: id,
        action: 'update',
        new_values: { allergens: allergenText, codes: allergen_codes }
      });
    } catch {}

    res.json({
      ingredient_id: id,
      allergens: allergenText,
      allergen_codes
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/allergens/recipes/:id — Allergènes calculés automatiquement pour une recette
router.get('/recipes/:id', requireAuth, (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [recipeId, req.user.restaurant_id]);
    if (!recipe) return res.status(404).json({ error: 'Recette non trouvée' });

    const allergens = getRecipeAllergens(recipeId);
    res.json({
      recipe_id: recipeId,
      recipe_name: recipe.name,
      allergens,
      inco_display: allergens.map(a => `${a.icon} ${a.name}`).join(', '),
      allergen_count: allergens.length
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/allergens/menu — Allergènes de toutes les recettes (pour affichage carte)
router.get('/menu', requireAuth, (req, res) => {
  try {
    const recipes = all('SELECT id, name, selling_price FROM recipes WHERE restaurant_id = ? ORDER BY name', [req.user.restaurant_id]);
    const result = recipes.map(r => ({
      recipe_id: r.id,
      recipe_name: r.name,
      selling_price: r.selling_price,
      allergens: getRecipeAllergens(r.id)
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Helpers ───

function parseAllergenText(text) {
  if (!text) return [];
  const normalized = text.toLowerCase().trim();
  const found = [];

  for (const allergen of INCO_ALLERGENS) {
    // Check if the allergen name (or common variants) appears in the text
    const variants = getAllergenVariants(allergen.code);
    if (variants.some(v => normalized.includes(v))) {
      found.push(allergen);
    }
  }
  return found;
}

function getAllergenVariants(code) {
  const map = {
    'gluten':       ['gluten', 'blé', 'ble', 'seigle', 'orge', 'avoine', 'épeautre', 'epeautre'],
    'crustaces':    ['crustacé', 'crustace', 'crevette', 'crabe', 'homard', 'langoustine'],
    'oeufs':        ['oeuf', 'œuf', 'oeufs', 'œufs', 'egg'],
    'poissons':     ['poisson', 'fish'],
    'arachides':    ['arachide', 'cacahuète', 'cacahuete', 'peanut'],
    'soja':         ['soja', 'soy'],
    'lait':         ['lait', 'lactose', 'lacto', 'dairy', 'fromage', 'crème', 'creme', 'beurre', 'produit laitier'],
    'fruits_coque': ['fruit à coque', 'fruits à coque', 'fruits a coque', 'amande', 'noisette', 'noix', 'cajou', 'pécan', 'pecan', 'pistache', 'macadamia'],
    'celeri':       ['céleri', 'celeri'],
    'moutarde':     ['moutarde', 'mustard'],
    'sesame':       ['sésame', 'sesame'],
    'sulfites':     ['sulfite', 'soufre', 'so2', 'anhydride sulfureux'],
    'lupin':        ['lupin'],
    'mollusques':   ['mollusque', 'moule', 'huître', 'huitre', 'escargot', 'calamar', 'poulpe', 'seiche']
  };
  return map[code] || [code];
}

function getRecipeAllergens(recipeId, visited = new Set()) {
  if (visited.has(recipeId)) return [];
  visited.add(recipeId);

  const ingredients = all(`
    SELECT ri.ingredient_id, ri.sub_recipe_id, i.allergens as allergen_text
    FROM recipe_ingredients ri
    LEFT JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = ?
  `, [recipeId]);

  const foundSet = new Set();

  for (const ing of ingredients) {
    if (ing.sub_recipe_id) {
      // Recurse into sub-recipe
      const subAllergens = getRecipeAllergens(ing.sub_recipe_id, new Set(visited));
      subAllergens.forEach(a => foundSet.add(a.code));
    } else if (ing.allergen_text) {
      const parsed = parseAllergenText(ing.allergen_text);
      parsed.forEach(a => foundSet.add(a.code));
    }
  }

  return INCO_ALLERGENS.filter(a => foundSet.has(a.code));
}

// ─── INCO: Affichage allergènes menu complet ───
router.get('/menu-display', requireAuth, (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const recipes = db.prepare(`
      SELECT r.id, r.name, r.category
      FROM recipes r
      WHERE r.restaurant_id = ?
      ORDER BY r.category, r.name
    `).all(rid);

    const result = recipes.map(recipe => {
      // Use the recipe-allergens helper so we honour both the comma-separated
      // legacy format AND sub-recipe inheritance (matches /api/allergens/recipes/:id).
      const allergens = getRecipeAllergens(recipe.id);
      return {
        ...recipe,
        allergen_codes: allergens.map(a => a.code).sort()
      };
    });

    res.json({ items: result, total: result.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
module.exports.INCO_ALLERGENS = INCO_ALLERGENS;
module.exports.getRecipeAllergens = getRecipeAllergens;
