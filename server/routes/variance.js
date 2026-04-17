const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// ═══════════════════════════════════════════
// Analyse de variance (théorique vs réel)
// Compare la consommation théorique (basée sur les ventes)
// avec le stock réel pour identifier les pertes
// ═══════════════════════════════════════════

// GET /api/variance/analysis — Analyse complète de variance sur une période
router.get('/analysis', (req, res) => {
  try {
    const { from, to } = req.query;

    // Default: last 7 days
    const dateFrom = from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    // 1. Get all stock-impacting movements in the period
    const movements = all(`
      SELECT sm.ingredient_id, sm.movement_type, sm.quantity, sm.unit, sm.unit_price,
             i.name as ingredient_name, i.default_unit, i.price_per_unit, i.price_unit
      FROM stock_movements sm
      LEFT JOIN ingredients i ON i.id = sm.ingredient_id
      WHERE date(sm.recorded_at) BETWEEN ? AND ?
      ORDER BY sm.ingredient_id
    `, [dateFrom, dateTo]);

    // 2. Get all orders served in the period
    // Orders that were sent to kitchen (stock was deducted at 'envoyé' status)
    // Exclude cancelled orders since their stock is restored (see orders.js)
    let ordersServed = [];
    try {
      ordersServed = all(`
        SELECT oi.recipe_id, SUM(oi.quantity) as qty_served
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status IN ('envoyé', 'prêt', 'servi', 'terminé')
          AND date(o.created_at) BETWEEN ? AND ?
        GROUP BY oi.recipe_id
      `, [dateFrom, dateTo]);
    } catch {
      ordersServed = [];
    }

    // 3. Calculate theoretical consumption per ingredient
    const theoreticalConsumption = {};

    for (const order of ordersServed) {
      const recipeIngredients = getRecipeFlatIngredients(order.recipe_id);
      for (const ri of recipeIngredients) {
        const key = ri.ingredient_id;
        if (!theoreticalConsumption[key]) {
          theoreticalConsumption[key] = {
            ingredient_id: key,
            ingredient_name: ri.ingredient_name || `#${key}`,
            unit: ri.unit,
            theoretical_qty: 0
          };
        }
        theoreticalConsumption[key].theoretical_qty += ri.quantity * order.qty_served;
      }
    }

    // 4. Get actual consumption from stock movements (type = 'sortie' or 'vente')
    const actualConsumption = {};
    const entries = {};

    for (const m of movements) {
      const key = m.ingredient_id;
      if (m.movement_type === 'sortie' || m.movement_type === 'vente' || m.movement_type === 'perte' || m.movement_type === 'consumption') {
        if (!actualConsumption[key]) {
          actualConsumption[key] = {
            ingredient_id: key,
            ingredient_name: m.ingredient_name || `#${key}`,
            unit: m.unit || m.default_unit,
            actual_qty: 0,
            losses: 0
          };
        }
        if (m.movement_type === 'perte') {
          actualConsumption[key].losses += Math.abs(m.quantity);
        }
        actualConsumption[key].actual_qty += Math.abs(m.quantity);
      } else if (m.movement_type === 'correction') {
        // Corrections from cancelled orders — reduce actual consumption
        if (actualConsumption[key]) {
          actualConsumption[key].actual_qty = Math.max(0, actualConsumption[key].actual_qty - Math.abs(m.quantity));
        }
      } else if (m.movement_type === 'entree' || m.movement_type === 'reception') {
        if (!entries[key]) {
          entries[key] = { total_qty: 0, total_value: 0 };
        }
        entries[key].total_qty += m.quantity;
        entries[key].total_value += (m.unit_price || 0) * m.quantity;
      }
    }

    // 5. Get current stock for each ingredient
    const stockData = all('SELECT ingredient_id, quantity, unit FROM stock');
    const currentStock = {};
    for (const s of stockData) {
      currentStock[s.ingredient_id] = s;
    }

    // 6. Build variance report
    const allIngredientIds = new Set([
      ...Object.keys(theoreticalConsumption).map(Number),
      ...Object.keys(actualConsumption).map(Number)
    ]);

    const report = [];
    let totalVarianceValue = 0;

    for (const id of allIngredientIds) {
      const theoretical = theoreticalConsumption[id];
      const actual = actualConsumption[id];
      const stock = currentStock[id];
      const entry = entries[id];
      const ingredient = get('SELECT name, default_unit, price_per_unit, price_unit FROM ingredients WHERE id = ?', [id]);

      const theoreticalQty = theoretical ? Math.round(theoretical.theoretical_qty * 1000) / 1000 : 0;
      const actualQty = actual ? Math.round(actual.actual_qty * 1000) / 1000 : 0;
      const varianceQty = Math.round((actualQty - theoreticalQty) * 1000) / 1000;
      const variancePct = theoreticalQty > 0 ? Math.round((varianceQty / theoreticalQty) * 10000) / 100 : 0;

      // Estimate value of variance
      let pricePerUnit = 0;
      if (ingredient && ingredient.price_per_unit > 0) {
        pricePerUnit = ingredient.price_per_unit;
      } else if (entry && entry.total_qty > 0) {
        pricePerUnit = entry.total_value / entry.total_qty;
      }
      const varianceValue = Math.round(varianceQty * pricePerUnit * 100) / 100;
      totalVarianceValue += varianceValue;

      // Status: ok, warning, critical
      let status = 'ok';
      if (Math.abs(variancePct) > 15) status = 'critical';
      else if (Math.abs(variancePct) > 5) status = 'warning';

      report.push({
        ingredient_id: id,
        ingredient_name: ingredient ? ingredient.name : (theoretical || actual).ingredient_name,
        unit: ingredient ? (ingredient.price_unit || ingredient.default_unit) : ((theoretical || actual).unit),
        theoretical_qty: theoreticalQty,
        actual_qty: actualQty,
        variance_qty: varianceQty,
        variance_pct: variancePct,
        variance_value: varianceValue,
        current_stock: stock ? stock.quantity : null,
        losses: actual ? actual.losses : 0,
        status
      });
    }

    // Sort by absolute variance value (biggest losses first)
    report.sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value));

    res.json({
      period: { from: dateFrom, to: dateTo },
      total_variance_value: Math.round(totalVarianceValue * 100) / 100,
      total_items: report.length,
      critical_count: report.filter(r => r.status === 'critical').length,
      warning_count: report.filter(r => r.status === 'warning').length,
      items: report
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur analyse variance', details: e.message });
  }
});

