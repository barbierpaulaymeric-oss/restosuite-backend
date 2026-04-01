// ═══════════════════════════════════════════
// Accounts — Multi-account with PIN auth
// ═══════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const { all, get, run } = require('../db');
const router = express.Router();

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

const GERANT_PERMISSIONS = {
  view_recipes: true,
  view_costs: true,
  edit_recipes: true,
  view_suppliers: true,
  export_pdf: true
};

const EQUIPIER_DEFAULT_PERMISSIONS = {
  view_recipes: true,
  view_costs: false,
  edit_recipes: false,
  view_suppliers: false,
  export_pdf: false
};

// GET /api/accounts — list all accounts (no PIN)
router.get('/', (req, res) => {
  const accounts = all('SELECT id, name, role, permissions, created_at, last_login FROM accounts ORDER BY created_at ASC');
  res.json(accounts.map(a => ({
    ...a,
    permissions: JSON.parse(a.permissions)
  })));
});

// POST /api/accounts — create account
router.post('/', (req, res) => {
  const { name, pin } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom est requis' });
  }
  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'Le PIN doit être 4 chiffres' });
  }

  // Check if this is the first account → becomes gerant
  const existing = all('SELECT id FROM accounts');
  const isFirst = existing.length === 0;
  const role = isFirst ? 'gerant' : 'equipier';
  const permissions = isFirst ? GERANT_PERMISSIONS : EQUIPIER_DEFAULT_PERMISSIONS;

  const hashedPin = hashPin(pin);

  try {
    const result = run(
      'INSERT INTO accounts (name, pin, role, permissions) VALUES (?, ?, ?, ?)',
      [name.trim(), hashedPin, role, JSON.stringify(permissions)]
    );
    res.json({
      id: result.lastInsertRowid,
      name: name.trim(),
      role,
      permissions
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

// POST /api/accounts/login — verify PIN
router.post('/login', (req, res) => {
  const { id, pin } = req.body;

  if (!id || !pin) {
    return res.status(400).json({ error: 'ID et PIN requis' });
  }

  const account = get('SELECT * FROM accounts WHERE id = ?', [id]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const hashedPin = hashPin(pin);
  if (account.pin !== hashedPin) {
    return res.status(401).json({ error: 'PIN incorrect' });
  }

  // Update last_login
  run('UPDATE accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);

  res.json({
    id: account.id,
    name: account.name,
    role: account.role,
    permissions: JSON.parse(account.permissions)
  });
});

// PUT /api/accounts/:id — update account (gerant only)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, permissions, caller_id } = req.body;

  // Verify caller is gerant
  if (caller_id) {
    const caller = get('SELECT role FROM accounts WHERE id = ?', [caller_id]);
    if (!caller || caller.role !== 'gerant') {
      return res.status(403).json({ error: 'Accès refusé — gérant uniquement' });
    }
  }

  const account = get('SELECT * FROM accounts WHERE id = ?', [id]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  // Cannot modify gerant permissions
  if (account.role === 'gerant') {
    return res.status(403).json({ error: 'Impossible de modifier les permissions du gérant' });
  }

  const updates = [];
  const params = [];

  if (name && name.trim()) {
    updates.push('name = ?');
    params.push(name.trim());
  }

  if (permissions) {
    // Always keep view_recipes true
    const sanitized = {
      view_recipes: true,
      view_costs: !!permissions.view_costs,
      edit_recipes: !!permissions.edit_recipes,
      view_suppliers: !!permissions.view_suppliers,
      export_pdf: !!permissions.export_pdf
    };
    updates.push('permissions = ?');
    params.push(JSON.stringify(sanitized));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Rien à modifier' });
  }

  params.push(id);
  run(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = get('SELECT id, name, role, permissions, created_at, last_login FROM accounts WHERE id = ?', [id]);
  res.json({
    ...updated,
    permissions: JSON.parse(updated.permissions)
  });
});

// DELETE /api/accounts/:id — delete account (gerant only)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const callerId = req.query.caller_id || req.body?.caller_id;

  // Verify caller is gerant
  if (callerId) {
    const caller = get('SELECT role FROM accounts WHERE id = ?', [callerId]);
    if (!caller || caller.role !== 'gerant') {
      return res.status(403).json({ error: 'Accès refusé — gérant uniquement' });
    }

    // Cannot delete own account
    if (parseInt(callerId) === parseInt(id)) {
      return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
    }
  }

  const account = get('SELECT * FROM accounts WHERE id = ?', [id]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  if (account.role === 'gerant') {
    return res.status(403).json({ error: 'Impossible de supprimer le compte gérant' });
  }

  run('DELETE FROM accounts WHERE id = ?', [id]);
  res.json({ success: true });
});

module.exports = router;
