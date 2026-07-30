'use strict';

/**
 * Attribution d'acquisition (funnel landing/blog → inscription) et garanties
 * de non-divulgation : les colonnes acquisition_* et la table product_events
 * ne doivent JAMAIS contenir d'email, de téléphone ou d'identifiant personnel.
 */

const request = require('supertest');
const app = require('../app');
const { get, all } = require('../db');

let counter = 0;
function uniqueEmail() {
  return `acq-test-${Date.now()}-${counter++}@example.test`;
}

function registerPayload(acquisition) {
  return {
    email: uniqueEmail(),
    password: 'Password1',
    first_name: 'Test',
    last_name: 'Acquisition',
    accepted_terms: true,
    acquisition,
  };
}

describe('POST /api/auth/register — attribution d\'acquisition', () => {
  test('les champs d\'attribution sont stockés, bornés et filtrés', async () => {
    const res = await request(app).post('/api/auth/register').send(registerPayload({
      source: 'blog',
      medium: 'organic',
      campaign: 'haccp-2026',
      content: 'calcul-food-cost',
      position: 'header',
    }));
    expect(res.status).toBe(200);

    const account = get('SELECT * FROM accounts WHERE id = ?', [res.body.account.id]);
    expect(account.acquisition_source).toBe('blog');
    expect(account.acquisition_medium).toBe('organic');
    expect(account.acquisition_campaign).toBe('haccp-2026');
    expect(account.acquisition_content).toBe('calcul-food-cost');
    expect(account.acquisition_position).toBe('header');
  });

  test('inscription sans attribution → colonnes NULL, jamais d\'erreur', async () => {
    const res = await request(app).post('/api/auth/register').send(registerPayload(undefined));
    expect(res.status).toBe(200);
    const account = get('SELECT * FROM accounts WHERE id = ?', [res.body.account.id]);
    expect(account.acquisition_source).toBeNull();
  });

  test('les valeurs hostiles sont neutralisées (PII, HTML, longueur)', async () => {
    const res = await request(app).post('/api/auth/register').send(registerPayload({
      source: 'victime@exemple.fr',              // une adresse email n'a rien à faire ici
      medium: '<script>alert(1)</script>',
      campaign: 'x'.repeat(500),                 // borné à 80
      content: { nested: 'object' },             // mauvais type → null
      position: '+33 6 12 34 56 78',             // le + saute, le reste est inoffensif
    }));
    expect(res.status).toBe(200);

    const account = get('SELECT * FROM accounts WHERE id = ?', [res.body.account.id]);
    expect(account.acquisition_source).not.toContain('@');
    expect(account.acquisition_medium).not.toContain('<');
    expect(account.acquisition_medium).not.toContain('>');
    expect(account.acquisition_campaign.length).toBeLessThanOrEqual(80);
    expect(account.acquisition_content).toBeNull();
  });

  test('product_events trace account_created SANS aucune donnée personnelle', async () => {
    const payload = registerPayload({ source: 'landing' });
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(200);

    const events = all('SELECT * FROM product_events WHERE account_id = ?', [res.body.account.id]);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].event).toBe('account_created');
    expect(events[0].source).toBe('landing');

    // Non-divulgation : aucune colonne de la table ne contient l'email ni le nom
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(payload.email);
    expect(serialized).not.toContain('Acquisition');
  });
});
