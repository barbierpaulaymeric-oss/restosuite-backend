'use strict';

const xlsx = require('xlsx');
const { buildOrderXlsx } = require('../../lib/mercuriale-mail/build-outbound');

const RESTAURANT = { id: 1, name: 'TestRestoSuite' };
const SUPPLIER = { id: 7, name: 'Metro Paris', email: 'sup@x.com' };
const PO = { reference: 'PO-2026-0001', total_amount: 123.45, sent_at: '2026-05-05 10:00:00' };
const ITEMS = [
  { product_name: 'Tomate', quantity: 5, unit: 'kg', unit_price: 2.5, total_price: 12.5 },
  { product_name: 'Carotte', quantity: 3, unit: 'kg', unit_price: 1.8, total_price: 5.4 },
];

function readSheet(buf) {
  const wb = xlsx.read(buf, { type: 'buffer' });
  return xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
}

describe('buildOrderXlsx', () => {
  test('returns a non-empty Buffer', () => {
    const buf = buildOrderXlsx({ restaurant: RESTAURANT, supplier: SUPPLIER, integration: null, po: PO, items: ITEMS });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });

  test('includes restaurant name + PO reference + supplier name', () => {
    const buf = buildOrderXlsx({ restaurant: RESTAURANT, supplier: SUPPLIER, integration: null, po: PO, items: ITEMS });
    const flat = JSON.stringify(readSheet(buf));
    expect(flat).toContain('TestRestoSuite');
    expect(flat).toContain('PO-2026-0001');
    expect(flat).toContain('Metro Paris');
  });

  test('omits external_id row when no integration', () => {
    const buf = buildOrderXlsx({ restaurant: RESTAURANT, supplier: SUPPLIER, integration: null, po: PO, items: ITEMS });
    expect(JSON.stringify(readSheet(buf))).not.toContain('FoodFlow ID');
  });

  test('includes external_id when integration provided', () => {
    const buf = buildOrderXlsx({
      restaurant: RESTAURANT, supplier: SUPPLIER,
      integration: { provider: 'foodflow', external_id: 'FF-METRO-42' },
      po: PO, items: ITEMS,
    });
    const flat = JSON.stringify(readSheet(buf));
    expect(flat).toContain('FoodFlow ID');
    expect(flat).toContain('FF-METRO-42');
  });

  test('one row per item with name+qty+unit+price', () => {
    const buf = buildOrderXlsx({ restaurant: RESTAURANT, supplier: SUPPLIER, integration: null, po: PO, items: ITEMS });
    const rows = readSheet(buf);
    const tomateRow = rows.find(r => Array.isArray(r) && r.includes('Tomate'));
    expect(tomateRow).toBeDefined();
    expect(tomateRow).toEqual(expect.arrayContaining([5, 'kg', 2.5]));
  });
});
