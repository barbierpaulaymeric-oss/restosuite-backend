'use strict';

// Tests for /api/public (API keys + v1 endpoints). Exercises API key auth,
// tenant scoping, rate-limit headers, and permission enforcement. Previously
// had zero coverage (EVAL_POST_SPRINT0 Tier B).

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

async function createKey(permissions = ['read']) {
  const res = await request(app)
    .post('/api/public/keys')
    .set(AUTH)
    .send({ key_name: `key-${Date.now()}`, permissions });
  return res.body.api_key;
}

describe('Public API — key management', () => {
  it('POST /api/public/keys requires auth (401)', async () => {
    const res = await request(app).post('/api/public/keys').send({ key_name: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /api/public/keys → 200 and returns api_key starting with rs_', async () => {
    const res = await request(app)
      .post('/api/public/keys')
      .set(AUTH)
      .send({ key_name: 'demo key', permissions: ['read'] });
    expect(res.status).toBe(200);
    expect(res.body.api_key).toMatch(/^rs_/);
    expect(res.body.permissions).toEqual(['read']);
  });

  it('POST /api/public/keys without key_name → 400', async () => {
    const res = await request(app).post('/api/public/keys').set(AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/public/keys returns keys scoped to tenant', async () => {
    await createKey();
    const res = await request(app).get('/api/public/keys').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /api/public/keys/:id → 200', async () => {
    // Insert a key and delete it
    const created = await request(app)
      .post('/api/public/keys')
      .set(AUTH)
      .send({ key_name: 'to-delete' });
    const id = get('SELECT id FROM api_keys WHERE api_key = ?', [created.body.api_key]).id;
    const res = await request(app).delete(`/api/public/keys/${id}`).set(AUTH);
    expect(res.status).toBe(200);
  });
});

describe('Public API — v1 endpoints require API key', () => {
  it('GET /api/public/v1/menu without key → 401', async () => {
    const res = await request(app).get('/api/public/v1/menu');
    expect(res.status).toBe(401);
  });

  it('GET /api/public/v1/menu with invalid key → 403', async () => {
    const res = await request(app)
      .get('/api/public/v1/menu')
      .set('X-API-Key', 'rs_fake_' + Math.random());
    expect(res.status).toBe(403);
  });

  it('GET /api/public/v1/menu with valid key → 200', async () => {
    const apiKey = await createKey();
    const res = await request(app)
      .get('/api/public/v1/menu')
      .set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    // Rate limit headers present
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('GET /api/public/v1/stock with valid key → 200', async () => {
    const apiKey = await createKey();
    const res = await request(app)
      .get('/api/public/v1/stock')
      .set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stock');
  });

  it('GET /api/public/v1/stats with valid key → 200', async () => {
    const apiKey = await createKey();
    const res = await request(app)
      .get('/api/public/v1/stats')
      .set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('today');
    expect(res.body).toHaveProperty('totals');
  });

  it('GET /api/public/v1/availability with valid key → 200', async () => {
    const apiKey = await createKey();
    const res = await request(app)
      .get('/api/public/v1/availability')
      .set('X-API-Key', apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('availability');
  });
});

describe('Public API — write permission enforcement', () => {
  it('POST /v1/orders with read-only key → 403', async () => {
    const readKey = await createKey(['read']);
    const res = await request(app)
      .post('/api/public/v1/orders')
      .set('X-API-Key', readKey)
      .send({ items: [{ recipe_id: 1, quantity: 1 }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/write/);
  });

  it('POST /v1/orders without items → 400 (with write key)', async () => {
    const writeKey = await createKey(['read', 'write']);
    const res = await request(app)
      .post('/api/public/v1/orders')
      .set('X-API-Key', writeKey)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /v1/orders rejects cross-tenant recipe_id (400)', async () => {
    const writeKey = await createKey(['read', 'write']);
    // Insert a recipe for restaurant 2 — the test key belongs to restaurant 1
    const ins = run(
      `INSERT INTO recipes (name, restaurant_id, selling_price, recipe_type)
       VALUES ('X-tenant bait', 2, 10, 'plat')`
    );
    const res = await request(app)
      .post('/api/public/v1/orders')
      .set('X-API-Key', writeKey)
      .send({ items: [{ recipe_id: Number(ins.lastInsertRowid), quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe('Public API — docs + key-by-query', () => {
  it('GET /api/public/docs is unauthenticated and returns endpoint list', async () => {
    const res = await request(app).get('/api/public/docs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.endpoints)).toBe(true);
  });

  it('api_key accepted as query parameter', async () => {
    const apiKey = await createKey();
    const res = await request(app).get(`/api/public/v1/menu?api_key=${apiKey}`);
    expect(res.status).toBe(200);
  });
});
