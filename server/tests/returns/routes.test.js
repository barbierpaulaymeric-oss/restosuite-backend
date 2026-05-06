'use strict';

// Routes-level integration tests for /api/returns.
//
// Covers: create + list + detail + status workflow + send (with injected
// fake transport) + tenancy isolation + supplier-mailbox priority order.

const request = require('supertest');
const app = require('../../app');
const { run, get, all } = require('../../db');
const { authHeader } = require('../helpers/auth');

let RID_A, RID_B, ACC_A;
let SUP_A_NOEMAIL, SUP_A_GENERIC, SUP_A_RETURNS, SUP_B;
let DN_A;

function uniq() { return Math.random().toString(36).slice(2, 8); }

beforeAll(() => {
  const t = uniq();
  RID_A = run(`INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`, [`Returns A ${t}`]).lastInsertRowid;
  RID_B = run(`INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`, [`Returns B ${t}`]).lastInsertRowid;

  ACC_A = run(
    `INSERT INTO accounts (email, password_hash, role, restaurant_id, name) VALUES (?, 'x', 'gerant', ?, 'Gérant A')`,
    [`gerantA-${t}@x.fr`, RID_A]
  ).lastInsertRowid;

  SUP_A_NOEMAIL = run(`INSERT INTO suppliers (name, restaurant_id) VALUES (?, ?)`, [`Sup-A-noemail ${t}`, RID_A]).lastInsertRowid;
  SUP_A_GENERIC = run(
    `INSERT INTO suppliers (name, email, restaurant_id) VALUES (?, ?, ?)`,
    [`Sup-A-generic ${t}`, 'commandes@example.com', RID_A]
  ).lastInsertRowid;
  SUP_A_RETURNS = run(
    `INSERT INTO suppliers (name, email, returns_email, restaurant_id) VALUES (?, ?, ?, ?)`,
    [`Sup-A-returns ${t}`, 'commandes@example.com', 'sav@example.com', RID_A]
  ).lastInsertRowid;
  SUP_B = run(`INSERT INTO suppliers (name, email, restaurant_id) VALUES (?, 'b@b.fr', ?)`, [`Sup-B ${t}`, RID_B]).lastInsertRowid;

  DN_A = run(
    `INSERT INTO delivery_notes (supplier_id, restaurant_id, status, delivery_date) VALUES (?, ?, 'received', '2026-05-01')`,
    [SUP_A_GENERIC, RID_A]
  ).lastInsertRowid;
});

function authA() { return authHeader({ id: ACC_A, role: 'gerant', restaurant_id: RID_A }); }
function authB() { return authHeader({ id: 99, role: 'gerant', restaurant_id: RID_B }); }

