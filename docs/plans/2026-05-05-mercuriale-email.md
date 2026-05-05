# Email-based mercuriale integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire mercuriale@restosuite.fr (OVH IMAP/SMTP) so suppliers can email Excel mercuriales in (auto-import to supplier_catalog) and PO dispatch sends an Excel attachment back out.

**Architecture:**
- New `server/lib/mercuriale-mail/` module: pure inbound/outbound builders + thin imapflow/nodemailer transport wrappers + setInterval poller. Reuses `lib/mercuriale-parse.js` for Excel parsing.
- Inbound match: sender email → `suppliers.email` (per restaurant). Items upserted into `supplier_catalog` using the same SKU-then-name keying as `routes/supplier-integrations.js` sync.
- Outbound: PO → `envoyée` already calls `dispatchOrder()` for provider integrations. Add a parallel `dispatchOrderEmail()` call right after — independent path, no provider config required, fires whenever the supplier has an email.
- Poller started in `server/index.js` only (not `app.js`) so tests never poll. Env-gated: skips if `MERCURIALE_EMAIL` unset.

**Tech Stack:** `imapflow`, `nodemailer`, `mailparser`, existing `xlsx` (sheetjs), `bcryptjs`.

---

### Task 1: Create test account

**Files:**
- Create: `server/scripts/create-test-account.js`

**Step 1: Write the script**

```js
#!/usr/bin/env node
'use strict';
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, get, run } = require('../db');

const RESTAURANT_NAME = 'TestRestoSuite';
const EMAIL = process.argv[2] || 'barbierpaulaymeric@gmail.com';

function genPassword() {
  // 16 chars: 12 base64url + suffix to satisfy "letter+digit+symbol" lint expectations
  return crypto.randomBytes(12).toString('base64url') + 'A1!';
}

function main() {
  let restaurant = get('SELECT id FROM restaurants WHERE name = ?', [RESTAURANT_NAME]);
  let restaurantId;
  if (restaurant) {
    restaurantId = restaurant.id;
    console.log(`↻ Restaurant "${RESTAURANT_NAME}" exists (id=${restaurantId})`);
  } else {
    const info = run(
      `INSERT INTO restaurants (name, type, city, postal_code, covers, plan)
       VALUES (?, 'restaurant', 'Paris', '75001', 30, 'pro')`,
      [RESTAURANT_NAME]
    );
    restaurantId = info.lastInsertRowid;
    console.log(`✓ Created restaurant id=${restaurantId}`);
  }

  const existing = get('SELECT id FROM accounts WHERE email = ?', [EMAIL]);
  let password;
  if (existing) {
    password = genPassword();
    const hash = bcrypt.hashSync(password, 10);
    run(`UPDATE accounts SET password_hash = ?, restaurant_id = ?, role = 'gerant',
         is_owner = 1, trial_start = datetime('now'), onboarding_step = 10
         WHERE id = ?`,
      [hash, restaurantId, existing.id]);
    console.log(`↻ Reset password for existing account id=${existing.id}`);
  } else {
    password = genPassword();
    const hash = bcrypt.hashSync(password, 10);
    const perms = JSON.stringify({
      view_recipes: true, edit_recipes: true, view_costs: true,
      view_suppliers: true, export_pdf: true,
    });
    run(
      `INSERT INTO accounts (name, pin, role, permissions, email, password_hash,
         first_name, last_name, restaurant_id, onboarding_step, is_owner, trial_start)
       VALUES (?, NULL, 'gerant', ?, ?, ?, 'Test', 'User', ?, 10, 1, datetime('now'))`,
      ['Test User', perms, EMAIL, hash, restaurantId]
    );
    console.log(`✓ Created account email=${EMAIL}`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Test account ready');
  console.log('═══════════════════════════════════════════');
  console.log(`  Restaurant: ${RESTAURANT_NAME} (id=${restaurantId})`);
  console.log(`  Email:      ${EMAIL}`);
  console.log(`  Password:   ${password}`);
  console.log(`  Role:       gerant (owner, full perms, fresh 60-day trial)`);
  console.log('═══════════════════════════════════════════\n');
}

main();
```

**Step 2: Run it**

```bash
cd server && node scripts/create-test-account.js
```

Capture output to relay credentials to the user.

**Step 3: Commit**

```bash
git add server/scripts/create-test-account.js
git commit -m "feat(scripts): test account creator"
```

---

### Task 2: Install email deps

```bash
cd server && npm install imapflow nodemailer mailparser
```

