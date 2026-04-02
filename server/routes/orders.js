const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { getFlatIngredients } = require('./recipes');
const router = Router();

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
  const { table_number, items, notes } = req.body;
  if (!table_number) return res.status(400).json({ error: 'table_number requis' });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Au moins un item requis' });
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
      'INSERT INTO orders (table_number, notes, total_cost) VALUES (?, ?, ?)',
      [table_number, notes || null, Math.round(totalCost * 100) / 100]
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

  try {
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
    res.status(400).json({ error: e.message });
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

  // Auto-update order status: if all items are 'prêt', order becomes 'prêt'
  const allItems = all('SELECT status FROM order_items WHERE order_id = ?', [orderId]);
  const allReady = allItems.every(i => i.status === 'prêt' || i.status === 'servi' || i.status === 'annulé');
  if (allReady && allItems.some(i => i.status === 'prêt')) {
    run("UPDATE orders SET status = 'prêt', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [orderId]);
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
  if (order.status !== 'en_cours') {
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

        if (currentQty < fi.quantity) {
          const ingName = get('SELECT name FROM ingredients WHERE id = ?', [fi.ingredient_id]);
          warnings.push({
            ingredient_id: fi.ingredient_id,
            ingredient_name: ingName ? ingName.name : `#${fi.ingredient_id}`,
            needed: Math.round(fi.quantity * 1000) / 1000,
            available: Math.round(currentQty * 1000) / 1000,
            unit: fi.unit
          });
        }

        // Record movement
        run(
          `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, recorded_at)
           VALUES (?, 'consumption', ?, ?, ?, CURRENT_TIMESTAMP)`,
          [fi.ingredient_id, fi.quantity, fi.unit, `Commande #${id} - Table ${order.table_number}`]
        );

        // Deduct from stock
        if (stock) {
          run(
            'UPDATE stock SET quantity = MAX(0, quantity - ?), last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
            [fi.quantity, fi.ingredient_id]
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
// DELETE /api/orders/:id — Annuler une commande
// ═══════════════════════════════════════════
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  run("UPDATE orders SET status = 'annulé', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
  run("UPDATE order_items SET status = 'annulé' WHERE order_id = ?", [id]);

  res.json({ success: true, cancelled: true });
});

module.exports = router;
