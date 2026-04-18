// ═══════════════════════════════════════════
// Request-ID middleware
// Assigns a UUID to every request and echoes it in X-Request-ID.
// If the client already provided X-Request-ID, we trust and reuse it
// so trace IDs span the edge → app boundary.
// ═══════════════════════════════════════════

const crypto = require('crypto');

function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  // Accept client-supplied IDs if they look safe (alphanumeric + dash/underscore, ≤128 chars)
  const id = (typeof incoming === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(incoming))
    ? incoming
    : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = { requestId };
