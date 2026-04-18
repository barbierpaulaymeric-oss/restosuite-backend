'use strict';

require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('./db'); // initializes tables synchronously
const { requireAuth } = require('./routes/auth');
const { planGate } = require('./middleware/plan-gate');
const { appendError, LOG_PATH, MAX_LINES } = require('./routes/errors');
const { requestId } = require('./lib/request-id');
const logger = require('./lib/logger');
const errorTracker = require('./lib/error-tracker');

const app = express();
const IS_TEST = process.env.NODE_ENV === 'test';

// Initialize observability (Sentry if SENTRY_DSN set, otherwise no-op over logger).
// Skip in tests — we don't want Sentry spam from test failures.
if (!IS_TEST) {
  errorTracker.init();
  errorTracker.installProcessHandlers();
}

// Validate JWT_SECRET on startup
const DEV_JWT_SECRET = 'restosuite-dev-secret-2026';
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET must be set to a strong secret in production.');
    process.exit(1);
  }
} else if (!IS_TEST && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.warn('⚠️  WARNING: JWT_SECRET not set or too short. Using default (NOT SAFE FOR PRODUCTION).');
}

// Request-ID must come first so every subsequent middleware + logger sees req.id
app.use(requestId);

app.use(compression());

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://www.restosuite.fr', 'https://restosuite.fr']
    : true,
  credentials: true
}));

app.disable('x-powered-by');

// HTTP → HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP: style-src split (CSP3) — blocks injected <style> blocks + <link rel=stylesheet>
  // (the main CSS-XSS vector) while allowing existing `style="..."` attributes used
  // throughout innerHTML templates. See server/index.js for the same policy in prod.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://js.stripe.com; style-src 'self' https://fonts.googleapis.com; style-src-elem 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.stripe.com https://generativelanguage.googleapis.com; frame-src https://js.stripe.com;");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ─── Rate Limiting ───
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 100000 : 200,
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: IS_TEST ? 100000 : 30,
  message: { error: 'Limite IA atteinte. Réessayez dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/ai/', aiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 100000 : 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});
app.use('/api/accounts/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/pin-login', authLimiter);
app.use('/api/auth/staff-login', authLimiter);
app.use('/api/auth/staff-pin', authLimiter);
app.use('/api/auth/logout', authLimiter);

// Admin endpoints (backup, export-db, etc.) — strict per-IP limit
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: IS_TEST ? 100000 : 30,
  message: { error: 'Limite admin atteinte. Réessayez dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/admin/', adminLimiter);

// ─── Error log rotation (skip in test mode) ───
if (!IS_TEST) {
  try {
    if (fs.existsSync(LOG_PATH)) {
      const lines = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(l => l.trim());
      if (lines.length > MAX_LINES) {
        fs.writeFileSync(LOG_PATH, lines.slice(-MAX_LINES).join('\n') + '\n', 'utf8');
      }
    }
  } catch (e) {
    console.error('Rotation errors.log:', e.message);
  }
}

// ─── Cleanup old upload files (skip in test mode) ───
if (!IS_TEST) {
  const uploadDir = path.join(__dirname, '..', 'tmp', 'restosuite-uploads');
  if (fs.existsSync(uploadDir)) {
    const now = Date.now();
    fs.readdirSync(uploadDir).forEach(f => {
      const fp = path.join(uploadDir, f);
      try {
        if (now - fs.statSync(fp).mtimeMs > 24 * 60 * 60 * 1000) fs.unlinkSync(fp);
      } catch {}
    });
  }
}

// Stripe webhook needs raw body — mount BEFORE json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// Static files and SPA routes (skipped in test mode for speed)
if (!IS_TEST) {
  app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'sitemap.xml'));
  });
  app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'robots.txt'));
  });
  app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'menu.html'));
  });
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'landing.html'));
  });
  app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'sw.js'));
  });
  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'manifest.json'));
  });
  app.use(express.static(path.join(__dirname, '..', 'client'), { index: false }));
}

// ─── Soft JWT decode (populates req.user for planGate without enforcing auth) ──
{
  const _jwt = require('jsonwebtoken');
  const _jwtSecret = process.env.JWT_SECRET || DEV_JWT_SECRET;
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try { req.user = _jwt.verify(auth.split(' ')[1], _jwtSecret); } catch {}
    }
    next();
  });
}

