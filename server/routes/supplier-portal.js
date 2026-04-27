// ═══════════════════════════════════════════
// Supplier Portal — API Routes
// ═══════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { parseXlsxBuffer, normalizeItems } = require('../lib/mercuriale-parse');
const { categorize, CATEGORIES } = require('../lib/mercuriale-categorize');
const router = express.Router();

// Mercuriale upload — accepts XLSX (deterministic parse) and PDF (Gemini Vision).
// Separate multer instance from ai-core's image uploader because the mime list
// is different (XLSX is the new shape and we don't want to widen the AI uploader).
const MERCURIALE_UPLOAD_DIR = '/tmp/restosuite-uploads';
if (!fs.existsSync(MERCURIALE_UPLOAD_DIR)) fs.mkdirSync(MERCURIALE_UPLOAD_DIR, { recursive: true });
const MERCURIALE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls — best-effort, ExcelJS may not parse legacy BIFF
]);
const mercurialeUpload = multer({
  dest: MERCURIALE_UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (MERCURIALE_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Formats acceptés : PDF, XLSX.'));
    }
  },
});

// PENTEST_REPORT C8.2 — no JWT_SECRET fallback. Fail loud at first use.
function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not configured');
  return s;
}

function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin, hash) {
  return bcrypt.compareSync(pin, hash);
}

const SUPPLIER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// PENTEST_REPORT A.2 — store sha256(access_token) instead of the raw token.
// The raw token is returned to the supplier once on login; we keep only a
// one-way digest so a DB leak doesn't hand attackers working session tokens.
function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function tokenExpiresAt() {
  return new Date(Date.now() + SUPPLIER_TOKEN_TTL_MS).toISOString();
}

// ─── Multi-tenant supplier identity expansion ───
// A supplier_account is bound to ONE (supplier_id, restaurant_id) pair, but in
// reality a wholesaler like "Metro Paris Nation" serves many restaurants and
// each restaurant has its own suppliers row. We treat all suppliers rows that
// share the bound supplier's email as the same vendor identity for READ-ONLY
// portal views (Mes clients, Historique, Dashboard, Stats, Notifications,
// /orders, /orders/:id, pending-count). This lets the demo prospect logging
// in see all 3 demo restaurants. Write endpoints (catalog edit, mercuriale,
// price-overrides, confirm/refuse, mark-read) stay bound to the single
// supplier_account so each tenant's edits don't bleed across.
//
// The email match is the cheapest + safest key for now. A future real-world
// rollout should add an explicit `supplier_account_tenants` M:N table.
function getSupplierIdentities(supplierAccount) {
  const me = get('SELECT email FROM suppliers WHERE id = ?', [supplierAccount.supplier_id]);
  if (!me || !me.email) {
    // Bound supplier has no email → fall back to the single-tenant view.
    return [{ supplier_id: supplierAccount.supplier_id, restaurant_id: supplierAccount.restaurant_id }];
  }
  const rows = all(
    'SELECT id AS supplier_id, restaurant_id FROM suppliers WHERE email = ?',
    [me.email]
  );
  return rows.length
    ? rows
    : [{ supplier_id: supplierAccount.supplier_id, restaurant_id: supplierAccount.restaurant_id }];
}

// Helper: build a SQL fragment + params that match the (supplier_id,
// restaurant_id) pairs in the identity list. Pairs are OR-ed:
//   (po.supplier_id = ? AND po.restaurant_id = ?) OR (...) OR (...)
function identityWhereClause(identities, supplierCol = 'supplier_id', restaurantCol = 'restaurant_id', tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const clauses = identities.map(() => `(${prefix}${supplierCol} = ? AND ${prefix}${restaurantCol} = ?)`);
  const params = [];
  for (const i of identities) { params.push(i.supplier_id, i.restaurant_id); }
  return { sql: clauses.join(' OR '), params };
}

// ─── Middleware: Authenticate supplier via token ───
// PENTEST_REPORT A.2 — lookup compares sha256(presented token) against stored
// token_hash. Legacy access_token column is no longer read.
function requireSupplierAuth(req, res, next) {
  const token = req.headers['x-supplier-token'];
  if (!token) {
    return res.status(401).json({ error: 'Token fournisseur requis' });
  }
  const h = hashToken(token);
  const account = get(
    `SELECT sa.*, s.name as supplier_name
       FROM supplier_accounts sa
       JOIN suppliers s ON s.id = sa.supplier_id
      WHERE sa.token_hash = ?`,
    [h]
  );
  if (!account) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  // Reject tokens that have no expiry (issued before this fix) or have expired
  if (!account.token_expires_at || new Date(account.token_expires_at) < new Date()) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  req.supplierAccount = account;
  next();
}

// Ensure the token_hash column exists; backfill from legacy plaintext so any
// already-issued supplier session keeps working across the deploy.
try {
  const cols = all("PRAGMA table_info('supplier_accounts')").map(c => c.name);
  if (!cols.includes('token_hash')) {
    run('ALTER TABLE supplier_accounts ADD COLUMN token_hash TEXT');
  }
  const legacy = all("SELECT id, access_token FROM supplier_accounts WHERE access_token IS NOT NULL AND (token_hash IS NULL OR token_hash = '')");
  for (const row of legacy) {
    run('UPDATE supplier_accounts SET token_hash = ? WHERE id = ?', [hashToken(row.access_token), row.id]);
  }
} catch (e) {
  if (!/duplicate column|no such table/i.test(e && e.message || '')) {
    console.error('supplier_accounts token_hash migration failed:', e);
  }
}

// ═════════════════════════════════════════
// RESTAURANT SIDE (gérant)
// ═════════════════════════════════════════

// POST /invite — Create supplier portal access
router.post('/invite', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  const { supplier_id, pin, name, email, password } = req.body;
  if (!supplier_id) {
    return res.status(400).json({ error: 'supplier_id requis' });
  }

  const supplier = get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplier_id, rid]);
  if (!supplier) {
    return res.status(404).json({ error: 'Fournisseur introuvable' });
  }

  // If email+password provided, set up company-level auth on the supplier
  if (email && password) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    }
    const emailLower = email.trim().toLowerCase();
    const existingEmail = get('SELECT id FROM suppliers WHERE email = ? AND id != ? AND restaurant_id = ?', [emailLower, supplier_id, rid]);
    if (existingEmail) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé par un autre fournisseur' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    run('UPDATE suppliers SET email = ?, password_hash = ?, contact_name = ? WHERE id = ? AND restaurant_id = ?',
      [emailLower, passwordHash, name || supplier.name, supplier_id, rid]);
  }

  // If PIN provided, create a member account within this supplier
  if (pin) {
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'Le PIN doit être entre 4 et 6 chiffres' });
    }
    const existing = get('SELECT id FROM supplier_accounts WHERE supplier_id = ? AND restaurant_id = ?', [supplier_id, rid]);
    if (existing) {
      return res.status(409).json({ error: 'Ce fournisseur a déjà un compte membre portail' });
    }
    const hashedPin = hashPin(pin);
    const accountName = name || supplier.name;
    run(
      'INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin) VALUES (?, ?, ?, ?, ?)',
      [rid, supplier_id, accountName, email || null, hashedPin]
    );
  }

  res.status(201).json({ success: true, supplier_id });
});

// GET /accounts — List supplier accounts
router.get('/accounts', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  const accounts = all(`
    SELECT sa.id, sa.supplier_id, sa.name, sa.email, sa.last_login, sa.created_at,
           s.name as supplier_name
    FROM supplier_accounts sa
    JOIN suppliers s ON s.id = sa.supplier_id AND s.restaurant_id = ?
    WHERE sa.restaurant_id = ?
    ORDER BY sa.created_at DESC
  `, [rid, rid]);
  res.json(accounts);
});

// DELETE /accounts/:id — Revoke supplier access
router.delete('/accounts/:id', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  const account = get('SELECT * FROM supplier_accounts WHERE id = ? AND restaurant_id = ?', [id, rid]);
  if (!account) {
    return res.status(404).json({ error: 'Compte fournisseur introuvable' });
  }
  run('DELETE FROM supplier_accounts WHERE id = ? AND restaurant_id = ?', [id, rid]);
  res.json({ success: true });
});

