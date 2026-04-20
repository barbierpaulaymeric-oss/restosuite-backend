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
              END FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id AND sp.restaurant_id = ? ORDER BY sp.last_updated DESC LIMIT 1),
              0
            )
          )
          FROM recipe_ingredients ri WHERE ri.recipe_id = r.id AND ri.restaurant_id = ?
        ), 0) as total_cost
      FROM recipes r
      WHERE (r.recipe_type = 'plat' OR r.recipe_type IS NULL) AND r.restaurant_id = ?
    `, [rid, rid, rid]);

    const recipesData = recipes
      .filter(r => r.selling_price > 0 && r.total_cost > 0)
      .map(r => {
        const food_cost_pct = Math.round((r.total_cost / r.selling_price) * 1000) / 10;
        return {
          name: r.name,
          category: r.category,
          selling_price: r.selling_price,
          food_cost_pct,
          margin_pct: Math.round(((r.selling_price - r.total_cost) / r.selling_price) * 1000) / 10
        };
      })
      // Filter out absurd food costs (unit mismatch / missing supplier prices produce 0% or >100%)
      .filter(r => r.food_cost_pct > 0 && r.food_cost_pct < 100);

    // Get ingredients in stock — scoped to this tenant
    const stockIngredients = all(`
      SELECT i.name, s.quantity, s.unit
      FROM stock s JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.quantity > 0 AND s.restaurant_id = ?
      ORDER BY s.quantity DESC LIMIT 30
    `, [rid]);

    // If no recipes have valid cost data, return a data-quality error rather than
    // calling Gemini with an empty array (which causes hallucinated English responses).
    if (recipesData.length === 0) {
      return res.json({
        top_profitable: [],
        to_improve: [],
        daily_special: null,
        fallback: true,
        message: 'Aucune fiche technique avec prix de vente et coût matière disponible. Renseignez les prix fournisseurs pour activer les suggestions IA.'
      });
    }

    const prompt = `Voici les fiches techniques d'un restaurant avec leur food cost (food_cost_pct en %) :
${JSON.stringify(recipesData, null, 2)}

Ingrédients actuellement en stock :
${JSON.stringify(stockIngredients, null, 2)}

Analyse et donne :
1) Les 3 plats les plus rentables à mettre en avant (food_cost_pct le plus bas)
2) Les 3 plats avec le food cost le plus élevé et des suggestions concrètes pour l'améliorer (substitution d'ingrédients, réduction des portions)
3) Une suggestion de plat du jour basée sur les ingrédients en stock

IMPORTANT : Utilise UNIQUEMENT les valeurs food_cost_pct déjà calculées dans les données ci-dessus — ne recalcule pas.
IMPORTANT : Tous les champs texte (reason, suggestion, description, key_ingredients) doivent être en français.

Réponds en JSON avec cette structure exacte :
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
        systemInstruction: { parts: [{ text: 'Tu es un expert en gestion de restaurant français. Tu réponds TOUJOURS et UNIQUEMENT en français, jamais en anglais ni dans aucune autre langue.' }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.5 }
      })
    });

    if (!geminiRes.ok) {
      // Fallback: return raw data analysis without calling Gemini
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

    // Clamp any food_cost_pct values Gemini may have altered back to valid range
    const clamp = arr => (arr || []).map(item => ({
      ...item,
      food_cost_pct: typeof item.food_cost_pct === 'number'
        ? Math.min(Math.max(Math.round(item.food_cost_pct * 10) / 10, 0), 100)
        : item.food_cost_pct
    }));
    suggestions.top_profitable = clamp(suggestions.top_profitable);
    suggestions.to_improve = clamp(suggestions.to_improve);

    res.json(suggestions);
  } catch (e) {
    console.error('Menu suggestions error:', e);
    res.status(500).json({ error: 'Erreur suggestions menu' });
  }
});

module.exports = router;
