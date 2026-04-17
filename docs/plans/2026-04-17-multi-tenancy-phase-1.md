# Multi-Tenancy Phase 1 — Critical Hotfixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close 3 CRITICAL security holes (C-1 hardcoded tenant, C-2 export leak, C-3 AI role bypass) without any schema change, gated by new tenancy tests.

**Architecture:** Targeted route-level fixes. Tables referenced already have `restaurant_id`; the bugs are purely in route code (hardcoded `= 1`, missing filters, missing role gate). Phase 2 does the schema migration.

**Tech Stack:** Node.js / Express 4 / better-sqlite3 / Jest + Supertest. JWT carries `restaurant_id` and `role`.

**Design doc:** `docs/plans/2026-04-17-multi-tenancy-isolation-design.md`

---

## Pre-flight

Confirm baseline is green before starting:

```bash
cd server && npm test 2>&1 | tail -3
```
Expected: `Tests: 142 passed, 142 total`

---

### Task 1: Scaffold tenancy test file

**Files:**
- Create: `server/tests/tenancy.test.js`

**Step 1: Create test file with a sanity check**

```js
'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');
const { run } = require('../db');

describe('Tenancy isolation — Phase 1', () => {
  it('pre-flight: app boots and rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/crm/customers');
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run to verify the scaffold works**

```bash
cd server && npx jest tests/tenancy.test.js --forceExit 2>&1 | tail -10
```
Expected: `Tests: 1 passed, 1 total`

**Step 3: Commit the scaffold**

```bash
git add server/tests/tenancy.test.js
git commit -m "test(tenancy): scaffold Phase 1 tenancy test suite"
```

---

### Task 2: Red test for C-3 (AI execute-action role bypass)

**Files:**
- Modify: `server/tests/tenancy.test.js`

**Step 1: Append the failing test**

```js
describe('C-3: POST /api/ai/execute-action must enforce role gate', () => {
  it('rejects create_recipe from a non-gérant role (equipier)', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 99, role: 'equipier', restaurant_id: 1 }))
      .send({ type: 'create_recipe', params: { name: 'Hack dish' } });
    expect(res.status).toBe(403);
  });

  it('rejects delete_recipe from cuisinier', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 99, role: 'cuisinier', restaurant_id: 1 }))
      .send({ type: 'delete_recipe', params: { recipe_id: 1 } });
    expect(res.status).toBe(403);
  });

  it('allows create_recipe from gérant', async () => {
    const res = await request(app)
      .post('/api/ai/execute-action')
      .set(authHeader({ id: 1, role: 'gerant', restaurant_id: 1 }))
      .send({ type: 'create_recipe', params: { name: 'Legit dish' } });
    expect([200, 201]).toContain(res.status);
  });
});
```

**Step 2: Run — expect RED**

```bash
cd server && npx jest tests/tenancy.test.js -t "C-3" --forceExit 2>&1 | tail -15
```
Expected: equipier/cuisinier tests FAIL (current behavior: action executes, returns 200/500, not 403). Gérant test may pass.

---

### Task 3: Green — role gate in `execute-action`

**Files:**
- Modify: `server/routes/ai.js` (lines ~1069-1080 and 1247-1260)

**Step 1: Hoist `roleRestrictions` to module scope**

Move the literal out of `filterActionsByRole` to the top of the file (near other constants):

```js
// Action-level role restrictions. gerant has full access.
const ROLE_RESTRICTIONS = {
  cuisinier: ['create_recipe', 'delete_recipe', 'add_supplier', 'modify_supplier_price'],
  equipier: ['add_ingredient', 'modify_ingredient', 'create_recipe', 'delete_recipe', 'add_supplier', 'create_order', 'modify_supplier_price'],
  salle: ['add_ingredient', 'modify_ingredient', 'create_recipe', 'delete_recipe', 'add_supplier', 'create_order', 'modify_supplier_price'],
};

