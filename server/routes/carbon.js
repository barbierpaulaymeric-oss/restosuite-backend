const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// Ensure carbon_targets table exists
try {
  run(`CREATE TABLE IF NOT EXISTS carbon_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    period TEXT NOT NULL DEFAULT 'monthly',
    target_co2_kg REAL NOT NULL,
    label TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
} catch {}

router.use(requireAuth);

// ═══════════════════════════════════════════
// Bilan Carbone — Empreinte environnementale
// Estimations basées sur les facteurs ADEME
// (Agence de la transition écologique, France)
// ═══════════════════════════════════════════

// Facteurs d'émission moyens en kgCO2e par kg d'ingrédient
// Source: Base Empreinte ADEME (simplifiée)
const CO2_FACTORS = {
  // Viandes
  'boeuf': 26.0, 'veau': 22.0, 'agneau': 25.0, 'porc': 5.5,
  'poulet': 4.5, 'canard': 5.0, 'dinde': 4.8, 'lapin': 4.0,
  'gibier': 6.0, 'foie gras': 10.0, 'lard': 5.5, 'jambon': 5.5,
  'saucisse': 5.0, 'merguez': 6.0, 'chorizo': 5.5, 'bacon': 5.5,
  // Poissons et fruits de mer
  'saumon': 6.0, 'thon': 5.0, 'cabillaud': 3.5, 'bar': 4.0,
  'dorade': 4.0, 'sole': 5.0, 'truite': 3.5, 'crevette': 12.0,
  'langoustine': 12.0, 'homard': 10.0, 'moule': 0.5, 'huître': 0.5,
  'calmar': 3.0, 'poulpe': 3.0, 'sardine': 1.5, 'maquereau': 1.5,
  // Produits laitiers
  'lait': 1.3, 'crème': 3.5, 'beurre': 8.0, 'fromage': 6.0,
  'parmesan': 8.0, 'mozzarella': 5.5, 'comté': 7.0, 'gruyère': 7.0,
  'chèvre': 4.0, 'yaourt': 1.5, 'mascarpone': 5.0, 'ricotta': 4.0,
  // Oeufs
  'oeuf': 3.0, 'oeufs': 3.0,
  // Céréales et féculents
  'riz': 2.5, 'pâtes': 0.9, 'farine': 0.8, 'pain': 0.8,
  'semoule': 0.9, 'blé': 0.8, 'maïs': 0.7, 'quinoa': 1.0,
  'pomme de terre': 0.2, 'patate douce': 0.3, 'lentille': 0.5,
  'pois chiche': 0.5, 'haricot sec': 0.5, 'boulgour': 0.9,
  // Fruits et légumes
  'tomate': 0.7, 'carotte': 0.2, 'oignon': 0.2, 'ail': 0.3,
  'poivron': 0.5, 'courgette': 0.3, 'aubergine': 0.4,
  'salade': 0.2, 'laitue': 0.2, 'épinard': 0.3, 'chou': 0.2,
  'brocoli': 0.4, 'champignon': 0.5, 'avocat': 1.3, 'concombre': 0.3,
  'haricot vert': 0.3, 'petit pois': 0.4, 'asperge': 0.5,
  'poireau': 0.2, 'céleri': 0.2, 'fenouil': 0.2, 'navet': 0.2,
  'betterave': 0.2, 'radis': 0.2, 'artichaut': 0.3,
  'pomme': 0.3, 'poire': 0.3, 'banane': 0.7, 'orange': 0.4,
  'citron': 0.3, 'fraise': 0.5, 'framboise': 0.6, 'myrtille': 0.6,
  'mangue': 1.0, 'ananas': 0.9, 'raisin': 0.5, 'pêche': 0.4,
  'abricot': 0.4, 'melon': 0.3, 'pastèque': 0.2,
  // Huiles et graisses
  'huile olive': 3.0, 'huile tournesol': 2.5, 'huile colza': 2.5,
  'huile': 2.8, 'huile végétale': 2.5,
  // Sucre et chocolat
  'sucre': 0.6, 'chocolat': 4.5, 'cacao': 4.0, 'miel': 0.8,
  // Épices et condiments (impact faible au kg mais petites quantités)
  'sel': 0.1, 'poivre': 0.5, 'épice': 0.5, 'herbe': 0.3,
  'vinaigre': 0.4, 'moutarde': 0.5, 'sauce soja': 0.5,
  // Boissons
  'café': 5.0, 'thé': 1.5, 'vin': 1.0, 'bière': 0.5,
  // Noix et graines
  'amande': 2.5, 'noix': 1.5, 'noisette': 1.0, 'pistache': 1.5,
  'sésame': 1.0, 'lin': 0.8
};

// Default factor for unknown ingredients (average)
const DEFAULT_CO2_FACTOR = 1.5;

// Match ingredient name to CO2 factor
function getCO2Factor(ingredientName) {
  const name = (ingredientName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Exact match first
  for (const [key, val] of Object.entries(CO2_FACTORS)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (name === normKey || name.includes(normKey)) return val;
  }

  // Category-based fallback
  if (name.match(/viande|filet|côte|entrecôte|steak/)) return 10.0;
  if (name.match(/poisson|filet de|pavé de/)) return 4.0;
  if (name.match(/fromage|fromagère/)) return 6.0;
  if (name.match(/légume|salade|herbe/)) return 0.3;
  if (name.match(/fruit/)) return 0.5;

  return DEFAULT_CO2_FACTOR;
}

// Convert quantity to kg based on unit
function toKg(quantity, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'kg') return quantity;
  if (u === 'g') return quantity / 1000;
  if (u === 'l' || u === 'L') return quantity; // ~1kg per liter approx
  if (u === 'cl') return quantity / 100;
  if (u === 'ml') return quantity / 1000;
  if (u === 'pièce' || u === 'pce' || u === 'unité') return quantity * 0.1; // ~100g per piece avg
  return quantity; // assume kg if unknown
}

// GET /api/carbon/recipes — Bilan carbone par recette
router.get('/recipes', (req, res) => {
  try {
    const rid = req.user && req.user.restaurant_id;
    if (!rid) return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.portions, r.selling_price
      FROM recipes r
      WHERE r.restaurant_id = ?
      ORDER BY r.name
    `, [rid]);

    const results = [];

    for (const recipe of recipes) {
      const ingredients = all(`
        SELECT ri.gross_quantity, ri.unit, ri.ingredient_id, ri.sub_recipe_id,
               i.name as ingredient_name
        FROM recipe_ingredients ri
        LEFT JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ?
      `, [recipe.id]);

      let totalCO2 = 0;
      const breakdown = [];

      for (const ing of ingredients) {
        if (ing.sub_recipe_id) continue; // Skip sub-recipes (counted via their ingredients)
        if (!ing.ingredient_name) continue;

        const factor = getCO2Factor(ing.ingredient_name);
        const qtyKg = toKg(ing.gross_quantity, ing.unit);
        const co2 = qtyKg * factor;
        totalCO2 += co2;

        breakdown.push({
          ingredient: ing.ingredient_name,
          qty_kg: Math.round(qtyKg * 1000) / 1000,
          factor,
          co2_kg: Math.round(co2 * 1000) / 1000
        });
      }

      const co2PerPortion = recipe.portions > 0 ? totalCO2 / recipe.portions : totalCO2;

      // Rating: A (<0.5), B (<1), C (<2), D (<4), E (>=4)
      let rating = 'E';
      if (co2PerPortion < 0.5) rating = 'A';
      else if (co2PerPortion < 1.0) rating = 'B';
      else if (co2PerPortion < 2.0) rating = 'C';
      else if (co2PerPortion < 4.0) rating = 'D';

      results.push({
        id: recipe.id,
        name: recipe.name,
        category: recipe.category || 'Non classé',
        portions: recipe.portions,
        total_co2_kg: Math.round(totalCO2 * 1000) / 1000,
        co2_per_portion: Math.round(co2PerPortion * 1000) / 1000,
        rating,
        breakdown: breakdown.sort((a, b) => b.co2_kg - a.co2_kg)
      });
    }

    // Sort by CO2 per portion descending
    results.sort((a, b) => b.co2_per_portion - a.co2_per_portion);

    // Summary
    const totalRecipes = results.length;
    const avgCO2 = totalRecipes > 0 ? results.reduce((s, r) => s + r.co2_per_portion, 0) / totalRecipes : 0;
    const ratingDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const r of results) ratingDist[r.rating]++;

    // Top polluters
    const topPolluters = results.slice(0, 5);
    const bestRecipes = [...results].sort((a, b) => a.co2_per_portion - b.co2_per_portion).slice(0, 5);

    res.json({
      recipes: results,
      summary: {
        total_recipes: totalRecipes,
        avg_co2_per_portion: Math.round(avgCO2 * 1000) / 1000,
        rating_distribution: ratingDist,
        top_polluters: topPolluters.map(r => ({ name: r.name, co2: r.co2_per_portion, rating: r.rating })),
        best_recipes: bestRecipes.map(r => ({ name: r.name, co2: r.co2_per_portion, rating: r.rating }))
      }
    });
  } catch (e) {
    console.error('Carbon recipes error:', e);
    res.status(500).json({ error: 'Erreur calcul bilan carbone', details: e.message });
  }
});

