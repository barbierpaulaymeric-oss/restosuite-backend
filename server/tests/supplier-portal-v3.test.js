'use strict';

// Supplier portal v3 — historique feed, stats panel, client price overrides,
// and the buffered-PDF fix that unblocks BL downloads in production.

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { run, get, all } = require('../db');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function createSupplierSession() {
  const tag = Math.random().toString(36).slice(2, 8);
  const restaurantId = run(
    `INSERT INTO restaurants (name, type, plan, address, city, postal_code, phone)
     VALUES (?, 'brasserie', 'pro', '42 rue de Test', 'Paris', '75011', '01 23 45 67 89')`,
    [`Test Resto ${tag}`]
  ).lastInsertRowid;
  const supplierId = run(
    `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
    [`Test Supplier ${tag}`, restaurantId]
  ).lastInsertRowid;
  const raw = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  run(
    `INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin, token_hash, token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [restaurantId, supplierId, 'Test Member', `t-${tag}@example.com`, 'unused', hashToken(raw), expiresAt]
  );
  return { token: raw, supplier_id: supplierId, restaurant_id: restaurantId };
}

function seedOrder(session, opts = {}) {
  const ref = opts.reference || `PO-V3-${Math.random().toString(36).slice(2, 8)}`;
  const total = opts.total ?? 100;
  const status = opts.status || 'livrée';
  const createdAt = opts.createdAt || null;
  const orderId = run(
    `INSERT INTO purchase_orders (supplier_id, reference, notes, total_amount, expected_delivery, status, restaurant_id${createdAt ? ', created_at' : ''})
     VALUES (?, ?, ?, ?, ?, ?, ?${createdAt ? ', ?' : ''})`,
    createdAt
      ? [session.supplier_id, ref, opts.notes || null, total, null, status, session.restaurant_id, createdAt]
      : [session.supplier_id, ref, opts.notes || null, total, null, status, session.restaurant_id]
  ).lastInsertRowid;
  for (const it of (opts.items || [])) {
    run(
      `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_name, quantity, unit, unit_price, total_price, notes, restaurant_id)
       VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?)`,
      [orderId, it.product_name, it.quantity, it.unit || 'kg', it.unit_price, it.unit_price * it.quantity, session.restaurant_id]
    );
  }
  return orderId;
}

// ─── /historique ────────────────────────────────────────────────────────────

describe('GET /api/supplier-portal/historique', () => {
  it('returns 401 without supplier token', async () => {
    const res = await request(app).get('/api/supplier-portal/historique');
    expect(res.status).toBe(401);
  });

  it('returns chronological orders with totals', async () => {
    const s = createSupplierSession();
    seedOrder(s, { total: 50, status: 'livrée' });
    seedOrder(s, { total: 80, status: 'envoyée' });

    const res = await request(app)
      .get('/api/supplier-portal/historique')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.totals).toMatchObject({ count: 2, revenue_ht: 130 });
    // newest first
    expect(new Date(res.body.orders[0].created_at).getTime())
      .toBeGreaterThanOrEqual(new Date(res.body.orders[1].created_at).getTime());
  });

  it('filters by date range', async () => {
    const s = createSupplierSession();
    seedOrder(s, { total: 10, createdAt: '2026-01-15 10:00:00' });
    seedOrder(s, { total: 20, createdAt: '2026-03-15 10:00:00' });
    seedOrder(s, { total: 30, createdAt: '2026-04-15 10:00:00' });

    const res = await request(app)
      .get('/api/supplier-portal/historique?from=2026-03-01&to=2026-03-31')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.totals.revenue_ht).toBe(20);
  });

  it('returns empty when filtered by a non-bound restaurant_id', async () => {
    const s = createSupplierSession();
    seedOrder(s, { total: 50 });
    const res = await request(app)
      .get('/api/supplier-portal/historique?restaurant_id=999999')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(0);
    expect(res.body.totals).toEqual({ count: 0, revenue_ht: 0 });
  });
});

// ─── /stats ────────────────────────────────────────────────────────────────

