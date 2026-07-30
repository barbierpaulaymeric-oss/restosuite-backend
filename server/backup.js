'use strict';
// ═══════════════════════════════════════════
// Sauvegarde locale de la base (appelée au boot + toutes les 6 h par index.js,
// et manuellement via POST /api/admin/backup).
//
// Chemins résolus par db-path.js — EXACTEMENT les mêmes que db.js. La copie est
// WAL-safe (checkpoint TRUNCATE via le handle partagé avant copie) et vérifiée
// (PRAGMA quick_check sur la copie, avec la clé de chiffrement si active).
// Les sauvegardes restent sur le même disque : la copie hors instance est un
// processus séparé — voir docs/operations/persistence.md.
// Aucun secret n'est journalisé.
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3-multiple-ciphers');
const { db } = require('./db');
const { resolveDbPath, resolveBackupDir } = require('./db-path');

const KEEP_BACKUPS = 7;

// Ouvre la copie et vérifie sa cohérence. Retourne true/false, ne jette jamais.
function verifyBackup(backupPath) {
  let check;
  try {
    check = new Database(backupPath, { readonly: true });
    const encKey = process.env.DB_ENCRYPTION_KEY;
    if (encKey && /^[0-9a-fA-F]{64}$/.test(encKey)) {
      check.pragma(`key = "x'${encKey}'"`);
    }
    const result = check.pragma('quick_check');
    const ok = Array.isArray(result) && result.length === 1 &&
      String(result[0].quick_check || result[0].integrity_check || '').toLowerCase() === 'ok';
    return ok;
  } catch (e) {
    console.error(`❌ Backup: vérification impossible (${e.code || e.message})`);
    return false;
  } finally {
    try { if (check) check.close(); } catch {}
  }
}

function backupDatabase() {
  const dbPath = resolveDbPath();
  const backupDir = resolveBackupDir();

  if (dbPath === ':memory:' || !backupDir) return; // tests / DB mémoire : rien à copier
  if (!fs.existsSync(dbPath)) {
    // Ancien comportement : return silencieux — un chemin mal configuré passait
    // inaperçu pendant des mois. On log désormais (sans révéler de secret).
    console.error(`❌ Backup: fichier de base introuvable (${dbPath}) — AUCUNE sauvegarde effectuée.`);
    return;
  }
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // WAL-safe: flush the write-ahead log into the main .db file so the byte-for-byte
  // copy below is a consistent snapshot. Without this, transactions still sitting in
  // the -wal sidecar would be silently missing from the backup. Best-effort.
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* :memory: or no WAL — ignore */ }

  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `restosuite-${date}.db`);

  try {
    fs.copyFileSync(dbPath, backupPath);
  } catch (e) {
    console.error(`❌ Backup: copie échouée — ${e.message}`);
    return;
  }

  // Vérification d'intégrité de la copie (quick_check). Une copie corrompue est
  // supprimée immédiatement : mieux vaut une sauvegarde manquante ET signalée
  // qu'une fausse assurance.
  if (!verifyBackup(backupPath)) {
    console.error(`❌ Backup: quick_check en échec sur ${path.basename(backupPath)} — copie supprimée.`);
    try { fs.unlinkSync(backupPath); } catch {}
    return;
  }

  // Rétention : garder les KEEP_BACKUPS plus récentes
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('restosuite-') && f.endsWith('.db'))
    .sort()
    .reverse();
  backups.slice(KEEP_BACKUPS).forEach(old => {
    try { fs.unlinkSync(path.join(backupDir, old)); } catch {}
  });

  const sizeMB = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(1);
  console.log(`✅ Backup: ${path.basename(backupPath)} (${sizeMB} Mo, quick_check ok, ${Math.min(backups.length, KEEP_BACKUPS)}/${KEEP_BACKUPS} conservées)`);
}

module.exports = { backupDatabase, verifyBackup };
