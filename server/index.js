require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('./db'); // initializes tables synchronously
const { requireWriteAccess } = require('./middleware/trial');
const { backupDatabase } = require('./backup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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

// ─── DB Backup ───
backupDatabase(); // on startup
setInterval(backupDatabase, 6 * 60 * 60 * 1000); // every 6 hours

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

// Trial write-protection middleware for write operations
// Excludes: accounts (create/login), stripe, and GET requests
const trialProtectedPaths = ['/api/ingredients', '/api/suppliers', '/api/prices', '/api/recipes', '/api/ai', '/api/haccp', '/api/stock', '/api/orders', '/api/deliveries', '/api/purchase-orders'];
app.use(trialProtectedPaths, (req, res, next) => {
  if (req.method === 'GET') return next();
  // Allow HACCP PDF exports (GET only anyway) and pdf-export routes
  return requireWriteAccess(req, res, next);
});
// Also protect account updates/deletes (but not create/login)
app.use('/api/accounts/:id', (req, res, next) => {
  if (req.method === 'GET') return next();
  // Skip the status endpoint
  if (req.path.endsWith('/status')) return next();
  return requireWriteAccess(req, res, next);
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/haccp', require('./routes/haccp'));
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

// Admin endpoints
app.post('/api/admin/backup', (req, res) => {
  backupDatabase();
  res.json({ ok: true, message: 'Backup effectué' });
});

app.get('/api/admin/export-db', (req, res) => {
  const dbPath = path.join(__dirname, 'data', 'restosuite.db');
  if (!require('fs').existsSync(dbPath)) {
    return res.status(404).json({ error: 'No database found' });
  }
  res.download(dbPath, 'restosuite-backup.db');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RestoSuite',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
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
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
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
