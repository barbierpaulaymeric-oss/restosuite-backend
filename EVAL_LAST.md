# EVAL_LAST — Final 5-Expert Audit

**Date:** 2026-04-19
**Branch:** main (commit `a56078d`)
**Scope:** Full codebase read from scratch by 5 parallel subagents + direct spot-verification.
**Validation runs:** `npm test` → **358/358 pass** · `npm audit --production` → **0 vulnerabilities**

---

## Global verdict

| Axis | Score | Weight | Weighted |
|---|---:|---:|---:|
| Security | 6.5/10 | 25% | 1.625 |
| DDPP/HACCP compliance | 8.5/10 | 25% | 2.125 |
| UX/design | 7.5/10 | 15% | 1.125 |
| CTO / architecture | 6.4/10 | 20% | 1.280 |
| Business / GTM | 6.2/10 | 15% | 0.930 |
| **Global** | | | **7.09 / 10** |

**Verdict: CONDITIONAL GO.** The product is feature-complete on its core promise (12 PMS domains covered, DDPP-inspection-ready, 358 tests green, 0 npm vulns), but **one newly-discovered P0 cross-tenant data leak in `predictions.js` blocks production** and must be closed before any paying customer touches the `/demand` endpoint. Secondary conditions (in-memory rate limiter, onboarding mobile UX, pricing-tier alignment with voice-input positioning) are fixable in a 2–3 week sprint. Not ready for Series A pitch; ready for private beta with compliance-first customers once P0 is closed.

---

## 1. Security — 6.5/10

### P0 — Multi-tenant data leak in `/api/predictions/demand` (NEW, VERIFIED)
- **File:line:** `server/routes/predictions.js:56-88` (3 queries) + `predictions.js:38-41` (module-level `_predCache`, `_predCacheTime`, 4-hour TTL)
- **Proof (spot-verified by direct read):**
  - L.56–65: `SELECT … FROM orders o WHERE o.status NOT IN (…) AND date(o.created_at) >= ?` — **no `restaurant_id` filter**, no `accountId` join.
  - L.68–78: `SELECT … FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN recipes r ON r.id = oi.recipe_id WHERE …` — joins across 3 tenant-scoped tables with no tenant WHERE.
  - L.81–88: Third unscoped `FROM orders` for hourly patterns.
  - L.38–40: `_predCache` is a module-level `let`, shared across all requests; TTL = 4 h (`PRED_TTL`). First caller populates it with global-joined data; every tenant for 4 hours reads the blend.
- **Impact:** Any authenticated user calling `GET /api/predictions/demand` receives a 7-day forecast whose `predicted_orders`, `predicted_revenue`, `top_expected_recipes`, and `hourly_patterns` are computed from **every tenant's orders**. Leaks: revenue magnitudes, rush-hour patterns, best-seller recipes. Cache persists 4 h — a single trigger contaminates all other tenants' views.
- **Fix (expected shape):** `WHERE o.restaurant_id = ? AND …` in all three queries + key the cache by `restaurant_id` (e.g. `_predCache[restaurantId]`), not a scalar.
- **Grep-sweep reminder:** per `feedback_grep_sweep_after_one_leak.md`, when one leak lands, grep `FROM orders`, `FROM order_items`, `FROM recipes` across all routes immediately.

### P1 — In-memory rate limit breaks horizontal scale
- **File:line:** `server/app.js:98-124` — `express-rate-limit` with no `store`.
- **Impact:** At 2 instances on Render, each limiter runs independent counters. Global limits are halved in effective enforcement; PIN and AI-cost throttles silently weaken.
- **Fix:** ship `rate-limit-redis` + `ioredis` before cutting over a second web dyno. Known and logged in `feedback_redis_before_second_instance.md`.

### VERIFIED CLOSED (spot-confirmed by subagent)
- JWT secret boot-time fail-closed (`app.js:30–35`), CSP3 split (`app.js:90`), CSRF guard (`csrf.js` + `app.js:223`), staff-PIN default removed (`auth.js:271`), audit-log hash chain (`audit-log.js:68–96` + `verifyAuditChain`), accounts IDOR (`accounts.js:218/334/380` tenant-scoped), innerHTML escape at helper (`api.js:684`), no plaintext secrets in `.env.example`.

