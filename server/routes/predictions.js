const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// Ensure prediction_accuracy table exists
try {
  run(`CREATE TABLE IF NOT EXISTS prediction_accuracy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    predicted_orders INTEGER,
    actual_orders INTEGER,
    accuracy_pct REAL,
    recorded_at TEXT DEFAULT (datetime('now'))
  )`);
  run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_accuracy_date ON prediction_accuracy (date)`);
} catch {}

router.use(requireAuth);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ═══════════════════════════════════════════
// Prédictions IA — Anticipation de la demande
// Analyse les tendances historiques pour prévoir :
// - Demande par jour/plat
// - Stock à commander
// - Pic d'activité
// ═══════════════════════════════════════════

// Cache predictions for 4 hours
let _predCache = null;
let _predCacheTime = 0;
const PRED_TTL = 4 * 60 * 60 * 1000;

// GET /api/predictions/demand — Prédiction de demande pour les 7 prochains jours
router.get('/demand', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh && _predCache && (Date.now() - _predCacheTime) < PRED_TTL) {
      return res.json({ ..._predCache, cached: true });
    }

    // Collect historical data (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    // Daily order patterns
    const dailyOrders = all(`
      SELECT date(o.created_at) as day,
             strftime('%w', o.created_at) as dow,
             COUNT(*) as order_count,
             COALESCE(SUM(o.total_cost), 0) as revenue
      FROM orders o
      WHERE o.status NOT IN ('annulé', 'cancelled') AND date(o.created_at) >= ?
      GROUP BY date(o.created_at)
      ORDER BY day
    `, [ninetyDaysAgo]);

    // Top recipes by day of week
    const recipesByDow = all(`
      SELECT strftime('%w', o.created_at) as dow,
             oi.recipe_id, r.name as recipe_name,
             SUM(oi.quantity) as total_qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN recipes r ON r.id = oi.recipe_id
      WHERE o.status NOT IN ('annulé', 'cancelled') AND date(o.created_at) >= ?
      GROUP BY dow, oi.recipe_id
      ORDER BY dow, total_qty DESC
    `, [ninetyDaysAgo]);

    // Hourly patterns
    const hourlyPatterns = all(`
      SELECT strftime('%H', o.created_at) as hour,
             strftime('%w', o.created_at) as dow,
             COUNT(*) as order_count
      FROM orders o
      WHERE o.status NOT IN ('annulé', 'cancelled') AND date(o.created_at) >= ?
      GROUP BY hour, dow
    `, [ninetyDaysAgo]);

    // Calculate averages per day of week
    const dowNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dowStats = {};

    for (const d of dailyOrders) {
      if (!dowStats[d.dow]) dowStats[d.dow] = { count: 0, total_orders: 0, total_revenue: 0 };
      dowStats[d.dow].count++;
      dowStats[d.dow].total_orders += d.order_count;
      dowStats[d.dow].total_revenue += d.revenue;
    }

    const weeklyPattern = Object.entries(dowStats).map(([dow, s]) => ({
      day_of_week: Number(dow),
      day_name: dowNames[Number(dow)],
      avg_orders: Math.round(s.total_orders / s.count * 10) / 10,
      avg_revenue: Math.round(s.total_revenue / s.count * 100) / 100
    })).sort((a, b) => a.day_of_week - b.day_of_week);

    // Generate 7-day forecast
    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date(Date.now() + i * 86400000);
      const dow = date.getDay().toString();
      const stats = dowStats[dow];

      const avgOrders = stats ? Math.round(stats.total_orders / stats.count) : 0;
      const avgRevenue = stats ? Math.round(stats.total_revenue / stats.count * 100) / 100 : 0;

      // Trend adjustment (compare last 4 weeks to overall avg)
      const recentDays = dailyOrders.filter(d => d.dow === dow).slice(-4);
      const recentAvg = recentDays.length > 0 ? recentDays.reduce((s, d) => s + d.order_count, 0) / recentDays.length : avgOrders;
      const trend = avgOrders > 0 ? Math.round(((recentAvg - avgOrders) / avgOrders) * 100) : 0;

      // Top expected recipes for this day
      const topRecipes = recipesByDow
        .filter(r => r.dow === dow)
        .slice(0, 5)
        .map(r => ({
          recipe_id: r.recipe_id,
          name: r.recipe_name,
          expected_qty: Math.round(r.total_qty / (stats ? stats.count : 1))
        }));

      forecast.push({
        date: date.toISOString().split('T')[0],
        day_name: dowNames[date.getDay()],
        predicted_orders: Math.round(recentAvg),
        predicted_revenue: Math.round(avgRevenue * (recentAvg / (avgOrders || 1)) * 100) / 100,
        confidence: stats && stats.count >= 4 ? 'high' : stats && stats.count >= 2 ? 'medium' : 'low',
        trend_pct: trend,
        top_recipes: topRecipes
      });
    }

    // Peak hours
    const peakHours = {};
    for (const h of hourlyPatterns) {
      const hour = h.hour;
      if (!peakHours[hour]) peakHours[hour] = 0;
      peakHours[hour] += h.order_count;
    }
    const peakHoursList = Object.entries(peakHours)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Stock suggestions for next 7 days
    const stockSuggestions = await calculateStockSuggestions(forecast, ninetyDaysAgo);

    // Try AI-enhanced insights
    let aiInsight = null;
    if (GEMINI_API_KEY && dailyOrders.length > 14) {
      aiInsight = await generatePredictionInsight(weeklyPattern, forecast, peakHoursList);
    }

    const result = {
      forecast,
      weekly_pattern: weeklyPattern,
      peak_hours: peakHoursList,
      stock_suggestions: stockSuggestions,
      ai_insight: aiInsight,
      data_points: dailyOrders.length,
      cached: false
    };

    _predCache = result;
    _predCacheTime = Date.now();

    res.json(result);
  } catch (e) {
    console.error('Predictions error:', e);
    res.status(500).json({ error: 'Erreur prédictions', details: e.message });
  }
});

// Calculate stock to order based on predicted demand
async function calculateStockSuggestions(forecast, since) {
  try {
    // Get recipe → ingredient mapping with quantities
    const totalExpectedByIngredient = {};

    for (const day of forecast) {
      for (const recipe of day.top_recipes) {
        const ingredients = all(`
          SELECT ri.ingredient_id, ri.gross_quantity, ri.unit, i.name
          FROM recipe_ingredients ri
          JOIN ingredients i ON i.id = ri.ingredient_id
          WHERE ri.recipe_id = ? AND ri.sub_recipe_id IS NULL
        `, [recipe.recipe_id]);

        for (const ing of ingredients) {
          const key = ing.ingredient_id;
          if (!totalExpectedByIngredient[key]) {
            totalExpectedByIngredient[key] = { id: key, name: ing.name, unit: ing.unit, needed: 0 };
          }
          totalExpectedByIngredient[key].needed += ing.gross_quantity * recipe.expected_qty;
        }
      }
    }

    // Compare with current stock
    const suggestions = [];
    for (const [id, data] of Object.entries(totalExpectedByIngredient)) {
      const stock = get('SELECT quantity FROM stock WHERE ingredient_id = ?', [Number(id)]);
      const currentQty = stock ? stock.quantity : 0;
      const deficit = data.needed - currentQty;

      if (deficit > 0) {
        suggestions.push({
          ingredient_id: data.id,
          ingredient_name: data.name,
          unit: data.unit,
          needed_7d: Math.round(data.needed * 100) / 100,
          current_stock: Math.round(currentQty * 100) / 100,
          to_order: Math.round(deficit * 1.1 * 100) / 100, // +10% safety margin
          urgency: currentQty <= 0 ? 'critical' : deficit > data.needed * 0.5 ? 'high' : 'medium'
        });
      }
    }

    return suggestions.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2 };
      return (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3);
    }).slice(0, 15);
  } catch {
    return [];
  }
}

// Generate AI insight from prediction data
async function generatePredictionInsight(weeklyPattern, forecast, peakHours) {
  try {
    const prompt = `Tu es un expert en gestion de restaurant. Analyse ces données de prédiction et donne UN conseil actionable en 2-3 phrases en français.

Patterns hebdomadaires: ${JSON.stringify(weeklyPattern)}
Prévisions 7j: ${JSON.stringify(forecast.map(f => ({ date: f.date, jour: f.day_name, commandes: f.predicted_orders, tendance: f.trend_pct + '%' })))}
Heures de pointe: ${JSON.stringify(peakHours)}

Réponds avec UN seul paragraphe concis et actionable.`;

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 256 }
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

// POST /api/predictions/accuracy — Enregistrer la précision d'une prédiction
router.post('/accuracy', (req, res) => {
  try {
    const { date, predicted_orders, actual_orders } = req.body;
    if (!date) return res.status(400).json({ error: 'Date requise' });
    if (predicted_orders == null || actual_orders == null) {
      return res.status(400).json({ error: 'predicted_orders et actual_orders requis' });
    }

    const predicted = Number(predicted_orders);
    const actual = Number(actual_orders);

    let accuracy_pct = null;
    if (predicted > 0) {
      // 100% = perfect, 0% = completely wrong
      accuracy_pct = Math.max(0, Math.round((1 - Math.abs(actual - predicted) / predicted) * 1000) / 10);
    }

    run(
      `INSERT INTO prediction_accuracy (date, predicted_orders, actual_orders, accuracy_pct)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         predicted_orders = excluded.predicted_orders,
         actual_orders = excluded.actual_orders,
         accuracy_pct = excluded.accuracy_pct,
         recorded_at = datetime('now')`,
      [date, predicted, actual, accuracy_pct]
    );

    res.json({ ok: true, date, predicted_orders: predicted, actual_orders: actual, accuracy_pct });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/predictions/accuracy — Historique de précision des prédictions
router.get('/accuracy', (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const records = all(
      `SELECT date, predicted_orders, actual_orders, accuracy_pct
       FROM prediction_accuracy
       WHERE date >= ?
       ORDER BY date DESC`,
      [dateFrom]
    );

    const avgAccuracy = records.length > 0
      ? Math.round(records.filter(r => r.accuracy_pct != null).reduce((s, r) => s + r.accuracy_pct, 0) / records.filter(r => r.accuracy_pct != null).length * 10) / 10
      : null;

    res.json({ days, avg_accuracy_pct: avgAccuracy, records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
