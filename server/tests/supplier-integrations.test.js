'use strict';

// Supplier-side external provider integration (FoodFlow first; pluggable for
// Metro/Transgourmet later). Covers:
//   - lib/integrations/foodflow: authenticate / fetchMercuriale / postOrder contract
//   - POST /api/supplier-integrations: connect + tenant-scoped supplier check + dup-409
//   - GET /api/supplier-integrations: list scoped to tenant
//   - GET /api/supplier-integrations/:id: 404 cross-tenant
//   - POST /api/supplier-integrations/:id/sync: upsert into supplier_catalog +
//     last_sync_at + audit
//   - DELETE /api/supplier-integrations/:id: disconnect + audit + 404 cross-tenant
//
// FoodFlow's adapter ships in v1 as a file-import shim — the route accepts items[]
// in the body (provided by the existing mercuriale upload UI tagged provider=foodflow)
// and the adapter normalizes them. Swapping in a real HTTP client is a single-file
// change with zero route impact.

const request = require('supertest');
const app = require('../app');
const { run, get, all } = require('../db');
const { authHeader } = require('./helpers/auth');

let RID_A, RID_B, SUP_A, SUP_B;

function tag() { return Math.random().toString(36).slice(2, 8); }

beforeAll(() => {
  const t = tag();
  RID_A = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Integ Test A ${t}`]
  ).lastInsertRowid;
  RID_B = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Integ Test B ${t}`]
  ).lastInsertRowid;
  SUP_A = run(
    `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
    [`Sup A ${t}`, RID_A]
  ).lastInsertRowid;
  SUP_B = run(
    `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
    [`Sup B ${t}`, RID_B]
  ).lastInsertRowid;
});

function authA() { return authHeader({ id: 100, role: 'gerant', restaurant_id: RID_A }); }
function authB() { return authHeader({ id: 200, role: 'gerant', restaurant_id: RID_B }); }

// ─── Adapter contract ────────────────────────────────────────────────

describe('lib/integrations/foodflow', () => {
  const foodflow = require('../lib/integrations/foodflow');

  it('exposes the provider contract: name + authenticate + fetchMercuriale + postOrder', () => {
    expect(foodflow.name).toBe('foodflow');
    expect(typeof foodflow.authenticate).toBe('function');
    expect(typeof foodflow.fetchMercuriale).toBe('function');
    expect(typeof foodflow.postOrder).toBe('function');
  });

  describe('authenticate()', () => {
    it('rejects empty external_id', async () => {
      const r = await foodflow.authenticate({ external_id: '' });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/FoodFlow/i);
    });

    it('accepts the 5-digit numeric client number the UI mandates', async () => {
      const r = await foodflow.authenticate({ external_id: '89764' });
      expect(r.ok).toBe(true);
    });

    it('rejects a genuinely malformed external_id', async () => {
      expect((await foodflow.authenticate({ external_id: 'ab' })).ok).toBe(false);       // too short / non-numeric
      expect((await foodflow.authenticate({ external_id: 'FF 1' })).ok).toBe(false);     // space
      expect((await foodflow.authenticate({ external_id: '12' })).ok).toBe(false);       // < 3 digits
    });

    it('still accepts a legacy FF-XXXX id', async () => {
      const r = await foodflow.authenticate({ external_id: 'FF-METRO-42' });
      expect(r.ok).toBe(true);
    });
  });

  describe('fetchMercuriale()', () => {
    it('returns ok=false when items[] is missing (v1 file-import shim)', async () => {
      const r = await foodflow.fetchMercuriale({ external_id: 'FF-1' });
      expect(r.ok).toBe(false);
    });

    it('normalizes items: drops empty names + non-positive prices', async () => {
      const r = await foodflow.fetchMercuriale({
        external_id: 'FF-1',
        items: [
          { name: 'Tomate', category: 'Légumes', unit: 'kg', price: 3.20 },
          { name: '',       category: 'X',        unit: 'kg', price: 1 },     // drop
          { name: 'NoPrice', category: 'X',       unit: 'kg', price: 0 },     // drop
          { name: 'Pomme',  category: 'Fruits',   unit: 'kg', price: 1.80 },
        ],
      });
      expect(r.ok).toBe(true);
      expect(r.items).toHaveLength(2);
      expect(r.items.map(i => i.name).sort()).toEqual(['Pomme', 'Tomate']);
    });

    it('preserves provider-supplied sku for stable matching', async () => {
      const r = await foodflow.fetchMercuriale({
        external_id: 'FF-1',
        items: [{ name: 'Tomate', sku: 'FF-T01', price: 3.2, unit: 'kg' }],
      });
      expect(r.ok).toBe(true);
      expect(r.items[0].sku).toBe('FF-T01');
    });
  });

  describe('postOrder()', () => {
    it('returns a synthetic external_ref derived from the PO reference', async () => {
      const r = await foodflow.postOrder({
        external_id: 'FF-1',
        order: { reference: 'PO-20260505-001', total_amount: 123.45, items: [] },
      });
      expect(r.ok).toBe(true);
      expect(r.external_ref).toMatch(/PO-20260505-001/);
      expect(r.status).toBe('pending_dispatch');
    });

    it('returns ok=false when reference missing', async () => {
      const r = await foodflow.postOrder({ external_id: 'FF-1', order: {} });
      expect(r.ok).toBe(false);
    });
  });
});

