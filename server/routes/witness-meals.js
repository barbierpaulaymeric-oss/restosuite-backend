// ═══════════════════════════════════════════
// Plats témoins (witness meals) — Routes API
// Arrêté du 21 décembre 2009, Article 32
// Mounted at /api/haccp/witness-meals (inherits planGate('essential'))
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

const VALID_MEAL_TYPES = ['petit_dejeuner', 'dejeuner', 'diner', 'gouter', 'collation'];
const VALID_SERVICE_TYPES = ['sur_place', 'livraison', 'emporter', 'traiteur'];

// Arrêté du 21/12/2009 Art 32 — plats témoins conservés à 0-3 °C pendant 5 jours
const STORAGE_TEMP_MIN = 0;
const STORAGE_TEMP_MAX = 3;

// Returns { value, outOfRange, warning } or null if input is null/undefined.
// Invalid number returns { value: null, parseError: true }.
function normalizeStorageTemp(raw) {
  if (raw == null || raw === '') return null;
  const num = Number(raw);
  if (Number.isNaN(num)) return { value: null, parseError: true };
  const outOfRange = num < STORAGE_TEMP_MIN || num > STORAGE_TEMP_MAX;
  return {
    value: num,
    outOfRange,
    warning: outOfRange
      ? `Température ${num}°C hors plage légale [${STORAGE_TEMP_MIN}, ${STORAGE_TEMP_MAX}]°C (Arrêté 21/12/2009 Art 32). Conservation non conforme — is_complete forcé à 0.`
      : null,
  };
}

