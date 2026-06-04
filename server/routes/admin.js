// ═══════════════════════════════════════════
// Admin — Dashboard PA
// GET /api/admin/users       — liste tous les comptes owners
// GET /api/admin/stats       — statistiques globales
// GET /api/admin/restaurants — liste tous les restaurants
// ═══════════════════════════════════════════

const express = require('express');
const { all, get } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

// Default platform admin always recognized (matches the client-side hardcoded
// allowlist in client/js/views/admin.js). Additional admins can be added via
// the ADMIN_EMAILS env var (comma-separated). Without this default, a
// missing/misconfigured env var on prod locks out the platform owner.
const DEFAULT_ADMIN_EMAILS = ['barbierpaulaymeric@gmail.com'];

const ADMIN_EMAILS = (() => {
  const fromEnv = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [];
  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...fromEnv]));
})();

// ─── Filtrage des comptes démo / test ───
// Ces comptes servent aux démonstrations et aux tests ; ils ne doivent jamais
// apparaître dans le dashboard admin ni gonfler les statistiques de la plateforme.
const DEMO_EMAILS = [
  'demo@restosuite.fr',
  'marcdupontbrasserie@test.com',
  'marie@bistrot-marie.fr',
  'kenji@sakura-paris.fr',
];

// Renvoie une condition SQL (positive) qui matche un compte démo à partir d'une
// colonne email, plus les paramètres associés. On combine une liste explicite et
// des motifs (« @test. », « demo@ ») pour attraper aussi les futurs comptes de test.
function demoMatch(col) {
  const placeholders = DEMO_EMAILS.map(() => '?').join(', ');
  return {
    sql: `(LOWER(${col}) IN (${placeholders}) OR LOWER(${col}) LIKE '%@test.%' OR LOWER(${col}) LIKE 'demo@%')`,
    params: DEMO_EMAILS.map(e => e.toLowerCase()),
  };
}

// Sous-requête renvoyant les restaurant_id liés à un compte propriétaire démo,
// afin d'exclure ces restaurants des listes et des compteurs.
function demoRestaurantIds() {
  const dm = demoMatch('a2.email');
  return {
    sql: `SELECT a2.restaurant_id FROM accounts a2
          WHERE a2.is_owner = 1 AND a2.restaurant_id IS NOT NULL AND ${dm.sql}`,
    params: dm.params,
  };
}

function requireAdmin(req, res, next) {
  let email = (req.user && req.user.email || '').toLowerCase();
  // Older JWTs (pre-email-claim) only carry { id }; fall back to DB lookup so
  // a stale token doesn't lock the platform admin out.
  if (!email && req.user && req.user.id) {
    const row = get('SELECT email FROM accounts WHERE id = ?', [req.user.id]);
    email = (row && row.email || '').toLowerCase();
  }
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

router.use(requireAuth, requireAdmin);

// ─── GET /api/admin/users ───
router.get('/users', (req, res) => {
  try {
    const dm = demoMatch('a.email');
    const users = all(`
      SELECT a.id, a.email, a.name, a.first_name, a.last_name, a.role,
             a.created_at, a.trial_start, a.last_login,
             r.name AS restaurant_name,
             COALESCE(r.plan, 'free') AS plan
      FROM accounts a
      LEFT JOIN restaurants r ON r.id = a.restaurant_id
      WHERE a.is_owner = 1 AND NOT ${dm.sql}
      ORDER BY a.created_at DESC
    `, dm.params);
    res.json({ users });
  } catch (e) {
    console.error('Admin /users error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/admin/stats ───
router.get('/stats', (req, res) => {
  try {
    const dm = demoMatch('a.email');
    const dr = demoRestaurantIds();

    const totalUsers = get(`
      SELECT COUNT(*) AS c FROM accounts a
      WHERE a.is_owner = 1 AND NOT ${dm.sql}
    `, dm.params).c;

    const totalRestaurants = get(`
      SELECT COUNT(*) AS c FROM restaurants r
      WHERE r.id NOT IN (${dr.sql})
    `, dr.params).c;

    const byPlan = all(`
      SELECT COALESCE(r.plan, 'free') AS plan, COUNT(*) AS count
      FROM accounts a
      LEFT JOIN restaurants r ON r.id = a.restaurant_id
      WHERE a.is_owner = 1 AND NOT ${dm.sql}
      GROUP BY COALESCE(r.plan, 'free')
      ORDER BY count DESC
    `, dm.params);

    const thisWeek = get(`
      SELECT COUNT(*) AS c FROM accounts a
      WHERE a.is_owner = 1 AND a.created_at >= datetime('now', '-7 days') AND NOT ${dm.sql}
    `, dm.params).c;

    const thisMonth = get(`
      SELECT COUNT(*) AS c FROM accounts a
      WHERE a.is_owner = 1 AND a.created_at >= datetime('now', '-30 days') AND NOT ${dm.sql}
    `, dm.params).c;

    res.json({ totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth });
  } catch (e) {
    console.error('Admin /stats error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/admin/restaurants ───
router.get('/restaurants', (req, res) => {
  try {
    const dr = demoRestaurantIds();
    const restaurants = all(`
      SELECT r.id, r.name, r.type, r.city, r.created_at,
             COALESCE(r.plan, 'free') AS plan,
             COUNT(DISTINCT a.id) AS nb_accounts,
             MAX(a.last_login) AS last_activity
      FROM restaurants r
      LEFT JOIN accounts a ON a.restaurant_id = r.id
      WHERE r.id NOT IN (${dr.sql})
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `, dr.params);
    res.json({ restaurants });
  } catch (e) {
    console.error('Admin /restaurants error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
