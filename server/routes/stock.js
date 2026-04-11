const { Router } = require('express');
const { all, get, run, db } = require('../db');
const PDFDocument = require('pdfkit');
const { requireAuth } = require('./auth');
const { validate, stockReceptionValidation } = require('../middleware/validate');
const router = Router();

router.use(requireAuth);

// ═══════════════════════════════════════════
// GET /api/stock — Stock actuel avec alertes
// ═══════════════════════════════════════════
router.get('/', (req, res) => {
  const { q, limit: limStr, offset: offsetStr } = req.query;
  const limit = Math.min(parseInt(limStr) || 50, 200);
  const offset = Math.max(parseInt(offsetStr) || 0, 0);

  let baseSql = `
    SELECT s.*, i.name as ingredient_name, i.category, i.default_unit,
           CASE WHEN s.quantity <= s.min_quantity AND s.min_quantity > 0 THEN 1 ELSE 0 END as is_alert,
           sup.name as supplier_name
    FROM stock s
    JOIN ingredients i ON i.id = s.ingredient_id
    LEFT JOIN suppliers sup ON sup.id = COALESCE(
      i.preferred_supplier_id,
      (SELECT sp.supplier_id FROM supplier_prices sp WHERE sp.ingredient_id = i.id ORDER BY sp.last_updated DESC LIMIT 1)
    )
  `;
  const params = [];
  if (q) {
    baseSql += ' WHERE i.name LIKE ?';
    params.push(`%${q}%`);
  }

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM stock s JOIN ingredients i ON i.id = s.ingredient_id';
  const countParams = [];
  if (q) {
    countSql += ' WHERE i.name LIKE ?';
    countParams.push(`%${q}%`);
  }
  const countResult = get(countSql, countParams);
  const total = countResult ? countResult.total : 0;

  let sql = baseSql + ' ORDER BY is_alert DESC, i.category, i.name LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const items = all(sql, params);
  const productCount = get('SELECT COUNT(*) as count FROM stock WHERE quantity > 0');

  res.json({ items, total, limit, offset, product_count: productCount ? productCount.count : 0 });
});

// ═══════════════════════════════════════════
// GET /api/stock/alerts — Ingrédients sous le seuil
// ═══════════════════════════════════════════
router.get('/alerts', (req, res) => {
  const alerts = all(`
    SELECT s.*, i.name as ingredient_name, i.category
    FROM stock s
    JOIN ingredients i ON i.id = s.ingredient_id
    WHERE s.quantity <= s.min_quantity AND s.min_quantity > 0
    ORDER BY (s.quantity / s.min_quantity) ASC
  `);
  res.json(alerts);
});

