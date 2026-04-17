'use strict';

const request = require('supertest');
const app = require('../app');
const { get, all, run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();
const AUTH_OTHER = authHeader({ id: 99, restaurant_id: 2, email: 'other@test.fr' });

function yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function sixDaysAgoISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

async function createSample(overrides = {}) {
  const body = {
    meal_date: yesterdayISO(),
    meal_type: 'dejeuner',
    service_type: 'sur_place',
    samples: [{ name: 'Poulet rôti', quantity: '120g', location: 'Tiroir 1' }],
    storage_temperature: 2,
    storage_location: 'Chambre froide plats témoins',
    operator: 'Test Operator',
    ...overrides,
  };
  const res = await request(app)
    .post('/api/haccp/witness-meals')
    .set(AUTH)
    .send(body);
  return res;
}

describe('Witness meals — CRUD', () => {
  it('POST / creates with auto-computed kept_until = meal_date + 5 days', async () => {
    const mealDate = yesterdayISO();
    const res = await createSample({ meal_date: mealDate });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.meal_date).toBe(mealDate);
    expect(res.body.kept_until).toBeTruthy();
    // kept_until must be > meal_date by approximately 5 days
    const kept = new Date(res.body.kept_until.replace(' ', 'T') + 'Z');
    const meal = new Date(mealDate + 'T00:00:00Z');
    const diffDays = (kept - meal) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(5);
    expect(diffDays).toBeLessThan(6);
  });

  it('POST / rejects invalid meal_type', async () => {
    const res = await createSample({ meal_type: 'brunch' });
    expect(res.status).toBe(400);
  });

  it('POST / rejects missing meal_date', async () => {
    const res = await request(app)
      .post('/api/haccp/witness-meals')
      .set(AUTH)
      .send({ meal_type: 'dejeuner' });
    expect(res.status).toBe(400);
  });

  it('GET / lists only the caller\'s tenant rows', async () => {
    await createSample();
    const res = await request(app).get('/api/haccp/witness-meals').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.every(r => r.restaurant_id === 1)).toBe(true);
  });

  it('tenant isolation — restaurant_id=2 cannot see restaurant_id=1 rows', async () => {
    const created = await createSample();
    const id = created.body.id;
    const resOther = await request(app)
      .get(`/api/haccp/witness-meals/${id}`)
      .set(AUTH_OTHER);
    expect(resOther.status).toBe(404);
  });

  it('PUT /:id updates disposal info', async () => {
    const created = await createSample();
    const id = created.body.id;
    const res = await request(app)
      .put(`/api/haccp/witness-meals/${id}`)
      .set(AUTH)
      .send({ disposed_date: '2026-04-23 10:00:00', disposed_by: 'Jean Dupont' });
    expect(res.status).toBe(200);
    expect(res.body.disposed_by).toBe('Jean Dupont');
    expect(res.body.disposed_date).toBe('2026-04-23 10:00:00');
  });

  it('DELETE /:id removes the row', async () => {
    const created = await createSample();
    const id = created.body.id;
    const del = await request(app)
      .delete(`/api/haccp/witness-meals/${id}`)
      .set(AUTH);
    expect(del.status).toBe(200);
    const again = await request(app).get(`/api/haccp/witness-meals/${id}`).set(AUTH);
    expect(again.status).toBe(404);
  });
});

