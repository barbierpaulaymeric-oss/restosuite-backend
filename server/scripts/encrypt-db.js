'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// One-time migration: convert an existing UNENCRYPTED restosuite.db into a
// SQLCipher-encrypted database, in place (with a timestamped plaintext backup).
//
// Usage (on the Render shell, or locally):
//   DB_ENCRYPTION_KEY=<64 hex chars> node scripts/encrypt-db.js [path/to/restosuite.db]
//
// Generate a key with:  openssl rand -hex 32
//
// Rollout sequence (see DEPLOY_NOTES.md):
//   1. Deploy this code (db.js stays plaintext while DB_ENCRYPTION_KEY is unset).
//   2. Run this script once on Render with DB_ENCRYPTION_KEY set → encrypts /data/restosuite.db.
//   3. Set DB_ENCRYPTION_KEY in the Render env and redeploy/restart → app opens the encrypted DB.
//   4. Keep the printed plaintext backup somewhere safe, then delete it once verified.
//
// IMPORTANT: if you lose DB_ENCRYPTION_KEY, the data is unrecoverable. Store it
// in a password manager, NOT in the repo.
// ═══════════════════════════════════════════════════════════════════════════
const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');

const key = process.env.DB_ENCRYPTION_KEY || '';
if (!/^[0-9a-fA-F]{64}$/.test(key)) {
  console.error('❌ DB_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate: openssl rand -hex 32');
  process.exit(1);
}

const dataDir = process.env.NODE_ENV === 'production' && fs.existsSync('/data')
  ? '/data'
  : path.join(__dirname, '..', 'data');
const dbPath = process.argv[2] || process.env.DB_PATH || path.join(dataDir, 'restosuite.db');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

// 1. Detect whether the file is already encrypted (encrypted files have no
//    "SQLite format 3" magic header).
const header = fs.readFileSync(dbPath).slice(0, 16).toString('latin1');
if (!header.startsWith('SQLite format 3')) {
  console.log('ℹ️  This file does not look like a plaintext SQLite DB (already encrypted?). Nothing to do.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = `${dbPath}.plaintext-backup-${stamp}`;

console.log(`🔐 Encrypting ${dbPath}`);
console.log(`   plaintext backup → ${backupPath}`);

// 2. Keep a plaintext backup BEFORE touching the original (rekey is in place).
fs.copyFileSync(dbPath, backupPath);

// 3. Encrypt in place with PRAGMA rekey (sqlite3mc native — applies the default
//    cipher, exactly what db.js opens with via `PRAGMA key`). Flush + drop WAL
//    first so nothing is left unencrypted in the sidecar.
const db = new Database(dbPath);
try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
db.pragma('journal_mode = DELETE');
db.pragma(`rekey = "x'${key}'"`);
const tables = db.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='table'").get().c;
db.close();

// 4. Verify: a fresh handle must need the key to read the now-encrypted file.
for (const sidecar of ['-wal', '-shm']) { try { fs.rmSync(dbPath + sidecar, { force: true }); } catch {} }
const check = new Database(dbPath);
check.pragma(`key = "x'${key}'"`);
const verified = check.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='table'").get().c;
check.close();
const headerAfter = fs.readFileSync(dbPath).slice(0, 16).toString('latin1');
if (verified !== tables || headerAfter.startsWith('SQLite format 3')) {
  console.error('❌ Verification failed — restoring the plaintext backup.');
  fs.copyFileSync(backupPath, dbPath);
  process.exit(1);
}

console.log(`✅ Done. ${tables} tables encrypted (verified).`);
console.log('   Next: set DB_ENCRYPTION_KEY in the Render env and restart the service.');
console.log(`   Once verified in production, delete the plaintext backup: ${backupPath}`);
