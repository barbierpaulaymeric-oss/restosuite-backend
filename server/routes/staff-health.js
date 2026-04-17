// ═══════════════════════════════════════════
// Santé du personnel — Routes API
// Arrêté 21/12/2009 art. 3.3 + CE 852/2004 Chap. VIII
// GET/POST/PUT/DELETE /api/sanitary/staff-health
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

const VALID_TYPES = ['aptitude', 'visite_medicale', 'maladie', 'blessure', 'formation_hygiene'];

// GET /api/sanitary/staff-health — list all records
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM staff_health_records WHERE restaurant_id = ? ORDER BY date_record DESC, created_at DESC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sanitary/staff-health/unfit — currently unfit staff (maladie/blessure without expiry or expiry in future)
router.get('/unfit', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(`
      SELECT * FROM staff_health_records
      WHERE restaurant_id = ?
        AND record_type IN ('maladie', 'blessure')
        AND (date_expiry IS NULL OR date_expiry >= DATE('now'))
      ORDER BY date_record DESC
    `, [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sanitary/staff-health/expiring — aptitudes/visites expiring within 90 days
router.get('/expiring', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(`
      SELECT * FROM staff_health_records
      WHERE restaurant_id = ?
        AND record_type IN ('aptitude', 'visite_medicale')
        AND date_expiry IS NOT NULL
        AND date_expiry <= DATE('now', '+90 days')
        AND date_expiry >= DATE('now')
      ORDER BY date_expiry ASC
    `, [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/sanitary/staff-health — create
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { account_id, staff_name, record_type, date_record, date_expiry, notes, document_path } = req.body;
    if (!staff_name) return res.status(400).json({ error: 'staff_name est requis' });
    if (!record_type) return res.status(400).json({ error: 'record_type est requis' });
    if (!VALID_TYPES.includes(record_type)) return res.status(400).json({ error: `record_type invalide. Valeurs : ${VALID_TYPES.join(', ')}` });
    if (!date_record) return res.status(400).json({ error: 'date_record est requis' });
    const info = run(
      `INSERT INTO staff_health_records
         (account_id, restaurant_id, staff_name, record_type, date_record, date_expiry, notes, document_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account_id || null,
        rid,
        staff_name,
        record_type,
        date_record,
        date_expiry || null,
        notes || null,
        document_path || null,
      ]
    );
    const created = get('SELECT * FROM staff_health_records WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'staff_health_records', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/sanitary/staff-health/:id — update
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM staff_health_records WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Enregistrement introuvable' });
    const { account_id, staff_name, record_type, date_record, date_expiry, notes, document_path } = req.body;
    if (record_type && !VALID_TYPES.includes(record_type)) {
      return res.status(400).json({ error: `record_type invalide. Valeurs : ${VALID_TYPES.join(', ')}` });
    }
    run(
      `UPDATE staff_health_records SET
        account_id=?, staff_name=?, record_type=?,
        date_record=?, date_expiry=?, notes=?, document_path=?,
        updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND restaurant_id=?`,
      [
        account_id !== undefined ? account_id : existing.account_id,
        staff_name || existing.staff_name,
        record_type || existing.record_type,
        date_record || existing.date_record,
        date_expiry !== undefined ? (date_expiry || null) : existing.date_expiry,
        notes !== undefined ? (notes || null) : existing.notes,
        document_path !== undefined ? (document_path || null) : existing.document_path,
        id,
        rid,
      ]
    );
    const updated = get('SELECT * FROM staff_health_records WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'staff_health_records', record_id: id, action: 'update', old_values: existing, new_values: updated });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/sanitary/staff-health/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM staff_health_records WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Enregistrement introuvable' });
    run('DELETE FROM staff_health_records WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'staff_health_records', record_id: id, action: 'delete', old_values: existing, new_values: null });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
