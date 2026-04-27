'use strict';

// Regression tests for the HACCP batch-temperature save bug.
//
// Original symptom: clicking "Enregistrer tout" did nothing — the batch
// handler in client/js/views/haccp-temperatures.js POSTed to a non-existent
// path '/haccp/temperature-logs', the request 404'd, the catch counted
// errors, and the user saw "X relevé(s) non enregistré(s)" but the
// behaviour read like "the button is broken". The actual server route is
// POST /api/haccp/temperatures (server/routes/haccp.js:149).
//
// These tests pin both ends of the contract:
// 1. Server: POST /api/haccp/temperatures with {zone_id, temperature}
//    actually creates a temperature_logs row.
// 2. Client: no source or bundle still references the wrong path.

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');
const { run, get } = require('../db');
const { authHeader } = require('./helpers/auth');

describe('POST /api/haccp/temperatures (batch + single)', () => {
  // Create a temperature_zones row so the server-side validation accepts the POST.
  function seedZone(restaurantId, opts = {}) {
    return run(
      `INSERT INTO temperature_zones (restaurant_id, name, type, min_temp, max_temp)
       VALUES (?, ?, ?, ?, ?)`,
      [restaurantId, opts.name || 'Frigo 1', opts.type || 'positive', opts.min ?? 0, opts.max ?? 4]
    ).lastInsertRowid;
  }

  it('persists a temperature_logs row for a single submission', async () => {
    const rid = 1;
    const zoneId = seedZone(rid);
    const before = get('SELECT COUNT(*) AS c FROM temperature_logs WHERE zone_id = ?', [zoneId]).c;
    const res = await request(app)
      .post('/api/haccp/temperatures')
      .set(authHeader())
      .send({ zone_id: zoneId, temperature: 3.5 });
    expect(res.status).toBe(201);
    const after = get('SELECT COUNT(*) AS c FROM temperature_logs WHERE zone_id = ?', [zoneId]).c;
    expect(after).toBe(before + 1);
    expect(res.body.temperature).toBe(3.5);
    expect(res.body.is_alert).toBe(0); // 3.5 within [0,4]
  });

  it('flags non-conform temperatures as is_alert=1', async () => {
    const rid = 1;
    const zoneId = seedZone(rid, { min: 0, max: 4 });
    const res = await request(app)
      .post('/api/haccp/temperatures')
      .set(authHeader())
      .send({ zone_id: zoneId, temperature: 12 });
    expect(res.status).toBe(201);
    expect(res.body.is_alert).toBe(1);
  });

  it('simulates the batch click handler — three saves create three rows', async () => {
    const rid = 1;
    const zoneA = seedZone(rid, { name: 'Frigo A', min: 0, max: 4 });
    const zoneB = seedZone(rid, { name: 'Frigo B', min: 0, max: 4 });
    const zoneC = seedZone(rid, { name: 'Congel',  min: -25, max: -18 });

    // The batch handler iterates entries and POSTs each one in sequence.
    const batch = [
      { zone_id: zoneA, temperature: 3.0 },
      { zone_id: zoneB, temperature: 4.0 },
      { zone_id: zoneC, temperature: -22 },
    ];
    let errors = 0;
    for (const entry of batch) {
      const r = await request(app)
        .post('/api/haccp/temperatures')
        .set(authHeader())
        .send(entry);
      if (r.status !== 201) errors++;
    }
    expect(errors).toBe(0);
    const total = get(
      'SELECT COUNT(*) AS c FROM temperature_logs WHERE zone_id IN (?, ?, ?)',
      [zoneA, zoneB, zoneC]
    ).c;
    expect(total).toBe(3);
  });

  it('the OLD wrong path /api/haccp/temperature-logs is NOT a valid endpoint', async () => {
    const res = await request(app)
      .post('/api/haccp/temperature-logs')
      .set(authHeader())
      .send({ zone_id: 1, temperature: 3 });
    // Express returns 404 for unmatched routes (or 401 if hit before auth).
    // Either way it's NOT a 201 — so the previous client code couldn't have
    // succeeded. This test pins the negative contract.
    expect(res.status).not.toBe(201);
  });
});

describe('Client source has no reference to the deprecated /haccp/temperature-logs path', () => {
  // Static check: any source under client/js/ that still mentions the dead
  // path is the bug regressing. This caught the original issue and guards
  // against a future copy-paste re-introducing it.
  const CLIENT_DIR = path.join(__dirname, '..', '..', 'client', 'js');
  const BUNDLE = path.join(__dirname, '..', '..', 'client', 'js', 'app.bundle.js');

  function* walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) yield* walk(p);
      else if (ent.name.endsWith('.js')) yield p;
    }
  }

  it('no .js source file under client/js mentions /haccp/temperature-logs', () => {
    const offenders = [];
    for (const file of walk(CLIENT_DIR)) {
      // Skip the bundle — it's checked separately below so the diagnostic
      // points at the source file the dev should edit.
      if (file === BUNDLE) continue;
      const txt = fs.readFileSync(file, 'utf8');
      if (txt.includes('/haccp/temperature-logs')) {
        offenders.push(path.relative(path.join(__dirname, '..', '..'), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('app.bundle.js does not contain /haccp/temperature-logs', () => {
    if (!fs.existsSync(BUNDLE)) return; // skip when bundle hasn't been built yet
    const txt = fs.readFileSync(BUNDLE, 'utf8');
    expect(txt.includes('/haccp/temperature-logs')).toBe(false);
  });
});
