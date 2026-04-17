'use strict';

/**
 * Alto personalization — preferences, shortcuts, learning, reject-action.
 * No Gemini calls here; we only exercise the DB-backed routes.
 */

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('AI preferences — auth', () => {
  test('GET /api/ai-preferences → 401 without token', async () => {
    const res = await request(app).get('/api/ai-preferences');
    expect(res.status).toBe(401);
  });
  test('PUT /api/ai-preferences → 401 without token', async () => {
    const res = await request(app).put('/api/ai-preferences').send({ preferences: {} });
    expect(res.status).toBe(401);
  });
});

describe('AI preferences — CRUD', () => {
  test('PUT then GET round-trips preferences', async () => {
    const put = await request(app)
      .put('/api/ai-preferences')
      .set(AUTH)
      .send({ preferences: { establishment_type: 'bistrot', tone: 'tu' } });
    expect(put.status).toBe(200);
    expect(put.body.success).toBe(true);

    const got = await request(app).get('/api/ai-preferences').set(AUTH);
    expect(got.status).toBe(200);
    expect(got.body.preferences.establishment_type).toBe('bistrot');
    expect(got.body.preferences.tone).toBe('tu');
  });

  test('PUT rejects missing preferences payload', async () => {
    const res = await request(app).put('/api/ai-preferences').set(AUTH).send({});
    expect(res.status).toBe(400);
  });
});

describe('AI shortcuts — CRUD', () => {
  let createdId;

  test('POST /shortcuts creates a shortcut', async () => {
    const res = await request(app)
      .post('/api/ai-preferences/shortcuts')
      .set(AUTH)
      .send({
        trigger_phrase: 'relevé du matin',
        action_type: 'record_temperature',
        action_template: { location: 'frigo 1', temperature: 4 },
        description: 'Relevé matinal frigo 1',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('number');
    createdId = res.body.id;
  });

  test('GET /shortcuts lists the created shortcut', async () => {
    const res = await request(app).get('/api/ai-preferences/shortcuts').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.shortcuts)).toBe(true);
    const found = res.body.shortcuts.find(s => s.id === createdId);
    expect(found).toBeDefined();
    expect(found.trigger_phrase).toBe('relevé du matin');
  });

  test('POST /shortcuts rejects missing trigger_phrase', async () => {
    const res = await request(app)
      .post('/api/ai-preferences/shortcuts')
      .set(AUTH)
      .send({ action_type: 'record_temperature' });
    expect(res.status).toBe(400);
  });

  test('DELETE /shortcuts/:id removes the shortcut', async () => {
    const res = await request(app)
      .delete(`/api/ai-preferences/shortcuts/${createdId}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('AI learning — read + reject-action', () => {
  test('GET /learning returns an array', async () => {
    const res = await request(app).get('/api/ai-preferences/learning').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.learning)).toBe(true);
  });

  test('POST /api/ai/reject-action logs a rejection', async () => {
    const res = await request(app)
      .post('/api/ai/reject-action')
      .set(AUTH)
      .send({ type: 'record_temperature', params: { foo: 1 }, reason: 'wrong zone' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const lr = await request(app).get('/api/ai-preferences/learning').set(AUTH);
    expect(lr.status).toBe(200);
    const found = lr.body.learning.find(l => l.outcome === 'rejected' && l.action_type === 'record_temperature');
    expect(found).toBeDefined();
  });

  test('POST /api/ai/reject-action → 400 without type', async () => {
    const res = await request(app).post('/api/ai/reject-action').set(AUTH).send({});
    expect(res.status).toBe(400);
  });
});
