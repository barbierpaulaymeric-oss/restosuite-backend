'use strict';

// Restaurant ↔ supplier messaging — both sides of the wire.
// Restaurant side requires JWT (requireAuth via authHeader helper).
// Supplier side requires X-Supplier-Token (sha256 token_hash matched).

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { run, get, all } = require('../db');
const { authHeader } = require('./helpers/auth');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

// Spin up { restaurant, supplier, supplier_account session } scoped together.
function createPair(opts = {}) {
  const tag = Math.random().toString(36).slice(2, 8);
  const restaurantId = run(
    `INSERT INTO restaurants (name, type, plan)
     VALUES (?, 'brasserie', 'pro')`,
    [`Resto ${tag}`]
  ).lastInsertRowid;
  const supplierId = run(
    `INSERT INTO suppliers (name, email, restaurant_id)
     VALUES (?, ?, ?)`,
    [opts.supplierName || `Supplier ${tag}`, opts.email || `s-${tag}@example.com`, restaurantId]
  ).lastInsertRowid;
  const accountId = run(
    `INSERT INTO accounts (name, role, restaurant_id, is_owner)
     VALUES (?, 'gerant', ?, 1)`,
    [`Gérant ${tag}`, restaurantId]
  ).lastInsertRowid;
  const raw = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  run(
    `INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin, token_hash, token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [restaurantId, supplierId, 'Member', `m-${tag}@example.com`, 'unused', hashToken(raw), expiresAt]
  );
  return {
    restaurantId,
    supplierId,
    accountId,
    supplierToken: raw,
    restaurantHeaders: authHeader({ id: accountId, restaurant_id: restaurantId }),
  };
}

// ─── Restaurant side ───────────────────────────────────────────────────────

describe('Restaurant messaging endpoints', () => {
  it('requires auth on every endpoint', async () => {
    const r1 = await request(app).get('/api/messages/conversations');
    const r2 = await request(app).get('/api/messages/unread-count');
    const r3 = await request(app).get('/api/messages/conversations/1');
    const r4 = await request(app).post('/api/messages/conversations/1').send({ message: 'hi' });
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r3.status).toBe(401);
    expect(r4.status).toBe(401);
  });

  it('GET /conversations lists every supplier of the restaurant', async () => {
    const p = createPair();
    // Add a second supplier so we can confirm the list isn't single-row by accident.
    const sId2 = run(
      `INSERT INTO suppliers (name, email, restaurant_id) VALUES ('S2', 's2@x.fr', ?)`,
      [p.restaurantId]
    ).lastInsertRowid;
    const res = await request(app)
      .get('/api/messages/conversations')
      .set(p.restaurantHeaders);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.find(c => c.supplier_id === p.supplierId)).toBeTruthy();
    expect(res.body.find(c => c.supplier_id === sId2)).toBeTruthy();
  });

  it('POST /conversations/:supplierId persists a message and bumps unread for the OTHER side', async () => {
    const p = createPair();
    const post = await request(app)
      .post(`/api/messages/conversations/${p.supplierId}`)
      .set(p.restaurantHeaders)
      .send({ message: 'Bonjour, il manque 2 kg de saumon.' });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({
      sender_type: 'restaurant',
      sender_id: p.accountId,
      message: 'Bonjour, il manque 2 kg de saumon.',
    });
    // The restaurant's own message doesn't count as unread for the restaurant.
    const unread = await request(app)
      .get('/api/messages/unread-count')
      .set(p.restaurantHeaders);
    expect(unread.body.count).toBe(0);
    // But the supplier sees 1 unread.
    const supplierUnread = await request(app)
      .get('/api/supplier-portal/messages/unread-count')
      .set('X-Supplier-Token', p.supplierToken);
    expect(supplierUnread.body.count).toBe(1);
  });

  it('GET /conversations/:supplierId marks incoming messages as read', async () => {
    const p = createPair();
    // Supplier sends a message → restaurant has 1 unread.
    await request(app)
      .post(`/api/supplier-portal/messages/conversations/${p.restaurantId}`)
      .set('X-Supplier-Token', p.supplierToken)
      .send({ message: 'Vos saumons partent demain.' });
    let restoUnread = await request(app)
      .get('/api/messages/unread-count')
      .set(p.restaurantHeaders);
    expect(restoUnread.body.count).toBe(1);

    // Open the thread → marks read.
    const thread = await request(app)
      .get(`/api/messages/conversations/${p.supplierId}`)
      .set(p.restaurantHeaders);
    expect(thread.status).toBe(200);
    expect(thread.body.messages).toHaveLength(1);
    // Returned row has read_at populated (post-mark).
    expect(thread.body.messages[0].read_at).toBeTruthy();

    restoUnread = await request(app)
      .get('/api/messages/unread-count')
      .set(p.restaurantHeaders);
    expect(restoUnread.body.count).toBe(0);
  });

  it('rejects empty + over-long messages', async () => {
    const p = createPair();
    const r1 = await request(app)
      .post(`/api/messages/conversations/${p.supplierId}`)
      .set(p.restaurantHeaders)
      .send({ message: '   ' });
    expect(r1.status).toBe(400);
    const r2 = await request(app)
      .post(`/api/messages/conversations/${p.supplierId}`)
      .set(p.restaurantHeaders)
      .send({ message: 'x'.repeat(2001) });
    expect(r2.status).toBe(400);
  });

  it('cross-tenant supplier_id returns 404 (no leak)', async () => {
    const p = createPair();
    const other = createPair();
    const res = await request(app)
      .get(`/api/messages/conversations/${other.supplierId}`)
      .set(p.restaurantHeaders);
    expect(res.status).toBe(404);
  });

  it('persists related_to + related_id when supplied', async () => {
    const p = createPair();
    const res = await request(app)
      .post(`/api/messages/conversations/${p.supplierId}`)
      .set(p.restaurantHeaders)
      .send({ message: 'À propos de la commande.', related_to: 'order', related_id: 42 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ related_to: 'order', related_id: 42 });
  });
});

// ─── Supplier side ─────────────────────────────────────────────────────────

describe('Supplier messaging endpoints', () => {
  it('requires X-Supplier-Token', async () => {
    const r = await request(app).get('/api/supplier-portal/messages/conversations');
    expect(r.status).toBe(401);
  });

  it('lists conversations across the supplier identity tenants', async () => {
    // Two pairs sharing the same email → identity expansion picks them up.
    const email = `vendor-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const a = createPair({ email });
    const b = createPair({ email });
    const res = await request(app)
      .get('/api/supplier-portal/messages/conversations')
      .set('X-Supplier-Token', a.supplierToken);
    expect(res.status).toBe(200);
    // 2 conversations — one per identity tenant.
    expect(res.body).toHaveLength(2);
    const restaurantIds = res.body.map(r => r.restaurant_id).sort((x, y) => x - y);
    expect(restaurantIds).toEqual([a.restaurantId, b.restaurantId].sort((x, y) => x - y));
  });

  it('GET /messages/conversations/:rid 404s for outside-identity restaurants', async () => {
    const a = createPair();
    const other = createPair();
    const res = await request(app)
      .get(`/api/supplier-portal/messages/conversations/${other.restaurantId}`)
      .set('X-Supplier-Token', a.supplierToken);
    expect(res.status).toBe(404);
  });

  it('POST as supplier persists with sender_type=supplier and sender_name from supplierAccount', async () => {
    const p = createPair();
    const res = await request(app)
      .post(`/api/supplier-portal/messages/conversations/${p.restaurantId}`)
      .set('X-Supplier-Token', p.supplierToken)
      .send({ message: 'OK pour vendredi.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sender_type: 'supplier',
      message: 'OK pour vendredi.',
    });
    expect(res.body.sender_name).toBeTruthy();
  });

  it('opening a thread marks restaurant→supplier messages read', async () => {
    const p = createPair();
    await request(app)
      .post(`/api/messages/conversations/${p.supplierId}`)
      .set(p.restaurantHeaders)
      .send({ message: 'Question dispo.' });
    let unread = await request(app)
      .get('/api/supplier-portal/messages/unread-count')
      .set('X-Supplier-Token', p.supplierToken);
    expect(unread.body.count).toBe(1);

    const thread = await request(app)
      .get(`/api/supplier-portal/messages/conversations/${p.restaurantId}`)
      .set('X-Supplier-Token', p.supplierToken);
    expect(thread.status).toBe(200);
    expect(thread.body.messages[0].read_at).toBeTruthy();

    unread = await request(app)
      .get('/api/supplier-portal/messages/unread-count')
      .set('X-Supplier-Token', p.supplierToken);
    expect(unread.body.count).toBe(0);
  });

  it('cross-tenant POST returns 404 (no leak)', async () => {
    const a = createPair();
    const other = createPair();
    const res = await request(app)
      .post(`/api/supplier-portal/messages/conversations/${other.restaurantId}`)
      .set('X-Supplier-Token', a.supplierToken)
      .send({ message: 'tentative' });
    expect(res.status).toBe(404);
    // Sanity: nothing inserted.
    const row = get(
      'SELECT COUNT(*) AS c FROM messages WHERE restaurant_id = ?',
      [other.restaurantId]
    );
    expect(row.c).toBe(0);
  });
});