// ─── HTTP endpoints ──────────────────────────────────────────────────

describe('POST /api/supplier-integrations — connect', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/supplier-integrations')
      .send({ supplier_id: SUP_A, provider: 'foodflow', external_id: 'FF-1' });
    expect(res.status).toBe(401);
  });

  it('connects FoodFlow and returns 201 with the row', async () => {
    const res = await request(app)
      .post('/api/supplier-integrations')
      .set(authA())
      .send({ supplier_id: SUP_A, provider: 'foodflow', external_id: 'FF-CONNECT-1' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      supplier_id: SUP_A,
      provider: 'foodflow',
      external_id: 'FF-CONNECT-1',
      status: 'connected',
    });
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('rejects supplier_id from another tenant with 404 (hides id existence)', async () => {
    const res = await request(app)
      .post('/api/supplier-integrations')
      .set(authA())
      .send({ supplier_id: SUP_B, provider: 'foodflow', external_id: 'FF-X' });
    expect(res.status).toBe(404);
  });

  it('rejects unknown provider with 400', async () => {
    const res = await request(app)
      .post('/api/supplier-integrations')
      .set(authA())
      .send({ supplier_id: SUP_A, provider: 'thefork', external_id: 'TF-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/provider/i);
  });

  it('rejects malformed external_id (adapter authenticate() rejects)', async () => {
    const res = await request(app)
      .post('/api/supplier-integrations')
      .set(authA())
      .send({ supplier_id: SUP_A, provider: 'foodflow', external_id: 'wrong-format' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when (supplier, provider) already connected', async () => {
    const t = tag();
    const sid = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup dup ${t}`, RID_A]).lastInsertRowid;
    await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sid, provider: 'foodflow', external_id: 'FF-DUP-1' });
    const res = await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sid, provider: 'foodflow', external_id: 'FF-DUP-2' });
    expect(res.status).toBe(409);
  });

  it('writes an audit_log row on connect', async () => {
    const t = tag();
    const sid = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup audit ${t}`, RID_A]).lastInsertRowid;
    const before = get('SELECT COUNT(*) as c FROM audit_log WHERE table_name = ? AND restaurant_id = ?', ['supplier_integrations', RID_A]).c;
    const res = await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sid, provider: 'foodflow', external_id: 'FF-AUDIT-1' });
    expect(res.status).toBe(201);
    const after = get('SELECT COUNT(*) as c FROM audit_log WHERE table_name = ? AND restaurant_id = ?', ['supplier_integrations', RID_A]).c;
    expect(after).toBe(before + 1);
  });
});

