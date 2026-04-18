// ═══════════════════════════════════════════
// Error tracker
// Captures unhandled errors in a grep-friendly JSON format.
// If SENTRY_DSN is set AND @sentry/node is installed, forwards to Sentry.
// Otherwise it's a no-op over the structured logger (still grep-able).
// ═══════════════════════════════════════════

const logger = require('./logger');

let sentry = null;

function init() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  try {
    // Lazy require — @sentry/node is optional
    // eslint-disable-next-line global-require
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    });
    logger.info('sentry.initialized', { dsn_host: tryParseHost(dsn) });
    return true;
  } catch (e) {
    logger.warn('sentry.init_skipped', { reason: e.message });
    sentry = null;
    return false;
  }
}

function tryParseHost(dsn) {
  try { return new URL(dsn).host; } catch { return null; }
}

// Capture an error with contextual fields. Safe to call even when Sentry is absent.
function capture(err, context) {
  const ctx = context || {};
  const payload = {
    name: err && err.name,
    message: (err && err.message) || String(err),
    stack: err && err.stack ? String(err.stack).slice(0, 4000) : undefined,
    ...ctx,
  };
  logger.error('error.captured', payload);
  if (sentry) {
    try {
      sentry.withScope((scope) => {
        if (ctx.request_id) scope.setTag('request_id', ctx.request_id);
        if (ctx.route) scope.setTag('route', ctx.route);
        if (ctx.user_id) scope.setUser({ id: String(ctx.user_id) });
        if (ctx.restaurant_id) scope.setTag('restaurant_id', String(ctx.restaurant_id));
        sentry.captureException(err);
      });
    } catch (e) {
      logger.warn('sentry.capture_failed', { reason: e.message });
    }
  }
}

// Install process-level handlers so uncaught errors don't crash silently.
function installProcessHandlers() {
  process.on('uncaughtException', (err) => {
    capture(err, { kind: 'uncaughtException' });
  });
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    capture(err, { kind: 'unhandledRejection' });
  });
}

module.exports = { init, capture, installProcessHandlers };