Commit `package.json` + `package-lock.json` together with Task 3.

---

### Task 3: Pure inbound processor (TDD)

**Files:**
- Create: `server/lib/mercuriale-mail/process-inbound.js`
- Test: `server/tests/mercuriale-mail/process-inbound.test.js`

**Contract:** `processInbound({ email, restaurantId, lookupSupplier })` returns:
- `{ ok: false, reason: 'no_attachment' | 'no_match' | 'no_items' }`
- `{ ok: true, supplierId, items: [...] }`

`lookupSupplier(senderEmail, restaurantId)` is injected so tests don't need a DB; production wraps `get('SELECT id FROM suppliers WHERE LOWER(email)=LOWER(?) AND restaurant_id=?', ...)`.

**Step 1: Write tests**

```js
const { processInbound } = require('../../lib/mercuriale-mail/process-inbound');
const xlsx = require('xlsx');

function makeXlsx(rows) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const SAMPLE_BUFFER = makeXlsx([
  ['Référence', 'Produit', 'Unité', 'Prix HT'],
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

  test('returns parsed items + supplierId on happy path', () => {
    const r = processInbound({
      email: { from: 'SUP@X.com', attachments: [{ filename: 'm.xlsx', content: SAMPLE_BUFFER }] },
      restaurantId: 1,
      lookupSupplier: (em, rid) => {
        expect(em).toBe('sup@x.com'); // lowercased
        expect(rid).toBe(1);
        return { id: 7 };
      },
    });
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
```

**Step 2: Implement**

```js
'use strict';
const { parseXlsxBuffer, normalizeItems } = require('../mercuriale-parse');

const XLSX_EXTS = /\.(xlsx|xls|csv)$/i;

function pickAttachment(attachments) {
  if (!Array.isArray(attachments)) return null;
  for (const a of attachments) {
    if (a && a.filename && XLSX_EXTS.test(a.filename) && Buffer.isBuffer(a.content)) {
      return a;
    }
  }
  return null;
}

function processInbound({ email, restaurantId, lookupSupplier }) {
  if (!email || typeof email !== 'object') return { ok: false, reason: 'no_email' };
  const att = pickAttachment(email.attachments);
  if (!att) return { ok: false, reason: 'no_attachment' };
  const sender = String(email.from || '').toLowerCase().trim();
  if (!sender) return { ok: false, reason: 'no_sender' };
  const supplier = lookupSupplier(sender, restaurantId);
  if (!supplier || !supplier.id) return { ok: false, reason: 'no_match' };
  let raw;
  try { raw = parseXlsxBuffer(att.content); }
  catch { return { ok: false, reason: 'parse_error' }; }
  const items = normalizeItems(raw);
  if (!items.length) return { ok: false, reason: 'no_items' };
  return { ok: true, supplierId: supplier.id, items };
}

module.exports = { processInbound, pickAttachment };
```

**Step 3: Run tests**

```bash
cd server && npm test -- mercuriale-mail/process-inbound
```

Expected: 5/5 pass.

---

### Task 4: Pure outbound builder (TDD)

**Files:**
- Create: `server/lib/mercuriale-mail/build-outbound.js`
- Test: `server/tests/mercuriale-mail/build-outbound.test.js`

**Contract:** `buildOrderXlsx({ restaurant, supplier, integration, po, items })` → Buffer (xlsx). The first sheet has a metadata block (date, restaurant, order ref, optional FoodFlow `external_id`) then a header row + item rows.

**Step 1: Write tests**

```js
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
```

**Step 2: Implement**

```js
'use strict';
const xlsx = require('xlsx');

function buildOrderXlsx({ restaurant, supplier, integration, po, items }) {
  const meta = [
    ['Bon de commande', null, null, null, null],
    ['Date', po.sent_at || new Date().toISOString().slice(0, 19).replace('T', ' ')],
    ['Restaurant', restaurant && restaurant.name],
    ['Fournisseur', supplier && supplier.name],
    ['Référence', po.reference],
  ];
  if (integration && integration.external_id) {
    const label = integration.provider === 'foodflow' ? 'FoodFlow ID' : `${integration.provider} ID`;
    meta.push([label, integration.external_id]);
  }
  meta.push([], ['Référence', 'Produit', 'Quantité', 'Unité', 'Prix unitaire HT', 'Total HT']);
  for (const it of (items || [])) {
    meta.push([
      it.sku || it.reference || '',
      it.product_name || it.name || '',
      Number(it.quantity) || 0,
      it.unit || '',
      Number(it.unit_price) || 0,
      Number(it.total_price) || (Number(it.quantity) * Number(it.unit_price)) || 0,
    ]);
  }
  meta.push([], ['', '', '', '', 'Total commande HT', Number(po.total_amount) || 0]);

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(meta);
  xlsx.utils.book_append_sheet(wb, ws, 'Commande');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildOrderXlsx };
```

