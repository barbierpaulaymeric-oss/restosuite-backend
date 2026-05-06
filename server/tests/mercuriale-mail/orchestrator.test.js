'use strict';

require('../helpers/env');

const xlsx = require('xlsx');
const { db, get, run } = require('../../db');
const { runInboundCycle, dispatchOrderEmail } = require('../../lib/mercuriale-mail');

function makeXlsx(rows) {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'S');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

beforeAll(() => {
  // Use a high restaurant id to dodge any seeded rows from other tests.
  run(`INSERT INTO restaurants (id, name) VALUES (4242, 'TestZ')`);
  run(`INSERT INTO suppliers (id, name, email, restaurant_id) VALUES (9001, 'SupZ', 'supz@x.com', 4242)`);

  // FoodFlow scenario: shared sender, restaurants identified by name/email/external_id
  run(`INSERT INTO restaurants (id, name) VALUES (4243, 'TestRestoFlow')`);
  run(`INSERT INTO accounts (id, name, pin, role, email, restaurant_id) VALUES (9100, 'Owner', 'x', 'patron', 'owner@testrestoflow.com', 4243)`);
  run(`INSERT INTO suppliers (id, name, email, restaurant_id) VALUES (9101, 'FoodFlow', 'julie@foodflow.com', 4243)`);
  run(`INSERT INTO supplier_integrations (restaurant_id, supplier_id, provider, external_id, status) VALUES (4243, 9101, 'foodflow', 'FF-TRF-1', 'connected')`);

  // Second restaurant — same FoodFlow sender but different external_id
  run(`INSERT INTO restaurants (id, name) VALUES (4244, 'BistrotPi')`);
  run(`INSERT INTO suppliers (id, name, email, restaurant_id) VALUES (9201, 'FoodFlow', 'julie@foodflow.com', 4244)`);
  run(`INSERT INTO supplier_integrations (restaurant_id, supplier_id, provider, external_id, status) VALUES (4244, 9201, 'foodflow', 'FF-BPI-2', 'connected')`);

  // Third restaurant — content-only matching (no integration, no shared
  // supplier email) to exercise auto-create from "Fournisseur" column.
  run(`INSERT INTO restaurants (id, name) VALUES (4245, 'TestRestoSuite')`);
  run(`INSERT INTO accounts (id, name, pin, role, email, restaurant_id) VALUES (9300, 'Owner', 'x', 'patron', 'pa@testrestosuite.com', 4245)`);
});

afterAll(() => {
  // Best-effort cleanup so this file is rerunnable in --watch mode.
  try { run('DELETE FROM supplier_catalog WHERE restaurant_id IN (4242, 4243, 4244, 4245)'); } catch {}
  try { run('DELETE FROM supplier_integrations WHERE restaurant_id IN (4242, 4243, 4244, 4245)'); } catch {}
  try { run('DELETE FROM purchase_order_items WHERE restaurant_id = 4242'); } catch {}
  try { run('DELETE FROM purchase_orders WHERE restaurant_id = 4242'); } catch {}
  try { run('DELETE FROM suppliers WHERE restaurant_id IN (4242, 4243, 4244, 4245)'); } catch {}
  try { run('DELETE FROM accounts WHERE id IN (9100, 9300)'); } catch {}
  try { run('DELETE FROM restaurants WHERE id IN (4242, 4243, 4244, 4245)'); } catch {}
});

