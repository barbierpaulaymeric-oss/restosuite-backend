'use strict';

const crypto = require('crypto');
const { run, get, all, db } = require('../db');

const ALLOWED_ACTIONS = new Set(['create', 'update', 'delete']);

// ─── Hash chain ─────────────────────────────────────────────────────────────
// Each row carries SHA-256 over a canonical serialization of its content
// plus the previous row's row_hash. Verifying the chain detects any later
// UPDATE/DELETE on audit_log without needing an external HMAC secret — the
// append-only invariant is enforced by the helper being write-only and the
// chain gives tamper-evidence at read time.
//
// We keep the canonical representation stable: JSON with sorted keys over a
// fixed field list. If we ever add a new field, bump this to a versioned
// canonical form and keep the old formula for historical rows.

const GENESIS_HASH = '0'.repeat(64);

function canonicalRow({ restaurant_id, account_id, table_name, record_id, action, old_values, new_values, created_at, previous_hash }) {
  // Stringify with explicit key order so the hash is deterministic.
  const canonical = JSON.stringify({
    restaurant_id: restaurant_id == null ? null : Number(restaurant_id),
    account_id: account_id == null ? null : Number(account_id),
    table_name: String(table_name),
    record_id: record_id == null ? null : Number(record_id),
    action: String(action),
    old_values: old_values == null ? null : String(old_values),
    new_values: new_values == null ? null : String(new_values),
    created_at: String(created_at),
    previous_hash: String(previous_hash),
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Append a row to audit_log. Throws on invalid input.
 * Helper is intentionally write-only — there is no updateAudit/deleteAudit.
 * HACCP inspectors require the log to be immutable by design; the hash chain
 * makes after-the-fact tampering detectable.
 */
function writeAudit({
  restaurant_id,
  account_id = null,
  table_name,
  record_id = null,
  action,
  old_values = null,
  new_values = null,
}) {
  if (!restaurant_id) throw new Error('audit_log: restaurant_id required');
  if (!table_name) throw new Error('audit_log: table_name required');
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`audit_log: invalid action '${action}' (allowed: create|update|delete)`);
  }

  const serialize = (v) => {
    if (v == null) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  };

  const oldSer = serialize(old_values);
  const newSer = serialize(new_values);

  // Wrap in a transaction so the hash chain stays consistent under concurrent
  // writers — better-sqlite3 transactions are synchronous and serializable.
  const tx = db.transaction(() => {
    const prev = get('SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1');
    const previous_hash = (prev && prev.row_hash) ? prev.row_hash : GENESIS_HASH;
    const created_at = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

    const row_hash = canonicalRow({
      restaurant_id, account_id, table_name, record_id, action,
      old_values: oldSer, new_values: newSer, created_at, previous_hash,
    });

    run(
      `INSERT INTO audit_log
         (restaurant_id, account_id, table_name, record_id, action, old_values, new_values, created_at, previous_hash, row_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        restaurant_id,
        account_id,
        table_name,
        record_id,
        action,
        oldSer,
        newSer,
        created_at,
        previous_hash,
        row_hash,
      ]
    );
  });
  tx();
}

/**
 * Read audit rows scoped to a restaurant (and optionally a table or record).
 * Always filters by restaurant_id — never read cross-tenant.
 */
function readAudit({ restaurant_id, table_name, record_id, limit = 100 }) {
  if (!restaurant_id) throw new Error('audit_log: restaurant_id required for reads');
  const clauses = ['restaurant_id = ?'];
  const params = [restaurant_id];
  if (table_name) { clauses.push('table_name = ?'); params.push(table_name); }
  if (record_id != null) { clauses.push('record_id = ?'); params.push(record_id); }
  return all(
    `SELECT * FROM audit_log
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [...params, Math.min(Number(limit) || 100, 1000)]
  );
}

/**
 * Walk the full audit_log chain (across tenants) and return the first row
 * whose recomputed hash does not match the stored value, or whose previous_hash
 * does not match the prior row's row_hash. Returns null when the chain is
 * intact. Rows written before hash-chaining was introduced (previous_hash IS
 * NULL) are treated as the genesis of the chain from the first hashed row on.
 */
function verifyAuditChain() {
  const rows = all('SELECT * FROM audit_log ORDER BY id ASC');
  let expectedPrev = GENESIS_HASH;
  let verifiedCount = 0;
  let chainStarted = false;
  for (const r of rows) {
    // Legacy rows without a row_hash: skip until we reach the first hashed row.
    if (r.row_hash == null) {
      if (chainStarted) {
        return { ok: false, failed_id: r.id, reason: 'row_hash missing after chain started' };
      }
      continue;
    }
    if (!chainStarted) {
      // Anchor expectedPrev at the first hashed row's previous_hash (or genesis).
      expectedPrev = r.previous_hash || GENESIS_HASH;
      chainStarted = true;
    }
    if (r.previous_hash !== expectedPrev) {
      return { ok: false, failed_id: r.id, reason: 'previous_hash mismatch' };
    }
    const recomputed = canonicalRow({
      restaurant_id: r.restaurant_id,
      account_id: r.account_id,
      table_name: r.table_name,
      record_id: r.record_id,
      action: r.action,
      old_values: r.old_values,
      new_values: r.new_values,
      created_at: r.created_at,
      previous_hash: r.previous_hash,
    });
    if (recomputed !== r.row_hash) {
      return { ok: false, failed_id: r.id, reason: 'row_hash mismatch' };
    }
    expectedPrev = r.row_hash;
    verifiedCount++;
  }
  return { ok: true, verified: verifiedCount };
}

module.exports = { writeAudit, readAudit, verifyAuditChain, ALLOWED_ACTIONS };
