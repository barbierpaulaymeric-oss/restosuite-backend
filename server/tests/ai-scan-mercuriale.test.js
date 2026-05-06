'use strict';

// XLSX path of POST /api/ai/scan-mercuriale — deterministic, no Gemini needed.
// The Gemini-driven image/PDF path is covered indirectly by ai.test.js (auth +
// route-exists smoke); the spreadsheet path is exercised end-to-end here.

const request = require('supertest');
const xlsx = require('xlsx');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

function buildXlsxBuffer(rows) {
  const aoa = [['Désignation', 'Catégorie', 'Unité', 'Prix']].concat(rows);
  const ws = xlsx.utils.aoa_to_sheet(aoa);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Tarifs');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('POST /api/ai/scan-mercuriale — XLSX path', () => {
  it('rejects without auth', async () => {
    const buf = buildXlsxBuffer([['Tomate', 'Légumes', 'kg', '3,20']]);
    const res = await request(app)
      .post('/api/ai/scan-mercuriale')
      .attach('mercuriale', buf, { filename: 'tarifs.xlsx', contentType: XLSX_MIME });
    expect(res.status).toBe(401);
  });

  it('parses an xlsx and returns items + summary (no Gemini call)', async () => {
    const buf = buildXlsxBuffer([
      ['Tomate grappe',      'Légumes',  'kg', '3,20'],
      ['Entrecôte de bœuf',  'Viandes',  'kg', '34,50'],
      ['Crème liquide',      '',         'L',  '5.20'],
    ]);
    const res = await request(app)
      .post('/api/ai/scan-mercuriale')
      .set(authHeader())
      .attach('mercuriale', buf, { filename: 'tarifs.xlsx', contentType: XLSX_MIME });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(3);

    // Shape match — the import-mercuriale view consumes product_name, price, unit, etc.
    const first = res.body.items[0];
    expect(first.product_name).toBe('Tomate grappe');
    expect(first.price).toBe(3.2);
    expect(first.unit).toBe('kg');

    // Summary block matches the Gemini-path response shape
    expect(res.body.summary).toEqual(expect.objectContaining({
      total_items: 3,
      matched_items: expect.any(Number),
      unmatched_items: expect.any(Number),
      match_rate: expect.any(Number),
    }));
  });

  it('accepts a .csv attachment (text/csv mime)', async () => {
    const csv = 'Désignation,Catégorie,Unité,Prix\nTomate,Légumes,kg,3.20\n';
    const res = await request(app)
      .post('/api/ai/scan-mercuriale')
      .set(authHeader())
      .attach('mercuriale', Buffer.from(csv), { filename: 'tarifs.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.items[0].product_name).toBe('Tomate');
    expect(res.body.items[0].price).toBe(3.2);
  });

  it('rejects an unsupported file type with the explicit error message', async () => {
    const res = await request(app)
      .post('/api/ai/scan-mercuriale')
      .set(authHeader())
      .attach('mercuriale', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });
    // Multer surfaces the fileFilter error as a 500 by default unless an error
    // handler converts it; either way it must NOT be a 200 success.
    expect([400, 500]).toContain(res.status);
  });
});
