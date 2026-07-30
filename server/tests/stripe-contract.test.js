'use strict';

/**
 * Contrats Stripe avec SDK MOCKÉ — aucune requête réseau.
 *
 * stripe.test.js couvre l'auth et le comportement sans clé (503 déterministe
 * depuis que env.js neutralise STRIPE_SECRET_KEY). Ce fichier couvre le
 * contrat fonctionnel : création de session Checkout, abonnement déjà actif,
 * erreur Stripe visible, webhook (checkout.session.completed, idempotence,
 * invoice.payment_failed).
 *
 * La clé factice est posée AVANT le require de l'app ; le module `stripe` est
 * remplacé par jest.mock — le SDK réel n'est jamais instancié.
 */

process.env.STRIPE_SECRET_KEY = 'sk_test_mock_jamais_utilisee';
process.env.STRIPE_PRICE_ID = 'price_test_mock';
// STRIPE_WEBHOOK_SECRET reste vide : en NODE_ENV=test le webhook parse le body
// brut sans vérification de signature (chemin de test documenté dans stripe.js).

const mockStripeClient = {
  webhooks: { constructEvent: jest.fn() },
  subscriptions: { retrieve: jest.fn() },
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
};
jest.mock('stripe', () => jest.fn(() => mockStripeClient));

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

beforeAll(() => {
  if (!get('SELECT id FROM restaurants WHERE id = 1')) {
    run(`INSERT INTO restaurants (id, name) VALUES (1, 'R1')`);
  }
  if (!get('SELECT id FROM accounts WHERE id = 1')) {
    run(
      `INSERT INTO accounts (id, name, email, role, restaurant_id)
       VALUES (1, 'Test Gerant', 'test@restosuite.fr', 'gerant', 1)`
    );
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  run('DELETE FROM subscriptions');
  run('DELETE FROM processed_stripe_events');
});

function postWebhook(event) {
  return request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(event));
}

describe('POST /api/stripe/create-checkout — contrat SDK mocké', () => {
  test('200 + url de session ; le compte vient de la session serveur', async () => {
    mockStripeClient.customers.create.mockResolvedValue({ id: 'cus_mock_1' });
    mockStripeClient.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/c/mock' });

    // accountId forgé dans le body : DOIT être ignoré (auth = source de vérité)
    const res = await request(app)
      .post('/api/stripe/create-checkout')
      .set(AUTH)
      .send({ accountId: 424242 });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/c/mock');

    const createArgs = mockStripeClient.checkout.sessions.create.mock.calls[0][0];
    expect(createArgs.metadata.account_id).toBe('1'); // req.user.id, pas le body
    expect(createArgs.line_items[0].price).toBe('price_test_mock');

    const subRow = get('SELECT * FROM subscriptions WHERE account_id = 1');
    expect(subRow.status).toBe('incomplete');
    expect(subRow.stripe_customer_id).toBe('cus_mock_1');
  });

  test('abonnement déjà actif → réponse "Already subscribed", pas de session', async () => {
    run(`INSERT INTO subscriptions (account_id, stripe_customer_id, status, plan)
         VALUES (1, 'cus_mock_1', 'active', 'pro')`);

    const res = await request(app).post('/api/stripe/create-checkout').set(AUTH).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(mockStripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('erreur Stripe → 500 avec message, jamais de redirection silencieuse', async () => {
    mockStripeClient.customers.create.mockResolvedValue({ id: 'cus_mock_1' });
    mockStripeClient.checkout.sessions.create.mockRejectedValue(new Error('stripe down'));

    const res = await request(app).post('/api/stripe/create-checkout').set(AUTH).send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create checkout session');
  });
});

describe('POST /api/stripe/webhook — contrat événements', () => {
  test('checkout.session.completed → subscription active + événement paid', async () => {
    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      status: 'active',
      current_period_end: 1830297600, // 2028-01-01
      metadata: { account_id: '1' },
    });

    const res = await postWebhook({
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { account_id: '1' }, subscription: 'sub_mock_1', customer: 'cus_mock_1' } },
    });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const subRow = get('SELECT * FROM subscriptions WHERE account_id = 1');
    expect(subRow.status).toBe('active');
    expect(subRow.plan).toBe('pro');
    expect(subRow.stripe_subscription_id).toBe('sub_mock_1');

    const paidEvent = get(`SELECT * FROM product_events WHERE event = 'paid' AND account_id = 1`);
    expect(paidEvent).toBeTruthy();
  });

  test('idempotence : le même event.id rejoué ne réapplique rien', async () => {
    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      status: 'active', current_period_end: 1830297600, metadata: { account_id: '1' },
    });
    const event = {
      id: 'evt_test_dup',
      type: 'checkout.session.completed',
      data: { object: { metadata: { account_id: '1' }, subscription: 'sub_mock_1', customer: 'cus_mock_1' } },
    };

    await postWebhook(event);
    const res2 = await postWebhook(event);

    expect(res2.status).toBe(200);
    expect(res2.body.duplicate).toBe(true);
    expect(mockStripeClient.subscriptions.retrieve).toHaveBeenCalledTimes(1);
  });

  test('invoice.payment_failed → status past_due', async () => {
    run(`INSERT INTO subscriptions (account_id, stripe_customer_id, stripe_subscription_id, status, plan)
         VALUES (1, 'cus_mock_1', 'sub_mock_1', 'active', 'pro')`);

    const res = await postWebhook({
      id: 'evt_test_fail',
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_mock_1' } },
    });

    expect(res.status).toBe(200);
    expect(get('SELECT status FROM subscriptions WHERE account_id = 1').status).toBe('past_due');
  });
});
