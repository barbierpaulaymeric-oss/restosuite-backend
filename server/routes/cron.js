'use strict';

// Endpoints déclenchables par un planificateur externe (Render Cron Job, etc.).
// Alternative au setInterval interne — utile si on préfère piloter le rythme
// depuis Render plutôt que depuis le process. Les deux peuvent coexister sans
// risque : retention_emails_sent (index unique) empêche tout doublon.
//
// Protection : CRON_SECRET (header `x-cron-secret` ou query `?token=`). Sans
// secret configuré, l'endpoint est fermé (503) — jamais ouvert au public.

const express = require('express');
const router = express.Router();
const { runRetentionCycle } = require('../lib/retention-mailer');

function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'CRON_SECRET non configuré' });
  }
  const provided = req.get('x-cron-secret') || req.query.token;
  if (provided !== secret) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  next();
}

// GET /api/cron/retention-check — lance un cycle de relances anti-churn.
router.get('/retention-check', requireCronSecret, async (req, res) => {
  try {
    const result = await runRetentionCycle();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Cron retention-check error:', e.message);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