describe('GET /api/supplier-portal/stats', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/supplier-portal/stats');
    expect(res.status).toBe(401);
  });

  it('returns empty stats for a brand-new supplier', async () => {
    const s = createSupplierSession();
    const res = await request(app).get('/api/supplier-portal/stats').set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      top_products: [],
      revenue_by_month: [],
      revenue_by_category: [],
    });
  });

  it('aggregates top products + monthly revenue + category revenue', async () => {
    const s = createSupplierSession();
    // Catalog rows so the LEFT JOIN in /stats has category data.
    run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, category, unit, price)
       VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
      [
        s.supplier_id, s.restaurant_id, 'Carotte', 'Légumes', 'kg', 1.50,
        s.supplier_id, s.restaurant_id, 'Bavette', 'Viandes', 'kg', 16.50,
      ]
    );
    seedOrder(s, {
      total: 30,
      createdAt: '2026-03-15 10:00:00',
      items: [
        { product_name: 'Carotte', quantity: 10, unit: 'kg', unit_price: 1.50 },
        { product_name: 'Bavette', quantity: 1,  unit: 'kg', unit_price: 16.50 },
      ],
    });
    seedOrder(s, {
      total: 50,
      createdAt: '2026-04-15 10:00:00',
      items: [
        { product_name: 'Carotte', quantity: 20, unit: 'kg', unit_price: 1.50 }, // = 30
        { product_name: 'Inconnu', quantity: 1,  unit: 'kg', unit_price: 5.00 },  // → Autre
      ],
    });

    const res = await request(app).get('/api/supplier-portal/stats').set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);

    // Top products: Carotte revenue = 15 + 30 = 45 — beats Bavette (16.5).
    expect(res.body.top_products[0].product_name).toBe('Carotte');
    expect(res.body.top_products[0].revenue).toBe(45);

    // Two months in the bucket.
    expect(res.body.revenue_by_month).toHaveLength(2);
    expect(res.body.revenue_by_month[0].month).toBe('2026-03');

    // Categories: Légumes leads (45), then Viandes, then Autre.
    const cats = res.body.revenue_by_category.map(c => c.category);
    expect(cats).toContain('Légumes');
    expect(cats).toContain('Viandes');
    expect(cats).toContain('Autre');
  });
});

// ─── /clients/:rid/catalog with override prices ─────────────────────────────

describe('GET /api/supplier-portal/clients/:rid/catalog', () => {
  it('returns 404 cross-tenant', async () => {
    const s = createSupplierSession();
    const res = await request(app).get('/api/supplier-portal/clients/999999/catalog').set('X-Supplier-Token', s.token);
    expect(res.status).toBe(404);
  });

  it('joins each catalog row with the active override (or nulls)', async () => {
    const s = createSupplierSession();
    const cId = run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, category, unit, price)
       VALUES (?, ?, 'Carotte', 'Légumes', 'kg', 1.50)`,
      [s.supplier_id, s.restaurant_id]
    ).lastInsertRowid;
    run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, category, unit, price)
       VALUES (?, ?, 'Pomme', 'Fruits', 'kg', 2.00)`,
      [s.supplier_id, s.restaurant_id]
    );
    run(
      `INSERT INTO client_price_overrides (supplier_id, restaurant_id, catalog_id, override_price, notes)
       VALUES (?, ?, ?, 1.20, 'volume discount')`,
      [s.supplier_id, s.restaurant_id, cId]
    );

    const res = await request(app)
      .get(`/api/supplier-portal/clients/${s.restaurant_id}/catalog`)
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const carotte = res.body.find(r => r.product_name === 'Carotte');
    expect(carotte.standard_price).toBe(1.50);
    expect(carotte.override_price).toBe(1.20);
    const pomme = res.body.find(r => r.product_name === 'Pomme');
    expect(pomme.override_price).toBeNull();
  });
});

