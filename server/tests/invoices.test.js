'use strict';

// Supplier invoice persistence + status workflow + reconciliation + tenancy.

const request = require('supertest');
const app = require('../app');
const { run, get, all } = require('../db');
const { authHeader } = require('./helpers/auth');

let RID_A, RID_B, SUP_A, SUP_B, ING_A;

function uniqTag() {
  return Math.random().toString(36).slice(2, 8);
}

beforeAll(() => {
  const tag = uniqTag();
  RID_A = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Inv Test A ${tag}`]
  ).lastInsertRowid;
  RID_B = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Inv Test B ${tag}`]
  ).lastInsertRowid;
  SUP_A = run(
    `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
    [`Sup A ${tag}`, RID_A]
  ).lastInsertRowid;
  SUP_B = run(
    `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
    [`Sup B ${tag}`, RID_B]
  ).lastInsertRowid;
  ING_A = run(
    `INSERT INTO ingredients (name, default_unit, restaurant_id) VALUES (?, 'kg', ?)`,
    [`Ing A ${tag}`, RID_A]
  ).lastInsertRowid;
});

function authA() { return authHeader({ id: 1, role: 'gerant', restaurant_id: RID_A }); }
function authB() { return authHeader({ id: 2, role: 'gerant', restaurant_id: RID_B }); }

