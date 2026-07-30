'use strict';

/**
 * POST /api/demo — formulaire public « Réserver une démo ».
 * Vérifie la validation, le honeypot anti-spam, et l'enregistrement en base
 * (sans exposer de données en retour).
 */

const request = require('supertest');
const app = require('../app');
const { get } = require('../db');

let n = 0;
const email = () => `demo-test-${Date.now()}-${n++}@example.test`;

describe('POST /api/demo', () => {
  test('demande valide → 200 + enregistrée en base', async () => {
    const e = email();
    const res = await request(app).post('/api/demo').send({
      first_name: 'Paul', last_name: 'Test', restaurant: 'Chez Marcel',
      phone: '06 12 34 56 78', email: e, consent: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const row = get('SELECT * FROM demo_requests WHERE email = ?', [e]);
    expect(row).toBeTruthy();
    expect(row.restaurant).toBe('Chez Marcel');
    expect(row.consent).toBe(1);
  });

  test('email invalide → 400', async () => {
    const res = await request(app).post('/api/demo').send({ email: 'pas-un-email', consent: true });
    expect(res.status).toBe(400);
  });

  test('sans consentement → 400', async () => {
    const res = await request(app).post('/api/demo').send({ email: email(), consent: false });
    expect(res.status).toBe(400);
  });

  test('honeypot rempli → 200 mais rien enregistré (bot)', async () => {
    const e = email();
    const res = await request(app).post('/api/demo').send({ email: e, consent: true, website: 'http://spam' });
    expect(res.status).toBe(200);
    const row = get('SELECT * FROM demo_requests WHERE email = ?', [e]);
    expect(row).toBeUndefined();
  });

  test('valeurs bornées et sans échappement HTML stocké tel quel (traité au rendu)', async () => {
    const e = email();
    await request(app).post('/api/demo').send({
      email: e, consent: true, restaurant: 'x'.repeat(500),
    });
    const row = get('SELECT * FROM demo_requests WHERE email = ?', [e]);
    expect(row.restaurant.length).toBeLessThanOrEqual(120);
  });
});
