const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { getRecipeAllergens, INCO_ALLERGENS } = require('./allergens');
const { validate, recipeValidation } = require('../middleware/validate');
const router = Router();
router.use(requireAuth);

// Returns { hasPrice: bool, source: 'supplier'|'ingredient'|null }
function getIngredientPriceSource(ingredientId, rid) {
  const supplierPrice = get(`
    SELECT price FROM supplier_prices WHERE ingredient_id = ? AND restaurant_id = ? ORDER BY price ASC LIMIT 1
  `, [ingredientId, rid]);
  if (supplierPrice && supplierPrice.price > 0) return { hasPrice: true, source: 'supplier' };

  const ingredient = get(`SELECT price_per_unit FROM ingredients WHERE id = ? AND restaurant_id = ?`, [ingredientId, rid]);
  if (ingredient && ingredient.price_per_unit > 0) return { hasPrice: true, source: 'ingredient' };

  return { hasPrice: false, source: null };
}

function calcIngredientCost(ingredientId, grossQty, unit, rid) {
  // 1. Try supplier_prices first (best price)
  const supplierPrice = get(`
    SELECT sp.price, sp.unit FROM supplier_prices sp
    WHERE sp.ingredient_id = ? AND sp.restaurant_id = ? ORDER BY sp.price ASC LIMIT 1
  `, [ingredientId, rid]);

  let p, pu;

  if (supplierPrice && supplierPrice.price > 0) {
    p = supplierPrice.price;
    pu = supplierPrice.unit;
  } else {
    // 2. Fallback: use ingredient's own price_per_unit
    const ingredient = get(`
      SELECT price_per_unit, price_unit FROM ingredients WHERE id = ? AND restaurant_id = ?
    `, [ingredientId, rid]);
    if (!ingredient || !ingredient.price_per_unit || ingredient.price_per_unit <= 0) return 0;
    p = ingredient.price_per_unit;
    pu = ingredient.price_unit || 'kg';
  }

  // Convert price to cost-per-base-unit (g for kg, ml for l, 1 for pièce/botte)
  let costPerBase = 0;
  if (pu === 'kg') costPerBase = p / 1000;
  else if (pu === 'g') costPerBase = p;
  else if (pu === 'l') costPerBase = p / 1000;
  else if (pu === 'cl') costPerBase = p / 100;
  else if (pu === 'pièce' || pu === 'botte') costPerBase = p;
  else costPerBase = p / 1000;

  // Convert quantity to base unit
  let qtyInBase = grossQty;
  if (unit === 'kg') qtyInBase = grossQty * 1000;
  else if (unit === 'l') qtyInBase = grossQty * 1000;
  else if (unit === 'cl') qtyInBase = grossQty * 10;

  return qtyInBase * costPerBase;
}

// Recursive cost calculation for a recipe (returns cost for `portions` portions)
function calcRecipeCost(recipeId, rid, visited = new Set()) {
  if (visited.has(recipeId)) return 0; // prevent infinite loops
  visited.add(recipeId);

  const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [recipeId, rid]);
  if (!recipe) return 0;

  const ingredients = all('SELECT * FROM recipe_ingredients WHERE recipe_id = ? AND restaurant_id = ?', [recipeId, rid]);
  let totalCost = 0;

  for (const ing of ingredients) {
    if (ing.sub_recipe_id) {
      // Sub-recipe: quantity = portions used
      const subRecipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [ing.sub_recipe_id, rid]);
      if (subRecipe) {
        const subTotalCost = calcRecipeCost(ing.sub_recipe_id, rid, new Set(visited));
        const costPerPortion = subRecipe.portions > 0 ? subTotalCost / subRecipe.portions : subTotalCost;
        totalCost += costPerPortion * ing.gross_quantity;
      }
    } else if (ing.ingredient_id) {
      totalCost += calcIngredientCost(ing.ingredient_id, ing.gross_quantity, ing.unit, rid);
    }
  }

  return totalCost;
}

