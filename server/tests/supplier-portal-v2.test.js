'use strict';

// Supplier portal v2 — dashboard, clients, notifications, BL PDF, and the
// SKU/TVA/packaging extensions on /catalog + /import-mercuriale + /save-mercuriale.
// All endpoints sit behind requireSupplierAuth (X-Supplier-Token header).

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { run, get, all } = require('../db');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// Spin up a tenant + supplier + supplier_account and return a usable session.
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
    [restaurantId, supplierId, 'Test Member', `test-${tag}@example.com`, 'unused', hashToken(raw), expiresAt]
  );
  return { token: raw, supplier_id: supplierId, restaurant_id: restaurantId };
}

function seedOrder(session, opts = {}) {
  const ref = opts.reference || `PO-TEST-${Math.random().toString(36).slice(2, 8)}`;
  const total = opts.total ?? 100;
  const status = opts.status || 'envoyée';
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

// ─── /catalog with SKU/TVA/packaging ────────────────────────────────────────

describe('POST /api/supplier-portal/catalog with new columns', () => {
  it('persists sku, tva_rate, and packaging on insert', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .post('/api/supplier-portal/catalog')
      .set('X-Supplier-Token', s.token)
      .send({
        product_name: 'Test Beurre',
        category: 'Produits laitiers',
        unit: 'kg',
        price: 8.50,
        sku: 'TEST-BEU-001',
        tva_rate: 5.5,
        packaging: 'Plaque 5 kg',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sku: 'TEST-BEU-001',
      tva_rate: 5.5,
      packaging: 'Plaque 5 kg',
    });
  });

  it('defaults tva_rate to 5.5 when omitted', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .post('/api/supplier-portal/catalog')
      .set('X-Supplier-Token', s.token)
      .send({ product_name: 'Sans TVA', unit: 'kg', price: 1 });
    expect(res.status).toBe(201);
    expect(res.body.tva_rate).toBe(5.5);
  });

  it('updates the new columns via PUT', async () => {
    const s = createSupplierSession();
    const created = await request(app)
      .post('/api/supplier-portal/catalog')
      .set('X-Supplier-Token', s.token)
      .send({ product_name: 'Vin rouge', unit: 'bouteille', price: 6, sku: 'OLD-001', tva_rate: 5.5 });
    const id = created.body.id;
    const updated = await request(app)
      .put(`/api/supplier-portal/catalog/${id}`)
      .set('X-Supplier-Token', s.token)
      .send({ price: 7, tva_rate: 20, packaging: 'Carton 6 bouteilles', sku: 'NEW-001' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      price: 7,
      tva_rate: 20,
      packaging: 'Carton 6 bouteilles',
      sku: 'NEW-001',
    });
  });
});

describe('POST /api/supplier-portal/save-mercuriale with SKU/packaging', () => {
  it('persists sku and packaging on insert', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', s.token)
      .send({
        items: [
          { name: 'Tomate', category: 'Légumes', unit: 'kg', price: 3, sku: 'IMP-001', packaging: 'Cagette 6 kg', tva_rate: 5.5 },
        ],
      });
    expect(res.status).toBe(201);
    const row = get(
      'SELECT sku, tva_rate, packaging FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ?',
      [s.supplier_id, s.restaurant_id]
    );
    expect(row).toMatchObject({ sku: 'IMP-001', tva_rate: 5.5, packaging: 'Cagette 6 kg' });
  });

  it('uses SKU as match key on subsequent imports (rename-safe)', async () => {
    const s = createSupplierSession();
    // First import.
    await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', s.token)
      .send({ items: [{ name: 'Old Name', unit: 'kg', price: 5, sku: 'STBL-001' }] });
    // Second import: same SKU, different name + price → should UPDATE, not INSERT.
    const res = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', s.token)
      .send({ items: [{ name: 'New Name', unit: 'kg', price: 7, sku: 'STBL-001' }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: 0, updated: 1 });
    const rows = all(
      'SELECT product_name, price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ?',
      [s.supplier_id, s.restaurant_id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ product_name: 'New Name', price: 7 });
  });
});

// ─── /dashboard ─────────────────────────────────────────────────────────────

describe('GET /api/supplier-portal/dashboard', () => {
  it('returns 401 without supplier token', async () => {
    const res = await request(app).get('/api/supplier-portal/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns zeros for a brand-new supplier', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .get('/api/supplier-portal/dashboard')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      revenue_total: 0,
      orders_total: 0,
      orders_this_month: 0,
      active_clients: 0,
    });
    expect(Array.isArray(res.body.recent_orders)).toBe(true);
    expect(Array.isArray(res.body.pending_alerts)).toBe(true);
  });

  it('aggregates revenue + counts pending orders as alerts', async () => {
    const s = createSupplierSession();
    seedOrder(s, { total: 50, status: 'livrée' });
    seedOrder(s, { total: 80, status: 'envoyée' });
    seedOrder(s, { total: 120, status: 'brouillon' });

    const res = await request(app)
      .get('/api/supplier-portal/dashboard')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body.revenue_total).toBe(250);
    expect(res.body.orders_total).toBe(3);
    expect(res.body.active_clients).toBe(1);
    // Two pending: status in (envoyée, brouillon)
    expect(res.body.pending_alerts).toHaveLength(2);
  });
});

// ─── /clients ───────────────────────────────────────────────────────────────

describe('GET /api/supplier-portal/clients', () => {
  it('returns 401 without supplier token', async () => {
    const res = await request(app).get('/api/supplier-portal/clients');
    expect(res.status).toBe(401);
  });

  it('lists the supplier\'s restaurants with order aggregates', async () => {
    const s = createSupplierSession();
    seedOrder(s, { total: 100 });
    seedOrder(s, { total: 200 });

    const res = await request(app)
      .get('/api/supplier-portal/clients')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      restaurant_id: s.restaurant_id,
      orders_count: 2,
      total_revenue: 300,
      avg_order_value: 150,
    });
  });
});

