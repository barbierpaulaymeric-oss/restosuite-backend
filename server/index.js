// ═══════════════════════════════════════════════════════════════════════════
// Production bootstrap.
//
// The Express app itself — every middleware, route, rate limiter, CSRF guard,
// observability hook and error handler — is defined ONCE in ./app and shared
// with the test suite (which imports ./app directly via supertest). This file
// adds only what belongs to the *running server* and not to the app definition:
// the DB backup schedule, app.listen(), background pollers, the keep-alive ping,
// and graceful shutdown.
//
// Historically index.js (prod) and app.js (tests) each configured the app
// separately and drifted — CSRF, process crash-handlers and whole routes ended
// up tested but never mounted in prod (see audit-complet-2026-06-09.md C1/C2/M1).
// Requiring ./app here makes that class of bug structurally impossible.
// ═══════════════════════════════════════════════════════════════════════════
require('dotenv').config();

// ./app performs, on require (gated by NODE_ENV !== 'test'):
//   • DB init, JWT_SECRET fail-closed validation
//   • errorTracker.init() + installProcessHandlers() (uncaught/unhandledRejection)
//   • error-log rotation + stale upload cleanup
//   • the full middleware pipeline, all API routes, static/SPA serving, CSRF
const app = require('./app');
const { backupDatabase } = require('./backup');

const PORT = process.env.PORT || 3000;

// ─── DB backup (server lifecycle, not part of the app definition) ───
backupDatabase(); // on startup
setInterval(backupDatabase, 6 * 60 * 60 * 1000); // every 6 hours

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍽️  RestoSuite running on http://0.0.0.0:${PORT}`);
  console.log(`   Landing page: http://localhost:${PORT}/`);
  console.log(`   App:          http://localhost:${PORT}/app`);

  // Keep-alive: ping self every 14 minutes to prevent Render free tier sleep
  if (process.env.RENDER || process.env.NODE_ENV === 'production') {
    const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || 'https://restosuite-backend.onrender.com';
    setInterval(() => {
      fetch(`${KEEP_ALIVE_URL}/api/health`)
        .then(r => r.json())
        .then(d => console.log(`🏓 Keep-alive: ${d.status}`))
        .catch(e => console.error('Keep-alive failed:', e.message));
    }, 14 * 60 * 1000);
    console.log('🏓 Keep-alive enabled (14min interval)');
  }

  // Mercuriale email poller (IMAP). Self-disables when MERCURIALE_EMAIL/PASSWORD
  // are unset, so dev machines without OVH creds boot silently.
  // One-time diagnostic so Render logs let us verify env vars without exposing
  // the password (catches "!" mangled by bash history expansion, missing var,
  // wrong host). Run server/scripts/test-imap.js for a full DNS+TLS+auth probe.
  {
    const host = process.env.MERCURIALE_IMAP_HOST || 'ssl0.ovh.net';
    const port = Number(process.env.MERCURIALE_IMAP_PORT) || 993;
    const email = process.env.MERCURIALE_EMAIL || '(unset)';
    const pass = process.env.MERCURIALE_PASSWORD || '';
    const passInfo = pass
      ? `set (len=${pass.length}, head="${pass.slice(0, 3)}", tail="${pass.slice(-3)}")`
      : 'UNSET';
    console.log(`📧 Mercuriale IMAP config: host=${host} port=${port} user=${email} password=${passInfo}`);
  }
  try {
    require('./lib/mercuriale-mail/poller').startPoller();
  } catch (e) {
    console.warn('📧 Mercuriale poller failed to start:', e.message);
  }

  // Relances anti-churn (J+1/J+3/J+7) pour les comptes non activés. Env-gated
  // (SMTP requis), s'auto-désactive sans creds OVH. Cf. lib/retention-mailer.js.
  try {
    require('./lib/retention-mailer').startRetentionMailer();
  } catch (e) {
    console.warn('📧 Relances rétention: démarrage échoué —', e.message);
  }

  // Anonymisation RGPD des comptes inactifs >3 ans (dry-run tant que
  // RETENTION_PURGE_ENABLED !== 'true'). Cf. lib/retention-purge.js.
  try {
    require('./lib/retention-purge').startRetentionPurge();
  } catch (e) {
    console.warn('🧹 Purge rétention: démarrage échoué —', e.message);
  }
});

function gracefulShutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 10s if pending requests don't finish
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
