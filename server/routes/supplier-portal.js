// ═══════════════════════════════════════════
// Supplier Portal — API Routes
// ═══════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const { all, get, run } = require('../db');
const router = express.Router();

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Middleware: Authenticate supplier via token ───
function requireSupplierAuth(req, res, next) {
  const token = req.headers['x-supplier-token'];
  if (!token) {
    return res.status(401).json({ error: 'Token fournisseur requis' });
  }
  const account = get('SELECT sa.*, s.name as supplier_name FROM supplier_accounts sa JOIN suppliers s ON s.id = sa.supplier_id WHERE sa.access_token = ?', [token]);
  if (!account) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  req.supplierAccount = account;
  next();
}

// ═════════════════════════════════════════
// RESTAURANT SIDE (gérant)
// ═════════════════════════════════════════

// POST /invite — Create supplier access
router.post('/invite', (req, res) => {
  const { supplier_id, pin, name, email } = req.body;
  if (!supplier_id || !pin) {
    return res.status(400).json({ error: 'supplier_id et pin requis' });
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'Le PIN doit être entre 4 et 6 chiffres' });
  }

  const supplier = get('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
  if (!supplier) {
    return res.status(404).json({ error: 'Fournisseur introuvable' });
  }

  // Check if supplier already has an account
  const existing = get('SELECT id FROM supplier_accounts WHERE supplier_id = ?', [supplier_id]);
  if (existing) {
    return res.status(409).json({ error: 'Ce fournisseur a déjà un accès portail' });
  }

  const hashedPin = hashPin(pin);
  const accountName = name || supplier.name;

  const result = run(
    'INSERT INTO supplier_accounts (supplier_id, name, email, pin) VALUES (?, ?, ?, ?)',
    [supplier_id, accountName, email || supplier.email || null, hashedPin]
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    supplier_id,
    name: accountName,
    email: email || supplier.email || null,
    created_at: new Date().toISOString()
  });
});

// GET /accounts — List supplier accounts
router.get('/accounts', (req, res) => {
  const accounts = all(`
    SELECT sa.id, sa.supplier_id, sa.name, sa.email, sa.last_login, sa.created_at,
           s.name as supplier_name
    FROM supplier_accounts sa
    JOIN suppliers s ON s.id = sa.supplier_id
    ORDER BY sa.created_at DESC
  `);
  res.json(accounts);
});

// DELETE /accounts/:id — Revoke supplier access
router.delete('/accounts/:id', (req, res) => {
  const id = Number(req.params.id);
  const account = get('SELECT * FROM supplier_accounts WHERE id = ?', [id]);
  if (!account) {
    return res.status(404).json({ error: 'Compte fournisseur introuvable' });
  }
  run('DELETE FROM supplier_accounts WHERE id = ?', [id]);
  res.json({ success: true });
});

// GET /notifications — Price change notifications
router.get('/notifications', (req, res) => {
  const notifications = all(`
    SELECT pcn.*, s.name as supplier_name
    FROM price_change_notifications pcn
    JOIN suppliers s ON s.id = pcn.supplier_id
    ORDER BY pcn.created_at DESC
    LIMIT 100
  `);
  res.json(notifications);
});

// GET /notifications/unread-count — Badge count
router.get('/notifications/unread-count', (req, res) => {
  const result = get('SELECT COUNT(*) as count FROM price_change_notifications WHERE read = 0');
  res.json({ count: result.count });
});

// PUT /notifications/:id/read — Mark as read
router.put('/notifications/:id/read', (req, res) => {
  const id = Number(req.params.id);
  run('UPDATE price_change_notifications SET read = 1 WHERE id = ?', [id]);
  res.json({ success: true });
});

// PUT /notifications/read-all — Mark all as read
router.put('/notifications/read-all', (req, res) => {
  run('UPDATE price_change_notifications SET read = 1 WHERE read = 0');
  res.json({ success: true });
});

// ═════════════════════════════════════════
// SUPPLIER SIDE (fournisseur)
// ═════════════════════════════════════════

// POST /login — Supplier login
router.post('/login', (req, res) => {
  const { supplier_id, pin } = req.body;
  if (!supplier_id || !pin) {
    return res.status(400).json({ error: 'Identifiant fournisseur et PIN requis' });
  }

  const account = get(`
    SELECT sa.*, s.name as supplier_name
    FROM supplier_accounts sa
    JOIN suppliers s ON s.id = sa.supplier_id
    WHERE sa.supplier_id = ?
  `, [supplier_id]);

  if (!account) {
    return res.status(404).json({ error: 'Aucun accès portail pour ce fournisseur' });
  }

  const hashedPin = hashPin(pin);
  if (account.pin !== hashedPin) {
    return res.status(401).json({ error: 'PIN incorrect' });
  }

  // Generate access token
  const token = generateToken();
  run('UPDATE supplier_accounts SET access_token = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?', [token, account.id]);

  res.json({
    token,
    supplier_id: account.supplier_id,
    supplier_name: account.supplier_name,
    name: account.name
  });
});

// POST /login-by-name — Supplier login by restaurant name
router.post('/login-by-name', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN requis' });
  }

  const hashedPin = hashPin(pin);

  // Find supplier account matching this PIN
  const account = get(`
    SELECT sa.*, s.name as supplier_name
    FROM supplier_accounts sa
    JOIN suppliers s ON s.id = sa.supplier_id
    WHERE sa.pin = ?
  `, [hashedPin]);

  if (!account) {
    return res.status(401).json({ error: 'PIN incorrect ou aucun accès portail' });
  }

  // Generate access token
  const token = generateToken();
  run('UPDATE supplier_accounts SET access_token = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?', [token, account.id]);

  res.json({
    token,
    supplier_id: account.supplier_id,
    supplier_name: account.supplier_name,
    name: account.name
  });
});