// POST /accounts/add-member — Add a member to a supplier company
router.post('/accounts/add-member', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  const { supplier_id, name, pin, email } = req.body;
  if (!supplier_id || !name || !pin) {
    return res.status(400).json({ error: 'supplier_id, name et pin requis' });
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'Le PIN doit être entre 4 et 6 chiffres' });
  }

  const supplier = get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplier_id, rid]);
  if (!supplier) {
    return res.status(404).json({ error: 'Fournisseur introuvable' });
  }

  // PENTEST_REPORT A.1 — the previous PIN-uniqueness check was broken:
  // bcrypt salts randomly, so hashing the candidate PIN and comparing against
  // a stored hash via `=` never matched. The check rejected nothing in
  // practice. We drop the check entirely — duplicate PINs across members are
  // acceptable because member selection happens via the picker (member_id is
  // already part of /member-pin), so no disambiguation is needed.
  const hashedPin = hashPin(pin);

  const result = run(
    'INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin) VALUES (?, ?, ?, ?, ?)',
    [rid, supplier_id, name, email || null, hashedPin]
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    supplier_id,
    name,
    email: email || null
  });
});

// GET /notifications — Price change notifications
router.get('/notifications', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  const notifications = all(`
    SELECT pcn.*, s.name as supplier_name
    FROM price_change_notifications pcn
    JOIN suppliers s ON s.id = pcn.supplier_id AND s.restaurant_id = ?
    WHERE pcn.restaurant_id = ?
    ORDER BY pcn.created_at DESC
    LIMIT 100
  `, [rid, rid]);
  res.json(notifications);
});

// GET /notifications/unread-count — Badge count
router.get('/notifications/unread-count', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  const result = get('SELECT COUNT(*) as count FROM price_change_notifications WHERE read = 0 AND restaurant_id = ?', [rid]);
  res.json({ count: result.count });
});

// PUT /notifications/:id/read — Mark as read
router.put('/notifications/:id/read', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  run('UPDATE price_change_notifications SET read = 1 WHERE id = ? AND restaurant_id = ?', [id, rid]);
  res.json({ success: true });
});

// PUT /notifications/read-all — Mark all as read
router.put('/notifications/read-all', requireAuth, (req, res) => {
  const rid = req.user.restaurant_id;
  run('UPDATE price_change_notifications SET read = 1 WHERE read = 0 AND restaurant_id = ?', [rid]);
  res.json({ success: true });
});

// ═════════════════════════════════════════
// SUPPLIER SIDE (fournisseur)
// ═════════════════════════════════════════

// PENTEST_REPORT A.3 — supplier emails are NOT globally unique (they're
// scoped per-tenant in /invite), so a lookup-by-email-only can return the
// wrong row across restaurants. We resolve by iterating every row whose email
// matches and returning the one whose password_hash verifies. In practice
// dup-email collisions are rare, so this stays O(1) on the common path.
function findSupplierByCredentials(emailLower, password) {
  const rows = all('SELECT * FROM suppliers WHERE email = ?', [emailLower]);
  for (const row of rows) {
    if (row.password_hash && bcrypt.compareSync(password, row.password_hash)) {
      return row;
    }
  }
  return null;
}

// POST /company-login — Supplier company login with email + password
// Returns supplier info + list of member accounts for the team picker
router.post('/company-login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const supplier = findSupplierByCredentials(email.trim().toLowerCase(), password);
  if (!supplier) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  // Get member accounts for this supplier company
  const members = all(
    'SELECT id, name, email FROM supplier_accounts WHERE supplier_id = ? ORDER BY name ASC',
    [supplier.id]
  );

  res.json({
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    contact_name: supplier.contact_name,
    members
  });
});

// POST /member-pin — Supplier member PIN login (scoped to supplier company)
router.post('/member-pin', (req, res) => {
  const { supplier_id, account_id, pin } = req.body;
  if (!supplier_id || !account_id || !pin) {
    return res.status(400).json({ error: 'supplier_id, account_id et PIN requis' });
  }
  if (!/^\d{4,6}$/.test(pin.toString())) {
    return res.status(400).json({ error: 'Le PIN doit être 4-6 chiffres' });
  }

  // Verify the account belongs to this supplier
  const account = get(
    'SELECT sa.*, s.name as supplier_name FROM supplier_accounts sa JOIN suppliers s ON s.id = sa.supplier_id WHERE sa.id = ? AND sa.supplier_id = ?',
    [account_id, supplier_id]
  );
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable pour ce fournisseur' });
  }

  if (!account.pin || !verifyPin(pin, account.pin)) {
    return res.status(401).json({ error: 'PIN incorrect' });
  }

  // Generate access token with 30-day expiry. PENTEST_REPORT A.2 — we store
  // sha256(token); the raw token is returned to the supplier once, here.
  const token = generateToken();
  run(
    `UPDATE supplier_accounts
        SET access_token = NULL, token_hash = ?, token_expires_at = ?, last_login = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [hashToken(token), tokenExpiresAt(), account.id]
  );

  res.json({
    token,
    supplier_id: account.supplier_id,
    supplier_name: account.supplier_name,
    account_id: account.id,
    name: account.name
  });
});

// POST /quick-login — Direct company login (no members, single-user supplier)
// For suppliers with only one member account, skip the picker
router.post('/quick-login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const supplier = findSupplierByCredentials(email.trim().toLowerCase(), password);
  if (!supplier) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  // If single member, auto-login
  const members = all('SELECT * FROM supplier_accounts WHERE supplier_id = ?', [supplier.id]);
  if (members.length === 1) {
    const account = members[0];
    const token = generateToken();
    run(
      `UPDATE supplier_accounts
          SET access_token = NULL, token_hash = ?, token_expires_at = ?, last_login = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [hashToken(token), tokenExpiresAt(), account.id]
    );
    return res.json({
      token,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      account_id: account.id,
      name: account.name,
      auto_login: true
    });
  }

  // Multiple members — return list for picker
  res.json({
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    members: members.map(m => ({ id: m.id, name: m.name, email: m.email })),
    auto_login: false
  });
});

// GET /catalog — Get my catalog (authenticated supplier)
router.get('/catalog', requireSupplierAuth, (req, res) => {
  const rid = req.supplierAccount.restaurant_id;
  const catalog = all(
    'SELECT * FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? ORDER BY category, product_name',
    [req.supplierAccount.supplier_id, rid]
  );
  res.json(catalog);
});

