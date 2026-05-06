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
  const supplierId = Number(req.params.id);

  // Ingredient-mapped prices (supplier_prices ⨝ ingredients). These rows have
  // an ingredient_id and are used by analytics, suggestions, food-cost.
  const priced = all(`
    SELECT sp.id, sp.ingredient_id, sp.supplier_id, sp.price, sp.unit, sp.last_updated, sp.restaurant_id,
           i.name as ingredient_name, i.name as product_name,
           NULL as catalog_id
    FROM supplier_prices sp
    JOIN ingredients i ON i.id = sp.ingredient_id AND i.restaurant_id = ?
    WHERE sp.supplier_id = ? AND sp.restaurant_id = ?
    ORDER BY i.name
  `, [rid, supplierId, rid]);

  // Catalog-only products (mercuriale entries with no local ingredient mapping
  // OR whose ingredient is already covered by supplier_prices). We surface
  // catalog rows whose ingredient_id is NULL or which are NOT yet in
  // supplier_prices for this supplier — so newly-imported "Nouveau produit"
  // items become orderable immediately.
  const catalog = all(`
    SELECT sc.id as catalog_id, sc.ingredient_id, sc.supplier_id, sc.price, sc.unit,
           sc.updated_at as last_updated, sc.restaurant_id,
           sc.product_name as ingredient_name, sc.product_name, sc.category, sc.sku
    FROM supplier_catalog sc
    WHERE sc.supplier_id = ? AND sc.restaurant_id = ?
      AND COALESCE(sc.available, 1) != 0
      AND (
        sc.ingredient_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM supplier_prices sp
          WHERE sp.supplier_id = sc.supplier_id
            AND sp.restaurant_id = sc.restaurant_id
            AND sp.ingredient_id = sc.ingredient_id
        )
      )
    ORDER BY sc.product_name
  `, [supplierId, rid]);

  res.json([...priced, ...catalog]);
});

module.exports = router;
