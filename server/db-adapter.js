'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ EXPÉRIMENTAL — NON UTILISÉ EN PRODUCTION (constat audit 2026-07-30).
//
// Aucun module ne require ce fichier : les ~100 modules serveur utilisent
// directement ./db.js (better-sqlite3), et c'est la décision d'architecture
// actuelle — SQLite chiffré sur disque persistant, PostgreSQL uniquement si le
// multi-site ou la montée en charge le justifie (voir RESTOSUITE.md
// « Persistance » et docs/POSTGRESQL_MIGRATION.md). PostgreSQL n'est PAS
// pris en charge aujourd'hui ; ce fichier est conservé comme esquisse
// d'interface pour une future migration, rien de plus.
//
// DB adapter — forward-compatible database interface.
//
// Thin wrapper around ./db.js (better-sqlite3). When we migrate to PostgreSQL,
// only this file needs to change: swap the sqlite handle for a `pg` Pool and
// rewrite the four helpers. Callers see the same API (query/get/run/all +
// transaction).
//
// Parameter style: `?` placeholders (sqlite-native). The adapter will
// translate `?` → `$1, $2, …` when the driver is switched to `pg`.
// ═══════════════════════════════════════════════════════════════════════════

const sqlite = require('./db');

/**
 * Driver identifier — helps callers branch on dialect-specific SQL
 * (e.g. `INSERT ... RETURNING` vs `INSERT ... ; last_insert_rowid()`).
 */
const driver = 'sqlite';

/**
 * Execute a statement that may return rows. Mirrors pg's Pool.query
 * shape so callers written against this adapter port cleanly to pg:
 *   const { rows } = await adapter.query(sql, params);
 * On sqlite today the call is synchronous under the hood but returns a
 * Promise so callers can adopt `await` ahead of the pg cutover.
 */
function query(sql, params = []) {
  const rows = sqlite.all(sql, params);
  return Promise.resolve({ rows, rowCount: rows.length });
}

/** Fetch a single row (first match) or `undefined`. */
function get(sql, params = []) {
  return sqlite.get(sql, params);
}

/**
 * Execute a write (INSERT/UPDATE/DELETE). Returns a normalized result:
 *   { changes: number, lastInsertRowid: number|bigint }
 * On pg we will fill `lastInsertRowid` from `RETURNING id` — callers
 * that need the inserted id should already use `RETURNING` when possible.
 */
function run(sql, params = []) {
  const info = sqlite.run(sql, params);
  return {
    changes: info.changes,
    lastInsertRowid: info.lastInsertRowid,
  };
}

/** Fetch every matching row. */
function all(sql, params = []) {
  return sqlite.all(sql, params);
}

/**
 * Run `fn` inside a transaction. better-sqlite3 exposes synchronous
 * transactions via db.transaction(); pg uses BEGIN/COMMIT/ROLLBACK on a
 * dedicated client. Callers pass a function that receives this adapter
 * (for now the synchronous sqlite one; later a pg client wrapper).
 */
function transaction(fn) {
  const tx = sqlite.db.transaction(() => fn({ query, get, run, all }));
  return tx();
}

module.exports = {
  driver,
  query,
  get,
  run,
  all,
  transaction,
  // Escape hatch — exposes the raw better-sqlite3 handle. Use sparingly;
  // anything that touches this will need to be rewritten for pg.
  _raw: sqlite.db,
};
