const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// ═══════════════════════════════════════════
// Multi-Sites — Gestion multi-établissements
// ═══════════════════════════════════════════

// Ensure multi-site columns exist
try { run(`ALTER TABLE restaurants ADD COLUMN logo_url TEXT`); } catch {}
try { run(`ALTER TABLE restaurants ADD COLUMN timezone TEXT DEFAULT 'Europe/Paris'`); } catch {}
try { run(`ALTER TABLE restaurants ADD COLUMN currency TEXT DEFAULT 'EUR'`); } catch {}
try { run(`ALTER TABLE restaurants ADD COLUMN is_active INTEGER DEFAULT 1`); } catch {}
try { run(`ALTER TABLE restaurants ADD COLUMN service_start TEXT DEFAULT '11:30'`); } catch {}
try { run(`ALTER TABLE restaurants ADD COLUMN service_end TEXT DEFAULT '23:00'`); } catch {}

// GET /api/sites — Liste tous les établissements (du tenant courant)
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const sites = all(`
      SELECT r.*,
        (SELECT COUNT(*) FROM tables t WHERE t.restaurant_id = r.id) as table_count,
        (SELECT COUNT(*) FROM accounts a WHERE a.restaurant_id = r.id) as staff_count
      FROM restaurants r
      WHERE r.id = ?
      ORDER BY r.id
    `, [rid]);
    res.json(sites);
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/sites/:id — Détail d'un site
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (id !== rid) return res.status(404).json({ error: 'Site non trouvé' });
    const site = get(`
      SELECT r.*,
        (SELECT COUNT(*) FROM tables t WHERE t.restaurant_id = r.id) as table_count,
        (SELECT COUNT(*) FROM accounts a WHERE a.restaurant_id = r.id) as staff_count
      FROM restaurants r WHERE r.id = ?
    `, [id]);

    if (!site) return res.status(404).json({ error: 'Site non trouvé' });

    // Tables
    const tables = all('SELECT * FROM tables WHERE restaurant_id = ? ORDER BY zone, table_number', [id]);

    // Staff
    const staff = all('SELECT id, name, role, email FROM accounts WHERE restaurant_id = ?', [id]);

    res.json({ ...site, tables, staff });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/sites — Créer un nouveau site
router.post('/', (req, res) => {
  try {
    const { name, type, address, city, postal_code, phone, covers, siret } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });

    const result = run(`INSERT INTO restaurants (name, type, address, city, postal_code, phone, covers, siret)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, type || null, address || null, city || null, postal_code || null, phone || null, covers || 30, siret || null]
    );

    res.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/sites/:id — Modifier un site
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (id !== rid) return res.status(404).json({ error: 'Site non trouvé' });
    const { name, type, address, city, postal_code, phone, covers, siret, is_active, service_start, service_end } = req.body;

    run(`UPDATE restaurants SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      address = COALESCE(?, address),
      city = COALESCE(?, city),
      postal_code = COALESCE(?, postal_code),
      phone = COALESCE(?, phone),
      covers = COALESCE(?, covers),
      siret = COALESCE(?, siret),
      is_active = COALESCE(?, is_active),
      service_start = COALESCE(?, service_start),
      service_end = COALESCE(?, service_end)
      WHERE id = ?`,
      [name, type, address, city, postal_code, phone, covers, siret, is_active, service_start, service_end, id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// DELETE /api/sites/:id — Supprimer un site
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (id !== rid) return res.status(404).json({ error: 'Site non trouvé' });
    const site = get('SELECT * FROM restaurants WHERE id = ?', [id]);
    if (!site) return res.status(404).json({ error: 'Site non trouvé' });

    // Check foreign key dependencies
    const tableCount = get('SELECT COUNT(*) as c FROM tables WHERE restaurant_id = ?', [id]);
    if (tableCount.c > 0) {
      return res.status(409).json({ error: `Impossible de supprimer : ${tableCount.c} table(s) associée(s). Supprimez-les d'abord.` });
    }

    const staffCount = get('SELECT COUNT(*) as c FROM accounts WHERE restaurant_id = ?', [id]);
    if (staffCount.c > 0) {
      return res.status(409).json({ error: `Impossible de supprimer : ${staffCount.c} membre(s) du personnel associé(s). Transférez-les d'abord.` });
    }

    const orderCount = get(`SELECT COUNT(*) as c FROM orders WHERE restaurant_id = ?`, [id]);
    if (orderCount.c > 0) {
      return res.status(409).json({ error: `Impossible de supprimer : ${orderCount.c} commande(s) associée(s) à cet établissement.` });
    }

    run('DELETE FROM restaurants WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/sites/compare — Comparaison multi-sites (restreint au tenant courant)
router.get('/compare/all', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const sites = all('SELECT id, name FROM restaurants WHERE id = ? AND (is_active = 1 OR is_active IS NULL)', [rid]);
    const days = Number(req.query.days) || 30;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const comparison = sites.map(site => {
      // Revenue
      const revenue = get(`
        SELECT COALESCE(SUM(o.total_cost), 0) as total
        FROM orders o WHERE o.restaurant_id = ? AND o.status != 'annulé' AND date(o.created_at) >= ?
      `, [site.id, dateFrom]);

      // Order count
      const orderCount = get(`
        SELECT COUNT(*) as c FROM orders o
        WHERE o.restaurant_id = ? AND o.status != 'annulé' AND date(o.created_at) >= ?
      `, [site.id, dateFrom]);

      // Staff count
      const staffCount = get('SELECT COUNT(*) as c FROM accounts WHERE restaurant_id = ?', [site.id]);

      // Table count
      const tableCount = get('SELECT COUNT(*) as c FROM tables WHERE restaurant_id = ?', [site.id]);

      return {
        id: site.id,
        name: site.name,
        revenue: Math.round((revenue?.total || 0) * 100) / 100,
        orders: orderCount?.c || 0,
        avg_ticket: orderCount?.c > 0 ? Math.round((revenue?.total || 0) / orderCount.c * 100) / 100 : 0,
        staff: staffCount?.c || 0,
        tables: tableCount?.c || 0
      };
    });

    res.json({ period_days: days, sites: comparison });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