describe('GET /api/supplier-integrations — list (tenant-scoped)', () => {
  it('lists only the caller tenant rows', async () => {
    const t = tag();
    const sidA = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup list A ${t}`, RID_A]).lastInsertRowid;
    const sidB = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup list B ${t}`, RID_B]).lastInsertRowid;
    await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sidA, provider: 'foodflow', external_id: `FF-LA-${t}` });
    await request(app).post('/api/supplier-integrations').set(authB())
      .send({ supplier_id: sidB, provider: 'foodflow', external_id: `FF-LB-${t}` });

    const a = await request(app).get('/api/supplier-integrations').set(authA());
    expect(a.status).toBe(200);
    const ids = a.body.map(r => r.external_id);
    expect(ids).toContain(`FF-LA-${t}`);
    expect(ids).not.toContain(`FF-LB-${t}`);
  });
});

describe('GET /api/supplier-integrations/:id — read', () => {
  let integId;
  beforeAll(async () => {
    const t = tag();
    const sid = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup read ${t}`, RID_A]).lastInsertRowid;
    const r = await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sid, provider: 'foodflow', external_id: `FF-READ-${t}` });
    integId = r.body.id;
  });

  it('returns the row to the owning tenant', async () => {
    const r = await request(app).get(`/api/supplier-integrations/${integId}`).set(authA());
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(integId);
  });

  it('returns 404 to a different tenant', async () => {
    const r = await request(app).get(`/api/supplier-integrations/${integId}`).set(authB());
    expect(r.status).toBe(404);
  });
});

describe('POST /api/supplier-integrations/:id/sync — pull mercuriale', () => {
  let integId, supplierId;
  beforeAll(async () => {
    const t = tag();
    supplierId = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup sync ${t}`, RID_A]).lastInsertRowid;
    const r = await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: supplierId, provider: 'foodflow', external_id: `FF-SYNC-${t}` });
    integId = r.body.id;
  });

  it('upserts items into supplier_catalog (new + update)', async () => {
    // Pre-existing row → second item should come back as updated.
    run(
      `INSERT INTO supplier_catalog (restaurant_id, supplier_id, product_name, category, unit, price)
       VALUES (?, ?, 'Tomate grappe', 'Légumes', 'kg', 2.50)`,
      [RID_A, supplierId]
    );

    const res = await request(app)
      .post(`/api/supplier-integrations/${integId}/sync`)
      .set(authA())
      .send({
        items: [
          { name: 'Crevettes roses', category: 'Poissons', unit: 'kg', price: 18.50 },
          { name: 'Tomate grappe',   category: 'Légumes',  unit: 'kg', price: 3.20 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, created: 1, updated: 1, total: 2 });

    const tomate = get(
      `SELECT price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(product_name) = 'tomate grappe'`,
      [supplierId, RID_A]
    );
    expect(tomate.price).toBe(3.20);
  });

  it('records last_sync_at and clears last_sync_error', async () => {
    const before = get('SELECT last_sync_at FROM supplier_integrations WHERE id = ?', [integId]);
    expect(before.last_sync_at).toBeTruthy();
    const errorish = get('SELECT last_sync_error FROM supplier_integrations WHERE id = ?', [integId]);
    expect(errorish.last_sync_error).toBeNull();
  });

  it('returns 400 with adapter error when items missing', async () => {
    const res = await request(app)
      .post(`/api/supplier-integrations/${integId}/sync`)
      .set(authA())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 404 for a different tenant', async () => {
    const res = await request(app)
      .post(`/api/supplier-integrations/${integId}/sync`)
      .set(authB())
      .send({ items: [{ name: 'X', price: 1, unit: 'kg' }] });
    expect(res.status).toBe(404);
  });

  it('writes an audit_log row on each successful sync', async () => {
    const before = get(
      `SELECT COUNT(*) as c FROM audit_log WHERE table_name = ? AND record_id = ? AND action = 'update' AND restaurant_id = ?`,
      ['supplier_integrations', integId, RID_A]
    ).c;
    const res = await request(app).post(`/api/supplier-integrations/${integId}/sync`).set(authA())
      .send({ items: [{ name: 'Carotte', category: 'Légumes', unit: 'kg', price: 1.20 }] });
    expect(res.status).toBe(200);
    const after = get(
      `SELECT COUNT(*) as c FROM audit_log WHERE table_name = ? AND record_id = ? AND action = 'update' AND restaurant_id = ?`,
      ['supplier_integrations', integId, RID_A]
    ).c;
    expect(after).toBe(before + 1);
  });
});