**Step 3: Run tests**

```bash
cd server && npm test -- mercuriale-mail/build-outbound
```

Expected: 5/5 pass.

---

### Task 5: IMAP / SMTP transport wrappers

**Files:**
- Create: `server/lib/mercuriale-mail/imap-client.js`
- Create: `server/lib/mercuriale-mail/smtp-client.js`

These are thin wrappers, NOT unit-tested — they require a real IMAP/SMTP server. Coverage comes from the orchestrator test (Task 6) using injected mocks.

**imap-client.js**

```js
'use strict';
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

function buildClient() {
  return new ImapFlow({
    host: process.env.MERCURIALE_IMAP_HOST || 'ssl0.ovh.net',
    port: Number(process.env.MERCURIALE_IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.MERCURIALE_EMAIL,
      pass: process.env.MERCURIALE_PASSWORD,
    },
    logger: false,
  });
}

// Returns [{ uid, from, subject, date, attachments: [{filename, content}] }]
async function fetchUnseen({ markSeen = true } = {}) {
  const client = buildClient();
  await client.connect();
  const out = [];
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        const parsed = await simpleParser(msg.source);
        out.push({
          uid: msg.uid,
          from: parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address || '',
          subject: parsed.subject || '',
          date: parsed.date || new Date(),
          attachments: (parsed.attachments || []).map(a => ({
            filename: a.filename || '',
            content: a.content,
            contentType: a.contentType || '',
          })),
        });
        if (markSeen) {
          try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }); } catch {}
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch {}
  }
  return out;
}

module.exports = { fetchUnseen };
```

**smtp-client.js**

```js
'use strict';
const nodemailer = require('nodemailer');

let _transport = null;
function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.MERCURIALE_SMTP_HOST || 'ssl0.ovh.net',
    port: Number(process.env.MERCURIALE_SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.MERCURIALE_EMAIL,
      pass: process.env.MERCURIALE_PASSWORD,
    },
  });
  return _transport;
}

async function sendOrderEmail({ to, subject, text, xlsxBuffer, filename }) {
  const transport = getTransport();
  return transport.sendMail({
    from: process.env.MERCURIALE_EMAIL,
    to,
    subject,
    text,
    attachments: [{ filename, content: xlsxBuffer }],
  });
}

module.exports = { sendOrderEmail, getTransport };
```

---

### Task 6: Orchestrator + DB upsert (TDD)

**Files:**
- Create: `server/lib/mercuriale-mail/index.js`
- Test: `server/tests/mercuriale-mail/orchestrator.test.js`

**Contract:**
- `runInboundCycle({ fetchFn })` — fetches via injected `fetchFn` (defaults to `imap-client.fetchUnseen`), iterates emails, processes each per-restaurant, upserts items into `supplier_catalog`, returns `{ processed, matched, items_upserted, errors }`.
- `dispatchOrderEmail({ rid, supplier_id, po, sendFn })` — looks up supplier email + integration, builds xlsx, sends via injected `sendFn` (defaults to `smtp-client.sendOrderEmail`), returns `{ ok, to?, error? }`.

**Step 1: Write orchestrator test**