// GET /api/carbon/global — Bilan carbone global du restaurant (30j)
router.get('/global', (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    // Get all ingredients purchased in period
    const purchases = all(`
      SELECT sm.ingredient_id, SUM(sm.quantity) as total_qty, sm.unit,
             i.name as ingredient_name
      FROM stock_movements sm
      LEFT JOIN ingredients i ON i.id = sm.ingredient_id
      WHERE sm.movement_type IN ('entree', 'reception')
        AND date(sm.recorded_at) >= ?
      GROUP BY sm.ingredient_id
    `, [dateFrom]);

    let totalCO2 = 0;
    const byCategory = {};

    for (const p of purchases) {
      const factor = getCO2Factor(p.ingredient_name);
      const qtyKg = toKg(p.total_qty, p.unit);
      const co2 = qtyKg * factor;
      totalCO2 += co2;

      // Categorize
      let cat = 'Autre';
      const name = (p.ingredient_name || '').toLowerCase();
      if (name.match(/boeuf|veau|agneau|porc|poulet|canard|viande|filet|côte|entrecôte|steak|lard|jambon|saucisse|dinde|lapin/)) cat = 'Viandes';
      else if (name.match(/saumon|thon|cabillaud|bar|dorade|crevette|moule|huître|poisson|sardine|truite/)) cat = 'Poissons';
      else if (name.match(/lait|crème|beurre|fromage|yaourt|mozzarella|parmesan|comté/)) cat = 'Produits laitiers';
      else if (name.match(/oeuf/)) cat = 'Oeufs';
      else if (name.match(/tomate|carotte|oignon|poivron|courgette|aubergine|salade|chou|champignon|légume|épinard|haricot vert|asperge/)) cat = 'Légumes';
      else if (name.match(/pomme|poire|banane|orange|citron|fraise|framboise|fruit|mangue|ananas/)) cat = 'Fruits';
      else if (name.match(/riz|pâte|farine|pain|semoule|pomme de terre|lentille/)) cat = 'Féculents';

      if (!byCategory[cat]) byCategory[cat] = { co2: 0, qty_kg: 0, items: 0 };
      byCategory[cat].co2 += co2;
      byCategory[cat].qty_kg += qtyKg;
      byCategory[cat].items++;
    }

    const categories = Object.entries(byCategory)
      .map(([name, data]) => ({
        name,
        co2_kg: Math.round(data.co2 * 100) / 100,
        qty_kg: Math.round(data.qty_kg * 100) / 100,
        pct: totalCO2 > 0 ? Math.round((data.co2 / totalCO2) * 1000) / 10 : 0,
        items: data.items
      }))
      .sort((a, b) => b.co2_kg - a.co2_kg);

    // Equivalent comparisons
    const carKmEquiv = Math.round(totalCO2 / 0.12); // ~120g CO2/km
    const treeDays = Math.round(totalCO2 / 0.06); // ~60g CO2 absorbed per tree per day
    const flights = Math.round(totalCO2 / 250 * 10) / 10; // ~250kg CO2 per Paris-Marseille flight

    res.json({
      period_days: days,
      total_co2_kg: Math.round(totalCO2 * 100) / 100,
      daily_avg_co2: Math.round((totalCO2 / days) * 100) / 100,
      categories,
      equivalents: {
        car_km: carKmEquiv,
        tree_days: treeDays,
        flights_paris_marseille: flights
      }
    });
  } catch (e) {
    console.error('Carbon global error:', e);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/carbon/targets — Objectifs carbone (tenant-scoped)
router.get('/targets', (req, res) => {
  try {
    const targets = all(
      'SELECT * FROM carbon_targets WHERE restaurant_id = ? ORDER BY created_at DESC',
      [req.user.restaurant_id]
    );
    res.json(targets);
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/carbon/targets — Créer/mettre à jour un objectif carbone
router.post('/targets', (req, res) => {
  try {
    const { target_co2_kg, period, label } = req.body;
    if (!target_co2_kg || isNaN(Number(target_co2_kg)) || Number(target_co2_kg) <= 0) {
      return res.status(400).json({ error: 'Objectif CO2 invalide (doit être > 0)' });
    }

    const validPeriods = ['weekly', 'monthly', 'yearly'];
    const p = period || 'monthly';
    if (!validPeriods.includes(p)) {
      return res.status(400).json({ error: 'Période invalide (weekly, monthly, yearly)' });
    }

    // Upsert: one target per period per restaurant
    const rid = req.user.restaurant_id;
    const existing = get('SELECT id FROM carbon_targets WHERE period = ? AND restaurant_id = ?', [p, rid]);
    if (existing) {
      run(
        `UPDATE carbon_targets SET target_co2_kg = ?, label = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [Number(target_co2_kg), label || null, existing.id]
      );
      res.json({ ok: true, id: existing.id, updated: true });
    } else {
      const result = run(
        `INSERT INTO carbon_targets (restaurant_id, period, target_co2_kg, label) VALUES (?, ?, ?, ?)`,
        [rid, p, Number(target_co2_kg), label || null]
      );
      res.json({ ok: true, id: Number(result.lastInsertRowid), updated: false });
    }
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
