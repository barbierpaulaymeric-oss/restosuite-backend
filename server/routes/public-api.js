const { Router } = require('express');
const { all, get, run } = require('../db');
const crypto = require('crypto');
const { requireAuth } = require('./auth');
const { apiError } = require('../lib/error-handler');
const router = Router();

// ═══════════════════════════════════════════
// Public API — API publique pour intégrations
// ═══════════════════════════════════════════

// Ensure API keys table exists
try {
  run(`CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    key_name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    permissions TEXT DEFAULT '["read"]',
    rate_limit INTEGER DEFAULT 100,
    is_active INTEGER DEFAULT 1,
    last_used TEXT,
    request_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
} catch (e) {
  // Table may already exist on subsequent boots — only log real errors.
  if (!/already exists/i.test(e && e.message || '')) {
    console.error('api_keys table init failed:', e);
  }
}

// PENTEST_REPORT C3.3 — store only SHA-256 hash of API keys. The raw key is
// shown to the operator once at creation; if lost, they must rotate. Add the
// hash column if missing, then backfill any rows where the hash isn't set
// (legacy installs with plaintext keys in api_key column).
try {
  const cols = all("PRAGMA table_info('api_keys')").map(c => c.name);
  if (!cols.includes('key_hash')) {
    run('ALTER TABLE api_keys ADD COLUMN key_hash TEXT');
  }
  // Backfill hashes for any plaintext rows missing one.
  const legacy = all("SELECT id, api_key FROM api_keys WHERE key_hash IS NULL OR key_hash = ''");
  for (const row of legacy) {
    const h = crypto.createHash('sha256').update(String(row.api_key)).digest('hex');
    run('UPDATE api_keys SET key_hash = ? WHERE id = ?', [h, row.id]);
  }
} catch (e) {
  if (!/duplicate column/i.test(e && e.message || '')) {
    console.error('api_keys hash migration failed:', e);
  }
}

function hashApiKey(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// In-memory rate limit windows: api_key -> { count, resetAt }.
// PENTEST_REPORT C3.5 — this Map lives in the Node process, so on multi-
// instance deploys (Render horizontal scale, PM2 cluster) each worker enforces
// its own window. For single-instance Render deploys (current prod topology)
// this is sufficient; document moving to Redis when we add replicas.
const rateLimitWindows = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Middleware: authenticate by API key and enforce per-key rate limit.
// PENTEST_REPORT C3.4 — ONLY accept keys via the X-API-Key header. Query-
// string keys are rejected because they leak into access logs, proxy caches,
// browser history, and Sentry/Referer breadcrumbs.
function apiKeyAuth(req, res, next) {
  if (req.query && req.query.api_key) {
    return res.status(400).json({
      error: 'API key must be passed via X-API-Key header, not query string. Query-string keys leak into logs.',
    });
  }
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key required. Pass via X-API-Key header.' });

  // Constant-time-ish lookup: hash the incoming key and compare against stored hash.
  const h = hashApiKey(key);
  const record = get('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1', [h]);
  if (!record) return res.status(403).json({ error: 'Invalid or inactive API key' });

  // Per-key rate limiting using the rate_limit field from the database
  const limit = record.rate_limit || 100;
  const now = Date.now();
  let window = rateLimitWindows.get(key);
  if (!window || now > window.resetAt) {
    window = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitWindows.set(key, window);
  }
  window.count++;

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - window.count));
  res.setHeader('X-RateLimit-Reset', new Date(window.resetAt).toISOString());

  if (window.count > limit) {
    return res.status(429).json({
      error: 'Rate limit exceeded. See X-RateLimit-Reset header for reset time.',
      retry_after: Math.ceil((window.resetAt - now) / 1000)
    });
  }

  // Update usage
  // NB: SQLite treats "now" with double quotes as an identifier (column reference)
  // and raises "no such column: now". Use single quotes for string literals.
  run("UPDATE api_keys SET last_used = datetime('now'), request_count = request_count + 1 WHERE id = ?", [record.id]);

  req.apiKey = record;
  req.apiPermissions = JSON.parse(record.permissions || '["read"]');
  next();
}

// PENTEST_REPORT C3.7 — support structured permissions like
// `read:menu` / `write:orders` in addition to legacy shortcuts
// (`read`, `write`, `admin`). A key with `admin` has everything; a key
// with `read` has every `read:*`; a key with `write` has every `write:*`.
// Granular keys (e.g. `read:menu`) are the recommended form for new keys.
const VALID_PERM_VERBS = ['read', 'write'];
const VALID_PERM_SCOPES = ['menu', 'orders', 'stock', 'stats', 'availability'];
function isValidPermission(p) {
  if (p === 'admin') return true;
  if (VALID_PERM_VERBS.includes(p)) return true;
  if (typeof p !== 'string') return false;
  const [verb, scope] = p.split(':');
  return VALID_PERM_VERBS.includes(verb) && VALID_PERM_SCOPES.includes(scope);
}
function requirePermission(perm) {
  return (req, res, next) => {
    const held = req.apiPermissions || [];
    if (held.includes('admin')) return next();
    if (held.includes(perm)) return next();
    // Legacy wildcard: `read` implies every `read:*`, `write` implies every `write:*`.
    const [needVerb] = perm.split(':');
    if (needVerb && held.includes(needVerb)) return next();
    return res.status(403).json({ error: `Permission '${perm}' required` });
  };
}

// ─── API Key Management (authenticated via JWT, not API key) ───

// GET /api/public/keys — List API keys (internal).
// PENTEST_REPORT C3.3 — never return the raw api_key on listings. Show only
// a `prefix` so operators can identify their key by its first few chars.
router.get('/keys', requireAuth, (req, res) => {
  try {
    const keys = all('SELECT id, key_name, api_key, permissions, rate_limit, is_active, last_used, request_count, created_at FROM api_keys WHERE restaurant_id = ?', [req.user.restaurant_id]);
    res.json(keys.map(k => ({
      id: k.id,
      key_name: k.key_name,
      // Preview-only: first 10 chars + mask. Raw key is unrecoverable from hash.
      prefix: (k.api_key || '').slice(0, 10) + '…',
      permissions: JSON.parse(k.permissions || '[]'),
      rate_limit: k.rate_limit,
      is_active: k.is_active,
      last_used: k.last_used,
      request_count: k.request_count,
      created_at: k.created_at,
    })));
  } catch (e) {
    return apiError(res, e, { route: 'GET /api/public/keys' });
  }
});

// POST /api/public/keys — Create new API key.
// PENTEST_REPORT C3.3 — store only the SHA-256 hash. The raw key is returned
// ONCE in the response body; operators must save it immediately because we
// can't retrieve it afterwards.
// PENTEST_REPORT C3.7 — validate the permissions array against the allowlist.
router.post('/keys', requireAuth, (req, res) => {
  try {
    const { key_name, permissions, rate_limit } = req.body;
    if (!key_name || typeof key_name !== 'string' || key_name.length > 100) {
      return res.status(400).json({ error: 'key_name required (string, ≤100 chars)' });
    }

    const perms = Array.isArray(permissions) && permissions.length ? permissions : ['read'];
    const invalid = perms.filter(p => !isValidPermission(p));
    if (invalid.length) {
      return res.status(400).json({
        error: `Invalid permissions: ${invalid.join(', ')}`,
        allowed: ['admin', 'read', 'write', ...VALID_PERM_VERBS.flatMap(v => VALID_PERM_SCOPES.map(s => `${v}:${s}`))],
      });
    }

    // Rate limit sanity — cap at 10k/hr to prevent a misconfigured key DoSing the tenant.
    let rl = parseInt(rate_limit, 10);
    if (!Number.isInteger(rl) || rl < 1 || rl > 10000) rl = 100;

    const apiKey = 'rs_' + crypto.randomBytes(24).toString('hex');
    const keyHash = hashApiKey(apiKey);
    // Store the full key in api_key for the prefix preview, and its hash for auth.
    // Even though api_key is stored too, authentication NEVER reads it — lookups
    // are key_hash-only. Operators should still treat the DB as sensitive.
    run(
      `INSERT INTO api_keys (restaurant_id, key_name, api_key, key_hash, permissions, rate_limit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.restaurant_id, key_name, apiKey, keyHash, JSON.stringify(perms), rl]
    );

    res.json({
      ok: true,
      api_key: apiKey,
      key_name,
      permissions: perms,
      rate_limit: rl,
      warning: 'Save this key now — it cannot be retrieved later.',
    });
  } catch (e) {
    return apiError(res, e, { route: 'POST /api/public/keys' });
  }
});

