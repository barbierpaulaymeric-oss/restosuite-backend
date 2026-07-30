'use strict';
// ═══════════════════════════════════════════
// POST /api/demo — Demande de démonstration (PUBLIC, non authentifié).
//
// Formulaire landing « Réserver une démo » : nom, prénom, restaurant, téléphone,
// email. Objectif : permettre au fondateur de recontacter le prospect. On
// STOCKE la demande en base (source de vérité, consultable même si l'email
// échoue) PUIS on notifie contact@ en best-effort (jamais bloquant).
//
// Aucune donnée n'est exposée en retour ; le rate limiter public (app.js) et un
// honeypot limitent le spam. Le consentement de recontact est explicite (case à
// cocher côté client, stocké consent=1).
// ═══════════════════════════════════════════
const express = require('express');
const router = express.Router();
const { run } = require('../db');

// Table créée à la volée (idempotent) — pas de PII au-delà de ce que le
// prospect fournit volontairement pour être recontacté ; purgeable.
try {
  run(`CREATE TABLE IF NOT EXISTS demo_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    restaurant TEXT,
    phone TEXT,
    email TEXT NOT NULL,
    source TEXT,
    consent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    handled_at TEXT
  )`);
} catch {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

router.post('/', async (req, res) => {
  // Honeypot : un champ « website » invisible côté client ; s'il est rempli,
  // c'est un bot → on répond 200 sans rien enregistrer (ne pas renseigner le bot).
  if (req.body && typeof req.body.website === 'string' && req.body.website.trim() !== '') {
    return res.json({ ok: true });
  }

  const first_name = clean(req.body.first_name, 80);
  const last_name = clean(req.body.last_name, 80);
  const restaurant = clean(req.body.restaurant, 120);
  const phone = clean(req.body.phone, 40);
  const email = clean(req.body.email, 160).toLowerCase();
  const consent = req.body.consent === true;

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Un email valide est requis.' });
  }
  if (!consent) {
    return res.status(400).json({ error: 'Merci de confirmer que nous pouvons vous recontacter.' });
  }

  let requestId;
  try {
    const result = run(
      `INSERT INTO demo_requests (first_name, last_name, restaurant, phone, email, source, consent)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [first_name, last_name, restaurant, phone, email, clean(req.body.source, 40) || 'landing']
    );
    requestId = Number(result.lastInsertRowid);
  } catch (e) {
    console.error('Demo request insert failed:', e.message);
    return res.status(500).json({ error: 'Une erreur est survenue. Réessayez ou écrivez à contact@restosuite.fr.' });
  }

  // Funnel : trace agrégée (aucune PII dans product_events).
  try { require('../lib/product-events').recordProductEvent('demo_requested', { source: 'landing' }); } catch {}

  // Notification best-effort au fondateur — n'échoue jamais la requête, et ne
  // tente l'envoi que si le SMTP contact est configuré (sinon, comme le poller
  // mercuriale, on s'auto-désactive silencieusement : la demande reste en base).
  const smtpConfigured = !!(process.env.CONTACT_EMAIL && process.env.CONTACT_EMAIL_PASSWORD)
    || !!(process.env.MERCURIALE_EMAIL && process.env.MERCURIALE_PASSWORD);
  if (smtpConfigured) {
    try {
      const { sendContactEmail } = require('../lib/mercuriale-mail/smtp-client');
      const to = process.env.DEMO_NOTIFY_EMAIL || process.env.CONTACT_EMAIL || 'contact@restosuite.fr';
      const lines = [
        'Nouvelle demande de démonstration RestoSuite :',
        '',
        `Prénom      : ${first_name || '—'}`,
        `Nom         : ${last_name || '—'}`,
        `Restaurant  : ${restaurant || '—'}`,
        `Téléphone   : ${phone || '—'}`,
        `Email       : ${email}`,
        '',
        `Demande #${requestId}`,
      ];
      Promise.resolve(sendContactEmail({
        to,
        subject: `Demande de démo — ${restaurant || email}`,
        text: lines.join('\n'),
      })).catch(err => console.error('Demo notify email failed:', err.message));
    } catch (e) {
      console.error('Demo notify setup failed:', e.message);
    }
  }

  res.json({ ok: true, message: 'Merci ! Nous vous recontactons très vite.' });
});

module.exports = router;
