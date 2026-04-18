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

  it('includes only same-tenant bulk data in the export (Phase 2 restored)', async () => {
    // Seed tenant-tagged recipes in two restaurants
    run("INSERT OR IGNORE INTO recipes (id, name, restaurant_id) VALUES (9100, 'recipeR100', 100)");
    run("INSERT OR IGNORE INTO recipes (id, name, restaurant_id) VALUES (9200, 'recipeR200', 200)");

    const res = await request(app)
      .get('/api/accounts/1003/export')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recipes)).toBe(true);
    const recipeIds = res.body.recipes.map(r => r.id);
    expect(recipeIds).toContain(9100);
    expect(recipeIds).not.toContain(9200);
    // Other bulk fields should be arrays (possibly empty) but never contain cross-tenant rows
    expect(Array.isArray(res.body.ingredients)).toBe(true);
    expect(Array.isArray(res.body.stock)).toBe(true);
    expect(Array.isArray(res.body.temperature_logs)).toBe(true);
    expect(Array.isArray(res.body.cleaning_logs)).toBe(true);
    expect(Array.isArray(res.body.traceability_logs)).toBe(true);
    expect(Array.isArray(res.body.supplier_prices)).toBe(true);
  });
});

describe('C-1: routes must filter by caller restaurant_id, not hardcoded 1', () => {
  beforeAll(() => {
    // Seed one customer per restaurant (R100 and R200 seeded in C-2 beforeAll)
    run("INSERT OR IGNORE INTO customers (id, restaurant_id, name) VALUES (5001, 100, 'CustR100')");
    run("INSERT OR IGNORE INTO customers (id, restaurant_id, name) VALUES (5002, 200, 'CustR200')");
    // Seed one carbon target per restaurant
    run("INSERT OR IGNORE INTO carbon_targets (id, restaurant_id, period, target_co2_kg, label) VALUES (6001, 100, 'monthly', 100, 'R100')");
    run("INSERT OR IGNORE INTO carbon_targets (id, restaurant_id, period, target_co2_kg, label) VALUES (6002, 200, 'monthly', 200, 'R200')");
    // Seed loyalty rewards
    run("INSERT OR IGNORE INTO loyalty_rewards (id, restaurant_id, name, points_required) VALUES (7001, 100, 'RewardR100', 50)");
    run("INSERT OR IGNORE INTO loyalty_rewards (id, restaurant_id, name, points_required) VALUES (7002, 200, 'RewardR200', 50)");
    // Seed integrations (table created at import time by integrations.js)
    run("INSERT OR IGNORE INTO integrations (id, restaurant_id, provider, enabled) VALUES (8001, 100, 'thefork', 1)");
    run("INSERT OR IGNORE INTO integrations (id, restaurant_id, provider, enabled) VALUES (8002, 200, 'thefork', 1)");
    // Seed api_keys (table created at import time by public-api.js)
    run("INSERT OR IGNORE INTO api_keys (id, restaurant_id, key_name, api_key) VALUES (9001, 100, 'keyR100', 'rk_100_xxx')");
    run("INSERT OR IGNORE INTO api_keys (id, restaurant_id, key_name, api_key) VALUES (9002, 200, 'keyR200', 'rk_200_xxx')");
    // Seed health_score_history (table created in db.js migrations)
    try {
      run("INSERT OR IGNORE INTO health_score_history (restaurant_id, score, date) VALUES (100, 80, date('now','-1 day'))");
      run("INSERT OR IGNORE INTO health_score_history (restaurant_id, score, date) VALUES (200, 20, date('now','-1 day'))");
    } catch {}
  });

  it('GET /api/crm/customers returns only caller-restaurant rows', async () => {
    const resR100 = await request(app)
      .get('/api/crm/customers')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(resR100.status).toBe(200);
    const names100 = resR100.body.map(c => c.name);
    expect(names100).toContain('CustR100');
    expect(names100).not.toContain('CustR200');

    const resR200 = await request(app)
      .get('/api/crm/customers')
      .set(authHeader({ id: 1002, role: 'gerant', restaurant_id: 200 }));
    expect(resR200.status).toBe(200);
    const names200 = resR200.body.map(c => c.name);
    expect(names200).toContain('CustR200');
    expect(names200).not.toContain('CustR100');
  });

  it('GET /api/crm/rewards returns only caller-restaurant rewards', async () => {
    const res = await request(app)
      .get('/api/crm/rewards')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    const names = res.body.map(r => r.name);
    expect(names).toContain('RewardR100');
    expect(names).not.toContain('RewardR200');
  });

  it('POST /api/carbon/targets upsert scoped to caller restaurant only', async () => {
    const patch = await request(app)
      .post('/api/carbon/targets')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }))
      .send({ period: 'monthly', target_co2_kg: 999 });
    expect([200, 201]).toContain(patch.status);

    const r100 = get('SELECT target_co2_kg FROM carbon_targets WHERE restaurant_id = 100 AND period = ?', ['monthly']);
    const r200 = get('SELECT target_co2_kg FROM carbon_targets WHERE restaurant_id = 200 AND period = ?', ['monthly']);
    expect(r100.target_co2_kg).toBe(999);
    expect(r200.target_co2_kg).toBe(200); // unchanged
  });

  it('GET /api/integrations returns only caller-restaurant rows', async () => {
    const res = await request(app)
      .get('/api/integrations')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    const body = res.body.integrations || res.body;
    // Each row must belong to tenant 100
    const ids = body.map(i => i.id);
    expect(ids).toContain(8001);
    expect(ids).not.toContain(8002);
  });

  it('GET /api/public/keys returns only caller-restaurant api keys', async () => {
    const res = await request(app)
      .get('/api/public/keys')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    // Endpoint may be 200 array or 200 object; just assert no cross-tenant leak
    expect(res.status).toBe(200);
    const body = Array.isArray(res.body) ? res.body : (res.body.keys || []);
    const ids = body.map(k => k.id);
    expect(ids).toContain(9001);
    expect(ids).not.toContain(9002);
  });

  it('GET /api/health/history returns only caller-restaurant scores', async () => {
    const res = await request(app)
      .get('/api/health/history')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    const hist = res.body.history || [];
    // R100's score is 80, R200's is 20 — must never see 20
    const scores = hist.map(h => h.score);
    expect(scores).not.toContain(20);
  });
});

