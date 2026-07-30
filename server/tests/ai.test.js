'use strict';

/**
 * AI endpoint tests.
 * GEMINI_API_KEY est neutralisée par tests/helpers/env.js : aucun appel réseau
 * réel n'est possible ici (le garde réseau de env.js bloquerait de toute façon
 * tout hôte externe). On vérifie :
 * 1. Routes require auth (401 without token)
 * 2. Sans clé configurée, les routes échouent de façon DÉTERMINISTE
 *    (400 validation ou 500 « not configured ») — jamais 404, jamais 502
 *    (502 impliquerait qu'une vraie requête Gemini est partie).
 * Le contrat fonctionnel avec Gemini mocké est couvert par ai-contract.test.js.
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

describe('AI endpoints — deterministic failure without API key', () => {
  test.each(AI_ROUTES)('$method $path with auth → 400/500/503, jamais 404 ni 502', async ({ method, path }) => {
    const res = await request(app)
      [method](path)
      .set(AUTH)
      .send({ prompt: 'test', text: 'test' });
    // Sans GEMINI_API_KEY : 400 (validation du body) ou 500/503 (clé absente).
    // 404 = route manquante ; 502 = une VRAIE requête Gemini est partie — les
    // deux sont des régressions.
    expect([400, 500, 503]).toContain(res.status);
  });

  test('POST /api/ai/parse-voice sans clé → 500 "not configured" explicite', async () => {
    const res = await request(app)
      .post('/api/ai/parse-voice')
      .set(AUTH)
      .send({ text: '250g de farine et 3 œufs' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY/);
  });
});
