const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { validate, customerValidation } = require('../middleware/validate');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

// Apply auth to all CRM routes (customer PII must be auth-gated)
router.use(requireAuth);

// ═══════════════════════════════════════════
// CRM — Programme de fidélité & clients
// ═══════════════════════════════════════════

// Ensure CRM tables exist
try {
  run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    birthday TEXT,
    notes TEXT,
    tags TEXT DEFAULT '[]',
    loyalty_points INTEGER DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    avg_ticket REAL DEFAULT 0,
    first_visit TEXT,
    last_visit TEXT,
    vip INTEGER DEFAULT 0,
    opt_in_marketing INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  run(`CREATE INDEX IF NOT EXISTS idx_customers_restaurant_id ON customers(restaurant_id)`);
} catch {}

try {
  run(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    points INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    order_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  // Idempotent backfill for DBs pre-dating Phase 2
  try {
    const cols2 = require('../db').db.prepare('PRAGMA table_info(loyalty_transactions)').all().map(c => c.name);
    if (!cols2.includes('restaurant_id')) run('ALTER TABLE loyalty_transactions ADD COLUMN restaurant_id INTEGER DEFAULT 1');
  } catch {}
  run(`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_restaurant_id ON loyalty_transactions(restaurant_id)`);
} catch {}

try {
  run(`CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    points_required INTEGER NOT NULL,
    reward_type TEXT DEFAULT 'discount',
    reward_value REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    times_redeemed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
} catch {}

// ─── Customers CRUD ───

// GET /api/crm/customers
router.get('/customers', (req, res) => {
  try {
    const { search, tag, vip, sort } = req.query;
    let sql = 'SELECT * FROM customers WHERE restaurant_id = ?';
    const params = [req.user.restaurant_id];

    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (tag) {
      sql += " AND tags LIKE ?";
      params.push(`%${tag}%`);
    }
    if (vip === '1') sql += ' AND vip = 1';

    if (sort === 'points') sql += ' ORDER BY loyalty_points DESC';
    else if (sort === 'spent') sql += ' ORDER BY total_spent DESC';
    else if (sort === 'visits') sql += ' ORDER BY total_visits DESC';
    else sql += ' ORDER BY last_visit DESC NULLS LAST, name';

    const customers = all(sql, params);
    res.json(customers.map(c => ({ ...c, tags: JSON.parse(c.tags || '[]') })));
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/crm/customers/:id
router.get('/customers/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const rid = req.user.restaurant_id;
    const customer = get('SELECT * FROM customers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!customer) return res.status(404).json({ error: 'Client non trouvé' });

    const transactions = all(
      'SELECT * FROM loyalty_transactions WHERE customer_id = ? AND restaurant_id = ? ORDER BY created_at DESC LIMIT 50',
      [id, rid]
    );
    const reservations = all(
      'SELECT * FROM reservations WHERE restaurant_id = ? AND (customer_email = ? OR customer_phone = ?) ORDER BY reservation_date DESC LIMIT 20',
      [rid, customer.email, customer.phone]
    );

    res.json({
      ...customer,
      tags: JSON.parse(customer.tags || '[]'),
      transactions,
      reservations
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/crm/customers
router.post('/customers', validate(customerValidation), (req, res) => {
  try {
    const { name, email, phone, birthday, notes, tags } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Format email invalide' });
      }
    }

    const result = run(`INSERT INTO customers (restaurant_id, name, email, phone, birthday, notes, tags, first_visit)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [req.user.restaurant_id, name, email || null, phone || null, birthday || null, notes || null, JSON.stringify(tags || [])]
    );

    res.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/crm/customers/:id
router.put('/customers/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const rid = req.user.restaurant_id;
    const { name, email, phone, birthday, notes, tags, vip, opt_in_marketing } = req.body;

    // Guard: cross-tenant target = 404 (feedback_cross_tenant_404_not_403)
    const before = get('SELECT * FROM customers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!before) return res.status(404).json({ error: 'Client non trouvé' });

    run(`UPDATE customers SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      birthday = COALESCE(?, birthday),
      notes = COALESCE(?, notes),
      tags = COALESCE(?, tags),
      vip = COALESCE(?, vip),
      opt_in_marketing = COALESCE(?, opt_in_marketing),
      updated_at = datetime('now')
      WHERE id = ? AND restaurant_id = ?`,
      [name, email, phone, birthday, notes, tags ? JSON.stringify(tags) : null, vip, opt_in_marketing, id, rid]
    );

    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id || null,
        table_name: 'customers',
        record_id: id,
        action: 'update',
        old_values: before,
        new_values: { name, email, phone, birthday, notes, tags, vip, opt_in_marketing },
      });
    } catch {}

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/crm/customers/:id/visit — Record a visit
router.post('/customers/:id/visit', (req, res) => {
  try {
    const id = Number(req.params.id);
    const rid = req.user.restaurant_id;
    const { amount, order_id } = req.body;
    const spent = amount || 0;

    // Guard tenant before mutating
    const exists = get('SELECT id FROM customers WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!exists) return res.status(404).json({ error: 'Client non trouvé' });

    // Update customer stats
    run(`UPDATE customers SET
      total_visits = total_visits + 1,
      total_spent = total_spent + ?,
      avg_ticket = (total_spent + ?) / (total_visits + 1),
      last_visit = datetime('now'),
      updated_at = datetime('now')
      WHERE id = ? AND restaurant_id = ?`,
      [spent, spent, id, rid]
    );

    // Award loyalty points (1 point per euro spent)
    const pointsEarned = Math.floor(spent);
    if (pointsEarned > 0) {
      run(
        'UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ? AND restaurant_id = ?',
        [pointsEarned, id, rid]
      );
      run(`INSERT INTO loyalty_transactions (restaurant_id, customer_id, points, type, description, order_id)
        VALUES (?, ?, ?, 'earn', ?, ?)`,
        [rid, id, pointsEarned, `Visite : ${spent.toFixed(2)}€`, order_id || null]
      );
    }

    // Auto-VIP at 500 points or 10 visits
    const customer = get(
      'SELECT loyalty_points, total_visits, vip FROM customers WHERE id = ? AND restaurant_id = ?',
      [id, rid]
    );
    if (customer && (customer.loyalty_points >= 500 || customer.total_visits >= 10) && !customer.vip) {
      run('UPDATE customers SET vip = 1 WHERE id = ? AND restaurant_id = ?', [id, rid]);
    }

    res.json({ ok: true, points_earned: pointsEarned });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Loyalty Rewards ───

// GET /api/crm/rewards
router.get('/rewards', (req, res) => {
  try {
    const rewards = all('SELECT * FROM loyalty_rewards WHERE restaurant_id = ? ORDER BY points_required', [req.user.restaurant_id]);
    res.json(rewards);
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/crm/rewards
router.post('/rewards', (req, res) => {
  try {
    const { name, description, points_required, reward_type, reward_value } = req.body;
    if (!name || !points_required) return res.status(400).json({ error: 'Nom et points requis' });

    const result = run(`INSERT INTO loyalty_rewards (restaurant_id, name, description, points_required, reward_type, reward_value)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.restaurant_id, name, description || null, points_required, reward_type || 'discount', reward_value || 0]
    );

    res.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/crm/customers/:id/redeem/:rewardId
router.post('/customers/:id/redeem/:rewardId', (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const rewardId = Number(req.params.rewardId);
    const rid = req.user.restaurant_id;

    const customer = get(
      'SELECT * FROM customers WHERE id = ? AND restaurant_id = ?',
      [customerId, rid]
    );
    const reward = get(
      'SELECT * FROM loyalty_rewards WHERE id = ? AND restaurant_id = ? AND is_active = 1',
      [rewardId, rid]
    );

    if (!customer) return res.status(404).json({ error: 'Client non trouvé' });
    if (!reward) return res.status(404).json({ error: 'Récompense non trouvée' });
    if (customer.loyalty_points < reward.points_required) {
      return res.status(400).json({ error: `Points insuffisants (${customer.loyalty_points}/${reward.points_required})` });
    }

    // Deduct points
    run(
      'UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ? AND restaurant_id = ?',
      [reward.points_required, customerId, rid]
    );

    // Record transaction
    run(`INSERT INTO loyalty_transactions (restaurant_id, customer_id, points, type, description)
      VALUES (?, ?, ?, 'redeem', ?)`,
      [rid, customerId, -reward.points_required, `Récompense : ${reward.name}`]
    );

    // Update reward counter
    run(
      'UPDATE loyalty_rewards SET times_redeemed = times_redeemed + 1 WHERE id = ? AND restaurant_id = ?',
      [rewardId, rid]
    );

    try {
      writeAudit({
        restaurant_id: rid,
        account_id: req.user.id || null,
        table_name: 'loyalty_transactions',
        record_id: customerId,
        action: 'create',
        new_values: { customer_id: customerId, reward_id: rewardId, points: -reward.points_required },
      });
    } catch {}

    res.json({ ok: true, message: `Récompense "${reward.name}" utilisée` });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/crm/stats — CRM statistics
router.get('/stats', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const totalCustomers = get('SELECT COUNT(*) as c FROM customers WHERE restaurant_id = ?', [rid]).c;
    const vipCustomers = get('SELECT COUNT(*) as c FROM customers WHERE restaurant_id = ? AND vip = 1', [rid]).c;
    const totalPoints = get('SELECT COALESCE(SUM(loyalty_points), 0) as c FROM customers WHERE restaurant_id = ?', [rid]).c;
    const avgSpent = get('SELECT COALESCE(AVG(total_spent), 0) as c FROM customers WHERE restaurant_id = ? AND total_visits > 0', [rid]).c;
    const avgVisits = get('SELECT COALESCE(AVG(total_visits), 0) as c FROM customers WHERE restaurant_id = ? AND total_visits > 0', [rid]).c;

    const recentVisitors = all(`
      SELECT name, last_visit, total_visits, loyalty_points, vip
      FROM customers WHERE restaurant_id = ? AND last_visit IS NOT NULL
      ORDER BY last_visit DESC LIMIT 10
    `, [rid]);

    const topSpenders = all(`
      SELECT name, total_spent, total_visits, loyalty_points, vip
      FROM customers WHERE restaurant_id = ?
      ORDER BY total_spent DESC LIMIT 10
    `, [rid]);

    res.json({
      total_customers: totalCustomers,
      vip_customers: vipCustomers,
      total_points_outstanding: totalPoints,
      avg_spent_per_customer: Math.round(avgSpent * 100) / 100,
      avg_visits_per_customer: Math.round(avgVisits * 10) / 10,
      recent_visitors: recentVisitors,
      top_spenders: topSpenders
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
