'use strict';

// Supplier portal v5 — multi-tenant supplier identity (email-based) and the
// reference search on /historique. The identity logic lets one supplier login
// see Mes clients across multiple restaurant tenants; this is the
// `getSupplierIdentities()` helper in routes/supplier-portal.js.

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { run, get, all } = require('../db');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// Create a single tenant + Metro supplier row sharing the given email +
// supplier_account row for that tenant. Returns the session details
// (token, supplier_id, restaurant_id) of the supplier_account in that tenant.
function createTenantWithSharedSupplier(email, opts = {}) {
  const tag = Math.random().toString(36).slice(2, 8);
  const restaurantId = run(
    `INSERT INTO restaurants (name, type, plan)
     VALUES (?, 'brasserie', 'pro')`,
    [opts.restaurantName || `Resto ${tag}`]
  ).lastInsertRowid;
  const supplierId = run(
    `INSERT INTO suppliers (name, email, restaurant_id)
     VALUES (?, ?, ?)`,
    ['Shared Vendor', email, restaurantId]
  ).lastInsertRowid;
  const raw = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  run(
    `INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin, token_hash, token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [restaurantId, supplierId, 'Shared Member', email, 'unused', hashToken(raw), expiresAt]
  );
  return { token: raw, supplier_id: supplierId, restaurant_id: restaurantId };
}

// Set up a 3-tenant identity: same email, three restaurants, three suppliers
// rows. The session returned authenticates against the FIRST tenant's
// supplier_account; identity expansion should surface the other 2 too.
function createMultiTenantIdentity() {
  const email = `vendor-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const a = createTenantWithSharedSupplier(email, { restaurantName: 'Tenant A' });
  // For tenants B and C we don't need a session of our own — just the
  // suppliers row sharing the email. We re-use createTenantWithSharedSupplier
  // and discard the token.
  const b = createTenantWithSharedSupplier(email, { restaurantName: 'Tenant B' });
  const c = createTenantWithSharedSupplier(email, { restaurantName: 'Tenant C' });
  return { email, a, b, c };
}

function seedOrder(supplierId, restaurantId, opts = {}) {
  const ref = opts.reference || `PO-${Math.random().toString(36).slice(2, 8)}`;
  const total = opts.total ?? 100;
  const status = opts.status || 'livrée';
  const created = opts.createdAt || null;
  const orderId = run(
    `INSERT INTO purchase_orders (supplier_id, reference, total_amount, status, restaurant_id${created ? ', created_at' : ''})
     VALUES (?, ?, ?, ?, ?${created ? ', ?' : ''})`,
    created
      ? [supplierId, ref, total, status, restaurantId, created]
      : [supplierId, ref, total, status, restaurantId]
  ).lastInsertRowid;
  for (const it of (opts.items || [])) {
    run(
      `INSERT INTO purchase_order_items (purchase_order_id, restaurant_id, ingredient_id, product_name, quantity, unit, unit_price, total_price)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
      [orderId, restaurantId, it.product_name, it.quantity, it.unit || 'kg', it.unit_price, it.unit_price * it.quantity]
    );
  }
  return orderId;
}

// ─── Identity expansion: /clients ──────────────────────────────────────────

describe('Identity expansion across tenants', () => {
  it('GET /clients returns one row per identity tenant', async () => {
    const { a, b, c } = createMultiTenantIdentity();
    seedOrder(a.supplier_id, a.restaurant_id, { total: 100 });
    seedOrder(b.supplier_id, b.restaurant_id, { total: 200 });
    seedOrder(c.supplier_id, c.restaurant_id, { total: 50 });

    const res = await request(app)
      .get('/api/supplier-portal/clients')
      .set('X-Supplier-Token', a.token);
    expect(res.status).toBe(200);
    // 3 restaurants returned (one per identity tenant).
    expect(res.body).toHaveLength(3);
    const totals = Object.fromEntries(res.body.map(c => [c.restaurant_id, c.total_revenue]));
    expect(totals[a.restaurant_id]).toBe(100);
    expect(totals[b.restaurant_id]).toBe(200);
    expect(totals[c.restaurant_id]).toBe(50);
  });

  it('GET /clients/:rid returns drill-in for any identity tenant', async () => {
    const { a, b } = createMultiTenantIdentity();
    seedOrder(b.supplier_id, b.restaurant_id, {
      total: 60,
      items: [{ product_name: 'Carotte', quantity: 5, unit: 'kg', unit_price: 1.50 }],
    });
    // Logged in as A, drill into B → should work (identity expansion).
    const res = await request(app)
      .get(`/api/supplier-portal/clients/${b.restaurant_id}`)
      .set('X-Supplier-Token', a.token);
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe(b.restaurant_id);
    expect(res.body.summary.orders_count).toBe(1);
  });

  it('GET /clients/:rid still 404s for outside-identity restaurants', async () => {
    const { a } = createMultiTenantIdentity();
    // A different identity entirely — different email
    const other = createTenantWithSharedSupplier('other@example.com', { restaurantName: 'Outside' });
    const res = await request(app)
      .get(`/api/supplier-portal/clients/${other.restaurant_id}`)
      .set('X-Supplier-Token', a.token);
    expect(res.status).toBe(404);
  });

  it('GET /dashboard aggregates across identity tenants (revenue is confirmed+delivered only)', async () => {
    const { a, b, c } = createMultiTenantIdentity();
    seedOrder(a.supplier_id, a.restaurant_id, { total: 100, status: 'livrée' });
    seedOrder(b.supplier_id, b.restaurant_id, { total: 200, status: 'envoyée' }); // doesn't count
    seedOrder(c.supplier_id, c.restaurant_id, { total: 50,  status: 'livrée' });
    const res = await request(app)
      .get('/api/supplier-portal/dashboard')
      .set('X-Supplier-Token', a.token);
    expect(res.status).toBe(200);
    expect(res.body.revenue_total).toBe(150); // 100 + 50, the 'envoyée' doesn't count
    expect(res.body.orders_total).toBe(3);
    expect(res.body.active_clients).toBe(3); // distinct restaurant_ids
    expect(res.body.pending_alerts).toHaveLength(1);
  });

  it('GET /historique spans identity tenants', async () => {
    const { a, b, c } = createMultiTenantIdentity();
    seedOrder(a.supplier_id, a.restaurant_id, { total: 100 });
    seedOrder(b.supplier_id, b.restaurant_id, { total: 200 });
    seedOrder(c.supplier_id, c.restaurant_id, { total: 50 });
    const res = await request(app)
      .get('/api/supplier-portal/historique')
      .set('X-Supplier-Token', a.token);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(3);
    expect(res.body.totals).toMatchObject({ count: 3, revenue_ht: 350 });
  });

  it('GET /historique?restaurant_id=X is allowed only for identity tenants', async () => {
    const { a, b } = createMultiTenantIdentity();
    seedOrder(b.supplier_id, b.restaurant_id, { total: 200 });
    // Inside identity → returns the rows
    const ok = await request(app)
      .get(`/api/supplier-portal/historique?restaurant_id=${b.restaurant_id}`)
      .set('X-Supplier-Token', a.token);
    expect(ok.body.orders).toHaveLength(1);
    // Outside identity → empty
    const other = createTenantWithSharedSupplier('other@example.com');
    const ko = await request(app)
      .get(`/api/supplier-portal/historique?restaurant_id=${other.restaurant_id}`)
      .set('X-Supplier-Token', a.token);
    expect(ko.body.orders).toHaveLength(0);
  });

  it('GET /orders/pending-count counts across identity tenants', async () => {
    const { a, b } = createMultiTenantIdentity();
    seedOrder(a.supplier_id, a.restaurant_id, { status: 'envoyée' });
    seedOrder(b.supplier_id, b.restaurant_id, { status: 'brouillon' });
    seedOrder(b.supplier_id, b.restaurant_id, { status: 'livrée' });
    const res = await request(app)
      .get('/api/supplier-portal/orders/pending-count')
      .set('X-Supplier-Token', a.token);
    expect(res.body.count).toBe(2);
  });

  it('PUT /orders/:id/confirm works on an order in a sibling identity tenant', async () => {
    const { a, b } = createMultiTenantIdentity();
    const oId = seedOrder(b.supplier_id, b.restaurant_id, { status: 'envoyée' });
    const res = await request(app)
      .put(`/api/supplier-portal/orders/${oId}/confirm`)
      .set('X-Supplier-Token', a.token)
      .send({ reason: 'cross-tenant ok' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'confirmée' });
  });

  it('GET /orders/:id 404s for orders outside the identity', async () => {
    const { a } = createMultiTenantIdentity();
    const other = createTenantWithSharedSupplier('other@example.com');
    const oId = seedOrder(other.supplier_id, other.restaurant_id);
    const res = await request(app)
      .get(`/api/supplier-portal/orders/${oId}`)
      .set('X-Supplier-Token', a.token);
    expect(res.status).toBe(404);
  });
});

// ─── /historique?q= reference search ────────────────────────────────────────

describe('GET /api/supplier-portal/historique?q=<reference>', () => {
  it('filters by partial, case-insensitive reference match', async () => {
    const s = createTenantWithSharedSupplier(`ref-${Math.random().toString(36).slice(2, 8)}@example.com`);
    seedOrder(s.supplier_id, s.restaurant_id, { reference: 'PO-2026-001', total: 10 });
    seedOrder(s.supplier_id, s.restaurant_id, { reference: 'PO-2026-042', total: 20 });
    seedOrder(s.supplier_id, s.restaurant_id, { reference: 'OTHER-XYZ',   total: 30 });

    const r1 = await request(app)
      .get('/api/supplier-portal/historique?q=2026')
      .set('X-Supplier-Token', s.token);
    expect(r1.body.orders).toHaveLength(2);

    const r2 = await request(app)
      .get('/api/supplier-portal/historique?q=042')
      .set('X-Supplier-Token', s.token);
    expect(r2.body.orders).toHaveLength(1);
    expect(r2.body.orders[0].reference).toBe('PO-2026-042');

    // Case-insensitive
    const r3 = await request(app)
      .get('/api/supplier-portal/historique?q=other')
      .set('X-Supplier-Token', s.token);
    expect(r3.body.orders).toHaveLength(1);
    expect(r3.body.orders[0].reference).toBe('OTHER-XYZ');

    // No match → empty
    const r4 = await request(app)
      .get('/api/supplier-portal/historique?q=nope')
      .set('X-Supplier-Token', s.token);
    expect(r4.body.orders).toHaveLength(0);
  });
});
