// ═══════════════════════════════════════════
// Alto — AI personalization routes
// Preferences (key/value), shortcuts (trigger→action), learning read
// Mounted at /api/ai-preferences (standalone — requireAuth in each route)
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

// ─── Preferences (key/value per user, scoped to restaurant) ───

// GET /api/ai-preferences — list all prefs for current user
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const uid = req.user.id || null;
    const rows = all(
      `SELECT pref_key, pref_value, updated_at
         FROM ai_preferences
        WHERE restaurant_id = ? AND (account_id = ? OR account_id IS NULL)
        ORDER BY pref_key ASC`,
      [rid, uid]
    );
    const prefs = {};
    for (const r of rows) prefs[r.pref_key] = r.pref_value;
    res.json({ preferences: prefs, rows });
  } catch (e) {
    console.error('ai-preferences list error:', e);
    res.status(500).json({ error: 'Erreur chargement préférences' });
  }
});

// PUT /api/ai-preferences — upsert preferences (bulk)
// Body: { preferences: { key: value, ... } }
router.put('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const uid = req.user.id || null;
    const { preferences } = req.body || {};
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences (object) requis' });
    }
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(preferences)) {
      const val = value == null ? null : String(value);
      run(
        `INSERT INTO ai_preferences (restaurant_id, account_id, pref_key, pref_value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(restaurant_id, account_id, pref_key)
         DO UPDATE SET pref_value = excluded.pref_value, updated_at = excluded.updated_at`,
        [rid, uid, key, val, now, now]
      );
    }
    writeAudit({
      restaurant_id: rid, account_id: uid,
      table_name: 'ai_preferences', record_id: null,
      action: 'update', new_values: { keys: Object.keys(preferences) },
    });
    res.json({ success: true, updated: Object.keys(preferences).length });
  } catch (e) {
    console.error('ai-preferences put error:', e);
    res.status(500).json({ error: 'Erreur mise à jour préférences' });
  }
});

// ─── Shortcuts (trigger phrase → action template) ───

// GET /api/ai-preferences/shortcuts
router.get('/shortcuts', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const rows = all(
      `SELECT id, trigger_phrase, action_type, action_template, description, usage_count, last_used_at, created_at
         FROM ai_shortcuts
        WHERE restaurant_id = ?
        ORDER BY usage_count DESC, created_at DESC`,
      [rid]
    );
    res.json({ shortcuts: rows });
  } catch (e) {
    console.error('ai-shortcuts list error:', e);
    res.status(500).json({ error: 'Erreur chargement raccourcis' });
  }
});

// POST /api/ai-preferences/shortcuts — create shortcut
router.post('/shortcuts', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const uid = req.user.id || null;
    const { trigger_phrase, action_type, action_template, description } = req.body || {};
    if (!trigger_phrase || !action_type) {
      return res.status(400).json({ error: 'trigger_phrase et action_type requis' });
    }
    const template = action_template == null
      ? null
      : (typeof action_template === 'string' ? action_template : JSON.stringify(action_template));
    const info = run(
      `INSERT INTO ai_shortcuts (restaurant_id, account_id, trigger_phrase, action_type, action_template, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rid, uid, String(trigger_phrase).trim(), action_type, template, description || null]
    );
    writeAudit({
      restaurant_id: rid, account_id: uid,
      table_name: 'ai_shortcuts', record_id: info.lastInsertRowid,
      action: 'create', new_values: { trigger_phrase, action_type },
    });
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    console.error('ai-shortcuts create error:', e);
    res.status(500).json({ error: 'Erreur création raccourci' });
  }
});

// DELETE /api/ai-preferences/shortcuts/:id
router.delete('/shortcuts/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const uid = req.user.id || null;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id invalide' });
    const existing = get('SELECT id FROM ai_shortcuts WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Raccourci introuvable' });
    run('DELETE FROM ai_shortcuts WHERE id = ? AND restaurant_id = ?', [id, rid]);
    writeAudit({
      restaurant_id: rid, account_id: uid,
      table_name: 'ai_shortcuts', record_id: id,
      action: 'delete', old_values: { id },
    });
    res.json({ success: true });
  } catch (e) {
    console.error('ai-shortcuts delete error:', e);
    res.status(500).json({ error: 'Erreur suppression raccourci' });
  }
});

// GET /api/ai-preferences/learning — recent learning entries (read-only)
router.get('/learning', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = all(
      `SELECT id, action_type, outcome, user_message, action_params, feedback_notes, created_at
         FROM ai_learning
        WHERE restaurant_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      [rid, limit]
    );
    res.json({ learning: rows });
  } catch (e) {
    console.error('ai-learning list error:', e);
    res.status(500).json({ error: 'Erreur chargement apprentissage' });
  }
});

module.exports = router;
