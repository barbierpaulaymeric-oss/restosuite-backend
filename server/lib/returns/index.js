'use strict';

// Public surface for the returns/claims module.
//
// resolveReturnsEmail picks where the supplier-facing return notice should go.
// Order of preference (most specific wins):
//   1. supplier_integrations.returns_email (per-provider connection — e.g.
//      retours@foodflow.fr for the FoodFlow integration)
//   2. supplier.returns_email (per-supplier override)
//   3. supplier.email (generic supplier mailbox)
// Returns { email, source } so the route handler can audit which mailbox was
// chosen, or null when no usable address is configured.

const { buildEmail } = require('./build-email');

function pickEmail(value, source) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return { email: trimmed, source };
}

function resolveReturnsEmail({ supplier, integration }) {
  if (integration && integration.returns_email) {
    const hit = pickEmail(integration.returns_email, 'integration');
    if (hit) return hit;
  }
  if (supplier && supplier.returns_email) {
    const hit = pickEmail(supplier.returns_email, 'supplier_returns_email');
    if (hit) return hit;
  }
  if (supplier && supplier.email) {
    const hit = pickEmail(supplier.email, 'supplier_email');
    if (hit) return hit;
  }
  return null;
}

module.exports = {
  resolveReturnsEmail,
  buildEmail,
};
