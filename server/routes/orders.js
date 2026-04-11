const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { getFlatIngredients } = require('./recipes');
const { convertUnit } = require('../utils/units');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// ═══════════════════════════════════════════
// GET /api/orders — Liste des commandes
// ═══════════════════════════════════════════
router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM orders';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const orders = all(sql, params);

  // Enrich with items
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
});

// ═══════════════════════════════════════════
// GET /api/orders/:id — Détail d'une commande
// ═══════════════════════════════════════════
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = all(`
    SELECT oi.*, r.name as recipe_name, r.selling_price
    FROM order_items oi
    JOIN recipes r ON r.id = oi.recipe_id
    WHERE oi.order_id = ?
  `, [order.id]);

  res.json({ ...order, items });
});

// ═══════════════════════════════════════════
// POST /api/orders — Créer une commande
// ═══════════════════════════════════════════
router.post('/', (req, res) => {
  try {
    const { table_number, items, notes, restaurant_id } = req.body;

    // Resolve restaurant_id: from body, or from auth token if available
    let resolvedRestaurantId = restaurant_id || null;
    if (!resolvedRestaurantId && req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'restosuite-dev-secret-2026');
        if (decoded.id) {
          const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [decoded.id]);
          if (account) resolvedRestaurantId = account.restaurant_id;
        }
      } catch { /* token invalid or missing — ok, restaurant_id stays null */ }
    }

    if (!table_number) return res.status(400).json({ error: 'table_number requis' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un item requis' });
    }

    // Validate items have required fields
    for (const item of items) {
      if (!item.recipe_id) {
        return res.status(400).json({ error: 'recipe_id est requis pour chaque item' });
      }
      if (item.quantity !== undefined && item.quantity !== null) {
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          return res.status(400).json({ error: 'quantity must be a positive number' });
        }
      }
    }

    const transaction = db.transaction(() => {
      // Calculate total
      let totalCost = 0;
      for (const item of items) {
        const recipe = get('SELECT selling_price FROM recipes WHERE id = ?', [item.recipe_id]);
        if (recipe && recipe.selling_price) {
          totalCost += recipe.selling_price * (item.quantity || 1);
        }
      }

      const orderInfo = run(
        'INSERT INTO orders (table_number, notes, total_cost, restaurant_id) VALUES (?, ?, ?, ?)',
        [table_number, notes || null, Math.round(totalCost * 100) / 100, resolvedRestaurantId]
      );
      const orderId = orderInfo.lastInsertRowid;

      for (const item of items) {
        run(
          'INSERT INTO order_items (order_id, recipe_id, quantity, notes) VALUES (?, ?, ?, ?)',
          [orderId, item.recipe_id, item.quantity || 1, item.notes || null]
        );
      }

      return orderId;
    });

    const orderId = transaction();
    const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
    const orderItems = all(`
      SELECT oi.*, r.name as recipe_name, r.selling_price
      FROM order_items oi
      JOIN recipes r ON r.id = oi.recipe_id
      WHERE oi.order_id = ?
    `, [orderId]);
    res.status(201).json({ ...order, items: orderItems });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// PUT /api/orders/:id — Modifier statut commande
// ═══════════════════════════════════════════
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body;
  const order = get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  if (status) {
    run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
  }
  if (notes !== undefined) {
    run('UPDATE orders SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [notes, id]);
  }

  const updated = get('SELECT * FROM orders WHERE id = ?', [id]);
  const items = all(`
    SELECT oi.*, r.name as recipe_name, r.selling_price
    FROM order_items oi
    JOIN recipes r ON r.id = oi.recipe_id
    WHERE oi.order_id = ?
  `, [id]);
  res.json({ ...updated, items });
});

