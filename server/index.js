require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('./db'); // initializes tables synchronously
const { requireAuth } = require('./routes/auth');
const { requireActiveOrTrial } = require('./middleware/plan-gate');
const { backupDatabase } = require('./backup');
const { appendError, LOG_PATH, MAX_LINES } = require('./routes/errors');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate JWT_SECRET on startup — fail-closed in any non-test env.
// Tests set JWT_SECRET in tests/helpers/env.js; any other env must set it explicitly.
const IS_TEST = process.env.NODE_ENV === 'test';
if (!IS_TEST) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('❌ FATAL: JWT_SECRET must be set to a strong secret (32+ chars).');
    console.error('   Set JWT_SECRET in your environment variables and restart.');
    process.exit(1);
  }
}

// Trust the first reverse proxy (Render / nginx). Without this, rate limiters
// and req.ip see the proxy IP, globally throttling honest users while leaving
// brute-forcers unthrottled per-client.
app.set('trust proxy', 1);

// Compression: skip application/pdf — Render nginx + global gzip can corrupt
// streamed PDFs (blob() mishandles the doubly-encoded body). See
// feedback_pdf_compression.md.
app.use(compression({
  filter: (req, res) => {
    const ct = res.getHeader('Content-Type');
    if (typeof ct === 'string' && ct.includes('application/pdf')) return false;
    return compression.filter(req, res);
  },
}));

// CORS: explicit allowlist in production + localhost whitelist in dev. Never echo
// arbitrary origins while credentials:true — would leak auth to any hostile site.
const DEV_CORS_ALLOWLIST = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];
const PROD_CORS_ALLOWLIST = ['https://www.restosuite.fr', 'https://restosuite.fr'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (process.env.NODE_ENV === 'production') {
      return cb(null, PROD_CORS_ALLOWLIST.includes(origin));
    }
    return cb(null, DEV_CORS_ALLOWLIST.some(rx => rx.test(origin)));
  },
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
  // throughout innerHTML templates. Refactoring those ~5k attributes to classes is
  // tracked separately; this gives us defense in depth today without breaking the UI.
  // CSP3 script-src split (mirrors the style-src split): `script-src-elem`
  // restricts <script> sources, while `script-src-attr 'unsafe-inline'`
  // permits the 150+ legacy inline `onclick="…"` handlers in client/js/views.
  // Refactor to addEventListener is tracked; this unbreaks the UI under strict CSP.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://js.stripe.com; script-src-elem 'self' https://cdnjs.cloudflare.com https://js.stripe.com; script-src-attr 'unsafe-inline'; style-src 'self' https://fonts.googleapis.com; style-src-elem 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://api.stripe.com https://generativelanguage.googleapis.com; frame-src https://js.stripe.com;");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ─── Rate Limiting ───
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Trop de requêtes, réessayez dans quelques minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { error: 'Limite IA atteinte. Réessayez dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/ai/', aiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});
app.use('/api/accounts/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/pin-login', authLimiter);

// Staff auth — 4-digit PINs are brute-forceable, keep limit tight
const staffAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});
app.use('/api/auth/staff-login', staffAuthLimiter);
app.use('/api/auth/staff-pin', staffAuthLimiter);

// Supplier portal auth — same tight limit as main auth
const supplierAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});
app.use('/api/supplier-portal/company-login', supplierAuthLimiter);
app.use('/api/supplier-portal/member-pin', supplierAuthLimiter);
app.use('/api/supplier-portal/quick-login', supplierAuthLimiter);

// ─── DB Backup ───
backupDatabase(); // on startup
setInterval(backupDatabase, 6 * 60 * 60 * 1000); // every 6 hours

// ─── Error log rotation (max 1000 lines) ───
try {
  if (fs.existsSync(LOG_PATH)) {
    const lines = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(l => l.trim());
    if (lines.length > MAX_LINES) {
      fs.writeFileSync(LOG_PATH, lines.slice(-MAX_LINES).join('\n') + '\n', 'utf8');
      console.log(`🗂️  errors.log tronqué à ${MAX_LINES} lignes`);
    }
  }
} catch (e) {
  console.error('Rotation errors.log:', e.message);
}

// ─── Cleanup old upload files on startup ───
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

// Stripe webhook needs raw body — mount BEFORE json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// SEO: sitemap and robots.txt — BEFORE static middleware
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'sitemap.xml'));
});
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'robots.txt'));
});

// Public menu page — BEFORE static middleware
app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'menu.html'));
});

