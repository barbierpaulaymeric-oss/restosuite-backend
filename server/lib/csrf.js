// ═══════════════════════════════════════════
// CSRF protection for cookie-authenticated requests.
//
// Browser clients authenticate via an HttpOnly `jwt` cookie. Because the browser
// auto-sends the cookie cross-site, we need a token the attacker cannot forge.
// The JWT payload carries a per-session `csrf` secret; the server matches the
// X-CSRF-Token header against that claim on every mutating request.
//
// Bearer-token requests (API, tests) are not browser-initiated and therefore
// not susceptible to CSRF — they bypass this check.
// ═══════════════════════════════════════════
'use strict';

const jwt = require('jsonwebtoken');
const { parseCookies } = require('./cookie');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Paths that must work without a prior CSRF token:
//   - /auth login/register flows create the first session
//   - /stripe/webhook is signed by Stripe, not a browser
//   - /public/* is for third-party API consumers (Bearer or API key)
//   - /supplier-portal uses its own X-Supplier-Token auth
function isExemptPath(p) {
  if (p.startsWith('/api/auth/login')) return true;
  if (p.startsWith('/api/auth/register')) return true;
  if (p.startsWith('/api/auth/pin-login')) return true;
  if (p.startsWith('/api/auth/staff-login')) return true;
  if (p.startsWith('/api/auth/staff-pin')) return true; // covers /staff-pin and /staff-pin/create
  if (p.startsWith('/api/stripe/webhook')) return true;
  if (p.startsWith('/api/public/')) return true;
  if (p.startsWith('/api/supplier-portal/')) return true;
  if (p.startsWith('/api/accounts/login')) return true;
  return false;
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isExemptPath(req.path)) return next();

  // Bearer header = API/test client → CSRF not applicable.
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return next();

  // No cookie → either unauthenticated (route will 401) or a non-browser client
  // that authenticates some other way. Nothing to protect against here.
  const cookies = parseCookies(req.headers.cookie || '');
  if (!cookies.jwt) return next();

  const secret = process.env.JWT_SECRET;
  if (!secret) return next(); // app.js fails closed at boot; test env handles separately.

  let decoded;
  try {
    decoded = jwt.verify(cookies.jwt, secret);
  } catch {
    // Bad/expired cookie — let requireAuth handle the 401 uniformly.
    return next();
  }

  const header = req.headers['x-csrf-token'];
  if (!header || typeof header !== 'string' || !decoded.csrf || header !== decoded.csrf) {
    return res.status(403).json({ error: 'Jeton CSRF manquant ou invalide' });
  }
  next();
}

module.exports = { csrfProtection };
