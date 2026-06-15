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

const dataDir = process.env.NODE_ENV === 'production' && fs.existsSync('/data')
  ? '/data'
  : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'restosuite.db');
const db = new Database(dbPath);

// ─── Encryption at rest (RGPD Art. 32) ───
// Opt-in via DB_ENCRYPTION_KEY = 64 hex chars (32-byte raw key). The key pragma
// MUST run before any other statement. Absent → plain SQLite (unchanged).
// To migrate an existing UNENCRYPTED database, run scripts/encrypt-db.js first
// (see DEPLOY_NOTES.md for the Render rollout sequence).
const encKey = process.env.DB_ENCRYPTION_KEY;
if (encKey) {
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    console.error('❌ FATAL: DB_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32');
    process.exit(1);
  }
  db.pragma(`key = "x'${encKey}'"`);
  // Fail fast & loud if the key doesn't match the file (or the file is still
  // plaintext) — better than booting and corrupting/locking out the data.
  try {
    db.prepare('SELECT count(*) FROM sqlite_master').get();
  } catch (e) {
    console.error('❌ FATAL: DB_ENCRYPTION_KEY does not match the database, or the database is not encrypted yet.');
    console.error('   Migrate an existing plaintext DB with: DB_ENCRYPTION_KEY=… node scripts/encrypt-db.js');
    process.exit(1);
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
