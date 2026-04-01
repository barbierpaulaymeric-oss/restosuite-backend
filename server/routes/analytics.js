const { Router } = require('express');
const { all, get, run } = require('../db');
const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── AI Insights Cache (1h) ───
let _insightsCache = null;
let _insightsCacheTime = 0;
const INSIGHTS_TTL = 60 * 60 * 1000; // 1 hour

// ═══════════════════════════════════════════
// GET /api/analytics/kpis
// ═══════════════════════════════════════════
router.get('/kpis', (req, res) => {
  try {
    // Total recipes
    const totalRecipes = get('SELECT COUNT(*) as c FROM recipes').c;

    // Average food cost % across recipes with selling_price > 0
    const recipes = all(`
      SELECT r.id, r.selling_price,
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
        ), 0) as cost
      FROM recipes r WHERE r.selling_price > 0
    `);

    let totalFoodCostPct = 0;
    let countWithPrice = 0;
    for (const r of recipes) {
      if (r.selling_price > 0 && r.cost > 0) {
        totalFoodCostPct += (r.cost / r.selling_price) * 100;
        countWithPrice++;
      }
    }
    const avgFoodCostPct = countWithPrice > 0 ? Math.round((totalFoodCostPct / countWithPrice) * 10) / 10 : 0;

    // Total stock value
    const stockVal = get(`
      SELECT COALESCE(SUM(s.quantity * COALESCE(
        (SELECT sp.price / CASE
          WHEN sp.unit = 'kg' THEN 1000
          WHEN sp.unit = 'L' THEN 1000
          ELSE 1
        END FROM supplier_prices sp WHERE sp.ingredient_id = s.ingredient_id ORDER BY sp.last_updated DESC LIMIT 1),
        0
      )), 0) as total
      FROM stock s
    `);
    const totalStockValue = Math.round(stockVal.total * 100) / 100;

    // HACCP compliance today
    const today = new Date().toISOString().split('T')[0];

    const tempZones = get('SELECT COUNT(*) as c FROM temperature_zones').c;
    const tempDone = get(`SELECT COUNT(DISTINCT zone_id) as c FROM temperature_logs WHERE date(recorded_at) = ?`, [today]).c;

    // Cleaning: daily tasks expected today
    const dayOfWeek = new Date().getDay(); // 0=Sun
    const cleaningTotal = get(`SELECT COUNT(*) as c FROM cleaning_tasks WHERE frequency = 'daily'`).c;
    const cleaningDone = get(`
      SELECT COUNT(DISTINCT task_id) as c FROM cleaning_logs cl
      JOIN cleaning_tasks ct ON ct.id = cl.task_id
      WHERE date(cl.completed_at) = ? AND ct.frequency = 'daily'
    `, [today]).c;

    // Low stock count
    const lowStock = get(`SELECT COUNT(*) as c FROM stock WHERE quantity <= min_quantity AND min_quantity > 0`).c;

    // Price changes last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const priceChanges = get(`SELECT COUNT(*) as c FROM price_change_notifications WHERE created_at >= ?`, [thirtyDaysAgo]).c;

    res.json({
      total_recipes: totalRecipes,
      avg_food_cost_pct: avgFoodCostPct,
      total_stock_value: totalStockValue,
      haccp_compliance_today: {
        temperatures: { done: tempDone, total: tempZones },
        cleaning: { done: cleaningDone, total: cleaningTotal }
      },
      low_stock_count: lowStock,
      price_changes_30d: priceChanges
    });
  } catch (e) {
    console.error('Analytics KPIs error:', e);
    res.status(500).json({ error: 'Erreur calcul KPIs' });
  }
});