// POST /catalog — Add product to catalog
router.post('/catalog', requireSupplierAuth, (req, res) => {
  const rid = req.supplierAccount.restaurant_id;
  const { product_name, category, unit, price, min_order, sku, tva_rate, packaging } = req.body;
  if (!product_name || !unit || price == null) {
    return res.status(400).json({ error: 'product_name, unit et price requis' });
  }

  const result = run(
    `INSERT INTO supplier_catalog
       (restaurant_id, supplier_id, product_name, category, unit, price, min_order, sku, tva_rate, packaging)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rid, req.supplierAccount.supplier_id, product_name, category || null, unit, price,
      min_order || 0, sku || null,
      // 5.5% covers food by default; UI can override for alcohol (20%) etc.
      tva_rate != null ? Number(tva_rate) : 5.5,
      packaging || null,
    ]
  );

  // Create notification for new product
  run(
    'INSERT INTO price_change_notifications (restaurant_id, supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, NULL, ?, ?)',
    [rid, req.supplierAccount.supplier_id, product_name, price, 'new']
  );

  const item = get('SELECT * FROM supplier_catalog WHERE id = ? AND restaurant_id = ?', [result.lastInsertRowid, rid]);
  res.status(201).json(item);
});

// PUT /catalog/:id — Update product
router.put('/catalog/:id', requireSupplierAuth, (req, res) => {
  const rid = req.supplierAccount.restaurant_id;
  const id = Number(req.params.id);
  const item = get('SELECT * FROM supplier_catalog WHERE id = ? AND supplier_id = ? AND restaurant_id = ?', [id, req.supplierAccount.supplier_id, rid]);
  if (!item) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  const { product_name, category, unit, price, min_order, sku, tva_rate, packaging } = req.body;
  const newPrice = price != null ? price : item.price;
  const oldPrice = item.price;

  run(
    `UPDATE supplier_catalog SET
       product_name = ?, category = ?, unit = ?, price = ?, min_order = ?,
       sku = ?, tva_rate = ?, packaging = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND restaurant_id = ?`,
    [
      product_name || item.product_name,
      category !== undefined ? category : item.category,
      unit || item.unit,
      newPrice,
      min_order != null ? min_order : item.min_order,
      sku !== undefined ? (sku || null) : item.sku,
      tva_rate != null ? Number(tva_rate) : (item.tva_rate != null ? item.tva_rate : 5.5),
      packaging !== undefined ? (packaging || null) : item.packaging,
      id,
      rid,
    ]
  );

  // If price changed, create notification and update supplier_prices
  if (price != null && price !== oldPrice) {
    run(
      'INSERT INTO price_change_notifications (restaurant_id, supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, ?, ?, ?)',
      [rid, req.supplierAccount.supplier_id, product_name || item.product_name, oldPrice, newPrice, 'update']
    );

    // Try to update linked supplier_prices (match by product name → ingredient name)
    const linkedIngredient = get(
      'SELECT i.id FROM ingredients i JOIN supplier_prices sp ON sp.ingredient_id = i.id AND sp.restaurant_id = ? WHERE sp.supplier_id = ? AND i.restaurant_id = ? AND LOWER(i.name) = LOWER(?)',
      [rid, req.supplierAccount.supplier_id, rid, product_name || item.product_name]
    );
    if (linkedIngredient) {
      run(
        'UPDATE supplier_prices SET price = ?, last_updated = CURRENT_TIMESTAMP WHERE supplier_id = ? AND ingredient_id = ? AND restaurant_id = ?',
        [newPrice, req.supplierAccount.supplier_id, linkedIngredient.id, rid]
      );
      // Record in price history
      run(
        'INSERT INTO price_history (restaurant_id, ingredient_id, supplier_id, price) VALUES (?, ?, ?, ?)',
        [rid, linkedIngredient.id, req.supplierAccount.supplier_id, newPrice]
      );
    }
  }

  const updated = get('SELECT * FROM supplier_catalog WHERE id = ? AND restaurant_id = ?', [id, rid]);
  res.json(updated);
});

// DELETE /catalog/:id — Remove product
router.delete('/catalog/:id', requireSupplierAuth, (req, res) => {
  const rid = req.supplierAccount.restaurant_id;
  const id = Number(req.params.id);
  const item = get('SELECT * FROM supplier_catalog WHERE id = ? AND supplier_id = ? AND restaurant_id = ?', [id, req.supplierAccount.supplier_id, rid]);
  if (!item) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  // Create notification for removal
  run(
    'INSERT INTO price_change_notifications (restaurant_id, supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, ?, NULL, ?)',
    [rid, req.supplierAccount.supplier_id, item.product_name, item.price, 'removed']
  );

  run('DELETE FROM supplier_catalog WHERE id = ? AND restaurant_id = ?', [id, rid]);
  res.json({ success: true });
});

// PUT /catalog/:id/availability — Toggle availability
router.put('/catalog/:id/availability', requireSupplierAuth, (req, res) => {
  const rid = req.supplierAccount.restaurant_id;
  const id = Number(req.params.id);
  const item = get('SELECT * FROM supplier_catalog WHERE id = ? AND supplier_id = ? AND restaurant_id = ?', [id, req.supplierAccount.supplier_id, rid]);
  if (!item) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  const { available } = req.body;
  const newAvailable = available != null ? (available ? 1 : 0) : (item.available ? 0 : 1);

  run('UPDATE supplier_catalog SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?', [newAvailable, id, rid]);

  // Notify if product becomes unavailable
  if (!newAvailable) {
    run(
      'INSERT INTO price_change_notifications (restaurant_id, supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, ?, ?, ?)',
      [rid, req.supplierAccount.supplier_id, item.product_name, item.price, item.price, 'unavailable']
    );
  }

  const updated = get('SELECT * FROM supplier_catalog WHERE id = ? AND restaurant_id = ?', [id, rid]);
  res.json(updated);
});

// GET /history — Supplier's change history
router.get('/history', requireSupplierAuth, (req, res) => {
  const rid = req.supplierAccount.restaurant_id;
  const history = all(
    'SELECT * FROM price_change_notifications WHERE supplier_id = ? AND restaurant_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.supplierAccount.supplier_id, rid]
  );
  res.json(history);
});

// ═════════════════════════════════════════
// DELIVERY NOTES (supplier side)
// ═════════════════════════════════════════

// POST /delivery-notes — Create a delivery note
router.post('/delivery-notes', requireSupplierAuth, (req, res) => {
  const { delivery_date, notes, items } = req.body;
  const supplierId = req.supplierAccount.supplier_id;
  const rid = req.supplierAccount.restaurant_id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Au moins un produit est requis' });
  }

  const { db } = require('../db');
  const transaction = db.transaction(() => {
    let totalAmount = 0;

    const noteResult = run(
      'INSERT INTO delivery_notes (restaurant_id, supplier_id, delivery_date, notes) VALUES (?, ?, ?, ?)',
      [rid, supplierId, delivery_date || null, notes || null]
    );
    const noteId = noteResult.lastInsertRowid;

    for (const item of items) {
      // Try to match ingredient by name (scoped to this tenant)
      let ingredientId = null;
      if (item.product_name) {
        const matched = get('SELECT id FROM ingredients WHERE name LIKE ? COLLATE NOCASE AND restaurant_id = ?', [item.product_name.trim(), rid]);
        if (matched) ingredientId = matched.id;
      }

      const lineTotal = (item.quantity || 0) * (item.price_per_unit || 0);
      totalAmount += lineTotal;

      run(
        `INSERT INTO delivery_note_items (restaurant_id, delivery_note_id, ingredient_id, product_name, quantity, unit, price_per_unit, batch_number, dlc, temperature_required, fishing_zone, fishing_method, origin, sanitary_approval, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rid, noteId, ingredientId, item.product_name, item.quantity || 0, item.unit || 'kg',
         item.price_per_unit || null, item.batch_number || null, item.dlc || null,
         item.temperature_required || null, item.fishing_zone || null, item.fishing_method || null,
         item.origin || null, item.sanitary_approval || null, item.notes || null]
      );
    }

    // Update total
    run('UPDATE delivery_notes SET total_amount = ? WHERE id = ? AND restaurant_id = ?', [totalAmount, noteId, rid]);

    // Return the full note
    const note = get('SELECT * FROM delivery_notes WHERE id = ? AND restaurant_id = ?', [noteId, rid]);
    const noteItems = all('SELECT * FROM delivery_note_items WHERE delivery_note_id = ? AND restaurant_id = ?', [noteId, rid]);
    return { ...note, items: noteItems };
  });

  try {
    const result = transaction();
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /delivery-notes — List supplier's delivery notes
router.get('/delivery-notes', requireSupplierAuth, (req, res) => {
  const supplierId = req.supplierAccount.supplier_id;
  const rid = req.supplierAccount.restaurant_id;
  const notes = all(`
    SELECT dn.*,
           (SELECT COUNT(*) FROM delivery_note_items WHERE delivery_note_id = dn.id AND restaurant_id = ?) as item_count
    FROM delivery_notes dn
    WHERE dn.supplier_id = ? AND dn.restaurant_id = ?
    ORDER BY dn.created_at DESC
  `, [rid, supplierId, rid]);
  res.json(notes);
});

// GET /delivery-notes/:id — Delivery note detail
router.get('/delivery-notes/:id', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const supplierId = req.supplierAccount.supplier_id;
  const rid = req.supplierAccount.restaurant_id;

  const note = get('SELECT * FROM delivery_notes WHERE id = ? AND supplier_id = ? AND restaurant_id = ?', [id, supplierId, rid]);
  if (!note) return res.status(404).json({ error: 'Bon de livraison introuvable' });

  const items = all('SELECT * FROM delivery_note_items WHERE delivery_note_id = ? AND restaurant_id = ?', [id, rid]);
  res.json({ ...note, items });
});

// ═════════════════════════════════════════
// PURCHASE ORDERS (supplier side — read-only)
// ═════════════════════════════════════════

// GET /orders — List purchase orders across the supplier's identity tenants.
router.get('/orders', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const orders = all(
    `SELECT po.id, po.reference, po.status, po.total_amount, po.expected_delivery,
            po.notes, po.created_at, r.name AS restaurant_name
       FROM purchase_orders po
       JOIN restaurants r ON r.id = po.restaurant_id
      WHERE ${identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'po').sql}
      ORDER BY po.created_at DESC
      LIMIT 100`,
    identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'po').params
  );
  res.json(orders);
});

// GET /orders/pending-count — count of orders awaiting confirmation across
// the supplier's identity tenants. Drives the Commandes-tab badge.
router.get('/orders/pending-count', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const row = get(
    `SELECT COUNT(*) AS c FROM purchase_orders
      WHERE (${w.sql})
        AND status IN ('brouillon', 'envoyée', 'envoyee')`,
    w.params
  );
  res.json({ count: row.c });
});

