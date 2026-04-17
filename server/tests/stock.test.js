'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('Stock — requires auth', () => {
  it('GET /api/stock → 401 without token', async () => {
    const res = await request(app).get('/api/stock');
    expect(res.status).toBe(401);
  });
});

describe('Stock — Reading', () => {
  it('GET /api/stock → 200 with items and total', async () => {
    const res = await request(app).get('/api/stock').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/stock?q=test → 200 filtered results', async () => {
    const res = await request(app)
      .get('/api/stock?q=test')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/stock/alerts → 200 array', async () => {
    const res = await request(app).get('/api/stock/alerts').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/stock/movements → 200 array', async () => {
    const res = await request(app).get('/api/stock/movements').set(AUTH);
    expect(res.status).toBe(200);
  });
});

describe('Stock — Reception', () => {
  let ingredientId;

  beforeAll(async () => {
    const ing = await request(app)
      .post('/api/ingredients')
      .set(AUTH)
      .send({ name: 'Tomates stock-test', category: 'Légumes', default_unit: 'kg' });
    ingredientId = ing.body.id;
  });

  it('POST /api/stock/reception → 201 adds stock', async () => {
    const res = await request(app)
      .post('/api/stock/reception')
      .set(AUTH)
      .send({
        lines: [
          {
            ingredient_id: ingredientId,
            quantity: 10,
            unit: 'kg',
            lot_number: 'LOT-001',
            expiry_date: '2026-12-31',
          }
        ]
      });
    expect(res.status).toBe(201);
  });

  it('POST /api/stock/reception → 400 without lines', async () => {
    const res = await request(app)
      .post('/api/stock/reception')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/stock/reception → 400 with empty lines array', async () => {
    const res = await request(app)
      .post('/api/stock/reception')
      .set(AUTH)
      .send({ lines: [] });
    expect(res.status).toBe(400);
  });

  it('POST /api/stock/reception → 400 with missing quantity', async () => {
    const res = await request(app)
      .post('/api/stock/reception')
      .set(AUTH)
      .send({
        lines: [{ ingredient_id: ingredientId, unit: 'kg' }]
      });
    expect(res.status).toBe(400);
  });
});

describe('Stock — Loss & Adjustment', () => {
  let ingredientId;

  beforeAll(async () => {
    const ing = await request(app)
      .post('/api/ingredients')
      .set(AUTH)
      .send({ name: 'Carottes ajustement', category: 'Légumes', default_unit: 'kg' });
    ingredientId = ing.body.id;

    // First add some stock
    await request(app)
      .post('/api/stock/reception')
      .set(AUTH)
      .send({
        lines: [{ ingredient_id: ingredientId, quantity: 20, unit: 'kg' }]
      });
  });

  it('POST /api/stock/loss → 200', async () => {
    const res = await request(app)
      .post('/api/stock/loss')
      .set(AUTH)
      .send({ ingredient_id: ingredientId, quantity: 2, unit: 'kg', reason: 'Périmé' });
    expect([200, 201]).toContain(res.status);
  });
});
