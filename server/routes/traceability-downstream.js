// ═══════════════════════════════════════════
// Traçabilité aval — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

const VALID_DESTINATION_TYPES = ['salle', 'livraison', 'traiteur', 'autre'];

// ─── Search by batch number (must be before /:id routes) ───

// GET /api/traceability/downstream/search?batch=X
router.get('/downstream/search', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { batch } = req.query;
    if (!batch) return res.status(400).json({ error: 'batch est requis' });
    const items = all(
      `SELECT * FROM downstream_traceability WHERE batch_number LIKE ? AND restaurant_id = ? ORDER BY dispatch_date DESC, id DESC`,
      [`%${batch}%`, rid]
    );
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── List / Create ───

// GET /api/traceability/downstream — list all, newest first; supports ?batch=, ?product=, ?date=
router.get('/downstream', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { batch, product, date } = req.query;
    let sql = 'SELECT * FROM downstream_traceability WHERE restaurant_id = ?';
    const params = [rid];
    if (batch) {
      sql += ' AND batch_number LIKE ?';
      params.push(`%${batch}%`);
    }
    if (product) {
      sql += ' AND product_name LIKE ?';
      params.push(`%${product}%`);
    }
    if (date) {
      sql += ' AND dispatch_date = ?';
      params.push(date);
    }
    sql += ' ORDER BY dispatch_date DESC, id DESC';
    const items = all(sql, params);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/traceability/downstream — create entry
router.post('/downstream', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      product_name, batch_number, production_date,
      destination_type, destination_name,
      quantity, unit, dispatch_date, dispatch_time,
      temperature_at_dispatch, responsible_person, notes,
    } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.status(400).json({ error: 'product_name est requis' });
    }
    if (destination_type && !VALID_DESTINATION_TYPES.includes(destination_type)) {
      return res.status(400).json({ error: 'destination_type invalide' });
    }

    const info = run(
      `INSERT INTO downstream_traceability
        (restaurant_id, product_name, batch_number, production_date, destination_type, destination_name,
         quantity, unit, dispatch_date, dispatch_time, temperature_at_dispatch, responsible_person, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        product_name.trim(),
        batch_number || null,
        production_date || null,
        destination_type || null,
        destination_name || null,
        quantity != null ? parseFloat(quantity) : null,
        unit || 'kg',
        dispatch_date || null,
        dispatch_time || null,
        temperature_at_dispatch != null ? parseFloat(temperature_at_dispatch) : null,
        responsible_person || null,
        notes || null,
      ]
    );
    const item = get('SELECT * FROM downstream_traceability WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Single entry ───

// PUT /api/traceability/downstream/:id — update entry
router.put('/downstream/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { id } = req.params;
    const existing = get('SELECT * FROM downstream_traceability WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Entrée introuvable' });

    const {
      product_name, batch_number, production_date,
      destination_type, destination_name,
      quantity, unit, dispatch_date, dispatch_time,
      temperature_at_dispatch, responsible_person, notes,
    } = req.body;

    if (product_name !== undefined && (!product_name || !product_name.trim())) {
      return res.status(400).json({ error: 'product_name ne peut pas être vide' });
    }
    if (destination_type && !VALID_DESTINATION_TYPES.includes(destination_type)) {
      return res.status(400).json({ error: 'destination_type invalide' });
    }

    run(
      `UPDATE downstream_traceability SET
        product_name = ?,
        batch_number = ?,
        production_date = ?,
        destination_type = ?,
        destination_name = ?,
        quantity = ?,
        unit = ?,
        dispatch_date = ?,
        dispatch_time = ?,
        temperature_at_dispatch = ?,
        responsible_person = ?,
        notes = ?
       WHERE id = ? AND restaurant_id = ?`,
      [
        product_name !== undefined ? product_name.trim() : existing.product_name,
        batch_number !== undefined ? (batch_number || null) : existing.batch_number,
        production_date !== undefined ? (production_date || null) : existing.production_date,
        destination_type !== undefined ? (destination_type || null) : existing.destination_type,
        destination_name !== undefined ? (destination_name || null) : existing.destination_name,
        quantity !== undefined ? (quantity != null ? parseFloat(quantity) : null) : existing.quantity,
        unit !== undefined ? (unit || 'kg') : existing.unit,
        dispatch_date !== undefined ? (dispatch_date || null) : existing.dispatch_date,
        dispatch_time !== undefined ? (dispatch_time || null) : existing.dispatch_time,
        temperature_at_dispatch !== undefined
          ? (temperature_at_dispatch != null ? parseFloat(temperature_at_dispatch) : null)
          : existing.temperature_at_dispatch,
        responsible_person !== undefined ? (responsible_person || null) : existing.responsible_person,
        notes !== undefined ? (notes || null) : existing.notes,
        id,
        rid,
      ]
    );
    // Note: UPDATE WHERE id only is safe because existence was checked with restaurant_id above.
    const updated = get('SELECT * FROM downstream_traceability WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/traceability/downstream/:id — delete entry
router.delete('/downstream/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { id } = req.params;
    const existing = get('SELECT id FROM downstream_traceability WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Entrée introuvable' });
    run('DELETE FROM downstream_traceability WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
