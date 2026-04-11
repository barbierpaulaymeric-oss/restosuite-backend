const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// ═══════════════════════════════════════════
// GET /api/menu — Menu public (pas d'auth)
// ═══════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.selling_price, r.notes as description
      FROM recipes r
      WHERE (r.recipe_type = 'plat' OR r.recipe_type IS NULL)
        AND r.selling_price > 0
      ORDER BY r.category, r.name
    `);

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

    // Sort categories by predefined order
    const sorted = {};
    for (const cat of categoryOrder) {
      if (categories[cat]) sorted[cat] = categories[cat];
    }
    // Add remaining categories
    for (const cat of Object.keys(categories)) {
      if (!sorted[cat]) sorted[cat] = categories[cat];
    }

    const restaurant = get('SELECT name FROM restaurants LIMIT 1');
    res.json({ restaurant_name: restaurant?.name || 'Restaurant', categories: sorted });
  } catch (e) {
    console.error('Menu error:', e);
    res.status(500).json({ error: 'Erreur chargement menu' });
  }
});

// ═══════════════════════════════════════════
// POST /api/menu/order — Commande client QR
// ═══════════════════════════════════════════
router.post('/order', (req, res) => {
  const { table_number, items } = req.body;

  if (!table_number || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'table_number et items sont requis' });
  }

  try {
    const transaction = db.transaction(() => {
      // Create order with pending validation status
      const orderInfo = run(
        `INSERT INTO orders (table_number, status, notes) VALUES (?, 'en_attente_validation', 'Commande QR Code')`,
        [table_number]
      );

      let totalCost = 0;
      for (const item of items) {
        if (!item.recipe_id || !item.quantity || item.quantity < 1) continue;
        
        const recipe = get('SELECT id, selling_price FROM recipes WHERE id = ?', [item.recipe_id]);
        if (!recipe) continue;

        run(
          `INSERT INTO order_items (order_id, recipe_id, quantity, status, notes)
           VALUES (?, ?, ?, 'en_attente', ?)`,
          [orderInfo.lastInsertRowid, item.recipe_id, item.quantity, item.notes || null]
        );

        totalCost += (recipe.selling_price || 0) * item.quantity;
      }

      // Update order total
      run('UPDATE orders SET total_cost = ? WHERE id = ?', [totalCost, orderInfo.lastInsertRowid]);

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
// GET /api/menu/pending-orders — Commandes QR en attente
// ═══════════════════════════════════════════
router.get('/pending-orders', (req, res) => {
  try {
    const orders = all(`
      SELECT * FROM orders WHERE status = 'en_attente_validation'
      ORDER BY created_at DESC
    `);

    const enriched = orders.map(order => {
      const items = all(`
        SELECT oi.*, r.name as recipe_name, r.selling_price
        FROM order_items oi
        JOIN recipes r ON r.id = oi.recipe_id
        WHERE oi.order_id = ?
      `, [order.id]);
      return { ...order, items };
    });

    res.json(enriched);
  } catch (e) {
    console.error('Pending orders error:', e);
    res.status(500).json({ error: 'Erreur chargement commandes' });
  }
});

module.exports = router;