// Get flat list of all raw ingredients for a recipe (recursive)
function getFlatIngredients(recipeId, rid, multiplier = 1, visited = new Set()) {
  if (visited.has(recipeId)) return [];
  visited.add(recipeId);

  const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [recipeId, rid]);
  if (!recipe) return [];

  const ingredients = all('SELECT * FROM recipe_ingredients WHERE recipe_id = ? AND restaurant_id = ?', [recipeId, rid]);
  const result = [];

  for (const ing of ingredients) {
    if (ing.sub_recipe_id) {
      const subRecipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [ing.sub_recipe_id, rid]);
      if (subRecipe) {
        const portionsUsed = ing.gross_quantity * multiplier;
        const subMultiplier = subRecipe.portions > 0 ? portionsUsed / subRecipe.portions : portionsUsed;
        const subIngredients = getFlatIngredients(ing.sub_recipe_id, rid, subMultiplier, new Set(visited));
        result.push(...subIngredients);
      }
    } else if (ing.ingredient_id) {
      result.push({
        ingredient_id: ing.ingredient_id,
        quantity: ing.gross_quantity * multiplier,
        unit: ing.unit
      });
    }
  }

  // Merge duplicates
  const merged = {};
  for (const item of result) {
    const key = `${item.ingredient_id}_${item.unit}`;
    if (merged[key]) {
      merged[key].quantity += item.quantity;
    } else {
      merged[key] = { ...item };
    }
  }

  return Object.values(merged);
}

function getFullRecipe(id, rid, depth = 0, visited = new Set()) {
  if (visited.has(id)) return null;
  visited.add(id);

  const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (!recipe) return null;

  const rawIngredients = all(`
    SELECT ri.*,
           i.name as ingredient_name, i.category as ingredient_category,
           i.default_unit, i.waste_percent as default_waste_percent, i.allergens
    FROM recipe_ingredients ri
    LEFT JOIN ingredients i ON i.id = ri.ingredient_id AND i.restaurant_id = ?
    WHERE ri.recipe_id = ? AND ri.restaurant_id = ?
  `, [rid, id, rid]);

  let totalCost = 0;
  let missingPriceCount = 0;
  const enrichedIngredients = rawIngredients.map(ing => {
    if (ing.sub_recipe_id) {
      // This is a sub-recipe ingredient
      const subRecipe = depth < 10 ? getFullRecipe(ing.sub_recipe_id, rid, depth + 1, new Set(visited)) : null;
      let cost = 0;
      if (subRecipe) {
        const costPerPortion = subRecipe.portions > 0 ? subRecipe.total_cost / subRecipe.portions : subRecipe.total_cost;
        cost = costPerPortion * ing.gross_quantity;
        // Count missing prices from sub-recipe (only at top level to avoid double-counting)
        if (depth === 0) missingPriceCount += subRecipe.missing_price_count || 0;
      }
      totalCost += cost;
      return {
        ...ing,
        is_sub_recipe: true,
        sub_recipe: subRecipe,
        sub_recipe_name: subRecipe ? subRecipe.name : `Recette #${ing.sub_recipe_id}`,
        cost: Math.round(cost * 100) / 100
      };
    } else {
      const priceSource = getIngredientPriceSource(ing.ingredient_id, rid);
      const cost = calcIngredientCost(ing.ingredient_id, ing.gross_quantity, ing.unit, rid);
      totalCost += cost;
      if (!priceSource.hasPrice) missingPriceCount++;
      // Compute net_quantity when not stored: gross × (1 - waste%)
      const wasteP = ing.custom_waste_percent ?? ing.default_waste_percent ?? 0;
      const netQty = ing.net_quantity != null
        ? ing.net_quantity
        : Math.round(ing.gross_quantity * (1 - wasteP / 100) * 10) / 10;
      return {
        ...ing,
        net_quantity: netQty,
        is_sub_recipe: false,
        cost: Math.round(cost * 100) / 100,
        missing_price: !priceSource.hasPrice,
        price_source: priceSource.source
      };
    }
  });

  const steps = all('SELECT * FROM recipe_steps WHERE recipe_id = ? AND restaurant_id = ? ORDER BY step_number', [id, rid]);

  totalCost = Math.round(totalCost * 100) / 100;
  const costPerPortion = recipe.portions > 0 ? Math.round((totalCost / recipe.portions) * 100) / 100 : totalCost;
  const foodCostPercent = recipe.selling_price > 0 ? Math.round((costPerPortion / recipe.selling_price) * 10000) / 100 : null;
  const margin = recipe.selling_price > 0 ? Math.round((recipe.selling_price - costPerPortion) * 100) / 100 : null;

  return {
    ...recipe,
    ingredients: enrichedIngredients,
    steps,
    total_cost: totalCost,
    cost_per_portion: costPerPortion,
    food_cost_percent: foodCostPercent,
    margin,
    missing_price_count: missingPriceCount
  };
}

