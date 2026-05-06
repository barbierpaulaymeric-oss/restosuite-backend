'use strict';

// Coverage for the gérant-side mercuriale import:
//   - unmatched products land in supplier_catalog with NULL ingredient_id
//   - matched products upsert BOTH supplier_prices and supplier_catalog
//   - identical re-imports skip silently (unchanged++)
//   - price changes are logged in price_change_notifications
//   - /suppliers/:id/prices surfaces catalog-only entries to the order form

const request = require('supertest');
const app = require('../app');
const { db, get, all, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const RID = 1;

function ensureSupplier() {
  let s = get('SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?', ['ACME Mercu Test', RID]);
  if (!s) {
    const r = run('INSERT INTO suppliers (name, email, restaurant_id) VALUES (?, ?, ?)', ['ACME Mercu Test', 'acme@test.fr', RID]);
    s = { id: r.lastInsertRowid };
  }
  return s.id;
}

function ensureIngredient(name) {
  let i = get('SELECT id FROM ingredients WHERE name = ? AND restaurant_id = ?', [name, RID]);
  if (!i) {
    const r = run('INSERT INTO ingredients (name, default_unit, restaurant_id) VALUES (?, ?, ?)', [name, 'kg', RID]);
    i = { id: r.lastInsertRowid };
  }
  return i.id;
}

function cleanup(supplierId) {
  run('DELETE FROM supplier_catalog WHERE supplier_id = ?', [supplierId]);
  run('DELETE FROM supplier_prices WHERE supplier_id = ?', [supplierId]);
  run('DELETE FROM price_change_notifications WHERE supplier_id = ?', [supplierId]);
  run('DELETE FROM price_history WHERE supplier_id = ?', [supplierId]);
}

describe('POST /api/ai/import-mercuriale — unmatched products', () => {
  let supplierId;
  let ingredientId;

  beforeAll(() => {
    supplierId = ensureSupplier();
    ingredientId = ensureIngredient('Tomate import-test');
  });

  beforeEach(() => cleanup(supplierId));
  afterAll(() => cleanup(supplierId));

  it('imports unmatched products into supplier_catalog with NULL ingredient_id', async () => {
    const res = await request(app)
      .post('/api/ai/import-mercuriale')
      .set(authHeader({ id: 1, restaurant_id: RID }))
      .send({
        supplier_id: supplierId,
        items: [
          { product_name: 'Saucisson chti unique', price: 12.5, unit: 'kg', category: 'Charcuterie' },
          { product_name: 'Confit de poire mystère', price: 8.2, unit: 'pot', category: 'Épicerie' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.catalog_created).toBe(2);
    expect(res.body.matched_created).toBe(0);

    const rows = all(
      'SELECT product_name, price, ingredient_id FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? ORDER BY product_name',
      [supplierId, RID]
    );
    expect(rows.length).toBe(2);
    expect(rows[0].ingredient_id).toBeNull();
    expect(rows[1].ingredient_id).toBeNull();

    // No supplier_prices rows for unmatched items.
    const priced = all('SELECT id FROM supplier_prices WHERE supplier_id = ? AND restaurant_id = ?', [supplierId, RID]);
    expect(priced.length).toBe(0);
  });

  it('imports matched products into BOTH supplier_prices and supplier_catalog', async () => {
    const res = await request(app)
      .post('/api/ai/import-mercuriale')
      .set(authHeader({ id: 1, restaurant_id: RID }))
      .send({
        supplier_id: supplierId,
        items: [
          { product_name: 'Tomate import-test', price: 3.2, unit: 'kg', ingredient_id: ingredientId },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.matched_created).toBe(1);
    expect(res.body.catalog_created).toBe(1);

    const cat = get('SELECT ingredient_id FROM supplier_catalog WHERE supplier_id = ? AND product_name = ?', [supplierId, 'Tomate import-test']);
    expect(cat).toBeTruthy();
    expect(cat.ingredient_id).toBe(ingredientId);

    const sp = get('SELECT price FROM supplier_prices WHERE supplier_id = ? AND ingredient_id = ?', [supplierId, ingredientId]);
    expect(sp).toBeTruthy();
    expect(Number(sp.price)).toBe(3.2);
  });

  it('skips identical re-imports silently (unchanged++) — no churn on updated_at', async () => {
    const items = [{ product_name: 'Cèpe rare', price: 45, unit: 'kg', category: 'Champignons' }];
    await request(app)
      .post('/api/ai/import-mercuriale')
      .set(authHeader({ id: 1, restaurant_id: RID }))
      .send({ supplier_id: supplierId, items });

    const first = get('SELECT id, updated_at FROM supplier_catalog WHERE supplier_id = ? AND product_name = ?', [supplierId, 'Cèpe rare']);
    expect(first).toBeTruthy();

    // Wait 1.1s so SQLite CURRENT_TIMESTAMP would change if we wrote.
    await new Promise(r => setTimeout(r, 1100));

    const res2 = await request(app)
      .post('/api/ai/import-mercuriale')
      .set(authHeader({ id: 1, restaurant_id: RID }))
      .send({ supplier_id: supplierId, items });

    expect(res2.status).toBe(200);
    expect(res2.body.unchanged).toBe(1);
    expect(res2.body.catalog_updated).toBe(0);

    const second = get('SELECT id, updated_at FROM supplier_catalog WHERE id = ?', [first.id]);
    expect(second.updated_at).toBe(first.updated_at);
  });

  it('logs price evolution in price_change_notifications when re-importing with new price', async () => {
    const oldPrice = 9.0;
    const newPrice = 11.5;
    await request(app)
      .post('/api/ai/import-mercuriale')
      .set(authHeader({ id: 1, restaurant_id: RID }))
      .send({ supplier_id: supplierId, items: [{ product_name: 'Truffe d\'été', price: oldPrice, unit: 'kg' }] });

    await request(app)
      .post('/api/ai/import-mercuriale')
      .set(authHeader({ id: 1, restaurant_id: RID }))
      .send({ supplier_id: supplierId, items: [{ product_name: 'Truffe d\'été', price: newPrice, unit: 'kg' }] });

    const events = all(
      'SELECT change_type, old_price, new_price FROM price_change_notifications WHERE supplier_id = ? AND product_name = ? ORDER BY id',
      [supplierId, 'Truffe d\'été']
    );
    expect(events.length).toBe(2);
    expect(events[0]).toMatchObject({ change_type: 'new', new_price: oldPrice });
    expect(events[1]).toMatchObject({ change_type: 'update', old_price: oldPrice, new_price: newPrice });

    // Catalog row was overwritten with the latest price (incoming wins).
    const cat = get('SELECT price FROM supplier_catalog WHERE supplier_id = ? AND product_name = ?', [supplierId, 'Truffe d\'été']);
    expect(Number(cat.price)).toBe(newPrice);
  });
});

describe('GET /api/suppliers/:id/prices — catalog-only items appear in order form', () => {
  let supplierId;

  beforeAll(() => {
    supplierId = ensureSupplier();
  });

  beforeEach(() => cleanup(supplierId));
  afterAll(() => cleanup(supplierId));

  it('returns catalog-only products with NULL ingredient_id alongside supplier_prices entries', async () => {
    // Import 2 unmatched products
    await request(app)
      .post('/api/ai/import-mercuriale')
      .set(authHeader({ id: 1, restaurant_id: RID }))
      .send({
        supplier_id: supplierId,
        items: [
          { product_name: 'Tartelette ortolan', price: 6, unit: 'pièce' },
          { product_name: 'Mousse algorithme', price: 9, unit: 'kg' },
        ],
      });

    const res = await request(app)
      .get(`/api/suppliers/${supplierId}/prices`)
      .set(authHeader({ id: 1, restaurant_id: RID }));

    expect(res.status).toBe(200);
    const names = res.body.map(r => r.ingredient_name).sort();
    expect(names).toEqual(['Mousse algorithme', 'Tartelette ortolan']);
    // Each row has either a catalog_id (catalog-only) or an ingredient_id.
    res.body.forEach(row => {
      expect(row.catalog_id || row.ingredient_id).toBeTruthy();
    });
  });
});
