# RestoSuite — Feature Completeness Audit

**Date:** 2026-04-11  
**Audited by:** Claude Code (parallel agents)  
**Supersedes:** Previous audit from 2026-04-06

---

## Summary Table — Module Completeness

| Module | Endpoints | UI Views | Auth | CRUD Complete | Secrets Clean | Score |
|--------|-----------|----------|------|---------------|---------------|-------|
| Authentication | 7 | 1 (login.js) | PASS | PASS | WARN | 90% |
| Onboarding | 9 | 1 (onboarding.js) | PASS | PASS | PASS | 95% |
| Recipes | 8 | 2 (detail, form) | PASS | PASS | PASS | 95% |
| Ingredients | 7 | 1 (ingredients.js) | PASS | PASS | PASS | 95% |
| Stock | 9 | 3 (dashboard, reception, movements) | PASS | PASS | PASS | 95% |
| HACCP | ~20 | 4 (dashboard, temps, cleaning, trace) | PASS | PASS | PASS | 95% |
| Suppliers | 5 | 1 (suppliers.js) | PASS | PASS | PASS | 95% |
| Orders (Purchase) | 9 | 1 (orders.js) | PASS | PASS | PASS | 95% |
| Deliveries | 4 | 1 (deliveries.js) | PASS | PASS | PASS | 90% |
| Service Mode | 7 | 1 (service.js) | PASS | PASS | PASS | 95% |
| Kitchen Display | 0 (uses orders API) | 1 (kitchen.js) | PASS | N/A | PASS | 90% |
| Analytics | 9 | 1 (analytics.js) | PASS | N/A (read-only) | PASS | 90% |
| Health Dashboard | 0 (aggregates) | 1 (health-dashboard.js) | PASS | N/A | PASS | 85% |
| Menu Engineering | 1 | 1 (menu-engineering.js) | PASS | N/A (read-only) | PASS | 85% |
| Predictions | 1 | 1 (predictions.js) | PASS | N/A (read-only) | PASS | 85% |
| AI Features | 6+ | 3 (chef, scan-invoice, import-mercuriale) | PASS | N/A | WARN | 90% |
| CRM & Loyalty | 9 | 1 (crm.js) | PASS | PASS | PASS | 90% |
| Supplier Portal | 19 | 4 (manage, login, catalog, delivery) | PASS | PASS | PASS | 90% |
| Integrations | 8 | 1 (integrations.js) | PASS | PASS | PASS | 85% |
| Multi-Site | 5 | 1 (multi-site.js) | PASS | Partial | PASS | 75% |
| Public API | 9 | 1 (api-keys.js) | PASS | PASS | PASS | 90% |
| QR Code Menu | 3 | 2 (qrcodes.js, menu.html) | PASS | N/A | PASS | 90% |
| Stripe/Billing | 3 | 1 (subscribe.js) | PASS | N/A | PASS | 85% |
| Accounts/Team | 10 | 1 (team.js) | PASS | PASS | PASS | 90% |
| Variance Analysis | 4 | 1 (stock-variance.js) | PASS | N/A (read-only) | PASS | 90% |
| Carbon Footprint | 2 | 1 (carbon.js) | PASS | N/A (read-only) | PASS | 85% |
| Mercuriale/Prices | 1 | 1 (mercuriale.js) | PASS | N/A | PASS | 85% |
| Alerts | 2 | 0 (consumed by dashboard) | PASS | N/A | PASS | 90% |
| Error Logging | 2 | 1 (errors-log.js) | PASS | N/A | PASS | 90% |
| Command Palette | 0 | 1 (command-palette.js) | N/A | N/A | PASS | 95% |

**Overall Completeness: ~90%**

---

## Auth Guard Status (Post-Hardening)

All 29 route files audited and secured on 2026-04-11.

| Status | Count | Details |
|--------|-------|---------|
| Router-level `requireAuth` | 22 | accounts, ai, analytics, alerts, carbon, crm, deliveries, haccp, ingredients, integrations, multi-site, onboarding, orders, predictions, prices, purchase-orders, qrcode, recipes, stock, suppliers, variance |
| Per-route `requireAuth` | 2 | auth (login/register public), service |
| Per-route mixed auth | 3 | supplier-portal (requireAuth + requireSupplierAuth), public-api (requireAuth + apiKeyAuth), stripe (webhook public) |
| Per-route with public carveouts | 2 | menu (public menu + ordering), stripe (webhook) |

