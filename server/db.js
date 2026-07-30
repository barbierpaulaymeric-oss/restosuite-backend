'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Thin DB entry point. Opens the better-sqlite3 handle, sets pragmas, exposes
// the three helpers (all/get/run), then delegates to two focused modules:
//   • db-schema.js     — initial CREATE TABLE / CREATE INDEX + HACCP seeds
//   • db-migrations.js — idempotent ALTER TABLE / new-table guards + backfills
// Previously this was one 2151-line file; splitting keeps each concern
// reviewable without changing runtime behavior.
// ═══════════════════════════════════════════════════════════════════════════
// SQLCipher-capable drop-in for better-sqlite3 (same API). Encryption stays OFF
// unless DB_ENCRYPTION_KEY is set, so dev/test/back-compat behave exactly as before.
const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');
const { resolveDbPath, assertProductionPersistence } = require('./db-path');

// En production : exiger un stockage persistant (DB_PATH ou /data), sinon
// arrêt immédiat avec un message actionnable — plutôt qu'une base silencieuse
// sur disque éphémère effacée au déploiement suivant.
assertProductionPersistence();

const dbPath = resolveDbPath();
// Créer le répertoire parent quel que soit le chemin (y compris DB_PATH custom
// — auparavant seul le dataDir par défaut était créé et un DB_PATH vers un
// dossier absent levait SQLITE_CANTOPEN).
if (dbPath !== ':memory:') {
  const parent = path.dirname(dbPath);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
}
const db = new Database(dbPath);

// ─── Encryption at rest (RGPD Art. 32) ───
// Opt-in via DB_ENCRYPTION_KEY = 64 hex chars (32-byte raw key). Absent → plain
// SQLite (unchanged, dev/tests). The encryption is applied HERE at boot, while
// this is the only open connection — so a still-plaintext database is migrated
// in place (PRAGMA rekey) with the exclusive lock available. Running a separate
// script alongside the live server instead fails with SQLITE_BUSY ("database is
// locked"), which is why activation is just: set the env var, then restart.
const encKey = process.env.DB_ENCRYPTION_KEY;
if (encKey) {
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    console.error('❌ FATAL: DB_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32');
    process.exit(1);
  }

  // Is the file on disk still plaintext (has the "SQLite format 3" magic header)?
  // Cheap 16-byte read — avoids loading the whole DB just to detect its state.
  let plaintextWithData = false;
  try {
    const fd = fs.openSync(dbPath, 'r');
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    plaintextWithData = n >= 16 && buf.toString('latin1').startsWith('SQLite format 3');
  } catch { /* missing/empty file → fresh DB, encrypted on first write below */ }

  if (plaintextWithData) {
    // One-time in-place encryption on the first boot after the key is set.
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const bkp = `${dbPath}.plaintext-backup-${stamp}`;
      fs.copyFileSync(dbPath, bkp);
      console.log(`🔐 Plaintext backup before encryption: ${bkp} (delete it once verified)`);
    } catch (e) {
      console.warn('🔐 pre-encryption backup failed:', e.message);
    }
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
    db.pragma('journal_mode = DELETE'); // rekey is rejected in WAL mode; WAL is re-enabled just below
    db.pragma(`rekey = "x'${encKey}'"`);
    console.log('🔐 Database encrypted at rest (one-time rekey on first boot with DB_ENCRYPTION_KEY).');
  } else {
    // Already-encrypted DB (or brand-new empty file) → just supply the key.
    db.pragma(`key = "x'${encKey}'"`);
    try {
      db.prepare('SELECT count(*) FROM sqlite_master').get();
    } catch (e) {
      console.error('❌ FATAL: DB_ENCRYPTION_KEY does not match the database.');
      process.exit(1);
    }
  }
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

const helpers = { all, get, run };

require('./db-schema').initSchema(db, helpers);
require('./db-migrations').runMigrations(db, helpers);

module.exports = { db, all, get, run };