function isActionAllowedForRole(type, role) {
  return !ROLE_RESTRICTIONS[role]?.includes(type);
}
```

Rewrite `filterActionsByRole` to use the hoisted map:

```js
function filterActionsByRole(actions, role) {
  if (!ROLE_RESTRICTIONS[role]) return actions; // gerant
  return actions.filter(action => !ROLE_RESTRICTIONS[role].includes(action.type));
}
```

**Step 2: Add 403 gate in `POST /api/ai/execute-action`** (at `server/routes/ai.js:1072-1079`)

Right after the `type`/`params` validation, before `try {`:

```js
if (!isActionAllowedForRole(type, user.role)) {
  return res.status(403).json({ error: 'Action non autorisée pour ce rôle' });
}
```

**Step 3: Run the C-3 tests — expect GREEN**

```bash
cd server && npx jest tests/tenancy.test.js -t "C-3" --forceExit 2>&1 | tail -15
```
Expected: all 3 pass.

**Step 4: Run the full suite to catch regressions**

```bash
cd server && npm test 2>&1 | tail -5
```
Expected: all tests pass (142 original + new ones).

**Step 5: Commit**

```bash
git add server/routes/ai.js server/tests/tenancy.test.js
git commit -m "fix(ai): role-gate /api/ai/execute-action (C-3)

Hoists roleRestrictions to module scope and rejects non-permitted
actions with 403 before executing. Previously only the /assistant
response was filtered; /execute-action bypassed the gate entirely
(EVAL_SECURITE_EXPERT.md C-3)."
```

---

### Task 4: Red tests for C-2 (RGPD export leak)

**Files:**
- Modify: `server/tests/tenancy.test.js`

**Step 1: Append the failing tests**

```js
describe('C-2: GET /api/accounts/:id/export access control', () => {
  beforeAll(() => {
    const bcrypt = require('bcryptjs');
    const pw = bcrypt.hashSync('Secure1pass', 10);
    run("INSERT OR IGNORE INTO restaurants (id, name) VALUES (100, 'R100')");
    run("INSERT OR IGNORE INTO restaurants (id, name) VALUES (200, 'R200')");
    run(
      "INSERT OR IGNORE INTO accounts (id, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?)",
      [1001, 'owner-r100@test.fr', pw, 'gerant', 100]
    );
    run(
      "INSERT OR IGNORE INTO accounts (id, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?)",
      [1002, 'owner-r200@test.fr', pw, 'gerant', 200]
    );
    run(
      "INSERT OR IGNORE INTO accounts (id, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?)",
      [1003, 'staff-r100@test.fr', pw, 'equipier', 100]
    );
  });

  it('blocks user A exporting user B in a different restaurant', async () => {
    const res = await request(app)
      .get('/api/accounts/1002/export')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(403);
  });

  it('blocks a non-gérant from exporting another account in their own restaurant', async () => {
    const res = await request(app)
      .get('/api/accounts/1001/export')
      .set(authHeader({ id: 1003, role: 'equipier', restaurant_id: 100 }));
    expect(res.status).toBe(403);
  });

  it('allows an account to export itself', async () => {
    const res = await request(app)
      .get('/api/accounts/1003/export')
      .set(authHeader({ id: 1003, role: 'equipier', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('account');
    expect(res.body.account.id).toBe(1003);
  });

  it('does not include cross-tenant recipes/ingredients/stock in the export', async () => {
    const res = await request(app)
      .get('/api/accounts/1003/export')
      .set(authHeader({ id: 1003, role: 'equipier', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    // Phase 1 lockdown: these bulk fields are removed until Phase 2 restores
    // them with proper tenant filtering.
    expect(res.body).not.toHaveProperty('recipes');
    expect(res.body).not.toHaveProperty('ingredients');
    expect(res.body).not.toHaveProperty('stock');
    expect(res.body).not.toHaveProperty('temperature_logs');
    expect(res.body).not.toHaveProperty('cleaning_logs');
    expect(res.body).not.toHaveProperty('traceability_logs');
    expect(res.body).not.toHaveProperty('supplier_prices');
  });
});
```

**Step 2: Run — expect RED**

```bash
cd server && npx jest tests/tenancy.test.js -t "C-2" --forceExit 2>&1 | tail -15
```
Expected: the 403 tests FAIL (endpoint returns 200 today); the "no bulk fields" test FAILS (endpoint includes them).

---

### Task 5: Green — lock down export endpoint

**Files:**
- Modify: `server/routes/accounts.js:307-340`

**Step 1: Replace the handler body**

```js
// GET /api/accounts/:id/export — RGPD data export (self or same-tenant gérant)
// Phase 1 lockdown: bulk cross-tenant fields temporarily removed until
// Phase 2 adds restaurant_id to recipes/ingredients/stock/logs and restores
// proper tenant-scoped filtering. See docs/plans/2026-04-17-multi-tenancy-isolation-design.md
router.get('/:id/export', requireAuth, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'id invalide' });
  }

  const target = get(
    'SELECT id, name, email, role, restaurant_id, created_at, last_login FROM accounts WHERE id = ?',
    [targetId]
  );
  if (!target) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }

  const callerId = parseInt(req.user.id, 10);
  const callerRole = req.user.role;
  const callerRestaurantId = req.user.restaurant_id;

  const isSelf = callerId === targetId;
  const isSameTenantGerant =
    callerRole === 'gerant' && callerRestaurantId === target.restaurant_id;

  if (!isSelf && !isSameTenantGerant) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const restaurant = target.restaurant_id
    ? get('SELECT id, name, address, created_at FROM restaurants WHERE id = ?', [target.restaurant_id])
    : null;

  const exportData = {
    exported_at: new Date().toISOString(),
    account: target,
    restaurant,
    _notice:
      'Phase 1 lockdown: recettes, ingrédients, stock et logs seront réintégrés avec filtrage par restaurant en Phase 2.',
  };

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="restosuite-export-${today}.json"`);
  res.json(exportData);
});
```

**Step 2: Run the C-2 tests — expect GREEN**

```bash
cd server && npx jest tests/tenancy.test.js -t "C-2" --forceExit 2>&1 | tail -15
```
Expected: all 4 pass.

**Step 3: Run full suite**

```bash
cd server && npm test 2>&1 | tail -5
```
Expected: all pass.

**Step 4: Commit**

```bash
git add server/routes/accounts.js server/tests/tenancy.test.js
git commit -m "fix(accounts): lock down RGPD export endpoint (C-2)

Require caller to be the account itself OR a gérant of the same
restaurant. Remove the unscoped SELECT * dumps of recipes, ingredients,
stock, temperature_logs, cleaning_logs, traceability_logs and
supplier_prices — they returned the entire multi-tenant database to
any authenticated user. Phase 2 restores those fields with proper
tenant filtering once schema has restaurant_id columns.
(EVAL_SECURITE_EXPERT.md C-2)"
```

---

### Task 6: Red tests for C-1 (hardcoded `restaurant_id = 1`)

**Files:**
- Modify: `server/tests/tenancy.test.js`

**Step 1: Append the failing tests**

```js
describe('C-1: routes must filter by caller restaurant_id, not hardcoded 1', () => {
  beforeAll(() => {
    // Seed one customer per restaurant
    run("INSERT OR IGNORE INTO customers (id, restaurant_id, name) VALUES (5001, 100, 'CustR100')");
    run("INSERT OR IGNORE INTO customers (id, restaurant_id, name) VALUES (5002, 200, 'CustR200')");
    // Seed one carbon target per restaurant (period must be unique per (period, restaurant_id))
    run("INSERT OR IGNORE INTO carbon_targets (id, restaurant_id, period, target_co2_kg) VALUES (6001, 100, 'monthly', 100)");
    run("INSERT OR IGNORE INTO carbon_targets (id, restaurant_id, period, target_co2_kg) VALUES (6002, 200, 'monthly', 200)");
    // Seed loyalty rewards
    run("INSERT OR IGNORE INTO loyalty_rewards (id, restaurant_id, name, points_required) VALUES (7001, 100, 'RewardR100', 50)");
    run("INSERT OR IGNORE INTO loyalty_rewards (id, restaurant_id, name, points_required) VALUES (7002, 200, 'RewardR200', 50)");
  });

  it('GET /api/crm/customers returns only caller-restaurant rows', async () => {
    const resR100 = await request(app)
      .get('/api/crm/customers')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(resR100.status).toBe(200);
    const names100 = (resR100.body.customers || resR100.body).map(c => c.name);
    expect(names100).toContain('CustR100');
    expect(names100).not.toContain('CustR200');

    const resR200 = await request(app)
      .get('/api/crm/customers')
      .set(authHeader({ id: 1002, role: 'gerant', restaurant_id: 200 }));
    expect(resR200.status).toBe(200);
    const names200 = (resR200.body.customers || resR200.body).map(c => c.name);
    expect(names200).toContain('CustR200');
    expect(names200).not.toContain('CustR100');
  });

  it('GET /api/crm/loyalty/rewards returns only caller-restaurant rewards', async () => {
    const res = await request(app)
      .get('/api/crm/loyalty/rewards')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }));
    expect(res.status).toBe(200);
    const names = (res.body.rewards || res.body).map(r => r.name);
    expect(names).toContain('RewardR100');
    expect(names).not.toContain('RewardR200');
  });

  it('carbon_targets upsert is scoped to caller restaurant', async () => {
    // R100 gérant updates its monthly target; R200's row must be untouched
    const patch = await request(app)
      .post('/api/carbon/targets')
      .set(authHeader({ id: 1001, role: 'gerant', restaurant_id: 100 }))
      .send({ period: 'monthly', target_co2_kg: 999 });
    expect([200, 201]).toContain(patch.status);

    const { get } = require('../db');
    const r100 = get('SELECT target_co2_kg FROM carbon_targets WHERE restaurant_id = 100 AND period = ?', ['monthly']);
    const r200 = get('SELECT target_co2_kg FROM carbon_targets WHERE restaurant_id = 200 AND period = ?', ['monthly']);
    expect(r100.target_co2_kg).toBe(999);
    expect(r200.target_co2_kg).toBe(200); // unchanged
  });
});
```

Note: exact endpoint paths (`/api/crm/customers`, `/api/crm/loyalty/rewards`, `/api/carbon/targets`) — verify with Grep if any fail with 404, then adjust tests to real paths.

**Step 2: Run — expect RED**

```bash
cd server && npx jest tests/tenancy.test.js -t "C-1" --forceExit 2>&1 | tail -25
```
Expected: cross-tenant reads leak; carbon_targets upsert touches tenant 1's row regardless of caller.

---

### Task 7: Green — replace hardcoded tenant in 5 route files

Replace every `restaurant_id = 1` literal (read and write paths) with the caller's `req.user.restaurant_id`. Target files and lines from Grep:

**7a. `server/routes/crm.js`**
- Line 72: `'SELECT * FROM customers WHERE restaurant_id = 1'` → `'SELECT * FROM customers WHERE restaurant_id = ?'` + pass `req.user.restaurant_id` in the params array. Check the full query builder block for any other literal.
- Line 214: `'SELECT * FROM loyalty_rewards WHERE restaurant_id = 1 ORDER BY points_required'` → parameterized with caller tenant.
- Lines 274-288 (analytics): every `WHERE restaurant_id = 1` → parameterized. Each aggregate must receive caller tenant.
- Also: any `INSERT INTO customers/loyalty_rewards (...)` in this file must include `restaurant_id = req.user.restaurant_id` (check with grep).

**7b. `server/routes/integrations.js`**
- Lines 59, 97, 128, 165, 178, 188, 230, 241: replace literal.
- INSERT paths: `INSERT INTO integrations (restaurant_id, provider, ...) VALUES (?, ?, ...)` must use `req.user.restaurant_id`.
- `UPDATE integrations SET sync_status = ... WHERE provider = ? AND restaurant_id = 1` → parameterize.

**7c. `server/routes/carbon.js`**
- Line 302 (and any other hits from grep): replace literal; ensure INSERT paths include `restaurant_id`.

**7d. `server/routes/health.js`**
- Line 31: `VALUES (1, ?, date('now'))` — this is the hardcoded literal in the INSERT. Replace with `VALUES (?, ?, date('now'))` and pass `req.user.restaurant_id` first in params.
- Line 50: `WHERE restaurant_id = 1 AND date >= ?` → parameterize.

**7e. `server/routes/public-api.js`**
- Line 82: `SELECT ... FROM api_keys WHERE restaurant_id = 1` → parameterize with caller tenant.
- Any other hits: scan file for all `restaurant_id = 1` and `restaurant_id=1`, replace with caller tenant.

**Step 1: Do each file with Edit; after each file, run the relevant C-1 tests**

After `crm.js`:
```bash
cd server && npx jest tests/tenancy.test.js -t "C-1" --forceExit 2>&1 | tail -15
```

Repeat after each file until all C-1 tests pass.

**Step 2: Sanity grep — no hardcoded `restaurant_id = 1` literals should remain in route code**

```bash
grep -rn "restaurant_id\s*=\s*1\b" server/routes/ || echo "CLEAN"
```
Expected: `CLEAN` (or only migration/seed lines with comments — inspect any hits).

**Step 3: Run full suite**

```bash
cd server && npm test 2>&1 | tail -5
```
Expected: all pass.

**Step 4: Commit**

```bash
git add server/routes/crm.js server/routes/integrations.js server/routes/carbon.js server/routes/health.js server/routes/public-api.js server/tests/tenancy.test.js
git commit -m "fix(routes): replace hardcoded restaurant_id=1 with caller tenant (C-1 partial)

crm, integrations, carbon, health, public-api: every literal
'restaurant_id = 1' replaced by req.user.restaurant_id from JWT.
INSERTs now carry the caller's tenant. Target tables already have
the restaurant_id column. Remaining tables (recipes, ingredients,
stock, HACCP logs, etc.) are handled in Phase 2/3 along with
schema migration.
(EVAL_SECURITE_EXPERT.md C-1)"
```

---

### Task 8: Verify + merge to main

**Step 1: Full suite one more time from clean state**

```bash
cd server && npm test 2>&1 | tail -10
```
Expected: all tests (original 142 + Phase 1 additions) pass.

**Step 2: Confirm the branch is clean**

```bash
git status
```
Expected: "nothing to commit, working tree clean".

**Step 3: Merge to main with --no-ff**

```bash
cd /Users/Alfred/.openclaw/workspace/projects/restosuite/.claude/worktrees/condescending-bhaskara
git log --oneline -6
git checkout main
git merge --no-ff claude/condescending-bhaskara -m "Merge Phase 1 — multi-tenancy critical hotfixes (C-1/C-2/C-3)"
git checkout claude/condescending-bhaskara
```

Note: main branch may not be checked out in this worktree (it's checked out in the primary working tree). If `git checkout main` fails with "already checked out", do the merge from the primary working tree at `/Users/Alfred/.openclaw/workspace/projects/restosuite/` instead.

**Step 4: Update memory with completion status**

Update `project-multitenancy-initiative.md` to mark Phase 1 as merged.

---

## Done criteria (Phase 1)

- All tests green (`npm test` in `server/`).
- `grep -rn "restaurant_id\s*=\s*1\b" server/routes/` returns no hits (or only benign comments/migrations).
- `POST /api/ai/execute-action` returns 403 for equipier/cuisinier/salle on restricted actions.
- `GET /api/accounts/:id/export` returns 403 for non-owner, non-same-tenant-gérant callers.
- `GET /api/crm/customers` returns only caller-tenant rows.
- Phase 1 merged to `main` with `--no-ff`.
- Memory updated.
