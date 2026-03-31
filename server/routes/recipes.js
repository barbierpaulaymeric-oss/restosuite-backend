const { Router } = require('express');
const { all, get, run } = require('../db');
const router = Router();

function calcIngredientCost(ingredientId, grossQty, unit) {
  const price = get(`
    SELECT sp.price, sp.unit FROM supplier_prices sp
    WHERE sp.ingredient_id = ? ORDER BY sp.price ASC LIMIT 1
  `, [ingredientId]);
  if (!price) return 0;

  const p = price.price;
  const pu = price.unit;
  let costPerBase = 0;
  if (pu === 'kg') costPerBase = p / 1000;
  else if (pu === 'g') costPerBase = p;
  else if (pu === 'l') costPerBase = p / 1000;
  else if (pu === 'cl') costPerBase = p / 100;
  else if (pu === 'pièce' || pu === 'botte') costPerBase = p;
  else costPerBase = p / 1000;

  let qtyInBase = grossQty;
  if (unit === 'kg') qtyInBase = grossQty * 1000;
  else if (unit === 'l') qtyInBase = grossQty * 1000;
  else if (unit === 'cl') qtyInBase = grossQty * 10;

  return qtyInBase * costPerBase;
}

function getFullRecipe(id) {
  const recipe = get('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!recipe) return null;

  const ingredients = all(`
    SELECT ri.*, i.name as ingredient_name, i.category as ingredient_category,
           i.default_unit, i.waste_percent as default_waste_percent, i.allergens
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = ?
  `, [id]);

  let totalCost = 0;
  const enrichedIngredients = ingredients.map(ing => {
    const cost = calcIngredientCost(ing.ingredient_id, ing.gross_quantity, ing.unit);
    totalCost += cost;
    return { ...ing, cost: Math.round(cost * 100) / 100 };
  });

  const steps = all('SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number', [id]);

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
    margin
  };
}

router.get('/', (req, res) => {
  const recipes = all('SELECT * FROM recipes ORDER BY updated_at DESC');
  const enriched = recipes.map(r => {
    const full = getFullRecipe(r.id);
    return {
      id: r.id, name: r.name, category: r.category, portions: r.portions,
      selling_price: r.selling_price, total_cost: full.total_cost,
      cost_per_portion: full.cost_per_portion, food_cost_percent: full.food_cost_percent,
      margin: full.margin, prep_time_min: r.prep_time_min,
      cooking_time_min: r.cooking_time_min, updated_at: r.updated_at
    };
  });
  res.json(enriched);
});

router.get('/:id', (req, res) => {
  const recipe = getFullRecipe(Number(req.params.id));
  if (!recipe) return res.status(404).json({ error: 'not found' });
  res.json(recipe);
});

