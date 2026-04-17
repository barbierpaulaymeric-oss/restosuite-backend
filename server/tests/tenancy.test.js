'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');
const { run, get } = require('../db');

describe('Tenancy isolation — Phase 1', () => {
  it('pre-flight: app boots and rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/crm/customers');
    expect(res.status).toBe(401);
  });
});

describe('C-3: POST /api/ai/execute-action must enforce role gate', () => {
  it('rejects create_recipe from a non-gérant role (equipier)', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 99, role: 'equipier', restaurant_id: 1 }))
      .send({ type: 'create_recipe', params: { name: 'Hack dish' } });
    expect(res.status).toBe(403);
  });

  it('rejects delete_recipe from cuisinier', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 99, role: 'cuisinier', restaurant_id: 1 }))
      .send({ type: 'delete_recipe', params: { recipe_id: 1 } });
    expect(res.status).toBe(403);
  });

  it('allows create_recipe from gérant', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 1, role: 'gerant', restaurant_id: 1 }))
      .send({ type: 'create_recipe', params: { name: 'Legit dish Phase1' } });
    expect([200, 201]).toContain(res.status);
  });
});
