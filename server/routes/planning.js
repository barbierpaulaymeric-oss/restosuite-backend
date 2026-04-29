// ═══════════════════════════════════════════
// Staff scheduling — staff_members + staff_shifts.
//
// Endpoints (all tenant-scoped via req.user.restaurant_id, soft-delete on
// staff_members via deleted_at IS NULL):
//   GET    /api/planning/members
//   POST   /api/planning/members
//   PUT    /api/planning/members/:id
//   DELETE /api/planning/members/:id
//   GET    /api/planning/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD
//   POST   /api/planning/shifts
//   PUT    /api/planning/shifts/:id
//   DELETE /api/planning/shifts/:id
//   GET    /api/planning/week?date=YYYY-MM-DD     (Mon-Sun grid)
//   GET    /api/planning/labor-cost?from=&to=     (hours, cost, cost/cover)
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = new Set(['planned', 'confirmed', 'completed', 'cancelled']);

function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTime(s) {
  return typeof s === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(s);
}

// "08:30" + "17:00" + breakMin → hours worked. End-before-start treated as
// next-day shift (e.g. 22:00 → 02:00). Always returns ≥ 0.
function shiftHours(start, end, breakMinutes) {
  if (!isTime(start) || !isTime(end)) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  mins -= Math.max(0, Number(breakMinutes) || 0);
  return Math.max(0, mins / 60);
}

function r2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Week grid bounds: Monday 00:00 → Sunday 23:59. Date param is any day in
// the target week (defaults to today).
function weekBounds(refIso) {
  const d = refIso && isDate(refIso) ? new Date(refIso + 'T00:00:00Z') : new Date();
  const day = d.getUTCDay() || 7; // Sunday=0 → 7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

// ─── Staff members CRUD ────────────────────────────────────────────────────

router.get('/members', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const rows = all(`
      SELECT id, name, role, email, phone, hourly_rate, contract_hours, account_id,
             created_at, updated_at
      FROM staff_members
      WHERE restaurant_id = ? AND deleted_at IS NULL
      ORDER BY name COLLATE NOCASE
    `, [rid]);
    res.json(rows);
  } catch (e) {
    console.error('GET /planning/members error:', e.message);
    res.status(500).json({ error: 'Erreur lors du chargement des membres' });
  }
});

