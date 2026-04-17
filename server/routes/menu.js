const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// ═══════════════════════════════════════════
// Public QR-code menu ordering
// ═══════════════════════════════════════════
// The QR code embeds ?r=<restaurant_id>&table=<n>. Every query on these
// public endpoints MUST be scoped by that restaurant_id — without it, a
// visitor would see every tenant's recipes. We validate the id against
// the restaurants table and reject unknown ids rather than default to any
// tenant.

function parseRestaurantId(raw) {
  const rid = parseInt(raw, 10);
  if (!Number.isInteger(rid) || rid < 1) return null;
  return rid;
}

function loadRestaurant(rid) {
  try {
    return get('SELECT id, name FROM restaurants WHERE id = ?', [rid]);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// GET /api/menu?r=<restaurant_id> — Menu public (QR code)
// ═══════════════════════════════════════════
router.get('/', (req, res) => {
  const rid = parseRestaurantId(req.query.r);
  if (!rid) {
    return res.status(400).json({ error: 'Paramètre "r" (restaurant_id) requis' });
  }
  const restaurant = loadRestaurant(rid);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant introuvable' });
  }

  try {
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.selling_price, r.notes as description
      FROM recipes r
      WHERE r.restaurant_id = ?
        AND (r.recipe_type = 'plat' OR r.recipe_type IS NULL)
        AND r.selling_price > 0
      ORDER BY r.category, r.name
    `, [rid]);

    // Group by category
    const categories = {};
    const categoryOrder = ['entrée', 'plat', 'dessert', 'boisson', 'amuse-bouche', 'accompagnement'];

    for (const recipe of recipes) {
      const cat = (recipe.category || 'Autre').toLowerCase();
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({
        id: recipe.id,
        name: recipe.name,
        price: recipe.selling_price,
        description: recipe.description
      });
    }

    const sorted = {};
    for (const cat of categoryOrder) {
      if (categories[cat]) sorted[cat] = categories[cat];
    }
    for (const cat of Object.keys(categories)) {
      if (!sorted[cat]) sorted[cat] = categories[cat];
    }

    res.json({ restaurant_name: restaurant.name || 'Restaurant', categories: sorted });
  } catch (e) {
    console.error('Menu error:', e);
    res.status(500).json({ error: 'Erreur chargement menu' });
  }
});

// ═══════════════════════════════════════════
// POST /api/menu/order — Commande client QR
// ═══════════════════════════════════════════
// Body: { restaurant_id, table_number, items: [{ recipe_id, quantity, notes? }] }
// recipe_id is validated against restaurant_id to prevent cross-tenant
// injection of another tenant's recipes into this tenant's orders.
router.post('/order', (req, res) => {
  const rid = parseRestaurantId(req.body && req.body.restaurant_id);
  if (!rid) {
    return res.status(400).json({ error: 'restaurant_id requis' });
  }
  if (!loadRestaurant(rid)) {
    return res.status(404).json({ error: 'Restaurant introuvable' });
  }

  const { table_number, items } = req.body;
  if (!table_number || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'table_number et items sont requis' });
  }

  try {
    const transaction = db.transaction(() => {
      const orderInfo = run(
        `INSERT INTO orders (restaurant_id, table_number, status, notes)
         VALUES (?, ?, 'en_attente_validation', 'Commande QR Code')`,
        [rid, table_number]
      );

      let totalCost = 0;
      for (const item of items) {
        if (!item.recipe_id || !item.quantity || item.quantity < 1) continue;

        // Scope recipe lookup to the same tenant — drops recipes from other tenants.
        const recipe = get(
          'SELECT id, selling_price FROM recipes WHERE id = ? AND restaurant_id = ?',
          [item.recipe_id, rid]
        );
        if (!recipe) continue;

        run(
          `INSERT INTO order_items (order_id, recipe_id, quantity, status, notes, restaurant_id)
           VALUES (?, ?, ?, 'en_attente', ?, ?)`,
          [orderInfo.lastInsertRowid, item.recipe_id, item.quantity, item.notes || null, rid]
        );

        totalCost += (recipe.selling_price || 0) * item.quantity;
      }

      run(
        'UPDATE orders SET total_cost = ? WHERE id = ? AND restaurant_id = ?',
        [totalCost, orderInfo.lastInsertRowid, rid]
      );

      return { order_id: orderInfo.lastInsertRowid, total: totalCost };
    });

    const result = transaction();
    res.status(201).json({ success: true, ...result, message: 'Commande envoyée ! Le serveur va la valider.' });
  } catch (e) {
    console.error('QR order error:', e);
    res.status(500).json({ error: 'Erreur création commande' });
  }
});

// ─── Auth middleware: all routes below require authentication ───
router.use(requireAuth);

// ═══════════════════════════════════════════
// GET /api/menu/pending-orders — Commandes QR en attente (caller tenant only)
// ═══════════════════════════════════════════
router.get('/pending-orders', (req, res) => {
  const rid = req.user && req.user.restaurant_id;
  if (!rid) return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  try {
    const orders = all(`
      SELECT * FROM orders
      WHERE status = 'en_attente_validation' AND restaurant_id = ?
      ORDER BY created_at DESC
    `, [rid]);

    const enriched = orders.map(order => {
      const items = all(`
        SELECT oi.*, r.name as recipe_name, r.selling_price
        FROM order_items oi
        JOIN recipes r ON r.id = oi.recipe_id AND r.restaurant_id = ?
        WHERE oi.order_id = ? AND oi.restaurant_id = ?
      `, [rid, order.id, rid]);
      return { ...order, items };
    });

    res.json(enriched);
  } catch (e) {
    console.error('Pending orders error:', e);
    res.status(500).json({ error: 'Erreur chargement commandes' });
  }
});

module.exports = router;
