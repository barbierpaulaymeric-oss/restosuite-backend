'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');
const { run, get } = require('../db');

describe('Tenancy isolation — Phase 1', () => {
  it('pre-flight: app boots and rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/crm/customers');
    expect(res.status).toBe(401);
  });
});

describe('C-3: POST /api/ai/execute-action must enforce role gate', () => {
  it('rejects create_recipe from a non-gérant role (equipier)', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 99, role: 'equipier', restaurant_id: 1 }))
      .send({ type: 'create_recipe', params: { name: 'Hack dish' } });
    expect(res.status).toBe(403);
  });

  it('rejects delete_recipe from cuisinier', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 99, role: 'cuisinier', restaurant_id: 1 }))
      .send({ type: 'delete_recipe', params: { recipe_id: 1 } });
    expect(res.status).toBe(403);
  });

  it('allows create_recipe from gérant', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 1, role: 'gerant', restaurant_id: 1 }))
      .send({ type: 'create_recipe', params: { name: 'Legit dish Phase1' } });
    expect([200, 201]).toContain(res.status);
  });
});

describe('C-2: GET /api/accounts/:id/export access control', () => {
  beforeAll(() => {
    const bcrypt = require('bcryptjs');
    const pw = bcrypt.hashSync('Secure1pass', 10);
    run("INSERT OR IGNORE INTO restaurants (id, name) VALUES (100, 'R100')");
    run("INSERT OR IGNORE INTO restaurants (id, name) VALUES (200, 'R200')");
    run(
      "INSERT OR IGNORE INTO accounts (id, name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)",
      [1001, 'Owner R100', 'owner-r100@test.fr', pw, 'gerant', 100]
    );
    run(
      "INSERT OR IGNORE INTO accounts (id, name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)",
      [1002, 'Owner R200', 'owner-r200@test.fr', pw, 'gerant', 200]
    );
    run(
      "INSERT OR IGNORE INTO accounts (id, name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)",
      [1003, 'Staff R100', 'staff-r100@test.fr', pw, 'equipier', 100]
    );
  });

  it('blocks gérant of restaurant A exporting an account in restaurant B', async () => {
    const res = await request(app)
      .get('/api/accounts/1002/export')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(403);
  });

  it('blocks a non-gérant from exporting another account in their own restaurant', async () => {
    const res = await request(app)
      .get('/api/accounts/1001/export')
      .set(authHeader({ id: 1003, role: 'equipier', restaurant_id: 100 }));
    expect(res.status).toBe(403);
  });

  it('allows an account to export itself', async () => {
    const res = await request(app)
      .get('/api/accounts/1003/export')
      .set(authHeader({ id: 1003, role: 'equipier', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('account');
    expect(res.body.account.id).toBe(1003);
  });

  it('allows a same-tenant gérant to export a staff account', async () => {
    const res = await request(app)
      .get('/api/accounts/1003/export')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    expect(res.body.account.id).toBe(1003);
  });

  it('does not include cross-tenant bulk fields in the export (Phase 1 lockdown)', async () => {
    const res = await request(app)
      .get('/api/accounts/1003/export')
      .set(authHeader({ id: 1003, role: 'equipier', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('recipes');
    expect(res.body).not.toHaveProperty('ingredients');
    expect(res.body).not.toHaveProperty('stock');
    expect(res.body).not.toHaveProperty('temperature_logs');
    expect(res.body).not.toHaveProperty('cleaning_logs');
    expect(res.body).not.toHaveProperty('traceability_logs');
    expect(res.body).not.toHaveProperty('supplier_prices');
  });
});