router.get('/', (req, res) => {
  const rid = req.user.restaurant_id;
  const { type, limit: limStr, offset: offsetStr } = req.query;
  const limit = Math.min(parseInt(limStr) || 50, 200);
  const offset = Math.max(parseInt(offsetStr) || 0, 0);

  let sql = 'SELECT * FROM recipes WHERE restaurant_id = ?';
  const params = [rid];
  if (type) {
    sql += ' AND recipe_type = ?';
    params.push(type);
  }
  sql += ' ORDER BY updated_at DESC';

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM recipes WHERE restaurant_id = ?';
  const countParams = [rid];
  if (type) {
    countSql += ' AND recipe_type = ?';
    countParams.push(type);
  }
  const countResult = get(countSql, countParams);
  const total = countResult ? countResult.total : 0;

  // Apply pagination
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const recipes = all(sql, params);
  const enriched = recipes.map(r => {
    const full = getFullRecipe(r.id, rid);
    return {
      id: r.id, name: r.name, category: r.category, portions: r.portions,
      selling_price: r.selling_price, total_cost: full.total_cost,
      cost_per_portion: full.cost_per_portion, food_cost_percent: full.food_cost_percent,
      margin: full.margin, prep_time_min: r.prep_time_min,
      cooking_time_min: r.cooking_time_min, updated_at: r.updated_at,
      recipe_type: r.recipe_type || 'plat'
    };
  });
  res.json({ recipes: enriched, total, limit, offset });
});

// ═══════════════════════════════════════════
// GET /api/recipes/availability — Disponibilité des plats en fonction du stock
// Calcule combien de portions de chaque plat sont réalisables
// Utilisé par l'interface salle pour indiquer les plats disponibles
// IMPORTANT: Must be declared BEFORE /:id to avoid Express matching 'availability' as an id
// ═══════════════════════════════════════════
router.get('/availability', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { convertUnit } = require('../utils/units');

    // Get all sellable recipes (plats with a selling price)
    const recipes = all(`
      SELECT id, name, category, selling_price, portions
      FROM recipes
      WHERE selling_price > 0 AND recipe_type = 'plat' AND restaurant_id = ?
      ORDER BY category, name
    `, [rid]);

    // Get current stock
    const stockData = all('SELECT ingredient_id, quantity, unit FROM stock WHERE restaurant_id = ?', [rid]);
    const stockMap = {};
    for (const s of stockData) {
      stockMap[s.ingredient_id] = s;
    }

    const availability = recipes.map(recipe => {
      const flatIngredients = getFlatIngredients(recipe.id, rid, 1);

      if (flatIngredients.length === 0) {
        return {
          recipe_id: recipe.id,
          name: recipe.name,
          category: recipe.category,
          selling_price: recipe.selling_price,
          portions_available: null,
          status: 'unknown'
        };
      }

      // For each ingredient, calculate how many portions we can make
      let minPortions = Infinity;
      let limitingIngredient = null;

      for (const fi of flatIngredients) {
        const stock = stockMap[fi.ingredient_id];
        if (!stock || stock.quantity <= 0) {
          minPortions = 0;
          const ing = get('SELECT name FROM ingredients WHERE id = ? AND restaurant_id = ?', [fi.ingredient_id, rid]);
          limitingIngredient = ing ? ing.name : `#${fi.ingredient_id}`;
          break;
        }

        // Convert recipe quantity to stock unit
        const neededInStockUnit = convertUnit(fi.quantity, fi.unit, stock.unit);
        if (neededInStockUnit <= 0) continue;

        const possiblePortions = Math.floor(stock.quantity / neededInStockUnit);
        if (possiblePortions < minPortions) {
          minPortions = possiblePortions;
          const ing = get('SELECT name FROM ingredients WHERE id = ? AND restaurant_id = ?', [fi.ingredient_id, rid]);
          limitingIngredient = ing ? ing.name : `#${fi.ingredient_id}`;
        }
      }

      if (minPortions === Infinity) minPortions = null;

      // Status: available (5+), low (1-4), unavailable (0)
      let status = 'available';
      if (minPortions === 0) status = 'unavailable';
      else if (minPortions !== null && minPortions <= 4) status = 'low';

      return {
        recipe_id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        selling_price: recipe.selling_price,
        portions_available: minPortions,
        limiting_ingredient: limitingIngredient,
        status
      };
    });

    const summary = {
      total: availability.length,
      available: availability.filter(a => a.status === 'available').length,
      low: availability.filter(a => a.status === 'low').length,
      unavailable: availability.filter(a => a.status === 'unavailable').length
    };

    res.json({ summary, items: availability });
  } catch (e) {
    res.status(500).json({ error: 'Erreur calcul disponibilité', details: e.message });
  }
});

