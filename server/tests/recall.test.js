'use strict';

// Tests for /api/recall (recall / retrait-rappel produits). Exercises the
// workflow transitions and tenant isolation — previously had zero coverage
// (flagged in EVAL_POST_SPRINT0 Tier B).

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();
const AUTH_OTHER = authHeader({ id: 99, restaurant_id: 2, email: 'other@test.fr' });

function baseProcedure(overrides = {}) {
  return {
    product_name: 'Saumon fumé lot A',
    lot_number: 'L2026-04-001',
    reason: 'sanitaire',
    alert_source: 'DGAL',
    severity: 'majeur',
    quantity_affected: 12,
    quantity_unit: 'kg',
    ...overrides,
  };
}

describe('Recall — auth', () => {
  it('GET /api/recall without token → 401', async () => {
    const res = await request(app).get('/api/recall');
    expect(res.status).toBe(401);
  });

  it('POST /api/recall without token → 401', async () => {
    const res = await request(app).post('/api/recall').send(baseProcedure());
    expect(res.status).toBe(401);
  });
});

describe('Recall — CRUD', () => {
  it('POST / creates with default status=alerte', async () => {
    const res = await request(app).post('/api/recall').set(AUTH).send(baseProcedure());
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('alerte');
    expect(res.body.product_name).toBe('Saumon fumé lot A');
  });

  it('POST / rejects missing product_name (400)', async () => {
    const res = await request(app)
      .post('/api/recall')
      .set(AUTH)
      .send({ reason: 'sanitaire' });
    expect(res.status).toBe(400);
  });

  it('POST / rejects invalid reason (400)', async () => {
    const res = await request(app)
      .post('/api/recall')
      .set(AUTH)
      .send(baseProcedure({ reason: 'fake-reason' }));
    expect(res.status).toBe(400);
  });

  it('POST / rejects invalid severity (400)', async () => {
    const res = await request(app)
      .post('/api/recall')
      .set(AUTH)
      .send(baseProcedure({ severity: 'catastrophique' }));
    expect(res.status).toBe(400);
  });

  it('GET / lists only caller tenant rows', async () => {
    await request(app).post('/api/recall').set(AUTH).send(baseProcedure({ product_name: 'Produit tenant 1' }));
    const res = await request(app).get('/api/recall').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.every(r => r.restaurant_id === 1)).toBe(true);
  });

  it('tenant isolation — tenant 2 cannot see tenant 1 procedure', async () => {
    const created = await request(app).post('/api/recall').set(AUTH).send(baseProcedure({ product_name: 'Isolation probe' }));
    const id = created.body.id;
    const res = await request(app).get('/api/recall').set(AUTH_OTHER);
    expect(res.status).toBe(200);
    expect(res.body.items.some(r => r.id === id)).toBe(false);
  });

  it('GET /active only returns alerte/en_cours rows', async () => {
    await request(app).post('/api/recall').set(AUTH).send(baseProcedure({ product_name: 'Active recall' }));
    const res = await request(app).get('/api/recall/active').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.items.every(r => ['alerte', 'en_cours'].includes(r.status))).toBe(true);
  });
});

describe('Recall — workflow transitions', () => {
  it('alerte → investigation is allowed', async () => {
    const created = await request(app).post('/api/recall').set(AUTH).send(baseProcedure());
    const res = await request(app)
      .put(`/api/recall/${created.body.id}`)
      .set(AUTH)
      .send({ status: 'investigation' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('investigation');
  });

  it('rejects invalid status value (400)', async () => {
    const created = await request(app).post('/api/recall').set(AUTH).send(baseProcedure());
    const res = await request(app)
      .put(`/api/recall/${created.body.id}`)
      .set(AUTH)
      .send({ status: 'martian' });
    expect(res.status).toBe(400);
  });

  it('PUT on other tenant id → 404', async () => {
    const created = await request(app).post('/api/recall').set(AUTH).send(baseProcedure());
    const res = await request(app)
      .put(`/api/recall/${created.body.id}`)
      .set(AUTH_OTHER)
      .send({ status: 'investigation' });
    expect(res.status).toBe(404);
  });
});

describe('Recall — batch-trace', () => {
  it('GET /:id/batch-trace returns 200 or 404 (no crash)', async () => {
    const created = await request(app).post('/api/recall').set(AUTH).send(baseProcedure());
    const res = await request(app)
      .get(`/api/recall/${created.body.id}/batch-trace`)
      .set(AUTH);
    expect([200, 404]).toContain(res.status);
  });
});
