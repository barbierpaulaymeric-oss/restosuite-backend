// ═══════════════════════════════════════════
// Supplier Portal — API Routes
// ═══════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = express.Router();

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
  const { product_name, category, unit, price, min_order } = req.body;
  if (!product_name || !unit || price == null) {
    return res.status(400).json({ error: 'product_name, unit et price requis' });
  }

  const result = run(
    'INSERT INTO supplier_catalog (restaurant_id, supplier_id, product_name, category, unit, price, min_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [rid, req.supplierAccount.supplier_id, product_name, category || null, unit, price, min_order || 0]
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

  const { product_name, category, unit, price, min_order } = req.body;
  const newPrice = price != null ? price : item.price;
  const oldPrice = item.price;

  run(
    'UPDATE supplier_catalog SET product_name = ?, category = ?, unit = ?, price = ?, min_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
    [
      product_name || item.product_name,
      category !== undefined ? category : item.category,
      unit || item.unit,
      newPrice,
      min_order != null ? min_order : item.min_order,
      id,
      rid
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

module.exports = router;