// GET /orders/:id — Order detail. Order must live in one of the identity tenants.
router.get('/orders/:id', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const order = get(
    `SELECT * FROM purchase_orders WHERE id = ? AND (${w.sql})`,
    [id, ...w.params]
  );
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = all(
    'SELECT id, product_name, quantity, unit, unit_price, total_price, notes FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?',
    [id, order.restaurant_id]
  );
  res.json({ ...order, items });
});

// PUT /orders/:id/confirm — supplier accepts the order. Optional reason captured
// in notes (appended, not overwritten — we want to keep the restaurant's notes).
router.put('/orders/:id/confirm', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const order = get(
    `SELECT id, status, notes, supplier_id, restaurant_id FROM purchase_orders
      WHERE id = ? AND (${w.sql})`,
    [id, ...w.params]
  );
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (['confirmée', 'confirmee', 'livrée', 'livree', 'refusée', 'refusee'].includes(order.status)) {
    return res.status(409).json({ error: 'Cette commande n\'est plus en attente de confirmation', status: order.status });
  }
  const reason = (req.body && req.body.reason ? String(req.body.reason).trim().slice(0, 500) : '') || null;
  const newNotes = reason
    ? (order.notes ? `${order.notes}\n[Confirmée fournisseur] ${reason}` : `[Confirmée fournisseur] ${reason}`)
    : order.notes;
  run(
    `UPDATE purchase_orders SET status = 'confirmée', notes = ? WHERE id = ? AND supplier_id = ? AND restaurant_id = ?`,
    [newNotes, id, order.supplier_id, order.restaurant_id]
  );
  res.json({ success: true, status: 'confirmée' });
});

// PUT /orders/:id/refuse — supplier rejects the order. Reason recommended (the
// client UI prompts for it) but optional at the API level.
router.put('/orders/:id/refuse', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const order = get(
    `SELECT id, status, notes, supplier_id, restaurant_id FROM purchase_orders
      WHERE id = ? AND (${w.sql})`,
    [id, ...w.params]
  );
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (['confirmée', 'confirmee', 'livrée', 'livree', 'refusée', 'refusee'].includes(order.status)) {
    return res.status(409).json({ error: 'Cette commande n\'est plus en attente de confirmation', status: order.status });
  }
  const reason = (req.body && req.body.reason ? String(req.body.reason).trim().slice(0, 500) : '') || null;
  const newNotes = reason
    ? (order.notes ? `${order.notes}\n[Refusée fournisseur] ${reason}` : `[Refusée fournisseur] ${reason}`)
    : order.notes;
  run(
    `UPDATE purchase_orders SET status = 'refusée', notes = ? WHERE id = ? AND supplier_id = ? AND restaurant_id = ?`,
    [newNotes, id, order.supplier_id, order.restaurant_id]
  );
  res.json({ success: true, status: 'refusée' });
});

// GET /orders/:id/pdf — Buffered order PDF. Same anti-compression pattern as
// the BL endpoint (see feedback_pdf_compression_corruption.md).
router.get('/orders/:id/pdf', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const supplierName = req.supplierAccount.supplier_name;
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'po');

  const order = get(
    `SELECT po.*, r.name AS restaurant_name, r.address AS restaurant_address,
            r.city AS restaurant_city, r.postal_code AS restaurant_postal,
            r.phone AS restaurant_phone
       FROM purchase_orders po
       JOIN restaurants r ON r.id = po.restaurant_id
      WHERE po.id = ? AND (${w.sql})`,
    [id, ...w.params]
  );
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  // The order's own tenant drives the catalog enrichment — each tenant has
  // its own SKU/TVA per row, so we use order.supplier_id / order.restaurant_id
  // (not the logged-in supplier_account's bound tuple).
  const items = all(
    `SELECT poi.id, poi.product_name, poi.quantity, poi.unit, poi.unit_price, poi.total_price,
            sc.sku, sc.tva_rate
       FROM purchase_order_items poi
       LEFT JOIN supplier_catalog sc
              ON LOWER(sc.product_name) = LOWER(poi.product_name)
             AND sc.supplier_id = ?
             AND sc.restaurant_id = ?
      WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?`,
    [order.supplier_id, order.restaurant_id, id, order.restaurant_id]
  );

  // Per-line TVA → aggregate into HT/TVA/TTC totals.
  let totalHt = 0;
  let totalTva = 0;
  for (const it of items) {
    const lineHt = Number(it.total_price) || 0;
    const tvaRate = it.tva_rate != null ? Number(it.tva_rate) : 5.5;
    totalHt += lineHt;
    totalTva += lineHt * (tvaRate / 100);
  }
  totalHt = Math.round(totalHt * 100) / 100;
  totalTva = Math.round(totalTva * 100) / 100;
  const totalTtc = Math.round((totalHt + totalTva) * 100) / 100;

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const safeRef = String(order.reference || `cmd-${id}`).replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 60);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => {
    const buf = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Content-Disposition', `attachment; filename="commande-${safeRef}.pdf"`);
    res.end(buf);
  });
  doc.on('error', (e) => {
    console.error('PDFKit order error:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération PDF' });
  });

  // Header
  doc.font('Helvetica-Bold').fontSize(16).text('Commande fournisseur', { align: 'left' });
  doc.font('Helvetica').fontSize(10).fillColor('#555').text(`Référence : ${order.reference || `#${id}`}`, { align: 'left' });
  doc.moveDown(0.5);

  // Two-column meta: supplier (left) + restaurant client (right)
  const metaY = doc.y;
  const colW = (doc.page.width - 84) / 2;
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(10).text('Fournisseur', 42, metaY);
  doc.font('Helvetica').fontSize(10).text(supplierName || '—', 42, metaY + 14, { width: colW });

  doc.font('Helvetica-Bold').fontSize(10).text('Client (restaurant)', 42 + colW, metaY);
  doc.font('Helvetica').fontSize(10).text(order.restaurant_name || '—', 42 + colW, metaY + 14, { width: colW });
  if (order.restaurant_address || order.restaurant_city) {
    doc.text(`${order.restaurant_address || ''} ${order.restaurant_postal || ''} ${order.restaurant_city || ''}`.trim(), 42 + colW, doc.y, { width: colW });
  }
  if (order.restaurant_phone) doc.text(`Tél : ${order.restaurant_phone}`, 42 + colW, doc.y, { width: colW });

  doc.y = metaY + 60;
  doc.moveTo(42, doc.y).lineTo(doc.page.width - 42, doc.y).strokeColor('#000').stroke();
  doc.moveDown(0.5);

  // Date / status row
  const created = order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '—';
  doc.font('Helvetica-Bold').fontSize(10).text('Date : ', { continued: true }).font('Helvetica').text(created);
  doc.font('Helvetica-Bold').text('Statut : ', { continued: true }).font('Helvetica').text(String(order.status || '—'));
  if (order.expected_delivery) {
    doc.font('Helvetica-Bold').text('Livraison prévue : ', { continued: true }).font('Helvetica').text(String(order.expected_delivery));
  }
  doc.moveDown(0.5);

  // Items table
  const tableY = doc.y + 4;
  const cols = [
    { label: 'Produit',    x: 42,  w: 180 },
    { label: 'SKU',        x: 224, w: 70 },
    { label: 'Qté',        x: 296, w: 35, align: 'right' },
    { label: 'Unité',      x: 333, w: 35 },
    { label: 'P.U. HT',    x: 370, w: 55, align: 'right' },
    { label: 'Total HT',   x: 427, w: 55, align: 'right' },
    { label: 'TVA',        x: 484, w: 32, align: 'right' },
    { label: 'TTC',        x: 518, w: 35, align: 'right' },
  ];
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  for (const c of cols) doc.text(c.label, c.x, tableY, { width: c.w, align: c.align || 'left' });
  doc.moveTo(42, tableY + 14).lineTo(doc.page.width - 42, tableY + 14).strokeColor('#888').stroke();
  let rowY = tableY + 18;

  doc.font('Helvetica').fontSize(9);
  for (const it of items) {
    if (rowY > doc.page.height - 130) { doc.addPage(); rowY = 42; }
    const lineHt = Number(it.total_price) || 0;
    const tvaRate = it.tva_rate != null ? Number(it.tva_rate) : 5.5;
    const lineTva = Math.round(lineHt * tvaRate) / 100;
    const lineTtc = Math.round((lineHt + lineTva) * 100) / 100;
    doc.fillColor('#000');
    doc.text(String(it.product_name || ''), cols[0].x, rowY, { width: cols[0].w });
    doc.text(String(it.sku || ''),         cols[1].x, rowY, { width: cols[1].w });
    doc.text(String(it.quantity ?? ''),    cols[2].x, rowY, { width: cols[2].w, align: 'right' });
    doc.text(String(it.unit || ''),        cols[3].x, rowY, { width: cols[3].w });
    doc.text(`${(Number(it.unit_price) || 0).toFixed(2)} €`,  cols[4].x, rowY, { width: cols[4].w, align: 'right' });
    doc.text(`${lineHt.toFixed(2)} €`,                        cols[5].x, rowY, { width: cols[5].w, align: 'right' });
    doc.text(`${tvaRate}%`,                                   cols[6].x, rowY, { width: cols[6].w, align: 'right' });
    doc.text(`${lineTtc.toFixed(2)} €`,                       cols[7].x, rowY, { width: cols[7].w, align: 'right' });
    rowY += 16;
  }

  // Totals
  if (rowY > doc.page.height - 100) { doc.addPage(); rowY = 42; }
  rowY += 10;
  doc.moveTo(42, rowY).lineTo(doc.page.width - 42, rowY).strokeColor('#000').stroke();
  rowY += 10;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000');
  const totalsX = doc.page.width - 42 - 200;
  doc.text(`Total HT : ${totalHt.toFixed(2)} €`, totalsX, rowY, { width: 200, align: 'right' });
  doc.text(`TVA : ${totalTva.toFixed(2)} €`,     totalsX, rowY + 16, { width: 200, align: 'right' });
  doc.text(`Total TTC : ${totalTtc.toFixed(2)} €`, totalsX, rowY + 32, { width: 200, align: 'right' });

  doc.end();
});

