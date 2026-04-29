'use strict';

// Tests for /api/exports — accountant-friendly monthly exports.
// Covers: auth, parameter validation, month-window filtering, tenant
// isolation, content-type/disposition headers, basic CSV/PDF shape.

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');
const { run } = require('../db');

const AUTH = authHeader({ id: 9700, role: 'gerant', restaurant_id: 9700 });
const AUTH_OTHER = authHeader({ id: 9701, role: 'gerant', restaurant_id: 9701 });

const MONTH = '2026-04';
// Inside-month timestamp (tenant 9700 — visible)
const IN_MONTH = '2026-04-15T12:00:00.000Z';
// Outside-month timestamp (must be filtered out)
const OUT_OF_MONTH = '2026-03-15T12:00:00.000Z';

beforeAll(() => {
  run("INSERT OR IGNORE INTO restaurants (id, name) VALUES (9700, 'Tenant 9700')");
  run("INSERT OR IGNORE INTO restaurants (id, name) VALUES (9701, 'Tenant 9701')");

  // ── Suppliers ──
  run("INSERT OR IGNORE INTO suppliers (id, name, restaurant_id) VALUES (9710, 'Supplier 9710', 9700)");
  run("INSERT OR IGNORE INTO suppliers (id, name, restaurant_id) VALUES (9711, 'Supplier 9711 OTHER', 9701)");

  // ── Purchase orders ──
  // 9720: tenant 9700, sent in April (must appear)
  run(`INSERT OR IGNORE INTO purchase_orders
       (id, supplier_id, status, reference, total_amount, sent_at, created_at, restaurant_id)
       VALUES (9720, 9710, 'envoyé', 'PO-9720', 100, ?, ?, 9700)`,
      [IN_MONTH, IN_MONTH]);
  // 9721: tenant 9700, sent in March (must NOT appear)
  run(`INSERT OR IGNORE INTO purchase_orders
       (id, supplier_id, status, reference, total_amount, sent_at, created_at, restaurant_id)
       VALUES (9721, 9710, 'envoyé', 'PO-9721', 50, ?, ?, 9700)`,
      [OUT_OF_MONTH, OUT_OF_MONTH]);
  // 9722: tenant 9700, status=brouillon (draft, must NOT appear)
  run(`INSERT OR IGNORE INTO purchase_orders
       (id, supplier_id, status, reference, total_amount, sent_at, created_at, restaurant_id)
       VALUES (9722, 9710, 'brouillon', 'PO-9722-DRAFT', 999, ?, ?, 9700)`,
      [IN_MONTH, IN_MONTH]);
  // 9723: tenant 9701 (other tenant — must NOT appear in 9700's export)
  run(`INSERT OR IGNORE INTO purchase_orders
       (id, supplier_id, status, reference, total_amount, sent_at, created_at, restaurant_id)
       VALUES (9723, 9711, 'envoyé', 'PO-9723-OTHER', 777, ?, ?, 9701)`,
      [IN_MONTH, IN_MONTH]);

  run(`INSERT OR IGNORE INTO purchase_order_items
       (id, purchase_order_id, product_name, quantity, unit, restaurant_id)
       VALUES (9730, 9720, 'Tomates', 5, 'kg', 9700)`);
  run(`INSERT OR IGNORE INTO purchase_order_items
       (id, purchase_order_id, product_name, quantity, unit, restaurant_id)
       VALUES (9731, 9723, 'Other tenant secret item', 1, 'kg', 9701)`);

  // ── Recipes / ingredients / order_items for food cost ──
  run("INSERT OR IGNORE INTO ingredients (id, name, default_unit, price_per_unit, restaurant_id) VALUES (9740, 'Tomate FC', 'kg', 2.0, 9700)");
  run("INSERT OR IGNORE INTO recipes (id, name, category, portions, selling_price, restaurant_id) VALUES (9750, 'Salade FC', 'entrée', 1, 10.0, 9700)");
  run("INSERT OR IGNORE INTO recipe_ingredients (id, recipe_id, ingredient_id, gross_quantity, unit, restaurant_id) VALUES (9760, 9750, 9740, 0.5, 'kg', 9700)");

  run("INSERT OR IGNORE INTO orders (id, table_number, status, created_at, restaurant_id) VALUES (9770, 1, 'fermée', ?, 9700)", [IN_MONTH]);
  run("INSERT OR IGNORE INTO orders (id, table_number, status, created_at, restaurant_id) VALUES (9771, 2, 'fermée', ?, 9700)", [OUT_OF_MONTH]); // out of month
  run("INSERT OR IGNORE INTO order_items (id, order_id, recipe_id, quantity, restaurant_id) VALUES (9780, 9770, 9750, 3, 9700)");
  run("INSERT OR IGNORE INTO order_items (id, order_id, recipe_id, quantity, restaurant_id) VALUES (9781, 9771, 9750, 99, 9700)"); // out of month — should be excluded

  // ── Stock + movements for variance ──
  run("INSERT OR IGNORE INTO stock (id, ingredient_id, quantity, unit, restaurant_id) VALUES (9790, 9740, 12, 'kg', 9700)");
  run(`INSERT OR IGNORE INTO stock_movements
       (id, ingredient_id, movement_type, quantity, unit, recorded_at, restaurant_id)
       VALUES (9791, 9740, 'reception', 10, 'kg', ?, 9700)`, [IN_MONTH]);
  run(`INSERT OR IGNORE INTO stock_movements
       (id, ingredient_id, movement_type, quantity, unit, recorded_at, restaurant_id)
       VALUES (9792, 9740, 'consumption', 4, 'kg', ?, 9700)`, [IN_MONTH]);
  run(`INSERT OR IGNORE INTO stock_movements
       (id, ingredient_id, movement_type, quantity, unit, recorded_at, restaurant_id)
       VALUES (9793, 9740, 'perte', 1, 'kg', ?, 9700)`, [IN_MONTH]);
  // Out-of-window — must not be aggregated
  run(`INSERT OR IGNORE INTO stock_movements
       (id, ingredient_id, movement_type, quantity, unit, recorded_at, restaurant_id)
       VALUES (9794, 9740, 'reception', 999, 'kg', ?, 9700)`, [OUT_OF_MONTH]);

  // ── HACCP rows for the PDF summary ──
  run("INSERT OR IGNORE INTO temperature_zones (id, name, type, min_temp, max_temp, restaurant_id) VALUES (9800, 'Frigo Test', 'fridge', 0, 4, 9700)");
  run(`INSERT OR IGNORE INTO temperature_logs (id, zone_id, temperature, recorded_at, is_alert, restaurant_id)
       VALUES (9810, 9800, 3.0, ?, 0, 9700)`, [IN_MONTH]);
  run(`INSERT OR IGNORE INTO temperature_logs (id, zone_id, temperature, recorded_at, is_alert, restaurant_id)
       VALUES (9811, 9800, 9.5, ?, 1, 9700)`, [IN_MONTH]);
  run(`INSERT OR IGNORE INTO temperature_logs (id, zone_id, temperature, recorded_at, is_alert, restaurant_id)
       VALUES (9812, 9800, 2.0, ?, 0, 9700)`, [OUT_OF_MONTH]); // excluded
  run(`INSERT OR IGNORE INTO non_conformities (id, title, severity, status, detected_at, restaurant_id)
       VALUES (9820, 'Test NC', 'majeure', 'ouvert', ?, 9700)`, [IN_MONTH]);
  run(`INSERT OR IGNORE INTO non_conformities (id, title, severity, status, detected_at, restaurant_id)
       VALUES (9821, 'NC-out-of-month', 'mineure', 'resolu', ?, 9700)`, [OUT_OF_MONTH]); // excluded
});

