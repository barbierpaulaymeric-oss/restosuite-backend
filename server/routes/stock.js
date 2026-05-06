const { Router } = require('express');
const { all, get, run, db } = require('../db');
const PDFDocument = require('pdfkit');
const { requireAuth } = require('./auth');
const { validate, stockReceptionValidation } = require('../middleware/validate');
const {
  BRAND, MARGIN: PDF_MARGIN, CONTENT_W: PDF_CONTENT_W,
  pdfBrandedHeader, pdfBrandedFooter, pdfBrandedTableHeader, pdfBrandedTableRow,
  checkPageBreak, STATUS_LABELS,
} = require('../lib/pdf-branding');
const router = Router();

router.use(requireAuth);

// ═══════════════════════════════════════════
// GET /api/stock — Stock actuel avec alertes
// ═══════════════════════════════════════════
router.get('/', (req, res) => {
  const rid = req.user.restaurant_id;
  const { q, limit: limStr, offset: offsetStr } = req.query;
  const limit = Math.min(parseInt(limStr) || 50, 200);
  const offset = Math.max(parseInt(offsetStr) || 0, 0);

  let baseSql = `
    SELECT s.*, i.name as ingredient_name, i.category, i.default_unit,
           CASE WHEN s.quantity <= s.min_quantity AND s.min_quantity > 0 THEN 1 ELSE 0 END as is_alert,
           sup.name as supplier_name
    FROM stock s
    JOIN ingredients i ON i.id = s.ingredient_id AND i.restaurant_id = ?
    LEFT JOIN suppliers sup ON sup.id = COALESCE(
      i.preferred_supplier_id,
      (SELECT sp.supplier_id FROM supplier_prices sp WHERE sp.ingredient_id = i.id AND sp.restaurant_id = ? ORDER BY sp.last_updated DESC LIMIT 1)
    ) AND sup.restaurant_id = ?
    WHERE s.restaurant_id = ?
  `;
  const params = [rid, rid, rid, rid];
  if (q) {
    baseSql += ' AND i.name LIKE ?';
    params.push(`%${q}%`);
  }

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM stock s JOIN ingredients i ON i.id = s.ingredient_id AND i.restaurant_id = ? WHERE s.restaurant_id = ?';
  const countParams = [rid, rid];
  if (q) {
    countSql += ' AND i.name LIKE ?';
    countParams.push(`%${q}%`);
  }
  const countResult = get(countSql, countParams);
  const total = countResult ? countResult.total : 0;

  let sql = baseSql + ' ORDER BY is_alert DESC, i.category, i.name LIMIT ? OFFSET ?';
  params.push(limit, offset);

  let items = all(sql, params);

  // Auto-seed stock from recipe ingredients when empty (first visit, no search)
  if (items.length === 0 && !q) {
    const recipeIngredients = all(
      `SELECT DISTINCT i.id, i.default_unit
       FROM recipe_ingredients ri
       JOIN recipes r ON r.id = ri.recipe_id AND r.restaurant_id = ?
       JOIN ingredients i ON i.id = ri.ingredient_id AND i.restaurant_id = ?`,
      [rid, rid]
    );
    if (recipeIngredients.length > 0) {
      const insertStmt = db.prepare(
        'INSERT OR IGNORE INTO stock (restaurant_id, ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, 0, ?, 0)'
      );
      for (const ing of recipeIngredients) {
        insertStmt.run(rid, ing.id, ing.default_unit || 'kg');
      }
      // Re-query after seeding
      items = all(sql, params);
    }
  }

  const productCount = get('SELECT COUNT(*) as count FROM stock WHERE quantity > 0 AND restaurant_id = ?', [rid]);

  res.json({ items, total, limit, offset, product_count: productCount ? productCount.count : 0 });
});

// ═══════════════════════════════════════════
// GET /api/stock/alerts — Ingrédients sous le seuil
// ═══════════════════════════════════════════
router.get('/alerts', (req, res) => {
  const rid = req.user.restaurant_id;
  const alerts = all(`
    SELECT s.*, i.name as ingredient_name, i.category
    FROM stock s
    JOIN ingredients i ON i.id = s.ingredient_id AND i.restaurant_id = ?
    WHERE s.restaurant_id = ? AND s.quantity <= s.min_quantity AND s.min_quantity > 0
    ORDER BY (s.quantity / s.min_quantity) ASC
  `, [rid, rid]);
  res.json(alerts);
});

