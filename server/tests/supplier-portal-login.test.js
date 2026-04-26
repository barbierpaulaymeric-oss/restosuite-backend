'use strict';

// Regression: supplier portal login must surface a clean 401 + JSON error to
// the browser. The client-side api.js was treating every 401 not in its login
// allowlist as a session expiry — it wiped localStorage, jumped to #/login,
// reloaded, and threw "Session expirée. Reconnectez-vous." When the supplier
// endpoints were missing from that allowlist, demo-fournisseur@restosuite.fr
// could never see a real auth error: first attempt redirected to the homepage,
// second attempt showed the misleading expiry message. These tests pin both
// the server contract and the client allowlist so it can't regress silently.

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');

describe('POST /api/supplier-portal/quick-login', () => {
  it('returns 401 with a JSON error for wrong credentials', async () => {
    const res = await request(app)
      .post('/api/supplier-portal/quick-login')
      .send({ email: 'no-such-supplier@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app)
      .post('/api/supplier-portal/quick-login')
      .send({ email: 'someone@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/supplier-portal/member-pin', () => {
  it('returns 404 for an account that does not belong to the supplier', async () => {
    const res = await request(app)
      .post('/api/supplier-portal/member-pin')
      .send({ supplier_id: 999999, account_id: 999999, pin: '1234' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('client/js/api.js — supplier portal login allowlist', () => {
  // The client wraps fetch in API.request; on 401 it either throws the server's
  // error (login attempt) or wipes the session and reloads (anything else).
  // Supplier portal logins must be in the allowlist. Asserting on the source
  // string is the cheapest way to lock this without a browser test runner.
  const apiSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'js', 'api.js'),
    'utf8'
  );
  const bundleSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'js', 'app.bundle.js'),
    'utf8'
  );

  const SUPPLIER_LOGIN_PATHS = [
    '/supplier-portal/quick-login',
    '/supplier-portal/company-login',
    '/supplier-portal/member-pin',
  ];

  it.each(SUPPLIER_LOGIN_PATHS)(
    'api.js LOGIN_PATHS includes %s so 401s show the real error',
    (route) => {
      // Locate the LOGIN_PATHS array literal and assert the supplier route is in it.
      const match = apiSrc.match(/const LOGIN_PATHS = \[([\s\S]*?)\];/);
      expect(match).not.toBeNull();
      expect(match[1]).toContain(`'${route}'`);
    }
  );

  it.each(SUPPLIER_LOGIN_PATHS)(
    'app.bundle.js mirrors LOGIN_PATHS entry %s',
    (route) => {
      // Bundle uses double quotes after esbuild; check both for resilience.
      expect(
        bundleSrc.includes(`"${route}"`) || bundleSrc.includes(`'${route}'`)
      ).toBe(true);
    }
  );
});
