'use strict';

// Mercuriale import (supplier portal) — covers:
//   - lib/mercuriale-categorize: 11-category keyword routing, accent stripping
//   - lib/mercuriale-parse: XLSX header detection, French decimals, normalization
//   - POST /api/supplier-portal/import-mercuriale: auth + XLSX path end-to-end
//   - POST /api/supplier-portal/save-mercuriale: upsert supplier_catalog + price
//     change notifications + duplicate (case-insensitive) handling
//
// Gemini Vision (PDF path) is not exercised here — needs network + GEMINI_API_KEY.
// We assert the auth + missing-file paths instead so route wiring is pinned.

const crypto = require('crypto');
const ExcelJS = require('exceljs');
const request = require('supertest');
const app = require('../app');
const { run, get, all } = require('../db');
const { categorize, CATEGORIES } = require('../lib/mercuriale-categorize');
const { parseXlsxBuffer, normalizeItems, parsePrice } = require('../lib/mercuriale-parse');

// ─── Helpers ─────────────────────────────────────────────────────────

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// Set up a fresh supplier session row and return { token, supplier_id, restaurant_id }.
// Mirrors the shape POST /member-pin creates so requireSupplierAuth accepts it.
function createSupplierSession() {
  // Fresh restaurant + supplier + supplier_account each call — :memory: DB is
  // shared across tests in the file, so we use unique names to avoid collisions.
  const tag = Math.random().toString(36).slice(2, 8);
  const restaurantId = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Test Resto ${tag}`]
  ).lastInsertRowid;
  const supplierId = run(
    `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
    [`Test Supplier ${tag}`, restaurantId]
  ).lastInsertRowid;

  const raw = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const accountId = run(
    `INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin, token_hash, token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [restaurantId, supplierId, 'Test Member', `test-${tag}@example.com`, 'unused', hashToken(raw), expiresAt]
  ).lastInsertRowid;

  return { token: raw, supplier_id: supplierId, restaurant_id: restaurantId, account_id: accountId };
}

// Build an in-memory XLSX with a header row + product rows.
async function buildXlsxBuffer(rows, opts = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tarifs');
  if (opts.banner) ws.addRow([opts.banner]);
  ws.addRow(opts.headers || ['Désignation', 'Catégorie', 'Unité', 'Prix HT']);
  for (const r of rows) ws.addRow(r);
  return await wb.xlsx.writeBuffer();
}

// ─── Categorize ──────────────────────────────────────────────────────

describe('lib/mercuriale-categorize', () => {
  it('exports all 11 expected categories in order', () => {
    expect(CATEGORIES).toEqual([
      'Viandes', 'Poissons', 'Légumes', 'Fruits', 'Produits laitiers',
      'Épicerie', 'Boissons', 'Surgelés', 'Charcuterie', 'Condiments', 'Autre',
    ]);
  });

  it.each([
    ['Entrecôte de bœuf 250g', 'Viandes'],
    ['Suprême de volaille',    'Viandes'],
    ['Saumon frais Norvège',   'Poissons'],
    ['Crevettes roses cuites', 'Poissons'],
    ['Tomate grappe France',   'Légumes'],
    ['Pomme Granny Smith',     'Fruits'],
    ['Crème liquide 35% MG',   'Produits laitiers'],
    ['Parmesan Reggiano',      'Produits laitiers'],
    ['Farine T55 25kg',        'Épicerie'],
    ['Vin rouge Côtes du Rhône', 'Boissons'],
    ['Frites surgelées 2.5kg', 'Surgelés'],
    ['Jambon de Bayonne',      'Charcuterie'],
    ['Saumon fumé',            'Charcuterie'],
    ['Huile d\'olive vierge',  'Condiments'],
  ])('categorizes %s → %s', (name, expected) => {
    expect(categorize(name)).toBe(expected);
  });

  it('falls back to Autre on unknown product', () => {
    expect(categorize('Truc bidule chouette')).toBe('Autre');
  });

  it('handles null / empty input', () => {
    expect(categorize(null)).toBe('Autre');
    expect(categorize('')).toBe('Autre');
  });

  it('matches accent-insensitively', () => {
    expect(categorize('CREVETTE')).toBe('Poissons');
    expect(categorize('crème')).toBe('Produits laitiers');
    expect(categorize('creme')).toBe('Produits laitiers');
  });
});

// ─── Parse helpers ───────────────────────────────────────────────────

describe('lib/mercuriale-parse — parsePrice', () => {
  it.each([
    [12.5, 12.5],
    ['12.50', 12.5],
    ['12,50', 12.5],
    ['12,50 €', 12.5],
    ['€ 12,50', 12.5],
    ['1234,56', 1234.56],
  ])('parses %p → %p', (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each([null, '', 'abc', 0, -3, '0,00'])('rejects %p', (input) => {
    expect(parsePrice(input)).toBeNull();
  });
});

describe('lib/mercuriale-parse — normalizeItems', () => {
  it('drops items without name or positive price', () => {
    const out = normalizeItems([
      { name: 'OK',    price: 10 },
      { name: '',      price: 10 },
      { name: 'NoP',   price: 0 },
      { name: 'NoP2',  price: -1 },
      { name: 'StrPr', price: '4,20' },
    ]);
    expect(out.map(i => i.name)).toEqual(['OK', 'StrPr']);
    expect(out[1].price).toBe(4.2);
  });

  it('dedupes by case-insensitive name', () => {
    const out = normalizeItems([
      { name: 'Tomate', price: 2 },
      { name: 'TOMATE', price: 3 },
      { name: 'tomate', price: 4 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(2);
  });

  it('falls back to categorize() when no category supplied', () => {
    const out = normalizeItems([{ name: 'Saumon frais', price: 25, unit: 'kg' }]);
    expect(out[0].category).toBe('Poissons');
  });

  it('respects supplied category over categorize()', () => {
    const out = normalizeItems([{ name: 'Saumon frais', category: 'Custom', price: 25, unit: 'kg' }]);
    expect(out[0].category).toBe('Custom');
  });
});

describe('lib/mercuriale-parse — parseXlsxBuffer', () => {
  it('extracts rows with French headers + comma decimals', async () => {
    const buf = await buildXlsxBuffer([
      ['Tomate grappe',     'Légumes',   'kg',     '3,20'],
      ['Entrecôte de bœuf', 'Viandes',   'kg',     '34,50'],
      ['',                  'Légumes',   'kg',     '1,00'],   // empty name → drop
      ['Carotte',           '',          '',       '0'],      // 0 price → drop
      ['Crème liquide',     '',          'L',      '5.20'],   // category empty → auto
    ]);

    const items = await parseXlsxBuffer(buf);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ name: 'Tomate grappe', category: 'Légumes', unit: 'kg', price: 3.2 });
    expect(items[1]).toMatchObject({ name: 'Entrecôte de bœuf', category: 'Viandes', price: 34.5 });
    // Auto-categorized when sheet category is blank
    expect(items[2].category).toBe('Produits laitiers');
  });

  it('skips banner rows above the actual header', async () => {
    const buf = await buildXlsxBuffer(
      [['Banane', 'Fruits', 'kg', '2,40']],
      { banner: 'Tarifs Q4 2026 — Metro Paris' }
    );
    const items = await parseXlsxBuffer(buf);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Banane');
  });

  it('returns [] when no recognizable header is found', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bizarre');
    ws.addRow(['random', 'unrelated', 'cells']);
    ws.addRow(['more',   'random',     'data']);
    const buf = await wb.xlsx.writeBuffer();
    expect(await parseXlsxBuffer(buf)).toEqual([]);
  });

  it('defaults unit to kg when the column is missing', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tarifs');
    ws.addRow(['Désignation', 'Prix']);
    ws.addRow(['Sel fin', '0.80']);
    const buf = await wb.xlsx.writeBuffer();
    const items = await parseXlsxBuffer(buf);
    expect(items[0]).toMatchObject({ name: 'Sel fin', unit: 'kg', price: 0.8 });
  });
});

// ─── HTTP endpoints ──────────────────────────────────────────────────

describe('POST /api/supplier-portal/import-mercuriale', () => {
  it('returns 401 without an X-Supplier-Token header', async () => {
    const buf = await buildXlsxBuffer([['Tomate', 'Légumes', 'kg', '3.20']]);
    const res = await request(app)
      .post('/api/supplier-portal/import-mercuriale')
      .attach('mercuriale', buf, { filename: 'merc.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is attached', async () => {
    const session = createSupplierSession();
    const res = await request(app)
      .post('/api/supplier-portal/import-mercuriale')
      .set('X-Supplier-Token', session.token);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('parses an XLSX and tags items as new vs update', async () => {
    const session = createSupplierSession();

    // Pre-existing catalog row → second item in upload should come back as 'update'.
    run(
      `INSERT INTO supplier_catalog (restaurant_id, supplier_id, product_name, category, unit, price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session.restaurant_id, session.supplier_id, 'Tomate grappe', 'Légumes', 'kg', 2.5]
    );

    const buf = await buildXlsxBuffer([
      ['Crevettes roses', 'Poissons', 'kg', '18,50'],
      ['Tomate grappe',   'Légumes',  'kg', '3,20'],
      ['Banane bio',      'Fruits',   'kg', '2,40'],
    ]);

    const res = await request(app)
      .post('/api/supplier-portal/import-mercuriale')
      .set('X-Supplier-Token', session.token)
      .attach('mercuriale', buf, { filename: 'merc.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 3, new: 2, update: 1 });
    expect(res.body.categories).toContain('Viandes');

    const tomate = res.body.items.find(i => i.name === 'Tomate grappe');
    expect(tomate.status).toBe('update');
    expect(tomate.existing_price).toBe(2.5);
    const banane = res.body.items.find(i => i.name === 'Banane bio');
    expect(banane.status).toBe('new');
  });

  it('rejects an unsupported MIME type', async () => {
    const session = createSupplierSession();
    const res = await request(app)
      .post('/api/supplier-portal/import-mercuriale')
      .set('X-Supplier-Token', session.token)
      .attach('mercuriale', Buffer.from('not an excel'), {
        filename: 'evil.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(500); // multer throws → rendered by default error handler
  });
});