// ═══════════════════════════════════════════
// POST /api/stock/reception — Réception marchandise
// ═══════════════════════════════════════════
router.post('/reception', validate(stockReceptionValidation), (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { lines, recorded_by } = req.body;
    // lines = [{ ingredient_id, quantity, unit, unit_price, supplier_id, batch_number, dlc, temperature, notes }]
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Au moins une ligne de réception est requise' });
    }

    // Validate all lines before transaction
    for (const line of lines) {
      const { ingredient_id, quantity, unit, unit_price } = line;
      if (!ingredient_id || !quantity || !unit) {
        return res.status(400).json({ error: 'ingredient_id, quantity et unit sont requis pour chaque ligne' });
      }
      if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: 'quantity must be a positive number' });
      }
      if (unit_price !== undefined && unit_price !== null) {
        if (typeof unit_price !== 'number' || unit_price < 0) {
          return res.status(400).json({ error: 'unit_price must be a non-negative number' });
        }
      }
    }

    const transaction = db.transaction(() => {
      const results = [];
      for (const line of lines) {
        const { ingredient_id, quantity, unit, unit_price, supplier_id, batch_number, dlc, temperature, notes } = line;

        const ingredient = get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredient_id, rid]);
        if (!ingredient) throw new Error(`Ingrédient #${ingredient_id} introuvable`);

      // 1. Enregistrer le mouvement
      const mvInfo = run(
        `INSERT INTO stock_movements (restaurant_id, ingredient_id, movement_type, quantity, unit, reason, supplier_id, batch_number, dlc, unit_price, recorded_by)
         VALUES (?, ?, 'reception', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rid, ingredient_id, quantity, unit, notes || null, supplier_id || null, batch_number || null, dlc || null, unit_price || null, recorded_by || null]
      );

      // 2. Mettre à jour le stock actuel
      const existing = get('SELECT * FROM stock WHERE ingredient_id = ? AND restaurant_id = ?', [ingredient_id, rid]);
      if (existing) {
        run(
          'UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND restaurant_id = ?',
          [quantity, ingredient_id, rid]
        );
      } else {
        run(
          'INSERT INTO stock (restaurant_id, ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, ?, 0)',
          [rid, ingredient_id, quantity, unit]
        );
      }

      // 3. Créer une entrée HACCP traçabilité automatiquement
      const supplier = supplier_id ? get('SELECT name FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplier_id, rid]) : null;
      run(
        `INSERT INTO traceability_logs (product_name, supplier, batch_number, dlc, temperature_at_reception, quantity, unit, received_by, notes, restaurant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ingredient.name, supplier ? supplier.name : null, batch_number || null, dlc || null, temperature ?? null, quantity, unit, recorded_by || null, notes || null, rid]
      );

      // 4. Track price history for mercuriale
      if (unit_price && unit_price > 0) {
        run(
          `INSERT INTO price_history (restaurant_id, ingredient_id, supplier_id, price, recorded_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [rid, ingredient_id, supplier_id || null, unit_price]
        );
      }

        results.push({ movement_id: mvInfo.lastInsertRowid, ingredient_id, quantity });
      }
      return results;
    });

    const results = transaction();
    res.status(201).json({ success: true, count: results.length, movements: results });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// POST /api/stock/loss — Perte / casse
// ═══════════════════════════════════════════
router.post('/loss', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { ingredient_id, quantity, unit, reason, recorded_by } = req.body;

    if (!ingredient_id || !quantity || !unit) {
      return res.status(400).json({ error: 'ingredient_id, quantity et unit sont requis' });
    }

    // Validate quantity is positive
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ? AND restaurant_id = ?', [ingredient_id, rid]);
    if (!existing) return res.status(404).json({ error: 'Cet ingrédient n\'est pas en stock' });

    run(
      `INSERT INTO stock_movements (restaurant_id, ingredient_id, movement_type, quantity, unit, reason, recorded_by)
       VALUES (?, ?, 'loss', ?, ?, ?, ?)`,
      [rid, ingredient_id, quantity, unit, reason || 'Perte / casse', recorded_by || null]
    );

    run(
      'UPDATE stock SET quantity = MAX(0, quantity - ?), last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND restaurant_id = ?',
      [quantity, ingredient_id, rid]
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// POST /api/stock/adjustment — Ajustement inventaire
// ═══════════════════════════════════════════
router.post('/adjustment', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { ingredient_id, quantity, unit, reason, recorded_by } = req.body;

    if (!ingredient_id || quantity == null || !unit) {
      return res.status(400).json({ error: 'ingredient_id, quantity et unit sont requis' });
    }

    // Validate quantity is a number
    if (typeof quantity !== 'number') {
      return res.status(400).json({ error: 'quantity must be a number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ? AND restaurant_id = ?', [ingredient_id, rid]);

    // quantity here is the adjustment delta (+/-)
    run(
      `INSERT INTO stock_movements (restaurant_id, ingredient_id, movement_type, quantity, unit, reason, recorded_by)
       VALUES (?, ?, 'adjustment', ?, ?, ?, ?)`,
      [rid, ingredient_id, quantity, unit, reason || 'Ajustement inventaire', recorded_by || null]
    );

    if (existing) {
      run(
        'UPDATE stock SET quantity = MAX(0, quantity + ?), last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND restaurant_id = ?',
        [quantity, ingredient_id, rid]
      );
    } else {
      run(
        'INSERT INTO stock (restaurant_id, ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, ?, 0)',
        [rid, ingredient_id, Math.max(0, quantity), unit]
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// POST /api/stock/inventory — Inventaire complet (reset)
// ═══════════════════════════════════════════
router.post('/inventory', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { ingredient_id, new_quantity, unit, recorded_by } = req.body;

    if (!ingredient_id || new_quantity == null || !unit) {
      return res.status(400).json({ error: 'ingredient_id, new_quantity et unit sont requis' });
    }

    // Validate new_quantity is non-negative
    if (typeof new_quantity !== 'number' || new_quantity < 0) {
      return res.status(400).json({ error: 'new_quantity must be a non-negative number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ? AND restaurant_id = ?', [ingredient_id, rid]);
    const oldQty = existing ? existing.quantity : 0;
    const delta = new_quantity - oldQty;

    run(
      `INSERT INTO stock_movements (restaurant_id, ingredient_id, movement_type, quantity, unit, reason, recorded_by)
       VALUES (?, ?, 'inventory', ?, ?, ?, ?)`,
      [rid, ingredient_id, delta, unit, `Inventaire : ${oldQty} → ${new_quantity}`, recorded_by || null]
    );

    if (existing) {
      run(
        'UPDATE stock SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND restaurant_id = ?',
        [new_quantity, ingredient_id, rid]
      );
    } else {
      run(
        'INSERT INTO stock (restaurant_id, ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, ?, 0)',
        [rid, ingredient_id, new_quantity, unit]
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// GET /api/stock/movements — Historique des mouvements
// ═══════════════════════════════════════════
router.get('/movements', (req, res) => {
  const rid = req.user.restaurant_id;
  const { ingredient_id, type, from, to, limit: lim } = req.query;
  let sql = `
    SELECT sm.*, i.name as ingredient_name, i.category,
           s2.name as supplier_name, a.name as recorded_by_name
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id AND i.restaurant_id = ?
    LEFT JOIN suppliers s2 ON s2.id = sm.supplier_id AND s2.restaurant_id = ?
    LEFT JOIN accounts a ON a.id = sm.recorded_by
    WHERE sm.restaurant_id = ?
  `;
  const conditions = [];
  const params = [rid, rid, rid];

  if (ingredient_id) { conditions.push('sm.ingredient_id = ?'); params.push(Number(ingredient_id)); }
  if (type) { conditions.push('sm.movement_type = ?'); params.push(type); }
  if (from) { conditions.push("date(sm.recorded_at) >= date(?)"); params.push(from); }
  if (to) { conditions.push("date(sm.recorded_at) <= date(?)"); params.push(to); }

  if (conditions.length) sql += ' AND ' + conditions.join(' AND ');
  sql += ' ORDER BY sm.recorded_at DESC';
  sql += ` LIMIT ${parseInt(lim) || 200}`;

  res.json(all(sql, params));
});

// ═══════════════════════════════════════════
// GET /api/stock/export/pdf — Export PDF mouvements
// ═══════════════════════════════════════════
router.get('/export/pdf', (req, res) => {
  const rid = req.user.restaurant_id;
  const { from, to } = req.query;
  let sql = `
    SELECT sm.*, i.name as ingredient_name,
           s2.name as supplier_name, a.name as recorded_by_name
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id AND i.restaurant_id = ?
    LEFT JOIN suppliers s2 ON s2.id = sm.supplier_id AND s2.restaurant_id = ?
    LEFT JOIN accounts a ON a.id = sm.recorded_by
    WHERE sm.restaurant_id = ?
  `;
  const conditions = [];
  const params = [rid, rid, rid];
  if (from) { conditions.push("date(sm.recorded_at) >= date(?)"); params.push(from); }
  if (to) { conditions.push("date(sm.recorded_at) <= date(?)"); params.push(to); }
  if (conditions.length) sql += ' AND ' + conditions.join(' AND ');
  sql += ' ORDER BY sm.recorded_at DESC';
  const movements = all(sql, params);

  const MARGIN = PDF_MARGIN;
  const CONTENT_W = PDF_CONTENT_W;

  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="stock-mouvements-${from || 'all'}.pdf"`);
  doc.pipe(res);

  let y = pdfBrandedHeader(doc, {
    title: 'Mouvements de stock',
    subtitle: 'Historique des entrées, sorties et pertes',
    period: from && to ? `Période : ${from} au ${to}` : null,
  });

  const columns = [
    { label: 'Date', width: 70 },
    { label: 'Type', width: 70 },
    { label: 'Ingrédient', width: 110 },
    { label: 'Qté', width: 60, align: 'right' },
    { label: 'Fournisseur', width: 80 },
    { label: 'N° Lot', width: 55 },
    { label: 'Prix unit.', width: 55, align: 'right' },
    { label: 'Par', width: CONTENT_W - 500 },
  ];
  y = pdfBrandedTableHeader(doc, y, columns);

  // Helvetica has no emoji glyphs (see feedback memory) — use plain labels
  const typeLabels = {
    reception: 'Réception',
    consumption: 'Consommation',
    loss: 'Perte',
    adjustment: 'Ajustement',
    inventory: 'Inventaire',
  };

  let i = 0;
  for (const mv of movements) {
    y = checkPageBreak(doc, y, 18);
    const sign = mv.movement_type === 'reception' || (mv.movement_type === 'adjustment' && mv.quantity > 0) ? '+' : '';
    const date = new Date(mv.recorded_at);
    y = pdfBrandedTableRow(doc, y, columns, [
      date.toLocaleDateString('fr-FR'),
      typeLabels[mv.movement_type] || mv.movement_type,
      mv.ingredient_name,
      `${sign}${mv.quantity} ${mv.unit || ''}`,
      mv.supplier_name || '—',
      mv.batch_number || '—',
      mv.unit_price != null ? Number(mv.unit_price).toFixed(2) + '€' : '—',
      mv.recorded_by_name || '—',
    ], i++, { alert: mv.movement_type === 'loss' });
  }

  if (movements.length === 0) {
    doc.fillColor(BRAND.MUTED).fontSize(9).text('Aucun mouvement sur cette période.', MARGIN, y + 10);
  }

  // Summary
  y += 20;
  y = checkPageBreak(doc, y, 40);
  doc.fillColor(BRAND.TEXT).font('Helvetica-Bold').fontSize(9);
  doc.text(`Total mouvements : ${movements.length}`, MARGIN, y);
  const receptions = movements.filter(m => m.movement_type === 'reception');
  const losses = movements.filter(m => m.movement_type === 'loss');
  doc.text(`Réceptions : ${receptions.length}  |  Pertes : ${losses.length}`, MARGIN, y + 14);

  pdfBrandedFooter(doc, { label: 'Mouvements de stock' });
  doc.end();
});

// ═══════════════════════════════════════════
// PUT /api/stock/:ingredientId/min — Définir seuil minimum
// ═══════════════════════════════════════════
router.put('/:ingredientId/min', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const ingredientId = Number(req.params.ingredientId);
    const { min_quantity } = req.body;

    if (min_quantity == null) return res.status(400).json({ error: 'min_quantity est requis' });

    // Validate min_quantity is non-negative
    if (typeof min_quantity !== 'number' || min_quantity < 0) {
      return res.status(400).json({ error: 'min_quantity must be a non-negative number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ? AND restaurant_id = ?', [ingredientId, rid]);
    if (existing) {
      run('UPDATE stock SET min_quantity = ? WHERE ingredient_id = ? AND restaurant_id = ?', [min_quantity, ingredientId, rid]);
    } else {
      const ingredient = get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredientId, rid]);
      if (!ingredient) return res.status(404).json({ error: 'Ingrédient introuvable' });
      run(
        'INSERT INTO stock (restaurant_id, ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, 0, ?, ?)',
        [rid, ingredientId, ingredient.default_unit || 'kg', min_quantity]
      );
    }

    res.json({ success: true, ingredient_id: ingredientId, min_quantity });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