// Compute ISO datetime = meal_date + 5 days 23:59 (covers full 5th day)
function computeKeptUntil(mealDate) {
  const d = new Date(mealDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 5);
  d.setUTCHours(23, 59, 0, 0);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function serializeSamples(samples) {
  if (samples == null) return null;
  if (typeof samples === 'string') return samples;
  try { return JSON.stringify(samples); } catch { return null; }
}

// GET /api/haccp/witness-meals — list, optional ?from=&to=&limit=&offset=
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { from, to } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const clauses = ['restaurant_id = ?'];
    const params = [rid];
    if (from) { clauses.push('meal_date >= ?'); params.push(from); }
    if (to)   { clauses.push('meal_date <= ?'); params.push(to); }
    const items = all(
      `SELECT * FROM witness_meals WHERE ${clauses.join(' AND ')}
       ORDER BY meal_date DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const totalRow = get(
      `SELECT COUNT(*) as c FROM witness_meals WHERE ${clauses.join(' AND ')}`,
      params
    );
    res.json({ items, total: totalRow ? totalRow.c : items.length, limit, offset });
  } catch (e) {
    console.error('GET witness-meals error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/haccp/witness-meals/active — samples still in retention, not yet disposed
router.get('/active', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(
      `SELECT * FROM witness_meals
       WHERE restaurant_id = ?
         AND disposed_date IS NULL
         AND kept_until >= datetime('now')
       ORDER BY kept_until ASC`,
      [rid]
    );
    res.json({ items, total: items.length });
  } catch (e) {
    console.error('GET witness-meals/active error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/haccp/witness-meals/overdue — past retention, not yet disposed
router.get('/overdue', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all(
      `SELECT * FROM witness_meals
       WHERE restaurant_id = ?
         AND disposed_date IS NULL
         AND kept_until < datetime('now')
       ORDER BY kept_until ASC`,
      [rid]
    );
    res.json({ items, total: items.length });
  } catch (e) {
    console.error('GET witness-meals/overdue error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/haccp/witness-meals/alerts — date-gap heuristic: days in last 7 with no sample
router.get('/alerts', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const recent = all(
      `SELECT DISTINCT meal_date FROM witness_meals
       WHERE restaurant_id = ?
         AND meal_date >= date('now','-7 days')`,
      [rid]
    );
    const recorded = new Set(recent.map(r => r.meal_date));
    const missing = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (!recorded.has(iso)) missing.push(iso);
    }
    res.json({ missing_dates: missing, total: missing.length });
  } catch (e) {
    console.error('GET witness-meals/alerts error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/haccp/witness-meals/:id
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const row = get('SELECT * FROM witness_meals WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
    if (!row) return res.status(404).json({ error: 'Plat témoin introuvable' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/haccp/witness-meals — create, auto-compute kept_until
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      meal_date, meal_type, service_type, samples, storage_temperature,
      storage_location, quantity_per_sample, is_complete, notes, operator,
    } = req.body;

    if (!meal_date) return res.status(400).json({ error: 'meal_date est requis' });
    if (!meal_type) return res.status(400).json({ error: 'meal_type est requis' });
    if (!VALID_MEAL_TYPES.includes(meal_type)) {
      return res.status(400).json({ error: `meal_type invalide. Valeurs : ${VALID_MEAL_TYPES.join(', ')}` });
    }
    if (service_type && !VALID_SERVICE_TYPES.includes(service_type)) {
      return res.status(400).json({ error: `service_type invalide. Valeurs : ${VALID_SERVICE_TYPES.join(', ')}` });
    }

    const temp = normalizeStorageTemp(storage_temperature);
    if (temp && temp.parseError) {
      return res.status(400).json({ error: 'storage_temperature doit être un nombre' });
    }
    // Out-of-range → force is_complete=0 and append compliance note
    let effectiveIsComplete = is_complete ? 1 : 0;
    let effectiveNotes = notes || null;
    if (temp && temp.outOfRange) {
      effectiveIsComplete = 0;
      const prefix = '[NON-CONFORME Art 32] Conservation hors 0-3°C. ';
      effectiveNotes = effectiveNotes ? `${prefix}${effectiveNotes}` : prefix.trim();
    }

    const kept_until = computeKeptUntil(meal_date);

    const info = run(
      `INSERT INTO witness_meals
         (restaurant_id, meal_date, meal_type, service_type, samples,
          storage_temperature, storage_location, kept_until,
          quantity_per_sample, is_complete, notes, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        meal_date,
        meal_type,
        service_type || null,
        serializeSamples(samples),
        temp ? temp.value : null,
        storage_location || null,
        kept_until,
        quantity_per_sample || '100g minimum',
        effectiveIsComplete,
        effectiveNotes,
        operator || null,
      ]
    );
    const created = get('SELECT * FROM witness_meals WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'witness_meals', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    const response = { ...created };
    if (temp && temp.warning) response.warning = temp.warning;
    res.status(201).json(response);
  } catch (e) {
    console.error('POST witness-meals error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/haccp/witness-meals/:id — update (typically: add disposal info)
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM witness_meals WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Plat témoin introuvable' });

    const {
      meal_date, meal_type, service_type, samples, storage_temperature,
      storage_location, disposed_date, disposed_by, quantity_per_sample,
      is_complete, notes, operator,
    } = req.body;

    if (meal_type && !VALID_MEAL_TYPES.includes(meal_type)) {
      return res.status(400).json({ error: `meal_type invalide. Valeurs : ${VALID_MEAL_TYPES.join(', ')}` });
    }
    if (service_type && !VALID_SERVICE_TYPES.includes(service_type)) {
      return res.status(400).json({ error: `service_type invalide. Valeurs : ${VALID_SERVICE_TYPES.join(', ')}` });
    }

    const nextMealDate = meal_date || existing.meal_date;
    const kept_until = meal_date ? computeKeptUntil(meal_date) : existing.kept_until;

    // Re-validate temp on update only when caller provided a new value
    let nextTemp = existing.storage_temperature;
    let tempResult = null;
    if (storage_temperature !== undefined) {
      tempResult = normalizeStorageTemp(storage_temperature);
      if (tempResult && tempResult.parseError) {
        return res.status(400).json({ error: 'storage_temperature doit être un nombre' });
      }
      nextTemp = tempResult ? tempResult.value : null;
    }
    let nextIsComplete = is_complete !== undefined ? (is_complete ? 1 : 0) : existing.is_complete;
    let nextNotes = notes !== undefined ? (notes || null) : existing.notes;
    if (tempResult && tempResult.outOfRange) {
      nextIsComplete = 0;
      const prefix = '[NON-CONFORME Art 32] Conservation hors 0-3°C. ';
      if (!nextNotes || !nextNotes.includes('[NON-CONFORME Art 32]')) {
        nextNotes = nextNotes ? `${prefix}${nextNotes}` : prefix.trim();
      }
    }

    run(
      `UPDATE witness_meals SET
         meal_date = ?, meal_type = ?, service_type = ?, samples = ?,
         storage_temperature = ?, storage_location = ?, kept_until = ?,
         disposed_date = ?, disposed_by = ?, quantity_per_sample = ?,
         is_complete = ?, notes = ?, operator = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND restaurant_id = ?`,
      [
        nextMealDate,
        meal_type || existing.meal_type,
        service_type !== undefined ? (service_type || null) : existing.service_type,
        samples !== undefined ? serializeSamples(samples) : existing.samples,
        nextTemp,
        storage_location !== undefined ? (storage_location || null) : existing.storage_location,
        kept_until,
        disposed_date !== undefined ? (disposed_date || null) : existing.disposed_date,
        disposed_by !== undefined ? (disposed_by || null) : existing.disposed_by,
        quantity_per_sample || existing.quantity_per_sample,
        nextIsComplete,
        nextNotes,
        operator !== undefined ? (operator || null) : existing.operator,
        id,
        rid,
      ]
    );
    const updated = get('SELECT * FROM witness_meals WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'witness_meals', record_id: id, action: 'update', old_values: existing, new_values: updated });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    const response = { ...updated };
    if (tempResult && tempResult.warning) response.warning = tempResult.warning;
    res.json(response);
  } catch (e) {
    console.error('PUT witness-meals error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/haccp/witness-meals/:id
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM witness_meals WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Plat témoin introuvable' });
    run('DELETE FROM witness_meals WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'witness_meals', record_id: id, action: 'delete', old_values: existing, new_values: null });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE witness-meals error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
