# Design: Server-Side Plan Gating

**Date:** 2026-04-17  
**Status:** Approved

## Problem

Plan restrictions (Free/Essential/Pro/Premium/Enterprise) are enforced only on the client side via UI badges. All API routes are accessible to any authenticated user regardless of their plan. A user on the Discovery plan can call `/api/ai` or `/api/sites` directly.

## Decision

Extend the existing `planGate(minPlan)` middleware to absorb trial awareness, then apply it to all relevant route prefixes in `server/index.js`.

## Trial Behaviour (confirmed by user)

- **Active trial (< 60 days):** full access to all features, plan check bypassed
- **Trial expired:** read-only (GET only), regardless of plan subscription
- `TRIAL_DAYS = 60` — confirmed, do not reduce

## Middleware Design

`planGate(minPlan)` in `server/middleware/plan-gate.js`:

```
1. No req.user → 401
2. Lookup restaurant plan from DB (restaurant.plan || 'discovery')
3. Call getAccountStatusById(req.user.account_id):
   - status === 'trial'   → next() (bypass plan check)
   - status === 'expired' → block non-GET with 403 TRIAL_EXPIRED
   - status === 'pro'     → fall through to plan rank check
4. planRank(current) >= planRank(minPlan) → next()
5. Otherwise → 403 PLAN_REQUIRED { required, current }
```

`requireWriteAccess` block in `index.js` is removed — plan-gate subsumes it.

## Route-to-Plan Mapping

| Plan | Route prefixes |
|---|---|
| `discovery` | `/api/ingredients`, `/api/recipes`, `/api/stock`, `/api/onboarding`, `/api/prices`, `/api/variance` |
| `essential` | `/api/haccp`, `/api/suppliers`, `/api/orders`, `/api/deliveries`, `/api/purchase-orders`, `/api/allergens`, `/api/qrcode`, `/api/menu`, `/api/alerts`, `/api/service`, `/api/crm` |
| `professional` | `/api/haccp-plan`, `/api/analytics`, `/api/ai`, `/api/predictions`, `/api/carbon`, `/api/integrations`, `/api/training`, `/api/pest-control`, `/api/maintenance`, `/api/waste`, `/api/corrective-actions`, `/api/pms-audit`, `/api/pms`, `/api/sanitary` |
| `premium` | `/api/traceability`, `/api/recall`, `/api/allergen-plan`, `/api/fabrication-diagrams`, `/api/tiac`, `/api/pdf-export`, `/api/sites` |
| `enterprise` | `/api/public` |

Routes not gated (public or already separately protected): `/api/auth`, `/api/accounts`, `/api/plans`, `/api/stripe`, `/api/supplier-portal`, `/api/health`, `/api/admin`, `/api/errors`.

## Error Responses

```json
// Plan insufficient
{ "error": "Cette fonctionnalité nécessite le plan essential ou supérieur", "code": "PLAN_REQUIRED", "required": "essential", "current": "discovery" }

// Trial expired, write attempt
{ "error": "Votre essai gratuit est terminé. Passez en Pro pour continuer.", "code": "TRIAL_EXPIRED" }
```

## Files Changed

- `server/middleware/plan-gate.js` — extend `planGate` with trial awareness
- `server/index.js` — apply `planGate(tier)` to all route prefixes, remove old `requireWriteAccess` block
