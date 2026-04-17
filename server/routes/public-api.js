const { Router } = require('express');
const { all, get, run } = require('../db');
const crypto = require('crypto');
const { requireAuth } = require('./auth');
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
} catch {}

// In-memory rate limit windows: api_key -> { count, resetAt }
const rateLimitWindows = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Middleware: authenticate by API key and enforce per-key rate limit
function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'API key required. Pass via X-API-Key header.' });

  const record = get('SELECT * FROM api_keys WHERE api_key = ? AND is_active = 1', [key]);
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
  run('UPDATE api_keys SET last_used = datetime("now"), request_count = request_count + 1 WHERE id = ?', [record.id]);

  req.apiKey = record;
  req.apiPermissions = JSON.parse(record.permissions || '["read"]');
  next();
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.apiPermissions.includes(perm) && !req.apiPermissions.includes('admin')) {
      return res.status(403).json({ error: `Permission '${perm}' required` });
    }
    next();
  };
}

// ─── API Key Management (authenticated via JWT, not API key) ───

// GET /api/public/keys — List API keys (internal)
router.get('/keys', requireAuth, (req, res) => {
  try {
    const keys = all('SELECT id, key_name, api_key, permissions, rate_limit, is_active, last_used, request_count, created_at FROM api_keys WHERE restaurant_id = 1');
    res.json(keys.map(k => ({ ...k, permissions: JSON.parse(k.permissions || '[]') })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/public/keys — Create new API key
router.post('/keys', requireAuth, (req, res) => {
  try {
    const { key_name, permissions } = req.body;
    if (!key_name) return res.status(400).json({ error: 'key_name required' });

    const apiKey = 'rs_' + crypto.randomBytes(24).toString('hex');
    const perms = permissions || ['read'];

    run(`INSERT INTO api_keys (restaurant_id, key_name, api_key, permissions) VALUES (1, ?, ?, ?)`,
      [key_name, apiKey, JSON.stringify(perms)]
    );

    res.json({ ok: true, api_key: apiKey, key_name, permissions: perms });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/public/keys/:id
router.delete('/keys/:id', requireAuth, (req, res) => {
  try {
    run('DELETE FROM api_keys WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), req.user.restaurant_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ═══════════════════════════════════════════
// Public Endpoints (authenticated via API key)
// ═══════════════════════════════════════════

// GET /api/public/v1/menu — Public menu
router.get('/v1/menu', apiKeyAuth, (req, res) => {
  try {
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.selling_price, r.description, r.recipe_type, r.photo_url,
        GROUP_CONCAT(DISTINCT CASE WHEN i.allergens IS NOT NULL AND i.allergens != '' THEN i.allergens END) as allergens
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      LEFT JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE r.selling_price > 0
      GROUP BY r.id
      ORDER BY r.category, r.name
    `);

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
      restaurant: getRestaurantInfo(),
      categories: Object.entries(byCategory).map(([name, items]) => ({ name, items })),
      total_items: recipes.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/public/v1/availability — Check recipe availability
router.get('/v1/availability', apiKeyAuth, (req, res) => {
  try {
    const recipes = all('SELECT id, name, selling_price FROM recipes WHERE selling_price > 0');
    const availability = [];

    for (const recipe of recipes) {
      const ingredients = all(`
        SELECT ri.ingredient_id, ri.gross_quantity, ri.unit,
               s.quantity as stock_qty, i.name as ingredient_name
        FROM recipe_ingredients ri
        LEFT JOIN stock s ON s.ingredient_id = ri.ingredient_id
        LEFT JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = ? AND ri.sub_recipe_id IS NULL
      `, [recipe.id]);

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
    res.status(500).json({ error: e.message });
  }
});

// POST /api/public/v1/orders — Create order from external source
router.post('/v1/orders', apiKeyAuth, requirePermission('write'), (req, res) => {
  try {
    const { table_number, items, source, customer_name, notes } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'items required' });

    // Calculate total
    let totalCost = 0;
    for (const item of items) {
      const recipe = get('SELECT selling_price FROM recipes WHERE id = ?', [item.recipe_id]);
      if (!recipe) return res.status(400).json({ error: `Recipe ${item.recipe_id} not found` });
      totalCost += recipe.selling_price * (item.quantity || 1);
    }

    const result = run(`INSERT INTO orders (table_number, status, total_cost, restaurant_id, notes, created_at)
      VALUES (?, 'reçu', ?, 1, ?, datetime('now'))`,
      [table_number || 0, totalCost, notes ? `[${source || 'api'}] ${notes}` : `[${source || 'api'}]`]
    );

    const orderId = Number(result.lastInsertRowid);

    for (const item of items) {
      run(`INSERT INTO order_items (order_id, recipe_id, quantity, status) VALUES (?, ?, ?, 'attente')`,
        [orderId, item.recipe_id, item.quantity || 1]
      );
    }

    res.json({ ok: true, order_id: orderId, total: totalCost });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/public/v1/orders/:id — Get order status
router.get('/v1/orders/:id', apiKeyAuth, (req, res) => {
  try {
    const order = get('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = all(`
      SELECT oi.*, r.name as recipe_name, r.selling_price
      FROM order_items oi
      JOIN recipes r ON r.id = oi.recipe_id
      WHERE oi.order_id = ?
    `, [order.id]);

    res.json({ ...order, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/public/v1/stock — Current stock levels
router.get('/v1/stock', apiKeyAuth, (req, res) => {
  try {
    const stock = all(`
      SELECT s.ingredient_id, i.name, s.quantity, s.unit, s.min_quantity,
        CASE
          WHEN s.quantity <= 0 THEN 'out_of_stock'
          WHEN s.quantity <= s.min_quantity THEN 'low'
          ELSE 'ok'
        END as status
      FROM stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      ORDER BY i.name
    `);
    res.json({ stock, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/public/v1/stats — Basic stats
router.get('/v1/stats', apiKeyAuth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = get("SELECT COUNT(*) as c, COALESCE(SUM(total_cost),0) as rev FROM orders WHERE date(created_at) = ? AND status != 'annulé'", [today]);
    const totalRecipes = get('SELECT COUNT(*) as c FROM recipes').c;
    const totalIngredients = get('SELECT COUNT(*) as c FROM ingredients').c;
    const lowStock = get('SELECT COUNT(*) as c FROM stock WHERE quantity <= min_quantity AND min_quantity > 0').c;

    res.json({
      today: { orders: todayOrders.c, revenue: todayOrders.rev },
      totals: { recipes: totalRecipes, ingredients: totalIngredients },
      alerts: { low_stock: lowStock },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function getRestaurantInfo() {
  try {
    const r = get('SELECT name, type, address, city, postal_code, phone FROM restaurants WHERE id = 1');
    return r || { name: 'Mon Restaurant' };
  } catch {
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
