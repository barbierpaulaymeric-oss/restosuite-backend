'use strict';

// GET /api/analytics/mercuriale-catalog — supplier-organized catalog browser
// for the Mercuriale page. Returns suppliers → categories → products with
// the latest price-change notification per product (for trend arrows) and a
// totals summary. Tenant-scoped.

const request = require('supertest');
const app = require('../app');
const { db } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();
const AUTH_OTHER = authHeader({ id: 99, restaurant_id: 999, email: 'other@test.fr' });

function ensureSupplier({ rid, name }) {
  const existing = db.prepare('SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?').get(name, rid);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)').run(name, rid).lastInsertRowid;
}

function addCatalog({ rid, supplier_id, product_name, category, unit, price, sku }) {
  return db.prepare(`
    INSERT INTO supplier_catalog
      (restaurant_id, supplier_id, product_name, category, unit, price, sku)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(rid, supplier_id, product_name, category, unit, price, sku || null).lastInsertRowid;
}

function addPriceChange({ rid, supplier_id, product_name, old_price, new_price, daysAgo }) {
  const at = new Date(Date.now() - daysAgo * 86400000).toISOString();
  db.prepare(`
    INSERT INTO price_change_notifications
      (restaurant_id, supplier_id, product_name, old_price, new_price, change_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'update', ?)
  `).run(rid, supplier_id, product_name, old_price, new_price, at);
}

describe('GET /api/analytics/mercuriale-catalog', () => {
  let metroId, ttiId;

  beforeAll(() => {
    metroId = ensureSupplier({ rid: 1, name: 'MercTestMetro' });
    ttiId = ensureSupplier({ rid: 1, name: 'MercTestPassionFroid' });

    addCatalog({ rid: 1, supplier_id: metroId, product_name: 'MercTest Boeuf', category: 'Boucherie', unit: 'kg', price: 18.5, sku: 'BF-01' });
    addCatalog({ rid: 1, supplier_id: metroId, product_name: 'MercTest Poulet', category: 'Boucherie', unit: 'kg', price: 9.2 });
    addCatalog({ rid: 1, supplier_id: metroId, product_name: 'MercTest Crème', category: 'Crémerie', unit: 'L', price: 3.4 });
    addCatalog({ rid: 1, supplier_id: ttiId, product_name: 'MercTest Saumon', category: 'Poissonnerie', unit: 'kg', price: 24.0 });

    // Most-recent price change for "MercTest Boeuf" — should reflect in trend
    addPriceChange({ rid: 1, supplier_id: metroId, product_name: 'MercTest Boeuf', old_price: 16.0, new_price: 18.5, daysAgo: 1 });
    // Older price change for the same product — must NOT win the index
    addPriceChange({ rid: 1, supplier_id: metroId, product_name: 'MercTest Boeuf', old_price: 14.0, new_price: 16.0, daysAgo: 30 });

    // Other tenant data (must not leak)
    const otherSup = ensureSupplier({ rid: 999, name: 'OtherTenantSup' });
    addCatalog({ rid: 999, supplier_id: otherSup, product_name: 'Other Tenant Product', category: 'X', unit: 'kg', price: 1 });
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/analytics/mercuriale-catalog');
    expect(res.status).toBe(401);
  });

  it('returns suppliers grouped by category with totals', async () => {
    const res = await request(app).get('/api/analytics/mercuriale-catalog').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suppliers');
    expect(res.body).toHaveProperty('totals');

    const metro = res.body.suppliers.find(s => s.name === 'MercTestMetro');
    const tti = res.body.suppliers.find(s => s.name === 'MercTestPassionFroid');
    expect(metro).toBeTruthy();
    expect(tti).toBeTruthy();

    expect(metro.products_count).toBe(3);
    expect(tti.products_count).toBe(1);

    const boucherie = metro.categories.find(c => c.name === 'Boucherie');
    const cremerie = metro.categories.find(c => c.name === 'Crémerie');
    expect(boucherie.items.length).toBe(2);
    expect(cremerie.items.length).toBe(1);

    const boeuf = boucherie.items.find(i => i.product_name === 'MercTest Boeuf');
    expect(boeuf.price).toBe(18.5);
    expect(boeuf.sku).toBe('BF-01');
    expect(boeuf.last_change).toBeTruthy();
    expect(boeuf.last_change.trend).toBe('up');
    // Latest change is 16 → 18.5 = +15.6%
    expect(boeuf.last_change.change_pct).toBeCloseTo(15.6, 1);
    expect(boeuf.last_change.old_price).toBe(16.0);
  });

  it('products without a price-change row have last_change=null', async () => {
    const res = await request(app).get('/api/analytics/mercuriale-catalog').set(AUTH);
    const metro = res.body.suppliers.find(s => s.name === 'MercTestMetro');
    const poulet = metro.categories.find(c => c.name === 'Boucherie').items.find(i => i.product_name === 'MercTest Poulet');
    expect(poulet.last_change).toBeNull();
  });

  it('isolates other tenants', async () => {
    const res = await request(app).get('/api/analytics/mercuriale-catalog').set(AUTH);
    const names = res.body.suppliers.map(s => s.name);
    expect(names).not.toContain('OtherTenantSup');

    const other = await request(app).get('/api/analytics/mercuriale-catalog').set(AUTH_OTHER);
    expect(other.status).toBe(200);
    expect(other.body.suppliers.every(s => s.name !== 'MercTestMetro')).toBe(true);
  });

  it('totals reflect counts and most recent updated_at', async () => {
    const res = await request(app).get('/api/analytics/mercuriale-catalog').set(AUTH);
    expect(res.body.totals.suppliers).toBeGreaterThanOrEqual(2);
    expect(res.body.totals.products).toBeGreaterThanOrEqual(4);
    expect(res.body.totals.last_update).toBeTruthy();
  });
});