describe('DELETE /api/supplier-integrations/:id — disconnect', () => {
  it('deletes the row and writes an audit', async () => {
    const t = tag();
    const sid = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup del ${t}`, RID_A]).lastInsertRowid;
    const r = await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sid, provider: 'foodflow', external_id: `FF-DEL-${t}` });
    const id = r.body.id;

    const del = await request(app).delete(`/api/supplier-integrations/${id}`).set(authA());
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ deleted: true });

    const gone = get('SELECT id FROM supplier_integrations WHERE id = ?', [id]);
    expect(gone).toBeUndefined();

    const audit = get(
      `SELECT COUNT(*) as c FROM audit_log WHERE table_name = ? AND record_id = ? AND action = 'delete' AND restaurant_id = ?`,
      ['supplier_integrations', id, RID_A]
    ).c;
    expect(audit).toBe(1);
  });

  it('returns 404 when called from a different tenant', async () => {
    const t = tag();
    const sid = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup del2 ${t}`, RID_A]).lastInsertRowid;
    const r = await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sid, provider: 'foodflow', external_id: `FF-DEL2-${t}` });
    const id = r.body.id;

    const del = await request(app).delete(`/api/supplier-integrations/${id}`).set(authB());
    expect(del.status).toBe(404);

    // Row still there
    const still = get('SELECT id FROM supplier_integrations WHERE id = ?', [id]);
    expect(still).toBeDefined();
  });
});

// ─── Order dispatch hook ─────────────────────────────────────────────
// When a PO transitions to 'envoyée' and the supplier has an active foodflow
// integration, the system dispatches the order via the adapter and records the
// attempt as a 'dispatch' audit row. Failures must NOT roll back the transition.

