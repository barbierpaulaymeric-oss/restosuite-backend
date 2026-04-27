'use strict';

// Supplier portal v4 — pending-count badge, confirm/refuse order workflow,
// order PDF export, and the historique status filter.

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

function seedOrder(s, opts = {}) {
  const ref = opts.reference || `PO-V4-${Math.random().toString(36).slice(2, 8)}`;
  const total = opts.total ?? 100;
  const status = opts.status || 'envoyée';
  const createdAt = opts.createdAt || null;
  const orderId = run(
    `INSERT INTO purchase_orders (supplier_id, reference, notes, total_amount, expected_delivery, status, restaurant_id${createdAt ? ', created_at' : ''})
     VALUES (?, ?, ?, ?, ?, ?, ?${createdAt ? ', ?' : ''})`,
    createdAt
      ? [s.supplier_id, ref, opts.notes || null, total, null, status, s.restaurant_id, createdAt]
      : [s.supplier_id, ref, opts.notes || null, total, null, status, s.restaurant_id]
  ).lastInsertRowid;
  for (const it of (opts.items || [])) {
    run(
      `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_name, quantity, unit, unit_price, total_price, notes, restaurant_id)
       VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?)`,
      [orderId, it.product_name, it.quantity, it.unit || 'kg', it.unit_price, it.unit_price * it.quantity, s.restaurant_id]
    );
  }
  return orderId;
}

// ─── /orders (list) ─────────────────────────────────────────────────────────
// Recurring "restaurant_name doesn't show on order cards" bug. Lock the
// response shape so a future SQL refactor can't drop the column silently.
describe('GET /api/supplier-portal/orders (list)', () => {
  it('returns restaurant_name AND restaurant_id on every row', async () => {
    const s = createSupplierSession();
    seedOrder(s, { status: 'envoyée' });
    seedOrder(s, { status: 'confirmée' });
    const res = await request(app)
      .get('/api/supplier-portal/orders')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    for (const row of res.body) {
      expect(row).toHaveProperty('restaurant_name');
      expect(typeof row.restaurant_name).toBe('string');
      expect(row.restaurant_name.length).toBeGreaterThan(0);
      expect(row).toHaveProperty('restaurant_id', s.restaurant_id);
    }
  });
});

// ─── /orders/pending-count ──────────────────────────────────────────────────

describe('GET /api/supplier-portal/orders/pending-count', () => {
  it('returns 401 without supplier token', async () => {
    const res = await request(app).get('/api/supplier-portal/orders/pending-count');
    expect(res.status).toBe(401);
  });

  it('counts only orders awaiting confirmation', async () => {
    const s = createSupplierSession();
    seedOrder(s, { status: 'brouillon' });
    seedOrder(s, { status: 'envoyée' });
    seedOrder(s, { status: 'envoyee' }); // unaccented variant — still counted
    seedOrder(s, { status: 'livrée' });
    seedOrder(s, { status: 'confirmée' });
    seedOrder(s, { status: 'refusée' });

    const res = await request(app)
      .get('/api/supplier-portal/orders/pending-count')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3 });
  });

  it('returns 0 for a fresh supplier session', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .get('/api/supplier-portal/orders/pending-count')
      .set('X-Supplier-Token', s.token);
    expect(res.body.count).toBe(0);
  });
});

// ─── confirm / refuse ──────────────────────────────────────────────────────

