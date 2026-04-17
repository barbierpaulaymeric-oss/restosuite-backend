// ═══════════════════════════════════════════
// Actions correctives — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

const VALID_CATEGORIES = ['temperature', 'cleaning', 'reception', 'storage', 'preparation', 'service'];
const VALID_STATUSES = ['en_cours', 'terminé', 'escaladé'];

// ─── Templates ───

// GET /api/corrective-actions/templates — list active templates
router.get('/templates', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM corrective_actions_templates WHERE is_active = 1 AND restaurant_id = ? ORDER BY category ASC, id ASC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/corrective-actions/templates — create template
router.post('/templates', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      category, trigger_condition, action_description,
      responsible_role, deadline_hours, escalation_procedure, documentation_required,
    } = req.body;
    if (!category) return res.status(400).json({ error: 'category est requis' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'category invalide' });
    const info = run(
      `INSERT INTO corrective_actions_templates
        (restaurant_id, category, trigger_condition, action_description, responsible_role, deadline_hours, escalation_procedure, documentation_required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, category, trigger_condition || null, action_description || null, responsible_role || null,
       deadline_hours != null ? parseInt(deadline_hours, 10) : null,
       escalation_procedure || null, documentation_required || null]
    );
    const item = get('SELECT * FROM corrective_actions_templates WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/corrective-actions/templates/:id — update template
router.put('/templates/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { id } = req.params;
    const existing = get('SELECT * FROM corrective_actions_templates WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Modèle introuvable' });

    const {
      category, trigger_condition, action_description,
      responsible_role, deadline_hours, escalation_procedure, documentation_required, is_active,
    } = req.body;

    if (category && !VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'category invalide' });

    run(
      `UPDATE corrective_actions_templates SET
        category = COALESCE(?, category),
        trigger_condition = COALESCE(?, trigger_condition),
        action_description = COALESCE(?, action_description),
        responsible_role = COALESCE(?, responsible_role),
        deadline_hours = COALESCE(?, deadline_hours),
        escalation_procedure = COALESCE(?, escalation_procedure),
        documentation_required = COALESCE(?, documentation_required),
        is_active = COALESCE(?, is_active)
       WHERE id = ? AND restaurant_id = ?`,
      [category || null, trigger_condition !== undefined ? trigger_condition : null,
       action_description !== undefined ? action_description : null,
       responsible_role !== undefined ? responsible_role : null,
       deadline_hours != null ? parseInt(deadline_hours, 10) : null,
       escalation_procedure !== undefined ? escalation_procedure : null,
       documentation_required !== undefined ? documentation_required : null,
       is_active != null ? (is_active ? 1 : 0) : null,
       id, rid]
    );
    const item = get('SELECT * FROM corrective_actions_templates WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Log ───

// GET /api/corrective-actions/log — list log entries
router.get('/log', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { category, status } = req.query;
    let sql = 'SELECT * FROM corrective_actions_log WHERE restaurant_id = ?';
    const params = [rid];
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const items = all(sql, params);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/corrective-actions/log — create log entry
router.post('/log', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      template_id, category, trigger_description, action_taken,
      responsible_person, started_at, notes, related_record_id, related_record_type,
    } = req.body;
    if (!category) return res.status(400).json({ error: 'category est requis' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'category invalide' });

    const info = run(
      `INSERT INTO corrective_actions_log
        (restaurant_id, template_id, category, trigger_description, action_taken, responsible_person,
         started_at, status, notes, related_record_id, related_record_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'en_cours', ?, ?, ?)`,
      [rid, template_id || null, category, trigger_description || null, action_taken || null,
       responsible_person || null, started_at || new Date().toISOString(),
       notes || null, related_record_id || null, related_record_type || null]
    );
    const item = get('SELECT * FROM corrective_actions_log WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/corrective-actions/log/:id — update log entry
router.put('/log/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { id } = req.params;
    const existing = get('SELECT * FROM corrective_actions_log WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Entrée introuvable' });

    const { action_taken, responsible_person, started_at, completed_at, status, notes } = req.body;
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'status invalide' });

    run(
      `UPDATE corrective_actions_log SET
        action_taken = COALESCE(?, action_taken),
        responsible_person = COALESCE(?, responsible_person),
        started_at = COALESCE(?, started_at),
        completed_at = COALESCE(?, completed_at),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes)
       WHERE id = ? AND restaurant_id = ?`,
      [action_taken !== undefined ? action_taken : null,
       responsible_person !== undefined ? responsible_person : null,
       started_at !== undefined ? started_at : null,
       completed_at !== undefined ? completed_at : null,
       status || null,
       notes !== undefined ? notes : null,
       id, rid]
    );
    const item = get('SELECT * FROM corrective_actions_log WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Stats ───

// GET /api/corrective-actions/stats
router.get('/stats', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const total_en_cours = (get("SELECT COUNT(*) as c FROM corrective_actions_log WHERE status = 'en_cours' AND restaurant_id = ?", [rid]) || {}).c || 0;
    const total_termine  = (get("SELECT COUNT(*) as c FROM corrective_actions_log WHERE status = 'terminé' AND restaurant_id = ?", [rid]) || {}).c || 0;
    const total_escalade = (get("SELECT COUNT(*) as c FROM corrective_actions_log WHERE status = 'escaladé' AND restaurant_id = ?", [rid]) || {}).c || 0;

    const resolutionRows = all(`
      SELECT (julianday(completed_at) - julianday(started_at)) * 24 as hours
      FROM corrective_actions_log
      WHERE status = 'terminé' AND completed_at IS NOT NULL AND started_at IS NOT NULL AND restaurant_id = ?
    `, [rid]);
    const avg_resolution_hours = resolutionRows.length > 0
      ? parseFloat((resolutionRows.reduce((acc, r) => acc + (r.hours || 0), 0) / resolutionRows.length).toFixed(1))
      : null;

    const by_category = all(`
      SELECT category, COUNT(*) as count
      FROM corrective_actions_log
      WHERE restaurant_id = ?
      GROUP BY category
      ORDER BY count DESC
    `, [rid]);

    res.json({ total_en_cours, total_termine, total_escalade, avg_resolution_hours, by_category });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
