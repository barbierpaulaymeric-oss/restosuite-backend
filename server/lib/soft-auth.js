'use strict';

// ═══════════════════════════════════════════
// Soft JWT decode middleware — populates req.user from EITHER an
// Authorization: Bearer header OR the HttpOnly `jwt` cookie. Fails silently;
// requireAuth inside each route module is the authoritative auth check.
//
// Used by app.js (test entry) and index.js (prod entry) so both paths agree
// on which transports surface req.user. Without the cookie path, every
// browser request to a route guarded by requireActiveOrTrial 401'd with
// "Token requis" because the gate runs BEFORE the route's own requireAuth
// (which is where cookie parsing previously lived) — caused the recurring
// "session drops on /orders, /analytics" cascade fixed client-side in
// d97f7bf and at the server root in this module.
// ═══════════════════════════════════════════

const jwt = require('jsonwebtoken');
const { parseCookies } = require('./cookie');

function softAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return next();

  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.split(' ')[1];
  } else {
    const cookies = parseCookies(req.headers.cookie || '');
    if (cookies.jwt) token = cookies.jwt;
  }
  if (token) {
    try { req.user = jwt.verify(token, secret); } catch {}
  }
  next();
}

module.exports = { softAuth };
