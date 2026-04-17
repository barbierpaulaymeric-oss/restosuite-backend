'use strict';

const request = require('supertest');
const app = require('../app'); // also triggers migrations
const { writeAudit, readAudit, verifyAuditChain } = require('../lib/audit-log');
const { run } = require('../db');
const { authHeader } = require('./helpers/auth');

describe('audit_log helper', () => {
  it('writeAudit inserts and readAudit reads back', () => {
    writeAudit({
      restaurant_id: 1, account_id: 1,
      table_name: 'recipes', record_id: 42,
      action: 'create', new_values: { name: 'Soufflé' }
    });
    const rows = readAudit({ restaurant_id: 1, table_name: 'recipes', record_id: 42 });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].action).toBe('create');
    const parsed = JSON.parse(rows[0].new_values);
    expect(parsed.name).toBe('Soufflé');
  });

  it('rejects unknown action values', () => {
    expect(() => writeAudit({
      restaurant_id: 1, table_name: 'recipes', record_id: 1,
      action: 'purge', new_values: {}
    })).toThrow();
  });

  it('rejects missing restaurant_id', () => {
    expect(() => writeAudit({
      table_name: 'recipes', record_id: 1, action: 'create'
    })).toThrow();
  });

  it('scopes reads by restaurant_id', () => {
    writeAudit({ restaurant_id: 100, table_name: 'recipes', record_id: 9100, action: 'create' });
    writeAudit({ restaurant_id: 200, table_name: 'recipes', record_id: 9200, action: 'create' });
    const r100 = readAudit({ restaurant_id: 100, table_name: 'recipes' });
    const ids = r100.map(r => r.record_id);
    expect(ids).toContain(9100);
    expect(ids).not.toContain(9200);
  });
});

describe('audit_log hash chain (tamper evidence)', () => {
  it('writes populate previous_hash and row_hash', () => {
    writeAudit({ restaurant_id: 1, table_name: 'recipes', record_id: 55001, action: 'create', new_values: { v: 1 } });
    const row = readAudit({ restaurant_id: 1, table_name: 'recipes', record_id: 55001 })[0];
    expect(row.row_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.previous_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyAuditChain returns ok on untouched log', () => {
    writeAudit({ restaurant_id: 1, table_name: 'recipes', record_id: 55002, action: 'create', new_values: { v: 1 } });
    writeAudit({ restaurant_id: 1, table_name: 'recipes', record_id: 55003, action: 'update', new_values: { v: 2 } });
    const r = verifyAuditChain();
    expect(r.ok).toBe(true);
    expect(r.verified).toBeGreaterThan(0);
  });

  it('verifyAuditChain detects a silent UPDATE', () => {
    writeAudit({ restaurant_id: 1, table_name: 'recipes', record_id: 55010, action: 'create', new_values: { v: 'before' } });
    // Simulate a DBA tampering with the row body without updating row_hash.
    run("UPDATE audit_log SET new_values = ? WHERE record_id = ? AND table_name = 'recipes'",
      [JSON.stringify({ v: 'tampered' }), 55010]);
    const r = verifyAuditChain();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/row_hash mismatch|previous_hash mismatch/);
  });
});

describe('GET /api/audit-log', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/audit-log');
    expect(res.status).toBe(401);
  });
  it('returns 403 for non-gerant', async () => {
    const res = await request(app).get('/api/audit-log')
      .set(authHeader({ id: 1, role: 'equipier', restaurant_id: 1 }));
    expect(res.status).toBe(403);
  });
  it('returns tenant-scoped entries for gerant', async () => {
    writeAudit({ restaurant_id: 100, table_name: 'recipes', record_id: 9101, action: 'update', new_values: { name: 'x' } });
    writeAudit({ restaurant_id: 200, table_name: 'recipes', record_id: 9201, action: 'update', new_values: { name: 'x' } });
    const res = await request(app).get('/api/audit-log')
      .set(authHeader({ id: 1, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    const recordIds = res.body.entries.map(e => e.record_id);
    expect(recordIds).toContain(9101);
    expect(recordIds).not.toContain(9201);
  });
});
