# Multi-Tenancy Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `restaurant_id` to every tenant-scoped table, create an immutable `audit_log`, add a tenant-helper module, and restore the `accounts.js` export with proper scoping.

**Architecture:** Idempotent online `ALTER TABLE ... ADD COLUMN` migrations run at app boot (same pattern as existing migrations in `server/db.js`). Backfill `restaurant_id = 1` for any pre-existing rows (today there is only one tenant). Add `CREATE INDEX IF NOT EXISTS idx_<table>_restaurant_id` for each. `audit_log` is an append-only table — no UPDATE/DELETE helpers exposed. A small `tenant.js` helper exposes `req.user.restaurant_id` with a guard.

**Tech Stack:** better-sqlite3, Express, Jest + Supertest.

---

## Tables requiring `restaurant_id` (45)

**Core operational:** ingredients, recipes, recipe_ingredients, recipe_steps, stock, stock_movements, suppliers, supplier_prices, supplier_accounts, supplier_catalog, ingredient_supplier_prefs, price_history, price_change_notifications.

**HACCP:** temperature_zones, temperature_logs, cleaning_tasks, cleaning_logs, cooling_logs, reheating_logs, fryers, fryer_checks, non_conformities, haccp_hazard_analysis, haccp_ccp, haccp_decision_tree_results, traceability_logs, downstream_traceability, recall_procedures, training_records, pest_control, equipment_maintenance, waste_management, corrective_actions_templates, corrective_actions_log, allergen_management_plan, water_management, pms_audits, sanitary_settings (already has — skip), tiac_procedures, fabrication_diagrams.

**Operations:** order_items, purchase_orders, purchase_order_items, delivery_notes, delivery_note_items, loyalty_transactions, prediction_accuracy, referrals.

**Skip** (tenant itself or cross-tenant by design): `restaurants`, `subscriptions` (linked via account_id — handle in Phase 3 if needed).

---

### Task 1: Red test — schema migration produces restaurant_id on every target table

**Files:**
- Test: `server/tests/phase2-schema.test.js` (create)

**Step 1: Write the failing test**

```js
'use strict';
const { db } = require('../db');

const TARGET_TABLES = [
  'ingredients','recipes','recipe_ingredients','recipe_steps',
  'stock','stock_movements','suppliers','supplier_prices','supplier_accounts',
  'supplier_catalog','ingredient_supplier_prefs','price_history','price_change_notifications',
  'temperature_zones','temperature_logs','cleaning_tasks','cleaning_logs',
  'cooling_logs','reheating_logs','fryers','fryer_checks','non_conformities',
  'haccp_hazard_analysis','haccp_ccp','haccp_decision_tree_results',
  'traceability_logs','downstream_traceability','recall_procedures','training_records',
  'pest_control','equipment_maintenance','waste_management',
  'corrective_actions_templates','corrective_actions_log',
  'allergen_management_plan','water_management','pms_audits',
  'tiac_procedures','fabrication_diagrams',
  'order_items','purchase_orders','purchase_order_items',
  'delivery_notes','delivery_note_items','loyalty_transactions',
  'prediction_accuracy','referrals'
];

describe('Phase 2 schema — every tenant-scoped table has restaurant_id', () => {
  for (const t of TARGET_TABLES) {
    it(`${t}.restaurant_id exists`, () => {
      const rows = db.prepare(`PRAGMA table_info(${t})`).all();
      if (rows.length === 0) return; // table not created in this config; skip
      const cols = rows.map(r => r.name);
      expect(cols).toContain('restaurant_id');
    });
  }

  it('audit_log exists and has required columns', () => {
    const rows = db.prepare(`PRAGMA table_info(audit_log)`).all();
    const cols = rows.map(r => r.name);
    expect(cols).toEqual(expect.arrayContaining([
      'id','restaurant_id','account_id','table_name','record_id','action','old_values','new_values','created_at'
    ]));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/phase2-schema.test.js --forceExit`
Expected: FAIL — most tables missing column; audit_log missing.

**Step 3: Commit the red test**

```bash
git add server/tests/phase2-schema.test.js
git commit -m "test: red test for Phase 2 schema (restaurant_id + audit_log)"
```

---

### Task 2: Add the Phase 2 migration block to `server/db.js`

**Files:**
- Modify: `server/db.js` (append near other migrations, inside the existing `try { ... } catch {}` migration section)

**Step 1: Write the migration helper**

