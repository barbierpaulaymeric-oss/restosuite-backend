const { Router } = require('express');
const { all, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// Ensure health_score_history table exists
try {
  run(`CREATE TABLE IF NOT EXISTS health_score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    score INTEGER NOT NULL,
    date TEXT NOT NULL DEFAULT (date('now')),
    recorded_at TEXT DEFAULT (datetime('now'))
  )`);
  run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_health_score_date
       ON health_score_history (restaurant_id, date)`);
} catch {}

// POST /api/health/score — Sauvegarder le health score du jour
router.post('/score', requireAuth, (req, res) => {
  try {
    const { score } = req.body;
    if (score === undefined || isNaN(Number(score))) {
      return res.status(400).json({ error: 'Score invalide' });
    }
    const s = Math.max(0, Math.min(100, Math.round(Number(score))));

    // Upsert: one score per day per restaurant
    run(
      `INSERT INTO health_score_history (restaurant_id, score, date)
       VALUES (1, ?, date('now'))
       ON CONFLICT(restaurant_id, date) DO UPDATE SET score = excluded.score, recorded_at = datetime('now')`,
      [s]
    );

    res.json({ ok: true, score: s });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/health/history — Historique des health scores (30 derniers jours par défaut)
router.get('/history', requireAuth, (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const history = all(
      `SELECT date, score FROM health_score_history
       WHERE restaurant_id = 1 AND date >= ?
       ORDER BY date ASC`,
      [dateFrom]
    );

    res.json({ days, history });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
