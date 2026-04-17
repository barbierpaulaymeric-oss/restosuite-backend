// ═══════════════════════════════════════════
// TIAC — Toxi-Infections Alimentaires Collectives
// Route /api/tiac
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

// GET /api/tiac
router.get('/', (req, res) => {
  const rid = req.user.restaurant_id;
  const procedures = all('SELECT * FROM tiac_procedures WHERE restaurant_id = ? ORDER BY date_incident DESC', [rid]);
  res.json(procedures);
});

// GET /api/tiac/:id
router.get('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const procedure = get('SELECT * FROM tiac_procedures WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
  if (!procedure) return res.status(404).json({ error: 'Procédure introuvable' });
  res.json(procedure);
});

// POST /api/tiac
router.post('/', (req, res) => {
  const rid = req.user.restaurant_id;
  const {
    date_incident, description, nb_personnes, symptomes, aliments_suspects,
    mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut
  } = req.body;
  if (!date_incident || !description) {
    return res.status(400).json({ error: 'date_incident et description sont requis' });
  }
  const info = run(
    `INSERT INTO tiac_procedures
      (restaurant_id, date_incident, description, nb_personnes, symptomes, aliments_suspects,
       mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [rid, date_incident, description, nb_personnes || 0, symptomes || null, aliments_suspects || null,
     mesures_conservatoires || null, declaration_ars ? 1 : 0, plats_temoins_conserves ? 1 : 0,
     contact_ddpp || null, statut || 'en_cours']
  );
  const created = get('SELECT * FROM tiac_procedures WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
  try {
    writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'tiac_procedures', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });
  } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
  res.status(201).json(created);
});

// PUT /api/tiac/:id
router.put('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM tiac_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (!existing) return res.status(404).json({ error: 'Procédure introuvable' });
  const {
    date_incident, description, nb_personnes, symptomes, aliments_suspects,
    mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut
  } = req.body;
  run(
    `UPDATE tiac_procedures SET
      date_incident = ?, description = ?, nb_personnes = ?, symptomes = ?, aliments_suspects = ?,
      mesures_conservatoires = ?, declaration_ars = ?, plats_temoins_conserves = ?,
      contact_ddpp = ?, statut = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND restaurant_id = ?`,
    [
      date_incident || existing.date_incident,
      description || existing.description,
      nb_personnes ?? existing.nb_personnes,
      symptomes !== undefined ? symptomes : existing.symptomes,
      aliments_suspects !== undefined ? aliments_suspects : existing.aliments_suspects,
      mesures_conservatoires !== undefined ? mesures_conservatoires : existing.mesures_conservatoires,
      declaration_ars !== undefined ? (declaration_ars ? 1 : 0) : existing.declaration_ars,
      plats_temoins_conserves !== undefined ? (plats_temoins_conserves ? 1 : 0) : existing.plats_temoins_conserves,
      contact_ddpp !== undefined ? contact_ddpp : existing.contact_ddpp,
      statut || existing.statut,
      id,
      rid,
    ]
  );
  const updated = get('SELECT * FROM tiac_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
  try {
    writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'tiac_procedures', record_id: id, action: 'update', old_values: existing, new_values: updated });
  } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
  res.json(updated);
});

// DELETE /api/tiac/:id
router.delete('/:id', (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM tiac_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (!existing) return res.status(404).json({ error: 'Procédure introuvable' });
  const info = run('DELETE FROM tiac_procedures WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (info.changes === 0) return res.status(404).json({ error: 'Procédure introuvable' });
  try {
    writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'tiac_procedures', record_id: id, action: 'delete', old_values: existing, new_values: null });
  } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
  res.json({ deleted: true });
});

module.exports = router;