// ═══════════════════════════════════════════
// GET /api/analytics/food-cost
// ═══════════════════════════════════════════
router.get('/food-cost', (req, res) => {
  try {
    const recipes = all(`
      SELECT r.id, r.name, r.selling_price, r.portions,
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
        ), 0) as cost
      FROM recipes r
      ORDER BY r.name
    `);

    const result = [];
    let totalPct = 0;
    let countWithPrice = 0;
    let bestMargin = null;
    let worstMargin = null;
    const distribution = { under_25: 0, '25_30': 0, '30_35': 0, over_35: 0 };

    for (const r of recipes) {
      const sellingPrice = r.selling_price || 0;
      const cost = r.cost || 0;
      const foodCostPct = sellingPrice > 0 ? Math.round((cost / sellingPrice) * 1000) / 10 : null;
      const margin = sellingPrice > 0 ? Math.round((sellingPrice - cost) * 100) / 100 : null;
      const marginPct = sellingPrice > 0 ? Math.round(((sellingPrice - cost) / sellingPrice) * 1000) / 10 : null;

      result.push({
        id: r.id,
        name: r.name,
        food_cost_pct: foodCostPct,
        cost: Math.round(cost * 100) / 100,
        selling_price: sellingPrice,
        margin: margin
      });

      if (foodCostPct !== null) {
        totalPct += foodCostPct;
        countWithPrice++;

        if (foodCostPct < 25) distribution.under_25++;
        else if (foodCostPct < 30) distribution['25_30']++;
        else if (foodCostPct < 35) distribution['30_35']++;
        else distribution.over_35++;

        if (!bestMargin || marginPct > bestMargin.margin_pct) {
          bestMargin = { name: r.name, margin_pct: marginPct };
        }
        if (!worstMargin || marginPct < worstMargin.margin_pct) {
          worstMargin = { name: r.name, margin_pct: marginPct };
        }
      }
    }

    res.json({
      recipes: result,
      avg_food_cost: countWithPrice > 0 ? Math.round((totalPct / countWithPrice) * 10) / 10 : 0,
      best_margin: bestMargin,
      worst_margin: worstMargin,
      distribution
    });
  } catch (e) {
    console.error('Analytics food-cost error:', e);
    res.status(500).json({ error: 'Erreur calcul food cost' });
  }
});

// ═══════════════════════════════════════════
// GET /api/analytics/stock
// ═══════════════════════════════════════════
router.get('/stock', (req, res) => {
  try {
    // Total value
    const stockItems = all(`
      SELECT s.*, i.name, i.category,
        COALESCE(
          (SELECT sp.price / CASE
            WHEN sp.unit = 'kg' THEN 1000
            WHEN sp.unit = 'L' THEN 1000
            ELSE 1
          END FROM supplier_prices sp WHERE sp.ingredient_id = s.ingredient_id ORDER BY sp.last_updated DESC LIMIT 1),
          0
        ) as unit_price
      FROM stock s
      JOIN ingredients i ON i.id = s.ingredient_id
    `);

    let totalValue = 0;
    const catMap = {};
    for (const item of stockItems) {
      const val = item.quantity * item.unit_price;
      totalValue += val;
      const cat = item.category || 'Autre';
      if (!catMap[cat]) catMap[cat] = { value: 0, item_count: 0 };
      catMap[cat].value += val;
      catMap[cat].item_count++;
    }

    const categories = Object.entries(catMap)
      .map(([name, data]) => ({
        name,
        value: Math.round(data.value * 100) / 100,
        item_count: data.item_count
      }))
      .sort((a, b) => b.value - a.value);

    // Top consumed (last 30 days) — outgoing movements
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const topConsumed = all(`
      SELECT i.name, SUM(ABS(sm.quantity)) as quantity, '30j' as period
      FROM stock_movements sm
      JOIN ingredients i ON i.id = sm.ingredient_id
      WHERE sm.movement_type IN ('loss', 'consumption', 'adjustment')
        AND sm.recorded_at >= ?
      GROUP BY sm.ingredient_id
      ORDER BY quantity DESC
      LIMIT 5
    `, [thirtyDaysAgo]);

    // Alerts
    const alerts = all(`
      SELECT i.name, s.quantity as current, s.min_quantity as minimum,
        CASE
          WHEN s.quantity <= 0 THEN 'critical'
          WHEN s.quantity <= s.min_quantity * 0.5 THEN 'high'
          ELSE 'medium'
        END as urgency
      FROM stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.quantity <= s.min_quantity AND s.min_quantity > 0
      ORDER BY s.quantity / NULLIF(s.min_quantity, 0) ASC
    `);

    // Movements summary (30 days)
    const receptions = get(`SELECT COUNT(*) as c FROM stock_movements WHERE movement_type = 'reception' AND recorded_at >= ?`, [thirtyDaysAgo]).c;
    const losses = get(`SELECT COUNT(*) as c FROM stock_movements WHERE movement_type = 'loss' AND recorded_at >= ?`, [thirtyDaysAgo]).c;
    const adjustments = get(`SELECT COUNT(*) as c FROM stock_movements WHERE movement_type = 'adjustment' AND recorded_at >= ?`, [thirtyDaysAgo]).c;

    res.json({
      total_value: Math.round(totalValue * 100) / 100,
      categories,
      top_consumed: topConsumed,
      alerts,
      movements_summary: { receptions, losses, adjustments }
    });
  } catch (e) {
    console.error('Analytics stock error:', e);
    res.status(500).json({ error: 'Erreur calcul stock' });
  }
});

