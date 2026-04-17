'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

async function createZone(name = 'Zone Test') {
  const res = await request(app)
    .post('/api/haccp/zones')
    .set(AUTH)
    .send({ name, type: 'fridge', min_temp: 0, max_temp: 4 });
  return res.body;
}

// ─── Temperature Zones ───────────────────────────────────────

describe('HACCP — Temperature Zones', () => {
  it('GET /api/haccp/zones → 200 array', async () => {
    const res = await request(app).get('/api/haccp/zones').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/haccp/zones → 201 with zone data', async () => {
    const res = await request(app)
      .post('/api/haccp/zones')
      .set(AUTH)
      .send({ name: 'Chambre froide A', type: 'fridge', min_temp: 0, max_temp: 4 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Chambre froide A');
  });

  it('POST /api/haccp/zones → 400 without name', async () => {
    const res = await request(app)
      .post('/api/haccp/zones')
      .set(AUTH)
      .send({ type: 'fridge' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/haccp/zones/:id → 200 updated zone', async () => {
    const zone = await createZone('Zone à modifier');
    const res = await request(app)
      .put(`/api/haccp/zones/${zone.id}`)
      .set(AUTH)
      .send({ name: 'Zone modifiée', type: 'freezer', min_temp: -25, max_temp: -18 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Zone modifiée');
  });

  it('DELETE /api/haccp/zones/:id → 200', async () => {
    const zone = await createZone('Zone à supprimer');
    const res = await request(app)
      .delete(`/api/haccp/zones/${zone.id}`)
      .set(AUTH);
    expect(res.status).toBe(200);
  });

  it('PUT /api/haccp/zones/999999 → 404 for unknown id', async () => {
    const res = await request(app)
      .put('/api/haccp/zones/999999')
      .set(AUTH)
      .send({ name: 'ghost' });
    expect(res.status).toBe(404);
  });
});

// ─── Temperature Logs ───────────────────────────────────────

describe('HACCP — Temperature Logs (/temperatures)', () => {
  let zoneId;

  beforeAll(async () => {
    const zone = await createZone('TempLogZone');
    zoneId = zone.id;
  });

  it('GET /api/haccp/temperatures → 200 array', async () => {
    const res = await request(app).get('/api/haccp/temperatures').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/haccp/temperatures → 201', async () => {
    const res = await request(app)
      .post('/api/haccp/temperatures')
      .set(AUTH)
      .send({ zone_id: zoneId, temperature: 3.5, checked_by: 'Chef Test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('GET /api/haccp/temperatures/today → 200', async () => {
    const res = await request(app).get('/api/haccp/temperatures/today').set(AUTH);
    expect(res.status).toBe(200);
  });

  it('GET /api/haccp/temperatures/alerts → 200', async () => {
    const res = await request(app).get('/api/haccp/temperatures/alerts').set(AUTH);
    expect(res.status).toBe(200);
  });
});

// ─── Cleaning ───────────────────────────────────────────────

describe('HACCP — Cleaning (/cleaning)', () => {
  it('GET /api/haccp/cleaning → 200 array', async () => {
    const res = await request(app).get('/api/haccp/cleaning').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/haccp/cleaning → 201', async () => {
    const res = await request(app)
      .post('/api/haccp/cleaning')
      .set(AUTH)
      .send({ name: 'Nettoyage friteuse', zone: 'Cuisine', frequency: 'daily' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('POST /api/haccp/cleaning/:id/done → marks as done', async () => {
    const createRes = await request(app)
      .post('/api/haccp/cleaning')
      .set(AUTH)
      .send({ name: 'Tâche à valider', zone: 'Salle', frequency: 'daily' });
    const taskId = createRes.body.id;

    const res = await request(app)
      .post(`/api/haccp/cleaning/${taskId}/done`)
      .set(AUTH)
      .send({ done_by: 'Test User' });
    expect([200, 201]).toContain(res.status);
  });

  it('GET /api/haccp/cleaning/today → 200', async () => {
    const res = await request(app).get('/api/haccp/cleaning/today').set(AUTH);
    expect(res.status).toBe(200);
  });
});

// ─── Reception Traceability ─────────────────────────────────

describe('HACCP — Reception Traceability (/traceability)', () => {
  it('GET /api/haccp/traceability → 200 array', async () => {
    const res = await request(app).get('/api/haccp/traceability').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── Cooling Logs ───────────────────────────────────────────

describe('HACCP — Cooling Logs (/cooling)', () => {
  it('GET /api/haccp/cooling → 200', async () => {
    const res = await request(app).get('/api/haccp/cooling').set(AUTH);
    expect(res.status).toBe(200);
  });
});

// ─── Reheating Logs ─────────────────────────────────────────

describe('HACCP — Reheating Logs (/reheating)', () => {
  it('GET /api/haccp/reheating → 200', async () => {
    const res = await request(app).get('/api/haccp/reheating').set(AUTH);
    expect(res.status).toBe(200);
  });
});

// ─── Cooking Records (CCP2) ─────────────────────────────────

describe('HACCP — Cooking Records (/cooking)', () => {
  it('GET /api/haccp/cooking → 200 with items array', async () => {
    const res = await request(app).get('/api/haccp/cooking').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('POST /api/haccp/cooking → 201 conforme when measured ≥ target', async () => {
    const res = await request(app)
      .post('/api/haccp/cooking')
      .set(AUTH)
      .send({
        product_name: 'Poulet rôti',
        cooking_date: '2026-04-17',
        target_temperature: 70,
        measured_temperature: 72.5,
        operator: 'Chef Test',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.is_compliant).toBe(1);
  });

  it('POST /api/haccp/cooking → 201 non-conforme when measured < target', async () => {
    const res = await request(app)
      .post('/api/haccp/cooking')
      .set(AUTH)
      .send({
        product_name: 'Bœuf',
        cooking_date: '2026-04-17',
        target_temperature: 63,
        measured_temperature: 58,
        corrective_action: 'Prolongation de la cuisson',
      });
    expect(res.status).toBe(201);
    expect(res.body.is_compliant).toBe(0);
  });

  it('POST /api/haccp/cooking → 400 without required fields', async () => {
    const res = await request(app)
      .post('/api/haccp/cooking')
      .set(AUTH)
      .send({ product_name: 'Test' }); // missing date + temps
    expect(res.status).toBe(400);
  });

  it('POST /api/haccp/cooking → 400 for target_temperature out of range', async () => {
    const res = await request(app)
      .post('/api/haccp/cooking')
      .set(AUTH)
      .send({
        product_name: 'Test',
        cooking_date: '2026-04-17',
        target_temperature: 500,
        measured_temperature: 60,
      });
    expect(res.status).toBe(400);
  });

  it('PUT /api/haccp/cooking/:id → 200 and recomputes is_compliant', async () => {
    const createRes = await request(app)
      .post('/api/haccp/cooking')
      .set(AUTH)
      .send({
        product_name: 'Saumon',
        cooking_date: '2026-04-17',
        target_temperature: 63,
        measured_temperature: 55,
      });
    const id = createRes.body.id;

    const res = await request(app)
      .put(`/api/haccp/cooking/${id}`)
      .set(AUTH)
      .send({ measured_temperature: 65 });
    expect(res.status).toBe(200);
    expect(res.body.is_compliant).toBe(1);
  });

  it('PUT /api/haccp/cooking/999999 → 404', async () => {
    const res = await request(app)
      .put('/api/haccp/cooking/999999')
      .set(AUTH)
      .send({ measured_temperature: 70 });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/haccp/cooking/:id → 200', async () => {
    const createRes = await request(app)
      .post('/api/haccp/cooking')
      .set(AUTH)
      .send({
        product_name: 'À supprimer',
        cooking_date: '2026-04-17',
        target_temperature: 63,
        measured_temperature: 65,
      });
    const id = createRes.body.id;

    const res = await request(app)
      .delete(`/api/haccp/cooking/${id}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('GET /api/haccp/cooking/stats → 200 with compliance metrics', async () => {
    const res = await request(app).get('/api/haccp/cooking/stats').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('compliant');
    expect(res.body).toHaveProperty('non_compliant');
    expect(res.body).toHaveProperty('compliance_rate');
    expect(Array.isArray(res.body.by_product)).toBe(true);
  });

  it('GET /api/haccp/cooking/non-compliant → 200 with items', async () => {
    const res = await request(app).get('/api/haccp/cooking/non-compliant').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    res.body.items.forEach(item => expect(item.is_compliant).toBe(0));
  });
});

// ─── Fryers ─────────────────────────────────────────────────

describe('HACCP — Fryers (/fryers)', () => {
  it('GET /api/haccp/fryers → 200', async () => {
    const res = await request(app).get('/api/haccp/fryers').set(AUTH);
    expect(res.status).toBe(200);
  });
});

describe('HACCP — Fryer polar compounds enforcement (Arrêté 21/12/2009 Art 6)', () => {
  async function makeFryer() {
    const res = await request(app)
      .post('/api/haccp/fryers')
      .set(AUTH)
      .send({ name: `Friteuse ${Date.now()}` });
    return res.body.id;
  }

  it('accepts controle_polaire with value ≤ 20% as compliant (no warning)', async () => {
    const fryerId = await makeFryer();
    const res = await request(app)
      .post(`/api/haccp/fryers/${fryerId}/checks`)
      .set(AUTH)
      .send({ action_type: 'controle_polaire', polar_value: 15 });
    expect(res.status).toBe(201);
    expect(res.body.is_compliant).toBe(1);
    expect(res.body.warning).toBeUndefined();
  });

  it('accepts value in warning zone [20, 25] with a warning message', async () => {
    const fryerId = await makeFryer();
    const res = await request(app)
      .post(`/api/haccp/fryers/${fryerId}/checks`)
      .set(AUTH)
      .send({ action_type: 'controle_polaire', polar_value: 22 });
    expect(res.status).toBe(201);
    expect(res.body.is_compliant).toBe(1);
    expect(res.body.warning).toMatch(/seuil d'alerte/);
  });

  it('accepts value = 25 exactly (legal limit inclusive)', async () => {
    const fryerId = await makeFryer();
    const res = await request(app)
      .post(`/api/haccp/fryers/${fryerId}/checks`)
      .set(AUTH)
      .send({ action_type: 'controle_polaire', polar_value: 25 });
    expect(res.status).toBe(201);
    expect(res.body.is_compliant).toBe(1);
  });

  it('rejects value > 25 without corrective_action (400)', async () => {
    const fryerId = await makeFryer();
    const res = await request(app)
      .post(`/api/haccp/fryers/${fryerId}/checks`)
      .set(AUTH)
      .send({ action_type: 'controle_polaire', polar_value: 28 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Art 6/);
    expect(res.body.is_compliant).toBe(0);
  });

  it('accepts value > 25 with corrective_action, marked non-compliant', async () => {
    const fryerId = await makeFryer();
    const res = await request(app)
      .post(`/api/haccp/fryers/${fryerId}/checks`)
      .set(AUTH)
      .send({
        action_type: 'controle_polaire',
        polar_value: 30,
        corrective_action: 'Vidange complète, retrait du bain et changement d\'huile',
      });
    expect(res.status).toBe(201);
    expect(res.body.is_compliant).toBe(0);
  });

  it('POST /checks without polar_value still requires it for controle_polaire', async () => {
    const fryerId = await makeFryer();
    const res = await request(app)
      .post(`/api/haccp/fryers/${fryerId}/checks`)
      .set(AUTH)
      .send({ action_type: 'controle_polaire' });
    expect(res.status).toBe(400);
  });
});

// ─── Non-Conformities ───────────────────────────────────────

describe('HACCP — Non-Conformities (/non-conformities)', () => {
  it('GET /api/haccp/non-conformities → 200', async () => {
    const res = await request(app).get('/api/haccp/non-conformities').set(AUTH);
    expect(res.status).toBe(200);
  });

  it('POST /api/haccp/non-conformities → 201', async () => {
    const res = await request(app)
      .post('/api/haccp/non-conformities')
      .set(AUTH)
      .send({
        title: 'Température hors norme',
        description: 'Relevé à +8°C au lieu de +4°C',
        category: 'temperature',
        severity: 'mineure',
      });
    expect([200, 201]).toContain(res.status);
  });
});

// ─── HACCP Plan (/api/haccp-plan) ───────────────────────────

describe('HACCP Plan (/api/haccp-plan)', () => {
  it('GET /api/haccp-plan → 200 or 204', async () => {
    const res = await request(app).get('/api/haccp-plan').set(AUTH);
    expect([200, 204]).toContain(res.status);
  });
});

// ─── Auth protection ────────────────────────────────────────

describe('HACCP — all subroutes require auth', () => {
  const paths = [
    '/api/haccp/zones',
    '/api/haccp/temperatures',
    '/api/haccp/cleaning',
    '/api/haccp/traceability',
    '/api/haccp/cooling',
    '/api/haccp/cooking',
    '/api/haccp/reheating',
    '/api/haccp/fryers',
    '/api/haccp/non-conformities',
    '/api/haccp-plan',
  ];

  test.each(paths)('GET %s → 401 without token', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });
});