```js
// ─── Phase 2 multi-tenancy: restaurant_id on every tenant-scoped table ───
try {
  const PHASE2_TABLES = [
    'ingredients','recipes','recipe_ingredients','recipe_steps',
    'stock','stock_movements','suppliers','supplier_prices','supplier_accounts',
    'supplier_catalog','ingredient_supplier_prefs','price_history','price_change_notifications',
    'temperature_zones','temperature_logs','cleaning_tasks','cleaning_logs',
    'cooling_logs','reheating_logs','fryers','fryer_checks','non_conformities',
    'haccp_hazard_analysis','haccp_ccp','haccp_decision_tree_results',
    'traceability_logs','downstream_traceability','recall_procedures','training_records',
    'pest_control','equipment_maintenance','waste_management',
    'corrective_actions_templates','corrective_actions_log',
    'allergen_management_plan','water_management','pms_audits',
    'tiac_procedures','fabrication_diagrams',
    'order_items','purchase_orders','purchase_order_items',
    'delivery_notes','delivery_note_items','loyalty_transactions',
    'prediction_accuracy','referrals'
  ];
  for (const t of PHASE2_TABLES) {
    const tableExists = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?"
    ).get(t);
    if (!tableExists) continue;
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
    if (!cols.includes('restaurant_id')) {
      db.exec(`ALTER TABLE ${t} ADD COLUMN restaurant_id INTEGER DEFAULT 1`);
      db.exec(`UPDATE ${t} SET restaurant_id = 1 WHERE restaurant_id IS NULL`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${t}_restaurant_id ON ${t}(restaurant_id)`);
  }
  console.log('✅ Migration: Phase 2 restaurant_id backfill complete');
} catch (e) {
  console.warn('⚠️ Phase 2 migration error:', e.message);
}

// ─── audit_log (append-only) ───
try {
  db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    account_id INTEGER,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
    old_values TEXT,
    new_values TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_restaurant ON audit_log(restaurant_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id)`);
  console.log('✅ Migration: audit_log table ready');
} catch (e) {
  console.warn('⚠️ audit_log migration error:', e.message);
}
```

**Step 2: Run the test — expect green**

Run: `npx jest tests/phase2-schema.test.js --forceExit`
Expected: PASS.

**Step 3: Run the full suite — expect green (157/157 still passing)**

Run: `npm test`
Expected: all 157 + new 46 = 203 passing.

**Step 4: Commit**

```bash
git add server/db.js server/tests/phase2-schema.test.js
git commit -m "feat(schema): Phase 2 — add restaurant_id to tenant-scoped tables + audit_log"
```

---

### Task 3: Append-only audit_log helper + guard

**Files:**
- Create: `server/lib/audit-log.js`
- Test: `server/tests/audit-log.test.js`

**Step 1: Write failing test for helper + append-only invariant**

```js
'use strict';
const { writeAudit, readAudit } = require('../lib/audit-log');
const { db, run, get } = require('../db');

describe('audit_log is append-only', () => {
  it('writeAudit inserts and readAudit reads back', () => {
    writeAudit({
      restaurant_id: 1, account_id: 1,
      table_name: 'recipes', record_id: 42,
      action: 'create', new_values: { name: 'Soufflé' }
    });
    const rows = readAudit({ restaurant_id: 1, table_name: 'recipes', record_id: 42 });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].action).toBe('create');
    const parsed = JSON.parse(rows[0].new_values);
    expect(parsed.name).toBe('Soufflé');
  });

  it('rejects unknown action values', () => {
    expect(() => writeAudit({
      restaurant_id: 1, table_name: 'recipes', record_id: 1,
      action: 'purge', new_values: {}
    })).toThrow();
  });

  it('rejects missing restaurant_id', () => {
    expect(() => writeAudit({
      table_name: 'recipes', record_id: 1, action: 'create'
    })).toThrow();
  });
});
```

**Step 2: Implement helper**

```js
// server/lib/audit-log.js
'use strict';
const { db, run, all } = require('../db');

const ALLOWED_ACTIONS = new Set(['create', 'update', 'delete']);

function writeAudit({ restaurant_id, account_id = null, table_name, record_id = null, action, old_values = null, new_values = null }) {
  if (!restaurant_id) throw new Error('audit_log: restaurant_id required');
  if (!table_name) throw new Error('audit_log: table_name required');
  if (!ALLOWED_ACTIONS.has(action)) throw new Error(`audit_log: invalid action '${action}'`);
  run(
    `INSERT INTO audit_log (restaurant_id, account_id, table_name, record_id, action, old_values, new_values)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      restaurant_id,
      account_id,
      table_name,
      record_id,
      action,
      old_values == null ? null : (typeof old_values === 'string' ? old_values : JSON.stringify(old_values)),
      new_values == null ? null : (typeof new_values === 'string' ? new_values : JSON.stringify(new_values)),
    ]
  );
}

function readAudit({ restaurant_id, table_name, record_id, limit = 100 }) {
  const clauses = ['restaurant_id = ?'];
  const params = [restaurant_id];
  if (table_name) { clauses.push('table_name = ?'); params.push(table_name); }
  if (record_id != null) { clauses.push('record_id = ?'); params.push(record_id); }
  return all(
    `SELECT * FROM audit_log WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ?`,
    [...params, Math.min(limit, 1000)]
  );
}

module.exports = { writeAudit, readAudit };
```

**Step 3: Run test — expect green**

**Step 4: Commit**

```bash
git add server/lib/audit-log.js server/tests/audit-log.test.js
git commit -m "feat(audit): append-only audit_log helper (writeAudit/readAudit)"
```

---

### Task 4: gérant-only GET /api/audit-log endpoint

**Files:**
- Create: `server/routes/audit.js`
- Modify: `server/app.js` (register route)
- Test: add to `server/tests/audit-log.test.js`

**Step 1: Write failing test**

```js
const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

