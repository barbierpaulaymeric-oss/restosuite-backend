'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('Allergens — auth', () => {
  it('GET /api/allergens/card-pdf → 401 without token', async () => {
    const res = await request(app).get('/api/allergens/card-pdf');
    expect(res.status).toBe(401);
  });
});

describe('Allergens — card PDF export', () => {
  it('GET /api/allergens/card-pdf → 200 PDF stream', async () => {
    const res = await request(app)
      .get('/api/allergens/card-pdf')
      .set(AUTH)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', c => chunks.push(c));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="fiche-allergenes-/);
    expect(res.headers['content-disposition']).toMatch(/\.pdf"$/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(500);
    // PDFs start with the magic bytes "%PDF-"
    expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('GET /api/allergens/card-pdf → filename is sanitized (no spaces, no accents)', async () => {
    const res = await request(app)
      .get('/api/allergens/card-pdf')
      .set(AUTH);

    const cd = res.headers['content-disposition'] || '';
    const match = cd.match(/filename="([^"]+)"/);
    expect(match).not.toBeNull();
    const filename = match[1];
    // Slug section between fiche-allergenes- and -YYYY-MM-DD.pdf must be a-z0-9-
    expect(filename).toMatch(/^fiche-allergenes-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
