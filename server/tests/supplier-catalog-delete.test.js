'use strict';

// DELETE endpoints for supplier_catalog so users can clean up duplicate
// products (e.g. same item imported manually + via mercuriale email).
// Two routes covered:
//   - DELETE /api/suppliers/:supplierId/catalog/:catalogId  → single row
//   - DELETE /api/suppliers/:supplierId/catalog            → bulk wipe
// Both are tenant-scoped (404 cross-tenant) and audited.

const request = require('supertest');
const app = require('../app');
const { get, all, run } = require('../db');
const { authHeader } = require('./helpers/auth');

let RID_A, RID_B, SUP_A, SUP_B;

function tag() { return Math.random().toString(36).slice(2, 8); }

beforeAll(() => {
  const t = tag();
  RID_A = run(`INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`, [`Cat Del A ${t}`]).lastInsertRowid;
  RID_B = run(`INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`, [`Cat Del B ${t}`]).lastInsertRowid;
  SUP_A = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup A ${t}`, RID_A]).lastInsertRowid;
  SUP_B = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup B ${t}`, RID_B]).lastInsertRowid;
});

function authA() { return authHeader({ id: 100, role: 'gerant', restaurant_id: RID_A }); }
function authB() { return authHeader({ id: 200, role: 'gerant', restaurant_id: RID_B }); }

function seedCatalog(rid, supplierId, products) {
  const ids = [];
  for (const p of products) {
    const r = run(
      `INSERT INTO supplier_catalog (restaurant_id, supplier_id, product_name, unit, price)
       VALUES (?, ?, ?, ?, ?)`,
      [rid, supplierId, p.name, p.unit || 'kg', p.price]
    );
    ids.push(r.lastInsertRowid);
  }
  return ids;
}

beforeEach(() => {
  run('DELETE FROM supplier_catalog WHERE restaurant_id = ?', [RID_A]);
  run('DELETE FROM supplier_catalog WHERE restaurant_id = ?', [RID_B]);
});

describe('DELETE /api/suppliers/:supplierId/catalog/:catalogId', () => {
  it('deletes a single own catalog row', async () => {
    const [id1, id2] = seedCatalog(RID_A, SUP_A, [
      { name: 'Tomate cerise', price: 4.2 },
      { name: 'Concombre lisse', price: 1.8 },
    ]);

    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog/${id1}`)
      .set(authA());

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(get('SELECT id FROM supplier_catalog WHERE id = ?', [id1])).toBeUndefined();
    expect(get('SELECT id FROM supplier_catalog WHERE id = ?', [id2])).toBeTruthy();
  });

  it('returns 404 when the catalog row does not exist for this tenant', async () => {
    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog/999999`)
      .set(authA());
    expect(res.status).toBe(404);
  });

  it('returns 404 cross-tenant (no leak via 403)', async () => {
    const [id] = seedCatalog(RID_A, SUP_A, [{ name: 'Tomate cerise', price: 4.2 }]);

    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog/${id}`)
      .set(authB());

    expect(res.status).toBe(404);
    expect(get('SELECT id FROM supplier_catalog WHERE id = ?', [id])).toBeTruthy();
  });

  it('returns 404 when the catalog row belongs to a different supplier', async () => {
    const SUP_OTHER = run(
      `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
      [`Sup other ${tag()}`, RID_A]
    ).lastInsertRowid;
    const [id] = seedCatalog(RID_A, SUP_OTHER, [{ name: 'Carotte fane', price: 2.4 }]);

    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog/${id}`)
      .set(authA());

    expect(res.status).toBe(404);
    expect(get('SELECT id FROM supplier_catalog WHERE id = ?', [id])).toBeTruthy();
  });

  it('returns 404 for non-numeric catalog id', async () => {
    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog/abc`)
      .set(authA());
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/suppliers/:supplierId/catalog (bulk wipe)', () => {
  it('deletes all catalog rows for the supplier and returns the count', async () => {
    seedCatalog(RID_A, SUP_A, [
      { name: 'Pomme', price: 1.2 },
      { name: 'Poire', price: 1.4 },
      { name: 'Banane', price: 1.0 },
    ]);

    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog`)
      .set(authA());

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.count).toBe(3);
    expect(all('SELECT id FROM supplier_catalog WHERE supplier_id = ?', [SUP_A])).toHaveLength(0);
  });

  it('returns 404 when the supplier does not belong to this tenant', async () => {
    seedCatalog(RID_B, SUP_B, [{ name: 'Mûre', price: 8 }]);

    const res = await request(app)
      .delete(`/api/suppliers/${SUP_B}/catalog`)
      .set(authA());

    expect(res.status).toBe(404);
    expect(all('SELECT id FROM supplier_catalog WHERE supplier_id = ?', [SUP_B])).toHaveLength(1);
  });

  it('returns 200 with count=0 when there is nothing to delete', async () => {
    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog`)
      .set(authA());

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('only removes rows for THIS supplier, not other suppliers of the same tenant', async () => {
    const SUP_OTHER = run(
      `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
      [`Sup other ${tag()}`, RID_A]
    ).lastInsertRowid;
    seedCatalog(RID_A, SUP_A, [{ name: 'A', price: 1 }, { name: 'B', price: 2 }]);
    seedCatalog(RID_A, SUP_OTHER, [{ name: 'X', price: 9 }]);

    const res = await request(app)
      .delete(`/api/suppliers/${SUP_A}/catalog`)
      .set(authA());

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(all('SELECT id FROM supplier_catalog WHERE supplier_id = ?', [SUP_A])).toHaveLength(0);
    expect(all('SELECT id FROM supplier_catalog WHERE supplier_id = ?', [SUP_OTHER])).toHaveLength(1);
  });
});
