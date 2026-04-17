'use strict';

// Tests for /api/menu (public QR-code menu + ordering). Verifies:
//  - restaurant_id is mandatory on every public endpoint (cross-tenant guard)
//  - unknown restaurant_id → 404, not a leaky fallback
//  - recipe_id is scoped to the same tenant on order creation

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

function ensureRestaurant(id, name) {
  const existing = get('SELECT id FROM restaurants WHERE id = ?', [id]);
  if (!existing) {
    run(
      `INSERT INTO restaurants (id, name) VALUES (?, ?)`,
      [id, name]
    );
  }
}

beforeAll(() => {
  ensureRestaurant(1, 'Restaurant 1');
  ensureRestaurant(2, 'Restaurant 2');
});

describe('Public menu — GET /api/menu', () => {
  it('rejects without restaurant_id param (400)', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/restaurant_id/);
  });

  it('rejects negative restaurant_id (400)', async () => {
    const res = await request(app).get('/api/menu?r=-1');
    expect(res.status).toBe(400);
  });

  it('rejects non-integer restaurant_id (400)', async () => {
    const res = await request(app).get('/api/menu?r=abc');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown restaurant id (no fallback leak)', async () => {
    const res = await request(app).get('/api/menu?r=999999');
    expect(res.status).toBe(404);
  });

  it('returns 200 + categories shape for a real restaurant', async () => {
    const res = await request(app).get('/api/menu?r=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('restaurant_name');
    expect(res.body).toHaveProperty('categories');
  });
});

describe('Public menu order — POST /api/menu/order', () => {
  it('rejects without restaurant_id (400)', async () => {
    const res = await request(app)
      .post('/api/menu/order')
      .send({ table_number: 1, items: [{ recipe_id: 1, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects unknown restaurant_id (404)', async () => {
    const res = await request(app)
      .post('/api/menu/order')
      .send({ restaurant_id: 999999, table_number: 1, items: [{ recipe_id: 1, quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it('rejects missing table_number (400)', async () => {
    const res = await request(app)
      .post('/api/menu/order')
      .send({ restaurant_id: 1, items: [{ recipe_id: 1, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects empty items (400)', async () => {
    const res = await request(app)
      .post('/api/menu/order')
      .send({ restaurant_id: 1, table_number: 5, items: [] });
    expect(res.status).toBe(400);
  });

  it('creates order when recipe belongs to same tenant (201)', async () => {
    // Insert a recipe scoped to restaurant 1
    const ins = run(
      `INSERT INTO recipes (name, restaurant_id, selling_price, recipe_type)
       VALUES ('Test Plate', 1, 12.5, 'plat')`
    );
    const recipeId = Number(ins.lastInsertRowid);
    const res = await request(app)
      .post('/api/menu/order')
      .send({
        restaurant_id: 1,
        table_number: 5,
        items: [{ recipe_id: recipeId, quantity: 2 }],
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order_id');
    expect(res.body.total).toBe(25);
  });

  it('cross-tenant recipe_id is silently dropped (total = 0)', async () => {
    // Recipe belongs to restaurant 2, ordering flow posts restaurant 1
    const ins = run(
      `INSERT INTO recipes (name, restaurant_id, selling_price, recipe_type)
       VALUES ('Other Tenant Plate', 2, 99, 'plat')`
    );
    const foreignRecipeId = Number(ins.lastInsertRowid);
    const res = await request(app)
      .post('/api/menu/order')
      .send({
        restaurant_id: 1,
        table_number: 3,
        items: [{ recipe_id: foreignRecipeId, quantity: 1 }],
      });
    expect(res.status).toBe(201);
    // Foreign recipe should NOT have been priced into the order.
    expect(res.body.total).toBe(0);
  });
});

describe('Public menu pending-orders — auth-gated', () => {
  it('GET /api/menu/pending-orders without token → 401', async () => {
    const res = await request(app).get('/api/menu/pending-orders');
    expect(res.status).toBe(401);
  });

  it('GET /api/menu/pending-orders with token → 200', async () => {
    const res = await request(app).get('/api/menu/pending-orders').set(AUTH);
    expect(res.status).toBe(200);
  });
});