---

## 2. DDPP / HACCP — 8.5/10

### 12-domain coverage — **all covered**
Temperatures, cuisson CCP2 (≥63 °C), refroidissement, remise en température, friture (≤25 % polaires), étalonnage, **plats témoins (J+5, 0–3 °C, 100 g)**, nettoyage, nuisibles, personnel santé+formation, traçabilité amont+aval, non-conformités — every domain has a server route and a client view. Bonus coverage: water, waste, maintenance, TIAC, INCO 14 allergens.

### Legal-threshold audit — passes
`+4 °C`, `-18 °C`, `≥63 °C`, `≤25 %`, `0–3 °C`, `J+5` all hard-coded per règlement (non-configurable — correct). Witness-meal `kept_until` auto-computed `+5d 23:59 UTC` (`witness-meals.js:39–43`). Every HACCP write calls `writeAudit()` with before/after — DDPP-grade evidence.

### Open gaps
- **No written retention policy** (6 mo témoins, 12 mo temperatures). Code tracks dates but doesn't prevent <6 mo deletion. Inspector will ask for the document. Add `HACCP_RETENTION_POLICY.md` + delete-guard in `witness-meals.js` DELETE handler.
- **Cooling/reheating elapsed-time validation** logged as comments at `haccp.js:753, 842` — not enforced at INSERT. Low risk but visible in audit.
- **Witness meal `quantity_per_sample`** is a free-text field with default `'100g minimum'` — no regex/numeric guard that 100 g floor is met (`witness-meals.js:203, 283`).

### Verdict for a DDPP control tomorrow
**Will pass.** Will be challenged on retention-policy *documentation* and cooling-time *enforcement*; both fixable in 1 dev-day.

---

## 3. UX / Design — 7.5/10

Subscores: IA 6.5 · A11y 6 · Mobile 6.5 · Editorial 8.5. Design tokens (`EVAL_UX_FINAL.md` from 2026-04-19 sprint) now at 9.2/10 — zero token drift between landing and app.

### Top 3 frictions to fix before shipping
1. **Modal a11y partial.** Per memory, `utils.js` MutationObserver auto-enhances `.modal-overlay` with `role=dialog` + `aria-modal` + focus trap (commit `10ac23b`). Subagent flagged remaining gaps in individual views — need to verify the observer catches modals built by `haccp-*.js` / `recipe-form.js` / `api-keys.js`. If not, add `data-skip-enhance="false"` or explicit ARIA at construction.
2. **Onboarding wizard not adaptive on mobile** (`onboarding.js`, 7 steps). Full-width modal on phone with no bottom-sheet layout. Add `@media (max-width: 639px)` rules for `.onboarding-card` → slide-up drawer + sticky progress bar.
3. **Recipe-form ingredient editor** (`recipe-form.js:~145`): three inputs on one row, no inline validation for qty<0 / waste>100 %, no toast on add. Split into stacked groups on mobile + `aria-invalid` + `aria-live="polite"` on autocomplete.

### Verdict
Customer-ready for a pilot cohort; not investor-demo-ready until onboarding mobile flow is polished.

---

## 4. CTO / Architecture — 6.4/10

Founder engineering judgment is **sound**. `server/app.js` (421 L) is not a god-file; middleware/lib split is clean; audit-log hash chain, Sentry-ready logger, apiError helper, CSRF, plan-gate all present; PG migration plan + `db-adapter.js` seam exists (not yet integrated).

### Debt inventory (~132 j-ingé total)
| Priority | Area | File | j-ingé |
|---|---|---|---:|
| 1 | CRUD pattern consolidation | `routes/haccp.js` (1 318 L) + 14 siblings | 20–25 |
| 2 | Redis rate limiter | `ai-core.js:90–134`, `public-api.js:63`, `app.js:98–124` | 5–10 |
| 3 | Frontend code-split / tree-shake | `client/js/api.js` (713 L), `app.js` (695 L), `scripts/build.js` | 8–12 |
| 4 | Unified error-handler adoption | ~80 bare try/catch sites across routes | 8–10 |
| 5 | PG migration Phase B–E | `db-adapter.js` + all call sites | 35–40 |
| 6 | Test coverage (analytics, ai, multi-site) | `tests/` | 8–12 |
| 7 | AI service extraction + circuit breaker | `ai-core.js` | 12–15 |
| 8 | Linting + formatter | repo | 5–8 |
| 9 | Bundle splitting + lazy-load views | frontend | 8–12 |
| 10 | Analytics pagination + KPI cache | `analytics.js` | 6–10 |
| 11 | OWASP/data-localization hardening | repo | 10–15 |

