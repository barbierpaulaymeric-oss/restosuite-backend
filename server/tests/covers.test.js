'use strict';

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('Covers (couverts) tracking', () => {
  let recipeId;

  beforeAll(async () => {
    // FK-on :memory: DB requires the restaurant to exist before orders.restaurant_id can be set
    const existingR = get('SELECT id FROM restaurants WHERE id = ?', [1]);
    if (!existingR) {
      run('INSERT INTO restaurants (id, name) VALUES (?, ?)', [1, 'Restaurant Couverts Test']);
    }
    // service routes look up the account by req.user.id; ensure an account row exists
    const existingA = get('SELECT id FROM accounts WHERE id = ?', [1]);
    if (!existingA) {
      run(
        `INSERT INTO accounts (id, name, role, restaurant_id, email) VALUES (?, ?, ?, ?, ?)`,
        [1, 'Test User', 'gerant', 1, 'test@restosuite.fr']
      );
    }

    // Need a recipe to put in the order
    const res = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({ name: 'Plat test couverts', category: 'Plats', portions: 1, selling_price: 18 });
    recipeId = res.body.id;
  });

  it('POST /api/orders accepts covers field', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 7, covers: 4, items: [{ recipe_id: recipeId, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.covers).toBe(4);
  });

  it('POST /api/orders rejects negative covers', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 8, covers: -1, items: [{ recipe_id: recipeId, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('POST /api/orders rejects non-integer covers', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 9, covers: 2.5, items: [{ recipe_id: recipeId, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('POST /api/orders without covers stores NULL (default)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 10, items: [{ recipe_id: recipeId, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.covers == null).toBe(true);
  });

  it('PUT /api/orders/:id can update covers', async () => {
    const create = await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 11, items: [{ recipe_id: recipeId, quantity: 1 }] });
    const id = create.body.id;
    const upd = await request(app)
      .put(`/api/orders/${id}`)
      .set(AUTH)
      .send({ covers: 6 });
    expect(upd.status).toBe(200);
    expect(upd.body.covers).toBe(6);
  });

  it('GET /api/analytics/covers returns aggregated metrics', async () => {
    const res = await request(app).get('/api/analytics/covers?days=30').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_covers');
    expect(res.body).toHaveProperty('food_cost_per_cover');
    expect(res.body).toHaveProperty('per_day');
    expect(res.body).toHaveProperty('per_week');
    expect(res.body).toHaveProperty('per_service');
    expect(typeof res.body.total_covers).toBe('number');
    expect(res.body.total_covers).toBeGreaterThan(0);
  });

  it('Service stop recap sums total_covers', async () => {
    // Make sure no session is active first
    await request(app).post('/api/service/stop').set(AUTH);
    const start = await request(app).post('/api/service/start').set(AUTH);
    expect(start.status).toBe(200);
    // Create an order with covers within this session window
    await request(app)
      .post('/api/orders')
      .set(AUTH)
      .send({ table_number: 12, covers: 3, items: [{ recipe_id: recipeId, quantity: 1 }] });
    // Stop the service
    const stop = await request(app).post('/api/service/stop').set(AUTH);
    expect(stop.status).toBe(200);
    expect(stop.body.recap).toHaveProperty('total_covers');
    expect(stop.body.recap.total_covers).toBeGreaterThanOrEqual(3);
  });
});
