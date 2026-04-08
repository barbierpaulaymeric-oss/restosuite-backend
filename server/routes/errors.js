const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('./auth');

const LOG_PATH = path.join(__dirname, '..', 'data', 'errors.log');
const MAX_LINES = 1000;

// ─── Helpers ───

function appendError(entry) {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(LOG_PATH, line, 'utf8');
}

function readRecentErrors(count = 50) {
  if (!fs.existsSync(LOG_PATH)) return [];
  const lines = fs.readFileSync(LOG_PATH, 'utf8')
    .split('\n')
    .filter(l => l.trim());
  const recent = lines.slice(-count);
  return recent.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean).reverse();
}

// ─── POST /api/errors/report — client-side error ingestion ───
router.post('/report', requireAuth, (req, res) => {
  const { message, source, lineno, colno, stack, type } = req.body || {};

  if (!message) return res.status(400).json({ error: 'message requis' });

  const entry = {
    ts: new Date().toISOString(),
    origin: 'client',
    type: type || 'error',
    message: String(message).slice(0, 500),
    source: source ? String(source).slice(0, 200) : undefined,
    lineno: lineno || undefined,
    colno: colno || undefined,
    stack: stack ? String(stack).slice(0, 2000) : undefined,
    user_id: req.user ? req.user.id : undefined,
    user_role: req.user ? req.user.role : undefined,
  };

  try {
    appendError(entry);
  } catch (e) {
    console.error('Error writing to errors.log:', e.message);
  }

  res.json({ ok: true });
});

// ─── GET /api/errors/recent — gérant only ───
router.get('/recent', requireAuth, (req, res) => {
  if (req.user.role !== 'gerant') {
    return res.status(403).json({ error: 'Réservé au gérant' });
  }

  try {
    const errors = readRecentErrors(50);
    res.json({ errors, count: errors.length });
  } catch (e) {
    res.status(500).json({ error: 'Impossible de lire le journal d\'erreurs' });
  }
});

module.exports = { router, appendError, LOG_PATH, MAX_LINES };
