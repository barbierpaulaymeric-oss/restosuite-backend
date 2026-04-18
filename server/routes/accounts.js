// ═══════════════════════════════════════════
// Accounts — Multi-account with PIN auth
// ═══════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db');
const { getAccountStatusById } = require('../middleware/trial');
const { requireAuth, JWT_SECRET } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = express.Router();

function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin, hash) {
  return bcrypt.compareSync(pin, hash);
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

const FOURNISSEUR_PERMISSIONS = {
  view_recipes: false,
  view_costs: false,
  edit_recipes: false,
  view_suppliers: true,
  export_pdf: false
};

const VALID_ROLES = ['gerant', 'cuisinier', 'equipier', 'salle', 'fournisseur'];

function getPermissionsForRole(role) {
  switch (role) {
    case 'gerant': return GERANT_PERMISSIONS;
    case 'cuisinier': return CUISINIER_PERMISSIONS;
    case 'salle': return SALLE_PERMISSIONS;
    case 'fournisseur': return FOURNISSEUR_PERMISSIONS;
    default: return EQUIPIER_DEFAULT_PERMISSIONS;
  }
}

// ─── Public routes (before auth middleware) ───

// POST /api/accounts/login — verify PIN (public — legacy PIN login)
router.post('/login', (req, res) => {
  try {
    const { id, pin } = req.body;

    if (!id || !pin) {
      return res.status(400).json({ error: 'ID et PIN requis' });
    }

    // Validate PIN format: must be exactly 4 digits
    if (!/^\d{4}$/.test(pin.toString())) {
      return res.status(400).json({ error: 'Le PIN doit être 4 chiffres' });
    }

    const account = get('SELECT * FROM accounts WHERE id = ?', [id]);
    if (!account) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }

    if (!account.pin || !verifyPin(pin, account.pin)) {
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
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Auth middleware — all routes below require authentication ───
router.use(requireAuth);

// GET /api/accounts — list accounts for the caller's tenant only (no PIN)
router.get('/', (req, res) => {
  const rid = req.user && req.user.restaurant_id;
  if (!rid) {
    return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  }
  const accounts = all(
    'SELECT id, name, role, permissions, created_at, last_login, zones, skills, hire_date, training_notes, CASE WHEN pin IS NOT NULL AND pin != \'\' THEN 1 ELSE 0 END as has_pin FROM accounts WHERE restaurant_id = ? ORDER BY created_at ASC',
    [rid]
  );
  res.json(accounts.map(a => ({
    ...a,
    permissions: JSON.parse(a.permissions)
  })));
});

// POST /api/accounts — create account
// Role assignment is restricted to gérants (PENTEST_REPORT C2.2). A non-gérant
// calling this endpoint can only create équipier accounts; any other requested
// role is silently downgraded to 'equipier'.
router.post('/', (req, res) => {
  try {
    const { name, pin } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    // PIN is optional — member will create their own via /api/auth/staff-pin/create
    const pinValue = pin && /^\d{4}$/.test(pin.toString()) ? pin : null;

    // Check if this is the first account → becomes gerant
    const existing = all('SELECT id FROM accounts');
    const isFirst = existing.length === 0;
    const requestedRole = req.body.role;
    const callerIsGerant = req.user && req.user.role === 'gerant';

    let role;
    if (isFirst) {
      role = 'gerant';
    } else if (callerIsGerant && requestedRole && VALID_ROLES.includes(requestedRole)) {
      role = requestedRole;
    } else {
      // Non-gérants may only create 'equipier' regardless of requested role.
      role = 'equipier';
    }
    const permissions = getPermissionsForRole(role);

    const hashedPin = pinValue ? hashPin(pinValue) : null;

    // Get restaurant_id from authenticated user
    let restaurantId = null;
    if (req.user && req.user.id) {
      const caller = get('SELECT restaurant_id FROM accounts WHERE id = ?', [req.user.id]);
      if (caller) restaurantId = caller.restaurant_id;
    }

    const result = run(
      'INSERT INTO accounts (name, pin, role, permissions, restaurant_id, trial_start) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))',
      [name.trim(), hashedPin, role, JSON.stringify(permissions), restaurantId]
    );

    const newAccountId = result.lastInsertRowid;

    res.json({
      id: newAccountId,
      name: name.trim(),
      role,
      permissions
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/accounts/:id/status — trial/subscription status
// Tenant-scoped — prior version allowed ID enumeration across tenants and leaked
// subscription tier / trial-end dates (PENTEST_REPORT C1.3). Cross-tenant miss
// returns 404 per feedback_cross_tenant_404_not_403.
router.get('/:id/status', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'id invalide' });
  }
  const callerRid = req.user && req.user.restaurant_id;
  if (!callerRid) {
    return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  }
  const target = get(
    'SELECT id FROM accounts WHERE id = ? AND restaurant_id = ?',
    [targetId, callerRid]
  );
  if (!target) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }
  const status = getAccountStatusById(targetId);
  res.json(status);
});

// PUT /api/accounts/:id — update account (same-tenant gérant OR self-update)
// IDOR fix: scope target lookup + UPDATE by caller.restaurant_id.
// Non-gérant may only update their own account, and cannot change role/permissions.
router.put('/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'id invalide' });
  }
  const { name, permissions } = req.body;

  const callerId = parseInt(req.user.id, 10);
  const callerRole = req.user.role;
  const callerRid = req.user.restaurant_id;
  const isSelf = callerId === targetId;
  const isGerant = callerRole === 'gerant';

  if (!callerRid) {
    return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  }

  // Only gérant may modify OTHER accounts; anyone may update their own
  if (!isSelf && !isGerant) {
    return res.status(403).json({ error: 'Accès refusé — gérant uniquement' });
  }

  // Non-gérant self-update cannot escalate role or rewrite permissions
  if (!isGerant && (req.body.role !== undefined || req.body.permissions !== undefined)) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre rôle ou vos permissions' });
  }

  // Tenant-scoped lookup — target must belong to caller's restaurant
  const account = get(
    'SELECT * FROM accounts WHERE id = ? AND restaurant_id = ?',
    [targetId, callerRid]
  );
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  // Cannot modify another gérant's permissions (self-gérant edit is still allowed)
  if (account.role === 'gerant' && !isSelf) {
    return res.status(403).json({ error: 'Impossible de modifier les permissions du gérant' });
  }

  const updates = [];
  const params = [];

  if (name && name.trim()) {
    updates.push('name = ?');
    params.push(name.trim());
  }

  if (isGerant && req.body.role && VALID_ROLES.includes(req.body.role) && req.body.role !== 'gerant') {
    updates.push('role = ?');
    params.push(req.body.role);
  }

  if (isGerant && permissions) {
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

  // New fields: zones, skills, hire_date, training_notes
  if (req.body.zones !== undefined) {
    updates.push('zones = ?');
    params.push(typeof req.body.zones === 'string' ? req.body.zones : JSON.stringify(req.body.zones));
  }
  if (req.body.skills !== undefined) {
    updates.push('skills = ?');
    params.push(typeof req.body.skills === 'string' ? req.body.skills : JSON.stringify(req.body.skills));
  }
  if (req.body.hire_date !== undefined) {
    updates.push('hire_date = ?');
    params.push(req.body.hire_date || null);
  }
  if (req.body.training_notes !== undefined) {
    updates.push('training_notes = ?');
    params.push(req.body.training_notes || '');
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Rien à modifier' });
  }

  params.push(targetId, callerRid);
  run(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ? AND restaurant_id = ?`, params);

  const updated = get(
    'SELECT id, name, role, permissions, created_at, last_login FROM accounts WHERE id = ? AND restaurant_id = ?',
    [targetId, callerRid]
  );
  try {
    writeAudit({
      restaurant_id: callerRid,
      account_id: callerId,
      table_name: 'accounts',
      record_id: targetId,
      action: 'update',
      old_values: { name: account.name, role: account.role, permissions: account.permissions },
      new_values: { name: updated.name, role: updated.role, permissions: updated.permissions },
    });
  } catch (auditErr) { console.error('audit_log write failed:', auditErr); }

  res.json({
    ...updated,
    permissions: JSON.parse(updated.permissions)
  });
});

// PUT /api/accounts/:id/reset-pin — reset member PIN (same-tenant gérant only)
// IDOR fix: scope target lookup + UPDATE by caller.restaurant_id.
router.put('/:id/reset-pin', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'id invalide' });
  }

  const callerId = parseInt(req.user.id, 10);
  const callerRole = req.user.role;
  const callerRid = req.user.restaurant_id;

  if (callerRole !== 'gerant') {
    return res.status(403).json({ error: 'Accès refusé — gérant uniquement' });
  }
  if (!callerRid) {
    return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  }

  const account = get(
    'SELECT * FROM accounts WHERE id = ? AND restaurant_id = ?',
    [targetId, callerRid]
  );
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  if (account.role === 'gerant') {
    return res.status(403).json({ error: 'Impossible de réinitialiser le PIN du gérant' });
  }

  run('UPDATE accounts SET pin = NULL WHERE id = ? AND restaurant_id = ?', [targetId, callerRid]);
  try {
    writeAudit({
      restaurant_id: callerRid,
      account_id: callerId,
      table_name: 'accounts',
      record_id: targetId,
      action: 'update',
      old_values: { pin: '***set***' },
      new_values: { pin: null, reset: true },
    });
  } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
  res.json({ success: true, message: 'PIN réinitialisé. Le membre devra créer un nouveau PIN à sa prochaine connexion.' });
});

// DELETE /api/accounts/:id — delete account (same-tenant gérant only)
// IDOR fix: scope target lookup + DELETE by caller.restaurant_id.
router.delete('/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'id invalide' });
  }

  const callerId = parseInt(req.user.id, 10);
  const callerRole = req.user.role;
  const callerRid = req.user.restaurant_id;

  if (callerRole !== 'gerant') {
    return res.status(403).json({ error: 'Accès refusé — gérant uniquement' });
  }
  if (!callerRid) {
    return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  }

  // Cannot delete own account
  if (callerId === targetId) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  }

  const account = get(
    'SELECT * FROM accounts WHERE id = ? AND restaurant_id = ?',
    [targetId, callerRid]
  );
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  if (account.role === 'gerant') {
    return res.status(403).json({ error: 'Impossible de supprimer le compte gérant' });
  }

  run('DELETE FROM accounts WHERE id = ? AND restaurant_id = ?', [targetId, callerRid]);
  try {
    writeAudit({
      restaurant_id: callerRid,
      account_id: callerId,
      table_name: 'accounts',
      record_id: targetId,
      action: 'delete',
      old_values: { name: account.name, role: account.role, email: account.email },
      new_values: null,
    });
  } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
  res.json({ success: true });
});

// GET /api/accounts/:id/export — RGPD data export (self or same-tenant gérant)
// Phase 2 (restored): bulk data scoped to the target account's restaurant_id.
// Ref: EVAL_SECURITE_EXPERT.md C-2, docs/plans/2026-04-17-multi-tenancy-isolation-design.md
router.get('/:id/export', requireAuth, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'id invalide' });
  }

  const target = get(
    'SELECT id, name, email, role, restaurant_id, created_at, last_login FROM accounts WHERE id = ?',
    [targetId]
  );
  if (!target) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const callerId = parseInt(req.user.id, 10);
  const callerRole = req.user.role;
  const callerRestaurantId = req.user.restaurant_id;

  const isSelf = callerId === targetId;
  const isSameTenantGerant =
    callerRole === 'gerant' &&
    callerRestaurantId != null &&
    callerRestaurantId === target.restaurant_id;

  if (!isSelf && !isSameTenantGerant) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const rid = target.restaurant_id;
  const restaurant = rid
    ? get('SELECT id, name, address, created_at FROM restaurants WHERE id = ?', [rid])
    : null;

  // Tenant-scoped bulk data. Every SELECT filters by restaurant_id.
  // Wrapped in try/catch per-table so a missing optional table doesn't kill the whole export.
  const safeAll = (sql, params) => {
    try { return all(sql, params); } catch { return []; }
  };

  const bulk = rid ? {
    recipes: safeAll('SELECT * FROM recipes WHERE restaurant_id = ?', [rid]),
    ingredients: safeAll('SELECT * FROM ingredients WHERE restaurant_id = ?', [rid]),
    stock: safeAll('SELECT * FROM stock WHERE restaurant_id = ?', [rid]),
    suppliers: safeAll('SELECT * FROM suppliers WHERE restaurant_id = ?', [rid]),
    supplier_prices: safeAll('SELECT * FROM supplier_prices WHERE restaurant_id = ?', [rid]),
    temperature_logs: safeAll('SELECT * FROM temperature_logs WHERE restaurant_id = ?', [rid]),
    cleaning_logs: safeAll('SELECT * FROM cleaning_logs WHERE restaurant_id = ?', [rid]),
    traceability_logs: safeAll('SELECT * FROM traceability_logs WHERE restaurant_id = ?', [rid]),
  } : {};

  const exportData = {
    exported_at: new Date().toISOString(),
    account: target,
    restaurant,
    ...bulk,
  };

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="restosuite-export-${today}.json"`);
  res.json(exportData);
});

// DELETE /api/accounts/self — delete own account + restaurant (gérant full wipe)
// Used for testing or when a gérant wants to delete everything
router.delete('/self', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  let account = null;
  try {
    const decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
    account = get('SELECT * FROM accounts WHERE id = ?', [decoded.id]);
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide' });
  }

  if (!account || account.role !== 'gerant') {
    return res.status(403).json({ error: 'Réservé au gérant' });
  }

  const { confirmation } = req.body;
  if (confirmation !== 'SUPPRIMER') {
    return res.status(400).json({ error: 'Tapez SUPPRIMER pour confirmer' });
  }

  const { db } = require('../db');
  const transaction = db.transaction(() => {
    const restaurantId = account.restaurant_id;

    // Without a restaurant_id we cannot scope the delete — only remove the orphan account.
    if (!restaurantId) {
      run('DELETE FROM accounts WHERE id = ? AND restaurant_id IS NULL', [account.id]);
      return;
    }

    // Clean up tenant-scoped data tables. order_items / recipe_ingredients / delivery_note_items
    // don't carry restaurant_id directly — delete via their parent row.
    const tenantTables = [
      'recipes', 'ingredients', 'stock', 'stock_movements',
      'suppliers', 'supplier_prices', 'supplier_accounts', 'supplier_catalog',
      'price_change_notifications', 'price_history',
      'temperature_logs', 'cleaning_logs', 'traceability_logs',
      'orders', 'purchase_orders', 'delivery_notes',
      'referrals'
    ];

    // Delete child rows first (they join through parents that carry restaurant_id)
    try { run('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)', [restaurantId]); } catch {}
    try { run('DELETE FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE restaurant_id = ?)', [restaurantId]); } catch {}
    try { run('DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE restaurant_id = ?)', [restaurantId]); } catch {}
    try { run('DELETE FROM delivery_note_items WHERE delivery_note_id IN (SELECT id FROM delivery_notes WHERE restaurant_id = ?)', [restaurantId]); } catch {}
    // tables_config stores per-restaurant table layout
    try { run('DELETE FROM tables_config WHERE restaurant_id = ?', [restaurantId]); } catch {}

    for (const table of tenantTables) {
      try { run(`DELETE FROM ${table} WHERE restaurant_id = ?`, [restaurantId]); } catch (e) { /* table may not exist */ }
    }

    // Finally, delete the accounts and restaurant row
    run('DELETE FROM accounts WHERE restaurant_id = ?', [restaurantId]);
    run('DELETE FROM restaurants WHERE id = ?', [restaurantId]);
  });

  try {
    transaction();
    res.json({ success: true, message: 'Compte et données supprimés' });
  } catch (e) {
    console.error('Self-delete error:', e);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// POST /api/accounts/staff-password — set staff password (gerant only)
router.post('/staff-password', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Le code est requis' });
    }

    if (!/^\d{4,}$/.test(password)) {
      return res.status(400).json({ error: 'Le code doit contenir 4 chiffres minimum' });
    }

    // Get account from authenticated user (requireAuth ensures valid JWT)
    const account = get('SELECT * FROM accounts WHERE id = ?', [req.user.id]);

    // Verify account is gerant
    if (!account || account.role !== 'gerant') {
      return res.status(403).json({ error: 'Accès refusé — gérant uniquement' });
    }

    // Get restaurant associated with this account
    if (!account.restaurant_id) {
      return res.status(400).json({ error: 'Restaurant non associé' });
    }

    // Hash the password
    const hashedPassword = hashPin(password);

    // Update staff password
    run('UPDATE restaurants SET staff_password = ? WHERE id = ?', [hashedPassword, account.restaurant_id]);

    res.json({ success: true, message: 'Code d\'accès enregistré' });
  } catch (e) {
    console.error('Error setting staff password:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
