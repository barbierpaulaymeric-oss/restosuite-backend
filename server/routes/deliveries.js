// ═══════════════════════════════════════════
// Deliveries — Restaurant-side delivery note management
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run, db } = require('../db');
const router = Router();

// ═══════════════════════════════════════════
// GET /api/deliveries/dlc-alerts — DLC < 3 days
// (must be before /:id to avoid conflict)
// ═══════════════════════════════════════════
router.get('/dlc-alerts', (req, res) => {
  const alerts = all(`
    SELECT dni.id, dni.product_name, dni.batch_number, dni.dlc, dni.quantity, dni.unit,
           dn.id as delivery_note_id, s.name as supplier_name,
           CAST(julianday(dni.dlc) - julianday('now') AS INTEGER) as days_remaining
    FROM delivery_note_items dni
    JOIN delivery_notes dn ON dn.id = dni.delivery_note_id
    JOIN suppliers s ON s.id = dn.supplier_id
    WHERE dni.status = 'accepted'
      AND dni.dlc IS NOT NULL
      AND julianday(dni.dlc) - julianday('now') <= 3
      AND julianday(dni.dlc) - julianday('now') >= 0
    ORDER BY dni.dlc ASC
  `);
  res.json(alerts);
});

// ═══════════════════════════════════════════
// GET /api/deliveries — List delivery notes
// ═══════════════════════════════════════════
router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT dn.*, s.name as supplier_name,
           (SELECT COUNT(*) FROM delivery_note_items WHERE delivery_note_id = dn.id) as item_count
    FROM delivery_notes dn
    JOIN suppliers s ON s.id = dn.supplier_id
  `;
  const params = [];
  if (status) {
    sql += ' WHERE dn.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY dn.created_at DESC';
  res.json(all(sql, params));
});

// ═══════════════════════════════════════════
// GET /api/deliveries/:id — Delivery note detail
// ═══════════════════════════════════════════
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const note = get(`
    SELECT dn.*, s.name as supplier_name, a.name as received_by_name
    FROM delivery_notes dn
    JOIN suppliers s ON s.id = dn.supplier_id
    LEFT JOIN accounts a ON a.id = dn.received_by
    WHERE dn.id = ?
  `, [id]);
  if (!note) return res.status(404).json({ error: 'Bon de livraison introuvable' });

  const items = all(`
    SELECT dni.*, i.name as ingredient_name, i.category as ingredient_category
    FROM delivery_note_items dni
    LEFT JOIN ingredients i ON i.id = dni.ingredient_id
    WHERE dni.delivery_note_id = ?
    ORDER BY dni.id
  `, [id]);

  res.json({ ...note, items });
});

// ═══════════════════════════════════════════
// PUT /api/deliveries/:id/receive — Receive a delivery
// ═══════════════════════════════════════════
router.put('/:id/receive', (req, res) => {
  const id = Number(req.params.id);
  const { items, reception_notes } = req.body;
  const account = req.headers['x-account-id'] ? Number(req.headers['x-account-id']) : null;

  const note = get('SELECT dn.*, s.name as supplier_name FROM delivery_notes dn JOIN suppliers s ON s.id = dn.supplier_id WHERE dn.id = ?', [id]);
  if (!note) return res.status(404).json({ error: 'Bon de livraison introuvable' });
  if (note.status === 'received') return res.status(400).json({ error: 'Ce bon a déjà été réceptionné' });

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Liste des items requise' });
  }

  const transaction = db.transaction(() => {
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const item of items) {
      const { id: itemId, status: itemStatus, temperature_measured, rejection_reason } = item;
      if (!itemId || !itemStatus) continue;

      const dbItem = get('SELECT * FROM delivery_note_items WHERE id = ? AND delivery_note_id = ?', [itemId, id]);
      if (!dbItem) continue;

      // Update item status
      run(
        'UPDATE delivery_note_items SET status = ?, temperature_measured = ?, rejection_reason = ? WHERE id = ?',
        [itemStatus, temperature_measured ?? null, rejection_reason || null, itemId]
      );

      if (itemStatus === 'accepted') {
        acceptedCount++;

        // 1. Create traceability log
        run(
          `INSERT INTO traceability_logs (product_name, supplier, batch_number, dlc, temperature_at_reception, quantity, unit, received_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dbItem.product_name, note.supplier_name, dbItem.batch_number || null, dbItem.dlc || null,
           temperature_measured ?? dbItem.temperature_required ?? null, dbItem.quantity, dbItem.unit, account, dbItem.notes || null]
        );

        // 2. Create stock_movement if ingredient_id exists
        if (dbItem.ingredient_id) {
          run(
            `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, supplier_id, batch_number, dlc, unit_price, recorded_by)
             VALUES (?, 'reception', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dbItem.ingredient_id, dbItem.quantity, dbItem.unit, 'Réception bon #' + id,
             note.supplier_id, dbItem.batch_number || null, dbItem.dlc || null, dbItem.price_per_unit || null, account]
          );

          // 3. Update stock
          const existing = get('SELECT * FROM stock WHERE ingredient_id = ?', [dbItem.ingredient_id]);
          if (existing) {
            run('UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
              [dbItem.quantity, dbItem.ingredient_id]);
          } else {
            run('INSERT INTO stock (ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, 0)',
              [dbItem.ingredient_id, dbItem.quantity, dbItem.unit]);
          }

          // 4. Update supplier_prices if price provided
          if (dbItem.price_per_unit) {
            const existingPrice = get('SELECT * FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ?',
              [dbItem.ingredient_id, note.supplier_id]);
            if (existingPrice) {
              run('UPDATE supplier_prices SET price = ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND supplier_id = ?',
                [dbItem.price_per_unit, dbItem.ingredient_id, note.supplier_id]);
            } else {
              run('INSERT INTO supplier_prices (ingredient_id, supplier_id, price, unit) VALUES (?, ?, ?, ?)',
                [dbItem.ingredient_id, note.supplier_id, dbItem.price_per_unit, dbItem.unit]);
            }
            // Price history
            run('INSERT INTO price_history (ingredient_id, supplier_id, price) VALUES (?, ?, ?)',
              [dbItem.ingredient_id, note.supplier_id, dbItem.price_per_unit]);
          }
        }
      } else if (itemStatus === 'rejected') {
        rejectedCount++;
      }
    }

    // Determine overall status
    const totalItems = items.length;
    let overallStatus = 'received';
    if (rejectedCount === totalItems) overallStatus = 'rejected';
    else if (rejectedCount > 0 && acceptedCount > 0) overallStatus = 'partial';

    run(
      'UPDATE delivery_notes SET status = ?, received_at = CURRENT_TIMESTAMP, received_by = ?, reception_notes = ? WHERE id = ?',
      [overallStatus, account, reception_notes || null, id]
    );

    return { status: overallStatus, accepted: acceptedCount, rejected: rejectedCount };
  });

  try {
    const result = transaction();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