router.post('/members', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      name, role, email, phone, hourly_rate, contract_hours, account_id,
    } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name requis' });
    }
    const result = run(
      `INSERT INTO staff_members
         (restaurant_id, name, role, email, phone, hourly_rate, contract_hours, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        name.trim(),
        role || null,
        email || null,
        phone || null,
        Number(hourly_rate) || 0,
        Number(contract_hours) || 35,
        account_id ? Number(account_id) : null,
      ]
    );
    const row = get('SELECT * FROM staff_members WHERE id = ?', [result.lastInsertRowid]);
    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id,
        table_name: 'staff_members',
        record_id: row.id,
        action: 'create',
        new_values: row,
      });
    } catch {}
    res.status(201).json(row);
  } catch (e) {
    console.error('POST /planning/members error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la création du membre' });
  }
});

router.put('/members/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get(
      'SELECT * FROM staff_members WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
      [id, rid]
    );
    if (!existing) return res.status(404).json({ error: 'Membre introuvable' });

    const fields = ['name', 'role', 'email', 'phone', 'hourly_rate', 'contract_hours', 'account_id'];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, f)) {
        sets.push(`${f} = ?`);
        let v = req.body[f];
        if (f === 'hourly_rate' || f === 'contract_hours') v = Number(v) || 0;
        if (f === 'account_id') v = v ? Number(v) : null;
        params.push(v);
      }
    }
    if (sets.length === 0) return res.json(existing);
    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id, rid);
    run(
      `UPDATE staff_members SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ?`,
      params
    );
    const row = get('SELECT * FROM staff_members WHERE id = ?', [id]);
    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id,
        table_name: 'staff_members',
        record_id: id,
        action: 'update',
        old_values: existing,
        new_values: row,
      });
    } catch {}
    res.json(row);
  } catch (e) {
    console.error('PUT /planning/members/:id error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du membre' });
  }
});

router.delete('/members/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get(
      'SELECT * FROM staff_members WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
      [id, rid]
    );
    if (!existing) return res.status(404).json({ error: 'Membre introuvable' });
    run(
      "UPDATE staff_members SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?",
      [id, rid]
    );
    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id,
        table_name: 'staff_members',
        record_id: id,
        action: 'delete',
        old_values: existing,
      });
    } catch {}
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /planning/members/:id error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la suppression du membre' });
  }
});

// ─── Shifts CRUD ───────────────────────────────────────────────────────────

router.get('/shifts', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { from, to, member_id } = req.query;
    const where = ['ss.restaurant_id = ?'];
    const params = [rid];
    if (from && isDate(from)) {
      where.push('ss.date >= ?');
      params.push(from);
    }
    if (to && isDate(to)) {
      where.push('ss.date <= ?');
      params.push(to);
    }
    if (member_id) {
      where.push('ss.staff_member_id = ?');
      params.push(Number(member_id));
    }
    const rows = all(`
      SELECT ss.id, ss.staff_member_id, ss.date, ss.start_time, ss.end_time,
             ss.break_minutes, ss.notes, ss.status,
             ss.created_at, ss.updated_at,
             sm.name AS staff_name, sm.role AS staff_role,
             sm.hourly_rate AS hourly_rate
      FROM staff_shifts ss
      LEFT JOIN staff_members sm
        ON sm.id = ss.staff_member_id AND sm.restaurant_id = ?
      WHERE ${where.join(' AND ')}
      ORDER BY ss.date ASC, ss.start_time ASC
    `, [rid, ...params]);

    for (const r of rows) {
      r.hours = r2(shiftHours(r.start_time, r.end_time, r.break_minutes));
      r.cost  = r2(r.hours * (Number(r.hourly_rate) || 0));
    }
    res.json(rows);
  } catch (e) {
    console.error('GET /planning/shifts error:', e.message);
    res.status(500).json({ error: 'Erreur lors du chargement des shifts' });
  }
});

router.post('/shifts', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      staff_member_id, date, start_time, end_time,
      break_minutes, notes, status,
    } = req.body || {};
    if (!staff_member_id) return res.status(400).json({ error: 'staff_member_id requis' });
    if (!isDate(date)) return res.status(400).json({ error: 'date requise (YYYY-MM-DD)' });
    if (!isTime(start_time) || !isTime(end_time)) {
      return res.status(400).json({ error: 'start_time et end_time requis (HH:MM)' });
    }
    if (status && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `status invalide (${[...VALID_STATUSES].join('|')})` });
    }
    // Member must belong to caller's tenant.
    const member = get(
      'SELECT id FROM staff_members WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
      [Number(staff_member_id), rid]
    );
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const result = run(
      `INSERT INTO staff_shifts
         (restaurant_id, staff_member_id, date, start_time, end_time, break_minutes, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        Number(staff_member_id),
        date,
        start_time,
        end_time,
        Number(break_minutes) || 0,
        notes || null,
        status || 'planned',
      ]
    );
    const row = get('SELECT * FROM staff_shifts WHERE id = ?', [result.lastInsertRowid]);
    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id,
        table_name: 'staff_shifts',
        record_id: row.id,
        action: 'create',
        new_values: row,
      });
    } catch {}
    res.status(201).json(row);
  } catch (e) {
    console.error('POST /planning/shifts error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la création du shift' });
  }
});

router.put('/shifts/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get(
      'SELECT * FROM staff_shifts WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    if (!existing) return res.status(404).json({ error: 'Shift introuvable' });

    const fields = ['staff_member_id', 'date', 'start_time', 'end_time', 'break_minutes', 'notes', 'status'];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, f)) continue;
      let v = req.body[f];
      if (f === 'staff_member_id') {
        v = Number(v);
        const member = get(
          'SELECT id FROM staff_members WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
          [v, rid]
        );
        if (!member) return res.status(404).json({ error: 'Membre introuvable' });
      }
      if (f === 'date' && !isDate(v)) return res.status(400).json({ error: 'date invalide' });
      if ((f === 'start_time' || f === 'end_time') && !isTime(v)) {
        return res.status(400).json({ error: `${f} invalide` });
      }
      if (f === 'break_minutes') v = Number(v) || 0;
      if (f === 'status' && !VALID_STATUSES.has(v)) {
        return res.status(400).json({ error: 'status invalide' });
      }
      sets.push(`${f} = ?`);
      params.push(v);
    }
    if (sets.length === 0) return res.json(existing);
    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id, rid);
    run(
      `UPDATE staff_shifts SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ?`,
      params
    );
    const row = get('SELECT * FROM staff_shifts WHERE id = ?', [id]);
    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id,
        table_name: 'staff_shifts',
        record_id: id,
        action: 'update',
        old_values: existing,
        new_values: row,
      });
    } catch {}
    res.json(row);
  } catch (e) {
    console.error('PUT /planning/shifts/:id error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du shift' });
  }
});

