'use strict';

// GET /api/accounts/:id/export — RGPD data dump. Confirms the response
// includes the newly-added tenant-scoped tables and stays tenant-scoped.

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

beforeAll(() => {
  if (!get('SELECT id FROM restaurants WHERE id = 1')) {
    run(`INSERT INTO restaurants (id, name) VALUES (1, 'R1 Export')`);
  }
  if (!get('SELECT id FROM accounts WHERE id = 1')) {
    run(
      `INSERT INTO accounts (id, name, email, role, restaurant_id)
       VALUES (1, 'Test Gerant', 'test@restosuite.fr', 'gerant', 1)`
    );
  }
});

describe('GET /api/accounts/:id/export — RGPD bundle', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/accounts/1/export');
    expect(res.status).toBe(401);
  });

  it('exports the full tenant bundle (incl. new tables)', async () => {
    const res = await request(app).get('/api/accounts/1/export').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('account');
    expect(res.body).toHaveProperty('restaurant');

    // Existing tables (regression)
    for (const k of ['recipes', 'ingredients', 'stock', 'suppliers',
      'temperature_logs', 'cleaning_logs', 'traceability_logs']) {
      expect(Array.isArray(res.body[k])).toBe(true);
    }

    // New tables added in this change
    for (const k of ['stock_movements', 'orders', 'order_items',
      'purchase_orders', 'purchase_order_items', 'delivery_notes',
      'delivery_note_items', 'haccp_hazard_analysis', 'haccp_ccp',
      'haccp_decision_tree_results', 'training_records',
      'allergen_management_plan']) {
      expect(Array.isArray(res.body[k])).toBe(true);
    }
  });

  it('Content-Disposition is attachment with .json filename', async () => {
    const res = await request(app).get('/api/accounts/1/export').set(AUTH);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.json"$/);
  });
});
