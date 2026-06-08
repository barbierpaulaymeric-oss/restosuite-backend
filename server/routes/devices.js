// ═══════════════════════════════════════════
// /api/devices — Enregistrement des appareils mobiles pour les push.
//
// L'app mobile (RestoSuite Cuisine, Capacitor) envoie le token APNs/FCM à
// chaque démarrage. Le serveur n'envoie pas encore de push (la mise en place
// des certificats Apple / clé FCM est manuelle), mais cette route est en
// place pour stocker les destinataires dès qu'on activera l'envoi.
//
// Modèle volontairement simple :
//  - POST /register   { token, platform, app_version? }
//  - DELETE /         (supprime tous les tokens du compte courant — logout)
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');

const router = Router();
router.use(requireAuth);

const PLATFORMS = new Set(['ios', 'android']);

router.post('/register', (req, res) => {
  try {
    const { token, platform, app_version } = req.body || {};
    if (!token || typeof token !== 'string' || token.length > 512) {
      return res.status(400).json({ error: 'token (string ≤512 chars) requis' });
    }
    if (!PLATFORMS.has(platform)) {
      return res.status(400).json({ error: 'platform doit être ios ou android' });
    }
    const aid = req.user.id;
    const rid = req.user.restaurant_id;

    // UPSERT : si le même token revient (rotation, réinstall), on remet
    // à jour le compte porteur — un token n'appartient qu'à UN appareil
    // à la fois côté Apple/Google, donc le dernier qui le déclare gagne.
    run(
      `INSERT INTO device_push_tokens (account_id, restaurant_id, token, platform, app_version)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
           account_id = excluded.account_id,
           restaurant_id = excluded.restaurant_id,
           platform = excluded.platform,
           app_version = excluded.app_version,
           updated_at = CURRENT_TIMESTAMP`,
      [aid, rid, token, platform, app_version || null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('devices/register error:', e);
    res.status(500).json({ error: 'Erreur enregistrement appareil' });
  }
});

// GET /api/devices — liste des appareils enregistrés pour le compte courant
// (utile pour le compte : « Vous êtes connecté sur 2 appareils »).
router.get('/', (req, res) => {
  try {
    const rows = all(
      `SELECT id, platform, app_version, created_at, updated_at
         FROM device_push_tokens
        WHERE account_id = ?
        ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json({ devices: rows });
  } catch (e) {
    console.error('devices/list error:', e);
    res.status(500).json({ error: 'Erreur liste appareils' });
  }
});

// DELETE /api/devices — déconnexion : on retire tous les tokens du compte.
router.delete('/', (req, res) => {
  try {
    run(`DELETE FROM device_push_tokens WHERE account_id = ?`, [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('devices/delete error:', e);
    res.status(500).json({ error: 'Erreur désinscription appareils' });
  }
});

module.exports = router;