// ═══════════════════════════════════════════
// GET /api/analytics/prices
// ═══════════════════════════════════════════
router.get('/prices', (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Recent price changes from notifications
    const recentChanges = all(`
      SELECT pcn.product_name as product,
        (SELECT s.name FROM suppliers s WHERE s.id = pcn.supplier_id) as supplier,
        pcn.old_price, pcn.new_price,
        CASE WHEN pcn.old_price > 0
          THEN ROUND(((pcn.new_price - pcn.old_price) / pcn.old_price) * 100, 1)
          ELSE 0
        END as change_pct,
        pcn.created_at as date
      FROM price_change_notifications pcn
      WHERE pcn.created_at >= ?
      ORDER BY pcn.created_at DESC
      LIMIT 20
    `, [thirtyDaysAgo]);

    // Average inflation
    let totalChangePct = 0;
    let changeCount = 0;
    for (const c of recentChanges) {
      if (c.old_price > 0) {
        totalChangePct += ((c.new_price - c.old_price) / c.old_price) * 100;
        changeCount++;
      }
    }
    const inflation30d = changeCount > 0 ? Math.round((totalChangePct / changeCount) * 10) / 10 : 0;

    // Suggestions: find ingredients with multiple suppliers, suggest cheapest
    const suggestions = all(`
      SELECT i.name as product,
        s1.name as current_supplier, sp1.price as current_price,
        s2.name as cheaper_supplier, sp2.price as cheaper_price,
        ROUND(((sp1.price - sp2.price) / sp1.price) * 100, 1) as savings_pct
      FROM supplier_prices sp1
      JOIN ingredients i ON i.id = sp1.ingredient_id
      JOIN suppliers s1 ON s1.id = sp1.supplier_id
      JOIN supplier_prices sp2 ON sp2.ingredient_id = sp1.ingredient_id AND sp2.supplier_id != sp1.supplier_id
      JOIN suppliers s2 ON s2.id = sp2.supplier_id
      WHERE sp2.price < sp1.price
        AND sp1.supplier_id = COALESCE(i.preferred_supplier_id, sp1.supplier_id)
      GROUP BY sp1.ingredient_id
      HAVING sp2.price = MIN(sp2.price)
      ORDER BY savings_pct DESC
      LIMIT 10
    `);

    res.json({
      recent_changes: recentChanges,
      inflation_30d: inflation30d,
      suggestions
    });
  } catch (e) {
    console.error('Analytics prices error:', e);
    res.status(500).json({ error: 'Erreur calcul prix' });
  }
});

