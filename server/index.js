require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
require('./db'); // initializes tables synchronously

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Stripe webhook needs raw body — mount BEFORE json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// Landing page on root — BEFORE static middleware
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'landing.html'));
});

// Static files from client directory (but skip index.html for root)
app.use(express.static(path.join(__dirname, '..', 'client'), { index: false }));

// API routes
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/stripe', require('./routes/stripe'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RestoSuite AI',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
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
  console.log(`🍽️  RestoSuite AI running on http://0.0.0.0:${PORT}`);
  console.log(`   Landing page: http://localhost:${PORT}/`);
  console.log(`   App:          http://localhost:${PORT}/app`);
});
