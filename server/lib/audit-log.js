'use strict';

const { run, all } = require('../db');

const ALLOWED_ACTIONS = new Set(['create', 'update', 'delete']);

/**
 * Append a row to audit_log. Throws on invalid input.
 * Helper is intentionally write-only — there is no updateAudit/deleteAudit.
 * HACCP inspectors require the log to be immutable by design.
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

  run(
    `INSERT INTO audit_log
       (restaurant_id, account_id, table_name, record_id, action, old_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      restaurant_id,
      account_id,
      table_name,
      record_id,
      action,
      serialize(old_values),
      serialize(new_values),
    ]
  );
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

module.exports = { writeAudit, readAudit, ALLOWED_ACTIONS };