// GET /api/variance/summary — Résumé rapide pour le dashboard
router.get('/summary', (req, res) => {
  try {
    // Last 30 days
    const dateFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    // Total pertes déclarées
    const losses = get(`
      SELECT COALESCE(SUM(ABS(sm.quantity) * COALESCE(i.price_per_unit, 0)), 0) as total_loss_value,
             COUNT(DISTINCT sm.ingredient_id) as ingredients_with_losses
      FROM stock_movements sm
      LEFT JOIN ingredients i ON i.id = sm.ingredient_id
      WHERE sm.movement_type = 'perte' AND date(sm.recorded_at) >= ?
    `, [dateFrom]);

    // Total entrées (achats)
    const purchases = get(`
      SELECT COALESCE(SUM(sm.quantity * COALESCE(sm.unit_price, 0)), 0) as total_purchase_value
      FROM stock_movements sm
      WHERE sm.movement_type IN ('entree', 'reception') AND date(sm.recorded_at) >= ?
    `, [dateFrom]);

    // Ratio pertes / achats
    const lossRatio = purchases.total_purchase_value > 0
      ? Math.round((losses.total_loss_value / purchases.total_purchase_value) * 10000) / 100
      : 0;

    // Alertes stock bas
    const lowStockCount = get(`
      SELECT COUNT(*) as c FROM stock WHERE quantity <= min_quantity AND min_quantity > 0
    `).c;

    res.json({
      period_days: 30,
      total_loss_value: Math.round(losses.total_loss_value * 100) / 100,
      ingredients_with_losses: losses.ingredients_with_losses,
      total_purchase_value: Math.round(purchases.total_purchase_value * 100) / 100,
      loss_ratio_pct: lossRatio,
      low_stock_alerts: lowStockCount,
      health: lossRatio < 3 ? 'good' : lossRatio < 6 ? 'warning' : 'critical'
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Helper: Get flat ingredient list for a recipe ───
function getRecipeFlatIngredients(recipeId, multiplier = 1, visited = new Set()) {
  if (visited.has(recipeId)) return [];
  visited.add(recipeId);

  const recipe = get('SELECT * FROM recipes WHERE id = ?', [recipeId]);
  if (!recipe) return [];

  const ingredients = all('SELECT * FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
  const result = [];

  for (const ing of ingredients) {
    if (ing.sub_recipe_id) {
      const subRecipe = get('SELECT * FROM recipes WHERE id = ?', [ing.sub_recipe_id]);
      if (subRecipe) {
        const portionsUsed = ing.gross_quantity * multiplier;
        const subMult = subRecipe.portions > 0 ? portionsUsed / subRecipe.portions : portionsUsed;
        result.push(...getRecipeFlatIngredients(ing.sub_recipe_id, subMult, new Set(visited)));
      }
    } else if (ing.ingredient_id) {
      const ingredient = get('SELECT name, default_unit FROM ingredients WHERE id = ?', [ing.ingredient_id]);
      result.push({
        ingredient_id: ing.ingredient_id,
        ingredient_name: ingredient ? ingredient.name : `#${ing.ingredient_id}`,
        quantity: ing.gross_quantity * multiplier,
        unit: ing.unit
      });
    }
  }

  return result;
}

// GET /api/variance/top-losses — Top pertes pour le dashboard
router.get('/top-losses', (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const topLosses = all(`
      SELECT sm.ingredient_id, i.name as ingredient_name,
             SUM(ABS(sm.quantity)) as total_lost_qty, sm.unit,
             COALESCE(i.price_per_unit, 0) as price_per_unit,
             SUM(ABS(sm.quantity) * COALESCE(i.price_per_unit, 0)) as total_loss_value,
             COUNT(*) as loss_events
      FROM stock_movements sm
      LEFT JOIN ingredients i ON i.id = sm.ingredient_id
      WHERE sm.movement_type = 'perte' AND date(sm.recorded_at) >= ?
      GROUP BY sm.ingredient_id
      ORDER BY total_loss_value DESC
      LIMIT 10
    `, [dateFrom]);

    res.json({
      period_days: days,
      items: topLosses.map(l => ({
        ...l,
        total_lost_qty: Math.round(l.total_lost_qty * 1000) / 1000,
        total_loss_value: Math.round(l.total_loss_value * 100) / 100
      }))
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/variance/trends — Évolution des pertes dans le temps
router.get('/trends', (req, res) => {
  try {
    const days = Number(req.query.days) || 90;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const weeklyLosses = all(`
      SELECT strftime('%Y-W%W', sm.recorded_at) as week,
             SUM(ABS(sm.quantity) * COALESCE(i.price_per_unit, 0)) as loss_value,
             COUNT(DISTINCT sm.ingredient_id) as ingredients_impacted,
             COUNT(*) as events
      FROM stock_movements sm
      LEFT JOIN ingredients i ON i.id = sm.ingredient_id
      WHERE sm.movement_type = 'perte' AND date(sm.recorded_at) >= ?
      GROUP BY week
      ORDER BY week
    `, [dateFrom]);

    const weeklyPurchases = all(`
      SELECT strftime('%Y-W%W', sm.recorded_at) as week,
             SUM(sm.quantity * COALESCE(sm.unit_price, 0)) as purchase_value
      FROM stock_movements sm
      WHERE sm.movement_type IN ('entree', 'reception') AND date(sm.recorded_at) >= ?
      GROUP BY week
      ORDER BY week
    `, [dateFrom]);

    // Merge data
    const purchaseMap = {};
    for (const p of weeklyPurchases) purchaseMap[p.week] = p.purchase_value;

    const trends = weeklyLosses.map(w => ({
      week: w.week,
      loss_value: Math.round(w.loss_value * 100) / 100,
      purchase_value: Math.round((purchaseMap[w.week] || 0) * 100) / 100,
      loss_ratio: purchaseMap[w.week] > 0
        ? Math.round(w.loss_value / purchaseMap[w.week] * 10000) / 100
        : 0,
      ingredients_impacted: w.ingredients_impacted,
      events: w.events
    }));

    res.json({ period_days: days, trends });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
