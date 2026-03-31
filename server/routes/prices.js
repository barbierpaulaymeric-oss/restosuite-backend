const { Router } = require('express');
const { get, run } = require('../db');
const router = Router();

router.post('/', (req, res) => {
  const { ingredient_id, supplier_id, price, unit } = req.body;
  if (!ingredient_id || !supplier_id || price == null || !unit) {
    return res.status(400).json({ error: 'ingredient_id, supplier_id, price, unit required' });
  }

  run('INSERT INTO price_history (ingredient_id, supplier_id, price) VALUES (?, ?, ?)',
    [ingredient_id, supplier_id, price]);

  // Check if exists for upsert
  const existing = get('SELECT id FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ?',
    [ingredient_id, supplier_id]);
  
  if (existing) {
    run('UPDATE supplier_prices SET price = ?, unit = ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND supplier_id = ?',
      [price, unit, ingredient_id, supplier_id]);
  } else {
    run('INSERT INTO supplier_prices (ingredient_id, supplier_id, price, unit) VALUES (?, ?, ?, ?)',
      [ingredient_id, supplier_id, price, unit]);
  }

  const row = get(`
    SELECT sp.*, s.name as supplier_name, i.name as ingredient_name
    FROM supplier_prices sp
    JOIN suppliers s ON s.id = sp.supplier_id
    JOIN ingredients i ON i.id = sp.ingredient_id
    WHERE sp.ingredient_id = ? AND sp.supplier_id = ?
  `, [ingredient_id, supplier_id]);

  res.status(201).json(row);
});

module.exports = router;