### Recommendation
**CONDITIONAL GO for acqui-hire** with 6–8 week integration sprint and commitment to debt paydown in the first 3 months. Founder must not start net-new feature work until priorities 1 + 2 ship.

---

## 5. Business / GTM — 6.2/10

Product breadth is real (8/10). GTM execution is the weak link (4/10).

### Three frictions that will kill conversion
1. **Voice-input is the hero claim but gated behind Professional (€59).** Trial user sees hero → signs up → can't dictate → faces €29→€59 jump. Move voice input to Essential to make €29 the LTV inflection.
2. **60-day trial → read-only cliff.** `plan-gate.js:38–48` hard-locks writes on trial expiry. No freemium floor. Give Discovery a permanent one-zone free tier → convert 15–25 % instead of 2–5 %.
3. **Opaque tier mapping.** "Tout Essential + …" copy across pricing page; no module-by-module matrix. Landing shows €29–39 range in comparison table but €39 (Pro) in pricing block and `plans.js` declares €59 (Professional). **Pricing messaging is self-contradictory** — publish a single source of truth.

### TAM reality check
Stated 120 000 TPE → addressable subset (independents with compliance obsession, 2–4 kitchen staff, €0.5–3 M revenue) is closer to **60 000**. Realistic 7-year ARR: €5–15 M pure-play. Moat = voice-to-recipe + HACCP depth, but 12–18 month lead at best — competitors (Melba, Koust, Easilys) will close the gap.

### Fundability
**Not Series-A-ready.** Pre-A or bridge viable **if** founder can show 100+ paying customers, <€200 CAC, >8 % trial-to-paid conversion, and simplified pricing — ~6–9 months of disciplined GTM data.

---

## Action items (ordered by blocking-ness)

1. **[P0 BLOCKER]** Scope all 3 queries in `predictions.js:56–88` to `restaurant_id` + key `_predCache` by tenant. Grep-sweep `FROM orders`, `FROM order_items`, `FROM recipes` across all routes. Add a regression test in `server/tests/tenancy.test.js`.
2. **[P1]** Ship `rate-limit-redis` before any 2-instance deploy.
3. **[P1]** Add `HACCP_RETENTION_POLICY.md` + 6-month delete-guard in `witness-meals.js`.
4. **[P2]** Mobile bottom-sheet onboarding drawer; recipe-form inline validation; modal a11y sweep.
5. **[P2]** Simplify pricing to 3 tiers; move voice-input into Essential; publish feature matrix.
6. **[P2]** Extract BaseRoute CRUD pattern from `haccp.js`; adopt `apiError` everywhere.

---

## Evidence ledger

- **Tests:** `cd server && npm test` → 19 suites, **358/358 pass**, 4.5 s.
- **Audit:** `npm audit --production` → **0 vulnerabilities**.
- **Design tokens:** per `EVAL_UX_FINAL.md` sprint (commit `a56078d`), zero drift between landing.css, style.css, blog.css.
- **Spot-verifications:**
  - ✅ `predictions.js:56–88` — P0 CONFIRMED by direct read (no restaurant_id filter, global cache).
  - ✅ `app.js:30–35` — JWT fail-closed guard present.
  - ✅ `app.js:90` — CSP3 split correct.
  - ✅ `witness-meals.js:39–43` — J+5 auto-compute present.
- **Subagent caveat:** explorer subagents hallucinate file:line 1–4 % of the time (per `feedback_subagent_spot_verify.md`). Only the P0 was spot-verified by the orchestrator; other file:line claims in this report inherit subagent-level confidence and should be re-verified before being cited externally.

---

**One-line verdict:** Close the `predictions.js` P0 this week; everything else is a polish sprint away from an honest CONDITIONAL GO.
