'use strict';

// Supplier portal v6 — CA-on-confirmation regression tests.
// User report: "CA total on supplier dashboard should update when a commande
// is confirmed (not just at delivery)". Drafts/refusals/cancellations stay
// excluded; confirmed + delivered count.

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { run } = require('../db');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function createSupplierSession() {
  const tag = Math.random().toString(36).slice(2, 8);
  const restaurantId = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Resto ${tag}`]
  ).lastInsertRowid;
  const supplierId = run(
    `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
    [`Supplier ${tag}`, restaurantId]
  ).lastInsertRowid;
  const raw = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  run(
    `INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin, token_hash, token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [restaurantId, supplierId, 'Member', `m-${tag}@example.com`, 'unused', hashToken(raw), expiresAt]
  );
  return { token: raw, supplier_id: supplierId, restaurant_id: restaurantId };
}

function seedOrder(s, opts) {
  const orderId = run(
    `INSERT INTO purchase_orders (supplier_id, reference, total_amount, status, restaurant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      s.supplier_id,
      opts.reference || `PO-${Math.random().toString(36).slice(2, 8)}`,
      opts.total,
      opts.status,
      s.restaurant_id,
    ]
  ).lastInsertRowid;
  return orderId;
}

describe('Dashboard CA total reacts to status transitions', () => {
  it('excludes brouillon, envoyée, refusée, annulée from revenue', async () => {
    const s = createSupplierSession();
    seedOrder(s, { total: 100, status: 'brouillon' });
    seedOrder(s, { total: 200, status: 'envoyée' });
    seedOrder(s, { total: 300, status: 'refusée' });
    seedOrder(s, { total: 400, status: 'annulée' });
    const res = await request(app)
      .get('/api/supplier-portal/dashboard')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body.revenue_total).toBe(0);
    expect(res.body.orders_total).toBe(4);
  });

  it('includes confirmée and livrée in revenue (and unaccented variants)', async () => {
    const s = createSupplierSession();
    seedOrder(s, { total: 100, status: 'confirmée' });
    seedOrder(s, { total: 50,  status: 'livrée' });
    seedOrder(s, { total: 25,  status: 'confirmee' }); // unaccented variant
    seedOrder(s, { total: 10,  status: 'livree' });    // unaccented variant
    const res = await request(app)
      .get('/api/supplier-portal/dashboard')
      .set('X-Supplier-Token', s.token);
    expect(res.body.revenue_total).toBe(185);
  });

  it('CA bumps the moment an order moves from envoyée to confirmée', async () => {
    const s = createSupplierSession();
    const id = seedOrder(s, { total: 200, status: 'envoyée' });

    let r1 = await request(app).get('/api/supplier-portal/dashboard').set('X-Supplier-Token', s.token);
    expect(r1.body.revenue_total).toBe(0);

    // Supplier confirms via the existing PUT /orders/:id/confirm endpoint.
    const c = await request(app)
      .put(`/api/supplier-portal/orders/${id}/confirm`)
      .set('X-Supplier-Token', s.token);
    expect(c.status).toBe(200);

    let r2 = await request(app).get('/api/supplier-portal/dashboard').set('X-Supplier-Token', s.token);
    expect(r2.body.revenue_total).toBe(200);
  });
});