// GET /catalog — Get my catalog (authenticated supplier)
router.get('/catalog', requireSupplierAuth, (req, res) => {
  const catalog = all(
    'SELECT * FROM supplier_catalog WHERE supplier_id = ? ORDER BY category, product_name',
    [req.supplierAccount.supplier_id]
  );
  res.json(catalog);
});

// POST /catalog — Add product to catalog
router.post('/catalog', requireSupplierAuth, (req, res) => {
  const { product_name, category, unit, price, min_order } = req.body;
  if (!product_name || !unit || price == null) {
    return res.status(400).json({ error: 'product_name, unit et price requis' });
  }

  const result = run(
    'INSERT INTO supplier_catalog (supplier_id, product_name, category, unit, price, min_order) VALUES (?, ?, ?, ?, ?, ?)',
    [req.supplierAccount.supplier_id, product_name, category || null, unit, price, min_order || 0]
  );

  // Create notification for new product
  run(
    'INSERT INTO price_change_notifications (supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, NULL, ?, ?)',
    [req.supplierAccount.supplier_id, product_name, price, 'new']
  );

  const item = get('SELECT * FROM supplier_catalog WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(item);
});

// PUT /catalog/:id — Update product
router.put('/catalog/:id', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const item = get('SELECT * FROM supplier_catalog WHERE id = ? AND supplier_id = ?', [id, req.supplierAccount.supplier_id]);
  if (!item) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  const { product_name, category, unit, price, min_order } = req.body;
  const newPrice = price != null ? price : item.price;
  const oldPrice = item.price;

  run(
    'UPDATE supplier_catalog SET product_name = ?, category = ?, unit = ?, price = ?, min_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [
      product_name || item.product_name,
      category !== undefined ? category : item.category,
      unit || item.unit,
      newPrice,
      min_order != null ? min_order : item.min_order,
      id
    ]
  );

  // If price changed, create notification and update supplier_prices
  if (price != null && price !== oldPrice) {
    run(
      'INSERT INTO price_change_notifications (supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, ?, ?)',
      [req.supplierAccount.supplier_id, product_name || item.product_name, oldPrice, newPrice, 'update']
    );

    // Try to update linked supplier_prices (match by product name → ingredient name)
    const linkedIngredient = get(
      'SELECT i.id FROM ingredients i JOIN supplier_prices sp ON sp.ingredient_id = i.id WHERE sp.supplier_id = ? AND LOWER(i.name) = LOWER(?)',
      [req.supplierAccount.supplier_id, product_name || item.product_name]
    );
    if (linkedIngredient) {
      run(
        'UPDATE supplier_prices SET price = ?, last_updated = CURRENT_TIMESTAMP WHERE supplier_id = ? AND ingredient_id = ?',
        [newPrice, req.supplierAccount.supplier_id, linkedIngredient.id]
      );
      // Record in price history
      run(
        'INSERT INTO price_history (ingredient_id, supplier_id, price) VALUES (?, ?, ?)',
        [linkedIngredient.id, req.supplierAccount.supplier_id, newPrice]
      );
    }
  }

  const updated = get('SELECT * FROM supplier_catalog WHERE id = ?', [id]);
  res.json(updated);
});

// DELETE /catalog/:id — Remove product
router.delete('/catalog/:id', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const item = get('SELECT * FROM supplier_catalog WHERE id = ? AND supplier_id = ?', [id, req.supplierAccount.supplier_id]);
  if (!item) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  // Create notification for removal
  run(
    'INSERT INTO price_change_notifications (supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, NULL, ?)',
    [req.supplierAccount.supplier_id, item.product_name, item.price, 'removed']
  );

  run('DELETE FROM supplier_catalog WHERE id = ?', [id]);
  res.json({ success: true });
});

// PUT /catalog/:id/availability — Toggle availability
router.put('/catalog/:id/availability', requireSupplierAuth, (req, res) => {
  const id = Number(req.params.id);
  const item = get('SELECT * FROM supplier_catalog WHERE id = ? AND supplier_id = ?', [id, req.supplierAccount.supplier_id]);
  if (!item) {
    return res.status(404).json({ error: 'Produit introuvable' });
  }

  const { available } = req.body;
  const newAvailable = available != null ? (available ? 1 : 0) : (item.available ? 0 : 1);

  run('UPDATE supplier_catalog SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newAvailable, id]);

  // Notify if product becomes unavailable
  if (!newAvailable) {
    run(
      'INSERT INTO price_change_notifications (supplier_id, product_name, old_price, new_price, change_type) VALUES (?, ?, ?, ?, ?)',
      [req.supplierAccount.supplier_id, item.product_name, item.price, item.price, 'unavailable']
    );
  }

  const updated = get('SELECT * FROM supplier_catalog WHERE id = ?', [id]);
  res.json(updated);
});

// GET /history — Supplier's change history
router.get('/history', requireSupplierAuth, (req, res) => {
  const history = all(
    'SELECT * FROM price_change_notifications WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.supplierAccount.supplier_id]
  );
  res.json(history);
});

module.exports = router;