// ═════════════════════════════════════════
// MERCURIALE IMPORT (supplier side)
// ═════════════════════════════════════════
// Two-step flow:
//   1. POST /import-mercuriale — supplier uploads PDF or XLSX. We extract
//      products + auto-categorize and tag each row as 'new' / 'update'
//      against their existing supplier_catalog. Nothing is saved yet.
//   2. POST /save-mercuriale — supplier reviews/edits the rows in the UI and
//      submits the final list. We upsert supplier_catalog and emit the same
//      price_change_notifications the per-product /catalog endpoints do.

async function extractFromPdfWithGemini(filePath, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY not configured');
    err.code = 'NO_GEMINI';
    throw err;
  }
  const buf = fs.readFileSync(filePath);
  const base64 = buf.toString('base64');

  const prompt = `Extrais TOUS les produits listés dans cette mercuriale fournisseur (liste de prix professionnelle).
Retourne un JSON strict de la forme :
{ "items": [ {
  "name": "<libellé du produit>",
  "category": "<catégorie si visible, sinon null>",
  "unit": "<kg|L|pièce|carton|sac|etc.>",
  "price": <nombre, prix unitaire HT en euros>,
  "sku": "<code article / référence si visible, sinon null>",
  "packaging": "<conditionnement si visible (ex: 'Carton 5kg', 'Lot de 6'), sinon null>",
  "tva_rate": <taux TVA en pourcentage si visible, sinon null. 5.5 pour denrées alimentaires, 20 pour alcools.>
} ] }
Règles :
- Inclus chaque ligne produit, même les sous-rubriques.
- Si le prix est absent, ignore la ligne.
- Convertis les nombres en décimaux (utilise un point, pas de virgule).
- Ne renvoie aucun texte hors JSON.`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const response = await fetch(url, {
    signal: AbortSignal.timeout(45000),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'application/pdf', data: base64 } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error('Erreur service IA');
    err.code = 'GEMINI_HTTP';
    err.details = body;
    throw err;
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    const err = new Error('Réponse IA vide');
    err.code = 'GEMINI_EMPTY';
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    const err = new Error('Réponse IA invalide');
    err.code = 'GEMINI_INVALID_JSON';
    throw err;
  }
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

// Tag each item as 'new' or 'update' against the supplier's existing catalog.
// Match is case-insensitive on product_name within (supplier_id, restaurant_id),
// or by SKU when the import provides one — SKU is the more reliable key when
// the supplier renames a product but keeps the code.
function annotateAgainstCatalog(items, supplierId, restaurantId) {
  if (!items.length) return items;
  const existing = all(
    'SELECT id, product_name, price, sku FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ?',
    [supplierId, restaurantId]
  );
  const byName = new Map();
  const bySku = new Map();
  for (const row of existing) {
    byName.set(row.product_name.toLowerCase(), row);
    if (row.sku) bySku.set(row.sku.toLowerCase(), row);
  }
  return items.map(it => {
    const matchedBySku = it.sku ? bySku.get(it.sku.toLowerCase()) : null;
    const m = matchedBySku || byName.get(it.name.toLowerCase());
    if (m) {
      return {
        ...it,
        status: 'update',
        existing_id: m.id,
        existing_price: m.price,
      };
    }
    return { ...it, status: 'new' };
  });
}

