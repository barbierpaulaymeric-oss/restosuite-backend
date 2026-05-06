'use strict';

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('Service mode — floor & KDS endpoints', () => {
  let recipeId;
  const RESTAURANT_ID = 1;

  beforeAll(async () => {
    const existingR = get('SELECT id FROM restaurants WHERE id = ?', [RESTAURANT_ID]);
    if (!existingR) {
      run('INSERT INTO restaurants (id, name) VALUES (?, ?)', [RESTAURANT_ID, 'Resto Test Floor']);
    }
    const existingA = get('SELECT id FROM accounts WHERE id = ?', [1]);
    if (!existingA) {
      run(
        `INSERT INTO accounts (id, name, role, restaurant_id, email) VALUES (?, ?, ?, ?, ?)`,
        [1, 'Test User', 'gerant', RESTAURANT_ID, 'test-floor@restosuite.fr']
      );
    }
    // Seed a few tables for the floor view
    run('DELETE FROM tables WHERE restaurant_id = ?', [RESTAURANT_ID]);
    run('INSERT INTO tables (restaurant_id, table_number, zone, seats) VALUES (?, ?, ?, ?)', [RESTAURANT_ID, 1, 'Salle', 4]);
    run('INSERT INTO tables (restaurant_id, table_number, zone, seats) VALUES (?, ?, ?, ?)', [RESTAURANT_ID, 2, 'Terrasse', 2]);

    const res = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({ name: 'Plat KDS test', category: 'Plats', portions: 1, selling_price: 22 });
    recipeId = res.body.id;
  });

  it('GET /api/service/floor returns tables, orders, and service status', async () => {
    const res = await request(app).get('/api/service/floor').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tables');
    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('service');
    expect(Array.isArray(res.body.tables)).toBe(true);
    expect(res.body.tables.length).toBeGreaterThanOrEqual(2);
    const zones = res.body.tables.map(t => t.zone);
    expect(zones).toContain('Terrasse');
  });

  it('GET /api/service/kds returns only sent or ready orders', async () => {
    // Create an order and send it
    const orderRes = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 1, items: [{ recipe_id: recipeId, quantity: 2 }] });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    await request(app).post(`/api/orders/${orderId}/send`).set(AUTH);

    const res = await request(app).get('/api/service/kds').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    const found = res.body.orders.find(o => o.id === orderId);
    expect(found).toBeDefined();
    expect(['envoyé','prêt']).toContain(found.status);
    expect(Array.isArray(found.items)).toBe(true);
    expect(found.items[0].recipe_name).toBe('Plat KDS test');
  });

  it('POST /api/orders accepts seat_allergies and persists them as JSON', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({
        table_number: 1,
        covers: 4,
        seat_allergies: { '1': 'gluten', '3': 'végétarien', '5': 'ignored beyond covers' },
        items: [{ recipe_id: recipeId, quantity: 1 }]
      });
    expect(res.status).toBe(201);
    // Server stores trimmed JSON; positions out of cover range still pass validation
    // but client-side trims; here server keeps everything within 1..999
    const stored = JSON.parse(res.body.seat_allergies);
    expect(stored['1']).toBe('gluten');
    expect(stored['3']).toBe('végétarien');
    expect(stored['5']).toBe('ignored beyond covers');
  });

  it('POST /api/orders rejects array seat_allergies', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({
        table_number: 2,
        seat_allergies: ['gluten'],
        items: [{ recipe_id: recipeId, quantity: 1 }]
      });
    expect(res.status).toBe(400);
  });

  it('PUT /api/orders/:id accepts seat_allergies update', async () => {
    const create = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 1, items: [{ recipe_id: recipeId, quantity: 1 }] });
    const id = create.body.id;
    const upd = await request(app)
      .put(`/api/orders/${id}`)
      .set(AUTH)
      .send({ seat_allergies: { '2': 'lactose' } });
    expect(upd.status).toBe(200);
    expect(JSON.parse(upd.body.seat_allergies)).toEqual({ '2': 'lactose' });
  });

  it('PUT /api/orders/:id/items/:itemId accepts en_préparation transition', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 2, items: [{ recipe_id: recipeId, quantity: 1 }] });
    const orderId = orderRes.body.id;
    await request(app).post(`/api/orders/${orderId}/send`).set(AUTH);

    const fresh = await request(app).get(`/api/orders/${orderId}`).set(AUTH);
    const itemId = fresh.body.items[0].id;
    expect(fresh.body.items[0].status).toBe('en_attente');

    const transition = await request(app)
      .put(`/api/orders/${orderId}/items/${itemId}`)
      .set(AUTH)
      .send({ status: 'en_préparation' });
    expect(transition.status).toBe(200);

    const after = await request(app).get(`/api/orders/${orderId}`).set(AUTH);
    expect(after.body.items[0].status).toBe('en_préparation');

    // en_préparation → prêt
    const ready = await request(app)
      .put(`/api/orders/${orderId}/items/${itemId}`)
      .set(AUTH)
      .send({ status: 'prêt' });
    expect(ready.status).toBe(200);
  });
});