describe('POST /api/invoices — manual create', () => {
  it('creates invoice with items and computes totals when totals omitted', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(authA())
      .send({
        supplier_id: SUP_A,
        invoice_number: `INV-${uniqTag()}`,
        invoice_date: '2026-04-15',
        due_date: '2026-05-15',
        items: [
          { description: 'Tomates', quantity: 10, unit_price_ht: 2.5, tva_rate: 5.5 },
          { description: 'Huile', quantity: 2, unit_price_ht: 8, tva_rate: 5.5 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.status).toBe('pending');
    expect(res.body.total_ht).toBe(41); // 25 + 16
    expect(res.body.tva_amount).toBeCloseTo(41 * 0.055, 2);
    expect(res.body.items).toHaveLength(2);
  });

  it('uses caller-supplied totals when provided', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(authA())
      .send({
        supplier_id: SUP_A,
        total_ht: 100, tva_amount: 5.5, total_ttc: 105.5,
        items: [{ description: 'Truc', quantity: 1, unit_price_ht: 100 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.total_ht).toBe(100);
    expect(res.body.total_ttc).toBe(105.5);
  });

  it('rejects supplier_id from another tenant', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(authA())
      .send({ supplier_id: SUP_B, items: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Fournisseur/);
  });

  it('rejects invalid status', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(authA())
      .send({ supplier_id: SUP_A, status: 'WAT' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/invoices — list + filters + tenancy', () => {
  let invA, invB;
  beforeAll(async () => {
    const ra = await request(app).post('/api/invoices').set(authA())
      .send({ supplier_id: SUP_A, invoice_number: 'INV-LIST-A', total_ht: 50, total_ttc: 52.75, tva_amount: 2.75 });
    invA = ra.body.id;
    const rb = await request(app).post('/api/invoices').set(authB())
      .send({ supplier_id: SUP_B, invoice_number: 'INV-LIST-B', total_ht: 70, total_ttc: 73.85, tva_amount: 3.85 });
    invB = rb.body.id;
  });

  it('returns only this tenant invoices', async () => {
    const a = await request(app).get('/api/invoices').set(authA());
    expect(a.status).toBe(200);
    const ids = a.body.map(r => r.id);
    expect(ids).toContain(invA);
    expect(ids).not.toContain(invB);
  });

  it('filters by status', async () => {
    const r = await request(app).get('/api/invoices?status=pending').set(authA());
    expect(r.status).toBe(200);
    expect(r.body.every(i => i.status === 'pending')).toBe(true);
  });

  it('filters by supplier_id', async () => {
    const r = await request(app).get(`/api/invoices?supplier_id=${SUP_A}`).set(authA());
    expect(r.status).toBe(200);
    expect(r.body.every(i => i.supplier_id === SUP_A)).toBe(true);
  });
});

describe('GET /api/invoices/:id — detail + tenancy', () => {
  let invA;
  beforeAll(async () => {
    const r = await request(app).post('/api/invoices').set(authA())
      .send({
        supplier_id: SUP_A, invoice_number: 'INV-DETAIL',
        items: [{ description: 'Item 1', quantity: 3, unit_price_ht: 4, ingredient_id: ING_A }],
      });
    invA = r.body.id;
  });

  it('returns the invoice with items + ingredient enrichment', async () => {
    const r = await request(app).get(`/api/invoices/${invA}`).set(authA());
    expect(r.status).toBe(200);
    expect(r.body.invoice_number).toBe('INV-DETAIL');
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].ingredient_name).toMatch(/Ing A/);
  });

  it('blocks cross-tenant detail access', async () => {
    const r = await request(app).get(`/api/invoices/${invA}`).set(authB());
    expect(r.status).toBe(404);
  });
});

describe('PUT /api/invoices/:id/status — transitions', () => {
  let invId;
  beforeEach(async () => {
    const r = await request(app).post('/api/invoices').set(authA())
      .send({ supplier_id: SUP_A, total_ht: 10, tva_amount: 0.55, total_ttc: 10.55 });
    invId = r.body.id;
  });

  it('pending → validated', async () => {
    const r = await request(app).put(`/api/invoices/${invId}/status`).set(authA())
      .send({ status: 'validated' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('validated');
  });

  it('validated → paid sets payment_date', async () => {
    await request(app).put(`/api/invoices/${invId}/status`).set(authA()).send({ status: 'validated' });
    const r = await request(app).put(`/api/invoices/${invId}/status`).set(authA())
      .send({ status: 'paid', payment_method: 'virement' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('paid');
    expect(r.body.payment_date).toBeTruthy();
    expect(r.body.payment_method).toBe('virement');
  });

  it('rejects illegal pending → invalid_value', async () => {
    const r = await request(app).put(`/api/invoices/${invId}/status`).set(authA())
      .send({ status: 'badstatus' });
    expect(r.status).toBe(400);
  });

  it('rejects paid → validated (no walk-back from paid except via disputed)', async () => {
    await request(app).put(`/api/invoices/${invId}/status`).set(authA()).send({ status: 'validated' });
    await request(app).put(`/api/invoices/${invId}/status`).set(authA()).send({ status: 'paid' });
    const r = await request(app).put(`/api/invoices/${invId}/status`).set(authA())
      .send({ status: 'validated' });
    expect(r.status).toBe(400);
  });

  it('disputed → pending allowed', async () => {
    await request(app).put(`/api/invoices/${invId}/status`).set(authA()).send({ status: 'disputed' });
    const r = await request(app).put(`/api/invoices/${invId}/status`).set(authA())
      .send({ status: 'pending' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('pending');
  });

  it('blocks status change from another tenant', async () => {
    const r = await request(app).put(`/api/invoices/${invId}/status`).set(authB())
      .send({ status: 'validated' });
    expect(r.status).toBe(404);
  });
});

describe('PUT /api/invoices/:id — update', () => {
  it('replaces items and recomputes totals when totals omitted', async () => {
    const c = await request(app).post('/api/invoices').set(authA())
      .send({
        supplier_id: SUP_A,
        items: [{ description: 'Old', quantity: 1, unit_price_ht: 5 }],
      });
    const id = c.body.id;
    const u = await request(app).put(`/api/invoices/${id}`).set(authA())
      .send({
        items: [
          { description: 'New 1', quantity: 4, unit_price_ht: 3 },
          { description: 'New 2', quantity: 2, unit_price_ht: 10 },
        ],
      });
    expect(u.status).toBe(200);
    expect(u.body.items).toHaveLength(2);
    expect(u.body.total_ht).toBe(32); // 12 + 20
  });

  it('refuses update on a paid invoice', async () => {
    const c = await request(app).post('/api/invoices').set(authA())
      .send({ supplier_id: SUP_A, total_ht: 10, total_ttc: 10.55, tva_amount: 0.55 });
    const id = c.body.id;
    await request(app).put(`/api/invoices/${id}/status`).set(authA()).send({ status: 'validated' });
    await request(app).put(`/api/invoices/${id}/status`).set(authA()).send({ status: 'paid' });
    const u = await request(app).put(`/api/invoices/${id}`).set(authA())
      .send({ notes: 'try update' });
    expect(u.status).toBe(400);
  });
});

describe('DELETE /api/invoices/:id — soft delete', () => {
  it('soft-deletes and removes from list', async () => {
    const c = await request(app).post('/api/invoices').set(authA())
      .send({ supplier_id: SUP_A, invoice_number: 'TO-DELETE' });
    const id = c.body.id;
    const d = await request(app).delete(`/api/invoices/${id}`).set(authA());
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
    const after = await request(app).get(`/api/invoices/${id}`).set(authA());
    expect(after.status).toBe(404);
    // Row still in DB with deleted_at populated
    const row = get('SELECT deleted_at FROM supplier_invoices WHERE id = ?', [id]);
    expect(row.deleted_at).toBeTruthy();
  });

  it('blocks cross-tenant delete', async () => {
    const c = await request(app).post('/api/invoices').set(authA())
      .send({ supplier_id: SUP_A });
    const r = await request(app).delete(`/api/invoices/${c.body.id}`).set(authB());
    expect(r.status).toBe(404);
  });
});

describe('POST /api/invoices/from-scan — AI scan ingestion', () => {
  it('creates invoice from scan payload, fuzzy-matches supplier by name', async () => {
    const supName = get('SELECT name FROM suppliers WHERE id = ?', [SUP_A]).name;
    const r = await request(app).post('/api/invoices/from-scan').set(authA())
      .send({
        supplier_name: supName,
        invoice_number: 'SCAN-001',
        invoice_date: '2026-04-20',
        items: [
          { product_name: 'Carottes', quantity: 5, unit_price: 1.5, ingredient_id: ING_A },
        ],
        total_ht: 7.5,
        tva: 0.41,
        total_ttc: 7.91,
      });
    expect(r.status).toBe(201);
    expect(r.body.supplier_id).toBe(SUP_A);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].description).toBe('Carottes');
    expect(r.body.items[0].ingredient_id).toBe(ING_A);
  });

  it('explicit supplier_id wins over fuzzy match', async () => {
    const r = await request(app).post('/api/invoices/from-scan').set(authA())
      .send({
        supplier_id: SUP_A,
        supplier_name: 'no such supplier',
        items: [{ product_name: 'X', quantity: 1, unit_price: 1 }],
      });
    expect(r.status).toBe(201);
    expect(r.body.supplier_id).toBe(SUP_A);
  });

  it('rejects supplier_id from another tenant', async () => {
    const r = await request(app).post('/api/invoices/from-scan').set(authA())
      .send({ supplier_id: SUP_B, items: [] });
    expect(r.status).toBe(404);
  });

  it('derives totals from items when scan omits them', async () => {
    const r = await request(app).post('/api/invoices/from-scan').set(authA())
      .send({
        items: [
          { product_name: 'A', quantity: 4, unit_price: 2.5 }, // 10
          { product_name: 'B', quantity: 1, unit_price: 6 },   // 6
        ],
      });
    expect(r.status).toBe(201);
    expect(r.body.total_ht).toBe(16);
  });
});

describe('GET /api/invoices/reconcile/:id — DN comparison', () => {
  let dnId, invId;
  beforeAll(() => {
    dnId = run(
      `INSERT INTO delivery_notes (supplier_id, status, restaurant_id, total_amount)
       VALUES (?, 'received', ?, 0)`,
      [SUP_A, RID_A]
    ).lastInsertRowid;
    // DN line A: matches invoice
    run(
      `INSERT INTO delivery_note_items (delivery_note_id, ingredient_id, product_name, quantity, unit, price_per_unit, status, restaurant_id)
       VALUES (?, ?, 'Match', 5, 'kg', 2.0, 'accepted', ?)`,
      [dnId, ING_A, RID_A]
    );
    // DN line B: qty mismatch
    run(
      `INSERT INTO delivery_note_items (delivery_note_id, ingredient_id, product_name, quantity, unit, price_per_unit, status, restaurant_id)
       VALUES (?, NULL, 'Qty diff', 10, 'kg', 1.0, 'accepted', ?)`,
      [dnId, RID_A]
    );
    // DN line C: only on DN, missing from invoice
    run(
      `INSERT INTO delivery_note_items (delivery_note_id, ingredient_id, product_name, quantity, unit, price_per_unit, status, restaurant_id)
       VALUES (?, NULL, 'OnlyDN', 1, 'kg', 5.0, 'accepted', ?)`,
      [dnId, RID_A]
    );
  });

  beforeAll(async () => {
    const r = await request(app).post('/api/invoices').set(authA())
      .send({
        supplier_id: SUP_A, invoice_number: 'REC-001', delivery_note_id: dnId,
        items: [
          { description: 'Match',     quantity: 5,  unit_price_ht: 2.0, ingredient_id: ING_A },
          { description: 'Qty diff',  quantity: 12, unit_price_ht: 1.0 }, // qty mismatch (12 vs 10)
          { description: 'OnlyInv',   quantity: 1,  unit_price_ht: 9.0 }, // missing on DN
        ],
      });
    invId = r.body.id;
  });

  it('returns matched / qty_discrepancies / missing buckets', async () => {
    const r = await request(app).get(`/api/invoices/reconcile/${invId}`).set(authA());
    expect(r.status).toBe(200);
    expect(r.body.summary.matched).toBe(1);
    expect(r.body.summary.qty_discrepancies).toBe(1);
    expect(r.body.summary.missing_in_delivery).toBe(1);
    expect(r.body.summary.missing_in_invoice).toBe(1);
    expect(r.body.summary.clean).toBe(false);
    expect(r.body.qty_discrepancies[0].invoice_quantity).toBe(12);
    expect(r.body.qty_discrepancies[0].delivery_quantity).toBe(10);
  });

  it('400 when invoice has no linked DN', async () => {
    const c = await request(app).post('/api/invoices').set(authA())
      .send({ supplier_id: SUP_A });
    const r = await request(app).get(`/api/invoices/reconcile/${c.body.id}`).set(authA());
    expect(r.status).toBe(400);
  });

  it('blocks cross-tenant reconcile', async () => {
    const r = await request(app).get(`/api/invoices/reconcile/${invId}`).set(authB());
    expect(r.status).toBe(404);
  });
});

describe('GET /api/invoices/stats', () => {
  it('returns monthly + by_supplier + unpaid + overdue', async () => {
    // Make one invoice overdue
    await request(app).post('/api/invoices').set(authA()).send({
      supplier_id: SUP_A,
      invoice_number: 'OVERDUE',
      invoice_date: '2026-01-15',
      due_date: '2026-02-15',
      total_ht: 100, tva_amount: 5.5, total_ttc: 105.5,
    });
    const r = await request(app).get('/api/invoices/stats').set(authA());
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.monthly)).toBe(true);
    expect(Array.isArray(r.body.by_supplier)).toBe(true);
    expect(r.body.unpaid).toHaveProperty('count');
    expect(r.body.unpaid).toHaveProperty('total_ttc');
    expect(r.body.overdue.count).toBeGreaterThanOrEqual(1);
    expect(r.body.overdue.total_ttc).toBeGreaterThanOrEqual(105.5);
  });

  it('does not leak other tenants in stats', async () => {
    const a = await request(app).get('/api/invoices/stats').set(authA());
    const b = await request(app).get('/api/invoices/stats').set(authB());
    // by_supplier from A should not include SUP_B and vice-versa
    const aSuppliers = a.body.by_supplier.map(s => s.supplier_id);
    const bSuppliers = b.body.by_supplier.map(s => s.supplier_id);
    expect(aSuppliers).not.toContain(SUP_B);
    expect(bSuppliers).not.toContain(SUP_A);
  });
});

describe('Auth gating', () => {
  it('401 without token', async () => {
    const r = await request(app).get('/api/invoices');
    expect(r.status).toBe(401);
  });
});
