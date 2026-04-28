'use strict';

// Regression test for the 2026-04-28 cookie-auth cascade: server/index.js's
// soft JWT decoder only read Bearer headers, so cookie-only browser sessions
// 401'd "Token requis" on every gated route (/orders, /analytics, /recipes,
// …). The d97f7bf client-side fixes worked around the symptom; this server
// fix attacks the root cause. Pin softAuth's contract so app.js and index.js
// can never drift apart again.

const jwt = require('jsonwebtoken');
const { softAuth } = require('../lib/soft-auth');

const SECRET = 'test-secret-must-be-at-least-32-characters-long-for-tests';

beforeAll(() => { process.env.JWT_SECRET = SECRET; });

function runMiddleware(req) {
  return new Promise((resolve) => {
    softAuth(req, {}, () => resolve());
  });
}

const VALID_PAYLOAD = { id: 1, role: 'gerant', restaurant_id: 1 };

test('populates req.user from Authorization: Bearer header', async () => {
  const token = jwt.sign(VALID_PAYLOAD, SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  await runMiddleware(req);
  expect(req.user).toMatchObject(VALID_PAYLOAD);
});

test('populates req.user from `jwt` cookie when no Authorization header', async () => {
  const token = jwt.sign(VALID_PAYLOAD, SECRET);
  const req = { headers: { cookie: `jwt=${token}` } };
  await runMiddleware(req);
  expect(req.user).toMatchObject(VALID_PAYLOAD);
});

test('Authorization header takes precedence over cookie', async () => {
  const headerTok = jwt.sign({ ...VALID_PAYLOAD, id: 42 }, SECRET);
  const cookieTok = jwt.sign({ ...VALID_PAYLOAD, id: 99 }, SECRET);
  const req = { headers: { authorization: `Bearer ${headerTok}`, cookie: `jwt=${cookieTok}` } };
  await runMiddleware(req);
  expect(req.user.id).toBe(42);
});

test('leaves req.user unset on missing token', async () => {
  const req = { headers: {} };
  await runMiddleware(req);
  expect(req.user).toBeUndefined();
});

test('leaves req.user unset on malformed token (silent fail)', async () => {
  const req = { headers: { cookie: 'jwt=garbage.notatoken' } };
  await runMiddleware(req);
  expect(req.user).toBeUndefined();
});

test('parses cookie when other cookies are present alongside jwt', async () => {
  const token = jwt.sign(VALID_PAYLOAD, SECRET);
  const req = { headers: { cookie: `_ga=foo; jwt=${token}; sessionid=bar` } };
  await runMiddleware(req);
  expect(req.user).toMatchObject(VALID_PAYLOAD);
});
