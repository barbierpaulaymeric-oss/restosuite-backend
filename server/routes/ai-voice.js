// ═══════════════════════════════════════════
// /api/ai/parse-voice  → structured recipe extraction from a voice transcript
// /api/ai/modify-voice → voice-driven recipe modifications + supplier prefs
//
// Both endpoints are "simple" Gemini calls (JSON-mode, low temperature) and
// share the prompts + model selector in ai-core.js.
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const {
  all, get, run,
  GEMINI_API_KEY, buildGeminiUrl, geminiHeaders, selectModel, scrubPII,
  VOICE_PARSE_SYSTEM, VOICE_MODIFY_SYSTEM,
} = require('./ai-core');

const router = Router();

router.post('/parse-voice', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const response = await fetch(buildGeminiUrl(selectModel('parse-voice', req.user?.restaurant_id)), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Transcription vocale du chef :\n"${scrubPII(text)}"\n\nAnalyse cette transcription et retourne la fiche technique en JSON.` }] }],
        systemInstruction: { parts: [{ text: VOICE_PARSE_SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', err);
      return res.status(502).json({ error: 'AI service error', details: process.env.NODE_ENV === 'production' ? undefined : err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Empty AI response' });

    const parsed = JSON.parse(content);

    // Match ingredients with existing DB entries (fuzzy) and enrich with prices.
    // Scoped by caller's restaurant_id (PENTEST_REPORT — unscoped `FROM ingredients`
    // leak previously let fuzzy matches return another tenant's prices).
    const rid = req.user && req.user.restaurant_id;
    if (parsed.ingredients && parsed.ingredients.length > 0) {
      let estimatedCost = 0;
      for (const ing of parsed.ingredients) {
        const name = (ing.name || '').toLowerCase().trim();
        // Exact match first, then fuzzy
        let match = get('SELECT * FROM ingredients WHERE name = ? AND restaurant_id = ?', [name, rid]);
        if (!match) {
          match = get('SELECT * FROM ingredients WHERE name LIKE ? AND restaurant_id = ? ORDER BY LENGTH(name) ASC LIMIT 1', [`%${name}%`, rid]);
        }
        if (match) {
          ing.ingredient_id = match.id;
          ing.matched_name = match.name;
          ing.price_per_unit = match.price_per_unit || 0;
          ing.price_unit = match.price_unit || 'kg';
          // Calc cost for this ingredient
          if (match.price_per_unit > 0) {
            const p = match.price_per_unit;
            const pu = match.price_unit || 'kg';
            let costPerBase = 0;
            if (pu === 'kg') costPerBase = p / 1000;
            else if (pu === 'g') costPerBase = p;
            else if (pu === 'l') costPerBase = p / 1000;
            else if (pu === 'cl') costPerBase = p / 100;
            else if (pu === 'pièce' || pu === 'botte') costPerBase = p;
            else costPerBase = p / 1000;

            let qtyInBase = ing.gross_quantity || 0;
            const unit = ing.unit || 'g';
            if (unit === 'kg') qtyInBase *= 1000;
            else if (unit === 'l') qtyInBase *= 1000;
            else if (unit === 'cl') qtyInBase *= 10;

            ing.estimated_cost = Math.round(qtyInBase * costPerBase * 100) / 100;
            estimatedCost += ing.estimated_cost;
          }
          // Use DB waste_percent if AI didn't provide one
          if (!ing.waste_percent && match.waste_percent) {
            ing.waste_percent = match.waste_percent;
          }
        }
      }
      parsed.estimated_total_cost = Math.round(estimatedCost * 100) / 100;
      if (parsed.portions > 0) {
        parsed.estimated_cost_per_portion = Math.round((estimatedCost / parsed.portions) * 100) / 100;
      }
    }

    res.json(parsed);
  } catch (e) {
    console.error('AI parse error:', e);
    res.status(500).json({ error: 'Failed to parse voice input' });
  }
});

router.post('/modify-voice', async (req, res) => {
  const { text, recipe_id } = req.body;
  const rid = req.user.restaurant_id;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  // Get current recipe context for the AI
  let recipeContext = '';
  if (recipe_id) {
    const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [recipe_id, rid]);
    if (recipe) {
      const ingredients = all(`
        SELECT ri.*, i.name as ingredient_name
        FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ? AND ri.restaurant_id = ? AND i.restaurant_id = ?`, [recipe_id, rid, rid]);
      recipeContext = `\n\nRecette actuelle: "${recipe.name}" (${recipe.portions} portions)\nIngrédients: ${ingredients.map(i => `${i.ingredient_name} ${i.gross_quantity}${i.unit}`).join(', ')}`;
    }
  }

  try {
    const response = await fetch(buildGeminiUrl(selectModel('modify-voice', rid)), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Instruction vocale du chef :\n"${scrubPII(text)}"${recipeContext}\n\nAnalyse et retourne les actions à effectuer en JSON.` }] }],
        systemInstruction: { parts: [{ text: VOICE_MODIFY_SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'AI service error', details: process.env.NODE_ENV === 'production' ? undefined : err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Empty AI response' });

    const actions = JSON.parse(content);

    // Helpers — fuzzy match d'un ingrédient existant pour le tenant.
    function findOrCreateIngredient(name) {
      const n = (name || '').trim();
      if (!n) return null;
      let row = get('SELECT * FROM ingredients WHERE LOWER(name) = LOWER(?) AND restaurant_id = ?', [n, rid]);
      if (row) return row;
      row = get('SELECT * FROM ingredients WHERE LOWER(name) LIKE ? AND restaurant_id = ? ORDER BY LENGTH(name) ASC LIMIT 1',
        [`%${n.toLowerCase()}%`, rid]);
      if (row) return row;
      try {
        const info = run('INSERT INTO ingredients (restaurant_id, name, unit) VALUES (?, ?, ?)', [rid, n, 'kg']);
        return get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
      } catch { return null; }
    }
    // Trouve la ligne recipe_ingredients qui contient un ingrédient donné dans
    // la fiche courante (par nom approximatif).
    function findRecipeLine(recId, name) {
      if (!recId || !name) return null;
      return get(`
        SELECT ri.* FROM recipe_ingredients ri
          JOIN ingredients i ON i.id = ri.ingredient_id AND i.restaurant_id = ?
         WHERE ri.recipe_id = ? AND ri.restaurant_id = ?
           AND LOWER(i.name) LIKE ?
         ORDER BY LENGTH(i.name) ASC LIMIT 1`,
        [rid, recId, rid, `%${name.toLowerCase().trim()}%`]
      );
    }

    // Application des actions retournées par Gemini. supplier_preference est
    // appliqué globalement ou sur la fiche ; les autres types nécessitent un
    // recipe_id (sinon on les marque comme non-applicables).
    if (actions.actions) {
      for (const action of actions.actions) {
        try {
          if (action.type === 'supplier_preference') {
            let supplier = get('SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?) AND restaurant_id = ?', [action.supplier_name, rid]);
            if (!supplier) {
              const info = run(
                'INSERT INTO suppliers (restaurant_id, name, quality_rating, quality_notes) VALUES (?, ?, ?, ?)',
                [rid, action.supplier_name, action.quality_rating || 3, action.reason || null]
              );
              supplier = get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
            }
            const ingredient = findOrCreateIngredient(action.ingredient_name);
            if (supplier && ingredient) {
              run(
                `INSERT OR REPLACE INTO ingredient_supplier_prefs (restaurant_id, ingredient_id, recipe_id, supplier_id, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [rid, ingredient.id, action.scope === 'recipe' ? recipe_id : null, supplier.id, action.reason || null]
              );
              if (action.scope === 'global') {
                run('UPDATE ingredients SET preferred_supplier_id = ? WHERE id = ? AND restaurant_id = ?', [supplier.id, ingredient.id, rid]);
              }
              action.applied = true;
              action.supplier_id = supplier.id;
              action.ingredient_id = ingredient.id;
            } else {
              action.applied = false;
              action.error = 'Fournisseur ou ingrédient introuvable';
            }

          } else if (action.type === 'substitute' || action.type === 'substitution') {
            if (!recipe_id) { action.applied = false; action.error = 'recipe_id requis'; continue; }
            const oldName = action.from || action.old_ingredient || action.original;
            const newName = action.to || action.new_ingredient || action.replacement;
            const line = findRecipeLine(recipe_id, oldName);
            const target = findOrCreateIngredient(newName);
            if (line && target) {
              run('UPDATE recipe_ingredients SET ingredient_id = ? WHERE id = ? AND restaurant_id = ?',
                [target.id, line.id, rid]);
              action.applied = true;
            } else {
              action.applied = false;
              action.error = !line ? `Ingrédient "${oldName}" introuvable dans la fiche` : `Substitut "${newName}" indéfini`;
            }

          } else if (action.type === 'quantity_change' || action.type === 'change_quantity') {
            if (!recipe_id) { action.applied = false; action.error = 'recipe_id requis'; continue; }
            const line = findRecipeLine(recipe_id, action.ingredient_name);
            const qty = Number(action.new_quantity);
            if (line && qty > 0) {
              const newUnit = action.unit || line.unit;
              run('UPDATE recipe_ingredients SET gross_quantity = ?, unit = ? WHERE id = ? AND restaurant_id = ?',
                [qty, newUnit, line.id, rid]);
              action.applied = true;
            } else {
              action.applied = false;
              action.error = !line ? 'Ingrédient introuvable dans la fiche' : 'Quantité invalide';
            }

          } else if (action.type === 'add_ingredient') {
            if (!recipe_id) { action.applied = false; action.error = 'recipe_id requis'; continue; }
            const target = findOrCreateIngredient(action.ingredient_name);
            const qty = Number(action.quantity);
            if (target && qty > 0) {
              run(
                `INSERT INTO recipe_ingredients (restaurant_id, recipe_id, ingredient_id, gross_quantity, unit, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [rid, recipe_id, target.id, qty, action.unit || 'g', action.notes || null]
              );
              action.applied = true;
            } else {
              action.applied = false;
              action.error = !target ? 'Ingrédient indéfini' : 'Quantité invalide';
            }

          } else if (action.type === 'remove_ingredient') {
            if (!recipe_id) { action.applied = false; action.error = 'recipe_id requis'; continue; }
            const line = findRecipeLine(recipe_id, action.ingredient_name);
            if (line) {
              run('DELETE FROM recipe_ingredients WHERE id = ? AND restaurant_id = ?', [line.id, rid]);
              action.applied = true;
            } else {
              action.applied = false;
              action.error = 'Ingrédient introuvable dans la fiche';
            }

          } else if (action.type === 'note') {
            if (!recipe_id) { action.applied = false; action.error = 'recipe_id requis'; continue; }
            const note = (action.text || action.content || '').trim();
            if (note) {
              // Append à recipes.notes pour conserver l'historique des observations chef.
              run(
                `UPDATE recipes SET notes = COALESCE(notes || char(10), '') || ? WHERE id = ? AND restaurant_id = ?`,
                [note, recipe_id, rid]
              );
              action.applied = true;
            } else {
              action.applied = false;
              action.error = 'Note vide';
            }

          } else {
            action.applied = false;
            action.error = 'Type d\'action non supporté: ' + action.type;
          }
        } catch (e) {
          action.applied = false;
          action.error = e.message;
        }
      }
    }

    res.json(actions);
  } catch (e) {
    console.error('AI modify error:', e);
    res.status(500).json({ error: 'Failed to process voice command' });
  }
});

module.exports = router;
