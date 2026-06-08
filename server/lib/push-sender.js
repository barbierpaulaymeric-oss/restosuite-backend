// ═══════════════════════════════════════════
// Envoi des notifications push iOS (APNs HTTP/2).
//
// Mode env-gated : tant que APNS_KEY_ID / APNS_TEAM_ID / APNS_SIGNING_KEY ne
// sont pas configurés, sendPush() est un no-op qui log silencieusement. Ça
// permet de déployer côté serveur SANS la config Apple Developer (la table
// device_push_tokens se remplit, l'envoi est inactif), et d'activer plus tard
// en posant simplement les 3 vars d'env. Même pattern que retention-mailer.js.
//
// Format de la clé : APNS_SIGNING_KEY contient le CONTENU du fichier .p8
// (BEGIN/END PRIVATE KEY inclus, retours à la ligne préservés). Sur Render,
// coller la clé telle quelle dans la valeur env (l'éditeur préserve les \n).
// Alternative : APNS_SIGNING_KEY_PATH pour pointer un fichier sur le disque.
//
// Bundle ID (= Apple "topic") : fr.restosuite.app, hardcodé ici pour éviter
// un faux pas — c'est ce qui apparaît dans capacitor.config.ts.
// ═══════════════════════════════════════════
'use strict';

const fs = require('fs');
const { all, run } = require('../db');

const TOPIC = 'fr.restosuite.app';

let client = null;
let clientInitialized = false;
let configError = null;

function loadSigningKey() {
  const inline = process.env.APNS_SIGNING_KEY;
  if (inline && inline.trim()) return inline.replace(/\\n/g, '\n');
  const keyPath = process.env.APNS_SIGNING_KEY_PATH;
  if (keyPath && fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
  return null;
}

function getClient() {
  if (clientInitialized) return client;
  clientInitialized = true;

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const signingKey = loadSigningKey();

  if (!teamId || !keyId || !signingKey) {
    configError = `[push-sender] APNs non configuré (manque ${[
      !teamId && 'APNS_TEAM_ID',
      !keyId && 'APNS_KEY_ID',
      !signingKey && 'APNS_SIGNING_KEY/APNS_SIGNING_KEY_PATH',
    ].filter(Boolean).join(', ')}) — sendPush sera no-op`;
    console.warn(configError);
    return null;
  }

  // Charge apns2 paresseusement pour ne pas alourdir le boot si non-utilisé.
  let ApnsClient, Notification, Host;
  try { ({ ApnsClient, Notification, Host } = require('apns2')); }
  catch (e) {
    configError = '[push-sender] module apns2 absent — npm install apns2';
    console.error(configError, e);
    return null;
  }

  const host = process.env.APNS_PRODUCTION === '1' ? Host.production : Host.development;
  try {
    client = new ApnsClient({
      team: teamId,
      keyId,
      signingKey,
      defaultTopic: TOPIC,
      host,
      requestTimeout: 10000,
    });
    // Notification injectée sur le module pour réutilisation dans sendPush.
    client._Notification = Notification;
    console.log(`[push-sender] APNs prêt (host=${host}, topic=${TOPIC})`);
  } catch (e) {
    configError = '[push-sender] init APNs échoué: ' + e.message;
    console.error(configError);
    client = null;
  }
  return client;
}

/** Vrai si l'envoi est actif (clé Apple présente + apns2 chargé). */
function isEnabled() { return getClient() !== null; }

/**
 * Envoie une notification à un compte (tous ses tokens iOS enregistrés).
 * @param {number} accountId
 * @param {{title?:string, body:string, badge?:number, data?:object, sound?:string}} payload
 * @returns {Promise<{sent:number, failed:number, skipped:number, failures:Array<{reason,statusCode,tokenId,purged}>}>}
 */
async function sendToAccount(accountId, payload) {
  const stats = { sent: 0, failed: 0, skipped: 0, failures: [] };
  const c = getClient();
  if (!c) { stats.skipped++; return stats; }

  const tokens = all(
    `SELECT id, token FROM device_push_tokens
      WHERE account_id = ? AND platform = 'ios'`,
    [accountId]
  );
  if (!tokens.length) { stats.skipped++; return stats; }

  for (const row of tokens) {
    try {
      await c.send(new c._Notification(row.token, {
        alert: payload.title ? { title: payload.title, body: payload.body || '' } : (payload.body || ''),
        badge: payload.badge,
        sound: payload.sound || 'default',
        data: payload.data || {},
      }));
      stats.sent++;
    } catch (e) {
      stats.failed++;
      const reason = (e && e.reason) || (e && e.message) || 'Unknown';
      const statusCode = (e && e.statusCode) || null;
      let purged = false;
      // BadDeviceToken / Unregistered : token mort, on le purge.
      if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
        try { run('DELETE FROM device_push_tokens WHERE id = ?', [row.id]); purged = true; } catch {}
        console.warn(`[push-sender] token ${reason}, purgé (id=${row.id})`);
      } else {
        console.warn(`[push-sender] échec envoi (token=${row.id}):`, reason, 'status=', statusCode);
      }
      stats.failures.push({ reason, statusCode, tokenId: row.id, purged });
    }
  }
  return stats;
}

/**
 * Envoie une notification à tous les comptes d'un restaurant (multi-device).
 * Utile pour "commande confirmée par le fournisseur" → toute la cuisine voit.
 */
async function sendToRestaurant(restaurantId, payload) {
  const stats = { sent: 0, failed: 0, skipped: 0 };
  const c = getClient();
  if (!c) { stats.skipped++; return stats; }

  const rows = all(
    `SELECT DISTINCT account_id FROM device_push_tokens
      WHERE restaurant_id = ? AND platform = 'ios'`,
    [restaurantId]
  );
  for (const r of rows) {
    const s = await sendToAccount(r.account_id, payload);
    stats.sent += s.sent;
    stats.failed += s.failed;
    stats.skipped += s.skipped;
  }
  return stats;
}

module.exports = { sendToAccount, sendToRestaurant, isEnabled };