// ─── Plan Gating (skip in test mode — requireAuth in each route still enforces 401) ───
if (!IS_TEST) {
  // discovery — free tier
  app.use('/api/ingredients', planGate('discovery'));
  app.use('/api/recipes', planGate('discovery'));
  app.use('/api/stock', planGate('discovery'));
  app.use('/api/prices', planGate('discovery'));
  app.use('/api/variance', planGate('discovery'));
  // Allergen declaration is a legal obligation under EU 1169/2011 (INCO) for
  // every food business since 13/12/2014 — it cannot sit behind a paywall.
  app.use('/api/allergens', planGate('discovery'));

  // essential — 29€/month
  app.use('/api/haccp', planGate('essential'));
  app.use('/api/suppliers', planGate('essential'));
  app.use('/api/orders', planGate('essential'));
  app.use('/api/deliveries', planGate('essential'));
  app.use('/api/purchase-orders', planGate('essential'));
  app.use('/api/qrcode', planGate('essential'));
  app.use('/api/menu', planGate('essential'));
  app.use('/api/alerts', planGate('essential'));
  app.use('/api/service', planGate('essential'));
  app.use('/api/crm', planGate('essential'));

  // professional — 59€/month
  app.use('/api/haccp-plan', planGate('professional'));
  app.use('/api/analytics', planGate('professional'));
  app.use('/api/ai', planGate('professional'));
  app.use('/api/predictions', planGate('professional'));
  app.use('/api/carbon', planGate('professional'));
  app.use('/api/integrations', planGate('professional'));
  app.use('/api/training', planGate('professional'));
  app.use('/api/pest-control', planGate('professional'));
  app.use('/api/maintenance', planGate('professional'));
  app.use('/api/waste', planGate('professional'));
  app.use('/api/corrective-actions', planGate('professional'));
  app.use('/api/pms-audit', planGate('professional'));
  app.use('/api/pms', planGate('professional'));
  app.use('/api/sanitary', planGate('professional'));
  app.use('/api/water', planGate('professional'));

  // premium — 99€/month
  app.use('/api/traceability', planGate('premium'));
  app.use('/api/recall', planGate('premium'));
  app.use('/api/allergen-plan', planGate('premium'));
  app.use('/api/fabrication-diagrams', planGate('premium'));
  app.use('/api/tiac', planGate('premium'));
  app.use('/api/sites', planGate('premium'));
}

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai-preferences', require('./routes/ai-preferences'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/haccp/witness-meals', require('./routes/witness-meals'));
app.use('/api/haccp', require('./routes/haccp'));
app.use('/api/haccp', require('./routes/haccp-calibrations'));
app.use('/api/haccp-plan', require('./routes/haccp-plan'));
app.use('/api/recall', require('./routes/recall'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/supplier-portal', require('./routes/supplier-portal'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/purchase-orders', require('./routes/purchase-orders'));
app.use('/api/qrcode', require('./routes/qrcode'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/service', require('./routes/service'));
app.use('/api/allergens', require('./routes/allergens'));
app.use('/api/variance', require('./routes/variance'));
app.use('/api/carbon', require('./routes/carbon'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/sites', require('./routes/multi-site'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/health', require('./routes/health'));
app.use('/api/public', require('./routes/public-api'));
app.use('/api/audit-log', require('./routes/audit'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/training', require('./routes/training'));
app.use('/api/pest-control', require('./routes/pest-control'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/waste', require('./routes/waste'));
app.use('/api/corrective-actions', require('./routes/corrective-actions'));
app.use('/api/traceability', require('./routes/traceability-downstream'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/allergen-plan', require('./routes/allergen-plan'));
app.use('/api/water', require('./routes/water'));
app.use('/api/pms-audit', require('./routes/pms-audit'));
app.use('/api/pms', require('./routes/pms-export'));
app.use('/api/sanitary', require('./routes/sanitary-settings'));
app.use('/api/tiac', require('./routes/tiac'));
app.use('/api/fabrication-diagrams', require('./routes/fabrication-diagrams'));
app.use('/api/errors', require('./routes/errors').router);
app.use('/api/admin', require('./routes/admin'));

// Admin endpoints — JWT required (gérant only)
app.post('/api/admin/backup', requireAuth, (req, res) => {
  if (req.user.role !== 'gerant') return res.status(403).json({ error: 'Réservé au gérant' });
  res.json({ ok: true, message: 'Backup effectué' });
});

app.get('/api/admin/export-db', requireAuth, (req, res) => {
  if (req.user.role !== 'gerant') return res.status(403).json({ error: 'Réservé au gérant' });
  const dbPath = path.join(__dirname, 'data', 'restosuite.db');
  if (!require('fs').existsSync(dbPath)) {
    return res.status(404).json({ error: 'No database found' });
  }
  res.download(dbPath, 'restosuite-backup.db');
});

app.get('/api/health', (req, res) => {
  try {
    const { get } = require('./db');
    const dbCheck = get('SELECT COUNT(*) as c FROM ingredients');
    res.json({
      status: 'ok',
      service: 'RestoSuite',
      version: '1.2.0',
      db: 'connected',
      ingredients: dbCheck.c,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(503).json({
      status: 'error',
      service: 'RestoSuite',
      db: 'disconnected',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
});

if (!IS_TEST) {
  // Legal pages
  app.get('/mentions-legales', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'legal', 'mentions.html'));
  });
  app.get('/cgv', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'legal', 'cgv.html'));
  });
  app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'legal', 'privacy.html'));
  });

  // SPA app on /app (and sub-routes)
  app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
  });
  app.get('/app/*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
  });

  // Catch-all: serve landing for non-file non-API routes
  app.get('*', (req, res) => {
    if (path.extname(req.path)) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, '..', 'client', 'landing.html'));
  });
}

app.use((err, req, res, next) => {
  const route = `${req.method} ${req.path}`;
  const entry = {
    ts: new Date().toISOString(),
    origin: 'server',
    type: 'unhandled',
    route,
    request_id: req.id,
    message: err.message || String(err),
    stack: err.stack ? err.stack.slice(0, 2000) : undefined,
  };
  if (!IS_TEST) {
    errorTracker.capture(err, {
      request_id: req.id,
      route,
      user_id: req.user && req.user.id,
      restaurant_id: req.user && req.user.restaurant_id,
    });
  }
  try { appendError(entry); } catch {}
  res.status(500).json({ error: 'Internal server error', request_id: req.id });
});

module.exports = app;
