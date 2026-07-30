'use strict';

/**
 * Multi-site — garde de sécurité produit (décision 2026-07-30).
 *
 * La fonction est MASQUÉE tant que la tenancy (org ↔ sites) n'est pas terminée :
 * la création d'un site rattachait le nouveau restaurant à personne, le rendant
 * invisible à son créateur et laissant des données orphelines. Ces tests
 * garantissent que la CRÉATION / MODIFICATION / SUPPRESSION est refusée (403)
 * tant que MULTISITE_ENABLED !== 'true', sans casser les lectures inoffensives.
 */

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

beforeAll(() => {
  if (!get('SELECT id FROM restaurants WHERE id = 1')) {
    run(`INSERT INTO restaurants (id, name) VALUES (1, 'R1')`);
  }
});

describe('Multi-site — création bloquée par le feature flag', () => {
  test('POST /api/sites → 403 MULTISITE_DISABLED (aucun restaurant créé)', async () => {
    const before = get('SELECT COUNT(*) AS c FROM restaurants').c;
    const res = await request(app)
      .post('/api/sites')
      .set(AUTH)
      .send({ name: 'Nouveau site fantôme' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MULTISITE_DISABLED');

    const after = get('SELECT COUNT(*) AS c FROM restaurants').c;
    expect(after).toBe(before); // aucune donnée orpheline créée
  });

  test('PUT /api/sites/:id → 403 (modification bloquée)', async () => {
    const res = await request(app).put('/api/sites/1').set(AUTH).send({ name: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MULTISITE_DISABLED');
  });

  test('DELETE /api/sites/:id → 403 (suppression bloquée)', async () => {
    const res = await request(app).delete('/api/sites/1').set(AUTH);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MULTISITE_DISABLED');
  });

  test('GET /api/sites reste accessible (lecture inoffensive, mono-site)', async () => {
    const res = await request(app).get('/api/sites').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/sites → 401 sans authentification (garde préalable)', async () => {
    const res = await request(app).post('/api/sites').send({ name: 'x' });
    expect(res.status).toBe(401);
  });
});
