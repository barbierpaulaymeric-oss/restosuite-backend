'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('CRM — requires auth', () => {
  it('GET /api/crm/customers → 401 without token', async () => {
    const res = await request(app).get('/api/crm/customers');
    expect(res.status).toBe(401);
  });

  it('POST /api/crm/customers → 401 without token', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

describe('CRM — Customers CRUD', () => {
  let customerId;

  it('GET /api/crm/customers → 200 array', async () => {
    const res = await request(app).get('/api/crm/customers').set(AUTH);
    expect(res.status).toBe(200);
    // Can be array or paginated object
    const data = Array.isArray(res.body) ? res.body : res.body.customers;
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST /api/crm/customers → 200 with customer id', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(AUTH)
      .send({
        name: 'Marie Dupont',
        email: 'marie@example.com',
        phone: '0612345678',
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.ok).toBe(true);
    customerId = res.body.id;
  });

  it('POST /api/crm/customers → 400 without name', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(AUTH)
      .send({ email: 'noname@test.fr' });
    expect(res.status).toBe(400);
  });

  it('POST /api/crm/customers → 400 with invalid email', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(AUTH)
      .send({ name: 'Test', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('GET /api/crm/customers/:id → 200 with customer data', async () => {
    expect(customerId).toBeDefined();
    const res = await request(app).get(`/api/crm/customers/${customerId}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Marie Dupont');
  });

  it('GET /api/crm/customers/999999 → 404', async () => {
    const res = await request(app).get('/api/crm/customers/999999').set(AUTH);
    expect(res.status).toBe(404);
  });

  it('PUT /api/crm/customers/:id → 200 updated', async () => {
    const res = await request(app)
      .put(`/api/crm/customers/${customerId}`)
      .set(AUTH)
      .send({ name: 'Marie Dupont-Martin', vip: 1 });
    expect(res.status).toBe(200);
  });

  it('POST /api/crm/customers/:id/visit → records a visit', async () => {
    const res = await request(app)
      .post(`/api/crm/customers/${customerId}/visit`)
      .set(AUTH)
      .send({ amount: 35.50 });
    expect([200, 201]).toContain(res.status);
  });
});

describe('CRM — Rewards & Stats', () => {
  it('GET /api/crm/rewards → 200', async () => {
    const res = await request(app).get('/api/crm/rewards').set(AUTH);
    expect(res.status).toBe(200);
  });

  it('GET /api/crm/stats → 200', async () => {
    const res = await request(app).get('/api/crm/stats').set(AUTH);
    expect(res.status).toBe(200);
  });
});