describe('Witness meals — buckets', () => {
  it('GET /active returns only undisposed rows still within retention', async () => {
    await createSample({ meal_date: yesterdayISO() });
    const res = await request(app).get('/api/haccp/witness-meals/active').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.items.every(r => r.disposed_date == null)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('GET /overdue returns undisposed rows past retention (synthetic: 6 days ago)', async () => {
    const mealDate = sixDaysAgoISO();
    await createSample({ meal_date: mealDate });
    const res = await request(app).get('/api/haccp/witness-meals/overdue').set(AUTH);
    expect(res.status).toBe(200);
    // A sample from 6 days ago has kept_until ~ 1 day ago → overdue
    const found = res.body.items.find(r => r.meal_date === mealDate);
    expect(found).toBeTruthy();
  });

  it('PUT disposing an active sample removes it from /active', async () => {
    const created = await createSample();
    const id = created.body.id;
    await request(app)
      .put(`/api/haccp/witness-meals/${id}`)
      .set(AUTH)
      .send({ disposed_date: '2026-04-22 09:00:00', disposed_by: 'Marie' });
    const res = await request(app).get('/api/haccp/witness-meals/active').set(AUTH);
    expect(res.body.items.find(r => r.id === id)).toBeUndefined();
  });
});

describe('Witness meals — audit log', () => {
  it('writes audit_log rows on create / update / delete', async () => {
    const created = await createSample();
    const id = created.body.id;
    await request(app).put(`/api/haccp/witness-meals/${id}`).set(AUTH).send({ notes: 'updated' });
    await request(app).delete(`/api/haccp/witness-meals/${id}`).set(AUTH);
    const rows = all(
      `SELECT action FROM audit_log WHERE table_name = 'witness_meals' AND record_id = ? ORDER BY id ASC`,
      [id]
    );
    const actions = rows.map(r => r.action);
    expect(actions).toEqual(['create', 'update', 'delete']);
  });
});

describe('TIAC integration — witness-meals-check', () => {
  it('returns samples within [incident - 3d, incident] and has_coverage=true', async () => {
    // Insert TIAC procedure for today
    const today = new Date().toISOString().slice(0, 10);
    const tiac = await request(app)
      .post('/api/tiac')
      .set(AUTH)
      .send({ date_incident: today, description: 'Test TIAC' });
    expect(tiac.status).toBe(201);

    // Witness meal from yesterday should fall in window
    await createSample({ meal_date: yesterdayISO() });

    const check = await request(app)
      .get(`/api/tiac/${tiac.body.id}/witness-meals-check`)
      .set(AUTH);
    expect(check.status).toBe(200);
    expect(check.body.has_coverage).toBe(true);
    expect(Array.isArray(check.body.samples)).toBe(true);
    expect(check.body.samples.length).toBeGreaterThan(0);
  });

  it('returns has_coverage=false when no samples in the window', async () => {
    // Incident 30 days ago, no samples that old
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    const old = d.toISOString().slice(0, 10);
    const tiac = await request(app)
      .post('/api/tiac')
      .set(AUTH)
      .send({ date_incident: old, description: 'Old TIAC no coverage' });
    const check = await request(app)
      .get(`/api/tiac/${tiac.body.id}/witness-meals-check`)
      .set(AUTH);
    expect(check.status).toBe(200);
    expect(check.body.has_coverage).toBe(false);
  });
});

describe('Witness meals — storage temp validation (Arrêté 21/12/2009 Art 32)', () => {
  it('POST / with storage_temperature in [0, 3] accepts as compliant', async () => {
    const res = await createSample({ storage_temperature: 2, is_complete: 1 });
    expect(res.status).toBe(201);
    expect(res.body.is_complete).toBe(1);
    expect(res.body.warning).toBeUndefined();
  });

  it('POST / with storage_temperature = 0 accepts (lower bound)', async () => {
    const res = await createSample({ storage_temperature: 0, is_complete: 1 });
    expect(res.status).toBe(201);
    expect(res.body.is_complete).toBe(1);
  });

  it('POST / with storage_temperature = 3 accepts (upper bound)', async () => {
    const res = await createSample({ storage_temperature: 3, is_complete: 1 });
    expect(res.status).toBe(201);
    expect(res.body.is_complete).toBe(1);
  });

  it('POST / with storage_temperature > 3 forces is_complete=0 and returns warning', async () => {
    const res = await createSample({ storage_temperature: 8, is_complete: 1 });
    expect(res.status).toBe(201);
    expect(res.body.is_complete).toBe(0);
    expect(res.body.warning).toMatch(/Art 32/);
    expect(res.body.notes).toMatch(/NON-CONFORME Art 32/);
  });

  it('POST / with storage_temperature < 0 forces is_complete=0', async () => {
    const res = await createSample({ storage_temperature: -5, is_complete: 1 });
    expect(res.status).toBe(201);
    expect(res.body.is_complete).toBe(0);
    expect(res.body.warning).toMatch(/Art 32/);
  });

  it('POST / with non-numeric storage_temperature returns 400', async () => {
    const res = await createSample({ storage_temperature: 'cold' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nombre/);
  });

  it('PUT / updating storage_temperature out of range forces is_complete=0', async () => {
    const created = await createSample({ storage_temperature: 2, is_complete: 1 });
    const id = created.body.id;
    const res = await request(app)
      .put(`/api/haccp/witness-meals/${id}`)
      .set(AUTH)
      .send({ storage_temperature: 10 });
    expect(res.status).toBe(200);
    expect(res.body.is_complete).toBe(0);
    expect(res.body.warning).toMatch(/Art 32/);
  });
});
