'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Anonymisation des comptes inactifs — RGPD Art. 5.1.e (limitation de
// conservation) & Art. 17 (effacement).
//
// Cible : un restaurant SANS abonnement actif, dont TOUS les comptes sont
// inactifs depuis plus de RETENTION_YEARS (dernière connexion, ou création à
// défaut), hors comptes de démonstration, et pas déjà anonymisé.
//
// On ANONYMISE plutôt qu'on supprime (la politique dit « supprimées OU
// anonymisées de manière irréversible ») : cela retire les données personnelles
// tout en conservant les factures liées pendant les 10 ans d'obligation
// comptable, sans casser l'intégrité référentielle.
//
// SÉCURITÉ : dry-run par défaut. Aucune écriture tant que
// RETENTION_PURGE_ENABLED !== 'true' — on se contente de journaliser les
// candidats pour que l'exploitant valide d'abord. (Produit lancé en 2026 → aucun
// compte ne qualifie encore ; la tâche prépare l'application automatique.)
// ═══════════════════════════════════════════════════════════════════════════

const { all, run, db } = require('../db');
const { demoMatchSql } = require('./demo-accounts');

const RETENTION_YEARS = 3;

// Restaurants éligibles à l'anonymisation.
function findCandidates() {
  const demo = demoMatchSql('a.email');
  const sql = `
    SELECT r.id AS restaurant_id, r.name AS restaurant_name
    FROM restaurants r
    WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.restaurant_id = r.id)
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s JOIN accounts a ON a.id = s.account_id
        WHERE a.restaurant_id = r.id AND s.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM accounts a WHERE a.restaurant_id = r.id
          AND COALESCE(a.last_login, a.created_at) >= datetime('now', '-${RETENTION_YEARS} years')
      )
      AND NOT EXISTS (
        SELECT 1 FROM accounts a WHERE a.restaurant_id = r.id AND a.anonymized_at IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM accounts a WHERE a.restaurant_id = r.id AND ${demo.sql}
      )
  `;
  return all(sql, [...demo.params]);
}

// Remplace les données personnelles d'un restaurant par des valeurs neutres.
// Les tables métier (factures, fiches, HACCP…) sont conservées telles quelles.
function anonymizeRestaurant(rid) {
  const tx = db.transaction(() => {
    run(
      `UPDATE accounts SET
         name = '[compte supprimé]',
         email = 'anon-' || id || '@deleted.invalid',
         first_name = NULL, last_name = NULL, phone = NULL,
         password_hash = NULL, pin = '', permissions = '{}',
         anonymized_at = datetime('now')
       WHERE restaurant_id = ?`,
      [rid]
    );
    // Données du personnel (dont les données de santé Art. 9).
    try { run(`UPDATE staff_members SET name='[anonymisé]', email=NULL, phone=NULL WHERE restaurant_id = ?`, [rid]); } catch {}
    try { run(`UPDATE staff_health_records SET staff_name='[anonymisé]', notes=NULL, document_path=NULL WHERE restaurant_id = ?`, [rid]); } catch {}
    // Clients fidélité (CRM).
    try { run(`UPDATE customers SET name='[anonymisé]', email=NULL, phone=NULL, birthday=NULL, notes=NULL WHERE restaurant_id = ?`, [rid]); } catch {}
  });
  tx();
}

// Exécute un cycle. Renvoie un rapport { dryRun, candidates, anonymized, restaurant_ids }.
async function runRetentionPurge({ dryRun } = {}) {
  const enabled = process.env.RETENTION_PURGE_ENABLED === 'true';
  const effectiveDryRun = dryRun !== undefined ? dryRun : !enabled;
  const candidates = findCandidates();
  const ids = candidates.map(c => c.restaurant_id);

  if (effectiveDryRun) {
    if (candidates.length) {
      console.log(
        `🧹 [retention-purge] DRY-RUN — ${candidates.length} restaurant(s) inactif(s) >${RETENTION_YEARS} ans ` +
        `à anonymiser: ${ids.join(', ')}. Activer avec RETENTION_PURGE_ENABLED=true.`
      );
    }
    return { dryRun: true, candidates: candidates.length, anonymized: 0, restaurant_ids: ids };
  }

  let anonymized = 0;
  for (const c of candidates) {
    try { anonymizeRestaurant(c.restaurant_id); anonymized++; }
    catch (e) { console.error(`[retention-purge] échec rid=${c.restaurant_id}:`, e.message); }
  }
  if (anonymized) console.log(`🧹 [retention-purge] ${anonymized} restaurant(s) anonymisé(s) (RGPD Art. 17).`);
  return { dryRun: false, candidates: candidates.length, anonymized, restaurant_ids: ids };
}

// Planificateur — un passage par jour. Reste en dry-run tant que
// RETENTION_PURGE_ENABLED !== 'true'.
let _timer = null;
function startRetentionPurge({ intervalMs } = {}) {
  const ms = intervalMs || 24 * 60 * 60 * 1000;
  const tick = () => runRetentionPurge().catch(e => console.error('[retention-purge] tick error:', e.message));
  tick();
  _timer = setInterval(tick, ms);
  if (_timer.unref) _timer.unref();
  return _timer;
}
function stopRetentionPurge() { if (_timer) { clearInterval(_timer); _timer = null; } }

module.exports = { runRetentionPurge, startRetentionPurge, stopRetentionPurge, findCandidates, anonymizeRestaurant, RETENTION_YEARS };