```js
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'restosuite-dev-secret-2026';

const { db, get, run } = require('../../db');
const xlsx = require('xlsx');
const { runInboundCycle, dispatchOrderEmail } = require('../../lib/mercuriale-mail');

function makeXlsx(rows) {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'S');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

beforeAll(() => {
  run(`INSERT INTO restaurants (id, name) VALUES (42, 'TestZ')`);
  run(`INSERT INTO suppliers (id, name, email, restaurant_id) VALUES (99, 'SupZ', 'supz@x.com', 42)`);
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
    const got = get(`SELECT COUNT(*) as c FROM supplier_catalog WHERE supplier_id = 99`);
    expect(got.c).toBe(2);
  });

  test('skips email when no supplier matches', async () => {
    const fetchFn = async () => [{
      uid: 2, from: 'noone@x.com', attachments: [{ filename: 'm.xlsx', content: makeXlsx([['Produit', 'Prix HT'], ['x', '1']]) }],
    }];
    const r = await runInboundCycle({ fetchFn });
    expect(r.processed).toBe(1);
    expect(r.matched).toBe(0);
  });

  test('returns errors entry but continues when one email throws', async () => {
    const fetchFn = async () => [
      { uid: 3, from: 'supz@x.com', attachments: null }, // forces no_attachment
      { uid: 4, from: 'supz@x.com', attachments: [{ filename: 'm.xlsx', content: makeXlsx([['Produit', 'Prix HT'], ['Zorglub bio', '5']]) }] },
    ];
    const r = await runInboundCycle({ fetchFn });
    expect(r.processed).toBe(2);
    expect(r.matched).toBe(1);
  });
});

describe('dispatchOrderEmail', () => {
  beforeEach(() => {
    run(`DELETE FROM supplier_integrations WHERE restaurant_id = 42`);
  });

  test('sends with no integration when supplier has email', async () => {
    const calls = [];
    const sendFn = async (args) => { calls.push(args); return { messageId: 'm1' }; };
    run(`INSERT INTO purchase_orders (id, restaurant_id, supplier_id, reference, status, total_amount)
         VALUES (501, 42, 99, 'PO-T-1', 'envoyée', 50.0)`);
    run(`INSERT INTO purchase_order_items (purchase_order_id, restaurant_id, product_name, quantity, unit, unit_price, total_price)
         VALUES (501, 42, 'Zorglub bio', 5, 'kg', 10, 50)`);
    const r = await dispatchOrderEmail({ rid: 42, supplier_id: 99, po_id: 501, sendFn });
    expect(r.ok).toBe(true);
    expect(r.to).toBe('supz@x.com');
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe('supz@x.com');
    expect(Buffer.isBuffer(calls[0].xlsxBuffer)).toBe(true);
  });

  test('includes external_id from supplier_integrations when present', async () => {
    run(`INSERT INTO supplier_integrations (restaurant_id, supplier_id, provider, external_id, status)
         VALUES (42, 99, 'foodflow', 'FF-Z-9', 'connected')`);
    const sendFn = async (args) => ({ messageId: 'm2', _captured: args });
    run(`INSERT INTO purchase_orders (id, restaurant_id, supplier_id, reference, status, total_amount)
         VALUES (502, 42, 99, 'PO-T-2', 'envoyée', 50)`);
    run(`INSERT INTO purchase_order_items (purchase_order_id, restaurant_id, product_name, quantity, unit, unit_price, total_price)
         VALUES (502, 42, 'X', 1, 'kg', 50, 50)`);
    let captured = null;
    await dispatchOrderEmail({ rid: 42, supplier_id: 99, po_id: 502, sendFn: async (a) => { captured = a; } });
    const wb = xlsx.read(captured.xlsxBuffer, { type: 'buffer' });
    const flat = JSON.stringify(xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }));
    expect(flat).toContain('FF-Z-9');
  });

  test('returns ok:false when supplier has no email', async () => {
    run(`INSERT INTO suppliers (id, name, email, restaurant_id) VALUES (100, 'NoMail', NULL, 42)`);
    run(`INSERT INTO purchase_orders (id, restaurant_id, supplier_id, reference, status, total_amount)
         VALUES (503, 42, 100, 'PO-T-3', 'envoyée', 0)`);
    const r = await dispatchOrderEmail({ rid: 42, supplier_id: 100, po_id: 503, sendFn: async () => ({}) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/email/i);
  });
});
```

**Step 2: Implement orchestrator**