describe('GET /api/supplier-portal/clients/:restaurantId', () => {
  it('returns 404 for cross-tenant restaurant ids', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .get('/api/supplier-portal/clients/999999')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(404);
  });

  it('returns drill-in summary, recent orders, favorite products', async () => {
    const s = createSupplierSession();
    const order1 = seedOrder(s, {
      total: 60,
      items: [
        { product_name: 'Carotte', quantity: 5, unit: 'kg', unit_price: 1.50 },
        { product_name: 'Pomme', quantity: 3, unit: 'kg', unit_price: 2.00 },
      ],
    });
    const order2 = seedOrder(s, {
      total: 90,
      items: [
        { product_name: 'Carotte', quantity: 10, unit: 'kg', unit_price: 1.50 },
      ],
    });

    const res = await request(app)
      .get(`/api/supplier-portal/clients/${s.restaurant_id}`)
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe(s.restaurant_id);
    expect(res.body.summary.orders_count).toBe(2);
    expect(res.body.orders).toHaveLength(2);
    // Carotte is the heaviest favorite (15 kg total).
    expect(res.body.favorites[0]).toMatchObject({
      product_name: 'Carotte',
      total_quantity: 15,
      times_ordered: 2,
    });
  });

  it('exposes a single order via /clients/:rid/orders/:orderId', async () => {
    const s = createSupplierSession();
    const orderId = seedOrder(s, {
      items: [{ product_name: 'Sel', quantity: 1, unit: 'kg', unit_price: 1.20 }],
    });
    const res = await request(app)
      .get(`/api/supplier-portal/clients/${s.restaurant_id}/orders/${orderId}`)
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product_name).toBe('Sel');
  });
});

// ─── Supplier notifications ─────────────────────────────────────────────────

describe('Supplier notifications + order-creation hook', () => {
  it('returns 401 without supplier token', async () => {
    const res = await request(app).get('/api/supplier-portal/notifications/me');
    expect(res.status).toBe(401);
  });

  it('purchase-orders POST drops a supplier_notifications row', async () => {
    const s = createSupplierSession();
    // Authenticated gérant on the same tenant — purchase-orders requires JWT.
    const { authHeader } = require('./helpers/auth');
    const res = await request(app)
      .post('/api/purchase-orders')
      .set(authHeader({ restaurant_id: s.restaurant_id }))
      .send({
        supplier_id: s.supplier_id,
        items: [{ product_name: 'Carotte', quantity: 2, unit: 'kg', unit_price: 1.50 }],
      });
    expect(res.status).toBe(201);

    const notifRes = await request(app)
      .get('/api/supplier-portal/notifications/me')
      .set('X-Supplier-Token', s.token);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body).toHaveLength(1);
    expect(notifRes.body[0]).toMatchObject({ type: 'order_created', read: 0 });
    expect(notifRes.body[0].message).toMatch(/Nouvelle commande/);
  });

  it('unread-count + mark-as-read flow', async () => {
    const s = createSupplierSession();
    run(
      `INSERT INTO supplier_notifications (supplier_id, restaurant_id, type, message, read)
       VALUES (?, ?, 'order_created', 'Nouvelle commande X', 0)`,
      [s.supplier_id, s.restaurant_id]
    );
    const id = run(
      `INSERT INTO supplier_notifications (supplier_id, restaurant_id, type, message, read)
       VALUES (?, ?, 'order_created', 'Nouvelle commande Y', 0)`,
      [s.supplier_id, s.restaurant_id]
    ).lastInsertRowid;

    const before = await request(app)
      .get('/api/supplier-portal/notifications/me/unread-count')
      .set('X-Supplier-Token', s.token);
    expect(before.body.count).toBe(2);

    await request(app)
      .put(`/api/supplier-portal/notifications/me/${id}/read`)
      .set('X-Supplier-Token', s.token);

    const after = await request(app)
      .get('/api/supplier-portal/notifications/me/unread-count')
      .set('X-Supplier-Token', s.token);
    expect(after.body.count).toBe(1);
  });

  it('mark-as-read is tenant-scoped (404 across tenants)', async () => {
    const a = createSupplierSession();
    const b = createSupplierSession();
    const id = run(
      `INSERT INTO supplier_notifications (supplier_id, restaurant_id, type, message, read)
       VALUES (?, ?, 'order_created', 'Cross-tenant test', 0)`,
      [a.supplier_id, a.restaurant_id]
    ).lastInsertRowid;
    // b's token tries to mark a's notification → 404
    const res = await request(app)
      .put(`/api/supplier-portal/notifications/me/${id}/read`)
      .set('X-Supplier-Token', b.token);
    expect(res.status).toBe(404);
  });
});

// ─── BL PDF ─────────────────────────────────────────────────────────────────

describe('GET /api/supplier-portal/delivery-notes/:id/pdf', () => {
  it('returns 401 without supplier token', async () => {
    const res = await request(app).get('/api/supplier-portal/delivery-notes/1/pdf');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown delivery-note id', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .get('/api/supplier-portal/delivery-notes/999999/pdf')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(404);
  });

  it('streams a PDF for the supplier\'s own delivery note', async () => {
    const s = createSupplierSession();
    const noteId = run(
      `INSERT INTO delivery_notes (restaurant_id, supplier_id, delivery_date, total_amount, notes)
       VALUES (?, ?, '2026-04-27', 42.50, 'Test BL')`,
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
    // Every PDF starts with the magic "%PDF-" header.
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
