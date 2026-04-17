const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── AI Insights Cache (1h) — per-tenant to prevent cross-tenant leak ───
const _insightsCache = new Map(); // rid -> { insights, time }
const INSIGHTS_TTL = 60 * 60 * 1000; // 1 hour

// ═══════════════════════════════════════════
// GET /api/analytics/kpis
// ═══════════════════════════════════════════
router.get('/kpis', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    // Total recipes
    const totalRecipes = get('SELECT COUNT(*) as c FROM recipes WHERE restaurant_id = ?', [rid]).c;

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
              END FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id AND sp.restaurant_id = ? ORDER BY sp.last_updated DESC LIMIT 1),
              0
            )
          )
          FROM recipe_ingredients ri WHERE ri.recipe_id = r.id AND ri.restaurant_id = ?
        ), 0) as cost
      FROM recipes r WHERE r.selling_price > 0 AND r.restaurant_id = ?
    `, [rid, rid, rid]);

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
        END FROM supplier_prices sp WHERE sp.ingredient_id = s.ingredient_id AND sp.restaurant_id = ? ORDER BY sp.last_updated DESC LIMIT 1),
        0
      )), 0) as total
      FROM stock s
      WHERE s.restaurant_id = ?
    `, [rid, rid]);
    const totalStockValue = Math.round(stockVal.total * 100) / 100;

    // HACCP compliance today
    const today = new Date().toISOString().split('T')[0];

    const tempZones = get('SELECT COUNT(*) as c FROM temperature_zones WHERE restaurant_id = ?', [rid]).c;
    const tempDone = get(`SELECT COUNT(DISTINCT zone_id) as c FROM temperature_logs WHERE date(recorded_at) = ? AND restaurant_id = ?`, [today, rid]).c;

    // Cleaning: daily tasks expected today
    const dayOfWeek = new Date().getDay(); // 0=Sun
    const cleaningTotal = get(`SELECT COUNT(*) as c FROM cleaning_tasks WHERE frequency = 'daily' AND restaurant_id = ?`, [rid]).c;
    const cleaningDone = get(`
      SELECT COUNT(DISTINCT task_id) as c FROM cleaning_logs cl
      JOIN cleaning_tasks ct ON ct.id = cl.task_id
      WHERE date(cl.completed_at) = ? AND ct.frequency = 'daily'
        AND cl.restaurant_id = ? AND ct.restaurant_id = ?
    `, [today, rid, rid]).c;

    // Low stock count
    const lowStock = get(`SELECT COUNT(*) as c FROM stock WHERE quantity <= min_quantity AND min_quantity > 0 AND restaurant_id = ?`, [rid]).c;

    // Price changes last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const priceChanges = get(`SELECT COUNT(*) as c FROM price_change_notifications WHERE created_at >= ? AND restaurant_id = ?`, [thirtyDaysAgo, rid]).c;

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
    const rid = req.user.restaurant_id;
    const recipes = all(`
      SELECT r.id, r.name, r.selling_price, r.portions,
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
        ), 0) as cost
      FROM recipes r
      WHERE r.restaurant_id = ?
      ORDER BY r.name
    `, [rid, rid, rid]);

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
    const rid = req.user.restaurant_id;
    // Total value
    const stockItems = all(`
      SELECT s.*, i.name, i.category,
        COALESCE(
          (SELECT sp.price / CASE
            WHEN sp.unit = 'kg' THEN 1000
            WHEN sp.unit = 'L' THEN 1000
            ELSE 1
          END FROM supplier_prices sp WHERE sp.ingredient_id = s.ingredient_id AND sp.restaurant_id = ? ORDER BY sp.last_updated DESC LIMIT 1),
          0
        ) as unit_price
      FROM stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.restaurant_id = ? AND i.restaurant_id = ?
    `, [rid, rid, rid]);

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
        AND sm.restaurant_id = ? AND i.restaurant_id = ?
      GROUP BY sm.ingredient_id
      ORDER BY quantity DESC
      LIMIT 5
    `, [thirtyDaysAgo, rid, rid]);

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
        AND s.restaurant_id = ? AND i.restaurant_id = ?
      ORDER BY s.quantity / NULLIF(s.min_quantity, 0) ASC
    `, [rid, rid]);

    // Movements summary (30 days)
    const receptions = get(`SELECT COUNT(*) as c FROM stock_movements WHERE movement_type = 'reception' AND recorded_at >= ? AND restaurant_id = ?`, [thirtyDaysAgo, rid]).c;
    const losses = get(`SELECT COUNT(*) as c FROM stock_movements WHERE movement_type = 'loss' AND recorded_at >= ? AND restaurant_id = ?`, [thirtyDaysAgo, rid]).c;
    const adjustments = get(`SELECT COUNT(*) as c FROM stock_movements WHERE movement_type = 'adjustment' AND recorded_at >= ? AND restaurant_id = ?`, [thirtyDaysAgo, rid]).c;

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
    const rid = req.user.restaurant_id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Recent price changes from notifications
    const recentChanges = all(`
      SELECT pcn.product_name as product,
        (SELECT s.name FROM suppliers s WHERE s.id = pcn.supplier_id AND s.restaurant_id = ?) as supplier,
        pcn.old_price, pcn.new_price,
        CASE WHEN pcn.old_price > 0
          THEN ROUND(((pcn.new_price - pcn.old_price) / pcn.old_price) * 100, 1)
          ELSE 0
        END as change_pct,
        pcn.created_at as date
      FROM price_change_notifications pcn
      WHERE pcn.created_at >= ? AND pcn.restaurant_id = ?
      ORDER BY pcn.created_at DESC
      LIMIT 20
    `, [rid, thirtyDaysAgo, rid]);

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
        AND sp1.restaurant_id = ? AND sp2.restaurant_id = ?
        AND i.restaurant_id = ? AND s1.restaurant_id = ? AND s2.restaurant_id = ?
      GROUP BY sp1.ingredient_id
      HAVING sp2.price = MIN(sp2.price)
      ORDER BY savings_pct DESC
      LIMIT 10
    `, [rid, rid, rid, rid, rid]);

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
    const rid = req.user.restaurant_id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Temperature compliance 7d: % of readings within zone min/max
    const tempTotal7d = get(`
      SELECT COUNT(*) as c FROM temperature_logs WHERE date(recorded_at) >= ? AND restaurant_id = ?
    `, [sevenDaysAgo, rid]).c;
    const tempOk7d = get(`
      SELECT COUNT(*) as c FROM temperature_logs tl
      JOIN temperature_zones tz ON tz.id = tl.zone_id
      WHERE date(tl.recorded_at) >= ?
        AND tl.temperature >= tz.min_temp AND tl.temperature <= tz.max_temp
        AND tl.restaurant_id = ? AND tz.restaurant_id = ?
    `, [sevenDaysAgo, rid, rid]).c;
    const temperatureCompliance7d = tempTotal7d > 0 ? Math.round((tempOk7d / tempTotal7d) * 1000) / 10 : 100;

    // Cleaning compliance 7d: % of daily tasks completed each day
    const cleaningDays = all(`
      SELECT date(cl.completed_at) as d, COUNT(DISTINCT cl.task_id) as done
      FROM cleaning_logs cl
      JOIN cleaning_tasks ct ON ct.id = cl.task_id
      WHERE date(cl.completed_at) >= ? AND ct.frequency = 'daily'
        AND cl.restaurant_id = ? AND ct.restaurant_id = ?
      GROUP BY date(cl.completed_at)
    `, [sevenDaysAgo, rid, rid]);
    const dailyTaskCount = get(`SELECT COUNT(*) as c FROM cleaning_tasks WHERE frequency = 'daily' AND restaurant_id = ?`, [rid]).c;
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
        AND tl.restaurant_id = ? AND tz.restaurant_id = ?
    `, [sevenDaysAgo, rid, rid]).c;

    // Daily scores (30 days)
    const dailyScores = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];

      const dayTempTotal = get(`SELECT COUNT(*) as c FROM temperature_logs WHERE date(recorded_at) = ? AND restaurant_id = ?`, [d, rid]).c;
      const dayTempOk = get(`
        SELECT COUNT(*) as c FROM temperature_logs tl
        JOIN temperature_zones tz ON tz.id = tl.zone_id
        WHERE date(tl.recorded_at) = ?
          AND tl.temperature >= tz.min_temp AND tl.temperature <= tz.max_temp
          AND tl.restaurant_id = ? AND tz.restaurant_id = ?
      `, [d, rid, rid]).c;

      const dayCleanDone = get(`
        SELECT COUNT(DISTINCT cl.task_id) as c FROM cleaning_logs cl
        JOIN cleaning_tasks ct ON ct.id = cl.task_id
        WHERE date(cl.completed_at) = ? AND ct.frequency = 'daily'
          AND cl.restaurant_id = ? AND ct.restaurant_id = ?
      `, [d, rid, rid]).c;

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
    const rid = req.user.restaurant_id;
    const forceRefresh = req.query.refresh === 'true';

    // Return cache if still valid (per-tenant)
    const cached = _insightsCache.get(rid);
    if (!forceRefresh && cached && (Date.now() - cached.time) < INSIGHTS_TTL) {
      return res.json({
        insights: cached.insights,
        cached: true,
        cached_at: new Date(cached.time).toISOString()
      });
    }

    // Collect data for Gemini
    const recipesData = all(`
      SELECT r.name, r.selling_price,
        COALESCE((
          SELECT SUM(ri.gross_quantity * COALESCE(
            (SELECT sp.price / CASE WHEN sp.unit = 'kg' THEN 1000 WHEN sp.unit = 'L' THEN 1000 ELSE 1 END
             FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id AND sp.restaurant_id = ? ORDER BY sp.last_updated DESC LIMIT 1), 0))
          FROM recipe_ingredients ri WHERE ri.recipe_id = r.id AND ri.restaurant_id = ?
        ), 0) as cost
      FROM recipes r WHERE r.selling_price > 0 AND r.restaurant_id = ?
    `, [rid, rid, rid]);

    const stockAlerts = all(`
      SELECT i.name, s.quantity, s.min_quantity, s.unit
      FROM stock s JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.quantity <= s.min_quantity AND s.min_quantity > 0
        AND s.restaurant_id = ? AND i.restaurant_id = ?
    `, [rid, rid]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const priceChanges = all(`
      SELECT product_name, old_price, new_price,
        ROUND(((new_price - old_price) / NULLIF(old_price, 0)) * 100, 1) as change_pct
      FROM price_change_notifications
      WHERE created_at >= ? AND old_price > 0 AND restaurant_id = ?
      ORDER BY ABS(new_price - old_price) DESC LIMIT 10
    `, [thirtyDaysAgo, rid]);

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

    // Cache result (per-tenant)
    const now = Date.now();
    _insightsCache.set(rid, { insights, time: now });

    res.json({
      insights,
      cached: false,
      cached_at: new Date(now).toISOString()
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

// ═══════════════════════════════════════════
// GET /api/analytics/price-trends — Historique prix d'un ingrédient
// ═══════════════════════════════════════════
router.get('/price-trends', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { ingredient_id, period } = req.query;
    if (!ingredient_id) return res.status(400).json({ error: 'ingredient_id requis' });

    let days = 30;
    if (period === '90d') days = 90;
    else if (period === '1y') days = 365;

    const since = new Date(Date.now() - days * 86400000).toISOString();

    const trends = all(`
      SELECT ph.price, ph.recorded_at as date,
             COALESCE(s.name, 'Inconnu') as supplier_name
      FROM price_history ph
      LEFT JOIN suppliers s ON s.id = ph.supplier_id AND s.restaurant_id = ?
      WHERE ph.ingredient_id = ? AND ph.recorded_at >= ? AND ph.restaurant_id = ?
      ORDER BY ph.recorded_at ASC
    `, [rid, Number(ingredient_id), since, rid]);

    res.json(trends);
  } catch (e) {
    console.error('Price trends error:', e);
    res.status(500).json({ error: 'Erreur tendances prix' });
  }
});

// ═══════════════════════════════════════════
// GET /api/analytics/price-alerts — Alertes variation prix > 10%
// ═══════════════════════════════════════════
router.get('/price-alerts', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Get latest price per ingredient from supplier_prices
    const ingredients = all(`
      SELECT i.id, i.name as ingredient_name,
             sp.price as current_price, sp.unit,
             s.name as supplier_name
      FROM supplier_prices sp
      JOIN ingredients i ON i.id = sp.ingredient_id
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.id IN (
        SELECT id FROM supplier_prices sp2
        WHERE sp2.ingredient_id = sp.ingredient_id AND sp2.restaurant_id = ?
        ORDER BY sp2.last_updated DESC LIMIT 1
      )
        AND sp.restaurant_id = ? AND i.restaurant_id = ? AND s.restaurant_id = ?
    `, [rid, rid, rid, rid]);

    const alerts = [];
    for (const ing of ingredients) {
      // Get avg price over last 30 days from price_history
      const avg = get(`
        SELECT AVG(price) as avg_price
        FROM price_history
        WHERE ingredient_id = ? AND recorded_at >= ? AND price > 0 AND restaurant_id = ?
      `, [ing.id, thirtyDaysAgo, rid]);

      if (avg && avg.avg_price && avg.avg_price > 0) {
        const variation = ((ing.current_price - avg.avg_price) / avg.avg_price) * 100;
        if (Math.abs(variation) > 10) {
          alerts.push({
            ingredient_id: ing.id,
            ingredient_name: ing.ingredient_name,
            current_price: Math.round(ing.current_price * 100) / 100,
            avg_price: Math.round(avg.avg_price * 100) / 100,
            variation_percent: Math.round(variation * 10) / 10,
            supplier_name: ing.supplier_name
          });
        }
      }
    }

    // Sort by absolute variation descending
    alerts.sort((a, b) => Math.abs(b.variation_percent) - Math.abs(a.variation_percent));
    res.json(alerts);
  } catch (e) {
    console.error('Price alerts error:', e);
    res.status(500).json({ error: 'Erreur alertes prix' });
  }
});