describe('runInboundCycle — content-based routing', () => {
  test('legacy sender match still works (no identifiers, sender → suppliers.email)', async () => {
    const fetchFn = async () => [{
      uid: 1, from: 'supz@x.com', subject: 'Mercu', date: new Date(),
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Produit', 'Unité', 'Prix HT'],
        ['Splazmagork rouge', 'kg', '3,20'],
        ['Zorglub bio', 'kg', '4,50'],
      ]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.processed).toBe(1);
    expect(r.matched).toBe(1);
    expect(r.items_upserted).toBe(2);
    const rows = db.prepare(`SELECT product_name, price FROM supplier_catalog WHERE supplier_id = 9001 ORDER BY product_name`).all();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const names = rows.map(r => r.product_name);
    expect(names).toEqual(expect.arrayContaining(['Splazmagork rouge', 'Zorglub bio']));
  });

  test('skips email when no content match and no sender match', async () => {
    const fetchFn = async () => [{
      uid: 2, from: 'noone@x.com', attachments: [{ filename: 'm.xlsx', content: makeXlsx([['Produit', 'Prix HT'], ['x', '1']]) }],
    }];
    const r = await runInboundCycle({ fetchFn, sendAlertFn: async () => ({}) });
    expect(r.processed).toBe(1);
    expect(r.matched).toBe(0);
    expect(r.unmatched_alerts).toBe(1);
  });

  test('continues to next email when one has no attachment', async () => {
    const fetchFn = async () => [
      { uid: 3, from: 'supz@x.com', attachments: null },
      { uid: 4, from: 'supz@x.com', attachments: [{ filename: 'm.xlsx', content: makeXlsx([['Produit', 'Prix HT'], ['Zorglub bio', '5']]) }] },
    ];
    const r = await runInboundCycle({ fetchFn, sendAlertFn: async () => ({}) });
    expect(r.processed).toBe(2);
    expect(r.matched).toBe(1);
  });

  test('FoodFlow shared sender: routes by external_id in subject to TestRestoFlow', async () => {
    const fetchFn = async () => [{
      uid: 100,
      from: 'julie@foodflow.com',
      subject: 'Mercuriale FF-TRF-1 — semaine 18',
      text: '',
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Produit', 'Unité', 'Prix HT'],
        ['Croustimorglu', 'kg', '7,40'],
      ]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.processed).toBe(1);
    expect(r.matched).toBe(1);
    expect(r.items_upserted).toBe(1);

    const row = get(
      `SELECT product_name FROM supplier_catalog WHERE supplier_id = 9101 AND restaurant_id = 4243 AND product_name = 'Croustimorglu'`
    );
    expect(row).toBeTruthy();

    // Wrong restaurant must NOT receive this catalog
    const wrongRow = get(
      `SELECT product_name FROM supplier_catalog WHERE supplier_id = 9201 AND restaurant_id = 4244 AND product_name = 'Croustimorglu'`
    );
    expect(wrongRow).toBeFalsy();
  });

  test('FoodFlow shared sender: external_id in Excel banner routes to BistrotPi', async () => {
    const fetchFn = async () => [{
      uid: 101,
      from: 'julie@foodflow.com',
      subject: 'Mercuriale',
      text: '',
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Tarifs FoodFlow — référence : FF-BPI-2'],
        [''],
        ['Produit', 'Unité', 'Prix HT'],
        ['Splazmagork bleu', 'kg', '9,90'],
      ]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.matched).toBe(1);
    const row = get(
      `SELECT product_name FROM supplier_catalog WHERE supplier_id = 9201 AND restaurant_id = 4244 AND product_name = 'Splazmagork bleu'`
    );
    expect(row).toBeTruthy();
  });

  test('FoodFlow shared sender: account email in body routes to TestRestoFlow', async () => {
    const fetchFn = async () => [{
      uid: 102,
      from: 'julie@foodflow.com',
      subject: 'Mercuriale',
      text: 'Bonjour, voici la mercuriale pour owner@testrestoflow.com',
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Produit', 'Unité', 'Prix HT'],
        ['Tarte Frumblegrumble', 'pce', '4,20'],
      ]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.matched).toBe(1);
    const row = get(
      `SELECT product_name FROM supplier_catalog WHERE supplier_id = 9101 AND restaurant_id = 4243 AND product_name = 'Tarte Frumblegrumble'`
    );
    expect(row).toBeTruthy();
  });

  test('content match auto-creates supplier from "Fournisseur" column when none exists', async () => {
    // No integration, no existing "Foodflow" supplier on TestRestoSuite
    // — restaurant matches by name in subject, supplier by Excel column.
    const fetchFn = async () => [{
      uid: 200,
      from: 'anyone@can-send-this.com',
      subject: 'Mercuriale TestRestoSuite',
      text: 'Voici la mercuriale pour TestRestoSuite (référence client : 89764)',
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Désignation', 'Fournisseur', 'Unité', 'Prix HT'],
        ['Quibblesnort', 'Foodflow', 'kg', '12,80'],
        ['Wibblepop', 'Foodflow', 'kg', '4,40'],
      ]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.matched).toBe(1);
    expect(r.suppliers_created).toBe(1);
    expect(r.items_upserted).toBe(2);

    const supplier = get(
      `SELECT id, name FROM suppliers WHERE restaurant_id = 4245 AND LOWER(name) = 'foodflow'`
    );
    expect(supplier).toBeTruthy();

    const rows = db.prepare(
      `SELECT product_name FROM supplier_catalog WHERE restaurant_id = 4245 AND supplier_id = ? ORDER BY product_name`
    ).all(supplier.id);
    expect(rows.map(r => r.product_name)).toEqual(['Quibblesnort', 'Wibblepop']);
  });

  test('second mail with same supplier name reuses existing row (no double-create)', async () => {
    const fetchFn = async () => [{
      uid: 201,
      from: 'still-anyone@can-send.com',
      subject: 'Mercuriale TestRestoSuite — semaine 19',
      text: 'pour TestRestoSuite',
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Désignation', 'Fournisseur', 'Unité', 'Prix HT'],
        ['Glomboflux', 'Foodflow', 'kg', '6,60'],
      ]) }],
    }];
    const before = db.prepare(
      `SELECT COUNT(*) AS n FROM suppliers WHERE restaurant_id = 4245 AND LOWER(name) = 'foodflow'`
    ).get();
    const r = await runInboundCycle({ fetchFn });
    expect(r.matched).toBe(1);
    expect(r.suppliers_created).toBe(0);
    const after = db.prepare(
      `SELECT COUNT(*) AS n FROM suppliers WHERE restaurant_id = 4245 AND LOWER(name) = 'foodflow'`
    ).get();
    expect(after.n).toBe(before.n);
  });

  test('content match wins over legacy sender — no double-import to TestZ', async () => {
    // Sender is supz@x.com (matches TestZ supplier 9001 in legacy fallback)
    // BUT body says "pour TestRestoSuite" → must route to TestRestoSuite,
    // NOT TestZ. Catches the regression where step 1 fell through to step 2.
    const before = db.prepare(
      `SELECT COUNT(*) AS n FROM supplier_catalog WHERE restaurant_id = 4242 AND product_name = 'Plumblegrunt'`
    ).get();
    const fetchFn = async () => [{
      uid: 202,
      from: 'supz@x.com',
      subject: 'Mercuriale',
      text: 'pour TestRestoSuite',
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Désignation', 'Fournisseur', 'Unité', 'Prix HT'],
        ['Plumblegrunt', 'Foodflow', 'kg', '7,77'],
      ]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.matched).toBe(1);
    const after = db.prepare(
      `SELECT COUNT(*) AS n FROM supplier_catalog WHERE restaurant_id = 4242 AND product_name = 'Plumblegrunt'`
    ).get();
    expect(after.n).toBe(before.n);
    const trsRow = get(
      `SELECT product_name FROM supplier_catalog WHERE restaurant_id = 4245 AND product_name = 'Plumblegrunt'`
    );
    expect(trsRow).toBeTruthy();
  });

  test('no match: forwards alert with extracted identifiers to admin', async () => {
    const alerts = [];
    const fetchFn = async () => [{
      uid: 300,
      from: 'someone@unknown.com',
      subject: 'Mercuriale mystère',
      text: 'Restaurant : NotARealRestaurant\nID: 99999',
      attachments: [{ filename: 'm.xlsx', content: makeXlsx([
        ['Désignation', 'Fournisseur', 'Prix HT'],
        ['Foo', 'GhostSupplier', '1,00'],
      ]) }],
    }];
    const r = await runInboundCycle({
      fetchFn,
      sendAlertFn: async (args) => { alerts.push(args); return { ok: true }; },
    });
    expect(r.processed).toBe(1);
    expect(r.matched).toBe(0);
    expect(r.unmatched_alerts).toBe(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].to).toBe('barbierpaulaymeric@gmail.com');
    expect(alerts[0].subject).toMatch(/mercuriale|rattach|match/i);
    const body = String(alerts[0].text || alerts[0].html);
    expect(body).toContain('someone@unknown.com');
    expect(body).toContain('NotARealRestaurant');
    expect(body).toContain('99999');
    expect(body).toContain('GhostSupplier');
    expect(body).toMatch(/identifiants? extraits?/i);
  });
});