// Landing page on root — BEFORE static middleware
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'landing.html'));
});

// PWA: serve sw.js and manifest.json from root
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'sw.js'));
});
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'manifest.json'));
});

// Static files from client directory (but skip index.html for root)
app.use(express.static(path.join(__dirname, '..', 'client'), { index: false }));

// Soft JWT decode — Bearer header OR `jwt` HttpOnly cookie → req.user.
// Required so requireActiveOrTrial below sees req.user from cookie-only
// browser sessions; otherwise every gated route 401s "Token requis"
// (the actual root cause behind the d97f7bf "Commandes/Pilotage 401" cascade).
app.use(require('./lib/soft-auth').softAuth);

// ─── Access Gating ───────────────────────────────────────────────────────────
// Single paid plan model: active trial = full access; expired trial = GET/HEAD only;
// pro subscription = full access. No tiered feature gating.
{
  const GATED_PREFIXES = [
    '/api/ingredients', '/api/recipes', '/api/stock', '/api/prices', '/api/variance',
    '/api/allergens',
    '/api/haccp', '/api/suppliers', '/api/orders', '/api/deliveries', '/api/purchase-orders',
    '/api/invoices',
    '/api/qrcode', '/api/menu', '/api/alerts', '/api/service', '/api/crm',
    '/api/haccp-plan', '/api/analytics', '/api/ai', '/api/predictions', '/api/carbon',
    '/api/integrations', '/api/training', '/api/pest-control', '/api/maintenance',
    '/api/waste', '/api/corrective-actions', '/api/pms-audit', '/api/pms',
    '/api/sanitary', '/api/water',
    '/api/traceability', '/api/recall', '/api/allergen-plan', '/api/fabrication-diagrams',
    '/api/tiac', '/api/sites',
  ];
  for (const prefix of GATED_PREFIXES) app.use(prefix, requireActiveOrTrial);
}
// ─────────────────────────────────────────────────────────────────────────────

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
app.use('/api/haccp', require('./routes/haccp'));
app.use('/api/haccp-plan', require('./routes/haccp-plan'));
app.use('/api/recall', require('./routes/recall'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/supplier-portal', require('./routes/supplier-portal'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/purchase-orders', require('./routes/purchase-orders'));
app.use('/api/invoices', require('./routes/invoices'));
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
app.use('/api/pms', require('./routes/pms-export')); // pms-audit must appear first (prefix match)
app.use('/api/sanitary/staff-health', require('./routes/staff-health'));
app.use('/api/sanitary', require('./routes/sanitary-settings'));
app.use('/api/tiac', require('./routes/tiac'));
app.use('/api/fabrication-diagrams', require('./routes/fabrication-diagrams'));
app.use('/api/errors', require('./routes/errors').router);
app.use('/api/admin', require('./routes/admin'));

// Admin endpoints — JWT required (gérant only)
app.post('/api/admin/backup', requireAuth, (req, res) => {
  if (req.user.role !== 'gerant') return res.status(403).json({ error: 'Réservé au gérant' });
  backupDatabase();
  res.json({ ok: true, message: 'Backup effectué' });
});

// /api/admin/export-db REMOVED — previously streamed the entire multi-tenant SQLite
// file to any authenticated gérant (PENTEST_REPORT C1.1). Per-tenant data exports
// should go through domain-specific endpoints that scope by req.user.restaurant_id.
app.get('/api/admin/export-db', requireAuth, (req, res) => {
  res.status(410).json({
    error: 'Endpoint supprimé pour des raisons de sécurité (fuite multi-tenant). ' +
      'Utilisez les exports par domaine : /api/haccp/export, /api/traceability/export, etc.'
  });
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

// Catch-all: serve SPA for any non-API, non-static route
// (only for routes that look like SPA navigation, not files)
app.get('*', (req, res) => {
  // If it looks like a file request (has extension), 404
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  // Otherwise serve landing page
  res.sendFile(path.join(__dirname, '..', 'client', 'landing.html'));
});

app.use((err, req, res, next) => {
  const entry = {
    ts: new Date().toISOString(),
    origin: 'server',
    type: 'unhandled',
    route: `${req.method} ${req.path}`,
    message: err.message || String(err),
    stack: err.stack ? err.stack.slice(0, 2000) : undefined,
  };
  console.error('Unhandled error:', entry.route, err.message);
  try { appendError(entry); } catch {}
  res.status(500).json({ error: 'Internal server error' });
});

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
