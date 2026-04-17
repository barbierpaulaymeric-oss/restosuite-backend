// ═══════════════════════════════════════════
// BPH Lutte contre les nuisibles — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

// GET /api/pest-control — list all
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM pest_control WHERE restaurant_id = ? ORDER BY visit_date DESC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pest-control — create
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { provider_name, contract_ref, visit_date, next_visit_date, findings, actions_taken, bait_stations_count, status, report_ref } = req.body;
    if (!visit_date) return res.status(400).json({ error: 'visit_date est requis' });
    const validStatuses = ['conforme', 'non-conforme', 'action-requise'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
    const info = run(
      `INSERT INTO pest_control (restaurant_id, provider_name, contract_ref, visit_date, next_visit_date, findings, actions_taken, bait_stations_count, status, report_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, provider_name || null, contract_ref || null, visit_date, next_visit_date || null,
       findings || null, actions_taken || null, bait_stations_count ? Number(bait_stations_count) : 0,
       status || 'conforme', report_ref || null]
    );
    const created = get('SELECT * FROM pest_control WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'pest_control', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/pest-control/:id — update
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM pest_control WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Visite introuvable' });
    const { provider_name, contract_ref, visit_date, next_visit_date, findings, actions_taken, bait_stations_count, status, report_ref } = req.body;
    run(
      `UPDATE pest_control SET
        provider_name=?, contract_ref=?, visit_date=?, next_visit_date=?, findings=?,
        actions_taken=?, bait_stations_count=?, status=?, report_ref=?
       WHERE id=? AND restaurant_id=?`,
      [
        provider_name !== undefined ? provider_name : existing.provider_name,
        contract_ref !== undefined ? contract_ref : existing.contract_ref,
        visit_date || existing.visit_date,
        next_visit_date !== undefined ? next_visit_date : existing.next_visit_date,
        findings !== undefined ? findings : existing.findings,
        actions_taken !== undefined ? actions_taken : existing.actions_taken,
        bait_stations_count !== undefined ? Number(bait_stations_count) : existing.bait_stations_count,
        status || existing.status,
        report_ref !== undefined ? report_ref : existing.report_ref,
        id,
        rid,
      ]
    );
    const updated = get('SELECT * FROM pest_control WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'pest_control', record_id: id, action: 'update', old_values: existing, new_values: updated });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/pest-control/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM pest_control WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Visite introuvable' });
    run('DELETE FROM pest_control WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'pest_control', record_id: id, action: 'delete', old_values: existing, new_values: null });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
