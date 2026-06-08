// ═══════════════════════════════════════════
// Relance push : les relevés de température HACCP du jour sont-ils saisis ?
//
// Règle simple (volontairement) : pour chaque restaurant ayant des zones HACCP
// actives, on vérifie si AUCUN relevé n'a été saisi depuis ≥ 4 h. Si oui, on
// pousse une notification à toute la cuisine. On envoie au plus UN rappel
// par restaurant et par jour (table `haccp_push_reminders_sent`, UNIQUE).
//
// Le réveil est exposé via /api/cron/haccp-reminder (cron.js). Pas de
// setInterval interne — on s'aligne sur le modèle retention-mailer cron.
//
// Si APNs n'est pas configuré, sendToRestaurant() est no-op : le rappel passe
// quand même sa logique (ce qui marque le restaurant comme « notifié » pour
// la journée), donc on évite ce side-effect en ne marquant que si réellement
// envoyé.
// ═══════════════════════════════════════════
'use strict';

const { all, get, run } = require('../db');
const { sendToRestaurant, isEnabled: pushEnabled } = require('./push-sender');

// Une fois la journée HACCP entamée (4 h sans relevé après 9 h locale, par
// exemple) — on garde simple : décale d'un offset configurable (par défaut 4h).
const STALE_HOURS = Number(process.env.HACCP_REMINDER_STALE_HOURS || 4);

function today() { return new Date().toISOString().slice(0, 10); }

function ensureTable() {
  // Table d'anti-doublons. Créée paresseusement (le boot ne la connaît pas
  // forcément si la migration n'a pas tourné côté Render).
  run(`CREATE TABLE IF NOT EXISTS haccp_push_reminders_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_haccp_reminders_unique
       ON haccp_push_reminders_sent(restaurant_id, day)`);
}

/**
 * Pour chaque restaurant éligible, envoie une push de relance T° si aucun
 * relevé du jour ne couvre les `STALE_HOURS` dernières heures.
 * @returns {Promise<{checked:number, reminded:number, skipped:number}>}
 */
async function runHaccpReminderCycle() {
  ensureTable();
  const stats = { checked: 0, reminded: 0, skipped: 0 };
  if (!pushEnabled()) { stats.skipped = -1; return stats; }

  const day = today();

  // Restaurants qui ont AU MOINS une zone configurée (sinon ils n'attendent
  // pas de relevés et la relance n'a aucun sens). Tables réelles :
  // `temperature_zones` + `temperature_logs` (pas haccp_*).
  const restos = all(`SELECT DISTINCT restaurant_id FROM temperature_zones`);
  for (const r of restos) {
    const rid = r.restaurant_id;
    stats.checked++;

    // Déjà relancé aujourd'hui ?
    const already = get(
      `SELECT 1 FROM haccp_push_reminders_sent WHERE restaurant_id = ? AND day = ?`,
      [rid, day]
    );
    if (already) continue;

    // Dernier relevé du jour
    const lastEntry = get(
      `SELECT recorded_at FROM temperature_logs
        WHERE restaurant_id = ? AND date(recorded_at) = ?
        ORDER BY recorded_at DESC LIMIT 1`,
      [rid, day]
    );
    if (lastEntry) {
      // Trop récent → pas la peine de relancer
      const ageH = (Date.now() - new Date(lastEntry.recorded_at + 'Z').getTime()) / 3_600_000;
      if (ageH < STALE_HOURS) continue;
    }

    // Push !
    try {
      const sent = await sendToRestaurant(rid, {
        title: 'Relevés T° en attente',
        body: 'Pensez à enregistrer les températures HACCP du service.',
        data: { kind: 'haccp_reminder', day },
      });
      if (sent && sent.sent > 0) {
        run(
          `INSERT OR IGNORE INTO haccp_push_reminders_sent (restaurant_id, day) VALUES (?, ?)`,
          [rid, day]
        );
        stats.reminded++;
      }
    } catch (e) {
      console.warn('[haccp-reminder] resto', rid, 'échec:', e.message);
    }
  }
  return stats;
}

module.exports = { runHaccpReminderCycle };
