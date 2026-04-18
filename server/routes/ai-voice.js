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
  GEMINI_API_KEY, buildGeminiUrl, geminiHeaders, selectModel,
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
        contents: [{ parts: [{ text: `Transcription vocale du chef :\n"${text}"\n\nAnalyse cette transcription et retourne la fiche technique en JSON.` }] }],
        systemInstruction: { parts: [{ text: VOICE_PARSE_SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', err);
      return res.status(502).json({ error: 'AI service error', details: err });
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
        contents: [{ parts: [{ text: `Instruction vocale du chef :\n"${text}"${recipeContext}\n\nAnalyse et retourne les actions à effectuer en JSON.` }] }],
        systemInstruction: { parts: [{ text: VOICE_MODIFY_SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'AI service error', details: err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Empty AI response' });

    const actions = JSON.parse(content);

    // Apply supplier preferences immediately
    if (actions.actions) {
      for (const action of actions.actions) {
        if (action.type === 'supplier_preference') {
          // Find or create supplier (scoped to caller tenant)
          let supplier = get('SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?) AND restaurant_id = ?', [action.supplier_name, rid]);
          if (!supplier) {
            const info = run(
              'INSERT INTO suppliers (restaurant_id, name, quality_rating, quality_notes) VALUES (?, ?, ?, ?)',
              [rid, action.supplier_name, action.quality_rating || 3, action.reason || null]
            );
            supplier = get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
          }

          // Find ingredient (scoped to caller tenant)
          const ingredient = get('SELECT * FROM ingredients WHERE LOWER(name) LIKE ? AND restaurant_id = ?',
            [`%${action.ingredient_name.toLowerCase()}%`, rid]);

          if (supplier && ingredient) {
            // Save preference
            try {
              run(
                `INSERT OR REPLACE INTO ingredient_supplier_prefs (restaurant_id, ingredient_id, recipe_id, supplier_id, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [rid, ingredient.id, action.scope === 'recipe' ? recipe_id : null, supplier.id, action.reason || null]
              );

              // Also update ingredient's preferred supplier if global
              if (action.scope === 'global') {
                run('UPDATE ingredients SET preferred_supplier_id = ? WHERE id = ? AND restaurant_id = ?', [supplier.id, ingredient.id, rid]);
              }

              action.applied = true;
              action.supplier_id = supplier.id;
              action.ingredient_id = ingredient.id;
            } catch (e) {
              action.applied = false;
              action.error = e.message;
            }
          }
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
