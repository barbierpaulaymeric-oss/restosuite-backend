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

// GET /api/health/persistence — État de la persistance (monitoring).
// Booléens et horodatages uniquement : aucun chemin complet, aucun secret,
// aucune donnée métier. Sert à détecter un déploiement où la base serait
// retombée sur le disque éphémère ou dont les sauvegardes ne tournent plus.
router.get('/persistence', (req, res) => {
  try {
    const fs = require('fs');
    const { resolveDbPath, resolveBackupDir } = require('../db-path');
    const dbPath = resolveDbPath();
    const inMemory = dbPath === ':memory:';

    const storage = inMemory
      ? 'memory'
      : (process.env.DB_PATH ? 'db-path-env' : (dbPath.startsWith('/data/') ? 'persistent-disk' : 'local-dir'));

    let dbExists = false, encrypted = false, walActive = false;
    if (!inMemory && fs.existsSync(dbPath)) {
      dbExists = true;
      // Chiffrée = l'en-tête n'est plus le magic "SQLite format 3" en clair.
      try {
        const fd = fs.openSync(dbPath, 'r');
        const buf = Buffer.alloc(16);
        const n = fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        encrypted = n >= 16 && !buf.toString('latin1').startsWith('SQLite format 3');
      } catch {}
      walActive = fs.existsSync(dbPath + '-wal');
    }

    let lastBackupAt = null, backupsCount = 0;
    const backupDir = resolveBackupDir();
    if (backupDir && fs.existsSync(backupDir)) {
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('restosuite-') && f.endsWith('.db'))
        .sort();
      backupsCount = backups.length;
      if (backups.length) {
        lastBackupAt = fs.statSync(require('path').join(backupDir, backups[backups.length - 1])).mtime.toISOString();
      }
    }

    res.json({
      status: 'ok',
      storage,                      // 'persistent-disk' | 'db-path-env' | 'local-dir' | 'memory'
      persistent: storage === 'persistent-disk' || storage === 'db-path-env',
      db_exists: dbExists,
      encrypted_at_rest: encrypted,
      wal_active: walActive,
      backups_count: backupsCount,
      last_backup_at: lastBackupAt,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ status: 'error', error: 'Vérification de persistance impossible' });
  }
});

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
       VALUES (?, ?, date('now'))
       ON CONFLICT(restaurant_id, date) DO UPDATE SET score = excluded.score, recorded_at = datetime('now')`,
      [req.user.restaurant_id, s]
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
       WHERE restaurant_id = ? AND date >= ?
       ORDER BY date ASC`,
      [req.user.restaurant_id, dateFrom]
    );

    res.json({ days, history });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
