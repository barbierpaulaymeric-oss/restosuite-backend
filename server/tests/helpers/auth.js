'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'restosuite-dev-secret-2026';

/**
 * Generate a valid JWT for use in tests.
 * Defaults to a gérant (admin) user with restaurant_id=1.
 */
function makeToken(overrides = {}) {
  const payload = {
    id: 1,
    email: 'test@restosuite.fr',
    role: 'gerant',
    restaurant_id: 1,
    ...overrides,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Return an Authorization header object with a valid bearer token.
 */
function authHeader(overrides = {}) {
  return { Authorization: `Bearer ${makeToken(overrides)}` };
}

module.exports = { makeToken, authHeader };
