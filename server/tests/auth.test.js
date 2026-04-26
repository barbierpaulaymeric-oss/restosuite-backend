'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

describe('POST /api/auth/register', () => {
  it('registers a new account and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'owner@test.fr', password: 'Secure1pass' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('account');
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.fr', password: 'Secure1pass' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.fr', password: 'Secure1pass' });
    expect(res.status).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@test.fr', password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('rejects password without uppercase', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'noup@test.fr', password: 'lowercase1' });
    expect(res.status).toBe(400);
  });

  it('rejects password without digit', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nodig@test.fr', password: 'NoDigitPass' });
    expect(res.status).toBe(400);
  });

  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Secure1pass' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/register-supplier', () => {
  const validBody = () => ({
    company_name: 'Boucherie Martin',
    contact_name: 'Jean Martin',
    email: `sup-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`,
    password: 'Secure1pass',
    phone: '0612345678',
  });

  it('creates a supplier and returns success', async () => {
    const res = await request(app).post('/api/auth/register-supplier').send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/fournisseur/i);
  });

  it('persists supplier with restaurant_id NULL (unaffiliated)', async () => {
    const body = validBody();
    await request(app).post('/api/auth/register-supplier').send(body);
    const { get } = require('../db');
    const row = get('SELECT * FROM suppliers WHERE email = ?', [body.email.toLowerCase()]);
    expect(row).toBeTruthy();
    expect(row.restaurant_id).toBeNull();
    expect(row.password_hash).toBeTruthy();
    expect(row.password_hash).not.toBe(body.password);
    expect(row.contact_name).toBe(body.contact_name);
  });

  it('rejects duplicate email', async () => {
    const body = validBody();
    await request(app).post('/api/auth/register-supplier').send(body);
    const res = await request(app).post('/api/auth/register-supplier').send(body);
    expect(res.status).toBe(409);
  });

  it('rejects missing company_name', async () => {
    const res = await request(app).post('/api/auth/register-supplier').send({ ...validBody(), company_name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects missing contact_name', async () => {
    const res = await request(app).post('/api/auth/register-supplier').send({ ...validBody(), contact_name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects weak password (no uppercase)', async () => {
    const res = await request(app).post('/api/auth/register-supplier').send({ ...validBody(), password: 'lowercase1' });
    expect(res.status).toBe(400);
  });

  it('rejects weak password (no digit)', async () => {
    const res = await request(app).post('/api/auth/register-supplier').send({ ...validBody(), password: 'NoDigitPass' });
    expect(res.status).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await request(app).post('/api/auth/register-supplier').send({ ...validBody(), password: 'Ab1' });
    expect(res.status).toBe(400);
  });

  it('rejects malformed email', async () => {
    const res = await request(app).post('/api/auth/register-supplier').send({ ...validBody(), email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('accepts missing phone (optional)', async () => {
    const body = validBody();
    delete body.phone;
    const res = await request(app).post('/api/auth/register-supplier').send(body);
    expect(res.status).toBe(201);
  });
});

describe('POST /api/auth/login', () => {
  const email = 'login@test.fr';
  const password = 'Secure1pass';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email, password });
  });

  it('returns token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.token).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.fr', password: 'Secure1pass' });
    expect(res.status).toBe(401);
  });

  it('rejects missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email });
    expect(res.status).toBe(400);
  });
});

describe('requireAuth middleware', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/ingredients');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/token/i);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/ingredients')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('returns 401 with malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/ingredients')
      .set('Authorization', 'NotBearer token123');
    expect(res.status).toBe(401);
  });

  it('allows access with valid token', async () => {
    const res = await request(app)
      .get('/api/ingredients')
      .set(authHeader());
    expect(res.status).toBe(200);
  });
});

describe('JWT cookie + CSRF', () => {
  it('POST /register sets HttpOnly jwt cookie and returns csrf_token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookie-reg@test.fr', password: 'Secure1pass' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('csrf_token');
    expect(typeof res.body.csrf_token).toBe('string');
    expect(res.body.csrf_token.length).toBeGreaterThan(16);
    const setCookie = res.headers['set-cookie'] || [];
    const jwtCookie = setCookie.find(c => /^jwt=/.test(c));
    expect(jwtCookie).toBeTruthy();
    expect(jwtCookie).toMatch(/HttpOnly/);
    expect(jwtCookie).toMatch(/SameSite=Strict/);
  });

  it('POST /login sets HttpOnly jwt cookie and returns csrf_token', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookie-login@test.fr', password: 'Secure1pass' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cookie-login@test.fr', password: 'Secure1pass' });
    expect(res.status).toBe(200);
    expect(res.body.csrf_token).toBeTruthy();
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some(c => /^jwt=/.test(c) && /HttpOnly/.test(c))).toBe(true);
  });

  it('cookie auth alone is accepted on GET (no CSRF needed for safe methods)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookie-get@test.fr', password: 'Secure1pass' });
    const jwtCookie = reg.headers['set-cookie'].find(c => /^jwt=/.test(c)).split(';')[0];
    const res = await request(app)
      .get('/api/ingredients')
      .set('Cookie', jwtCookie);
    expect(res.status).toBe(200);
  });

  it('cookie auth without X-CSRF-Token is rejected with 403 on POST', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookie-nocsrf@test.fr', password: 'Secure1pass' });
    const jwtCookie = reg.headers['set-cookie'].find(c => /^jwt=/.test(c)).split(';')[0];
    const res = await request(app)
      .post('/api/ingredients')
      .set('Cookie', jwtCookie)
      .send({ name: 'foo', unit: 'kg' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/csrf/i);
  });

  it('cookie auth with matching X-CSRF-Token is accepted on POST', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookie-withcsrf@test.fr', password: 'Secure1pass' });
    const jwtCookie = reg.headers['set-cookie'].find(c => /^jwt=/.test(c)).split(';')[0];
    const csrf = reg.body.csrf_token;
    const res = await request(app)
      .post('/api/ingredients')
      .set('Cookie', jwtCookie)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'foo', unit: 'kg' });
    // Route may reject for schema reasons, but MUST NOT be 403 for CSRF
    expect(res.status).not.toBe(403);
  });

  it('cookie auth with wrong X-CSRF-Token is rejected with 403', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookie-badcsrf@test.fr', password: 'Secure1pass' });
    const jwtCookie = reg.headers['set-cookie'].find(c => /^jwt=/.test(c)).split(';')[0];
    const res = await request(app)
      .post('/api/ingredients')
      .set('Cookie', jwtCookie)
      .set('X-CSRF-Token', 'forged-token-12345')
      .send({ name: 'foo', unit: 'kg' });
    expect(res.status).toBe(403);
  });

  it('Bearer-auth bypasses CSRF (backward compat for API/tests)', async () => {
    const res = await request(app)
      .post('/api/ingredients')
      .set(authHeader())
      .send({ name: 'bar', unit: 'kg' });
    expect(res.status).not.toBe(403);
  });

  it('POST /logout clears jwt cookie (Max-Age=0)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'cookie-logout@test.fr', password: 'Secure1pass' });
    const jwtCookie = reg.headers['set-cookie'].find(c => /^jwt=/.test(c)).split(';')[0];
    const csrf = reg.body.csrf_token;
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', jwtCookie)
      .set('X-CSRF-Token', csrf)
      .send({});
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] || [];
    const cleared = setCookie.find(c => /^jwt=/.test(c));
    expect(cleared).toBeTruthy();
    expect(cleared).toMatch(/Max-Age=0/);
  });
});
