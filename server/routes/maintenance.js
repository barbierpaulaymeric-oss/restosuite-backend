// ═══════════════════════════════════════════
// BPH Maintenance équipements — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

// GET /api/maintenance/overdue — MUST be before /:id
router.get('/overdue', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(
      `SELECT * FROM equipment_maintenance
       WHERE restaurant_id = ?
         AND next_maintenance_date < DATE('now')
         AND status != 'à_jour'
       ORDER BY next_maintenance_date ASC`,
      [rid]
    );
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/maintenance — list all
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM equipment_maintenance WHERE restaurant_id = ? ORDER BY next_maintenance_date ASC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/maintenance — create
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { equipment_name, equipment_type, location, last_maintenance_date, next_maintenance_date, maintenance_type, provider, cost, status, notes } = req.body;
    if (!equipment_name) return res.status(400).json({ error: 'equipment_name est requis' });
    const validTypes = ['froid', 'cuisson', 'ventilation', 'lavage', 'autre'];
    if (equipment_type && !validTypes.includes(equipment_type)) return res.status(400).json({ error: 'Type d\'équipement invalide' });
    const info = run(
      `INSERT INTO equipment_maintenance (restaurant_id, equipment_name, equipment_type, location, last_maintenance_date, next_maintenance_date, maintenance_type, provider, cost, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, equipment_name, equipment_type || 'autre', location || null,
       last_maintenance_date || null, next_maintenance_date || null,
       maintenance_type || 'préventive', provider || null,
       cost ? Number(cost) : null, status || 'planifié', notes || null]
    );
    const created = get('SELECT * FROM equipment_maintenance WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'equipment_maintenance', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/maintenance/:id — update
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM equipment_maintenance WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Équipement introuvable' });
    const { equipment_name, equipment_type, location, last_maintenance_date, next_maintenance_date, maintenance_type, provider, cost, status, notes } = req.body;
    run(
      `UPDATE equipment_maintenance SET
        equipment_name=?, equipment_type=?, location=?, last_maintenance_date=?,
        next_maintenance_date=?, maintenance_type=?, provider=?, cost=?, status=?, notes=?
       WHERE id=? AND restaurant_id=?`,
      [
        equipment_name || existing.equipment_name,
        equipment_type || existing.equipment_type,
        location !== undefined ? location : existing.location,
        last_maintenance_date !== undefined ? last_maintenance_date : existing.last_maintenance_date,
        next_maintenance_date !== undefined ? next_maintenance_date : existing.next_maintenance_date,
        maintenance_type || existing.maintenance_type,
        provider !== undefined ? provider : existing.provider,
        cost !== undefined ? (cost ? Number(cost) : null) : existing.cost,
        status || existing.status,
        notes !== undefined ? notes : existing.notes,
        id,
        rid,
      ]
    );
    const updated = get('SELECT * FROM equipment_maintenance WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'equipment_maintenance', record_id: id, action: 'update', old_values: existing, new_values: updated });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/maintenance/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM equipment_maintenance WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Équipement introuvable' });
    run('DELETE FROM equipment_maintenance WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'equipment_maintenance', record_id: id, action: 'delete', old_values: existing, new_values: null });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