**Intentionally public endpoints:**
- Auth: login, register, PIN flows
- QR Menu: public menu display + customer ordering
- Stripe: webhook (signature-verified)
- Allergens: INCO reference data for public menu
- Public API: docs page, `/v1/*` endpoints (API-key auth)
- Supplier portal: login flows (company-login, member-pin, quick-login)
- Health check: `/api/health`

---

## Hardcoded Secrets & Config

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| `auth.js:12` | JWT_SECRET fallback: `'restosuite-dev-secret-2026'` | MEDIUM | Dev-only fallback, uses `process.env` first |
| `supplier-portal.js:13` | Same JWT_SECRET fallback | MEDIUM | Consistent with auth.js |
| `orders.js:69` | Had mismatched fallback `'restosuite-secret-key'` | HIGH | **FIXED** — now matches auth.js |
| `ai.js`, `analytics.js`, `predictions.js` | GEMINI_API_KEY | OK | Properly env-sourced |
| `stripe.js` | STRIPE_SECRET_KEY | OK | Properly env-sourced |

**No hardcoded production secrets found.** All external API keys use `process.env`.

---

## Missing CRUD Operations by Module

### Multi-Site — 75%
- MISSING: `DELETE /sites/:id` (no way to remove a site)
- MISSING: Staff assignment/transfer between sites

### Deliveries — 90%
- MISSING: `POST /` (manual delivery note creation — only via PO receiving or supplier portal)
- MISSING: `DELETE /:id` (no way to delete a delivery)

### Predictions — 85%
- MISSING: Historical prediction accuracy tracking
- MISSING: Configuration for prediction parameters

### Health Dashboard — 85%
- MISSING: Dedicated API endpoint (aggregates client-side from other APIs)
- MISSING: Historical health score trend

### Carbon Footprint — 85%
- MISSING: Carbon goals/targets
- MISSING: Carbon per ingredient CRUD (uses hardcoded ADEME estimates)

### Menu Engineering — 85%
- MISSING: Action recommendations per BCG classification
- MISSING: Historical menu engineering comparisons

### Integrations — 85%
- MISSING: Actual API implementations (TheFork sync is stubbed)
- MISSING: Webhook receivers for external platforms

---

## Error Handling Gaps

| Module | Issue |
|--------|-------|
| Most routes | No request validation middleware (e.g., express-validator) |
| Stock reception | Missing validation for negative quantities |
| CRM | Missing email format validation on customer creation |
| Accounts | Missing password complexity requirements |
| Public API | Rate limiting defined in schema but not enforced per-key |

---

## Client-Side Architecture

- **Type:** SPA with hash-based routing, 40 registered routes
- **Build:** esbuild → `app.bundle.js` (634KB)
- **Language:** French UI throughout
- **RBAC:** Router enforces role-based access (gerant, cuisinier, equipier, salle)
- **Standalone pages:** landing.html (SEO), menu.html (QR ordering), demo-presentation.html (pitch deck)
- **API client note:** Newer features use `API.request('/path')` instead of named methods in `api.js`

---

## Prioritized Fix List

### Critical (Security) — ALL COMPLETED
1. ~~Add auth to 23 unprotected route files~~ — DONE
2. ~~Remove spoofable caller_id auth in accounts.js~~ — DONE
3. ~~Remove x-account-id header fallback~~ — DONE
4. ~~Fix mismatched JWT secret in orders.js~~ — DONE

### High (Production Readiness)
5. Enforce `JWT_SECRET` env var — add startup check, fail if not set in production
6. Add input validation middleware (express-validator) to mutation endpoints
7. Enforce rate limiting per API key (schema exists, enforcement missing)
8. Implement actual TheFork/POS API integrations (currently stubbed)

### Medium (Feature Gaps)
9. Add `DELETE /sites/:id` to multi-site module
10. Add manual delivery note creation endpoint
11. Add carbon footprint targets/goals
12. Add historical health score tracking
13. Formalize newer API methods in `api.js` client

### Low (Polish)
14. Add password complexity validation on registration
15. Add email format validation on CRM customer creation
16. Remove "Bientot" badge from supplier portal in More page (feature is implemented)
17. Add prediction accuracy tracking