router.get('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const recipe = getFullRecipe(Number(req.params.id), rid);
  if (!recipe) return res.status(404).json({ error: 'not found' });
  res.json(recipe);
});

// Flat ingredients for stock deduction
router.get('/:id/ingredients-flat', (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (!recipe) return res.status(404).json({ error: 'not found' });

  const flat = getFlatIngredients(id, rid);
  // Enrich with names
  const enriched = flat.map(item => {
    const ing = get('SELECT name, default_unit FROM ingredients WHERE id = ? AND restaurant_id = ?', [item.ingredient_id, rid]);
    return {
      ...item,
      ingredient_name: ing ? ing.name : `#${item.ingredient_id}`,
      quantity: Math.round(item.quantity * 1000) / 1000
    };
  });
  res.json(enriched);
});

router.post('/', validate(recipeValidation), (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { name, category, portions, prep_time_min, cooking_time_min, selling_price, notes, ingredients, steps, recipe_type } = req.body;

    // Validate required fields
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Validate portions (must be positive integer)
    if (portions !== undefined && portions !== null) {
      if (!Number.isInteger(portions) || portions <= 0) {
        return res.status(400).json({ error: 'portions must be a positive integer' });
      }
    }

    // Validate selling_price (must be positive number if provided)
    if (selling_price !== undefined && selling_price !== null) {
      if (typeof selling_price !== 'number' || selling_price < 0) {
        return res.status(400).json({ error: 'selling_price must be a non-negative number' });
      }
    }

    // Validate prep_time_min (must be positive integer if provided)
    if (prep_time_min !== undefined && prep_time_min !== null) {
      if (!Number.isInteger(prep_time_min) || prep_time_min < 0) {
        return res.status(400).json({ error: 'prep_time_min must be a non-negative integer' });
      }
    }

    // Validate cooking_time_min (must be positive integer if provided)
    if (cooking_time_min !== undefined && cooking_time_min !== null) {
      if (!Number.isInteger(cooking_time_min) || cooking_time_min < 0) {
        return res.status(400).json({ error: 'cooking_time_min must be a non-negative integer' });
      }
    }

    // Validate ingredients array items
    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        if (ing.gross_quantity !== undefined && ing.gross_quantity !== null) {
          if (typeof ing.gross_quantity !== 'number' || ing.gross_quantity <= 0) {
            return res.status(400).json({ error: 'All ingredient gross_quantity values must be positive numbers' });
          }
        }
      }
    }

    const info = run(
      'INSERT INTO recipes (restaurant_id, name, category, portions, prep_time_min, cooking_time_min, selling_price, notes, recipe_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [rid, name, category || null, portions || 1, prep_time_min || null, cooking_time_min || null, selling_price || null, notes || null, recipe_type || 'plat']
    );
    const recipeId = info.lastInsertRowid;

    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        if (ing.sub_recipe_id) {
          // Sub-recipe ingredient
          run(
            'INSERT INTO recipe_ingredients (restaurant_id, recipe_id, ingredient_id, sub_recipe_id, gross_quantity, net_quantity, unit, notes) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
            [rid, recipeId, ing.sub_recipe_id, ing.gross_quantity || 1, ing.gross_quantity || 1, 'portion', ing.notes || null]
          );
          continue;
        }

        let ingredientId = ing.ingredient_id;
        const ingName = ing.name || ing.ingredient_name;
        if (!ingredientId && ingName) {
          const existing = get('SELECT id FROM ingredients WHERE name = ? AND restaurant_id = ?', [ingName.trim().toLowerCase(), rid]);
          if (existing) {
            ingredientId = existing.id;
          } else {
            const newIng = run(
              'INSERT INTO ingredients (restaurant_id, name, category, default_unit, waste_percent, price_per_unit, price_unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [rid, ingName.trim().toLowerCase(), ing.category || null, ing.unit || 'g', ing.waste_percent || 0, ing.price_per_unit || 0, ing.price_unit || 'kg']
            );
            ingredientId = newIng.lastInsertRowid;
          }
        }
        const wastePercent = ing.custom_waste_percent ?? ing.waste_percent ?? null;
        const grossQty = ing.gross_quantity;
        const netQty = ing.net_quantity ?? (wastePercent != null ? grossQty * (1 - wastePercent / 100) : grossQty);
        run(
          'INSERT INTO recipe_ingredients (restaurant_id, recipe_id, ingredient_id, gross_quantity, net_quantity, unit, custom_waste_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [rid, recipeId, ingredientId, grossQty, netQty, ing.unit || 'g', wastePercent, ing.notes || null]
        );
      }
    }

    if (steps && steps.length > 0) {
      steps.forEach((step, i) => {
        const instruction = typeof step === 'string' ? step : step.instruction;
        run('INSERT INTO recipe_steps (restaurant_id, recipe_id, step_number, instruction) VALUES (?, ?, ?, ?)', [rid, recipeId, i + 1, instruction]);
      });
    }

    res.status(201).json(getFullRecipe(recipeId, rid));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', validate(recipeValidation), (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'not found' });

    const { name, category, portions, prep_time_min, cooking_time_min, selling_price, notes, ingredients, steps, recipe_type } = req.body;

    // Validate portions (must be positive integer if provided)
    if (portions !== undefined && portions !== null) {
      if (!Number.isInteger(portions) || portions <= 0) {
        return res.status(400).json({ error: 'portions must be a positive integer' });
      }
    }

    // Validate selling_price (must be non-negative number if provided)
    if (selling_price !== undefined && selling_price !== null) {
      if (typeof selling_price !== 'number' || selling_price < 0) {
        return res.status(400).json({ error: 'selling_price must be a non-negative number' });
      }
    }

    // Validate prep_time_min (must be non-negative integer if provided)
    if (prep_time_min !== undefined && prep_time_min !== null) {
      if (!Number.isInteger(prep_time_min) || prep_time_min < 0) {
        return res.status(400).json({ error: 'prep_time_min must be a non-negative integer' });
      }
    }

    // Validate cooking_time_min (must be non-negative integer if provided)
    if (cooking_time_min !== undefined && cooking_time_min !== null) {
      if (!Number.isInteger(cooking_time_min) || cooking_time_min < 0) {
        return res.status(400).json({ error: 'cooking_time_min must be a non-negative integer' });
      }
    }

    // Validate ingredients array items
    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        if (ing.gross_quantity !== undefined && ing.gross_quantity !== null) {
          if (typeof ing.gross_quantity !== 'number' || ing.gross_quantity <= 0) {
            return res.status(400).json({ error: 'All ingredient gross_quantity values must be positive numbers' });
          }
        }
      }
    }

    run(
      'UPDATE recipes SET name = ?, category = ?, portions = ?, prep_time_min = ?, cooking_time_min = ?, selling_price = ?, notes = ?, recipe_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
      [
        name || existing.name,
        category !== undefined ? category : existing.category,
        portions || existing.portions,
        prep_time_min !== undefined ? prep_time_min : existing.prep_time_min,
        cooking_time_min !== undefined ? cooking_time_min : existing.cooking_time_min,
        selling_price !== undefined ? selling_price : existing.selling_price,
        notes !== undefined ? notes : existing.notes,
        recipe_type !== undefined ? recipe_type : (existing.recipe_type || 'plat'),
        id,
        rid
      ]
    );

    if (ingredients) {
      run('DELETE FROM recipe_ingredients WHERE recipe_id = ? AND restaurant_id = ?', [id, rid]);
      for (const ing of ingredients) {
        if (ing.sub_recipe_id) {
          run(
            'INSERT INTO recipe_ingredients (restaurant_id, recipe_id, ingredient_id, sub_recipe_id, gross_quantity, net_quantity, unit, notes) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
            [rid, id, ing.sub_recipe_id, ing.gross_quantity || 1, ing.gross_quantity || 1, 'portion', ing.notes || null]
          );
          continue;
        }

        let ingredientId = ing.ingredient_id;
        const ingName2 = ing.name || ing.ingredient_name;
        if (!ingredientId && ingName2) {
          const ex = get('SELECT id FROM ingredients WHERE name = ? AND restaurant_id = ?', [ingName2.trim().toLowerCase(), rid]);
          if (ex) {
            ingredientId = ex.id;
          } else {
            const newIng = run(
              'INSERT INTO ingredients (restaurant_id, name, category, default_unit, waste_percent, price_per_unit, price_unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [rid, ingName2.trim().toLowerCase(), ing.category || null, ing.unit || 'g', ing.waste_percent || 0, ing.price_per_unit || 0, ing.price_unit || 'kg']
            );
            ingredientId = newIng.lastInsertRowid;
          }
        }
        const wastePercent = ing.custom_waste_percent ?? ing.waste_percent ?? null;
        const grossQty = ing.gross_quantity;
        const netQty = ing.net_quantity ?? (wastePercent != null ? grossQty * (1 - wastePercent / 100) : grossQty);
        run(
          'INSERT INTO recipe_ingredients (restaurant_id, recipe_id, ingredient_id, gross_quantity, net_quantity, unit, custom_waste_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [rid, id, ingredientId, grossQty, netQty, ing.unit || 'g', wastePercent, ing.notes || null]
        );
      }
    }

    if (steps) {
      run('DELETE FROM recipe_steps WHERE recipe_id = ? AND restaurant_id = ?', [id, rid]);
      steps.forEach((step, i) => {
        const instruction = typeof step === 'string' ? step : step.instruction;
        run('INSERT INTO recipe_steps (restaurant_id, recipe_id, step_number, instruction) VALUES (?, ?, ?, ?)', [rid, id, i + 1, instruction]);
      });
    }

    res.json(getFullRecipe(id, rid));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  // Verify recipe belongs to caller tenant before cascading deletes
  const existing = get('SELECT id FROM recipes WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  run('DELETE FROM recipe_ingredients WHERE recipe_id = ? AND restaurant_id = ?', [id, rid]);
  run('DELETE FROM recipe_steps WHERE recipe_id = ? AND restaurant_id = ?', [id, rid]);
  const info = run('DELETE FROM recipes WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

router.get('/:id/pdf', (req, res) => {
  const rid = req.user.restaurant_id;
  const recipe = getFullRecipe(Number(req.params.id), rid);
  if (!recipe) return res.status(404).json({ error: 'not found' });
  const { generatePDF } = require('./pdf-export');
  generatePDF(recipe, res);
});

// GET /api/recipes/:id/allergens — Allergènes calculés automatiquement (INCO)
router.get('/:id/allergens', requireAuth, (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const recipeId = Number(req.params.id);
    const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [recipeId, rid]);
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

module.exports = router;
module.exports.getFlatIngredients = getFlatIngredients;
