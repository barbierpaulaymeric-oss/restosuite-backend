'use strict';

// ═══════════════════════════════════════════
// HACCP — Étalonnage des thermomètres (DDPP requirement)
// Without calibration records, all temperature logs have no legal probative value.
// Routes: /api/haccp/thermometers, /api/haccp/calibrations
// ═══════════════════════════════════════════

const { Router } = require('express');
const { db, all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');

const router = Router();
router.use(requireAuth);

const VALID_TYPES = ['digital', 'analogique', 'infrarouge', 'sonde'];

function safeAudit(payload) {
  try { writeAudit(payload); }
  catch (e) { console.error('audit_log write failed:', e.message); }
}

// ─────────────────────────────────────────────
// THERMOMETERS — device inventory
// ─────────────────────────────────────────────

router.get('/thermometers', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(
      'SELECT * FROM thermometers WHERE restaurant_id = ? ORDER BY is_active DESC, name',
      [rid]
    );
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/thermometers/alerts', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    // Overdue: next_calibration_date <= today, or never calibrated
    const today = new Date().toISOString().slice(0, 10);
    const overdue = all(
      `SELECT * FROM thermometers
       WHERE restaurant_id = ? AND is_active = 1
         AND (next_calibration_date IS NULL OR date(next_calibration_date) <= date(?))
       ORDER BY next_calibration_date ASC NULLS FIRST, name`,
      [rid, today]
    );
    // Due soon: within 30 days
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const due_soon = all(
      `SELECT * FROM thermometers
       WHERE restaurant_id = ? AND is_active = 1
         AND next_calibration_date IS NOT NULL
         AND date(next_calibration_date) > date(?)
         AND date(next_calibration_date) <= date(?)
       ORDER BY next_calibration_date ASC`,
      [rid, today, in30]
    );
    res.json({ overdue, due_soon, total: overdue.length + due_soon.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/thermometers/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const thermo = get('SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!thermo) return res.status(404).json({ error: 'Thermomètre introuvable' });
    const history = all(
      `SELECT * FROM thermometer_calibrations
       WHERE restaurant_id = ? AND thermometer_id = ?
       ORDER BY calibration_date DESC`,
      [rid, String(id)]
    );
    res.json({ ...thermo, history });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/thermometers', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { name, serial_number, location, type, last_calibration_date, next_calibration_date, is_active } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name est obligatoire' });
    }
    const tType = type && VALID_TYPES.includes(type) ? type : 'digital';
    const info = run(
      `INSERT INTO thermometers
         (restaurant_id, name, serial_number, location, type,
          last_calibration_date, next_calibration_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        String(name).trim(),
        serial_number || null,
        location || null,
        tType,
        last_calibration_date || null,
        next_calibration_date || null,
        is_active === 0 ? 0 : 1,
      ]
    );
    const created = get('SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    safeAudit({
      restaurant_id: rid,
      account_id: req.user.id ?? null,
      table_name: 'thermometers',
      record_id: info.lastInsertRowid,
      action: 'create',
      old_values: null,
      new_values: created,
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/thermometers/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Thermomètre introuvable' });
    const { name, serial_number, location, type, last_calibration_date, next_calibration_date, is_active } = req.body;
    const tType = type && VALID_TYPES.includes(type) ? type : existing.type;
    run(
      `UPDATE thermometers
         SET name = ?, serial_number = ?, location = ?, type = ?,
             last_calibration_date = ?, next_calibration_date = ?, is_active = ?
       WHERE id = ? AND restaurant_id = ?`,
      [
        name ? String(name).trim() : existing.name,
        serial_number !== undefined ? serial_number : existing.serial_number,
        location !== undefined ? location : existing.location,
        tType,
        last_calibration_date !== undefined ? last_calibration_date : existing.last_calibration_date,
        next_calibration_date !== undefined ? next_calibration_date : existing.next_calibration_date,
        is_active === undefined ? existing.is_active : (is_active ? 1 : 0),
        id,
        rid,
      ]
    );
    const updated = get('SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    safeAudit({
      restaurant_id: rid,
      account_id: req.user.id ?? null,
      table_name: 'thermometers',
      record_id: id,
      action: 'update',
      old_values: existing,
      new_values: updated,
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/thermometers/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Thermomètre introuvable' });
    // Soft delete: deactivate rather than remove (preserve calibration history)
    run('UPDATE thermometers SET is_active = 0 WHERE id = ? AND restaurant_id = ?', [id, rid]);
    const updated = get('SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    safeAudit({
      restaurant_id: rid,
      account_id: req.user.id ?? null,
      table_name: 'thermometers',
      record_id: id,
      action: 'update',
      old_values: existing,
      new_values: updated,
    });
    res.json({ deleted: true, soft: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────
// CALIBRATIONS — event log (immutable in spirit)
// ─────────────────────────────────────────────

function computeDeviation(measured, reference) {
  if (typeof measured !== 'number' || typeof reference !== 'number') return null;
  return Math.round((measured - reference) * 100) / 100;
}

router.get('/calibrations', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { thermometer_id, from, to, limit = 100, offset = 0 } = req.query;
    let sql = `SELECT * FROM thermometer_calibrations WHERE restaurant_id = ?`;
    const params = [rid];
    if (thermometer_id) {
      sql += ' AND thermometer_id = ?';
      params.push(String(thermometer_id));
    }
    if (from) {
      sql += ' AND date(calibration_date) >= date(?)';
      params.push(from);
    }
    if (to) {
      sql += ' AND date(calibration_date) <= date(?)';
      params.push(to);
    }
    sql += ' ORDER BY calibration_date DESC, id DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Number(limit) || 100, 500), Math.max(Number(offset) || 0, 0));
    const items = all(sql, params);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/calibrations/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const row = get(
      'SELECT * FROM thermometer_calibrations WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    if (!row) return res.status(404).json({ error: 'Étalonnage introuvable' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/calibrations', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      thermometer_id,
      thermometer_name,
      thermometer_location,
      calibration_date,
      next_calibration_date,
      reference_temperature,
      measured_temperature,
      tolerance,
      corrective_action,
      calibrated_by,
      certificate_reference,
      notes,
    } = req.body;

    if (!thermometer_id || !String(thermometer_id).trim()) {
      return res.status(400).json({ error: 'thermometer_id est obligatoire' });
    }
    if (!calibration_date) {
      return res.status(400).json({ error: 'calibration_date est obligatoire' });
    }
    if (typeof reference_temperature !== 'number' || Number.isNaN(reference_temperature)) {
      return res.status(400).json({ error: 'reference_temperature est obligatoire (number)' });
    }
    if (typeof measured_temperature !== 'number' || Number.isNaN(measured_temperature)) {
      return res.status(400).json({ error: 'measured_temperature est obligatoire (number)' });
    }

    const tol = typeof tolerance === 'number' && tolerance >= 0 ? tolerance : 0.5;
    const deviation = computeDeviation(measured_temperature, reference_temperature);
    const isCompliant = Math.abs(deviation) <= tol ? 1 : 0;

    // Derive metadata from thermometer if it's a linked numeric id
    let tName = thermometer_name || null;
    let tLocation = thermometer_location || null;
    const numericId = Number(thermometer_id);
    if (Number.isInteger(numericId) && numericId > 0) {
      const th = get(
        'SELECT name, location FROM thermometers WHERE id = ? AND restaurant_id = ?',
        [numericId, rid]
      );
      if (th) {
        tName = tName || th.name;
        tLocation = tLocation || th.location;
      }
    }

    const info = run(
      `INSERT INTO thermometer_calibrations
         (restaurant_id, thermometer_id, thermometer_name, thermometer_location,
          calibration_date, next_calibration_date,
          reference_temperature, measured_temperature, deviation,
          is_compliant, tolerance, corrective_action, calibrated_by,
          certificate_reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        String(thermometer_id),
        tName,
        tLocation,
        calibration_date,
        next_calibration_date || null,
        reference_temperature,
        measured_temperature,
        deviation,
        isCompliant,
        tol,
        corrective_action || null,
        calibrated_by || null,
        certificate_reference || null,
        notes || null,
      ]
    );

    // Auto-update parent thermometer's last/next calibration if numeric id
    if (Number.isInteger(numericId) && numericId > 0) {
      const parent = get(
        'SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?',
        [numericId, rid]
      );
      if (parent) {
        run(
          `UPDATE thermometers
             SET last_calibration_date = ?, next_calibration_date = ?
           WHERE id = ? AND restaurant_id = ?`,
          [calibration_date, next_calibration_date || parent.next_calibration_date, numericId, rid]
        );
        const updatedParent = get(
          'SELECT * FROM thermometers WHERE id = ? AND restaurant_id = ?',
          [numericId, rid]
        );
        safeAudit({
          restaurant_id: rid,
          account_id: req.user.id ?? null,
          table_name: 'thermometers',
          record_id: numericId,
          action: 'update',
          old_values: parent,
          new_values: updatedParent,
        });
      }
    }

    const created = get(
      'SELECT * FROM thermometer_calibrations WHERE id = ? AND restaurant_id = ?',
      [info.lastInsertRowid, rid]
    );
    safeAudit({
      restaurant_id: rid,
      account_id: req.user.id ?? null,
      table_name: 'thermometer_calibrations',
      record_id: info.lastInsertRowid,
      action: 'create',
      old_values: null,
      new_values: created,
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/calibrations/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get(
      'SELECT * FROM thermometer_calibrations WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    if (!existing) return res.status(404).json({ error: 'Étalonnage introuvable' });

    const {
      thermometer_name,
      thermometer_location,
      calibration_date,
      next_calibration_date,
      reference_temperature,
      measured_temperature,
      tolerance,
      corrective_action,
      calibrated_by,
      certificate_reference,
      notes,
    } = req.body;

    const ref = typeof reference_temperature === 'number' ? reference_temperature : existing.reference_temperature;
    const meas = typeof measured_temperature === 'number' ? measured_temperature : existing.measured_temperature;
    const tol = typeof tolerance === 'number' && tolerance >= 0 ? tolerance : existing.tolerance;
    const deviation = computeDeviation(meas, ref);
    const isCompliant = Math.abs(deviation) <= tol ? 1 : 0;

    run(
      `UPDATE thermometer_calibrations SET
         thermometer_name = ?, thermometer_location = ?,
         calibration_date = ?, next_calibration_date = ?,
         reference_temperature = ?, measured_temperature = ?, deviation = ?,
         is_compliant = ?, tolerance = ?,
         corrective_action = ?, calibrated_by = ?,
         certificate_reference = ?, notes = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND restaurant_id = ?`,
      [
        thermometer_name !== undefined ? thermometer_name : existing.thermometer_name,
        thermometer_location !== undefined ? thermometer_location : existing.thermometer_location,
        calibration_date || existing.calibration_date,
        next_calibration_date !== undefined ? next_calibration_date : existing.next_calibration_date,
        ref,
        meas,
        deviation,
        isCompliant,
        tol,
        corrective_action !== undefined ? corrective_action : existing.corrective_action,
        calibrated_by !== undefined ? calibrated_by : existing.calibrated_by,
        certificate_reference !== undefined ? certificate_reference : existing.certificate_reference,
        notes !== undefined ? notes : existing.notes,
        id,
        rid,
      ]
    );
    const updated = get(
      'SELECT * FROM thermometer_calibrations WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    safeAudit({
      restaurant_id: rid,
      account_id: req.user.id ?? null,
      table_name: 'thermometer_calibrations',
      record_id: id,
      action: 'update',
      old_values: existing,
      new_values: updated,
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/calibrations/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get(
      'SELECT * FROM thermometer_calibrations WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    if (!existing) return res.status(404).json({ error: 'Étalonnage introuvable' });
    run(
      'DELETE FROM thermometer_calibrations WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    safeAudit({
      restaurant_id: rid,
      account_id: req.user.id ?? null,
      table_name: 'thermometer_calibrations',
      record_id: id,
      action: 'delete',
      old_values: existing,
      new_values: null,
    });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
