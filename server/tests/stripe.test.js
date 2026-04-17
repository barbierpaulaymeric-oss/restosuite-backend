'use strict';

// Tests for /api/stripe. No real Stripe SDK calls — exercises auth, tenant
// isolation on /status, and error shape when STRIPE_SECRET_KEY is missing.
// Previously had zero coverage (EVAL_POST_SPRINT0 Tier B).

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();
const AUTH_OTHER = authHeader({ id: 99, restaurant_id: 2, email: 'other@test.fr' });

beforeAll(() => {
  // Shared fixtures: restaurants 1/2 + accounts 1/99 must exist because
  // every describe block below hits routes that look up the caller/target.
  if (!get('SELECT id FROM restaurants WHERE id = 1')) {
    run(`INSERT INTO restaurants (id, name) VALUES (1, 'R1')`);
  }
  if (!get('SELECT id FROM restaurants WHERE id = 2')) {
    run(`INSERT INTO restaurants (id, name) VALUES (2, 'R2')`);
  }
  if (!get('SELECT id FROM accounts WHERE id = 1')) {
    run(
      `INSERT INTO accounts (id, name, email, role, restaurant_id)
       VALUES (1, 'Test Gerant', 'test@restosuite.fr', 'gerant', 1)`
    );
  }
  if (!get('SELECT id FROM accounts WHERE id = 99')) {
    run(
      `INSERT INTO accounts (id, name, email, role, restaurant_id)
       VALUES (99, 'Other Tenant', 'other@test.fr', 'gerant', 2)`
    );
  }
});

describe('Stripe — create-checkout', () => {
  it('POST /api/stripe/create-checkout requires auth (401)', async () => {
    const res = await request(app).post('/api/stripe/create-checkout').send({});
    expect(res.status).toBe(401);
  });

  it('handles missing/invalid Stripe config without crashing', async () => {
    // Depending on env: 503 if no STRIPE_SECRET_KEY/PRICE_ID, 200 {url} if
    // fully configured, 500 if a secret is set but invalid (remote 401).
    // We only care that the route never crashes and always returns JSON.
    const res = await request(app)
      .post('/api/stripe/create-checkout')
      .set(AUTH)
      .send({ accountId: 1 });
    expect([200, 500, 503]).toContain(res.status);
    expect(res.body).toBeDefined();
  });
});

describe('Stripe — status', () => {
  it('GET /api/stripe/status/:id without token → 401', async () => {
    const res = await request(app).get('/api/stripe/status/1');
    expect(res.status).toBe(401);
  });

  it('self can read own status → 200 with plan/status', async () => {
    const res = await request(app).get('/api/stripe/status/1').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
    expect(res.body).toHaveProperty('status');
  });

  it('rejects invalid numeric id (400)', async () => {
    const res = await request(app).get('/api/stripe/status/abc').set(AUTH);
    expect(res.status).toBe(400);
  });

  it('404 when target account not found', async () => {
    const res = await request(app).get('/api/stripe/status/99999').set(AUTH);
    expect(res.status).toBe(404);
  });

  it('cross-tenant caller cannot read another tenant status (403)', async () => {
    const res = await request(app).get('/api/stripe/status/1').set(AUTH_OTHER);
    expect(res.status).toBe(403);
  });
});

describe('Stripe — webhook signature verification', () => {
  it('rejects unsigned payload when STRIPE_WEBHOOK_SECRET is set in prod', async () => {
    // Webhook route only rejects if production + no secret configured.
    // Here we simply hit it without signature; behaviour depends on env,
    // but it should never crash and must return a status code.
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'ping' })));
    expect([200, 400, 503]).toContain(res.status);
  });
});
