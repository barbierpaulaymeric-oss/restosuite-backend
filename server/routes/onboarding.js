// ═══════════════════════════════════════════
// Onboarding — 7-step server-side wizard
// ═══════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}

// All onboarding routes require auth
router.use(requireAuth);

// ─── GET /api/onboarding/status ───
router.get('/status', (req, res) => {
  const account = get('SELECT * FROM accounts WHERE id = ?', [req.user.id]);
  if (!account) return res.status(404).json({ error: 'Compte introuvable' });

  const restaurant = account.restaurant_id
    ? get('SELECT * FROM restaurants WHERE id = ?', [account.restaurant_id])
    : null;

  const tables = account.restaurant_id
    ? all('SELECT * FROM tables WHERE restaurant_id = ? AND active = 1 ORDER BY table_number', [account.restaurant_id])
    : [];

  const teamMembers = account.restaurant_id
    ? all('SELECT id, name, role, first_name, last_name FROM accounts WHERE restaurant_id = ? AND id != ? ORDER BY created_at', [account.restaurant_id, account.id])
    : [];

  const zones = account.restaurant_id
    ? all('SELECT * FROM temperature_zones WHERE restaurant_id = ? ORDER BY id', [account.restaurant_id])
    : [];

  const suppliers = account.restaurant_id
    ? all('SELECT * FROM suppliers WHERE restaurant_id = ? ORDER BY name', [account.restaurant_id])
    : [];

  res.json({
    current_step: account.onboarding_step,
    account: {
      first_name: account.first_name,
      last_name: account.last_name,
      phone: account.phone
    },
    restaurant,
    tables,
    team: teamMembers,
    zones,
    suppliers
  });
});

// ─── GET /api/onboarding/checklist — post-wizard activation checklist ───
router.get('/checklist', (req, res) => {
  const rid = req.user.restaurant_id;
  const recipeRow   = get('SELECT COUNT(*) as c FROM recipes WHERE restaurant_id = ?', [rid]);
  const supplierRow = get('SELECT COUNT(*) as c FROM suppliers WHERE restaurant_id = ?', [rid]);
  const zoneRow     = get('SELECT COUNT(*) as c FROM temperature_zones WHERE restaurant_id = ?', [rid]);
  const logRow      = get('SELECT COUNT(*) as c FROM temperature_logs WHERE restaurant_id = ?', [rid]);

  const steps = [
    { id: 'recipe',      label: 'Créez votre première fiche technique vocale', link: '#/new',                done: recipeRow.c > 0 },
    { id: 'supplier',    label: 'Ajoutez un fournisseur',                      link: '#/suppliers',          done: supplierRow.c > 0 },
    { id: 'temp_zone',   label: 'Configurez vos zones de température',         link: '#/haccp/temperatures', done: zoneRow.c > 0 },
    { id: 'temp_record', label: 'Faites votre premier relevé de température',  link: '#/haccp',              done: logRow.c > 0 },
  ];

  const doneCount = steps.filter(s => s.done).length;
  res.json({ steps, progress: doneCount / steps.length, completed: doneCount === steps.length });
});

// ─── PUT /api/onboarding/step/1 — Profil gérant ───
router.put('/step/1', (req, res) => {
  const { first_name, last_name, phone } = req.body;

  const name = ((first_name || '').trim() + ' ' + (last_name || '').trim()).trim();
  run(
    'UPDATE accounts SET first_name = ?, last_name = ?, phone = ?, name = ?, onboarding_step = MAX(onboarding_step, 1) WHERE id = ?',
    [(first_name || '').trim(), (last_name || '').trim(), (phone || '').trim(), name || undefined, req.user.id]
  );

  res.json({ success: true, step: 1 });
});

// ─── PUT /api/onboarding/step/2 — Restaurant ───
router.put('/step/2', (req, res) => {
  const { name, type, address, city, postal_code, phone, covers } = req.body;
  const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);

  if (!account || !account.restaurant_id) {
    return res.status(400).json({ error: 'Restaurant non trouvé' });
  }

  run(
    `UPDATE restaurants SET name = ?, type = ?, address = ?, city = ?, postal_code = ?, phone = ?, covers = ? WHERE id = ?`,
    [
      (name || '').trim(),
      (type || '').trim(),
      (address || '').trim(),
      (city || '').trim(),
      (postal_code || '').trim(),
      (phone || '').trim(),
      covers || 30,
      account.restaurant_id
    ]
  );

  run('UPDATE accounts SET onboarding_step = MAX(onboarding_step, 2) WHERE id = ?', [req.user.id]);

  res.json({ success: true, step: 2 });
});

