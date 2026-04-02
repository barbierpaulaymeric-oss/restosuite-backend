// ═══════════════════════════════════════════
// Accounts — Multi-account with PIN auth
// ═══════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const { all, get, run } = require('../db');
const { getAccountStatusById } = require('../middleware/trial');
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

const CUISINIER_PERMISSIONS = {
  view_recipes: true,
  view_costs: false,
  edit_recipes: false,
  view_suppliers: false,
  export_pdf: false
};

const EQUIPIER_DEFAULT_PERMISSIONS = {
  view_recipes: true,
  view_costs: false,
  edit_recipes: false,
  view_suppliers: false,
  export_pdf: false
};

const SALLE_PERMISSIONS = {
  view_recipes: true,
  view_costs: false,
  edit_recipes: false,
  view_suppliers: false,
  export_pdf: false
};

const VALID_ROLES = ['gerant', 'cuisinier', 'equipier', 'salle'];

function generateReferralCode(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

function getPermissionsForRole(role) {
  switch (role) {
    case 'gerant': return GERANT_PERMISSIONS;
    case 'cuisinier': return CUISINIER_PERMISSIONS;
    case 'salle': return SALLE_PERMISSIONS;
    default: return EQUIPIER_DEFAULT_PERMISSIONS;
  }
}

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
  const requestedRole = req.body.role;
  const role = isFirst ? 'gerant' : (requestedRole && VALID_ROLES.includes(requestedRole) ? requestedRole : 'equipier');
  const permissions = getPermissionsForRole(role);

  const hashedPin = hashPin(pin);

  try {
    // Generate referral code for gerant accounts
    const referralCode = (role === 'gerant') ? generateReferralCode(name.trim()) : null;

    const result = run(
      'INSERT INTO accounts (name, pin, role, permissions, trial_start, referral_code) VALUES (?, ?, ?, ?, datetime(\'now\'), ?)',
      [name.trim(), hashedPin, role, JSON.stringify(permissions), referralCode]
    );

    const newAccountId = result.lastInsertRowid;

    // Apply referral code if provided
    const referredBy = req.body.referral_code;
    if (referredBy) {
      const referrer = get('SELECT id, referral_bonus_days FROM accounts WHERE referral_code = ?', [referredBy]);
      if (referrer && referrer.id !== newAccountId) {
        // Referrer gets 30 bonus days
        run('UPDATE accounts SET referral_bonus_days = COALESCE(referral_bonus_days, 0) + 30 WHERE id = ?', [referrer.id]);
        // New account gets 15 bonus days
        run('UPDATE accounts SET referred_by = ?, referral_bonus_days = 15 WHERE id = ?', [referredBy, newAccountId]);
        // Record referral
        try {
          run(
            'INSERT INTO referrals (referrer_code, referrer_account_id, referred_account_id, status, completed_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
            [referredBy, referrer.id, newAccountId, 'completed']
          );
        } catch (refErr) { /* ignore duplicate */ }
      }
    }

    res.json({
      id: newAccountId,
      name: name.trim(),
      role,
      permissions,
      referral_code: referralCode
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

// GET /api/accounts/:id/status — trial/subscription status
router.get('/:id/status', (req, res) => {
  const { id } = req.params;
  const status = getAccountStatusById(Number(id));
  res.json(status);
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

// GET /api/accounts/:id/export — RGPD data export
router.get('/:id/export', (req, res) => {
  const { id } = req.params;

  const account = get('SELECT id, name, role, created_at, last_login FROM accounts WHERE id = ?', [id]);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const recipes = all('SELECT * FROM recipes');
  const ingredients = all('SELECT * FROM ingredients');
  const stock = all('SELECT * FROM stock');
  const temperature_logs = all('SELECT * FROM temperature_logs');
  const cleaning_logs = all('SELECT * FROM cleaning_logs');
  const traceability_logs = all('SELECT * FROM traceability_logs');
  const supplier_prices = all('SELECT * FROM supplier_prices');

  const exportData = {
    exported_at: new Date().toISOString(),
    account,
    recipes,
    ingredients,
    stock,
    temperature_logs,
    cleaning_logs,
    traceability_logs,
    supplier_prices
  };

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="restosuite-export-${today}.json"`);
  res.json(exportData);
});

module.exports = router;