// ═══════════════════════════════════════════
// GET /api/analytics/haccp
// ═══════════════════════════════════════════
router.get('/haccp', (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Temperature compliance 7d: % of readings within zone min/max
    const tempTotal7d = get(`
      SELECT COUNT(*) as c FROM temperature_logs WHERE date(recorded_at) >= ?
    `, [sevenDaysAgo]).c;
    const tempOk7d = get(`
      SELECT COUNT(*) as c FROM temperature_logs tl
      JOIN temperature_zones tz ON tz.id = tl.zone_id
      WHERE date(tl.recorded_at) >= ?
        AND tl.temperature >= tz.min_temp AND tl.temperature <= tz.max_temp
    `, [sevenDaysAgo]).c;
    const temperatureCompliance7d = tempTotal7d > 0 ? Math.round((tempOk7d / tempTotal7d) * 1000) / 10 : 100;

    // Cleaning compliance 7d: % of daily tasks completed each day
    const cleaningDays = all(`
      SELECT date(cl.completed_at) as d, COUNT(DISTINCT cl.task_id) as done
      FROM cleaning_logs cl
      JOIN cleaning_tasks ct ON ct.id = cl.task_id
      WHERE date(cl.completed_at) >= ? AND ct.frequency = 'daily'
      GROUP BY date(cl.completed_at)
    `, [sevenDaysAgo]);
    const dailyTaskCount = get(`SELECT COUNT(*) as c FROM cleaning_tasks WHERE frequency = 'daily'`).c;
    let cleaningTotal = 0;
    let cleaningDoneTotal = 0;
    for (const d of cleaningDays) {
      cleaningTotal += dailyTaskCount;
      cleaningDoneTotal += d.done;
    }
    // Fill in days with no logs
    const daysWithLogs = cleaningDays.length;
    const totalDays = 7;
    cleaningTotal += (totalDays - daysWithLogs) * dailyTaskCount;
    const cleaningCompliance7d = cleaningTotal > 0 ? Math.round((cleaningDoneTotal / cleaningTotal) * 1000) / 10 : 100;

    // Alerts count 7d
    const alertsCount7d = get(`
      SELECT COUNT(*) as c FROM temperature_logs tl
      JOIN temperature_zones tz ON tz.id = tl.zone_id
      WHERE date(tl.recorded_at) >= ?
        AND (tl.temperature < tz.min_temp OR tl.temperature > tz.max_temp)
    `, [sevenDaysAgo]).c;

    // Daily scores (30 days)
    const dailyScores = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];

      const dayTempTotal = get(`SELECT COUNT(*) as c FROM temperature_logs WHERE date(recorded_at) = ?`, [d]).c;
      const dayTempOk = get(`
        SELECT COUNT(*) as c FROM temperature_logs tl
        JOIN temperature_zones tz ON tz.id = tl.zone_id
        WHERE date(tl.recorded_at) = ?
          AND tl.temperature >= tz.min_temp AND tl.temperature <= tz.max_temp
      `, [d]).c;

      const dayCleanDone = get(`
        SELECT COUNT(DISTINCT cl.task_id) as c FROM cleaning_logs cl
        JOIN cleaning_tasks ct ON ct.id = cl.task_id
        WHERE date(cl.completed_at) = ? AND ct.frequency = 'daily'
      `, [d]).c;

      dailyScores.push({
        date: d,
        temp_score: dayTempTotal > 0 ? Math.round((dayTempOk / dayTempTotal) * 100) : null,
        cleaning_score: dailyTaskCount > 0 ? Math.round((dayCleanDone / dailyTaskCount) * 100) : null
      });
    }

    res.json({
      temperature_compliance_7d: temperatureCompliance7d,
      cleaning_compliance_7d: cleaningCompliance7d,
      alerts_count_7d: alertsCount7d,
      daily_scores: dailyScores
    });
  } catch (e) {
    console.error('Analytics HACCP error:', e);
    res.status(500).json({ error: 'Erreur calcul HACCP' });
  }
});

