const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rid = req.user.restaurant_id;
  res.json(all('SELECT * FROM suppliers WHERE restaurant_id = ? ORDER BY name', [rid]));
});

router.post('/', (req, res) => {
  const rid = req.user.restaurant_id;
  const { name, contact, phone, email, quality_rating, quality_notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = run(
    'INSERT INTO suppliers (restaurant_id, name, contact, phone, email, quality_rating, quality_notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [rid, name, contact || null, phone || null, email || null, quality_rating || 3, quality_notes || null]
  );
  res.status(201).json(get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]));
});

router.put('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const existing = get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { name, contact, phone, email, quality_rating, quality_notes } = req.body;
  run(
    'UPDATE suppliers SET name = ?, contact = ?, phone = ?, email = ?, quality_rating = ?, quality_notes = ? WHERE id = ? AND restaurant_id = ?',
    [
      name || existing.name,
      contact !== undefined ? contact : existing.contact,
      phone !== undefined ? phone : existing.phone,
      email !== undefined ? email : existing.email,
      quality_rating !== undefined ? quality_rating : existing.quality_rating,
      quality_notes !== undefined ? quality_notes : existing.quality_notes,
      Number(req.params.id),
      rid
    ]
  );
  res.json(get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]));
});

router.delete('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  // Clean up related data
  run('DELETE FROM supplier_prices WHERE supplier_id = ? AND restaurant_id = ?', [id, rid]);
  run('DELETE FROM price_change_notifications WHERE supplier_id = ? AND restaurant_id = ?', [id, rid]);
  run('DELETE FROM suppliers WHERE id = ? AND restaurant_id = ?', [id, rid]);
  res.json({ deleted: true });
});

router.get('/:id/prices', (req, res) => {
  const rid = req.user.restaurant_id;
  res.json(all(`
    SELECT sp.*, i.name as ingredient_name
    FROM supplier_prices sp
    JOIN ingredients i ON i.id = sp.ingredient_id AND i.restaurant_id = ?
    WHERE sp.supplier_id = ? AND sp.restaurant_id = ?
    ORDER BY i.name
  `, [rid, Number(req.params.id), rid]));
});

module.exports = router;
