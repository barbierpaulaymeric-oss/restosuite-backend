'use strict';

/**
 * AI endpoint tests.
 * We don't call Gemini in tests (no API key), so we only verify:
 * 1. Routes require auth (401 without token)
 * 2. Routes exist — return something other than 404 when authenticated
 */

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

const AI_ROUTES = [
  { method: 'post', path: '/api/ai/parse-voice' },
  { method: 'post', path: '/api/ai/modify-voice' },
  { method: 'post', path: '/api/ai/suggest-suppliers' },
  { method: 'post', path: '/api/ai/chef' },
  { method: 'post', path: '/api/ai/assistant' },
  { method: 'get',  path: '/api/ai/menu-suggestions' },
];

describe('AI endpoints — require auth (401 without token)', () => {
  test.each(AI_ROUTES)('$method $path → 401', async ({ method, path }) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('AI endpoints — routes exist when authenticated (not 404)', () => {
  test.each(AI_ROUTES)('$method $path with auth → not 404', async ({ method, path }) => {
    const res = await request(app)
      [method](path)
      .set(AUTH)
      .send({ prompt: 'test', text: 'test' });
    // May be 200 (unlikely without API key), 400 (missing required body), or 500/503 (no API key)
    // Should NOT be 404 (route missing) or 401 (auth failure)
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(401);
  });
});