// ═══════════════════════════════════════════
// POST /api/stock/reception — Réception marchandise
// ═══════════════════════════════════════════
router.post('/reception', validate(stockReceptionValidation), (req, res) => {
  try {
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

        const ingredient = get('SELECT * FROM ingredients WHERE id = ?', [ingredient_id]);
        if (!ingredient) throw new Error(`Ingrédient #${ingredient_id} introuvable`);

      // 1. Enregistrer le mouvement
      const mvInfo = run(
        `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, supplier_id, batch_number, dlc, unit_price, recorded_by)
         VALUES (?, 'reception', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ingredient_id, quantity, unit, notes || null, supplier_id || null, batch_number || null, dlc || null, unit_price || null, recorded_by || null]
      );

      // 2. Mettre à jour le stock actuel
      const existing = get('SELECT * FROM stock WHERE ingredient_id = ?', [ingredient_id]);
      if (existing) {
        run(
          'UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
          [quantity, ingredient_id]
        );
      } else {
        run(
          'INSERT INTO stock (ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, 0)',
          [ingredient_id, quantity, unit]
        );
      }

      // 3. Créer une entrée HACCP traçabilité automatiquement
      const supplier = supplier_id ? get('SELECT name FROM suppliers WHERE id = ?', [supplier_id]) : null;
      run(
        `INSERT INTO traceability_logs (product_name, supplier, batch_number, dlc, temperature_at_reception, quantity, unit, received_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ingredient.name, supplier ? supplier.name : null, batch_number || null, dlc || null, temperature ?? null, quantity, unit, recorded_by || null, notes || null]
      );

      // 4. Track price history for mercuriale
      if (unit_price && unit_price > 0) {
        run(
          `INSERT INTO price_history (ingredient_id, supplier_id, price, recorded_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [ingredient_id, supplier_id || null, unit_price]
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
    const { ingredient_id, quantity, unit, reason, recorded_by } = req.body;

    if (!ingredient_id || !quantity || !unit) {
      return res.status(400).json({ error: 'ingredient_id, quantity et unit sont requis' });
    }

    // Validate quantity is positive
    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ?', [ingredient_id]);
    if (!existing) return res.status(404).json({ error: 'Cet ingrédient n\'est pas en stock' });

    run(
      `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, recorded_by)
       VALUES (?, 'loss', ?, ?, ?, ?)`,
      [ingredient_id, quantity, unit, reason || 'Perte / casse', recorded_by || null]
    );

    run(
      'UPDATE stock SET quantity = MAX(0, quantity - ?), last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
      [quantity, ingredient_id]
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
    const { ingredient_id, quantity, unit, reason, recorded_by } = req.body;

    if (!ingredient_id || quantity == null || !unit) {
      return res.status(400).json({ error: 'ingredient_id, quantity et unit sont requis' });
    }

    // Validate quantity is a number
    if (typeof quantity !== 'number') {
      return res.status(400).json({ error: 'quantity must be a number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ?', [ingredient_id]);

    // quantity here is the adjustment delta (+/-)
    run(
      `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, recorded_by)
       VALUES (?, 'adjustment', ?, ?, ?, ?)`,
      [ingredient_id, quantity, unit, reason || 'Ajustement inventaire', recorded_by || null]
    );

    if (existing) {
      run(
        'UPDATE stock SET quantity = MAX(0, quantity + ?), last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
        [quantity, ingredient_id]
      );
    } else {
      run(
        'INSERT INTO stock (ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, 0)',
        [ingredient_id, Math.max(0, quantity), unit]
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
    const { ingredient_id, new_quantity, unit, recorded_by } = req.body;

    if (!ingredient_id || new_quantity == null || !unit) {
      return res.status(400).json({ error: 'ingredient_id, new_quantity et unit sont requis' });
    }

    // Validate new_quantity is non-negative
    if (typeof new_quantity !== 'number' || new_quantity < 0) {
      return res.status(400).json({ error: 'new_quantity must be a non-negative number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ?', [ingredient_id]);
    const oldQty = existing ? existing.quantity : 0;
    const delta = new_quantity - oldQty;

    run(
      `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, recorded_by)
       VALUES (?, 'inventory', ?, ?, ?, ?)`,
      [ingredient_id, delta, unit, `Inventaire : ${oldQty} → ${new_quantity}`, recorded_by || null]
    );

    if (existing) {
      run(
        'UPDATE stock SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
        [new_quantity, ingredient_id]
      );
    } else {
      run(
        'INSERT INTO stock (ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, 0)',
        [ingredient_id, new_quantity, unit]
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
  const { ingredient_id, type, from, to, limit: lim } = req.query;
  let sql = `
    SELECT sm.*, i.name as ingredient_name, i.category,
           s2.name as supplier_name, a.name as recorded_by_name
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id
    LEFT JOIN suppliers s2 ON s2.id = sm.supplier_id
    LEFT JOIN accounts a ON a.id = sm.recorded_by
  `;
  const conditions = [];
  const params = [];

  if (ingredient_id) { conditions.push('sm.ingredient_id = ?'); params.push(Number(ingredient_id)); }
  if (type) { conditions.push('sm.movement_type = ?'); params.push(type); }
  if (from) { conditions.push("date(sm.recorded_at) >= date(?)"); params.push(from); }
  if (to) { conditions.push("date(sm.recorded_at) <= date(?)"); params.push(to); }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY sm.recorded_at DESC';
  sql += ` LIMIT ${parseInt(lim) || 200}`;

  res.json(all(sql, params));
});

// ═══════════════════════════════════════════
// GET /api/stock/export/pdf — Export PDF mouvements
// ═══════════════════════════════════════════
router.get('/export/pdf', (req, res) => {
  const { from, to } = req.query;
  let sql = `
    SELECT sm.*, i.name as ingredient_name,
           s2.name as supplier_name, a.name as recorded_by_name
    FROM stock_movements sm
    JOIN ingredients i ON i.id = sm.ingredient_id
    LEFT JOIN suppliers s2 ON s2.id = sm.supplier_id
    LEFT JOIN accounts a ON a.id = sm.recorded_by
  `;
  const conditions = [];
  const params = [];
  if (from) { conditions.push("date(sm.recorded_at) >= date(?)"); params.push(from); }
  if (to) { conditions.push("date(sm.recorded_at) <= date(?)"); params.push(to); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY sm.recorded_at DESC';
  const movements = all(sql, params);

  const PAGE_W = 595.28;
  const MARGIN = 42;
  const CONTENT_W = PAGE_W - 2 * MARGIN;

  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="stock-mouvements-${from || 'all'}.pdf"`);
  doc.pipe(res);

  // Header
  let y = MARGIN;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1B2A4A');
  doc.text('RESTOSUITE — STOCK', MARGIN, y);
  y += 20;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
  doc.text('HISTORIQUE DES MOUVEMENTS DE STOCK', MARGIN, y);
  y += 16;
  doc.font('Helvetica').fontSize(9).fillColor('#666');
  const periodText = from && to ? `Période : ${from} au ${to}` : `Généré le ${new Date().toLocaleDateString('fr-FR')}`;
  doc.text(periodText, MARGIN, y);
  y += 6;
  doc.text(`Date d'export : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, MARGIN, y);
  y += 14;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(1).stroke('#1B2A4A');
  y += 12;

  // Table header
  const columns = [
    { label: 'Date', width: 75 },
    { label: 'Type', width: 70 },
    { label: 'Ingrédient', width: 110 },
    { label: 'Qté', width: 50, align: 'center' },
    { label: 'Fournisseur', width: 80 },
    { label: 'N° Lot', width: 55 },
    { label: 'Prix unit.', width: 50, align: 'right' },
    { label: 'Par', width: CONTENT_W - 490 },
  ];

  doc.rect(MARGIN, y, CONTENT_W, 18).fill('#E8E8E8').stroke('#CCC');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5);
  let x = MARGIN;
  for (const col of columns) {
    doc.text(col.label, x + 4, y + 5, { width: col.width - 8, align: col.align || 'left' });
    x += col.width;
  }
  y += 18;

  const typeLabels = {
    reception: '📥 Réception',
    consumption: '📤 Consommation',
    loss: '❌ Perte',
    adjustment: '🔄 Ajustement',
    inventory: '📋 Inventaire'
  };

  doc.font('Helvetica').fontSize(7.5);
  for (const mv of movements) {
    if (y + 15 > 800) { doc.addPage(); y = MARGIN; }
    doc.fillColor('#000');
    x = MARGIN;
    const date = new Date(mv.recorded_at);
    doc.text(date.toLocaleDateString('fr-FR'), x + 4, y + 4, { width: columns[0].width - 8 });
    x += columns[0].width;
    doc.text(typeLabels[mv.movement_type] || mv.movement_type, x + 4, y + 4, { width: columns[1].width - 8 });
    x += columns[1].width;
    doc.text(mv.ingredient_name, x + 4, y + 4, { width: columns[2].width - 8 });
    x += columns[2].width;
    const sign = mv.movement_type === 'reception' || (mv.movement_type === 'adjustment' && mv.quantity > 0) ? '+' : '';
    doc.text(`${sign}${mv.quantity} ${mv.unit}`, x + 4, y + 4, { width: columns[3].width - 8, align: 'center' });
    x += columns[3].width;
    doc.text(mv.supplier_name || '—', x + 4, y + 4, { width: columns[4].width - 8 });
    x += columns[4].width;
    doc.text(mv.batch_number || '—', x + 4, y + 4, { width: columns[5].width - 8 });
    x += columns[5].width;
    doc.text(mv.unit_price != null ? mv.unit_price.toFixed(2) + '€' : '—', x + 4, y + 4, { width: columns[6].width - 8, align: 'right' });
    x += columns[6].width;
    doc.text(mv.recorded_by_name || '—', x + 4, y + 4, { width: columns[7].width - 8 });

    doc.moveTo(MARGIN, y + 15).lineTo(MARGIN + CONTENT_W, y + 15).lineWidth(0.25).stroke('#DDD');
    y += 15;
  }

  if (movements.length === 0) {
    doc.fillColor('#999').fontSize(9).text('Aucun mouvement sur cette période.', MARGIN, y + 10);
  }

  // Summary
  y += 20;
  if (y + 40 > 800) { doc.addPage(); y = MARGIN; }
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
  doc.text(`Total mouvements : ${movements.length}`, MARGIN, y);
  const receptions = movements.filter(m => m.movement_type === 'reception');
  const losses = movements.filter(m => m.movement_type === 'loss');
  doc.text(`Réceptions : ${receptions.length}  |  Pertes : ${losses.length}`, MARGIN, y + 14);

  doc.end();
});

// ═══════════════════════════════════════════
// PUT /api/stock/:ingredientId/min — Définir seuil minimum
// ═══════════════════════════════════════════
router.put('/:ingredientId/min', (req, res) => {
  try {
    const ingredientId = Number(req.params.ingredientId);
    const { min_quantity } = req.body;

    if (min_quantity == null) return res.status(400).json({ error: 'min_quantity est requis' });

    // Validate min_quantity is non-negative
    if (typeof min_quantity !== 'number' || min_quantity < 0) {
      return res.status(400).json({ error: 'min_quantity must be a non-negative number' });
    }

    const existing = get('SELECT * FROM stock WHERE ingredient_id = ?', [ingredientId]);
    if (existing) {
      run('UPDATE stock SET min_quantity = ? WHERE ingredient_id = ?', [min_quantity, ingredientId]);
    } else {
      const ingredient = get('SELECT * FROM ingredients WHERE id = ?', [ingredientId]);
      if (!ingredient) return res.status(404).json({ error: 'Ingrédient introuvable' });
      run(
        'INSERT INTO stock (ingredient_id, quantity, unit, min_quantity) VALUES (?, 0, ?, ?)',
        [ingredientId, ingredient.default_unit || 'kg', min_quantity]
      );
    }

    res.json({ success: true, ingredient_id: ingredientId, min_quantity });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