router.delete('/shifts/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get(
      'SELECT * FROM staff_shifts WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    if (!existing) return res.status(404).json({ error: 'Shift introuvable' });
    run('DELETE FROM staff_shifts WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id,
        table_name: 'staff_shifts',
        record_id: id,
        action: 'delete',
        old_values: existing,
      });
    } catch {}
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /planning/shifts/:id error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la suppression du shift' });
  }
});

// ─── Weekly view ───────────────────────────────────────────────────────────
router.get('/week', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const bounds = weekBounds(req.query.date);
    const members = all(`
      SELECT id, name, role, hourly_rate, contract_hours
      FROM staff_members
      WHERE restaurant_id = ? AND deleted_at IS NULL
      ORDER BY name COLLATE NOCASE
    `, [rid]);
    const shifts = all(`
      SELECT id, staff_member_id, date, start_time, end_time,
             break_minutes, notes, status
      FROM staff_shifts
      WHERE restaurant_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC, start_time ASC
    `, [rid, bounds.from, bounds.to]);

    for (const s of shifts) {
      s.hours = r2(shiftHours(s.start_time, s.end_time, s.break_minutes));
      const m = members.find(mm => mm.id === s.staff_member_id);
      s.cost = r2(s.hours * (Number(m && m.hourly_rate) || 0));
    }

    res.json({
      from: bounds.from,
      to: bounds.to,
      members,
      shifts,
    });
  } catch (e) {
    console.error('GET /planning/week error:', e.message);
    res.status(500).json({ error: 'Erreur lors du chargement de la semaine' });
  }
});

// ─── Labor cost summary ────────────────────────────────────────────────────
// Total hours, total cost, optional cost per cover when service_sessions has
// total_covers data on the period. `from` and `to` default to current month.
router.get('/labor-cost', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    let { from, to } = req.query;
    if (!isDate(from) || !isDate(to)) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      from = start.toISOString().slice(0, 10);
      to   = end.toISOString().slice(0, 10);
    }

    const shifts = all(`
      SELECT ss.start_time, ss.end_time, ss.break_minutes,
             sm.name, sm.role, sm.hourly_rate
      FROM staff_shifts ss
      LEFT JOIN staff_members sm
        ON sm.id = ss.staff_member_id AND sm.restaurant_id = ?
      WHERE ss.restaurant_id = ? AND ss.date >= ? AND ss.date <= ?
        AND ss.status != 'cancelled'
    `, [rid, rid, from, to]);

    let totalHours = 0;
    let totalCost = 0;
    const byMember = new Map();
    for (const s of shifts) {
      const h = shiftHours(s.start_time, s.end_time, s.break_minutes);
      const c = h * (Number(s.hourly_rate) || 0);
      totalHours += h;
      totalCost += c;
      const k = s.name || '—';
      const cur = byMember.get(k) || { name: k, role: s.role || null, hours: 0, cost: 0 };
      cur.hours += h;
      cur.cost  += c;
      byMember.set(k, cur);
    }

    // Covers (best-effort — table may be missing total_covers in older DBs).
    let totalCovers = 0;
    try {
      const cov = get(`
        SELECT COALESCE(SUM(total_covers), 0) AS n
        FROM service_sessions
        WHERE restaurant_id = ? AND date(opened_at) >= ? AND date(opened_at) <= ?
      `, [rid, from, to]);
      totalCovers = Number(cov && cov.n) || 0;
    } catch { totalCovers = 0; }

    res.json({
      from,
      to,
      total_hours: r2(totalHours),
      total_cost: r2(totalCost),
      total_covers: totalCovers,
      cost_per_cover: totalCovers > 0 ? r2(totalCost / totalCovers) : null,
      by_member: [...byMember.values()]
        .map(m => ({ ...m, hours: r2(m.hours), cost: r2(m.cost) }))
        .sort((a, b) => b.cost - a.cost),
    });
  } catch (e) {
    console.error('GET /planning/labor-cost error:', e.message);
    res.status(500).json({ error: 'Erreur lors du calcul du coût main d\'œuvre' });
  }
});

module.exports = router;
module.exports.shiftHours = shiftHours;
module.exports.weekBounds = weekBounds;
