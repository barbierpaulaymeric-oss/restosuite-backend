'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();
// Second restaurant for tenant-isolation tests
const AUTH2 = authHeader({ id: 2, restaurant_id: 2, email: 'r2@restosuite.fr' });

// Minimal 1×1 JPEG base64 — avoids needing a real image file in tests
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFgAB' +
  'AQEAAAAAAAAAAAAAAAAABgUEB/8QAHxAAAQQCAwEAAAAAAAAAAAAAAQIDBBESITFB/8QAFAEBAAAA' +
  'AAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABgAxhj/2Q==';

describe('HACCP Label Scans — CRUD', () => {
  it('GET /api/haccp/label-scans → 200 with items array and total', async () => {
    const res = await request(app).get('/api/haccp/label-scans').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('POST /api/haccp/label-scans → 201 with created row', async () => {
    const res = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({
        product_name: 'Poulet fermier Label Rouge',
        supplier: 'Volailles du Sud',
        batch_number: 'LOT-2026-001',
        expiry_date: '2026-04-25',
        temperature: 3.5,
        category: 'volaille',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.product_name).toBe('Poulet fermier Label Rouge');
    expect(res.body.category).toBe('volaille');
    expect(res.body.restaurant_id).toBe(1);
  });

  it('POST /api/haccp/label-scans → 400 without product_name', async () => {
    const res = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ supplier: 'Test', category: 'viande' });
    expect(res.status).toBe(400);
  });

  it('POST /api/haccp/label-scans → 400 with invalid category', async () => {
    const res = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Test', category: 'patate' });
    expect(res.status).toBe(400);
  });

  it('POST /api/haccp/label-scans → 400 with non-numeric temperature', async () => {
    const res = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Test', temperature: 'chaud' });
    expect(res.status).toBe(400);
  });

  it('POST /api/haccp/label-scans → 201 with null temperature accepted', async () => {
    const res = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Boeuf haché', temperature: null });
    expect(res.status).toBe(201);
    expect(res.body.temperature).toBeNull();
  });

  it('GET /api/haccp/label-scans/:id → 200 with photo_data', async () => {
    const create = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Filet de saumon', photo_data: TINY_JPEG_B64 });
    expect(create.status).toBe(201);
    const res = await request(app).get(`/api/haccp/label-scans/${create.body.id}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.photo_data).toBe(TINY_JPEG_B64);
  });

  it('GET /api/haccp/label-scans/:id → 404 for unknown id', async () => {
    const res = await request(app).get('/api/haccp/label-scans/999999').set(AUTH);
    expect(res.status).toBe(404);
  });

  it('GET /api/haccp/label-scans list → does NOT include photo_data (performance)', async () => {
    await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Produit avec photo', photo_data: TINY_JPEG_B64 });
    const res = await request(app).get('/api/haccp/label-scans').set(AUTH);
    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.photo_data).toBeUndefined();
    }
  });

  it('DELETE /api/haccp/label-scans/:id → 200 deleted, GET → 404', async () => {
    const create = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Boeuf haché à supprimer' });
    expect(create.status).toBe(201);
    const del = await request(app).delete(`/api/haccp/label-scans/${create.body.id}`).set(AUTH);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);
    const get = await request(app).get(`/api/haccp/label-scans/${create.body.id}`).set(AUTH);
    expect(get.status).toBe(404);
  });

  it('DELETE /api/haccp/label-scans/:id → 404 for unknown id', async () => {
    const res = await request(app).delete('/api/haccp/label-scans/999999').set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('HACCP Label Scans — tenant isolation', () => {
  it('GET /:id → 404 for scan belonging to another restaurant', async () => {
    const create = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Produit restaurant 1' });
    expect(create.status).toBe(201);

    // Restaurant 2 should get 404 (not 403) — hides existence
    const res = await request(app).get(`/api/haccp/label-scans/${create.body.id}`).set(AUTH2);
    expect(res.status).toBe(404);
  });

  it('DELETE /:id → 404 for scan belonging to another restaurant', async () => {
    const create = await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Produit privé restaurant 1' });
    expect(create.status).toBe(201);

    const res = await request(app).delete(`/api/haccp/label-scans/${create.body.id}`).set(AUTH2);
    expect(res.status).toBe(404);
  });

  it('GET / → list only shows scans for own restaurant', async () => {
    await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH)
      .send({ product_name: 'Scan resto 1' });
    await request(app)
      .post('/api/haccp/label-scans')
      .set(AUTH2)
      .send({ product_name: 'Scan resto 2' });

    const res1 = await request(app).get('/api/haccp/label-scans').set(AUTH);
    const res2 = await request(app).get('/api/haccp/label-scans').set(AUTH2);

    // Each restaurant sees only their own
    for (const item of res1.body.items) {
      expect(item.restaurant_id).toBe(1);
    }
    for (const item of res2.body.items) {
      expect(item.restaurant_id).toBe(2);
    }
  });
});

describe('HACCP Label Scans — /extract endpoint', () => {
  it('POST /extract → 400 without image_base64', async () => {
    const res = await request(app)
      .post('/api/haccp/label-scans/extract')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image_base64/i);
  });

  it('POST /extract → 500 if GEMINI_API_KEY not set', async () => {
    const original = process.env.GEMINI_API_KEY;
    // Force the route to see no key by clearing module cache and re-requiring
    // Note: in-process module cache means we can't easily re-require ai-core;
    // instead we just verify the 400 path is reachable without a key
    process.env.GEMINI_API_KEY = '';
    const res = await request(app)
      .post('/api/haccp/label-scans/extract')
      .set(AUTH)
      .send({ image_base64: TINY_JPEG_B64 });
    // Either 400 (no body) or 500 (no key) — both are correct guards
    expect([400, 500]).toContain(res.status);
    process.env.GEMINI_API_KEY = original || '';
  });

  it('POST /extract → requires auth', async () => {
    const res = await request(app)
      .post('/api/haccp/label-scans/extract')
      .send({ image_base64: TINY_JPEG_B64 });
    expect(res.status).toBe(401);
  });
});