describe('GET /api/audit-log', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/audit-log');
    expect(res.status).toBe(401);
  });
  it('returns 403 for non-gerant', async () => {
    const res = await request(app).get('/api/audit-log')
      .set(authHeader({ id: 1, role: 'equipier', restaurant_id: 1 }));
    expect(res.status).toBe(403);
  });
  it('returns tenant-scoped rows for gerant', async () => {
    const res = await request(app).get('/api/audit-log')
      .set(authHeader({ id: 1, role: 'gerant', restaurant_id: 1 }));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});
```

**Step 2: Implement route**

```js
// server/routes/audit.js
const { Router } = require('express');
const { readAudit } = require('../lib/audit-log');
const { requireAuth } = require('./auth');
const router = Router();

router.get('/', requireAuth, (req, res) => {
  if (req.user.role !== 'gerant') return res.status(403).json({ error: 'Gérant requis' });
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const entries = readAudit({ restaurant_id: req.user.restaurant_id, limit });
  res.json({ entries });
});

module.exports = router;
```

**Step 3: Register in `server/app.js`**

Add near other `app.use('/api/...')` registrations: `app.use('/api/audit-log', require('./routes/audit'));`

**Step 4: Run tests, commit**

```bash
git add server/routes/audit.js server/app.js server/tests/audit-log.test.js
git commit -m "feat(audit): GET /api/audit-log gérant-only tenant-scoped read endpoint"
```

---

### Task 5: Tenant helper middleware

**Files:**
- Create: `server/lib/tenant.js`
- Test: `server/tests/tenant-helper.test.js`

**Step 1: Write test**

```js
const { requireTenant } = require('../lib/tenant');
describe('requireTenant', () => {
  it('calls next when req.user.restaurant_id is present', () => {
    const next = jest.fn();
    const res = { status: jest.fn(() => res), json: jest.fn() };
    requireTenant({ user: { restaurant_id: 1 } }, res, next);
    expect(next).toHaveBeenCalled();
  });
  it('returns 400 when req.user.restaurant_id missing', () => {
    const next = jest.fn();
    const res = { status: jest.fn(() => res), json: jest.fn() };
    requireTenant({ user: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
```

**Step 2: Implement**

```js
// server/lib/tenant.js
'use strict';
function requireTenant(req, res, next) {
  if (!req.user || !req.user.restaurant_id) {
    return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  }
  next();
}
module.exports = { requireTenant };
```

**Step 3: Commit**

```bash
git add server/lib/tenant.js server/tests/tenant-helper.test.js
git commit -m "feat(tenant): requireTenant middleware guard"
```

---

### Task 6: Restore accounts.js export with proper tenant scoping

**Files:**
- Modify: `server/routes/accounts.js` /:id/export handler
- Modify: `server/tests/tenancy.test.js` — replace the "does not include cross-tenant bulk fields" test with an assertion that the bulk fields ARE present now AND are scoped.

**Step 1: Write new green test**

Replace the Phase 1 lockdown assertion with:

```js
it('includes only same-tenant bulk data in the export', async () => {
  // Seed a recipe in tenant 100 and tenant 200
  run("INSERT OR IGNORE INTO recipes (id, name, restaurant_id) VALUES (9100, 'recipeR100', 100)");
  run("INSERT OR IGNORE INTO recipes (id, name, restaurant_id) VALUES (9200, 'recipeR200', 200)");
  const res = await request(app)
    .get('/api/accounts/1003/export')
    .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
  expect(res.status).toBe(200);
  const recipeIds = (res.body.recipes || []).map(r => r.id);
  expect(recipeIds).toContain(9100);
  expect(recipeIds).not.toContain(9200);
});
```

**Step 2: Modify handler**

Replace the current Phase 1 minimal body with scoped queries filtering every bulk table by `req.user.restaurant_id`.

**Step 3: Commit**

```bash
git add server/routes/accounts.js server/tests/tenancy.test.js
git commit -m "feat(accounts): restore /export with tenant-scoped bulk data (closes C-2)"
```

---

### Task 7: Full suite green + merge Phase 2 to main

**Step 1:** `npm test` — expect 203+ passing.

**Step 2:** `git checkout main && git merge --no-ff claude/condescending-bhaskara -m "merge: Phase 2 multi-tenancy — schema + audit_log + tenant helper + export restore"`

**Step 3:** Update memory `project-multitenancy-initiative.md` — mark Phase 2 merged, point to Phase 3 themed batches.

---

## Remember
- Idempotent migrations: `ADD COLUMN` + `CREATE INDEX IF NOT EXISTS` are safe to re-run.
- `ALTER TABLE ADD COLUMN` in SQLite does NOT rewrite the table — it's online.
- Each task is ONE commit. Run `npm test` after every task.
- Routes are NOT converted here — that's Phase 3. Phase 2 is schema + infra only.
