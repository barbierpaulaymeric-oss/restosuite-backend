const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// Apply auth to all integration routes
router.use(requireAuth);

// ═══════════════════════════════════════════
// Intégrations externes (TheFork, POS, etc.)
// ═══════════════════════════════════════════

// Ensure integrations table exists
try {
  run(`CREATE TABLE IF NOT EXISTS integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    provider TEXT NOT NULL,
    enabled INTEGER DEFAULT 0,
    api_key TEXT,
    api_secret TEXT,
    webhook_url TEXT,
    config TEXT DEFAULT '{}',
    last_sync TEXT,
    sync_status TEXT DEFAULT 'never',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(restaurant_id, provider)
  )`);
} catch (e) { /* table already exists */ }

// Ensure reservations table exists
try {
  run(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    party_size INTEGER NOT NULL DEFAULT 2,
    reservation_date TEXT NOT NULL,
    reservation_time TEXT NOT NULL,
    table_id INTEGER,
    status TEXT DEFAULT 'confirmed',
    notes TEXT,
    special_requests TEXT,
    no_show INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
} catch (e) { /* table already exists */ }

// GET /api/integrations — List all integrations
router.get('/', (req, res) => {
  try {
    const integrations = all(`SELECT id, provider, enabled, last_sync, sync_status, config, created_at FROM integrations WHERE restaurant_id = 1`);

    // Add default providers if not configured yet
    const providers = ['thefork', 'pos_caisse', 'comptabilite', 'deliveroo', 'ubereats'];
    const configured = new Set(integrations.map(i => i.provider));

    const result = integrations.map(i => ({
      ...i,
      config: JSON.parse(i.config || '{}'),
      has_credentials: !!(i.api_key)
    }));

    for (const p of providers) {
      if (!configured.has(p)) {
        result.push({
          id: null,
          provider: p,
          enabled: 0,
          last_sync: null,
          sync_status: 'not_configured',
          config: {},
          has_credentials: false
        });
      }
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/integrations/:provider — Configure an integration
router.put('/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const { api_key, api_secret, webhook_url, config, enabled } = req.body;

    const existing = get('SELECT id FROM integrations WHERE restaurant_id = 1 AND provider = ?', [provider]);

    if (existing) {
      run(`UPDATE integrations SET
        api_key = COALESCE(?, api_key),
        api_secret = COALESCE(?, api_secret),
        webhook_url = COALESCE(?, webhook_url),
        config = COALESCE(?, config),
        enabled = COALESCE(?, enabled),
        updated_at = datetime('now')
        WHERE id = ?`,
        [api_key, api_secret, webhook_url, config ? JSON.stringify(config) : null, enabled, existing.id]
      );
      res.json({ ok: true, message: 'Intégration mise à jour' });
    } else {
      run(`INSERT INTO integrations (restaurant_id, provider, api_key, api_secret, webhook_url, config, enabled)
        VALUES (1, ?, ?, ?, ?, ?, ?)`,
        [provider, api_key || null, api_secret || null, webhook_url || null, JSON.stringify(config || {}), enabled ? 1 : 0]
      );
      res.json({ ok: true, message: 'Intégration créée' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/integrations/thefork/sync — Sync reservations from TheFork
// STUB: Real TheFork API not configured. Returns clear status instead of silently failing.
// To implement: replace the stub block below with an actual TheFork API call.
router.post('/thefork/sync', async (req, res) => {
  try {
    const integration = get('SELECT * FROM integrations WHERE provider = ? AND restaurant_id = 1', ['thefork']);

    if (!integration || !integration.enabled) {
      return res.status(400).json({
        error: 'Intégration TheFork non activée',
        hint: 'Activez l\'intégration et renseignez vos credentials TheFork dans les paramètres.'
      });
    }

    if (!integration.api_key) {
      // Mark as not configured so the UI can show an accurate status
      run(`UPDATE integrations SET sync_status = 'not_configured', updated_at = datetime('now') WHERE id = ?`, [integration.id]);
      return res.status(400).json({
        ok: false,
        status: 'not_configured',
        error: 'TheFork API key not configured',
        hint: 'Renseignez votre API key TheFork dans les paramètres d\'intégration.'
      });
    }

    // ── STUB BLOCK ──────────────────────────────────────────────────────────
    // Replace this block with a real TheFork API call when credentials are ready:
    //
    //   const response = await fetch(
    //     `https://api.thefork.com/reservations?date=${today}`,
    //     { headers: { 'Authorization': `Bearer ${integration.api_key}` } }
    //   );
    //   const data = await response.json();
    //   // upsert data.reservations into the reservations table
    //
    // ── END STUB ─────────────────────────────────────────────────────────────

    run(`UPDATE integrations SET last_sync = datetime('now'), sync_status = 'stub', updated_at = datetime('now') WHERE id = ?`, [integration.id]);

    const today = new Date().toISOString().split('T')[0];
    const reservations = all(`
      SELECT * FROM reservations
      WHERE restaurant_id = 1 AND reservation_date >= ?
      ORDER BY reservation_date, reservation_time
    `, [today]);

    res.json({
      ok: true,
      status: 'stub',
      message: 'Synchronisation simulée — intégration TheFork réelle non implémentée.',
      synced_at: new Date().toISOString(),
      reservations_count: reservations.length,
      reservations
    });
  } catch (e) {
    try { run(`UPDATE integrations SET sync_status = 'error', updated_at = datetime('now') WHERE provider = 'thefork' AND restaurant_id = 1`); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// POST /api/integrations/pos/sync — Sync orders/tickets from POS system
// STUB: POS integration not implemented. Returns clear status.
// To implement: replace the stub block below with your POS provider's API call.
router.post('/pos/sync', async (req, res) => {
  try {
    const integration = get('SELECT * FROM integrations WHERE provider = ? AND restaurant_id = 1', ['pos_caisse']);

    if (!integration || !integration.enabled) {
      return res.status(400).json({
        ok: false,
        status: 'not_configured',
        error: 'Intégration POS non activée',
        hint: 'Activez l\'intégration POS et renseignez vos credentials dans les paramètres.'
      });
    }

    if (!integration.api_key) {
      run(`UPDATE integrations SET sync_status = 'not_configured', updated_at = datetime('now') WHERE id = ?`, [integration.id]);
      return res.status(400).json({
        ok: false,
        status: 'not_configured',
        error: 'POS API key not configured',
        hint: 'Renseignez vos credentials POS dans les paramètres d\'intégration.'
      });
    }

    // ── STUB BLOCK ──────────────────────────────────────────────────────────
    // Replace this block with a real POS API call when credentials are ready:
    //
    //   const response = await fetch(
    //     `${integration.webhook_url}/tickets`,
    //     { headers: { 'X-API-Key': integration.api_key } }
    //   );
    //   const data = await response.json();
    //   // process data.tickets and update orders/stock accordingly
    //
    // ── END STUB ─────────────────────────────────────────────────────────────

    run(`UPDATE integrations SET last_sync = datetime('now'), sync_status = 'stub', updated_at = datetime('now') WHERE id = ?`, [integration.id]);

    res.json({
      ok: true,
      status: 'stub',
      message: 'Synchronisation simulée — intégration POS réelle non implémentée.',
      synced_at: new Date().toISOString()
    });
  } catch (e) {
    try { run(`UPDATE integrations SET sync_status = 'error', updated_at = datetime('now') WHERE provider = 'pos_caisse' AND restaurant_id = 1`); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// ─── Reservations CRUD ───

// GET /api/integrations/reservations
router.get('/reservations', (req, res) => {
  try {
    const { date, status } = req.query;
    let sql = `SELECT r.*, t.table_number FROM reservations r LEFT JOIN tables t ON t.id = r.table_id WHERE r.restaurant_id = 1`;
    const params = [];

    if (date) {
      sql += ' AND r.reservation_date = ?';
      params.push(date);
    }
    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.reservation_date, r.reservation_time';
    res.json(all(sql, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/integrations/reservations
router.post('/reservations', (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, table_id, notes, special_requests, source } = req.body;

    if (!customer_name || !reservation_date || !reservation_time) {
      return res.status(400).json({ error: 'Nom, date et heure requis' });
    }

    const result = run(`INSERT INTO reservations (restaurant_id, source, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, table_id, notes, special_requests)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [source || 'manual', customer_name, customer_phone || null, customer_email || null, party_size || 2, reservation_date, reservation_time, table_id || null, notes || null, special_requests || null]
    );

    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/integrations/reservations/:id
router.put('/reservations/:id', (req, res) => {
  try {
    const { status, table_id, notes, no_show } = req.body;
    const id = Number(req.params.id);

    run(`UPDATE reservations SET
      status = COALESCE(?, status),
      table_id = COALESCE(?, table_id),
      notes = COALESCE(?, notes),
      no_show = COALESCE(?, no_show),
      updated_at = datetime('now')
      WHERE id = ?`,
      [status, table_id, notes, no_show, id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/integrations/reservations/:id
router.delete('/reservations/:id', (req, res) => {
  try {
    run('DELETE FROM reservations WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/integrations/reservations/stats — Reservation stats
router.get('/reservations/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const todayCount = get(`SELECT COUNT(*) as c FROM reservations WHERE reservation_date = ? AND status != 'cancelled'`, [today]).c;
    const todayCovers = get(`SELECT COALESCE(SUM(party_size), 0) as c FROM reservations WHERE reservation_date = ? AND status != 'cancelled'`, [today]).c;
    const weekCount = get(`SELECT COUNT(*) as c FROM reservations WHERE reservation_date BETWEEN ? AND ? AND status != 'cancelled'`, [today, weekFromNow]).c;
    const noShowRate = (() => {
      const total = get(`SELECT COUNT(*) as c FROM reservations WHERE reservation_date >= date('now', '-30 days')`).c;
      const noShows = get(`SELECT COUNT(*) as c FROM reservations WHERE reservation_date >= date('now', '-30 days') AND no_show = 1`).c;
      return total > 0 ? Math.round((noShows / total) * 1000) / 10 : 0;
    })();

    const bySource = all(`
      SELECT source, COUNT(*) as count
      FROM reservations WHERE reservation_date >= date('now', '-30 days')
      GROUP BY source
    `);

    res.json({ today_count: todayCount, today_covers: todayCovers, week_count: weekCount, no_show_rate_pct: noShowRate, by_source: bySource });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