// ═══════════════════════════════════════════
// PUT /api/orders/:id/items/:itemId — Modifier statut item
// ═══════════════════════════════════════════
router.put('/:id/items/:itemId', (req, res) => {
  const orderId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const { status } = req.body;

  const item = get('SELECT * FROM order_items WHERE id = ? AND order_id = ?', [itemId, orderId]);
  if (!item) return res.status(404).json({ error: 'Item introuvable' });

  run('UPDATE order_items SET status = ? WHERE id = ?', [status, itemId]);

  // Auto-update order status based on item statuses
  const allItems = all('SELECT status FROM order_items WHERE order_id = ?', [orderId]);
  const activeItems = allItems.filter(i => i.status !== 'annulé');

  if (activeItems.length > 0) {
    const allServi = activeItems.every(i => i.status === 'servi');
    const allReadyOrServi = activeItems.every(i => i.status === 'prêt' || i.status === 'servi');

    if (allServi) {
      // All items served → order is 'servi'
      run("UPDATE orders SET status = 'servi', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [orderId]);
    } else if (allReadyOrServi && activeItems.some(i => i.status === 'prêt')) {
      // All items ready (some prêt, some servi) → order is 'prêt'
      run("UPDATE orders SET status = 'prêt', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [orderId]);
    }
  }

  const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const items = all(`
    SELECT oi.*, r.name as recipe_name, r.selling_price
    FROM order_items oi
    JOIN recipes r ON r.id = oi.recipe_id
    WHERE oi.order_id = ?
  `, [orderId]);
  res.json({ ...order, items });
});

// ═══════════════════════════════════════════
// POST /api/orders/:id/send — Envoyer en cuisine + déduction stock
// ═══════════════════════════════════════════
router.post('/:id/send', (req, res) => {
  const id = Number(req.params.id);
  const order = get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (order.status !== 'en_cours' && order.status !== 'en_attente_validation') {
    return res.status(400).json({ error: 'Commande déjà envoyée' });
  }

  const items = all('SELECT * FROM order_items WHERE order_id = ?', [id]);
  const warnings = [];

  const transaction = db.transaction(() => {
    // Update order status
    run("UPDATE orders SET status = 'envoyé', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    run("UPDATE order_items SET status = 'en_attente' WHERE order_id = ? AND status = 'en_attente'", [id]);

    // Deduct stock for each item
    for (const item of items) {
      if (item.status === 'annulé') continue;

      const flatIngredients = getFlatIngredients(item.recipe_id, item.quantity);

      for (const fi of flatIngredients) {
        // Check current stock
        const stock = get('SELECT * FROM stock WHERE ingredient_id = ?', [fi.ingredient_id]);
        const currentQty = stock ? stock.quantity : 0;

        // Convert recipe unit to stock unit if needed (e.g., recipe in g, stock in kg)
        const stockUnit = stock ? stock.unit : fi.unit;
        const deductQty = convertUnit(fi.quantity, fi.unit, stockUnit);

        if (currentQty < deductQty) {
          const ingName = get('SELECT name FROM ingredients WHERE id = ?', [fi.ingredient_id]);
          warnings.push({
            ingredient_id: fi.ingredient_id,
            ingredient_name: ingName ? ingName.name : `#${fi.ingredient_id}`,
            needed: Math.round(deductQty * 1000) / 1000,
            available: Math.round(currentQty * 1000) / 1000,
            unit: stockUnit
          });
        }

        // Record movement (in stock unit for consistency)
        run(
          `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, recorded_at)
           VALUES (?, 'consumption', ?, ?, ?, CURRENT_TIMESTAMP)`,
          [fi.ingredient_id, deductQty, stockUnit, `Commande #${id} - Table ${order.table_number}`]
        );

        // Deduct from stock
        if (stock) {
          run(
            'UPDATE stock SET quantity = MAX(0, quantity - ?), last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
            [deductQty, fi.ingredient_id]
          );
        }
      }
    }
  });

  try {
    transaction();
    const updated = get('SELECT * FROM orders WHERE id = ?', [id]);
    const updatedItems = all(`
      SELECT oi.*, r.name as recipe_name, r.selling_price
      FROM order_items oi
      JOIN recipes r ON r.id = oi.recipe_id
      WHERE oi.order_id = ?
    `, [id]);
    res.json({
      ...updated,
      items: updatedItems,
      warnings: warnings.length > 0 ? warnings : undefined,
      stock_deducted: true
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════
// POST /api/orders/:id/close — Fermer/terminer une commande (table payée)
// ═══════════════════════════════════════════
router.post('/:id/close', (req, res) => {
  const id = Number(req.params.id);
  const order = get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  if (order.status === 'annulé') {
    return res.status(400).json({ error: 'Commande déjà annulée' });
  }
  if (order.status === 'terminé') {
    return res.status(400).json({ error: 'Commande déjà terminée' });
  }

  run("UPDATE orders SET status = 'terminé', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

  // Mark all non-cancelled items as 'servi' if not already
  run("UPDATE order_items SET status = 'servi' WHERE order_id = ? AND status NOT IN ('annulé', 'servi')", [id]);

  const updated = get('SELECT * FROM orders WHERE id = ?', [id]);
  const items = all(`
    SELECT oi.*, r.name as recipe_name, r.selling_price
    FROM order_items oi
    JOIN recipes r ON r.id = oi.recipe_id
    WHERE oi.order_id = ?
  `, [id]);

  res.json({ ...updated, items });
});

// ═══════════════════════════════════════════
// DELETE /api/orders/:id — Annuler une commande
// Restaure le stock si la commande avait déjà été envoyée en cuisine
// ═══════════════════════════════════════════
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const stockRestored = [];

  const transaction = db.transaction(() => {
    // If order was already sent to kitchen, stock was deducted — restore it
    if (order.status === 'envoyé' || order.status === 'prêt' || order.status === 'servi') {
      const items = all('SELECT * FROM order_items WHERE order_id = ? AND status != ?', [id, 'annulé']);

      for (const item of items) {
        const flatIngredients = getFlatIngredients(item.recipe_id, item.quantity);

        for (const fi of flatIngredients) {
          // Restore stock (convert to stock unit)
          const stock = get('SELECT * FROM stock WHERE ingredient_id = ?', [fi.ingredient_id]);
          const stockUnit = stock ? stock.unit : fi.unit;
          const restoreQty = convertUnit(fi.quantity, fi.unit, stockUnit);

          if (stock) {
            run(
              'UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
              [restoreQty, fi.ingredient_id]
            );
          }

          // Record correction movement for traceability
          run(
            `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, recorded_at)
             VALUES (?, 'correction', ?, ?, ?, CURRENT_TIMESTAMP)`,
            [fi.ingredient_id, restoreQty, stockUnit, `Annulation commande #${id} - Table ${order.table_number}`]
          );

          const ingName = get('SELECT name FROM ingredients WHERE id = ?', [fi.ingredient_id]);
          stockRestored.push({
            ingredient_id: fi.ingredient_id,
            ingredient_name: ingName ? ingName.name : `#${fi.ingredient_id}`,
            quantity_restored: Math.round(restoreQty * 1000) / 1000,
            unit: stockUnit
          });
        }
      }
    }

    // Mark order and items as cancelled
    run("UPDATE orders SET status = 'annulé', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    run("UPDATE order_items SET status = 'annulé' WHERE order_id = ?", [id]);
  });

  try {
    transaction();
    res.json({
      success: true,
      cancelled: true,
      stock_restored: stockRestored.length > 0 ? stockRestored : undefined
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de l\'annulation', details: e.message });
  }
});

module.exports = router;
