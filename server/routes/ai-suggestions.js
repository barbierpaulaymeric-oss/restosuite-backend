// ═══════════════════════════════════════════
// /api/ai/suggest-suppliers — per-ingredient best-value supplier pick
// /api/ai/menu-suggestions  — top-profit dishes, food-cost to improve, daily special
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const {
  all, get,
  GEMINI_API_KEY, buildGeminiUrl, geminiHeaders, selectModel,
} = require('./ai-core');

const router = Router();

router.post('/suggest-suppliers', async (req, res) => {
  const { ingredient_ids } = req.body;
  if (!ingredient_ids || !ingredient_ids.length) {
    return res.status(400).json({ error: 'ingredient_ids required' });
  }

  // Scope ingredient lookup + downstream supplier suggestion by caller's tenant
  // (PENTEST_REPORT — unscoped suggest-suppliers leaked other tenants' supplier
  // rates on attacker-supplied ingredient_id values).
  const rid = req.user && req.user.restaurant_id;
  const suggestions = ingredient_ids.map(id => {
    const ingredient = get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!ingredient) return { ingredient_id: id, error: 'not found' };

    const best = get(`
      SELECT sp.*, s.name as supplier_name, s.quality_rating,
             (sp.price / s.quality_rating) as value_score
      FROM supplier_prices sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.ingredient_id = ?
      ORDER BY value_score ASC LIMIT 1
    `, [id]);

    return {
      ingredient_id: id,
      ingredient_name: ingredient.name,
      best_supplier: best ? {
        supplier_id: best.supplier_id,
        supplier_name: best.supplier_name,
        price: best.price,
        unit: best.unit,
        quality_rating: best.quality_rating,
        value_score: Math.round(best.value_score * 100) / 100
      } : null
    };
  });

  res.json(suggestions);
});

// ═══════════════════════════════════════════
// GET /api/ai/menu-suggestions — Suggestions menu par marge
// ═══════════════════════════════════════════
router.get('/menu-suggestions', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const rid = req.user.restaurant_id;
    // Get all recipes with cost data — scoped to this tenant
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.selling_price, r.notes,
        COALESCE((
          SELECT SUM(
            ri.gross_quantity * COALESCE(
              (SELECT sp.price / CASE
                WHEN sp.unit = 'kg' THEN 1000
                WHEN sp.unit = 'L' THEN 1000
                ELSE 1
              END FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id ORDER BY sp.last_updated DESC LIMIT 1),
              0
            )
          )
          FROM recipe_ingredients ri WHERE ri.recipe_id = r.id
        ), 0) as total_cost
      FROM recipes r
      WHERE (r.recipe_type = 'plat' OR r.recipe_type IS NULL) AND r.restaurant_id = ?
    `, [rid]);

    const recipesData = recipes
      .filter(r => r.selling_price > 0)
      .map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        selling_price: r.selling_price,
        total_cost: Math.round(r.total_cost * 100) / 100,
        food_cost_pct: r.selling_price > 0 ? Math.round((r.total_cost / r.selling_price) * 1000) / 10 : null,
        margin: Math.round((r.selling_price - r.total_cost) * 100) / 100
      }));

    // Get ingredients in stock — scoped to this tenant
    const stockIngredients = all(`
      SELECT i.name, s.quantity, s.unit
      FROM stock s JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.quantity > 0 AND s.restaurant_id = ?
      ORDER BY s.quantity DESC LIMIT 30
    `, [rid]);

    const prompt = `Voici les fiches techniques d'un restaurant avec leur food cost :
${JSON.stringify(recipesData, null, 2)}

Ingrédients actuellement en stock :
${JSON.stringify(stockIngredients, null, 2)}

Analyse et donne :
1) Les 3 plats les plus rentables à mettre en avant
2) Les 3 plats avec le food cost trop élevé et des suggestions pour les améliorer (substitution d'ingrédients)
3) Une suggestion de plat du jour basée sur les ingrédients en stock

Réponds en JSON avec cette structure :
{
  "top_profitable": [{"name": "...", "food_cost_pct": ..., "reason": "..."}],
  "to_improve": [{"name": "...", "food_cost_pct": ..., "suggestion": "..."}],
  "daily_special": {"name": "...", "description": "...", "key_ingredients": ["..."]}
}`;

    const geminiRes = await fetch(buildGeminiUrl(selectModel('menu-suggestions', req.user?.restaurant_id)), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      })
    });

    if (!geminiRes.ok) {
      // Fallback: return raw data analysis
      const sorted = [...recipesData].sort((a, b) => a.food_cost_pct - b.food_cost_pct);
      return res.json({
        top_profitable: sorted.slice(0, 3).map(r => ({ name: r.name, food_cost_pct: r.food_cost_pct, reason: 'Meilleur ratio coût/prix' })),
        to_improve: sorted.slice(-3).reverse().map(r => ({ name: r.name, food_cost_pct: r.food_cost_pct, suggestion: 'Revoir les portions ou substituer des ingrédients coûteux' })),
        daily_special: { name: 'Suggestion non disponible', description: 'Service IA temporairement indisponible', key_ingredients: [] },
        fallback: true
      });
    }

    const data = await geminiRes.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Réponse IA vide' });

    const suggestions = JSON.parse(content);
    res.json(suggestions);
  } catch (e) {
    console.error('Menu suggestions error:', e);
    res.status(500).json({ error: 'Erreur suggestions menu' });
  }
});

module.exports = router;