// ═══════════════════════════════════════════
// GET /api/analytics/ai-insights
// ═══════════════════════════════════════════
router.get('/ai-insights', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    // Return cache if still valid
    if (!forceRefresh && _insightsCache && (Date.now() - _insightsCacheTime) < INSIGHTS_TTL) {
      return res.json({
        insights: _insightsCache,
        cached: true,
        cached_at: new Date(_insightsCacheTime).toISOString()
      });
    }

    // Collect data for Gemini
    const recipesData = all(`
      SELECT r.name, r.selling_price,
        COALESCE((
          SELECT SUM(ri.gross_quantity * COALESCE(
            (SELECT sp.price / CASE WHEN sp.unit = 'kg' THEN 1000 WHEN sp.unit = 'L' THEN 1000 ELSE 1 END
             FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id ORDER BY sp.last_updated DESC LIMIT 1), 0))
          FROM recipe_ingredients ri WHERE ri.recipe_id = r.id
        ), 0) as cost
      FROM recipes r WHERE r.selling_price > 0
    `);

    const stockAlerts = all(`
      SELECT i.name, s.quantity, s.min_quantity, s.unit
      FROM stock s JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.quantity <= s.min_quantity AND s.min_quantity > 0
    `);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const priceChanges = all(`
      SELECT product_name, old_price, new_price,
        ROUND(((new_price - old_price) / NULLIF(old_price, 0)) * 100, 1) as change_pct
      FROM price_change_notifications
      WHERE created_at >= ? AND old_price > 0
      ORDER BY ABS(new_price - old_price) DESC LIMIT 10
    `, [thirtyDaysAgo]);

    const topCostRecipes = recipesData
      .filter(r => r.selling_price > 0 && r.cost > 0)
      .map(r => ({ name: r.name, food_cost_pct: Math.round((r.cost / r.selling_price) * 1000) / 10, cost: Math.round(r.cost * 100) / 100, selling_price: r.selling_price }))
      .sort((a, b) => b.food_cost_pct - a.food_cost_pct);

    const dataContext = {
      recettes_food_cost: topCostRecipes.slice(0, 15),
      alertes_stock: stockAlerts.slice(0, 10),
      changements_prix_30j: priceChanges.slice(0, 10),
      nb_recettes: recipesData.length,
      nb_alertes_stock: stockAlerts.length
    };

    const prompt = `Tu es un consultant en restauration spécialisé dans l'optimisation des coûts et la gestion opérationnelle.

Analyse ces données d'un restaurant et donne exactement 3 à 5 recommandations actionables en français.

Données du restaurant :
${JSON.stringify(dataContext, null, 2)}

Réponds UNIQUEMENT en JSON valide, sous cette forme exacte :
[
  {
    "type": "cost_alert|suggestion|stock|price|haccp",
    "message": "message clair et actionable en français",
    "severity": "info|warning|danger"
  }
]

Règles :
- Sois concret et spécifique (cite des noms de recettes/ingrédients)
- Propose des solutions pratiques qu'un chef peut appliquer demain
- Utilise "danger" pour les urgences, "warning" pour les points d'attention, "info" pour les optimisations
- Si les données sont insuffisantes, propose des insights généraux pertinents`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      })
    });

    if (!geminiRes.ok) {
      console.error('Gemini API error:', geminiRes.status);
      // Return fallback insights based on data
      const fallbackInsights = generateFallbackInsights(topCostRecipes, stockAlerts, priceChanges);
      return res.json({ insights: fallbackInsights, cached: false, fallback: true });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    let insights = [];
    if (jsonMatch) {
      try {
        insights = JSON.parse(jsonMatch[0]);
      } catch {
        insights = generateFallbackInsights(topCostRecipes, stockAlerts, priceChanges);
      }
    } else {
      insights = generateFallbackInsights(topCostRecipes, stockAlerts, priceChanges);
    }

    // Cache result
    _insightsCache = insights;
    _insightsCacheTime = Date.now();

    res.json({
      insights,
      cached: false,
      cached_at: new Date(_insightsCacheTime).toISOString()
    });
  } catch (e) {
    console.error('Analytics AI insights error:', e);
    res.status(500).json({ error: 'Erreur génération insights IA' });
  }
});

// ─── Fallback insights when Gemini is unavailable ───
function generateFallbackInsights(topCostRecipes, stockAlerts, priceChanges) {
  const insights = [];

  // High food cost alerts
  const highCost = topCostRecipes.filter(r => r.food_cost_pct > 35);
  if (highCost.length > 0) {
    insights.push({
      type: 'cost_alert',
      message: `${highCost.length} recette(s) avec un food cost supérieur à 35% : ${highCost.slice(0, 3).map(r => `${r.name} (${r.food_cost_pct}%)`).join(', ')}. Revoir les portions ou les prix de vente.`,
      severity: 'warning'
    });
  }

  // Stock alerts
  if (stockAlerts.length > 0) {
    const critical = stockAlerts.filter(a => a.quantity <= 0);
    if (critical.length > 0) {
      insights.push({
        type: 'stock',
        message: `Rupture de stock : ${critical.slice(0, 3).map(a => a.name).join(', ')}. Commander en urgence.`,
        severity: 'danger'
      });
    } else {
      insights.push({
        type: 'stock',
        message: `${stockAlerts.length} ingrédient(s) en stock bas : ${stockAlerts.slice(0, 3).map(a => a.name).join(', ')}.`,
        severity: 'warning'
      });
    }
  }

  // Price changes
  const increases = priceChanges.filter(p => p.change_pct > 5);
  if (increases.length > 0) {
    insights.push({
      type: 'price',
      message: `Hausse de prix significative sur ${increases.slice(0, 3).map(p => `${p.product_name} (+${p.change_pct}%)`).join(', ')}. Comparer avec d'autres fournisseurs.`,
      severity: 'warning'
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'suggestion',
      message: 'Toutes les métriques sont dans les normes. Continuez à surveiller vos coûts et votre stock.',
      severity: 'info'
    });
  }

  return insights;
}

module.exports = router;