describe('P0: PUT/DELETE /api/accounts/:id must be tenant-scoped (IDOR)', () => {
  const bcrypt = require('bcryptjs');

  beforeAll(() => {
    const pw = bcrypt.hashSync('Secure1pass', 10);
    // R100 and R200 seeded by the C-2 beforeAll above. Add two equipier targets.
    run(
      "INSERT OR IGNORE INTO accounts (id, name, email, password_hash, role, restaurant_id, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [2001, 'StaffR100', 'staff-idor-r100@test.fr', pw, 'equipier', 100, JSON.stringify({ view_recipes: true })]
    );
    run(
      "INSERT OR IGNORE INTO accounts (id, name, email, password_hash, role, restaurant_id, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [2002, 'StaffR200', 'staff-idor-r200@test.fr', pw, 'equipier', 200, JSON.stringify({ view_recipes: true })]
    );
  });

  it('PUT /:id blocks gérant of R100 from renaming an account in R200', async () => {
    const res = await request(app)
      .put('/api/accounts/2002')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }))
      .send({ name: 'PWNED' });
    expect(res.status).toBe(404);
    const after = get('SELECT name FROM accounts WHERE id = ?', [2002]);
    expect(after.name).toBe('StaffR200');
  });

  it('PUT /:id/reset-pin blocks cross-tenant PIN reset', async () => {
    run('UPDATE accounts SET pin = ? WHERE id = ?', [bcrypt.hashSync('1234', 10), 2002]);
    const res = await request(app)
      .put('/api/accounts/2002/reset-pin')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(404);
    const after = get('SELECT pin FROM accounts WHERE id = ?', [2002]);
    expect(after.pin).not.toBeNull();
  });

  it('DELETE /:id blocks cross-tenant account deletion', async () => {
    const res = await request(app)
      .delete('/api/accounts/2002')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(404);
    const after = get('SELECT id FROM accounts WHERE id = ?', [2002]);
    expect(after).toBeTruthy();
  });

  it('PUT /:id allows non-gérant to update their own name but not role/permissions', async () => {
    const resName = await request(app)
      .put('/api/accounts/2001')
      .set(authHeader({ id: 2001, role: 'equipier', restaurant_id: 100 }))
      .send({ name: 'StaffR100-self' });
    expect(resName.status).toBe(200);
    const after = get('SELECT name, role FROM accounts WHERE id = ?', [2001]);
    expect(after.name).toBe('StaffR100-self');
    expect(after.role).toBe('equipier');

    // Role escalation attempt must be refused
    const resRole = await request(app)
      .put('/api/accounts/2001')
      .set(authHeader({ id: 2001, role: 'equipier', restaurant_id: 100 }))
      .send({ role: 'gerant' });
    expect(resRole.status).toBe(403);
    const after2 = get('SELECT role FROM accounts WHERE id = ?', [2001]);
    expect(after2.role).toBe('equipier');
  });

  it('PUT /:id allows same-tenant gérant to rename a staff account', async () => {
    const res = await request(app)
      .put('/api/accounts/2001')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }))
      .send({ name: 'StaffR100-renamed' });
    expect(res.status).toBe(200);
    const after = get('SELECT name FROM accounts WHERE id = ?', [2001]);
    expect(after.name).toBe('StaffR100-renamed');
  });
});
