'use strict';

const { Router } = require('express');
const { readAudit } = require('../lib/audit-log');
const { requireAuth } = require('./auth');
const router = Router();

// GET /api/audit-log — gérant-only, tenant-scoped audit trail
router.get('/', requireAuth, (req, res) => {
  try {
    if (req.user.role !== 'gerant') {
      return res.status(403).json({ error: 'Gérant requis' });
    }
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const table_name = req.query.table_name || undefined;
    const record_id = req.query.record_id ? Number(req.query.record_id) : undefined;
    const entries = readAudit({
      restaurant_id: req.user.restaurant_id,
      table_name,
      record_id,
      limit,
    });
    res.json({ entries, count: entries.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
