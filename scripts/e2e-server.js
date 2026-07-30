#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════
// Serveur pour les smoke tests Playwright — base JETABLE, clés externes vides.
// Lancé par playwright.config.js (webServer). Jamais utilisé en production.
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');

const dbPath = process.env.E2E_DB_PATH || path.join(os.tmpdir(), 'restosuite-e2e.db');
for (const suffix of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(dbPath + suffix); } catch {}
}

process.env.DB_PATH = dbPath;
process.env.PORT = process.env.PORT || '3105';
// 32+ caractères requis par la validation fail-closed d'app.js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret-jamais-en-prod-0123456789abcdef';
// Clés externes neutralisées — dotenv (server/.env) n'écrase jamais une
// variable déjà définie, donc aucune requête Gemini/Stripe réelle en E2E.
process.env.GEMINI_API_KEY = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.STRIPE_PRICE_ID = '';
process.env.DB_ENCRYPTION_KEY = '';
// 'development' : les routes statiques/SPA sont montées (elles sont coupées en
// NODE_ENV=test) sans déclencher keep-alive ni redirection canonique prod.
process.env.NODE_ENV = 'development';

require('../server/index.js');
