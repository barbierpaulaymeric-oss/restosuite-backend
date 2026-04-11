# RestoSuite — Combined Security & Feature Audit

**Date:** 2026-04-11  
**Scope:** Full codebase audit — API auth + client-side features

---

## Executive Summary

RestoSuite has **40+ fully implemented features** across a rich SPA frontend and Express/Node.js backend. The feature set is impressive and largely complete. However, **the majority of API endpoints lack authentication**, creating critical security vulnerabilities.

| Metric | Value |
|--------|-------|
| Total API endpoints | ~150+ |
| Route files with proper auth | 5 of 29 |
| Route files with zero/near-zero auth | 24 of 29 |
| Critical security risks | 10 |
| Client-side views | 42 |
| Registered SPA routes | 40 |
| Standalone HTML pages | 3 |

---

## Part 1: API Authentication Audit

### Auth Middleware Details

- **Middleware:** `requireAuth` in `server/routes/auth.js`
- **Mechanism:** JWT Bearer token verification, attaches `req.user` (id, email, role, restaurant_id)
- **Applied globally?** NO — must be added per-route or per-router
- **Additional auth:** `requireSupplierAuth` (token-based) and `apiKeyAuth` (X-API-Key header)

### Properly Protected Route Files (5/29)

| File | Method | Notes |
|------|--------|-------|
| `ai.js` | `router.use(requireAuth)` | All endpoints protected |
| `onboarding.js` | `router.use(requireAuth)` | All endpoints protected |
| `service.js` | Per-route `requireAuth` | All endpoints protected |
| `errors.js` | Per-route `requireAuth` | All endpoints protected |
| `auth.js` | Mixed | `/me` and `/staff-password` protected; login/register public (correct) |

### Top 10 Critical Security Risks

**1. API Key Management Exposed** — `public-api.js`  
`GET/POST/DELETE /api/public/keys` — Anyone can list all API keys in cleartext, create keys with arbitrary permissions, or revoke legitimate keys. No auth.

**2. Full Account CRUD Without Auth** — `accounts.js`  
All endpoints use `caller_id` from request body as "authorization" — trivially spoofable. Attackers can list all accounts, create admin accounts, modify permissions, reset PINs, delete accounts, and RGPD-export ALL data.

**3. Integration Secrets Exposed** — `integrations.js`  
`PUT /api/integrations/:provider` allows writing API keys/secrets for third-party services (TheFork, POS, delivery platforms) with no auth.

**4. Customer PII Fully Exposed** — `crm.js`  
Full CRUD on customer records (names, emails, phones, birthdays) with zero auth. GDPR violation.

**5. Supplier Portal Admin Unprotected** — `supplier-portal.js`  
Restaurant-side management (invite, list/delete accounts, add members, notifications) has no auth. Only supplier-side endpoints use `requireSupplierAuth`.

**6. All Financial/Business Data Exposed** — `analytics.js`, `variance.js`, `predictions.js`  
Revenue KPIs, food cost, margins, loss reports, AI insights — all publicly accessible.

**7. Full Stock Management Without Auth** — `stock.js`  
An attacker could zero out all stock via `/inventory`, record false losses, or create phantom receptions.

**8. Full HACCP/Compliance Data Without Auth** — `haccp.js`  
Temperature logs, cleaning records, and traceability data can be read/created/modified/deleted. Falsified HACCP records have legal consequences.

**9. Staff Password Fallback** — `accounts.js`  
`/staff-password` falls back to `x-account-id` header when JWT is invalid, allowing anyone with an account ID to set the staff password.

**10. Stripe Checkout Without Auth** — `stripe.js`  
`/create-checkout` accepts any `accountId` from body; `/status/:accountId` exposes subscription details by enumerable ID.

### Unprotected Route Files (24/29)

Every endpoint in these files is accessible without authentication:

