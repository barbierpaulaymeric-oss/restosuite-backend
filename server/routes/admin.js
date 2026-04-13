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

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'barbierpaulaymeric@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

function requireAdmin(req, res, next) {
  const email = (req.user.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

router.use(requireAuth, requireAdmin);

// ─── GET /api/admin/users ───
router.get('/users', (req, res) => {
  try {
    const users = all(`
      SELECT a.id, a.email, a.name, a.first_name, a.last_name, a.role,
             a.created_at, a.trial_start, a.last_login,
             r.name AS restaurant_name,
             COALESCE(r.plan, 'discovery') AS plan
      FROM accounts a
      LEFT JOIN restaurants r ON r.id = a.restaurant_id
      WHERE a.is_owner = 1
      ORDER BY a.created_at DESC
    `);
    res.json({ users });
  } catch (e) {
    console.error('Admin /users error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/admin/stats ───
router.get('/stats', (req, res) => {
  try {
    const totalUsers = get('SELECT COUNT(*) AS c FROM accounts WHERE is_owner = 1').c;
    const totalRestaurants = get('SELECT COUNT(*) AS c FROM restaurants').c;

    const byPlan = all(`
      SELECT COALESCE(r.plan, 'discovery') AS plan, COUNT(*) AS count
      FROM accounts a
      LEFT JOIN restaurants r ON r.id = a.restaurant_id
      WHERE a.is_owner = 1
      GROUP BY COALESCE(r.plan, 'discovery')
      ORDER BY count DESC
    `);

    const thisWeek = get(`
      SELECT COUNT(*) AS c FROM accounts
      WHERE is_owner = 1 AND created_at >= datetime('now', '-7 days')
    `).c;

    const thisMonth = get(`
      SELECT COUNT(*) AS c FROM accounts
      WHERE is_owner = 1 AND created_at >= datetime('now', '-30 days')
    `).c;

    res.json({ totalUsers, totalRestaurants, byPlan, thisWeek, thisMonth });
  } catch (e) {
    console.error('Admin /stats error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/admin/restaurants ───
router.get('/restaurants', (req, res) => {
  try {
    const restaurants = all(`
      SELECT r.id, r.name, r.type, r.city, r.created_at,
             COALESCE(r.plan, 'discovery') AS plan,
             COUNT(DISTINCT a.id) AS nb_accounts,
             MAX(a.last_login) AS last_activity
      FROM restaurants r
      LEFT JOIN accounts a ON a.restaurant_id = r.id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);
    res.json({ restaurants });
  } catch (e) {
    console.error('Admin /restaurants error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
