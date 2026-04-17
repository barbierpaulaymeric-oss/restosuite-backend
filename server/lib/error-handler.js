// ═══════════════════════════════════════════
// Shared error handler — server/lib/error-handler.js
// ═══════════════════════════════════════════
//
// Purpose: consistent logging + response shape for route errors. Replaces the
// pattern of silent `catch (e) { res.status(500).json(...) }` that swallowed
// errors across stripe / ai / public-api / haccp routes (flagged in
// EVAL_POST_SPRINT0, Tier A blocker #4).
//
// Usage in a route handler:
//   router.get('/thing', requireAuth, (req, res) => {
//     try {
//       // …business logic…
//     } catch (e) {
//       return apiError(res, e, { route: 'GET /thing', status: 500 });
//     }
//   });
//
// Usage as Express error middleware (last `app.use()`):
//   app.use(errorMiddleware);

'use strict';

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Log + respond with a server error.
 *
 * @param {import('express').Response} res
 * @param {Error|unknown} err
 * @param {object} [opts]
 * @param {string} [opts.route]    route label used in the log line
 * @param {number} [opts.status]   HTTP status (defaults to 500)
 * @param {string} [opts.message]  message returned to the client
 *                                 (defaults to a generic string — never `err.message`
 *                                 in production to avoid leaking internals)
 * @param {object} [opts.extra]    extra JSON fields to include in the response
 */
function apiError(res, err, opts = {}) {
  const { route = 'unknown', status = 500, message, extra } = opts;
  // Always log — this is the whole point of the shared handler.
  console.error(`[${route}]`, err && err.stack ? err.stack : err);
  const body = {
    error: message || 'Erreur interne du serveur',
    ...(extra || {}),
  };
  // Surface cause in dev/test only, never in production.
  if (!IS_PROD && err && err.message) body.detail = err.message;
  return res.status(status).json(body);
}

/**
 * Express error-handling middleware. Catches errors raised by `next(err)` or
 * thrown inside async handlers (when wrapped with `asyncHandler`).
 */
function errorMiddleware(err, req, res, next) {
  // If the response is already on its way, defer to Express default handler
  // so the connection is closed cleanly.
  if (res.headersSent) return next(err);
  return apiError(res, err, {
    route: `${req.method} ${req.originalUrl}`,
    status: err && err.status ? err.status : 500,
  });
}

/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * Express error middleware instead of crashing the process.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { apiError, errorMiddleware, asyncHandler };
