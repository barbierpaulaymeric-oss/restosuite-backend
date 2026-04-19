# HACCP Audit Verification — 2026-04-19

Verification of the latest HACCP audit findings against the live code on `main`.
Each finding was grep-confirmed in the source before being classified.

Result: **2 real findings fixed, 3 false positives invalidated**.

---

## Finding #1 — cooling_logs / reheating_logs missing `restaurant_id`

**Verdict: FALSE POSITIVE**

The bare `CREATE TABLE` at `server/db-migrations.js:397` and `:421` does not
list `restaurant_id`, but the Phase 2 multi-tenancy migration at `:1663-1707`
runs an `ALTER TABLE … ADD COLUMN restaurant_id` over every tenant-scoped
table, including both `cooling_logs` and `reheating_logs` (explicitly listed
in `PHASE2_TABLES` at `:1670`), and creates an index on it.

Every INSERT path (`routes/haccp.js:760, :849`, `routes/ai-actions.js:290, :314`)
already writes `restaurant_id`, and `tests/phase2-schema.test.js` has two
assertions that fail the suite if either column is missing:

```
✓ cooling_logs.restaurant_id exists
✓ reheating_logs.restaurant_id exists
```

No action taken.

---

## Finding #2 — CCP1 reception: no product-specific temperature thresholds

**Verdict: REAL — FIXED**

`POST /api/haccp/traceability` at `routes/haccp.js:379-399` (pre-fix) accepted
`temperature_at_reception` with **zero validation**: no type check, no range
check, no product-category threshold. Any number (or string) was persisted.

### Fix

Added a shared helper `server/lib/haccp-thresholds.js` with category-keyed
max temperatures per the Arrêté du 21/12/2009 Annexe IV and CE 853/2004:

| Category        | Max temp (°C) |
|-----------------|---------------|
| `viande_fraiche`|  +4           |
| `surgeles`      | -18           |
| `laitiers`      |  +4           |
| `fruits_legumes`|  +8           |
| `mer`           |  +2           |

`POST /traceability` now accepts an optional `product_category` field and
rejects out-of-threshold values with a 400 + explicit French error message.
Missing category still goes through a basic type/range check (-30°C…+60°C).

A new `traceability_logs.product_category TEXT` column is added via
idempotent `ALTER TABLE` in the existing "Traçabilité réception enrichie"
migration block.

**Files touched:**
- `server/lib/haccp-thresholds.js` (new)
- `server/db-migrations.js` — +4 lines
- `server/routes/haccp.js` — +7 / -3 lines

---

## Finding #3 — CCP2 cooking: hardcoded 63°C, no product-awareness

**Verdict: PARTIALLY REAL — FIXED**

The route `POST /api/haccp/cooking` at `routes/haccp.js:1190` already
enforced the 63°C baseline (`:1208`) with the correct legal citation
(Arrêté 21/12/2009), but the threshold was **not product-aware** — a poultry
record with `target_temperature = 63` would pass silently, violating DGAL/
SDSSA/N2012-8156.

### Fix

`haccp-thresholds.js` also exports `validateCookingTarget(category, temp)`
with the legal per-category minima:

| Category              | Min core temp (°C) | Source                       |
|-----------------------|--------------------|------------------------------|
| *(none / standard)*   | 63                 | Arrêté 21/12/2009 (baseline) |
| `volaille`            | 65                 | DGAL/SDSSA/N2012-8156        |
| `viande_hachee`       | 70                 | DGAL/SDSSA/N2012-8156        |
| `remise_temperature`  | 75                 | Guide HACCP (RTE)            |

Both `POST /cooking` and `PUT /cooking/:id` now:
1. still require target_temperature in [0, 300]
2. require target_temperature ≥ `minCookingTempFor(product_category)`
3. persist `product_category` alongside `core_temp_point` on the row

New `cooking_records.product_category TEXT` column via idempotent ALTER
next to the existing `cooking_records` CREATE TABLE block.

**Files touched:**
- `server/routes/haccp.js` — cooking POST/PUT, +7 / -10 lines net
- `server/db-migrations.js` — +5 lines (ALTER COLUMN inside existing block)

---

## Finding #4 — Huiles de friture module missing

**Verdict: FALSE POSITIVE**

The fryer (huiles de friture) module is fully implemented:

- Tables: `fryers`, `fryer_checks` (db-migrations.js:1670 Phase 2 list)
- Routes: `POST /api/haccp/fryers` (haccp.js:913), `POST /api/haccp/fryers/:id/checks` (haccp.js:951)
- **Legal enforcement of ≤25% polar compounds** (Arrêté 21/12/2009 Art. 6) — covered by 6 dedicated tests in `tests/haccp.test.js` ("Fryer polar compounds enforcement").

All 6 tests were passing before this sprint and still pass after. No action taken.

---

## Finding #5 — `innerHTML` sites in `app.bundle.js`

**Verdict: FALSE POSITIVE**

Raw counts are misleading: `app.bundle.js` is compiled output. In the
source views directory (`client/js/views/`):

- `innerHTML` assignments: **429**
- `escapeHtml(...)` calls: **713** (≈1.66× more escapes than innerHTML sites)

A targeted grep for `.innerHTML = \`…\${…}\`` patterns that do **not** call
`escapeHtml` or a trusted formatter returned **exactly 2** lines:

1. `recipe-form.js:356` — `${formSteps.map(...)}` — the map body escapes.
2. `recipe-form.js:423` — `${formatCurrency(price)}` — `price` is a number, `formatCurrency` returns a locale-formatted string.

This matches the documented "escape at the helper" pattern (see project
memory `feedback_escape_at_helper.md`). No action taken.

---

## Tests & build

```
Test Suites: 19 passed, 19 total
Tests:       361 passed, 361 total

✓ Bundle généré : client/js/app.bundle.js (1144.4 KB) en 84ms
```

## Commit

Fix shipped in commit on `main` (see `git log`): adds
`server/lib/haccp-thresholds.js`, two idempotent `ALTER TABLE` migrations,
and category-aware validation in `POST /traceability`, `POST /cooking`,
`PUT /cooking/:id`.

No database backfill required — the new `product_category` column is
nullable and routes accept `null` (falling back to baseline thresholds),
so existing records and callers that don't yet send the field keep working.