// ═══════════════════════════════════════════
// GET /api/analytics/menu-engineering
// Matrice BCG adaptée restauration :
// Star (haute marge + populaire), Puzzle (haute marge + peu vendu),
// Plowhorse (faible marge + populaire), Dog (faible marge + peu vendu)
// ═══════════════════════════════════════════
router.get('/menu-engineering', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const days = Number(req.query.days) || 30;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    // 1. Get all recipes with cost data
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.selling_price, r.recipe_type,
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
        ), 0) as cost
      FROM recipes r
      WHERE r.selling_price > 0 AND r.restaurant_id = ?
    `, [rid, rid, rid]);

    // 2. Get sales data per recipe
    let salesData = {};
    try {
      const sales = all(`
        SELECT oi.recipe_id, SUM(oi.quantity) as qty_sold, COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('annulé', 'cancelled')
          AND date(o.created_at) >= ?
          AND o.restaurant_id = ? AND oi.restaurant_id = ?
        GROUP BY oi.recipe_id
      `, [dateFrom, rid, rid]);
      for (const s of sales) {
        salesData[s.recipe_id] = { qty_sold: s.qty_sold, order_count: s.order_count };
      }
    } catch { salesData = {}; }

    // 3. Calculate metrics per recipe
    const items = [];
    let totalQtySold = 0;
    let totalMarginWeighted = 0;

    for (const r of recipes) {
      const sales = salesData[r.id] || { qty_sold: 0, order_count: 0 };
      const cost = r.cost || 0;
      const margin = r.selling_price - cost;
      const marginPct = r.selling_price > 0 ? (margin / r.selling_price) * 100 : 0;
      const foodCostPct = r.selling_price > 0 ? (cost / r.selling_price) * 100 : 0;
      const totalRevenue = sales.qty_sold * r.selling_price;
      const totalProfit = sales.qty_sold * margin;

      totalQtySold += sales.qty_sold;
      totalMarginWeighted += margin * sales.qty_sold;

      items.push({
        id: r.id,
        name: r.name,
        category: r.category || 'Non classé',
        recipe_type: r.recipe_type,
        selling_price: r.selling_price,
        cost: Math.round(cost * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        margin_pct: Math.round(marginPct * 10) / 10,
        food_cost_pct: Math.round(foodCostPct * 10) / 10,
        qty_sold: sales.qty_sold,
        order_count: sales.order_count,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_profit: Math.round(totalProfit * 100) / 100
      });
    }

    // 4. Calculate averages for classification
    const avgMargin = totalQtySold > 0 ? totalMarginWeighted / totalQtySold : 0;
    const avgQtySold = items.length > 0 ? totalQtySold / items.length : 0;

    // 5. Classify each item in the BCG matrix
    for (const item of items) {
      const highMargin = item.margin >= avgMargin;
      const highPopularity = item.qty_sold >= avgQtySold * 0.7; // 70% threshold

      if (highMargin && highPopularity) {
        item.classification = 'star';
        item.label = 'Star';
        item.emoji = '⭐';
        item.advice = 'Mettre en avant sur la carte, maintenir la qualité';
      } else if (highMargin && !highPopularity) {
        item.classification = 'puzzle';
        item.label = 'Puzzle';
        item.emoji = '🧩';
        item.advice = 'Promouvoir davantage, repositionner sur la carte';
      } else if (!highMargin && highPopularity) {
        item.classification = 'plowhorse';
        item.label = 'Plowhorse';
        item.emoji = '🐴';
        item.advice = 'Réduire le coût matière ou augmenter le prix';
      } else {
        item.classification = 'dog';
        item.label = 'Dog';
        item.emoji = '🐕';
        item.advice = 'Envisager de retirer ou refondre complètement';
      }
    }

    // Sort by total profit descending
    items.sort((a, b) => b.total_profit - a.total_profit);

    // 6. Category breakdown
    const categories = {};
    for (const item of items) {
      const cat = item.category;
      if (!categories[cat]) {
        categories[cat] = { star: 0, puzzle: 0, plowhorse: 0, dog: 0, total_revenue: 0, total_profit: 0 };
      }
      categories[cat][item.classification]++;
      categories[cat].total_revenue += item.total_revenue;
      categories[cat].total_profit += item.total_profit;
    }

    // 7. Summary stats
    const summary = {
      period_days: days,
      total_recipes: items.length,
      stars: items.filter(i => i.classification === 'star').length,
      puzzles: items.filter(i => i.classification === 'puzzle').length,
      plowhorses: items.filter(i => i.classification === 'plowhorse').length,
      dogs: items.filter(i => i.classification === 'dog').length,
      avg_margin: Math.round(avgMargin * 100) / 100,
      avg_qty_sold: Math.round(avgQtySold * 10) / 10,
      total_revenue: Math.round(items.reduce((s, i) => s + i.total_revenue, 0) * 100) / 100,
      total_profit: Math.round(items.reduce((s, i) => s + i.total_profit, 0) * 100) / 100
    };

    // 8. AI recommendations (quick rules-based)
    const recommendations = [];

    const topDogs = items.filter(i => i.classification === 'dog').slice(0, 3);
    if (topDogs.length > 0) {
      recommendations.push({
        type: 'remove',
        severity: 'warning',
        message: `${topDogs.map(d => d.name).join(', ')} : faible marge ET faible popularité. Envisager de les retirer ou de les refondre.`
      });
    }

    const topPlowhorses = items.filter(i => i.classification === 'plowhorse' && i.food_cost_pct > 35).slice(0, 3);
    if (topPlowhorses.length > 0) {
      recommendations.push({
        type: 'optimize',
        severity: 'info',
        message: `${topPlowhorses.map(p => `${p.name} (FC: ${p.food_cost_pct}%)`).join(', ')} : populaires mais trop coûteux. Négocier les prix matières ou ajuster les portions.`
      });
    }

    const topPuzzles = items.filter(i => i.classification === 'puzzle').slice(0, 3);
    if (topPuzzles.length > 0) {
      recommendations.push({
        type: 'promote',
        severity: 'info',
        message: `${topPuzzles.map(p => p.name).join(', ')} : excellente marge mais peu vendus. Les mettre en suggestion du jour ou les repositionner sur la carte.`
      });
    }

    res.json({ summary, items, categories, recommendations });
  } catch (e) {
    console.error('Menu engineering error:', e);
    res.status(500).json({ error: 'Erreur analyse menu engineering' });
  }
});

module.exports = router;
