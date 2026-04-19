'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('Plans — Public listing', () => {
  it('GET /api/plans → 200 with plans', async () => {
    const res = await request(app).get('/api/plans');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('plans list includes discovery plan', async () => {
    const res = await request(app).get('/api/plans');
    const ids = res.body.items.map(p => p.id);
    expect(ids).toContain('discovery');
  });

  it('plans have required fields', async () => {
    const res = await request(app).get('/api/plans');
    for (const plan of res.body.items) {
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('price');
    }
  });
});

describe('Plans — Current plan (requires auth)', () => {
  it('GET /api/plans/current → 401 without token', async () => {
    const res = await request(app).get('/api/plans/current');
    expect(res.status).toBe(401);
  });

  it('GET /api/plans/current → 200 with auth', async () => {
    const res = await request(app).get('/api/plans/current').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('plan');
  });
});

describe('Plans — Upgrade (requires auth + gerant role)', () => {
  it('POST /api/plans/upgrade → 401 without token', async () => {
    const res = await request(app)
      .post('/api/plans/upgrade')
      .send({ plan: 'essential' });
    expect(res.status).toBe(401);
  });

  it('POST /api/plans/upgrade → 400 with invalid plan', async () => {
    const res = await request(app)
      .post('/api/plans/upgrade')
      .set(AUTH)
      .send({ plan: 'nonexistent-plan' });
    expect(res.status).toBe(400);
  });

  it('POST /api/plans/upgrade → 200 with valid plan', async () => {
    const res = await request(app)
      .post('/api/plans/upgrade')
      .set(AUTH)
      .send({ plan: 'professional' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body.plan).toBe('professional');
  });

  it('POST /api/plans/upgrade → 200 with legacy plan, persists as professional', async () => {
    // Legacy tier names (essential, premium) collapse to 'professional'
    // since the public catalog only exposes 3 tiers.
    const res = await request(app)
      .post('/api/plans/upgrade')
      .set(AUTH)
      .send({ plan: 'essential' });
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('professional');
  });

  it('POST /api/plans/upgrade → 403 for non-gerant', async () => {
    const staffAuth = authHeader({ role: 'cuisinier' });
    const res = await request(app)
      .post('/api/plans/upgrade')
      .set(staffAuth)
      .send({ plan: 'professional' });
    expect(res.status).toBe(403);
  });
});
