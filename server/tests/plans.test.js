'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('Plans — Single-tier subscription status', () => {
  it('GET /api/plans/current → 401 without token', async () => {
    const res = await request(app).get('/api/plans/current');
    expect(res.status).toBe(401);
  });

  it('GET /api/plans/current → 200 with auth, returns trial status + Pro plan', async () => {
    const res = await request(app).get('/api/plans/current').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(['pro', 'trial', 'expired']).toContain(res.body.status);
    expect(res.body).toHaveProperty('plan');
    expect(res.body.plan).toMatchObject({ id: 'pro', price: 39 });
  });

  it('GET /api/plans (legacy list endpoint) → 404 (removed)', async () => {
    const res = await request(app).get('/api/plans');
    expect([404, 401]).toContain(res.status);
  });

  it('POST /api/plans/upgrade (legacy upgrade endpoint) → 404 (removed)', async () => {
    const res = await request(app)
      .post('/api/plans/upgrade')
      .set(AUTH)
      .send({ plan: 'pro' });
    expect([404, 401]).toContain(res.status);
  });
});