describe('purchase-orders → FoodFlow dispatch hook', () => {
  let supplierId;
  beforeAll(async () => {
    const t = tag();
    supplierId = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup hook ${t}`, RID_A]).lastInsertRowid;
    await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: supplierId, provider: 'foodflow', external_id: `FF-HOOK-${t}` });
  });

  it('writes a dispatch audit row when a PO is sent (status→envoyée)', async () => {
    // Create a draft PO directly in DB so we can flip status via PUT.
    const ref = `PO-HOOK-${tag()}`;
    const poId = run(
      `INSERT INTO purchase_orders (supplier_id, reference, total_amount, status, restaurant_id)
       VALUES (?, ?, 50.0, 'brouillon', ?)`,
      [supplierId, ref, RID_A]
    ).lastInsertRowid;

    const res = await request(app)
      .put(`/api/purchase-orders/${poId}`)
      .set(authA())
      .send({ status: 'envoyée' });
    expect(res.status).toBe(200);

    const audit = all(
      `SELECT * FROM audit_log
       WHERE restaurant_id = ? AND table_name = 'purchase_orders' AND record_id = ? AND action = 'update'
       ORDER BY id DESC`,
      [RID_A, poId]
    );
    // At least one audit row should mention foodflow dispatch in new_values.
    const dispatch = audit.find(a => (a.new_values || '').includes('foodflow'));
    expect(dispatch).toBeDefined();
  });
});

// ─── Pre-flight gate: block PO send when integration is half-configured ──────
// Spec: if a supplier has a row in supplier_integrations whose external_id is
// empty/missing, sending a PO must 400 with code='INTEGRATION_NOT_CONFIGURED'
// and a French message that points the user at /supplier-integrations.

describe('purchase-orders → integration external_id gate', () => {
  it('blocks status→envoyée with 400 when external_id is empty', async () => {
    const t = tag();
    const sid = run(
      `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
      [`Sup gate empty ${t}`, RID_A]
    ).lastInsertRowid;
    // Insert a half-configured integration directly (POST endpoint blocks this,
    // but legacy rows or future columns might still surface in the table).
    run(
      `INSERT INTO supplier_integrations
         (restaurant_id, supplier_id, provider, external_id, status)
       VALUES (?, ?, 'foodflow', '', 'connected')`,
      [RID_A, sid]
    );

    const poId = run(
      `INSERT INTO purchase_orders (supplier_id, reference, total_amount, status, restaurant_id)
       VALUES (?, ?, 25.0, 'brouillon', ?)`,
      [sid, `PO-GATE-${t}`, RID_A]
    ).lastInsertRowid;

    const res = await request(app)
      .put(`/api/purchase-orders/${poId}`)
      .set(authA())
      .send({ status: 'envoyée' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    expect(res.body.provider).toBe('foodflow');
    expect(res.body.error).toMatch(/FoodFlow/);
    expect(res.body.error).toMatch(/Intégrations/);

    // PO must remain in brouillon (transition was blocked).
    const after = get('SELECT status FROM purchase_orders WHERE id = ?', [poId]);
    expect(after.status).toBe('brouillon');
  });

  it('blocks status→envoyée with 400 when external_id is whitespace-only', async () => {
    const t = tag();
    const sid = run(
      `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
      [`Sup gate ws ${t}`, RID_A]
    ).lastInsertRowid;
    run(
      `INSERT INTO supplier_integrations
         (restaurant_id, supplier_id, provider, external_id, status)
       VALUES (?, ?, 'foodflow', '   ', 'connected')`,
      [RID_A, sid]
    );

    const poId = run(
      `INSERT INTO purchase_orders (supplier_id, reference, total_amount, status, restaurant_id)
       VALUES (?, ?, 30.0, 'brouillon', ?)`,
      [sid, `PO-WS-${t}`, RID_A]
    ).lastInsertRowid;

    const res = await request(app)
      .put(`/api/purchase-orders/${poId}`)
      .set(authA())
      .send({ status: 'envoyée' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
  });

  it('allows status→envoyée when external_id is set', async () => {
    const t = tag();
    const sid = run(
      `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
      [`Sup gate ok ${t}`, RID_A]
    ).lastInsertRowid;
    await request(app).post('/api/supplier-integrations').set(authA())
      .send({ supplier_id: sid, provider: 'foodflow', external_id: `FF-OK-${t}` });

    const poId = run(
      `INSERT INTO purchase_orders (supplier_id, reference, total_amount, status, restaurant_id)
       VALUES (?, ?, 40.0, 'brouillon', ?)`,
      [sid, `PO-OK-${t}`, RID_A]
    ).lastInsertRowid;

    const res = await request(app)
      .put(`/api/purchase-orders/${poId}`)
      .set(authA())
      .send({ status: 'envoyée' });

    expect(res.status).toBe(200);
    const after = get('SELECT status FROM purchase_orders WHERE id = ?', [poId]);
    expect(after.status).toBe('envoyée');
  });

  it('allows status→envoyée when supplier has no integration row', async () => {
    const t = tag();
    const sid = run(
      `INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`,
      [`Sup gate noint ${t}`, RID_A]
    ).lastInsertRowid;
    // No supplier_integrations row — free-form email path.

    const poId = run(
      `INSERT INTO purchase_orders (supplier_id, reference, total_amount, status, restaurant_id)
       VALUES (?, ?, 12.0, 'brouillon', ?)`,
      [sid, `PO-NOINT-${t}`, RID_A]
    ).lastInsertRowid;

    const res = await request(app)
      .put(`/api/purchase-orders/${poId}`)
      .set(authA())
      .send({ status: 'envoyée' });

    expect(res.status).toBe(200);
  });
});