describe('POST /api/supplier-portal/save-mercuriale', () => {
  it('returns 401 without supplier token', async () => {
    const res = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .send({ items: [{ name: 'X', price: 1 }] });
    expect(res.status).toBe(401);
  });

  it('returns 400 when items is missing or empty', async () => {
    const session = createSupplierSession();
    const r1 = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', session.token)
      .send({});
    expect(r1.status).toBe(400);

    const r2 = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', session.token)
      .send({ items: [] });
    expect(r2.status).toBe(400);
  });

  it('inserts new rows + emits new notifications', async () => {
    const session = createSupplierSession();

    const res = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', session.token)
      .send({
        items: [
          { name: 'Carotte', category: 'Légumes', unit: 'kg', price: 1.20 },
          { name: 'Pomme',   category: 'Fruits',  unit: 'kg', price: 1.80 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, created: 2, updated: 0, total: 2 });

    const rows = all(
      'SELECT product_name, price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? ORDER BY product_name',
      [session.supplier_id, session.restaurant_id]
    );
    expect(rows.map(r => r.product_name)).toEqual(['Carotte', 'Pomme']);

    const notes = all(
      'SELECT product_name, change_type, old_price FROM price_change_notifications WHERE supplier_id = ? AND restaurant_id = ?',
      [session.supplier_id, session.restaurant_id]
    );
    expect(notes).toHaveLength(2);
    expect(notes.every(n => n.change_type === 'new' && n.old_price == null)).toBe(true);
  });

  it('updates existing rows + emits update notification only on price change', async () => {
    const session = createSupplierSession();
    run(
      `INSERT INTO supplier_catalog (restaurant_id, supplier_id, product_name, category, unit, price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session.restaurant_id, session.supplier_id, 'Carotte', 'Légumes', 'kg', 1.20]
    );

    const res = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', session.token)
      .send({
        items: [
          { name: 'Carotte', category: 'Légumes', unit: 'kg', price: 1.50 }, // price up → notification
          { name: 'Pomme',   category: 'Fruits',  unit: 'kg', price: 1.80 }, // new
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, created: 1, updated: 1, total: 2 });

    const carotte = get(
      'SELECT price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND product_name = ?',
      [session.supplier_id, session.restaurant_id, 'Carotte']
    );
    expect(carotte.price).toBe(1.50);

    const notes = all(
      `SELECT product_name, change_type, old_price, new_price
         FROM price_change_notifications
        WHERE supplier_id = ? AND restaurant_id = ?
        ORDER BY product_name`,
      [session.supplier_id, session.restaurant_id]
    );
    expect(notes).toHaveLength(2);
    const carotteNote = notes.find(n => n.product_name === 'Carotte');
    expect(carotteNote).toMatchObject({ change_type: 'update', old_price: 1.20, new_price: 1.50 });
  });

  it('matches existing rows case-insensitively (no duplicate insert on capitalization drift)', async () => {
    const session = createSupplierSession();
    run(
      `INSERT INTO supplier_catalog (restaurant_id, supplier_id, product_name, category, unit, price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session.restaurant_id, session.supplier_id, 'Tomate grappe', 'Légumes', 'kg', 2.50]
    );

    const res = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', session.token)
      .send({
        items: [
          { name: 'TOMATE GRAPPE', category: 'Légumes', unit: 'kg', price: 2.80 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: 0, updated: 1 });
    const rows = all(
      'SELECT product_name FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ?',
      [session.supplier_id, session.restaurant_id]
    );
    expect(rows).toHaveLength(1);
  });

  it('drops items with empty name or non-positive price', async () => {
    const session = createSupplierSession();

    const res = await request(app)
      .post('/api/supplier-portal/save-mercuriale')
      .set('X-Supplier-Token', session.token)
      .send({
        items: [
          { name: '',         category: 'Légumes', unit: 'kg', price: 1.0 }, // dropped
          { name: 'Carotte',  category: 'Légumes', unit: 'kg', price: 0 },   // dropped
          { name: 'Carotte',  category: 'Légumes', unit: 'kg', price: 1.5 }, // kept
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: 1, total: 1 });
  });
});
