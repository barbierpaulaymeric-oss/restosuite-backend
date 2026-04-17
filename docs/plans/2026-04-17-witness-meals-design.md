# Plats témoins (witness meals) — Design

**Date:** 2026-04-17
**Regulatory basis:** Arrêté du 21 décembre 2009, Article 32
**Closes:** HACCP expert-audit critical gap #4 (plats témoins = boolean only)

## Problem

`tiac_procedures.plats_temoins_conserves` is a single boolean flag. A DDPP
inspector re-auditing RestoSuite (EVAL_HACCP_EXPERT.md, 17/04/2026) flagged
this as a blocker for collectivités / traiteur / livraison: without per-sample
tracking (dish, quantity, storage T°, retention end date, disposal trace), the
module cannot be used to prove compliance in a post-TIAC control.

Plats témoins are MANDATORY for collectivités (>150 meals/day) and
livraison/traiteur operations: per-meal reference samples ≥100 g, kept at
0–3 °C for at least 5 days, traceable.

## Scope

Full CRUD module `witness_meals` with tenant scoping, audit logging, TIAC
cross-check integration, and a dedicated HACCP sub-navigation entry.

Out of scope: automatic pre-population from a `service_sessions` catalog (the
"missing-sample" alert uses a simple date-gap heuristic for now; a stricter
catalog-driven check can be added later).

## Database

New table `witness_meals`:

```sql
CREATE TABLE IF NOT EXISTS witness_meals (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id        INTEGER NOT NULL,
  meal_date            TEXT NOT NULL,
  meal_type            TEXT NOT NULL CHECK(meal_type IN
                         ('petit_dejeuner','dejeuner','diner','gouter','collation')),
  service_type         TEXT CHECK(service_type IN
                         ('sur_place','livraison','emporter','traiteur')),
  samples              TEXT,              -- JSON [{name, quantity, location}]
  storage_temperature  REAL,              -- °C, expected 0..3
  storage_location     TEXT,
  kept_until           TEXT NOT NULL,     -- meal_date + 5 days (ISO)
  disposed_date        TEXT,
  disposed_by          TEXT,
  quantity_per_sample  TEXT DEFAULT '100g minimum',
  is_complete          INTEGER DEFAULT 0,
  notes                TEXT,
  operator             TEXT,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_witness_meals_restaurant_date ON witness_meals(restaurant_id, meal_date DESC);
CREATE INDEX idx_witness_meals_kept_until      ON witness_meals(restaurant_id, kept_until);
```

The table is added to `PHASE2_TABLES` for consistency with other tenant-scoped
tables.

## API — `/api/haccp/witness-meals`

Mounted under the `/api/haccp` prefix; inherits `planGate('essential')` from
`app.js:171`. All handlers `requireAuth`-guarded and WHERE-filter by
`req.user.restaurant_id`. Writes go through `writeAudit`.

| Verb   | Path          | Purpose                                          |
|--------|---------------|--------------------------------------------------|
| GET    | `/`           | List with pagination + date filters              |
| GET    | `/active`     | `disposed_date IS NULL AND kept_until >= now()`  |
| GET    | `/overdue`    | `disposed_date IS NULL AND kept_until < now()`   |
| GET    | `/alerts`     | Days in last 7 with no witness meal              |
| GET    | `/:id`        | Single record                                    |
| POST   | `/`           | Create; auto-compute `kept_until` = +5 days      |
| PUT    | `/:id`        | Update (typically: fill disposal info)           |
| DELETE | `/:id`        | Delete; audit-logged                             |

`kept_until` is computed server-side as `date(meal_date, '+5 days', '+23:59')`
so that a sample from a 2026-04-17 lunch stays in the active list for the full
5th day.

## TIAC integration

Extend `routes/tiac.js` with:

```
GET /api/tiac/:id/witness-meals-check
```

Returns witness meals with `meal_date` within
`[date_incident − 3 days, date_incident]` for the procedure's restaurant, plus
a `has_coverage: boolean`. Additive, non-breaking.

## Client

- New view: `client/js/views/haccp-witness-meals.js`
  - KPIs: total samples, active, overdue, missing-date alerts
  - Alert banners for overdue and date-gap alerts
  - Table of active samples with countdown (`kept_until − now`)
  - History section with date filter
  - Modal form mirrors `haccp-staff-health.js` patterns
  - Regulatory reminder banner: "100 g minimum par plat, conservation 0–3 °C
    pendant 5 jours minimum — Arrêté 21/12/2009 art. 32"
- `HACCP_SUBNAV_ITEMS` (in `haccp-dashboard.js`): add
  `{ href: '#/haccp/witness-meals', label: 'Plats témoins' }` — placed near TIAC.
- `Router.add(/^\/haccp\/witness-meals$/, renderHACCPWitnessMeals)` in `app.js`
- Add view file to `scripts/build.js` bundle list; rebuild `app.bundle.js`

## Tests

`server/tests/witness-meals.test.js` (supertest, in-memory DB):

- POST auto-computes `kept_until = meal_date + 5 days`
- GET `/active` / `/overdue` correctly bucket rows
- Tenant isolation (restaurant_id=2 cannot see restaurant_id=1 rows)
- writeAudit emits row on create/update/delete
- PUT disposal flow clears the "active" bucket
- TIAC `/:id/witness-meals-check` returns matches within the incident window

## Rollout

1. Merge migration + route + tests on feature branch.
2. Tests green → merge to `main`.
3. Update `project-haccp.md` memory to reflect gap #4 closed.
4. Short ADR in second-brain `02-decisions/architecture/`.