```js
'use strict';
const { db, get, all, run } = require('../../db');
const { processInbound } = require('./process-inbound');
const { buildOrderXlsx } = require('./build-outbound');

function defaultLookupSupplier(senderEmail, restaurantId) {
  return get(
    'SELECT id FROM suppliers WHERE LOWER(email) = LOWER(?) AND restaurant_id = ?',
    [senderEmail, restaurantId]
  );
}

function upsertCatalog(rid, supplierId, items) {
  let n = 0;
  const tx = db.transaction(() => {
    for (const it of items) {
      const existing = get(
        'SELECT id FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(product_name) = LOWER(?)',
        [supplierId, rid, it.name]
      );
      if (existing) {
        run(
          `UPDATE supplier_catalog SET category=?, unit=?, price=?, updated_at=CURRENT_TIMESTAMP
             WHERE id=? AND restaurant_id=?`,
          [it.category, it.unit, it.price, existing.id, rid]
        );
      } else {
        run(
          `INSERT INTO supplier_catalog (restaurant_id, supplier_id, product_name, category, unit, price)
             VALUES (?, ?, ?, ?, ?, ?)`,
          [rid, supplierId, it.name, it.category, it.unit, it.price]
        );
      }
      n++;
    }
  });
  tx();
  return n;
}

async function runInboundCycle({ fetchFn } = {}) {
  const fetcher = fetchFn || (async () => {
    const { fetchUnseen } = require('./imap-client');
    return fetchUnseen({ markSeen: true });
  });
  const emails = await fetcher();
  const result = { processed: 0, matched: 0, items_upserted: 0, errors: [] };

  // Suppliers can belong to any tenant — we resolve by sender email across all
  // restaurants. Most installs have one tenant per inbox, but multi-site setups
  // could share one mailbox; iterate restaurants until a match is found.
  const restaurants = all('SELECT id FROM restaurants');

  for (const email of emails) {
    result.processed++;
    let matched = false;
    for (const r of restaurants) {
      const out = processInbound({
        email,
        restaurantId: r.id,
        lookupSupplier: defaultLookupSupplier,
      });
      if (out.ok) {
        try {
          const n = upsertCatalog(r.id, out.supplierId, out.items);
          result.items_upserted += n;
          result.matched++;
          matched = true;
          break;
        } catch (e) {
          result.errors.push({ uid: email.uid, error: e.message });
        }
      }
    }
    if (!matched) { /* counted under processed; reason already known */ }
  }
  return result;
}

async function dispatchOrderEmail({ rid, supplier_id, po_id, sendFn }) {
  const supplier = get(
    'SELECT id, name, email FROM suppliers WHERE id = ? AND restaurant_id = ?',
    [supplier_id, rid]
  );
  if (!supplier) return { ok: false, error: 'fournisseur introuvable' };
  if (!supplier.email) return { ok: false, error: "fournisseur sans email" };

  const restaurant = get('SELECT id, name FROM restaurants WHERE id = ?', [rid]);
  const po = get(
    'SELECT id, reference, total_amount, sent_at FROM purchase_orders WHERE id = ? AND restaurant_id = ?',
    [po_id, rid]
  );
  if (!po) return { ok: false, error: 'commande introuvable' };

  const items = all(
    `SELECT product_name, quantity, unit, unit_price, total_price
       FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?`,
    [po_id, rid]
  );

  const integration = get(
    `SELECT provider, external_id FROM supplier_integrations
       WHERE supplier_id = ? AND restaurant_id = ? AND status = 'connected'
       ORDER BY id DESC LIMIT 1`,
    [supplier_id, rid]
  );

  const xlsxBuffer = buildOrderXlsx({ restaurant, supplier, integration, po, items });
  const sender = sendFn || (async (args) => {
    const { sendOrderEmail } = require('./smtp-client');
    return sendOrderEmail(args);
  });
  try {
    await sender({
      to: supplier.email,
      subject: `Bon de commande ${po.reference} — ${restaurant && restaurant.name}`,
      text: `Bonjour,\n\nVeuillez trouver ci-joint le bon de commande ${po.reference}.\n\nCordialement,\n${restaurant && restaurant.name}`,
      xlsxBuffer,
      filename: `commande-${po.reference}.xlsx`,
    });
    return { ok: true, to: supplier.email };
  } catch (e) {
    return { ok: false, to: supplier.email, error: e.message };
  }
}

module.exports = { runInboundCycle, dispatchOrderEmail, upsertCatalog };
```

**Step 3: Run tests**

```bash
cd server && npm test -- mercuriale-mail/orchestrator
```

Expected: 6/6 pass.

---

### Task 7: Poller + startup wiring

**Files:**
- Create: `server/lib/mercuriale-mail/poller.js`
- Modify: `server/index.js` (start poller after `app.listen`)
- Modify: `server/routes/purchase-orders.js` (call dispatchOrderEmail when PO → 'envoyée')

**poller.js**

