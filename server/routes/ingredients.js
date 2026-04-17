const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { INCO_ALLERGENS } = require('./allergens');
const { validate, ingredientValidation } = require('../middleware/validate');
const router = Router();
router.use(requireAuth);

router.get('/export-csv', (req, res) => {
  const rid = req.user.restaurant_id;
  const rows = all('SELECT * FROM ingredients WHERE restaurant_id = ? ORDER BY name', [rid]);
  const header = 'nom;catégorie;unité;prix_unitaire;pourcentage_perte';
  const lines = rows.map(r =>
    `${r.name};${r.category || ''};${r.default_unit || 'g'};${r.price_per_unit || 0};${r.waste_percent || 0}`
  );
  const csv = [header, ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ingredients.csv"');
  res.send(csv);
});

router.get('/', (req, res) => {
  const rid = req.user.restaurant_id;
  const { q, limit: limStr, offset: offsetStr } = req.query;
  const limit = Math.min(parseInt(limStr) || 50, 200);
  const offset = Math.max(parseInt(offsetStr) || 0, 0);

  let sql = 'SELECT * FROM ingredients WHERE restaurant_id = ?';
  const params = [rid];
  if (q) {
    sql += ' AND name LIKE ?';
    params.push(`%${q}%`);
  }

  let countSql = 'SELECT COUNT(*) as total FROM ingredients WHERE restaurant_id = ?';
  const countParams = [rid];
  if (q) {
    countSql += ' AND name LIKE ?';
    countParams.push(`%${q}%`);
  }
  const countResult = get(countSql, countParams);
  const total = countResult ? countResult.total : 0;

  sql += ' ORDER BY name LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = all(sql, params);
  res.json({ ingredients: rows, total, limit, offset });
});

router.post('/', validate(ingredientValidation), (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { name, category, default_unit, waste_percent, allergens, price_per_unit, price_unit } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    if (waste_percent !== undefined && waste_percent !== null) {
      if (typeof waste_percent !== 'number' || waste_percent < 0 || waste_percent > 100) {
        return res.status(400).json({ error: 'waste_percent must be between 0 and 100' });
      }
    }

    if (price_per_unit !== undefined && price_per_unit !== null) {
      if (typeof price_per_unit !== 'number' || price_per_unit < 0) {
        return res.status(400).json({ error: 'price_per_unit must be a non-negative number' });
      }
    }

    const normalized = name.trim().toLowerCase();
    const existing = get('SELECT * FROM ingredients WHERE name = ? AND restaurant_id = ?', [normalized, rid]);
    if (existing) return res.json(existing);

    const info = run(
      'INSERT INTO ingredients (restaurant_id, name, category, default_unit, waste_percent, allergens, price_per_unit, price_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [rid, normalized, category || null, default_unit || 'g', waste_percent || 0, allergens || null, price_per_unit || 0, price_unit || 'kg']
    );
    res.status(201).json(get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'not found' });

    const { name, category, default_unit, waste_percent, allergens, price_per_unit, price_unit } = req.body;

    if (waste_percent !== undefined && waste_percent !== null) {
      if (typeof waste_percent !== 'number' || waste_percent < 0 || waste_percent > 100) {
        return res.status(400).json({ error: 'waste_percent must be between 0 and 100' });
      }
    }

    if (price_per_unit !== undefined && price_per_unit !== null) {
      if (typeof price_per_unit !== 'number' || price_per_unit < 0) {
        return res.status(400).json({ error: 'price_per_unit must be a non-negative number' });
      }
    }

    run(
      'UPDATE ingredients SET name = ?, category = ?, default_unit = ?, waste_percent = ?, allergens = ?, price_per_unit = ?, price_unit = ? WHERE id = ? AND restaurant_id = ?',
      [
        name ? name.trim().toLowerCase() : existing.name,
        category !== undefined ? category : existing.category,
        default_unit || existing.default_unit,
        waste_percent !== undefined ? waste_percent : existing.waste_percent,
        allergens !== undefined ? allergens : existing.allergens,
        price_per_unit !== undefined ? price_per_unit : (existing.price_per_unit || 0),
        price_unit !== undefined ? price_unit : (existing.price_unit || 'kg'),
        id,
        rid
      ]
    );
    res.json(get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [id, rid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const info = run('DELETE FROM ingredients WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
  if (info.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ deleted: true });
});

// PUT /api/ingredients/:id/allergens — Associer allergènes à un ingrédient (INCO)
router.put('/:id/allergens', requireAuth, (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const ingredient = get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!ingredient) return res.status(404).json({ error: 'Ingrédient non trouvé' });

    const { allergen_codes } = req.body;
    if (!Array.isArray(allergen_codes)) {
      return res.status(400).json({ error: 'allergen_codes must be an array' });
    }

    const validCodes = INCO_ALLERGENS.map(a => a.code);
    const invalid = allergen_codes.filter(c => !validCodes.includes(c));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Codes invalides: ${invalid.join(', ')}` });
    }

    const allergenNames = allergen_codes.map(code => INCO_ALLERGENS.find(x => x.code === code)?.name).filter(Boolean);
    const allergenText = allergenNames.length > 0 ? allergenNames.join(', ') : null;

    run('UPDATE ingredients SET allergens = ? WHERE id = ? AND restaurant_id = ?', [allergenText, id, rid]);
    res.json({ ingredient_id: id, allergens: allergenText, allergen_codes });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.get('/:id/prices', (req, res) => {
  const rid = req.user.restaurant_id;
  // Scope both ingredient and supplier_prices to caller tenant
  const rows = all(`
    SELECT sp.*, s.name as supplier_name, s.quality_rating
    FROM supplier_prices sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE sp.ingredient_id = ? AND sp.restaurant_id = ? AND s.restaurant_id = ?
    ORDER BY (sp.price / s.quality_rating) ASC
  `, [Number(req.params.id), rid, rid]);
  res.json(rows);
});

module.exports = router;
