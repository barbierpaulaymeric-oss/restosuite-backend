const { Router } = require('express');
const { all, get, run } = require('../db');
const router = Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  const rows = q
    ? all('SELECT * FROM ingredients WHERE name LIKE ? ORDER BY name', [`%${q}%`])
    : all('SELECT * FROM ingredients ORDER BY name');
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, category, default_unit, waste_percent, allergens, price_per_unit, price_unit } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const normalized = name.trim().toLowerCase();
  const existing = get('SELECT * FROM ingredients WHERE name = ?', [normalized]);
  if (existing) return res.json(existing);
  const info = run(
    'INSERT INTO ingredients (name, category, default_unit, waste_percent, allergens, price_per_unit, price_unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [normalized, category || null, default_unit || 'g', waste_percent || 0, allergens || null, price_per_unit || 0, price_unit || 'kg']
  );
  res.status(201).json(get('SELECT * FROM ingredients WHERE id = ?', [info.lastInsertRowid]));
});

router.put('/:id', (req, res) => {
  const existing = get('SELECT * FROM ingredients WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { name, category, default_unit, waste_percent, allergens, price_per_unit, price_unit } = req.body;
  run(
    'UPDATE ingredients SET name = ?, category = ?, default_unit = ?, waste_percent = ?, allergens = ?, price_per_unit = ?, price_unit = ? WHERE id = ?',
    [
      name ? name.trim().toLowerCase() : existing.name,
      category !== undefined ? category : existing.category,
      default_unit || existing.default_unit,
      waste_percent !== undefined ? waste_percent : existing.waste_percent,
      allergens !== undefined ? allergens : existing.allergens,
      price_per_unit !== undefined ? price_per_unit : (existing.price_per_unit || 0),
      price_unit !== undefined ? price_unit : (existing.price_unit || 'kg'),
      Number(req.params.id)
    ]
  );
  res.json(get('SELECT * FROM ingredients WHERE id = ?', [Number(req.params.id)]));
});

router.delete('/:id', (req, res) => {
  const info = run('DELETE FROM ingredients WHERE id = ?', [Number(req.params.id)]);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

router.get('/:id/prices', (req, res) => {
  const rows = all(`
    SELECT sp.*, s.name as supplier_name, s.quality_rating
    FROM supplier_prices sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE sp.ingredient_id = ?
    ORDER BY (sp.price / s.quality_rating) ASC
  `, [Number(req.params.id)]);
  res.json(rows);
});

module.exports = router;
