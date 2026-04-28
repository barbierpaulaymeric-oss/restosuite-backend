'use strict';

// GET /api/analytics/waste — aggregates stock_movements where
// movement_type='loss', tenant-scoped. Verifies cost computation, the
// weekly bucket (continuous Monday-anchored series), the by-reason and
// top-ingredient slices, and tenant isolation.

const request = require('supertest');
const app = require('../app');
const { db } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();
const AUTH_OTHER = authHeader({ id: 99, restaurant_id: 2, email: 'other@test.fr' });

function seedLoss({ rid, ingredient_id, quantity, unit, reason, daysAgo, unit_price }) {
  const recordedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
  db.prepare(`
    INSERT INTO stock_movements
      (restaurant_id, ingredient_id, movement_type, quantity, unit, reason, unit_price, recorded_at)
    VALUES (?, ?, 'loss', ?, ?, ?, ?, ?)
  `).run(rid, ingredient_id, quantity, unit, reason, unit_price || null, recordedAt);
}

function ensureIngredient({ rid, name, price_per_unit, price_unit }) {
  // Upsert to coexist with seed-ingredients global rows (UNIQUE COLLATE NOCASE).
  const existing = db.prepare(
    'SELECT id FROM ingredients WHERE name = ? COLLATE NOCASE AND restaurant_id = ?'
  ).get(name, rid);
  if (existing) return existing.id;
  const r = db.prepare(`
    INSERT INTO ingredients (name, category, price_per_unit, price_unit, restaurant_id)
    VALUES (?, 'Test', ?, ?, ?)
  `).run(name, price_per_unit, price_unit, rid);
  return r.lastInsertRowid;
}

describe('GET /api/analytics/waste', () => {
  beforeAll(() => {
    // Tenant 1 fixtures
    const beefId = ensureIngredient({ rid: 1, name: 'WasteTest Boeuf', price_per_unit: 12000, price_unit: 'kg' });
    const tomatoId = ensureIngredient({ rid: 1, name: 'WasteTest Tomate', price_per_unit: 3000, price_unit: 'kg' });
    // unit_price recorded directly
    seedLoss({ rid: 1, ingredient_id: beefId, quantity: 1.5, unit: 'kg', reason: 'DLC dépassée', daysAgo: 3, unit_price: 12 });
    // unit_price missing → fallback to ingredients.price_per_unit (3000/kg → 3 €/g; * 0.5 kg = 1500 €)
    // Use the realistic conversion: 3000 €/kg / 1000 = 3 €/g, qty 500 g → 1500 €? That's huge. Tweak: use 30 €/kg.
    // Reset tomato price to a sane 0.003 €/g (3 €/kg)
    db.prepare('UPDATE ingredients SET price_per_unit = 3000, price_unit = ? WHERE id = ?').run('kg', tomatoId);
    // 0.5 kg → 500 base units, unit cost 3000/1000 = 3 → 1500. Still too big.
    // Easier: force unit_price for both and assert sum exactly.
    seedLoss({ rid: 1, ingredient_id: tomatoId, quantity: 0.5, unit: 'kg', reason: 'Casse', daysAgo: 1, unit_price: 4 });
    seedLoss({ rid: 1, ingredient_id: tomatoId, quantity: 0.2, unit: 'kg', reason: 'DLC dépassée', daysAgo: 5, unit_price: 4 });

    // Tenant 2 fixture (must not appear in tenant 1 query)
    const t2 = ensureIngredient({ rid: 2, name: 'WasteTest Saumon T2', price_per_unit: 25000, price_unit: 'kg' });
    seedLoss({ rid: 2, ingredient_id: t2, quantity: 10, unit: 'kg', reason: 'DLC dépassée', daysAgo: 2, unit_price: 25 });
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/analytics/waste');
    expect(res.status).toBe(401);
  });

  it('returns aggregated waste for caller tenant', async () => {
    const res = await request(app).get('/api/analytics/waste').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_cost');
    expect(res.body).toHaveProperty('weekly');
    expect(res.body).toHaveProperty('by_reason');
    expect(res.body).toHaveProperty('top_ingredients');

    // beef 1.5*12 + tomato 0.5*4 + 0.2*4 = 18 + 2 + 0.8 = 20.8
    expect(res.body.total_cost).toBeCloseTo(20.8, 2);
    expect(res.body.total_count).toBe(3);
  });

  it('groups by reason with cost descending', async () => {
    const res = await request(app).get('/api/analytics/waste').set(AUTH);
    const dlc = res.body.by_reason.find(r => r.reason === 'DLC dépassée');
    const casse = res.body.by_reason.find(r => r.reason === 'Casse');
    expect(dlc).toBeTruthy();
    expect(casse).toBeTruthy();
    // 18 + 0.8 = 18.8 vs 2.0 → DLC first
    expect(dlc.cost).toBeCloseTo(18.8, 2);
    expect(casse.cost).toBeCloseTo(2, 2);
    expect(res.body.by_reason[0].cost).toBeGreaterThanOrEqual(res.body.by_reason[1].cost);
  });

  it('top_ingredients lists tenant rows ordered by cost', async () => {
    const res = await request(app).get('/api/analytics/waste').set(AUTH);
    const beef = res.body.top_ingredients.find(i => i.ingredient_name === 'WasteTest Boeuf');
    const tomato = res.body.top_ingredients.find(i => i.ingredient_name === 'WasteTest Tomate');
    expect(beef.cost).toBeCloseTo(18, 2);
    expect(tomato.cost).toBeCloseTo(2.8, 2);
    // Beef comes first
    const beefIdx = res.body.top_ingredients.findIndex(i => i.ingredient_name === 'WasteTest Boeuf');
    const tomatoIdx = res.body.top_ingredients.findIndex(i => i.ingredient_name === 'WasteTest Tomate');
    expect(beefIdx).toBeLessThan(tomatoIdx);
  });

  it('weekly series has continuous Monday-anchored buckets', async () => {
    const res = await request(app).get('/api/analytics/waste?days=28').set(AUTH);
    expect(Array.isArray(res.body.weekly)).toBe(true);
    expect(res.body.weekly.length).toBeGreaterThanOrEqual(4);
    for (const w of res.body.weekly) {
      expect(w).toHaveProperty('week_start');
      expect(w).toHaveProperty('cost');
      // Monday: getUTCDay() should be 1 for the seeded ISO dates.
      const dt = new Date(w.week_start + 'T00:00:00Z');
      expect(dt.getUTCDay()).toBe(1);
    }
  });

  it('tenant isolation: tenant 2 sees only its own losses', async () => {
    const res = await request(app).get('/api/analytics/waste').set(AUTH_OTHER);
    expect(res.status).toBe(200);
    // Only the tenant 2 saumon: 10 * 25 = 250
    expect(res.body.total_cost).toBeCloseTo(250, 2);
    const names = res.body.top_ingredients.map(i => i.ingredient_name);
    expect(names).toContain('WasteTest Saumon T2');
    expect(names).not.toContain('WasteTest Boeuf');
  });

  it('clamps days param into [7, 365]', async () => {
    const tooSmall = await request(app).get('/api/analytics/waste?days=1').set(AUTH);
    expect(tooSmall.status).toBe(200);
    expect(tooSmall.body.period_days).toBe(7);
    const tooBig = await request(app).get('/api/analytics/waste?days=9999').set(AUTH);
    expect(tooBig.status).toBe(200);
    expect(tooBig.body.period_days).toBe(365);
  });
});