describe('Exports — auth', () => {
  for (const path of [
    `/api/exports/monthly-purchases?month=${MONTH}`,
    `/api/exports/monthly-food-cost?month=${MONTH}`,
    `/api/exports/stock-variance?month=${MONTH}`,
    `/api/exports/haccp-summary?month=${MONTH}`,
    `/api/exports/monthly-report?month=${MONTH}`,
  ]) {
    it(`${path} → 401 without token`, async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    });
  }
});

describe('Exports — month parameter validation', () => {
  for (const ep of ['monthly-purchases', 'monthly-food-cost', 'stock-variance', 'haccp-summary', 'monthly-report']) {
    it(`/api/exports/${ep} → 400 when month missing`, async () => {
      const res = await request(app).get(`/api/exports/${ep}`).set(AUTH);
      expect(res.status).toBe(400);
    });
    it(`/api/exports/${ep} → 400 on invalid month format`, async () => {
      const res = await request(app).get(`/api/exports/${ep}?month=2026/04`).set(AUTH);
      expect(res.status).toBe(400);
    });
    it(`/api/exports/${ep} → 400 on out-of-range month`, async () => {
      const res = await request(app).get(`/api/exports/${ep}?month=2026-13`).set(AUTH);
      expect(res.status).toBe(400);
    });
  }
});

