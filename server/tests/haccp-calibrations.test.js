'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

async function createThermometer(overrides = {}) {
  const res = await request(app)
    .post('/api/haccp/thermometers')
    .set(AUTH)
    .send({
      name: 'Sonde cuisine',
      serial_number: 'SN-001',
      location: 'Chambre froide positive',
      type: 'digital',
      ...overrides,
    });
  return res.body;
}

describe('HACCP — Thermometers CRUD', () => {
  it('GET /api/haccp/thermometers → 200 shape', async () => {
    const res = await request(app).get('/api/haccp/thermometers').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('POST /api/haccp/thermometers → 201 with created row', async () => {
    const res = await request(app)
      .post('/api/haccp/thermometers')
      .set(AUTH)
      .send({ name: 'Sonde chambre froide A', type: 'digital', location: 'Cuisine' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Sonde chambre froide A');
    expect(res.body.is_active).toBe(1);
  });

  it('POST /api/haccp/thermometers → 400 without name', async () => {
    const res = await request(app)
      .post('/api/haccp/thermometers')
      .set(AUTH)
      .send({ type: 'digital' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/haccp/thermometers/:id → 200 updated', async () => {
    const t = await createThermometer({ name: 'Sonde à modifier' });
    const res = await request(app)
      .put(`/api/haccp/thermometers/${t.id}`)
      .set(AUTH)
      .send({ name: 'Sonde modifiée', location: 'Nouvelle zone' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sonde modifiée');
    expect(res.body.location).toBe('Nouvelle zone');
  });

  it('DELETE /api/haccp/thermometers/:id → soft delete', async () => {
    const t = await createThermometer({ name: 'Sonde à retirer' });
    const res = await request(app)
      .delete(`/api/haccp/thermometers/${t.id}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.soft).toBe(true);
    // Should still exist but is_active = 0
    const getRes = await request(app)
      .get(`/api/haccp/thermometers/${t.id}`)
      .set(AUTH);
    expect(getRes.status).toBe(200);
    expect(getRes.body.is_active).toBe(0);
  });

  it('GET /api/haccp/thermometers/:id → includes calibration history', async () => {
    const t = await createThermometer({ name: 'Sonde historique' });
    const res = await request(app).get(`/api/haccp/thermometers/${t.id}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  it('GET /api/haccp/thermometers/:id → 404 for unknown id', async () => {
    const res = await request(app).get('/api/haccp/thermometers/999999').set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('HACCP — Calibrations CRUD', () => {
  it('POST /api/haccp/calibrations → 201 computes deviation + compliance', async () => {
    const t = await createThermometer({ name: 'Sonde calibrage' });
    const res = await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        calibration_date: '2026-04-17',
        next_calibration_date: '2027-04-17',
        reference_temperature: 0,
        measured_temperature: 0.3,
        tolerance: 0.5,
        calibrated_by: 'Chef Alfred',
      });
    expect(res.status).toBe(201);
    expect(res.body.deviation).toBeCloseTo(0.3, 5);
    expect(res.body.is_compliant).toBe(1);
  });

  it('POST /api/haccp/calibrations → non-compliant when deviation exceeds tolerance', async () => {
    const t = await createThermometer({ name: 'Sonde défectueuse' });
    const res = await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        calibration_date: '2026-04-17',
        reference_temperature: 0,
        measured_temperature: 1.2,
        tolerance: 0.5,
        corrective_action: 'Remplacer la sonde',
      });
    expect(res.status).toBe(201);
    expect(res.body.is_compliant).toBe(0);
    expect(res.body.corrective_action).toBe('Remplacer la sonde');
  });

  it('POST /api/haccp/calibrations → 400 without thermometer_id', async () => {
    const res = await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        calibration_date: '2026-04-17',
        reference_temperature: 0,
        measured_temperature: 0.1,
      });
    expect(res.status).toBe(400);
  });

  it('POST /api/haccp/calibrations → 400 without calibration_date', async () => {
    const t = await createThermometer({ name: 'Sonde sans date' });
    const res = await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        reference_temperature: 0,
        measured_temperature: 0.1,
      });
    expect(res.status).toBe(400);
  });

  it('POST /api/haccp/calibrations → 400 without numeric temperatures', async () => {
    const t = await createThermometer({ name: 'Sonde T° invalides' });
    const res = await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        calibration_date: '2026-04-17',
        reference_temperature: 'zero',
        measured_temperature: 'zero',
      });
    expect(res.status).toBe(400);
  });

  it('POST /api/haccp/calibrations → updates parent thermometer last/next dates', async () => {
    const t = await createThermometer({ name: 'Sonde auto-maj' });
    await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        calibration_date: '2026-04-17',
        next_calibration_date: '2027-04-17',
        reference_temperature: 0,
        measured_temperature: 0.1,
      });
    const getRes = await request(app).get(`/api/haccp/thermometers/${t.id}`).set(AUTH);
    expect(getRes.body.last_calibration_date).toBe('2026-04-17');
    expect(getRes.body.next_calibration_date).toBe('2027-04-17');
  });

  it('GET /api/haccp/calibrations → filters by thermometer_id', async () => {
    const t = await createThermometer({ name: 'Sonde filtrage' });
    await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        calibration_date: '2026-04-10',
        reference_temperature: 0,
        measured_temperature: 0.2,
      });
    const res = await request(app)
      .get(`/api/haccp/calibrations?thermometer_id=${t.id}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.items.every(x => x.thermometer_id === String(t.id))).toBe(true);
  });

  it('PUT /api/haccp/calibrations/:id → recomputes deviation', async () => {
    const t = await createThermometer({ name: 'Sonde update' });
    const create = await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        calibration_date: '2026-04-01',
        reference_temperature: 0,
        measured_temperature: 0.1,
      });
    const res = await request(app)
      .put(`/api/haccp/calibrations/${create.body.id}`)
      .set(AUTH)
      .send({ measured_temperature: 0.9, tolerance: 0.5 });
    expect(res.status).toBe(200);
    expect(res.body.deviation).toBeCloseTo(0.9, 5);
    expect(res.body.is_compliant).toBe(0);
  });

  it('DELETE /api/haccp/calibrations/:id → 200', async () => {
    const t = await createThermometer({ name: 'Sonde delete-cal' });
    const create = await request(app)
      .post('/api/haccp/calibrations')
      .set(AUTH)
      .send({
        thermometer_id: String(t.id),
        calibration_date: '2026-04-01',
        reference_temperature: 0,
        measured_temperature: 0.1,
      });
    const res = await request(app)
      .delete(`/api/haccp/calibrations/${create.body.id}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });
});

describe('HACCP — Calibration alerts', () => {
  it('GET /api/haccp/thermometers/alerts → overdue + due_soon shape', async () => {
    const res = await request(app).get('/api/haccp/thermometers/alerts').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.overdue)).toBe(true);
    expect(Array.isArray(res.body.due_soon)).toBe(true);
  });

  it('Thermometer with past next_calibration_date appears in overdue', async () => {
    const t = await createThermometer({
      name: 'Sonde en retard',
      next_calibration_date: '2025-01-01',
    });
    const res = await request(app).get('/api/haccp/thermometers/alerts').set(AUTH);
    const ids = res.body.overdue.map(x => x.id);
    expect(ids).toContain(t.id);
  });

  it('Thermometer without any calibration appears in overdue', async () => {
    const t = await createThermometer({ name: 'Sonde jamais étalonnée' });
    const res = await request(app).get('/api/haccp/thermometers/alerts').set(AUTH);
    const ids = res.body.overdue.map(x => x.id);
    expect(ids).toContain(t.id);
  });
});

describe('HACCP — Calibration tenant isolation', () => {
  it('GET /api/haccp/thermometers scoped to caller tenant', async () => {
    const tenantA = authHeader({ restaurant_id: 100 });
    const tenantB = authHeader({ restaurant_id: 200 });
    await request(app)
      .post('/api/haccp/thermometers')
      .set(tenantA)
      .send({ name: 'Sonde tenant A' });
    const resB = await request(app).get('/api/haccp/thermometers').set(tenantB);
    expect(resB.body.items.every(x => x.name !== 'Sonde tenant A')).toBe(true);
  });

  it('Cannot read another tenant\'s thermometer by id', async () => {
    const tenantA = authHeader({ restaurant_id: 101 });
    const tenantB = authHeader({ restaurant_id: 201 });
    const created = await request(app)
      .post('/api/haccp/thermometers')
      .set(tenantA)
      .send({ name: 'Sonde privée' });
    const res = await request(app)
      .get(`/api/haccp/thermometers/${created.body.id}`)
      .set(tenantB);
    expect(res.status).toBe(404);
  });
});