describe('PUT /api/supplier-portal/clients/:rid/price-overrides/:catalogId', () => {
  it('upserts an override, then clears it on null', async () => {
    const s = createSupplierSession();
    const cId = run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, unit, price)
       VALUES (?, ?, 'Sel', 'kg', 3.00)`,
      [s.supplier_id, s.restaurant_id]
    ).lastInsertRowid;

    const set = await request(app)
      .put(`/api/supplier-portal/clients/${s.restaurant_id}/price-overrides/${cId}`)
      .set('X-Supplier-Token', s.token)
      .send({ price: 2.40, notes: 'B2B' });
    expect(set.status).toBe(200);
    let row = get(
      'SELECT override_price FROM client_price_overrides WHERE catalog_id = ?',
      [cId]
    );
    expect(row.override_price).toBe(2.40);

    // Update again — same UNIQUE row gets bumped, no duplicate.
    await request(app)
      .put(`/api/supplier-portal/clients/${s.restaurant_id}/price-overrides/${cId}`)
      .set('X-Supplier-Token', s.token)
      .send({ price: 2.10 });
    row = get(
      'SELECT COUNT(*) AS c FROM client_price_overrides WHERE catalog_id = ?',
      [cId]
    );
    expect(row.c).toBe(1);

    // Clear with null.
    const clear = await request(app)
      .put(`/api/supplier-portal/clients/${s.restaurant_id}/price-overrides/${cId}`)
      .set('X-Supplier-Token', s.token)
      .send({ price: null });
    expect(clear.status).toBe(200);
    row = get(
      'SELECT COUNT(*) AS c FROM client_price_overrides WHERE catalog_id = ?',
      [cId]
    );
    expect(row.c).toBe(0);
  });

  it('returns 404 when the catalog id belongs to another supplier', async () => {
    const a = createSupplierSession();
    const b = createSupplierSession();
    const cId = run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, unit, price)
       VALUES (?, ?, 'Sel', 'kg', 3.00)`,
      [a.supplier_id, a.restaurant_id]
    ).lastInsertRowid;
    const res = await request(app)
      .put(`/api/supplier-portal/clients/${b.restaurant_id}/price-overrides/${cId}`)
      .set('X-Supplier-Token', b.token)
      .send({ price: 1.00 });
    expect(res.status).toBe(404);
  });

  it('rejects invalid price', async () => {
    const s = createSupplierSession();
    const cId = run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, unit, price)
       VALUES (?, ?, 'Sel', 'kg', 3.00)`,
      [s.supplier_id, s.restaurant_id]
    ).lastInsertRowid;
    const res = await request(app)
      .put(`/api/supplier-portal/clients/${s.restaurant_id}/price-overrides/${cId}`)
      .set('X-Supplier-Token', s.token)
      .send({ price: -1 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/supplier-portal/clients/:rid/price-overrides/:catalogId', () => {
  it('removes an existing override', async () => {
    const s = createSupplierSession();
    const cId = run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, unit, price)
       VALUES (?, ?, 'Sel', 'kg', 3.00)`,
      [s.supplier_id, s.restaurant_id]
    ).lastInsertRowid;
    run(
      `INSERT INTO client_price_overrides (supplier_id, restaurant_id, catalog_id, override_price)
       VALUES (?, ?, ?, 2.40)`,
      [s.supplier_id, s.restaurant_id, cId]
    );
    const res = await request(app)
      .delete(`/api/supplier-portal/clients/${s.restaurant_id}/price-overrides/${cId}`)
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    const row = get(
      'SELECT COUNT(*) AS c FROM client_price_overrides WHERE catalog_id = ?',
      [cId]
    );
    expect(row.c).toBe(0);
  });
});

// ─── PDF buffer fix ─────────────────────────────────────────────────────────

describe('GET /api/supplier-portal/delivery-notes/:id/pdf — buffered + Content-Length', () => {
  it('streams a PDF with explicit Content-Length so compression() never gzips it', async () => {
    const s = createSupplierSession();
    const noteId = run(
      `INSERT INTO delivery_notes (restaurant_id, supplier_id, delivery_date, total_amount, notes)
       VALUES (?, ?, '2026-04-27', 42.50, 'PDF buffer test')`,
      [s.restaurant_id, s.supplier_id]
    ).lastInsertRowid;
    run(
      `INSERT INTO delivery_note_items
         (restaurant_id, delivery_note_id, ingredient_id, product_name, quantity, unit, price_per_unit, batch_number, dlc, temperature_required)
       VALUES (?, ?, NULL, 'Carotte', 5, 'kg', 1.50, 'B-001', '2026-05-15', 4)`,
      [s.restaurant_id, noteId]
    );

    const res = await request(app)
      .get(`/api/supplier-portal/delivery-notes/${noteId}/pdf`)
      .set('X-Supplier-Token', s.token)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', c => chunks.push(c));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    // Buffered fix: Content-Length is now explicit and matches the body size.
    const cl = Number(res.headers['content-length']);
    expect(Number.isFinite(cl)).toBe(true);
    expect(cl).toBe(res.body.length);
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