| File | Endpoints | Severity |
|------|-----------|----------|
| `accounts.js` | 10 | CRITICAL — full account management |
| `ingredients.js` | 6 | CRITICAL — CRUD + pricing |
| `suppliers.js` | 5 | CRITICAL — CRUD + contacts |
| `recipes.js` | 8 | HIGH — full recipes with costs |
| `orders.js` | 8 | CRITICAL — order lifecycle + stock deduction |
| `stock.js` | 9 | CRITICAL — full stock control |
| `haccp.js` | ~20 | CRITICAL — compliance data |
| `purchase-orders.js` | 9 | CRITICAL — PO lifecycle |
| `deliveries.js` | 4 | HIGH — receiving workflow |
| `analytics.js` | 9 | HIGH — business intelligence |
| `crm.js` | 9 | CRITICAL — customer PII |
| `integrations.js` | 8 | CRITICAL — third-party secrets |
| `multi-site.js` | 5 | HIGH — multi-site management |
| `public-api.js` (key mgmt) | 3 | CRITICAL — API key CRUD |
| `prices.js` | 1 | HIGH — pricing data |
| `carbon.js` | 2 | LOW — carbon footprint |
| `predictions.js` | 1 | MEDIUM — demand forecasts |
| `variance.js` | 4 | MEDIUM — loss analysis |
| `alerts.js` | 2 | MEDIUM — operational alerts |
| `qrcode.js` | 2 | LOW — QR codes |
| `stripe.js` | 2 | HIGH — checkout + status |
| `supplier-portal.js` (restaurant-side) | 8 | CRITICAL — portal management |
| `menu.js` (`/pending-orders`) | 1 | MEDIUM — exposes orders |

### Intentionally Public Endpoints (No Fix Needed)

- `POST /api/auth/register`, `/login`, `/pin-login`, `/staff-login`, `/staff-pin`
- `GET /api/menu`, `POST /api/menu/order` (QR code customer menu)
- `GET /api/allergens`, `/api/allergens/menu` (INCO reference data)
- `POST /api/stripe/webhook` (Stripe signature-verified)
- `GET /api/health`
- `GET /api/qrcode/table/:num` (QR code image generation)
- `GET /api/public/docs` (API documentation)
- Supplier auth endpoints: `/company-login`, `/member-pin`, `/quick-login`

---

## Part 2: Client-Side Feature Catalog

### Architecture

- **Type:** Single-page app (SPA), hash-based routing (`#/path`)
- **Language:** French UI throughout
- **Build:** esbuild, outputs `app.bundle.js` (634KB)
- **Auth:** JWT + dual login (Manager email/password, Staff PIN)
- **RBAC:** Router enforces role-based access (gerant, cuisinier, equipier, salle)
- **Layout:** Bottom nav (mobile) / top nav (desktop) — 5 tabs: Fiches, Stock, HACCP, Fournisseurs, Plus

### Feature Map (42 Views)

#### Core Operations
| View | Route | Features |
|------|-------|----------|
| Dashboard | `#/` | Greeting, daily alerts, AI suggestions, recipe list with filters |
| Recipe Detail | `#/recipe/:id` | Cost breakdown, portion scaler, price simulator, allergen display, PDF export |
| Recipe Form | `#/new`, `#/edit/:id` | Voice input (Web Speech API), AI parsing, autocomplete, sub-recipes, draft auto-save |
| Ingredients | `#/ingredients` | CRUD, CSV import/export, INCO 14 allergen checkboxes |
| Service Mode | `#/service` | Floor plan, table management, order taking, 8s polling, QR order integration |
| Kitchen Display | `#/kitchen` | Ticket board, item status workflow, audio notifications, 10s auto-refresh |

#### Stock & Supply Chain
| View | Route | Features |
|------|-------|----------|
| Stock Dashboard | `#/stock` | Category cards, progress bars, min thresholds, inventory modal |
| Stock Reception | `#/stock/reception` | Multi-line form, autocomplete, batch/DLC/temperature fields |
| Stock Movements | `#/stock/movements` | Filterable log, date range, PDF export |
| Variance Analysis | `#/stock/variance` | Theoretical vs actual, 5%/15% thresholds |
| Suppliers | `#/suppliers` | CRUD, star ratings, portal link |
| Deliveries | `#/deliveries` | Per-item accept/reject, temperature check, provenance info |
| Purchase Orders | `#/orders` | Full lifecycle, AI suggestions, analytics, receiving flow |

#### HACCP Compliance
| View | Route | Features |
|------|-------|----------|
| HACCP Dashboard | `#/haccp` | Today's zones, cleaning checklist, DLC alerts |
| Temperatures | `#/haccp/temperatures` | Zone CRUD, recording modal, PDF export |
| Cleaning | `#/haccp/cleaning` | Task management, progress bar, PDF export |
| Traceability | `#/haccp/traceability` | Lot tracking, DLC alerts, PDF export |