describe('POST /api/returns', () => {
  it('creates a return request with items and assigns RET-YYYY-NNNN reference', async () => {
    const res = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_GENERIC,
        delivery_note_id: DN_A,
        type: 'return',
        notes: 'Arrivé chaud — chaîne du froid rompue',
        items: [
          { product_name: 'Filet de bar', quantity: 2.5, unit: 'kg', reason: 'dlc', comment: '2 jours seulement' },
          { product_name: 'Tomates', quantity: 5, unit: 'kg', reason: 'abime' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.status).toBe('draft');
    expect(res.body.reference).toMatch(/^RET-\d{4}-\d{4}$/);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].reason).toBe('dlc');
    expect(res.body.items[1].reason).toBe('abime');
  });

  it('coerces unknown reasons to "autre"', async () => {
    const res = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_GENERIC,
        items: [{ product_name: 'X', quantity: 1, reason: 'bogus' }],
      });
    expect(res.status).toBe(201);
    expect(res.body.items[0].reason).toBe('autre');
  });

  it('rejects missing supplier_id', async () => {
    const res = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({ items: [{ product_name: 'X', quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects empty items array', async () => {
    const res = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({ supplier_id: SUP_A_GENERIC, items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 404 for cross-tenant supplier (no leak via 403)', async () => {
    const res = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_B,
        items: [{ product_name: 'X', quantity: 1 }],
      });
    expect(res.status).toBe(404);
  });

  it('returns 404 for cross-tenant delivery_note', async () => {
    const dnB = run(
      `INSERT INTO delivery_notes (supplier_id, restaurant_id, status) VALUES (?, ?, 'pending')`,
      [SUP_B, RID_B]
    ).lastInsertRowid;
    const res = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_GENERIC,
        delivery_note_id: dnB,
        items: [{ product_name: 'X', quantity: 1 }],
      });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/returns', () => {
  it('lists only this tenant requests', async () => {
    // create one in B
    await request(app)
      .post('/api/returns')
      .set(authB())
      .send({ supplier_id: SUP_B, items: [{ product_name: 'X', quantity: 1 }] });

    const resA = await request(app).get('/api/returns').set(authA());
    expect(resA.status).toBe(200);
    expect(resA.body.length).toBeGreaterThanOrEqual(1);
    for (const r of resA.body) {
      expect(r.restaurant_id).toBe(RID_A);
    }
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/returns?status=draft').set(authA());
    expect(res.status).toBe(200);
    for (const r of res.body) expect(r.status).toBe('draft');
  });
});

describe('GET /api/returns/:id', () => {
  it('returns 404 for cross-tenant id', async () => {
    const created = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({ supplier_id: SUP_A_GENERIC, items: [{ product_name: 'X', quantity: 1 }] });
    const id = created.body.id;

    const res = await request(app).get(`/api/returns/${id}`).set(authB());
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-numeric id', async () => {
    const res = await request(app).get('/api/returns/abc').set(authA());
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/returns/:id/status', () => {
  let id;
  beforeAll(async () => {
    const r = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_GENERIC,
        type: 'credit',
        items: [{ product_name: 'X', quantity: 1, reason: 'manquant' }],
      });
    id = r.body.id;
  });

  it('rejects invalid status', async () => {
    const res = await request(app)
      .put(`/api/returns/${id}/status`)
      .set(authA())
      .send({ status: 'pizza' });
    expect(res.status).toBe(400);
  });

  it('rejects illegal transition', async () => {
    // draft → resolved is not in STATUS_TRANSITIONS for draft (only sent/rejected)
    const res = await request(app)
      .put(`/api/returns/${id}/status`)
      .set(authA())
      .send({ status: 'resolved' });
    expect(res.status).toBe(400);
  });

  it('moves draft → sent', async () => {
    const res = await request(app)
      .put(`/api/returns/${id}/status`)
      .set(authA())
      .send({ status: 'sent' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
  });

  it('moves sent → resolved with credit_amount + sets resolved_at', async () => {
    const res = await request(app)
      .put(`/api/returns/${id}/status`)
      .set(authA())
      .send({ status: 'resolved', credit_amount: 42.5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.credit_amount).toBe(42.5);
    expect(res.body.resolved_at).toBeTruthy();
  });
});

describe('POST /api/returns/:id/send', () => {
  let id;
  let captured;

  beforeAll(async () => {
    const r = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_RETURNS,
        items: [{ product_name: 'Saumon', quantity: 1, unit: 'kg', reason: 'qualite' }],
      });
    id = r.body.id;

    // Inject fake transport
    captured = [];
    app.locals.returnsSendFn = async (msg) => {
      captured.push(msg);
      return { ok: true };
    };
  });

  afterAll(() => {
    delete app.locals.returnsSendFn;
  });

  it('sends to supplier.returns_email when no integration set', async () => {
    const res = await request(app).post(`/api/returns/${id}/send`).set(authA());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
    expect(res.body.email_target.email).toBe('sav@example.com');
    expect(res.body.email_target.source).toBe('supplier_returns_email');
    expect(captured).toHaveLength(1);
    expect(captured[0].to).toBe('sav@example.com');
    expect(captured[0].subject).toContain('Retour produit');
    expect(captured[0].text).toContain('Saumon');
  });

  it('refuses to send already-sent request', async () => {
    const res = await request(app).post(`/api/returns/${id}/send`).set(authA());
    expect(res.status).toBe(400);
  });

  it('returns 400 when supplier has no email at all', async () => {
    const r = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_NOEMAIL,
        items: [{ product_name: 'Y', quantity: 1 }],
      });
    const res = await request(app).post(`/api/returns/${r.body.id}/send`).set(authA());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('prefers integration.returns_email over supplier mailboxes', async () => {
    // Connect SUP_A_RETURNS to a fake provider with retours@foodflow.fr
    run(
      `INSERT INTO supplier_integrations
        (restaurant_id, supplier_id, provider, external_id, returns_email, status)
       VALUES (?, ?, 'foodflow', '99999', 'retours@foodflow.fr', 'connected')`,
      [RID_A, SUP_A_GENERIC]
    );

    const r = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_GENERIC,
        items: [{ product_name: 'Z', quantity: 1, reason: 'manquant' }],
      });
    captured.length = 0;
    const res = await request(app).post(`/api/returns/${r.body.id}/send`).set(authA());
    expect(res.status).toBe(200);
    expect(res.body.email_target.email).toBe('retours@foodflow.fr');
    expect(res.body.email_target.source).toBe('integration');
    expect(captured[0].to).toBe('retours@foodflow.fr');
    // Subject + body must surface the external_id so the supplier knows
    // which restaurant the return is from when the mailbox is shared.
    expect(captured[0].subject).toContain('99999');
    expect(captured[0].text).toContain('99999');
    expect(captured[0].html).toContain('99999');
  });
});

describe('GET /api/returns/stats', () => {
  it('returns aggregate counts per status', async () => {
    const res = await request(app).get('/api/returns/stats').set(authA());
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.by_status)).toBe(true);
    expect(res.body).toHaveProperty('open');
    expect(res.body).toHaveProperty('credit_total_resolved');
  });
});

describe('DELETE /api/returns/:id', () => {
  it('deletes own request + cascades items', async () => {
    const r = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_GENERIC,
        items: [{ product_name: 'tmp', quantity: 1 }],
      });
    const id = r.body.id;
    const items = all('SELECT id FROM return_request_items WHERE return_request_id = ?', [id]);
    expect(items.length).toBe(1);

    const del = await request(app).delete(`/api/returns/${id}`).set(authA());
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    expect(get('SELECT id FROM return_requests WHERE id = ?', [id])).toBeUndefined();
    expect(all('SELECT id FROM return_request_items WHERE return_request_id = ?', [id])).toHaveLength(0);
  });

  it('returns 404 for cross-tenant delete', async () => {
    const r = await request(app)
      .post('/api/returns')
      .set(authA())
      .send({
        supplier_id: SUP_A_GENERIC,
        items: [{ product_name: 'tmp', quantity: 1 }],
      });
    const del = await request(app).delete(`/api/returns/${r.body.id}`).set(authB());
    expect(del.status).toBe(404);
  });
});