describe('Exports — monthly-purchases CSV', () => {
  it('returns CSV with proper headers and content-disposition', async () => {
    const res = await request(app)
      .get(`/api/exports/monthly-purchases?month=${MONTH}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/achats-2026-04\.csv/);
    expect(res.text).toMatch(/date;fournisseur;numero_commande/);
    // April-15 sent purchase included
    expect(res.text).toContain('PO-9720');
    expect(res.text).toContain('Supplier 9710');
    expect(res.text).toContain('Tomates');
    // March-15 purchase excluded
    expect(res.text).not.toContain('PO-9721');
    // Drafts excluded
    expect(res.text).not.toContain('PO-9722-DRAFT');
    // Other tenant must not leak
    expect(res.text).not.toContain('PO-9723-OTHER');
    expect(res.text).not.toContain('Supplier 9711 OTHER');
    expect(res.text).not.toContain('Other tenant secret item');
    // TOTAL row at the bottom: HT 100, TVA 10, TTC 110
    expect(res.text).toMatch(/TOTAL;.*100\.00.*10\.00.*110\.00/);
  });
});

describe('Exports — monthly-food-cost CSV', () => {
  it('aggregates portions sold within the month only', async () => {
    const res = await request(app)
      .get(`/api/exports/monthly-food-cost?month=${MONTH}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(/fiche_technique;categorie;portions_vendues/);
    // The recipe was sold 3× in April (in-month) + 99× in March (out-of-month).
    // Only the 3 portions count.
    const lines = res.text.split(/\r?\n/);
    const recipeLine = lines.find(l => l.startsWith('Salade FC'));
    expect(recipeLine).toBeTruthy();
    // Column 3 = portions_vendues (1-indexed columns: name, cat, portions, …)
    const cells = recipeLine.split(';');
    expect(cells[2]).toBe('3');
    // Cost per portion = 0.5 kg × 2.0 €/kg / 1 portion = 1.00
    expect(cells[3]).toBe('1.00');
    // selling_price = 10.00, margin = 9.00, food_cost_pct = 10.0
    expect(cells[4]).toBe('10.00');
    expect(cells[5]).toBe('9.00');
    expect(cells[6]).toBe('10.0');
  });
});

describe('Exports — stock-variance CSV', () => {
  it('aggregates only in-window movements per ingredient', async () => {
    const res = await request(app)
      .get(`/api/exports/stock-variance?month=${MONTH}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.split(/\r?\n/);
    const tomateLine = lines.find(l => l.startsWith('Tomate FC'));
    expect(tomateLine).toBeTruthy();
    const cells = tomateLine.split(';');
    // cells: name, unit, opening, receptions, consumption, losses, closing, variance, unit_value, stock_value
    expect(cells[1]).toBe('kg');
    expect(cells[3]).toBe('10.000'); // receptions in April
    expect(cells[4]).toBe('4.000');  // consumption
    expect(cells[5]).toBe('1.000');  // losses (perte)
    expect(cells[6]).toBe('12.000'); // closing
    // opening = 12 - 10 + 4 + 1 = 7
    expect(cells[2]).toBe('7.000');
  });

  it('does not leak other tenant ingredients', async () => {
    // Insert an ingredient for tenant 9701 with a unique name
    run("INSERT OR IGNORE INTO ingredients (id, name, default_unit, price_per_unit, restaurant_id) VALUES (9745, 'TomateOTHER', 'kg', 2.0, 9701)");
    const res = await request(app)
      .get(`/api/exports/stock-variance?month=${MONTH}`)
      .set(AUTH);
    expect(res.text).not.toContain('TomateOTHER');
  });
});

describe('Exports — haccp-summary PDF', () => {
  it('returns a PDF with correct headers', async () => {
    const res = await request(app)
      .get(`/api/exports/haccp-summary?month=${MONTH}`)
      .set(AUTH)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/haccp-.*-2026-04\.pdf/);
    // PDF magic bytes
    const head = Buffer.from(res.body).slice(0, 4).toString();
    expect(head).toBe('%PDF');
  });
});

describe('Exports — tenant isolation cross-check', () => {
  it('tenant 9701 sees no tenant 9700 purchases', async () => {
    const res = await request(app)
      .get(`/api/exports/monthly-purchases?month=${MONTH}`)
      .set(AUTH_OTHER);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('PO-9720');
    expect(res.text).not.toContain('Supplier 9710');
    expect(res.text).not.toContain('Tomates');
  });
});

describe('Exports — monthly-report PDF (all-in-one)', () => {
  async function fetchPdf(auth) {
    return request(app)
      .get(`/api/exports/monthly-report?month=${MONTH}`)
      .set(auth)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('returns a PDF with proper headers and magic bytes', async () => {
    const res = await fetchPdf(AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/rapport-mensuel-.*-2026-04\.pdf/);
    const head = Buffer.from(res.body).slice(0, 4).toString();
    expect(head).toBe('%PDF');
    // The body should be non-trivial (cover + 6 sections at least)
    expect(res.body.length).toBeGreaterThan(2000);
  });

  it('still produces a PDF for a tenant with no data (empty months)', async () => {
    const res = await fetchPdf(AUTH_OTHER);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.length).toBeGreaterThan(800);
  });
});