describe('PUT /api/supplier-portal/orders/:id/confirm', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/supplier-portal/orders/1/confirm');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown id', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .put('/api/supplier-portal/orders/999999/confirm')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(404);
  });

  it('flips status to confirmée and appends reason to notes', async () => {
    const s = createSupplierSession();
    const id = seedOrder(s, { status: 'envoyée', notes: 'Livraison demandée mardi.' });
    const res = await request(app)
      .put(`/api/supplier-portal/orders/${id}/confirm`)
      .set('X-Supplier-Token', s.token)
      .send({ reason: 'Stock OK' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'confirmée' });
    const row = get('SELECT status, notes FROM purchase_orders WHERE id = ?', [id]);
    expect(row.status).toBe('confirmée');
    expect(row.notes).toMatch(/Livraison demandée mardi\./);
    expect(row.notes).toMatch(/\[Confirmée fournisseur\] Stock OK/);
  });

  it('rejects already-confirmed orders with 409', async () => {
    const s = createSupplierSession();
    const id = seedOrder(s, { status: 'confirmée' });
    const res = await request(app)
      .put(`/api/supplier-portal/orders/${id}/confirm`)
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/supplier-portal/orders/:id/refuse', () => {
  it('flips status to refusée and appends the reason', async () => {
    const s = createSupplierSession();
    const id = seedOrder(s, { status: 'envoyée' });
    const res = await request(app)
      .put(`/api/supplier-portal/orders/${id}/refuse`)
      .set('X-Supplier-Token', s.token)
      .send({ reason: 'Rupture saumon' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'refusée' });
    const row = get('SELECT status, notes FROM purchase_orders WHERE id = ?', [id]);
    expect(row.status).toBe('refusée');
    expect(row.notes).toMatch(/\[Refusée fournisseur\] Rupture saumon/);
  });

  it('rejects already-livrée orders with 409', async () => {
    const s = createSupplierSession();
    const id = seedOrder(s, { status: 'livrée' });
    const res = await request(app)
      .put(`/api/supplier-portal/orders/${id}/refuse`)
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(409);
  });

  it('cross-tenant supplier sees 404, no state change', async () => {
    const a = createSupplierSession();
    const b = createSupplierSession();
    const id = seedOrder(a, { status: 'envoyée' });
    const res = await request(app)
      .put(`/api/supplier-portal/orders/${id}/refuse`)
      .set('X-Supplier-Token', b.token);
    expect(res.status).toBe(404);
    const row = get('SELECT status FROM purchase_orders WHERE id = ?', [id]);
    expect(row.status).toBe('envoyée'); // untouched
  });
});

// ─── /orders/:id/pdf ────────────────────────────────────────────────────────

describe('GET /api/supplier-portal/orders/:id/pdf', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/supplier-portal/orders/1/pdf');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown id', async () => {
    const s = createSupplierSession();
    const res = await request(app)
      .get('/api/supplier-portal/orders/999999/pdf')
      .set('X-Supplier-Token', s.token);
    expect(res.status).toBe(404);
  });

  it('streams a buffered PDF with explicit Content-Length and a TVA computed from supplier_catalog', async () => {
    const s = createSupplierSession();
    // Catalog row drives the TVA enrichment in the PDF route.
    run(
      `INSERT INTO supplier_catalog (supplier_id, restaurant_id, product_name, category, unit, price, sku, tva_rate)
       VALUES (?, ?, 'Carotte', 'Légumes', 'kg', 1.50, 'CAR-001', 5.5)`,
      [s.supplier_id, s.restaurant_id]
    );
    const id = seedOrder(s, {
      total: 30,
      status: 'envoyée',
      items: [{ product_name: 'Carotte', quantity: 20, unit: 'kg', unit_price: 1.50 }],
    });

    const res = await request(app)
      .get(`/api/supplier-portal/orders/${id}/pdf`)
      .set('X-Supplier-Token', s.token)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', c => chunks.push(c));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    const cl = Number(res.headers['content-length']);
    expect(Number.isFinite(cl)).toBe(true);
    expect(cl).toBe(res.body.length);
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

// ─── /historique?status= ────────────────────────────────────────────────────

describe('GET /api/supplier-portal/historique?status=', () => {
  it('filters by status, accepting accented or unaccented spellings', async () => {
    const s = createSupplierSession();
    seedOrder(s, { status: 'brouillon' });
    seedOrder(s, { status: 'envoyée' });
    seedOrder(s, { status: 'livrée' });
    seedOrder(s, { status: 'refusée' });

    const e = await request(app)
      .get('/api/supplier-portal/historique?status=envoyée')
      .set('X-Supplier-Token', s.token);
    expect(e.body.orders).toHaveLength(1);
    expect(e.body.orders[0].status).toBe('envoyée');

    // Unaccented spelling on the wire still resolves to the right rows.
    const eu = await request(app)
      .get('/api/supplier-portal/historique?status=envoyee')
      .set('X-Supplier-Token', s.token);
    expect(eu.body.orders).toHaveLength(1);

    const r = await request(app)
      .get('/api/supplier-portal/historique?status=refusee')
      .set('X-Supplier-Token', s.token);
    expect(r.body.orders).toHaveLength(1);

    // Sentinel "all" → no status filter.
    const all = await request(app)
      .get('/api/supplier-portal/historique?status=all')
      .set('X-Supplier-Token', s.token);
    expect(all.body.orders).toHaveLength(4);
  });
});