describe('dispatchOrderEmail', () => {
  beforeEach(() => {
    try { run(`DELETE FROM supplier_integrations WHERE restaurant_id = 4242`); } catch {}
  });

  test('sends with no integration when supplier has email', async () => {
    const calls = [];
    const sendFn = async (args) => { calls.push(args); return { messageId: 'm1' }; };
    run(`INSERT INTO purchase_orders (id, restaurant_id, supplier_id, reference, status, total_amount)
         VALUES (50001, 4242, 9001, 'PO-T-1', 'envoyée', 50.0)`);
    run(`INSERT INTO purchase_order_items (purchase_order_id, restaurant_id, product_name, quantity, unit, unit_price, total_price)
         VALUES (50001, 4242, 'Zorglub bio', 5, 'kg', 10, 50)`);
    const r = await dispatchOrderEmail({ rid: 4242, supplier_id: 9001, po_id: 50001, sendFn });
    expect(r.ok).toBe(true);
    expect(r.to).toBe('supz@x.com');
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe('supz@x.com');
    expect(Buffer.isBuffer(calls[0].xlsxBuffer)).toBe(true);
  });

  test('includes external_id from supplier_integrations when present', async () => {
    run(`INSERT INTO supplier_integrations (restaurant_id, supplier_id, provider, external_id, status)
         VALUES (4242, 9001, 'foodflow', 'FF-Z-9', 'connected')`);
    run(`INSERT INTO purchase_orders (id, restaurant_id, supplier_id, reference, status, total_amount)
         VALUES (50002, 4242, 9001, 'PO-T-2', 'envoyée', 50)`);
    run(`INSERT INTO purchase_order_items (purchase_order_id, restaurant_id, product_name, quantity, unit, unit_price, total_price)
         VALUES (50002, 4242, 'X', 1, 'kg', 50, 50)`);
    let captured = null;
    await dispatchOrderEmail({ rid: 4242, supplier_id: 9001, po_id: 50002, sendFn: async (a) => { captured = a; } });
    expect(captured).not.toBeNull();
    const wb = xlsx.read(captured.xlsxBuffer, { type: 'buffer' });
    const flat = JSON.stringify(xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }));
    expect(flat).toContain('FF-Z-9');
  });

  test('returns ok:false when supplier has no email', async () => {
    run(`INSERT INTO suppliers (id, name, email, restaurant_id) VALUES (9002, 'NoMail', NULL, 4242)`);
    run(`INSERT INTO purchase_orders (id, restaurant_id, supplier_id, reference, status, total_amount)
         VALUES (50003, 4242, 9002, 'PO-T-3', 'envoyée', 0)`);
    const r = await dispatchOrderEmail({ rid: 4242, supplier_id: 9002, po_id: 50003, sendFn: async () => ({}) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/email/i);
  });
});
