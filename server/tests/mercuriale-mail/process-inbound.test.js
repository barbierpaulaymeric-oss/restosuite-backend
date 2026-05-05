'use strict';

const { processInbound } = require('../../lib/mercuriale-mail/process-inbound');
const xlsx = require('xlsx');

function makeXlsx(rows) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const SAMPLE_BUFFER = makeXlsx([
  ['Code', 'Produit', 'Unité', 'Prix HT'],
  ['SKU-001', 'Tomate ronde', 'kg', '2,50'],
  ['SKU-002', 'Carotte bio', 'kg', '1.80 €'],
]);

describe('processInbound', () => {
  test('returns no_attachment when email has no attachments', () => {
    const r = processInbound({
      email: { from: 'sup@x.com', attachments: [] },
      restaurantId: 1,
      lookupSupplier: () => ({ id: 7 }),
    });
    expect(r).toEqual({ ok: false, reason: 'no_attachment' });
  });

  test('returns no_match when sender email not in suppliers', () => {
    const r = processInbound({
      email: { from: 'unknown@x.com', attachments: [{ filename: 'm.xlsx', content: SAMPLE_BUFFER }] },
      restaurantId: 1,
      lookupSupplier: () => null,
    });
    expect(r).toEqual({ ok: false, reason: 'no_match' });
  });

  test('returns no_items when xlsx has no parseable rows', () => {
    const empty = makeXlsx([['junk']]);
    const r = processInbound({
      email: { from: 'sup@x.com', attachments: [{ filename: 'm.xlsx', content: empty }] },
      restaurantId: 1,
      lookupSupplier: () => ({ id: 7 }),
    });
    expect(r).toEqual({ ok: false, reason: 'no_items' });
  });

  test('returns parsed items + supplierId on happy path, lowercases sender', () => {
    let captured = {};
    const r = processInbound({
      email: { from: 'SUP@X.com', attachments: [{ filename: 'm.xlsx', content: SAMPLE_BUFFER }] },
      restaurantId: 1,
      lookupSupplier: (em, rid) => { captured = { em, rid }; return { id: 7 }; },
    });
    expect(captured.em).toBe('sup@x.com');
    expect(captured.rid).toBe(1);
    expect(r.ok).toBe(true);
    expect(r.supplierId).toBe(7);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ name: 'Tomate ronde', price: 2.5, sku: 'SKU-001' });
  });

  test('picks first xlsx-like attachment, ignores .pdf', () => {
    const r = processInbound({
      email: {
        from: 'sup@x.com',
        attachments: [
          { filename: 'doc.pdf', content: Buffer.from('PDF') },
          { filename: 'mercu.xlsx', content: SAMPLE_BUFFER },
        ],
      },
      restaurantId: 1,
      lookupSupplier: () => ({ id: 7 }),
    });
    expect(r.ok).toBe(true);
    expect(r.items.length).toBeGreaterThan(0);
  });
});