router.post('/import-mercuriale', requireSupplierAuth, mercurialeUpload.single('mercuriale'), async (req, res) => {
  const filePath = req.file ? req.file.path : null;
  if (!filePath) {
    return res.status(400).json({ error: 'Fichier requis (PDF ou XLSX)' });
  }
  const mimeType = req.file.mimetype || '';

  try {
    let rawItems = [];
    if (mimeType === 'application/pdf') {
      rawItems = await extractFromPdfWithGemini(filePath, mimeType);
    } else {
      const buffer = fs.readFileSync(filePath);
      rawItems = await parseXlsxBuffer(buffer);
    }

    const items = annotateAgainstCatalog(
      normalizeItems(rawItems),
      req.supplierAccount.supplier_id,
      req.supplierAccount.restaurant_id
    );

    res.json({
      items,
      summary: {
        total: items.length,
        new: items.filter(i => i.status === 'new').length,
        update: items.filter(i => i.status === 'update').length,
      },
      categories: CATEGORIES,
    });
  } catch (e) {
    if (e && e.code === 'NO_GEMINI') {
      return res.status(500).json({ error: 'Extraction PDF indisponible (clé IA non configurée)' });
    }
    if (e && (e.code === 'GEMINI_HTTP' || e.code === 'GEMINI_EMPTY' || e.code === 'GEMINI_INVALID_JSON')) {
      return res.status(502).json({ error: e.message });
    }
    console.error('Mercuriale import error:', e);
    return res.status(500).json({ error: 'Erreur lecture du fichier' });
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
});

router.post('/save-mercuriale', requireSupplierAuth, express.json({ limit: '5mb' }), (req, res) => {
  const supplierId = req.supplierAccount.supplier_id;
  const rid = req.supplierAccount.restaurant_id;
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Aucun produit à enregistrer' });
  }

  const cleaned = normalizeItems(items);
  if (cleaned.length === 0) {
    return res.status(400).json({ error: 'Aucun produit valide à enregistrer' });
  }

  const { db } = require('../db');
  let created = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    for (const it of cleaned) {
      // Match priority: SKU first (stable across renames), then case-insensitive name.
      let existing = null;
      if (it.sku) {
        existing = get(
          'SELECT id, price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(sku) = LOWER(?)',
          [supplierId, rid, it.sku]
        );
      }
      if (!existing) {
        existing = get(
          'SELECT id, price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(product_name) = LOWER(?)',
          [supplierId, rid, it.name]
        );
      }
      if (existing) {
        run(
          `UPDATE supplier_catalog
              SET product_name = ?, category = ?, unit = ?, price = ?,
                  sku = ?, tva_rate = ?, packaging = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND restaurant_id = ?`,
          [it.name, it.category, it.unit, it.price, it.sku, it.tva_rate, it.packaging, existing.id, rid]
        );
        if (existing.price !== it.price) {
          run(
            'INSERT INTO price_change_notifications (restaurant_id, supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, ?, ?, ?)',
            [rid, supplierId, it.name, existing.price, it.price, 'update']
          );
        }
        updated++;
      } else {
        run(
          `INSERT INTO supplier_catalog
             (restaurant_id, supplier_id, product_name, category, unit, price, sku, tva_rate, packaging)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, supplierId, it.name, it.category, it.unit, it.price, it.sku, it.tva_rate, it.packaging]
        );
        run(
          'INSERT INTO price_change_notifications (restaurant_id, supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, NULL, ?, ?)',
          [rid, supplierId, it.name, it.price, 'new']
        );
        created++;
      }
    }
  });

  try {
    tx();
  } catch (e) {
    console.error('Mercuriale save error:', e);
    return res.status(500).json({ error: 'Erreur enregistrement' });
  }

  res.status(201).json({ success: true, created, updated, total: created + updated });
});

// ═════════════════════════════════════════
// DASHBOARD (supplier side)
// ═════════════════════════════════════════
// Landing screen after login. Five widgets: revenue total, order counts (this
// month / lifetime), active clients (≥1 order in last 30 days), 5 most recent
// orders, and pending-confirmation alerts (status='brouillon' or 'envoyée').
router.get('/dashboard', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const wPo = identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'po');

  const totals = get(
    `SELECT
       COALESCE(SUM(total_amount), 0)               AS revenue_total,
       COUNT(*)                                     AS orders_total,
       COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m','now') THEN 1 ELSE 0 END), 0) AS orders_this_month,
       COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m','now') THEN total_amount ELSE 0 END), 0) AS revenue_this_month
     FROM purchase_orders
     WHERE ${w.sql}`,
    w.params
  );

  const activeClients = get(
    `SELECT COUNT(DISTINCT restaurant_id) AS c
       FROM purchase_orders
      WHERE (${w.sql})
        AND created_at >= datetime('now', '-30 days')`,
    w.params
  );

  const recentOrders = all(
    `SELECT po.id, po.reference, po.status, po.total_amount, po.created_at,
            r.name AS restaurant_name
       FROM purchase_orders po
       JOIN restaurants r ON r.id = po.restaurant_id
      WHERE ${wPo.sql}
      ORDER BY po.created_at DESC
      LIMIT 5`,
    wPo.params
  );

  // 'brouillon' = restaurant draft, 'envoyée' = sent and waiting for supplier
  // confirmation. Both are alert candidates from the supplier's POV.
  const pendingAlerts = all(
    `SELECT po.id, po.reference, po.status, po.total_amount, po.created_at,
            r.name AS restaurant_name
       FROM purchase_orders po
       JOIN restaurants r ON r.id = po.restaurant_id
      WHERE (${wPo.sql})
        AND po.status IN ('brouillon', 'envoyée', 'envoyee')
      ORDER BY po.created_at DESC
      LIMIT 20`,
    wPo.params
  );

  res.json({
    revenue_total: totals.revenue_total,
    revenue_this_month: totals.revenue_this_month,
    orders_total: totals.orders_total,
    orders_this_month: totals.orders_this_month,
    active_clients: activeClients.c,
    recent_orders: recentOrders,
    pending_alerts: pendingAlerts,
  });
});

// ═════════════════════════════════════════
// CLIENTS (mes restaurants)
// ═════════════════════════════════════════

router.get('/clients', requireSupplierAuth, (req, res) => {
  // Aggregate per restaurant across every (supplier_id, restaurant_id) pair
  // owned by this vendor identity. Each restaurant only matches its own
  // supplier_id pair, so order counts/revenue stay tenant-clean.
  const identities = getSupplierIdentities(req.supplierAccount);
  const restaurantIds = identities.map(i => i.restaurant_id);
  const placeholders = restaurantIds.map(() => '?').join(',');
  const w = identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'po');

  const clients = all(
    `SELECT r.id          AS restaurant_id,
            r.name        AS restaurant_name,
            r.city        AS restaurant_city,
            r.phone       AS restaurant_phone,
            COUNT(po.id)  AS orders_count,
            MAX(po.created_at) AS last_order_at,
            COALESCE(SUM(po.total_amount), 0)                  AS total_revenue,
            COALESCE(AVG(po.total_amount), 0)                  AS avg_order_value
       FROM restaurants r
       LEFT JOIN purchase_orders po
              ON po.restaurant_id = r.id AND (${w.sql})
      WHERE r.id IN (${placeholders})
   GROUP BY r.id
   ORDER BY orders_count DESC, r.name ASC`,
    [...w.params, ...restaurantIds]
  );

  res.json(clients);
});

router.get('/clients/:restaurantId', requireSupplierAuth, (req, res) => {
  const requestedRid = Number(req.params.restaurantId);
  const identities = getSupplierIdentities(req.supplierAccount);
  // Find the (supplier_id, restaurant_id) tuple matching the requested rid.
  // If no identity owns this restaurant, return 404 (existence-hide).
  const match = identities.find(i => i.restaurant_id === requestedRid);
  if (!match) return res.status(404).json({ error: 'Restaurant introuvable' });

  const restaurant = get('SELECT id, name, city, phone, address FROM restaurants WHERE id = ?', [requestedRid]);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });

  const supplierId = match.supplier_id;
  const rid = match.restaurant_id;

  const orders = all(
    `SELECT po.id, po.reference, po.status, po.total_amount, po.created_at, po.expected_delivery
       FROM purchase_orders po
      WHERE po.supplier_id = ? AND po.restaurant_id = ?
      ORDER BY po.created_at DESC
      LIMIT 50`,
    [supplierId, rid]
  );

  const favorites = all(
    `SELECT poi.product_name,
            SUM(poi.quantity)    AS total_quantity,
            COUNT(DISTINCT po.id) AS times_ordered,
            COALESCE(SUM(poi.total_price), 0) AS total_spent
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
      WHERE po.supplier_id = ? AND po.restaurant_id = ?
   GROUP BY poi.product_name
   ORDER BY total_quantity DESC
      LIMIT 5`,
    [supplierId, rid]
  );

  let frequencyDays = null;
  if (orders.length >= 2) {
    const first = new Date(orders[orders.length - 1].created_at).getTime();
    const last = new Date(orders[0].created_at).getTime();
    if (Number.isFinite(first) && Number.isFinite(last) && last > first) {
      frequencyDays = Math.round((last - first) / (1000 * 60 * 60 * 24) / (orders.length - 1));
    }
  }

  const totals = get(
    `SELECT COUNT(*)                          AS orders_count,
            COALESCE(SUM(total_amount), 0)    AS total_revenue,
            COALESCE(AVG(total_amount), 0)    AS avg_order_value,
            MAX(created_at)                   AS last_order_at
       FROM purchase_orders
      WHERE supplier_id = ? AND restaurant_id = ?`,
    [supplierId, rid]
  );

  res.json({
    restaurant,
    orders,
    favorites,
    frequency_days: frequencyDays,
    summary: totals,
  });
});

router.get('/clients/:restaurantId/orders/:orderId', requireSupplierAuth, (req, res) => {
  const requestedRid = Number(req.params.restaurantId);
  const orderId = Number(req.params.orderId);
  const identities = getSupplierIdentities(req.supplierAccount);
  const match = identities.find(i => i.restaurant_id === requestedRid);
  if (!match) return res.status(404).json({ error: 'Commande introuvable' });
  const supplierId = match.supplier_id;
  const rid = match.restaurant_id;

  const order = get(
    `SELECT po.*, r.name AS restaurant_name
       FROM purchase_orders po
       JOIN restaurants r ON r.id = po.restaurant_id
      WHERE po.id = ? AND po.supplier_id = ? AND po.restaurant_id = ?`,
    [orderId, supplierId, rid]
  );
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = all(
    `SELECT id, product_name, quantity, unit, unit_price, total_price, notes
       FROM purchase_order_items
      WHERE purchase_order_id = ? AND restaurant_id = ?`,
    [orderId, rid]
  );
  res.json({ ...order, items });
});

// ═════════════════════════════════════════
// SUPPLIER NOTIFICATIONS (commande créée, etc.)
// ═════════════════════════════════════════
// Mirrors price_change_notifications but for the supplier-facing side. The
// /notifications/* path on this router is already used by the gérant view
// (price changes), so the supplier-side endpoints live under /notifications/me/
// to avoid collision and keep auth middleware split.

router.get('/notifications/me', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'sn');
  const notifs = all(
    `SELECT sn.*, r.name AS restaurant_name
       FROM supplier_notifications sn
       LEFT JOIN restaurants r ON r.id = sn.restaurant_id
      WHERE ${w.sql}
      ORDER BY sn.created_at DESC
      LIMIT 100`,
    w.params
  );
  res.json(notifs);
});

router.get('/notifications/me/unread-count', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const row = get(
    `SELECT COUNT(*) AS c FROM supplier_notifications WHERE (${w.sql}) AND read = 0`,
    w.params
  );
  res.json({ count: row.c });
});

router.put('/notifications/me/:id/read', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const result = run(
    `UPDATE supplier_notifications SET read = 1 WHERE id = ? AND (${w.sql})`,
    [id, ...w.params]
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Notification introuvable' });
  res.json({ success: true });
});

router.put('/notifications/me/read-all', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  run(
    `UPDATE supplier_notifications SET read = 1 WHERE (${w.sql}) AND read = 0`,
    w.params
  );
  res.json({ success: true });
});

// ═════════════════════════════════════════
// HISTORIQUE — chronological order feed (replaces the audit-log "history" tab)
// ═════════════════════════════════════════
// Returns flat list of orders (newest first) with optional date-range and
// client filters. The previous /history route stays mounted for backward compat
// but the supplier portal client now reads from /historique. Both name and
// purpose have changed enough to keep them separate.
router.get('/historique', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const { from, to, restaurant_id, status, q } = req.query;

  // restaurant_id filter must intersect the identity set; if it doesn't, the
  // result is empty (cross-tenant existence-hide).
  const requestedRid = restaurant_id ? Number(restaurant_id) : null;
  const filteredIdentities = requestedRid
    ? identities.filter(i => i.restaurant_id === requestedRid)
    : identities;
  if (!filteredIdentities.length) {
    return res.json({ orders: [], totals: { count: 0, revenue_ht: 0 } });
  }
  const w = identityWhereClause(filteredIdentities, 'supplier_id', 'restaurant_id', 'po');
  const params = [...w.params];
  let where = `(${w.sql})`;
  if (from) { where += ' AND date(po.created_at) >= date(?)'; params.push(String(from)); }
  if (to)   { where += ' AND date(po.created_at) <= date(?)'; params.push(String(to)); }
  if (status && status !== 'all') {
    // Accept both accented and unaccented variants ('envoyée'/'envoyee') so the
    // filter chips work whichever spelling lives in the DB.
    const STATUS_VARIANTS = {
      brouillon:  ['brouillon'],
      envoyee:    ['envoyée', 'envoyee'],
      'envoyée':  ['envoyée', 'envoyee'],
      confirmee:  ['confirmée', 'confirmee'],
      'confirmée': ['confirmée', 'confirmee'],
      livree:     ['livrée', 'livree'],
      'livrée':   ['livrée', 'livree'],
      refusee:    ['refusée', 'refusee'],
      'refusée':  ['refusée', 'refusee'],
      annulee:    ['annulée', 'annulee'],
      'annulée':  ['annulée', 'annulee'],
    };
    const variants = STATUS_VARIANTS[status] || [String(status)];
    where += ` AND po.status IN (${variants.map(() => '?').join(',')})`;
    params.push(...variants);
  }
  // Reference number search. Case-insensitive partial match — restaurants
  // typically search "DEMO-PO-005" or "PO-2026" with the prefix only.
  if (q && String(q).trim()) {
    where += ' AND LOWER(po.reference) LIKE LOWER(?)';
    params.push(`%${String(q).trim()}%`);
  }

  const orders = all(
    `SELECT po.id, po.reference, po.status, po.total_amount, po.created_at, po.expected_delivery,
            r.name AS restaurant_name
       FROM purchase_orders po
       JOIN restaurants r ON r.id = po.restaurant_id
      WHERE ${where}
      ORDER BY po.created_at DESC
      LIMIT 500`,
    params
  );

  const totals = get(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue_ht
       FROM purchase_orders po
      WHERE ${where}`,
    params
  );

  res.json({ orders, totals });
});

// ═════════════════════════════════════════
// STATS — top products, revenue by month, revenue by category
// ═════════════════════════════════════════
// Used by the supplier dashboard "Statistiques" panel. All three slices are
// computed off purchase_orders + purchase_order_items, scoped to (supplier_id,
// restaurant_id) so cross-tenant data never leaks.
router.get('/stats', requireSupplierAuth, (req, res) => {
  const identities = getSupplierIdentities(req.supplierAccount);
  const w = identityWhereClause(identities);
  const wPo = identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'po');

  const topProducts = all(
    `SELECT poi.product_name,
            SUM(poi.total_price) AS revenue,
            SUM(poi.quantity)    AS quantity,
            COUNT(DISTINCT po.id) AS times_ordered
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
      WHERE ${wPo.sql}
   GROUP BY poi.product_name
   ORDER BY revenue DESC, quantity DESC, poi.product_name ASC
      LIMIT 10`,
    wPo.params
  );

  const revenueByMonth = all(
    `SELECT strftime('%Y-%m', created_at) AS month,
            COALESCE(SUM(total_amount), 0) AS revenue,
            COUNT(*) AS orders_count
       FROM purchase_orders
      WHERE (${w.sql})
        AND created_at >= date('now', '-12 months')
   GROUP BY month
   ORDER BY month ASC`,
    w.params
  );

  // Revenue by catalog category. better-sqlite3 rejects forward-referenced
  // aliases inside LEFT JOIN ON clauses (see feedback memory) — so we don't
  // try to JOIN supplier_catalog by po.supplier_id inside the LEFT JOIN. We
  // accept best-effort categorization: any catalog row across the identity
  // tenants matching the product name supplies the category. Cross-tenant
  // category-of-product ambiguity is unlikely (Metro's "Tomate" is "Tomate"
  // in every tenant we control).
  const revenueByCategory = all(
    `SELECT COALESCE((
              SELECT category FROM supplier_catalog sc
               WHERE LOWER(sc.product_name) = LOWER(poi.product_name)
                 AND (${identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'sc').sql})
               LIMIT 1
            ), 'Autre') AS category,
            SUM(poi.total_price) AS revenue,
            SUM(poi.quantity)    AS quantity
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
      WHERE ${wPo.sql}
   GROUP BY category
   ORDER BY revenue DESC`,
    [...identityWhereClause(identities, 'supplier_id', 'restaurant_id', 'sc').params, ...wPo.params]
  );

  res.json({ top_products: topProducts, revenue_by_month: revenueByMonth, revenue_by_category: revenueByCategory });
});

// ═════════════════════════════════════════
// PRICE OVERRIDES per client (Grille tarifaire par client)
// ═════════════════════════════════════════

// GET — full catalog joined with the active override for this restaurant.
router.get('/clients/:restaurantId/catalog', requireSupplierAuth, (req, res) => {
  const supplierId = req.supplierAccount.supplier_id;
  const rid = req.supplierAccount.restaurant_id;
  const requestedRid = Number(req.params.restaurantId);
  if (requestedRid !== rid) return res.status(404).json({ error: 'Restaurant introuvable' });

  const rows = all(
    `SELECT sc.id, sc.product_name, sc.category, sc.unit, sc.price AS standard_price,
            sc.sku, sc.tva_rate, sc.packaging,
            cpo.override_price, cpo.notes AS override_notes, cpo.updated_at AS override_updated_at
       FROM supplier_catalog sc
       LEFT JOIN client_price_overrides cpo
              ON cpo.catalog_id = sc.id
             AND cpo.supplier_id = ?
             AND cpo.restaurant_id = ?
      WHERE sc.supplier_id = ? AND sc.restaurant_id = ?
   ORDER BY sc.category, sc.product_name`,
    [supplierId, rid, supplierId, rid]
  );
  res.json(rows);
});

// PUT — upsert override price for a catalog item. body: { price, notes? }.
// price === null clears the override.
router.put('/clients/:restaurantId/price-overrides/:catalogId', requireSupplierAuth, (req, res) => {
  const supplierId = req.supplierAccount.supplier_id;
  const rid = req.supplierAccount.restaurant_id;
  const requestedRid = Number(req.params.restaurantId);
  if (requestedRid !== rid) return res.status(404).json({ error: 'Restaurant introuvable' });
  const catalogId = Number(req.params.catalogId);

  // Verify the catalog row belongs to the supplier+tenant.
  const catalog = get(
    'SELECT id FROM supplier_catalog WHERE id = ? AND supplier_id = ? AND restaurant_id = ?',
    [catalogId, supplierId, rid]
  );
  if (!catalog) return res.status(404).json({ error: 'Produit introuvable' });

  const { price, notes } = req.body || {};
  if (price === null || price === undefined || price === '') {
    run(
      'DELETE FROM client_price_overrides WHERE supplier_id = ? AND restaurant_id = ? AND catalog_id = ?',
      [supplierId, rid, catalogId]
    );
    return res.json({ success: true, cleared: true });
  }
  const numPrice = Number(price);
  if (!Number.isFinite(numPrice) || numPrice <= 0) {
    return res.status(400).json({ error: 'Prix invalide' });
  }
  // INSERT … ON CONFLICT relies on the UNIQUE(supplier_id, restaurant_id,
  // catalog_id) created in the migration. Without the UNIQUE this would
  // silently re-insert (see feedback_insert_or_replace_needs_unique.md).
  run(
    `INSERT INTO client_price_overrides
       (supplier_id, restaurant_id, catalog_id, override_price, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(supplier_id, restaurant_id, catalog_id) DO UPDATE SET
       override_price = excluded.override_price,
       notes          = excluded.notes,
       updated_at     = CURRENT_TIMESTAMP`,
    [supplierId, rid, catalogId, numPrice, notes || null]
  );
  res.json({ success: true, price: numPrice });
});

// DELETE — remove an override.
router.delete('/clients/:restaurantId/price-overrides/:catalogId', requireSupplierAuth, (req, res) => {
  const supplierId = req.supplierAccount.supplier_id;
  const rid = req.supplierAccount.restaurant_id;
  const requestedRid = Number(req.params.restaurantId);
  if (requestedRid !== rid) return res.status(404).json({ error: 'Restaurant introuvable' });
  const catalogId = Number(req.params.catalogId);
  run(
    'DELETE FROM client_price_overrides WHERE supplier_id = ? AND restaurant_id = ? AND catalog_id = ?',
    [supplierId, rid, catalogId]
  );
  res.json({ success: true });
});

// ═════════════════════════════════════════
// BL PDF EXPORT
// ═════════════════════════════════════════
// pdfkit-based bon de livraison. Header with supplier + restaurant blocks,
// items table with batch/DLC/temperature, signature lines at the bottom.
// Returns a streamed application/pdf — never buffer the whole PDF in memory.
router.get('/delivery-notes/:id/pdf', requireSupplierAuth, (req, res) => {
  const supplierId = req.supplierAccount.supplier_id;
  const supplierName = req.supplierAccount.supplier_name;
  const rid = req.supplierAccount.restaurant_id;
  const id = Number(req.params.id);

  const note = get(
    'SELECT * FROM delivery_notes WHERE id = ? AND supplier_id = ? AND restaurant_id = ?',
    [id, supplierId, rid]
  );
  if (!note) return res.status(404).json({ error: 'Bon de livraison introuvable' });

  const restaurant = get('SELECT name, address, city, postal_code, phone FROM restaurants WHERE id = ?', [rid]) || {};
  const items = all(
    `SELECT product_name, quantity, unit, price_per_unit, batch_number, dlc, temperature_required, origin, notes
       FROM delivery_note_items
      WHERE delivery_note_id = ? AND restaurant_id = ?`,
    [id, rid]
  );

  // Buffer the entire PDF in memory and send with explicit Content-Length
  // instead of streaming. Streaming pdfkit through `compression()` + Render's
  // nginx corrupted the response in prod (the browser's blob() saw a
  // doubly-encoded body). For BLs (~30–60 KB) the memory cost is negligible.
  // Defense-in-depth: app.js compression filter also skips application/pdf.
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const safeName = String(supplierName || 'fournisseur').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40);

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => {
    const buf = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Content-Disposition', `attachment; filename="BL-${safeName}-${id}.pdf"`);
    res.end(buf);
  });
  doc.on('error', (e) => {
    console.error('PDFKit BL error:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération PDF' });
  });

  // Header
  doc.font('Helvetica-Bold').fontSize(16).text('Bon de livraison', { align: 'left' });
  doc.font('Helvetica').fontSize(10).fillColor('#555')
    .text(`Référence #${id}`, { align: 'left' });
  doc.moveDown(0.5);

  // Two-column meta: supplier (left) + restaurant (right)
  const metaY = doc.y;
  const colW = (doc.page.width - 84) / 2;
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(10).text('Fournisseur', 42, metaY);
  doc.font('Helvetica').fontSize(10).text(supplierName || '—', 42, metaY + 14, { width: colW });

  doc.font('Helvetica-Bold').fontSize(10).text('Client (restaurant)', 42 + colW, metaY);
  doc.font('Helvetica').fontSize(10)
    .text(restaurant.name || '—', 42 + colW, metaY + 14, { width: colW });
  if (restaurant.address || restaurant.city) {
    doc.text(`${restaurant.address || ''} ${restaurant.postal_code || ''} ${restaurant.city || ''}`.trim(), 42 + colW, doc.y, { width: colW });
  }
  if (restaurant.phone) doc.text(`Tél : ${restaurant.phone}`, 42 + colW, doc.y, { width: colW });

  doc.y = metaY + 60;
  doc.moveTo(42, doc.y).lineTo(doc.page.width - 42, doc.y).strokeColor('#000').stroke();
  doc.moveDown(0.5);

  // Date row
  doc.font('Helvetica-Bold').fontSize(10).text('Date de livraison : ', { continued: true });
  doc.font('Helvetica').text(note.delivery_date || new Date(note.created_at).toLocaleDateString('fr-FR'));
  if (note.notes) {
    doc.font('Helvetica-Bold').text('Notes : ', { continued: true }).font('Helvetica').text(String(note.notes));
  }
  doc.moveDown(0.5);

  // Items table
  const tableY = doc.y + 4;
  const cols = [
    { label: 'Produit',     x: 42,  w: 175 },
    { label: 'Qté',         x: 220, w: 40,  align: 'right' },
    { label: 'Unité',       x: 262, w: 40 },
    { label: 'Lot',         x: 305, w: 70 },
    { label: 'DLC',         x: 378, w: 60 },
    { label: 'T° requise',  x: 440, w: 55 },
    { label: 'P.U. HT',     x: 498, w: 55, align: 'right' },
  ];

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  for (const c of cols) {
    doc.text(c.label, c.x, tableY, { width: c.w, align: c.align || 'left' });
  }
  doc.moveTo(42, tableY + 14).lineTo(doc.page.width - 42, tableY + 14).strokeColor('#888').stroke();
  let rowY = tableY + 18;

  doc.font('Helvetica').fontSize(9);
  for (const it of items) {
    if (rowY > doc.page.height - 120) {
      doc.addPage();
      rowY = 42;
    }
    const tempStr = it.temperature_required != null ? `${it.temperature_required}°C` : '';
    const dlcStr = it.dlc ? new Date(it.dlc).toLocaleDateString('fr-FR') : '';
    const priceStr = it.price_per_unit != null ? `${Number(it.price_per_unit).toFixed(2)} €` : '';
    doc.fillColor('#000');
    doc.text(String(it.product_name || ''), cols[0].x, rowY, { width: cols[0].w });
    doc.text(String(it.quantity ?? ''),     cols[1].x, rowY, { width: cols[1].w, align: 'right' });
    doc.text(String(it.unit || ''),         cols[2].x, rowY, { width: cols[2].w });
    doc.text(String(it.batch_number || ''), cols[3].x, rowY, { width: cols[3].w });
    doc.text(dlcStr,                        cols[4].x, rowY, { width: cols[4].w });
    doc.text(tempStr,                       cols[5].x, rowY, { width: cols[5].w });
    doc.text(priceStr,                      cols[6].x, rowY, { width: cols[6].w, align: 'right' });
    rowY += 16;
  }

  // Total + signatures
  if (rowY > doc.page.height - 140) {
    doc.addPage();
    rowY = 42;
  }
  rowY += 10;
  doc.moveTo(42, rowY).lineTo(doc.page.width - 42, rowY).strokeColor('#000').stroke();
  rowY += 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
    .text(`Total HT : ${(note.total_amount || 0).toFixed(2)} €`, 42, rowY, { align: 'right', width: doc.page.width - 84 });

  rowY += 50;
  const sigW = (doc.page.width - 84 - 30) / 2;
  doc.font('Helvetica-Bold').fontSize(9).text('Signature livreur', 42, rowY);
  doc.moveTo(42, rowY + 36).lineTo(42 + sigW, rowY + 36).strokeColor('#000').stroke();
  doc.font('Helvetica-Bold').fontSize(9).text('Signature client (restaurant)', 42 + sigW + 30, rowY);
  doc.moveTo(42 + sigW + 30, rowY + 36).lineTo(doc.page.width - 42, rowY + 36).strokeColor('#000').stroke();

  doc.end();
});

module.exports = router;
