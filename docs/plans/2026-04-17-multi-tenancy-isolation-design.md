# Multi-Tenancy Isolation — Design

**Date:** 2026-04-17
**Branch:** `claude/condescending-bhaskara`
**Status:** approved — Phase 1 in-flight
**Authors:** Alfred + Claude

## Problem

Independent security re-audit (`EVAL_SECURITE_EXPERT.md`, 2026-04-17) found three open CRITICAL issues:

- **C-1 Broken multi-tenancy.** Core tables (`ingredients`, `recipes`, `stock`, `stock_movements`, `suppliers`, `supplier_prices`, `temperature_zones`, `temperature_logs`, `cleaning_tasks`, `cleaning_logs`, `price_history`, and most other operational tables) lack `restaurant_id`. ~20+ route sites hardcode `restaurant_id = 1` (`public-api.js`, `integrations.js`, `health.js`, `carbon.js`, `crm.js`). The moment a second tenant signs up, they share all data with tenant 1.
- **C-2 RGPD export leak.** `GET /api/accounts/:id/export` (`server/routes/accounts.js:316-322`) does `SELECT *` from recipes/ingredients/stock/temperature_logs/cleaning_logs/traceability_logs/supplier_prices with no tenant filter. Any authenticated user downloads the entire multi-tenant DB.
- **C-3 AI priv-esc.** `POST /api/ai/execute-action` (`server/routes/ai.js:1072`) does not call `filterActionsByRole`. Equipier/salle/cuisinier can call it directly to execute writes (`create_recipe`, `delete_recipe`, etc.) they would otherwise be blocked from.

Additionally, HACCP compliance requires an immutable audit log that we do not currently have.

## Goal

Deliver verified tenant isolation across all tables and routes, plus an immutable `audit_log` that HACCP-critical writes flow through.

## Non-goals

- Fixing H-1 PIN cross-tenant collision (separate initiative; requires PIN scope redesign).
- JWT revocation / blocklist (H-3; separate initiative).
- XSS hardening of `client/js/*` (H-4; separate initiative).
- At-rest DB encryption (H-5; deployment concern, separate).

## Approach (approved 2026-04-17)

**Phased delivery, each phase mergeable to `main` once tests pass:**

### Phase 1 — Critical hotfixes (no schema change)
Stop-the-bleeding security fixes that do not require the schema migration:

- **Fix A — `ai.js` role check.** Hoist `roleRestrictions` from inside `filterActionsByRole` to a module-level const. In `POST /api/ai/execute-action`, reject with 403 before the `switch` if `roleRestrictions[user.role]?.includes(type)`.
- **Fix B — `accounts.js` export lockdown.** Gate: caller must be the account owner OR gérant of the same `restaurant_id`. **Temporarily** remove the cross-tenant `SELECT *` dumps; export returns only the account's own profile row + its restaurant record. Phase 2 restores tenant-scoped full export. Decision: security over completeness, degrade RGPD portability briefly rather than leave the leak live.
- **Fix C — replace hardcoded `restaurant_id = 1`** with `req.user.restaurant_id` in `public-api.js`, `integrations.js`, `crm.js`, `carbon.js`, `health.js`. These target tables already have the column.

Tests: new `server/tests/tenancy.test.js` with T-A (role gate), T-B1/B2/B3 (export access + scope), T-C (two-tenant seeded case, cross-tenant read blocked).

### Phase 2 — Schema migration + audit log + tenant middleware
- `ALTER TABLE ... ADD COLUMN restaurant_id INTEGER REFERENCES restaurants(id)` for every tenant-scoped table that lacks it.
- Backfill: `UPDATE <table> SET restaurant_id = 1 WHERE restaurant_id IS NULL` (existing rows belong to tenant 1).
- Add `CREATE INDEX idx_<table>_restaurant_id` for each.
- Create `audit_log`: `(id, restaurant_id, account_id, table_name, record_id, action CHECK IN ('create','update','delete'), old_values TEXT, new_values TEXT, created_at)`. No UPDATE/DELETE exposed in any route; writes use an append-only helper.
- Add a small `tenant.js` middleware/helper that exposes `req.user.restaurant_id`, rejects if missing, and provides a `scopedDb` wrapper for the most common operations. Do not force every route to use the wrapper; prefer explicit `WHERE restaurant_id = ?` for auditability.
- Restore `accounts.js` export with proper tenant filter.

### Phase 3 — Route-by-route conversion (themed batches)
Convert remaining routes to filter by `req.user.restaurant_id` and include `restaurant_id` in INSERTs. Batches grouped by domain; each batch is one PR of ~8-10 files. Proposed batches:
1. Stock + ingredients + recipes + supplier_prices + price_history
2. HACCP core (temperature, cleaning, traceability, cooling, reheating, fryers, non_conformities)
3. HACCP plan (hazard_analysis, ccp, decision_tree, recall, training, pest_control, equipment_maintenance, waste, allergen_plan, water, pms_audits, tiac, fabrication_diagrams)
4. Operations (orders, order_items, purchase_orders, service_sessions, tables, deliveries, variance)
5. Supplier + portal + corrective actions + downstream traceability
6. Admin + AI write paths + misc

### Phase 4 — HACCP audit-log wiring + verification sweep
- Wire audit_log inserts into every HACCP write (temperature log, cleaning log, non-conformity, corrective action, training, recall, etc.).
- Add a read-only `GET /api/audit-log` endpoint (gérant-only, tenant-scoped, paginated) so DDPP inspectors see it.
- Final sweep: grep for any remaining `SELECT/INSERT/UPDATE/DELETE` on tenant tables missing `restaurant_id` in the WHERE clause; fix stragglers.
- Security re-verification against `EVAL_SECURITE_EXPERT.md` C-1/C-2/C-3.

## Testing strategy

- Every phase: `npm test` fully green in `server/` before merge.
- Every phase adds coverage for the new behavior. Tenancy tests seed at least two restaurants and assert one cannot read/write the other's rows.
- Phase 4 adds audit-log assertions (insert produces a row, row is never mutated, DELETE is refused).

## Merge & review

- One commit per logical fix, clear messages.
- Worktree `claude/condescending-bhaskara` → merge each phase to `main` with `--no-ff` after green tests.
- No force pushes. No `--no-verify`. Pre-commit hooks (if any) are respected.
- Decision record mirrored to second-brain vault at `/Users/Alfred/.openclaw/workspace/second-brain/` (architectural decisions folder).

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Backfill `restaurant_id = 1` collides with future multi-tenant data | Backfill runs exactly once on migration; subsequent rows always carry explicit tenant. Acceptable because today there IS only one tenant. |
| Middleware that forces tenant filter might hide a missing `WHERE` | We keep explicit `WHERE restaurant_id = ?` in route code so every filter is greppable and audit-reviewable. Helper is additive, not mandatory. |
| Huge route-by-route diff in Phase 3 causes merge pain | Themed batches (8-10 files each), merged incrementally, keep review surface bounded. |
| Fix B temporarily degrades RGPD export | Short-lived; Phase 2 restores it with proper scoping. Users get their account row during the gap, not nothing. |
| Schema migration on production SQLite | `ALTER TABLE ADD COLUMN` is online in SQLite; `UPDATE` backfill of tenant 1 rows runs in a single transaction. Test against a prod DB copy before deploying. |

## Out of scope (explicitly)

- H-1 (PIN cross-tenant collision)
- H-3 (JWT revocation)
- H-4 (XSS in client)
- H-5 (at-rest encryption)
- Render.yaml persistent-disk config
- CSV Excel injection neutralization
- Public API key at-rest encryption