// DELETE /api/public/keys/:id
router.delete('/keys/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM api_keys WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), req.user.restaurant_id]);
    res.json({ ok: true });
  } catch (e) {
    return apiError(res, e, { route: 'DELETE /api/public/keys/:id', message: 'Erreur lors de la suppression' });
  }
});

// ═══════════════════════════════════════════
// Public Endpoints (authenticated via API key)
// ═══════════════════════════════════════════

// GET /api/public/v1/menu — Public menu
router.get('/v1/menu', apiKeyAuth, (req, res) => {
  try {
    const rid = req.apiKey.restaurant_id;
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.selling_price, r.description, r.recipe_type, r.photo_url,
        GROUP_CONCAT(DISTINCT CASE WHEN i.allergens IS NOT NULL AND i.allergens != '' THEN i.allergens END) as allergens
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      LEFT JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE r.selling_price > 0 AND r.restaurant_id = ?
      GROUP BY r.id
      ORDER BY r.category, r.name
    `, [rid]);

    const byCategory = {};
    for (const r of recipes) {
      const cat = r.category || 'Autres';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        id: r.id,
        name: r.name,
        price: r.selling_price,
        description: r.description,
        type: r.recipe_type,
        photo_url: r.photo_url,
        allergens: r.allergens ? [...new Set(r.allergens.split(',').map(a => a.trim()).filter(Boolean))] : []
      });
    }

    res.json({
      restaurant: getRestaurantInfo(rid),
      categories: Object.entries(byCategory).map(([name, items]) => ({ name, items })),
      total_items: recipes.length
    });
  } catch (e) {
    return apiError(res, e, { route: 'GET /api/public/v1/menu' });
  }
});

// GET /api/public/v1/availability — Check recipe availability
router.get('/v1/availability', apiKeyAuth, (req, res) => {
  try {
    const rid = req.apiKey.restaurant_id;
    const recipes = all('SELECT id, name, selling_price FROM recipes WHERE selling_price > 0 AND restaurant_id = ?', [rid]);
    const availability = [];

    for (const recipe of recipes) {
      const ingredients = all(`
        SELECT ri.ingredient_id, ri.gross_quantity, ri.unit,
               s.quantity as stock_qty, i.name as ingredient_name
        FROM recipe_ingredients ri
        LEFT JOIN stock s ON s.ingredient_id = ri.ingredient_id AND s.restaurant_id = ?
        LEFT JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ? AND ri.sub_recipe_id IS NULL
      `, [rid, recipe.id]);

      let available = true;
      let maxPortions = Infinity;

      for (const ing of ingredients) {
        if (!ing.stock_qty || ing.stock_qty <= 0) {
          available = false;
          maxPortions = 0;
          break;
        }
        if (ing.gross_quantity > 0) {
          const portions = Math.floor(ing.stock_qty / ing.gross_quantity);
          maxPortions = Math.min(maxPortions, portions);
        }
      }

      if (maxPortions === Infinity) maxPortions = 0;

      availability.push({
        recipe_id: recipe.id,
        name: recipe.name,
        price: recipe.selling_price,
        available,
        estimated_portions: maxPortions
      });
    }

    res.json({ availability, timestamp: new Date().toISOString() });
  } catch (e) {
    return apiError(res, e, { route: 'GET /api/public/v1/availability' });
  }
});

// POST /api/public/v1/orders — Create order from external source.
// PENTEST_REPORT C3.6 — validate quantity is a bounded positive integer.
// Previously `quantity || 1` meant -999999 or 0.5 silently became legal rows,
// and a negative qty could be used to underflow daily revenue stats.
router.post('/v1/orders', apiKeyAuth, requirePermission('write:orders'), (req, res) => {
  try {
    const rid = req.apiKey.restaurant_id;
    const { table_number, items, source, customer_name, notes } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'items required (non-empty array)' });
    }
    if (items.length > 100) {
      return res.status(400).json({ error: 'too many items (max 100 per order)' });
    }
    for (const item of items) {
      if (!item || !Number.isInteger(item.recipe_id) || item.recipe_id < 1) {
        return res.status(400).json({ error: 'each item requires a valid recipe_id (integer)' });
      }
      const q = item.quantity;
      if (q !== undefined && (!Number.isInteger(q) || q < 1 || q > 1000)) {
        return res.status(400).json({ error: 'quantity must be an integer between 1 and 1000' });
      }
    }

    // Calculate total — scoped to this tenant's recipes only
    let totalCost = 0;
    for (const item of items) {
      const recipe = get('SELECT selling_price FROM recipes WHERE id = ? AND restaurant_id = ?', [item.recipe_id, rid]);
      if (!recipe) return res.status(400).json({ error: `Recipe ${item.recipe_id} not found` });
      totalCost += recipe.selling_price * (item.quantity || 1);
    }

    const tn = Number.isInteger(table_number) && table_number >= 0 ? table_number : 0;
    const safeSource = typeof source === 'string' ? source.slice(0, 50).replace(/[\r\n]/g, ' ') : 'api';
    const safeNotes = typeof notes === 'string' ? notes.slice(0, 500) : '';
    const result = run(`INSERT INTO orders (table_number, status, total_cost, restaurant_id, notes, created_at)
      VALUES (?, 'reçu', ?, ?, ?, datetime('now'))`,
      [tn, totalCost, rid, safeNotes ? `[${safeSource}] ${safeNotes}` : `[${safeSource}]`]
    );

    const orderId = Number(result.lastInsertRowid);

    for (const item of items) {
      run(`INSERT INTO order_items (order_id, recipe_id, quantity, status, restaurant_id) VALUES (?, ?, ?, 'attente', ?)`,
        [orderId, item.recipe_id, item.quantity || 1, rid]
      );
    }

    res.json({ ok: true, order_id: orderId, total: totalCost });
  } catch (e) {
    return apiError(res, e, { route: 'POST /api/public/v1/orders' });
  }
});

// GET /api/public/v1/orders/:id — Get order status
router.get('/v1/orders/:id', apiKeyAuth, (req, res) => {
  try {
    const rid = req.apiKey.restaurant_id;
    const order = get('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = all(`
      SELECT oi.*, r.name as recipe_name, r.selling_price
      FROM order_items oi
      JOIN recipes r ON r.id = oi.recipe_id
      WHERE oi.order_id = ?
    `, [order.id]);

    res.json({ ...order, items });
  } catch (e) {
    return apiError(res, e, { route: 'GET /api/public/v1/orders/:id' });
  }
});

// GET /api/public/v1/stock — Current stock levels
router.get('/v1/stock', apiKeyAuth, (req, res) => {
  try {
    const rid = req.apiKey.restaurant_id;
    const stock = all(`
      SELECT s.ingredient_id, i.name, s.quantity, s.unit, s.min_quantity,
        CASE
          WHEN s.quantity <= 0 THEN 'out_of_stock'
          WHEN s.quantity <= s.min_quantity THEN 'low'
          ELSE 'ok'
        END as status
      FROM stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.restaurant_id = ?
      ORDER BY i.name
    `, [rid]);
    res.json({ stock, timestamp: new Date().toISOString() });
  } catch (e) {
    return apiError(res, e, { route: 'GET /api/public/v1/stock' });
  }
});

// GET /api/public/v1/stats — Basic stats
router.get('/v1/stats', apiKeyAuth, (req, res) => {
  try {
    const rid = req.apiKey.restaurant_id;
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = get("SELECT COUNT(*) as c, COALESCE(SUM(total_cost),0) as rev FROM orders WHERE date(created_at) = ? AND status != 'annulé' AND restaurant_id = ?", [today, rid]);
    const totalRecipes = get('SELECT COUNT(*) as c FROM recipes WHERE restaurant_id = ?', [rid]).c;
    const totalIngredients = get('SELECT COUNT(*) as c FROM ingredients WHERE restaurant_id = ?', [rid]).c;
    const lowStock = get('SELECT COUNT(*) as c FROM stock WHERE quantity <= min_quantity AND min_quantity > 0 AND restaurant_id = ?', [rid]).c;

    res.json({
      today: { orders: todayOrders.c, revenue: todayOrders.rev },
      totals: { recipes: totalRecipes, ingredients: totalIngredients },
      alerts: { low_stock: lowStock },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return apiError(res, e, { route: 'GET /api/public/v1/stats' });
  }
});

function getRestaurantInfo(restaurantId = 1) {
  try {
    const r = get('SELECT name, type, address, city, postal_code, phone FROM restaurants WHERE id = ?', [restaurantId]);
    return r || { name: 'Mon Restaurant' };
  } catch (e) {
    console.error('getRestaurantInfo failed:', e);
    return { name: 'Mon Restaurant' };
  }
}

// GET /api/public/docs — API documentation
router.get('/docs', (req, res) => {
  res.json({
    name: 'RestoSuite Public API',
    version: '1.0',
    base_url: '/api/public/v1',
    authentication: 'X-API-Key header or ?api_key= query parameter',
    endpoints: [
      { method: 'GET', path: '/v1/menu', description: 'Get full menu with allergens', permission: 'read' },
      { method: 'GET', path: '/v1/availability', description: 'Check recipe availability and portions', permission: 'read' },
      { method: 'GET', path: '/v1/stock', description: 'Current stock levels', permission: 'read' },
      { method: 'GET', path: '/v1/stats', description: 'Daily stats and alerts', permission: 'read' },
      { method: 'POST', path: '/v1/orders', description: 'Create order from external source', permission: 'write' },
      { method: 'GET', path: '/v1/orders/:id', description: 'Get order status', permission: 'read' }
    ],
    permissions: ['read', 'write', 'admin'],
    rate_limit: '100 requests per hour per key'
  });
});

module.exports = router;
