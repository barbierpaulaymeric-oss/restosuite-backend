// ═══════════════════════════════════════════
// Recall Procedures — Retrait/Rappel Produits
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

const VALID_REASONS    = ['sanitaire', 'qualite', 'etiquetage', 'autre'];
const VALID_SOURCES    = ['DGAL', 'fournisseur', 'interne', 'client'];
const VALID_SEVERITIES = ['critique', 'majeur', 'mineur'];
// Workflow: alerte → investigation → decision → execution → cloture
// Legacy 'en_cours' kept as an alias for back-compat with existing rows.
const VALID_STATUSES   = ['alerte', 'investigation', 'decision', 'execution', 'en_cours', 'cloture'];

// Workflow: which transitions are allowed from a given status.
const WORKFLOW = {
  alerte:        ['investigation', 'cloture'],
  investigation: ['decision', 'cloture'],
  decision:      ['execution', 'cloture'],
  execution:     ['cloture'],
  en_cours:      ['investigation', 'decision', 'execution', 'cloture'], // legacy
  cloture:       [], // terminal
};

// GET /api/recall — all procedures (newest first)
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(`
      SELECT r.*, s.name as supplier_name
      FROM recall_procedures r
      LEFT JOIN suppliers s ON s.id = r.supplier_id AND s.restaurant_id = ?
      WHERE r.restaurant_id = ?
      ORDER BY r.alert_date DESC
    `, [rid, rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/recall/active — open procedures only
router.get('/active', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(`
      SELECT r.*, s.name as supplier_name
      FROM recall_procedures r
      LEFT JOIN suppliers s ON s.id = r.supplier_id AND s.restaurant_id = ?
      WHERE r.restaurant_id = ? AND r.status IN ('alerte', 'en_cours')
      ORDER BY
        CASE r.severity WHEN 'critique' THEN 0 WHEN 'majeur' THEN 1 ELSE 2 END,
        r.alert_date DESC
    `, [rid, rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/recall — create a new procedure
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      product_name, lot_number, reason, alert_date, alert_source,
      severity, actions_taken, quantity_affected, quantity_unit, supplier_id,
    } = req.body;

    if (!product_name) return res.status(400).json({ error: 'product_name est requis' });
    if (reason && !VALID_REASONS.includes(reason))
      return res.status(400).json({ error: 'reason invalide' });
    if (alert_source && !VALID_SOURCES.includes(alert_source))
      return res.status(400).json({ error: 'alert_source invalide' });
    if (severity && !VALID_SEVERITIES.includes(severity))
      return res.status(400).json({ error: 'severity invalide' });

    const callerId = req.account ? req.account.id : null;

    const info = run(
      `INSERT INTO recall_procedures
       (restaurant_id, product_name, lot_number, reason, alert_date, alert_source, severity, status,
        actions_taken, quantity_affected, quantity_unit, supplier_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'alerte', ?, ?, ?, ?, ?)`,
      [
        rid,
        product_name.trim(),
        lot_number || null,
        reason || 'sanitaire',
        alert_date || new Date().toISOString(),
        alert_source || 'interne',
        severity || 'majeur',
        actions_taken || null,
        quantity_affected || null,
        quantity_unit || 'kg',
        supplier_id || null,
        callerId,
      ]
    );
    const created = get('SELECT * FROM recall_procedures WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'recall_procedures', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/recall/:id — update (including workflow transitions + closure)
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM recall_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Procédure introuvable' });

    const {
      product_name, lot_number, reason, alert_source, severity,
      status, actions_taken, quantity_affected, quantity_unit,
      supplier_id, notification_sent, closure_date, closure_notes,
    } = req.body;

    if (status && !VALID_STATUSES.includes(status))
      return res.status(400).json({ error: 'status invalide' });

    const newStatus = status !== undefined ? status : existing.status;
    // Enforce workflow transitions when status changes.
    if (status !== undefined && status !== existing.status) {
      const allowed = WORKFLOW[existing.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Transition interdite : ${existing.status} → ${status}. Étapes possibles : ${allowed.join(', ') || 'aucune (état terminal)'}`
        });
      }
    }
    const isClosed  = newStatus === 'cloture';

    run(
      `UPDATE recall_procedures SET
        product_name     = ?,
        lot_number       = ?,
        reason           = ?,
        alert_source     = ?,
        severity         = ?,
        status           = ?,
        actions_taken    = ?,
        quantity_affected = ?,
        quantity_unit    = ?,
        supplier_id      = ?,
        notification_sent = ?,
        closure_date     = ?,
        closure_notes    = ?,
        updated_at       = CURRENT_TIMESTAMP
       WHERE id = ? AND restaurant_id = ?`,
      [
        product_name  !== undefined ? product_name.trim()   : existing.product_name,
        lot_number    !== undefined ? lot_number             : existing.lot_number,
        reason        !== undefined ? reason                 : existing.reason,
        alert_source  !== undefined ? alert_source           : existing.alert_source,
        severity      !== undefined ? severity               : existing.severity,
        newStatus,
        actions_taken !== undefined ? actions_taken          : existing.actions_taken,
        quantity_affected !== undefined ? quantity_affected  : existing.quantity_affected,
        quantity_unit !== undefined ? quantity_unit          : existing.quantity_unit,
        supplier_id   !== undefined ? (supplier_id || null)  : existing.supplier_id,
        notification_sent !== undefined ? (notification_sent ? 1 : 0) : existing.notification_sent,
        isClosed ? (closure_date || new Date().toISOString()) : existing.closure_date,
        closure_notes !== undefined ? closure_notes          : existing.closure_notes,
        id,
        rid,
      ]
    );
    const updated = get('SELECT * FROM recall_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'recall_procedures', record_id: id, action: 'update', old_values: existing, new_values: updated });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/recall/:id/batch-trace — find every place a recalled batch was used.
// Returns deliveries + recipes + downstream traceability rows that mention this lot.
// Tenant-scoped: never crosses to another restaurant.
router.get('/:id/batch-trace', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const recall = get('SELECT * FROM recall_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!recall) return res.status(404).json({ error: 'Procédure introuvable' });

    const lot = recall.lot_number || '';
    const productNeedle = `%${(recall.product_name || '').toLowerCase()}%`;

    // 1. Inbound deliveries that mention this lot
    let deliveries = [];
    try {
      deliveries = all(
        `SELECT id, supplier_id, delivery_date, lot_number, product_label
         FROM delivery_note_items
         WHERE restaurant_id = ? AND (lot_number = ? OR LOWER(product_label) LIKE ?)
         ORDER BY delivery_date DESC LIMIT 100`,
        [rid, lot, productNeedle]
      );
    } catch {}

    // 2. Traceability log rows for this lot
    let traceability = [];
    try {
      traceability = all(
        `SELECT id, product_name, lot_number, supplier, received_at, dlc, quantity, unit
         FROM traceability_logs
         WHERE restaurant_id = ? AND (lot_number = ? OR LOWER(product_name) LIKE ?)
         ORDER BY received_at DESC LIMIT 100`,
        [rid, lot, productNeedle]
      );
    } catch {}

    // 3. Downstream traceability — to whom was the affected batch served / sold
    let downstream = [];
    try {
      downstream = all(
        `SELECT id, product_name, lot_number, served_at, customer_reference, quantity, notes
         FROM downstream_traceability
         WHERE restaurant_id = ? AND (lot_number = ? OR LOWER(product_name) LIKE ?)
         ORDER BY served_at DESC LIMIT 100`,
        [rid, lot, productNeedle]
      );
    } catch {}

    res.json({
      recall: { id: recall.id, product_name: recall.product_name, lot_number: recall.lot_number, status: recall.status },
      deliveries,
      traceability,
      downstream,
      counts: { deliveries: deliveries.length, traceability: traceability.length, downstream: downstream.length }
    });
  } catch (e) {
    console.error('batch-trace error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/recall/:id
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM recall_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Procédure introuvable' });
    run('DELETE FROM recall_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'recall_procedures', record_id: id, action: 'delete', old_values: existing, new_values: null });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
