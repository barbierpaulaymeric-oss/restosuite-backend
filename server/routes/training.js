// ═══════════════════════════════════════════
// BPH Formation du personnel — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/training — list all
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM training_records WHERE restaurant_id = ? ORDER BY training_date DESC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/training/expiring — expiring within 30 days
router.get('/expiring', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(
      `SELECT * FROM training_records
       WHERE restaurant_id = ?
         AND next_renewal_date IS NOT NULL
         AND next_renewal_date <= DATE('now', '+30 days')
         AND next_renewal_date >= DATE('now')
       ORDER BY next_renewal_date ASC`,
      [rid]
    );
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/training — create
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { employee_name, training_topic, trainer, training_date, next_renewal_date, duration_hours, certificate_ref, status, notes } = req.body;
    if (!employee_name) return res.status(400).json({ error: 'employee_name est requis' });
    if (!training_topic) return res.status(400).json({ error: 'training_topic est requis' });
    if (!training_date) return res.status(400).json({ error: 'training_date est requis' });
    const validStatuses = ['planifié', 'réalisé', 'expiré'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const info = run(
      `INSERT INTO training_records (restaurant_id, employee_name, training_topic, trainer, training_date, next_renewal_date, duration_hours, certificate_ref, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, employee_name, training_topic, trainer || null, training_date, next_renewal_date || null,
       duration_hours ? Number(duration_hours) : null, certificate_ref || null, status || 'planifié', notes || null]
    );
    res.status(201).json(get('SELECT * FROM training_records WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/training/:id — update
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM training_records WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Formation introuvable' });
    const { employee_name, training_topic, trainer, training_date, next_renewal_date, duration_hours, certificate_ref, status, notes } = req.body;
    run(
      `UPDATE training_records SET
        employee_name=?, training_topic=?, trainer=?, training_date=?, next_renewal_date=?,
        duration_hours=?, certificate_ref=?, status=?, notes=?
       WHERE id=? AND restaurant_id=?`,
      [
        employee_name || existing.employee_name,
        training_topic || existing.training_topic,
        trainer !== undefined ? trainer : existing.trainer,
        training_date || existing.training_date,
        next_renewal_date !== undefined ? next_renewal_date : existing.next_renewal_date,
        duration_hours !== undefined ? (duration_hours ? Number(duration_hours) : null) : existing.duration_hours,
        certificate_ref !== undefined ? certificate_ref : existing.certificate_ref,
        status || existing.status,
        notes !== undefined ? notes : existing.notes,
        id,
        rid,
      ]
    );
    res.json(get('SELECT * FROM training_records WHERE id = ? AND restaurant_id = ?', [id, rid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/training/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM training_records WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Formation introuvable' });
    run('DELETE FROM training_records WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
