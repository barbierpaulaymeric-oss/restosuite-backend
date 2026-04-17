const { Router } = require('express');
const { get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

router.post('/', (req, res) => {
  const rid = req.user.restaurant_id;
  const { ingredient_id, supplier_id, price, unit } = req.body;
  if (!ingredient_id || !supplier_id || price == null || !unit) {
    return res.status(400).json({ error: 'ingredient_id, supplier_id, price, unit required' });
  }

  run('INSERT INTO price_history (restaurant_id, ingredient_id, supplier_id, price) VALUES (?, ?, ?, ?)',
    [rid, ingredient_id, supplier_id, price]);

  // Check if exists for upsert
  const existing = get('SELECT id FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ? AND restaurant_id = ?',
    [ingredient_id, supplier_id, rid]);

  if (existing) {
    run('UPDATE supplier_prices SET price = ?, unit = ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND supplier_id = ? AND restaurant_id = ?',
      [price, unit, ingredient_id, supplier_id, rid]);
  } else {
    run('INSERT INTO supplier_prices (restaurant_id, ingredient_id, supplier_id, price, unit) VALUES (?, ?, ?, ?, ?)',
      [rid, ingredient_id, supplier_id, price, unit]);
  }

  const row = get(`
    SELECT sp.*, s.name as supplier_name, i.name as ingredient_name
    FROM supplier_prices sp
    JOIN suppliers s ON s.id = sp.supplier_id AND s.restaurant_id = ?
    JOIN ingredients i ON i.id = sp.ingredient_id AND i.restaurant_id = ?
    WHERE sp.ingredient_id = ? AND sp.supplier_id = ? AND sp.restaurant_id = ?
  `, [rid, rid, ingredient_id, supplier_id, rid]);

  res.status(201).json(row);
});

module.exports = router;