```js
'use strict';
const { runInboundCycle } = require('./index');

let _timer = null;

function startPoller({ intervalMs } = {}) {
  if (_timer) return _timer;
  if (!process.env.MERCURIALE_EMAIL || !process.env.MERCURIALE_PASSWORD) {
    console.log('📧 Mercuriale poller: disabled (MERCURIALE_EMAIL/PASSWORD not set)');
    return null;
  }
  const ms = Number(intervalMs) || Number(process.env.MERCURIALE_POLL_INTERVAL_MS) || 5 * 60 * 1000;
  console.log(`📧 Mercuriale poller: enabled, interval ${ms}ms`);
  const tick = async () => {
    try {
      const r = await runInboundCycle();
      if (r.processed > 0) {
        console.log(`📧 Mercuriale poll: processed=${r.processed} matched=${r.matched} items=${r.items_upserted}`);
      }
    } catch (e) {
      console.warn('📧 Mercuriale poll error:', e.message);
    }
  };
  _timer = setInterval(tick, ms);
  if (typeof _timer.unref === 'function') _timer.unref();
  // Fire one immediate cycle but don't await
  tick().catch(() => {});
  return _timer;
}

function stopPoller() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startPoller, stopPoller };
```

**server/index.js change** — add inside the `app.listen` callback, after the keep-alive block:

```js
try { require('./lib/mercuriale-mail/poller').startPoller(); } catch (e) {
  console.warn('Mercuriale poller failed to start:', e.message);
}
```

**server/routes/purchase-orders.js change** — inside the `if (status === 'envoyée')` block, after the existing `dispatchOrder` call:

```js
try {
  const { dispatchOrderEmail } = require('../lib/mercuriale-mail');
  if (process.env.MERCURIALE_EMAIL && process.env.MERCURIALE_PASSWORD) {
    dispatchOrderEmail({ rid, supplier_id: po.supplier_id, po_id: id })
      .then(r => {
        if (r.ok) console.log(`📧 Order email sent to ${r.to} for PO ${po.reference}`);
        else console.warn(`📧 Order email skipped: ${r.error}`);
      })
      .catch(e => console.warn('📧 Order email error:', e.message));
  }
} catch (e) {
  console.warn('Order email dispatch failed:', e.message);
}
```

---

### Task 8: .env wiring (uncommitted)

**Files:**
- Modify: `.env.example` (add the four new var names, no values)
- Create local `.env` only if missing (the user will paste the real password locally)

**.env.example additions** (under a new section, NOT committing actual secrets):

```
# ─── Mercuriale email integration (OVH) ──────────────────
# IMAP polling for inbound mercuriales + SMTP for outbound PO Excel.
# Leave empty to disable both flows.
MERCURIALE_EMAIL=mercuriale@restosuite.fr
MERCURIALE_PASSWORD=
MERCURIALE_IMAP_HOST=ssl0.ovh.net
MERCURIALE_IMAP_PORT=993
MERCURIALE_SMTP_HOST=ssl0.ovh.net
MERCURIALE_SMTP_PORT=465
MERCURIALE_POLL_INTERVAL_MS=300000
```

For the local `.env`, append the same block with the real password — file is in `.gitignore`.

---

### Task 9: Full verification + commit

```bash
cd server && npm test 2>&1 | tail -20
```

Expected: previous 645 + 11 new tests = 656/656 pass. If any pre-existing test fails, investigate before committing.

```bash
git add server/lib/mercuriale-mail server/tests/mercuriale-mail server/scripts \
        server/package.json server/package-lock.json \
        server/index.js server/routes/purchase-orders.js \
        .env.example docs/plans/2026-05-05-mercuriale-email.md
git commit -m "$(cat <<'EOF'
feat(mercuriale-email): IMAP inbound + SMTP outbound via OVH

- lib/mercuriale-mail/{process-inbound,build-outbound,index,poller,imap-client,smtp-client}
- Inbound: imapflow polls mercuriale@restosuite.fr every 5min, matches sender to suppliers.email, upserts items into supplier_catalog
- Outbound: PO → 'envoyée' triggers nodemailer send with xlsx attachment, includes FoodFlow external_id from supplier_integrations when present
- Pure builders are env-free + injectable for tests; transport wrappers env-driven
- Poller env-gated (MERCURIALE_EMAIL/PASSWORD) — silent no-op when unset

scripts/create-test-account.js: idempotent gerant account creator with random password printed to stdout

11 new tests (process-inbound: 5, build-outbound: 5, orchestrator: 6)
EOF
)"
```

---

### Out-of-scope notes

- **No API/UI** for managing the email integration in v1 — admin sees activity in server logs. Adding a `/api/mercuriale-email/status` route + a #/mercuriale-email view can come later.
- **No retry/queue** for failed sends — first send only. Logged on failure. Stripe-style outbox for retries is a future task.
- **No HTML email body** — plain text is enough for first version.
- **No PDF attachment fallback** — only xlsx/xls/csv attachments are processed.
