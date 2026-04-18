'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Thin DB entry point. Opens the better-sqlite3 handle, sets pragmas, exposes
// the three helpers (all/get/run), then delegates to two focused modules:
//   • db-schema.js     — initial CREATE TABLE / CREATE INDEX + HACCP seeds
//   • db-migrations.js — idempotent ALTER TABLE / new-table guards + backfills
// Previously this was one 2151-line file; splitting keeps each concern
// reviewable without changing runtime behavior.
// ═══════════════════════════════════════════════════════════════════════════
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.NODE_ENV === 'production' && fs.existsSync('/data')
  ? '/data'
  : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'restosuite.db');
const db = new Database(dbPath);

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
