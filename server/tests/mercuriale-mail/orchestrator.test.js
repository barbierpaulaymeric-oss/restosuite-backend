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
});

afterAll(() => {
  // Best-effort cleanup so this file is rerunnable in --watch mode.
  try { run('DELETE FROM supplier_catalog WHERE supplier_id IN (9001, 9002)'); } catch {}
  try { run('DELETE FROM supplier_integrations WHERE restaurant_id = 4242'); } catch {}
  try { run('DELETE FROM purchase_order_items WHERE restaurant_id = 4242'); } catch {}
  try { run('DELETE FROM purchase_orders WHERE restaurant_id = 4242'); } catch {}
  try { run('DELETE FROM suppliers WHERE id IN (9001, 9002)'); } catch {}
  try { run('DELETE FROM restaurants WHERE id = 4242'); } catch {}
});

describe('runInboundCycle', () => {
  test('upserts items into supplier_catalog when sender matches', async () => {
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

  test('skips email when no supplier matches', async () => {
    const fetchFn = async () => [{
      uid: 2, from: 'noone@x.com', attachments: [{ filename: 'm.xlsx', content: makeXlsx([['Produit', 'Prix HT'], ['x', '1']]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.processed).toBe(1);
    expect(r.matched).toBe(0);
  });

  test('continues to next email when one has no attachment', async () => {
    const fetchFn = async () => [
      { uid: 3, from: 'supz@x.com', attachments: null },
      { uid: 4, from: 'supz@x.com', attachments: [{ filename: 'm.xlsx', content: makeXlsx([['Produit', 'Prix HT'], ['Zorglub bio', '5']]) }] },
    ];
    const r = await runInboundCycle({ fetchFn });
    expect(r.processed).toBe(2);
    expect(r.matched).toBe(1);
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