// ─── PUT /api/onboarding/step/3 — Salle (tables) ───
router.put('/step/3', (req, res) => {
  const { tables } = req.body;
  const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);

  if (!account || !account.restaurant_id) {
    return res.status(400).json({ error: 'Restaurant non trouvé' });
  }

  // Clear existing tables for this restaurant
  run('DELETE FROM tables WHERE restaurant_id = ?', [account.restaurant_id]);

  // Insert new tables
  if (Array.isArray(tables)) {
    for (const t of tables) {
      run(
        'INSERT INTO tables (restaurant_id, table_number, zone, seats) VALUES (?, ?, ?, ?)',
        [account.restaurant_id, t.table_number || 1, t.zone || 'Salle', t.seats || 4]
      );
    }
  }

  run('UPDATE accounts SET onboarding_step = MAX(onboarding_step, 3) WHERE id = ?', [req.user.id]);

  res.json({ success: true, step: 3 });
});

// ─── PUT /api/onboarding/step/4 — Équipe ───
router.put('/step/4', (req, res) => {
  const { members, staff_password } = req.body;
  const account = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);

  if (!account || !account.restaurant_id) {
    return res.status(400).json({ error: 'Restaurant non trouvé' });
  }

  const defaultPerms = JSON.stringify({ view_recipes: true, view_costs: false, edit_recipes: false, view_suppliers: false, export_pdf: false });

  if (Array.isArray(members)) {
    for (const m of members) {
      if (!m.name || !m.name.trim()) continue;

      const role = m.role || 'cuisinier';
      const perms = defaultPerms;

      run(
        `INSERT INTO accounts (name, pin, role, permissions, restaurant_id, trial_start)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [m.name.trim(), null, role, perms, account.restaurant_id]
      );
    }
  }

  // Set staff password if provided
  if (staff_password && staff_password.trim()) {
    const bcrypt = require('bcryptjs');
    const staffHash = bcrypt.hashSync(staff_password.trim(), 10);
    run('UPDATE restaurants SET staff_password = ? WHERE id = ?', [staffHash, account.restaurant_id]);
  }

  run('UPDATE accounts SET onboarding_step = MAX(onboarding_step, 4) WHERE id = ?', [req.user.id]);

  res.json({ success: true, step: 4 });
});

// ─── PUT /api/onboarding/step/5 — Zones froides ───
router.put('/step/5', (req, res) => {
  const { zones } = req.body;
  const rid = req.user.restaurant_id;

  if (Array.isArray(zones)) {
    // Clear and re-create temperature zones (scoped to caller tenant)
    run('DELETE FROM temperature_zones WHERE restaurant_id = ?', [rid]);
    for (const z of zones) {
      run(
        'INSERT INTO temperature_zones (restaurant_id, name, type, min_temp, max_temp) VALUES (?, ?, ?, ?, ?)',
        [rid, z.name || 'Zone', z.type || 'fridge', z.min_temp ?? 0, z.max_temp ?? 4]
      );
    }
  }

  run('UPDATE accounts SET onboarding_step = MAX(onboarding_step, 5) WHERE id = ?', [req.user.id]);

  res.json({ success: true, step: 5 });
});

// ─── PUT /api/onboarding/step/6 — Fournisseurs ───
router.put('/step/6', (req, res) => {
  const { suppliers } = req.body;
  const rid = req.user.restaurant_id;

  if (Array.isArray(suppliers)) {
    for (const s of suppliers) {
      if (!s.name) continue;
      // Check if supplier already exists (scoped to caller tenant)
      const existing = get('SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE AND restaurant_id = ?', [s.name.trim(), rid]);
      if (!existing) {
        run(
          'INSERT INTO suppliers (restaurant_id, name, contact, phone, email) VALUES (?, ?, ?, ?, ?)',
          [rid, s.name.trim(), (s.contact || '').trim(), (s.phone || '').trim(), (s.email || '').trim()]
        );
      }
    }
  }

  run('UPDATE accounts SET onboarding_step = MAX(onboarding_step, 6) WHERE id = ?', [req.user.id]);

  res.json({ success: true, step: 6 });
});

// ─── PUT /api/onboarding/step/7 — Terminé ───
router.put('/step/7', (req, res) => {
  run('UPDATE accounts SET onboarding_step = 7 WHERE id = ?', [req.user.id]);
  res.json({ success: true, step: 7, completed: true });
});

module.exports = router;
