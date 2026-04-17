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