#### Analytics & Intelligence
| View | Route | Features |
|------|-------|----------|
| Analytics | `#/analytics` | KPIs, food cost charts, stock value, price changes, AI insights |
| Health Dashboard | `#/health` | Composite score (0-100), issue breakdown |
| Menu Engineering | `#/menu-engineering` | BCG matrix (Stars/Puzzles/Plowhorses/Dogs) |
| Predictions | `#/predictions` | 7-day AI demand forecast |
| Mercuriale | `#/mercuriale` | Price alerts, SVG trend charts |
| Variance | `#/stock/variance` | Loss analysis with financial data |
| Carbon Footprint | `#/carbon` | ADEME-based CO2 ratings (A-E) |

#### AI Features
| View | Route | Features |
|------|-------|----------|
| AI Chef | `#/chef` | Conversational assistant with restaurant context |
| Invoice Scanner | `#/scan-invoice` | Camera/file upload, AI extraction, delivery creation |
| Price List Scanner | `#/import-mercuriale` | Drag-drop upload, AI matching, bulk import |
| Voice Input | (in recipe form) | Web Speech API, French, AI parsing |

#### Management & Config
| View | Route | Features |
|------|-------|----------|
| Team | `#/team` | Staff CRUD, permissions, PIN management |
| Onboarding | (overlay) | 7-step wizard after registration |
| Settings Hub | `#/more` | Module grid, theme toggle, RGPD export |
| Subscription | `#/subscribe` | Stripe checkout (39€/month) |
| Integrations | `#/integrations` | TheFork, POS, Deliveroo, Uber Eats |
| API Keys | `#/api-keys` | Key management, auto-generated docs |
| Multi-Site | `#/multi-site` | Site comparison, revenue dashboard |
| CRM & Loyalty | `#/crm` | Customer CRUD, loyalty points, rewards |
| QR Codes | `#/qrcodes` | Printable table QR codes |
| Error Log | `#/errors-log` | Last 50 errors with stack traces |
| Command Palette | (Cmd+K) | Global keyboard navigation |

#### Supplier Portal (Separate App Shell)
| View | Route | Features |
|------|-------|----------|
| Supplier Login | (via login screen) | Company login + member PIN |
| Supplier Catalog | (portal) | Product CRUD, pricing, availability |
| Supplier Deliveries | (portal) | Delivery note creation with provenance fields |
| Portal Management | `#/supplier-portal` | Invite, revoke, notifications |

#### Standalone Pages
| Page | File | Purpose |
|------|------|---------|
| Customer Menu | `menu.html` | QR code ordering (no auth) |
| Landing Page | `landing.html` | Marketing/SEO |
| Demo Deck | `demo-presentation.html` | 12-slide investor pitch |

### Feature Completeness

**Fully implemented:** All 40+ features listed above have complete UI with API integration.

**API client note:** Newer features (CRM, carbon, predictions, multi-site, integrations, menu engineering) use `API.request()` with raw paths rather than named methods in `api.js`, suggesting they were added after the initial API client was written. They work fine but aren't formalized in the API client.

---

## Recommended Fix Priority

### Priority 1: Add `router.use(requireAuth)` to Critical Routes
These files need auth immediately — they expose sensitive data or allow destructive mutations:

1. `accounts.js` — account takeover risk
2. `public-api.js` (key management endpoints) — API key exposure
3. `integrations.js` — third-party secret exposure
4. `crm.js` — GDPR customer PII
5. `supplier-portal.js` (restaurant-side endpoints)
6. `stock.js` — stock manipulation
7. `orders.js` — order manipulation + stock deduction
8. `haccp.js` — compliance record tampering

### Priority 2: Add Auth to Business Data Routes
9. `recipes.js`
10. `ingredients.js`
11. `suppliers.js`
12. `prices.js`
13. `purchase-orders.js`
14. `deliveries.js`

### Priority 3: Add Auth to Analytics/Reporting
15. `analytics.js`
16. `variance.js`
17. `predictions.js`
18. `alerts.js`
19. `carbon.js`
20. `multi-site.js`
21. `menu.js` (`/pending-orders` only)

### Priority 4: Fix Specific Vulnerabilities
- Remove `x-account-id` header fallback in `accounts.js` `/staff-password`
- Add auth to `stripe.js` `/create-checkout` and `/status/:accountId`
- Remove `caller_id` body-based auth pattern in `accounts.js`

### Recommended Approach
Add `router.use(requireAuth)` at the top of each router, then selectively exclude public endpoints with `router.get('/public-path', publicHandler)` declared BEFORE the middleware. This is the fastest path to securing the application.
