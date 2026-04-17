'use strict';

/**
 * Express middleware: guarantees req.user.restaurant_id is set.
 * Use after requireAuth on routes that must be tenant-scoped.
 *
 * Additive: routes are still encouraged to WHERE-filter by
 * req.user.restaurant_id explicitly so that every query is greppable.
 */
function requireTenant(req, res, next) {
  if (!req.user || !req.user.restaurant_id) {
    return res.status(400).json({ error: 'restaurant_id manquant dans le contexte' });
  }
  next();
}

/**
 * Helper for route handlers: returns the caller's tenant id or throws.
 * Throwing here is deliberate — missing tenant at query time is a bug,
 * not a user error, and should surface as 500 rather than 200-with-leak.
 */
function tenantId(req) {
  if (!req || !req.user || !req.user.restaurant_id) {
    throw new Error('tenantId: req.user.restaurant_id absent');
  }
  return req.user.restaurant_id;
}

module.exports = { requireTenant, tenantId };
