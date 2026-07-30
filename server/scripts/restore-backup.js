#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════
// Restauration d'une sauvegarde — À EXÉCUTER SERVEUR ARRÊTÉ.
//
//   node server/scripts/restore-backup.js                # liste les sauvegardes
//   node server/scripts/restore-backup.js <fichier.db>   # restaure ce fichier
//
// Procédure (voir docs/operations/persistence.md) :
//   1. La base courante est d'abord mise de côté (suffixe .pre-restore-<date>),
//      jamais écrasée directement — rollback possible à tout moment.
//   2. La sauvegarde est vérifiée (PRAGMA integrity_check, avec la clé de
//      chiffrement si DB_ENCRYPTION_KEY est définie) AVANT d'être mise en place.
//   3. Les sidecars -wal/-shm périmés sont supprimés (ils appartiennent à
//      l'ancienne base et corrompraient la restauration).
// Aucun secret n'est journalisé.
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3-multiple-ciphers');
const { resolveDbPath, resolveBackupDir } = require('../db-path');

const dbPath = resolveDbPath();
const backupDir = resolveBackupDir();
const arg = process.argv[2];

if (dbPath === ':memory:') {
  console.error('❌ DB_PATH=:memory: — rien à restaurer.');
  process.exit(1);
}

function listBackups() {
  if (!backupDir || !fs.existsSync(backupDir)) {
    console.log('Aucun répertoire de sauvegardes trouvé.');
    return [];
  }
  return fs.readdirSync(backupDir)
    .filter(f => f.startsWith('restosuite-') && f.endsWith('.db'))
    .sort()
    .reverse();
}

if (!arg) {
  console.log('Sauvegardes disponibles (plus récente en premier) :');
  for (const f of listBackups()) {
    const size = (fs.statSync(path.join(backupDir, f)).size / (1024 * 1024)).toFixed(1);
    console.log(`  ${f}  (${size} Mo)`);
  }
  console.log('\nUsage: node server/scripts/restore-backup.js <fichier.db>');
  console.log('⚠️  Arrêter le serveur avant toute restauration.');
  process.exit(0);
}

const sourcePath = fs.existsSync(arg) ? arg : path.join(backupDir || '', arg);
if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Sauvegarde introuvable: ${sourcePath}`);
  process.exit(1);
}

// 1. Vérifier l'intégrité de la sauvegarde AVANT de toucher à la base courante.
{
  let check;
  try {
    check = new Database(sourcePath, { readonly: true });
    const encKey = process.env.DB_ENCRYPTION_KEY;
    if (encKey && /^[0-9a-fA-F]{64}$/.test(encKey)) {
      check.pragma(`key = "x'${encKey}'"`);
    }
    const result = check.pragma('integrity_check');
    const ok = Array.isArray(result) && result.length === 1 &&
      String(result[0].integrity_check).toLowerCase() === 'ok';
    if (!ok) {
      console.error('❌ integrity_check en échec sur la sauvegarde — restauration ANNULÉE.');
      console.error(JSON.stringify(result).slice(0, 500));
      process.exit(1);
    }
    console.log('✅ integrity_check ok sur la sauvegarde.');
  } catch (e) {
    console.error(`❌ Impossible d'ouvrir la sauvegarde (${e.code || e.message}).`);
    console.error('   Si la base est chiffrée, exporter DB_ENCRYPTION_KEY avant de relancer.');
    process.exit(1);
  } finally {
    try { if (check) check.close(); } catch {}
  }
}

// 2. Mettre la base courante de côté (jamais d'écrasement direct).
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
if (fs.existsSync(dbPath)) {
  const aside = `${dbPath}.pre-restore-${stamp}`;
  fs.renameSync(dbPath, aside);
  console.log(`✅ Base courante mise de côté: ${path.basename(aside)}`);
}

// 3. Supprimer les sidecars WAL/SHM périmés de l'ancienne base.
for (const suffix of ['-wal', '-shm']) {
  const sidecar = dbPath + suffix;
  if (fs.existsSync(sidecar)) {
    fs.unlinkSync(sidecar);
    console.log(`✅ Sidecar périmé supprimé: ${path.basename(sidecar)}`);
  }
}

// 4. Mettre la sauvegarde en place.
fs.copyFileSync(sourcePath, dbPath);
console.log(`✅ Restauré: ${path.basename(sourcePath)} → ${dbPath}`);
console.log('→ Redémarrer le serveur, puis vérifier /api/health et /api/health/persistence.');
console.log(`→ Rollback si besoin: remettre ${path.basename(dbPath)}.pre-restore-${stamp} à la place.`);