router.post('/', (req, res) => {
  const { name, category, portions, prep_time_min, cooking_time_min, selling_price, notes, ingredients, steps } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const info = run(
    'INSERT INTO recipes (name, category, portions, prep_time_min, cooking_time_min, selling_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, category || null, portions || 1, prep_time_min || null, cooking_time_min || null, selling_price || null, notes || null]
  );
  const recipeId = info.lastInsertRowid;

  if (ingredients && ingredients.length > 0) {
    for (const ing of ingredients) {
      let ingredientId = ing.ingredient_id;
      if (!ingredientId && ing.name) {
        const existing = get('SELECT id FROM ingredients WHERE name = ?', [ing.name.trim().toLowerCase()]);
        if (existing) {
          ingredientId = existing.id;
        } else {
          const newIng = run(
            'INSERT INTO ingredients (name, category, default_unit, waste_percent) VALUES (?, ?, ?, ?)',
            [ing.name.trim().toLowerCase(), ing.category || null, ing.unit || 'g', ing.waste_percent || 0]
          );
          ingredientId = newIng.lastInsertRowid;
        }
      }
      const wastePercent = ing.custom_waste_percent ?? ing.waste_percent ?? null;
      const grossQty = ing.gross_quantity;
      const netQty = ing.net_quantity ?? (wastePercent != null ? grossQty * (1 - wastePercent / 100) : grossQty);
      run(
        'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, net_quantity, unit, custom_waste_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [recipeId, ingredientId, grossQty, netQty, ing.unit || 'g', wastePercent, ing.notes || null]
      );
    }
  }

  if (steps && steps.length > 0) {
    steps.forEach((step, i) => {
      const instruction = typeof step === 'string' ? step : step.instruction;
      run('INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)', [recipeId, i + 1, instruction]);
    });
  }

  res.status(201).json(getFullRecipe(recipeId));
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { name, category, portions, prep_time_min, cooking_time_min, selling_price, notes, ingredients, steps } = req.body;

  run(
    'UPDATE recipes SET name = ?, category = ?, portions = ?, prep_time_min = ?, cooking_time_min = ?, selling_price = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [
      name || existing.name,
      category !== undefined ? category : existing.category,
      portions || existing.portions,
      prep_time_min !== undefined ? prep_time_min : existing.prep_time_min,
      cooking_time_min !== undefined ? cooking_time_min : existing.cooking_time_min,
      selling_price !== undefined ? selling_price : existing.selling_price,
      notes !== undefined ? notes : existing.notes,
      id
    ]
  );

  if (ingredients) {
    run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
    for (const ing of ingredients) {
      let ingredientId = ing.ingredient_id;
      if (!ingredientId && ing.name) {
        const ex = get('SELECT id FROM ingredients WHERE name = ?', [ing.name.trim().toLowerCase()]);
        if (ex) {
          ingredientId = ex.id;
        } else {
          const newIng = run(
            'INSERT INTO ingredients (name, category, default_unit, waste_percent) VALUES (?, ?, ?, ?)',
            [ing.name.trim().toLowerCase(), ing.category || null, ing.unit || 'g', ing.waste_percent || 0]
          );
          ingredientId = newIng.lastInsertRowid;
        }
      }
      const wastePercent = ing.custom_waste_percent ?? ing.waste_percent ?? null;
      const grossQty = ing.gross_quantity;
      const netQty = ing.net_quantity ?? (wastePercent != null ? grossQty * (1 - wastePercent / 100) : grossQty);
      run(
        'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, net_quantity, unit, custom_waste_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, ingredientId, grossQty, netQty, ing.unit || 'g', wastePercent, ing.notes || null]
      );
    }
  }

  if (steps) {
    run('DELETE FROM recipe_steps WHERE recipe_id = ?', [id]);
    steps.forEach((step, i) => {
      const instruction = typeof step === 'string' ? step : step.instruction;
      run('INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)', [id, i + 1, instruction]);
    });
  }

  res.json(getFullRecipe(id));
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
  run('DELETE FROM recipe_steps WHERE recipe_id = ?', [id]);
  const info = run('DELETE FROM recipes WHERE id = ?', [id]);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

router.get('/:id/pdf', (req, res) => {
  const recipe = getFullRecipe(Number(req.params.id));
  if (!recipe) return res.status(404).json({ error: 'not found' });

  let text = `═══════════════════════════════════════════\n`;
  text += `  FICHE TECHNIQUE — ${recipe.name.toUpperCase()}\n`;
  text += `═══════════════════════════════════════════\n\n`;
  text += `Catégorie : ${recipe.category || '—'}    Portions : ${recipe.portions}\n`;
  text += `Préparation : ${recipe.prep_time_min || '—'} min    Cuisson : ${recipe.cooking_time_min || '—'} min\n\n`;
  text += `───────────────────────────────────────────\n`;
  text += `  INGRÉDIENTS\n`;
  text += `───────────────────────────────────────────\n`;
  text += `${'Ingrédient'.padEnd(25)} ${'Brut'.padStart(8)} ${'Net'.padStart(8)} ${'Perte%'.padStart(7)} ${'Coût €'.padStart(8)}\n`;
  text += `${'─'.repeat(25)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(7)} ${'─'.repeat(8)}\n`;

  for (const ing of recipe.ingredients) {
    const waste = ing.custom_waste_percent ?? ing.default_waste_percent ?? 0;
    text += `${(ing.ingredient_name || '').padEnd(25).slice(0, 25)} ${(ing.gross_quantity + ing.unit).padStart(8)} ${((ing.net_quantity || ing.gross_quantity) + ing.unit).padStart(8)} ${(waste + '%').padStart(7)} ${(ing.cost.toFixed(2)).padStart(8)}\n`;
  }

  text += `\n${'COÛT TOTAL MATIÈRE :'.padEnd(50)} ${recipe.total_cost.toFixed(2)} €\n`;
  text += `${'COÛT PAR PORTION :'.padEnd(50)} ${recipe.cost_per_portion.toFixed(2)} €\n`;
  if (recipe.selling_price) {
    text += `${'PRIX DE VENTE :'.padEnd(50)} ${recipe.selling_price.toFixed(2)} €\n`;
    text += `${'FOOD COST :'.padEnd(50)} ${recipe.food_cost_percent}%\n`;
    text += `${'MARGE :'.padEnd(50)} ${recipe.margin.toFixed(2)} €\n`;
  }

  if (recipe.steps.length > 0) {
    text += `\n───────────────────────────────────────────\n`;
    text += `  PROCÉDURE\n`;
    text += `───────────────────────────────────────────\n`;
    for (const step of recipe.steps) {
      text += `${step.step_number}. ${step.instruction}\n\n`;
    }
  }

  if (recipe.notes) text += `\nNotes : ${recipe.notes}\n`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="fiche-${recipe.name.replace(/\s+/g, '-')}.txt"`);
  res.send(text);
});

module.exports = router;
