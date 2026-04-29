'use strict';

// Staff scheduling: members + shifts CRUD, weekly grid, labor cost,
// tenant isolation. Mirrors the invoices test harness pattern.

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');
const { shiftHours, weekBounds } = require('../routes/planning');

let RID_A, RID_B;

function tag() { return Math.random().toString(36).slice(2, 8); }

beforeAll(() => {
  const t = tag();
  RID_A = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Plan Test A ${t}`]
  ).lastInsertRowid;
  RID_B = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`Plan Test B ${t}`]
  ).lastInsertRowid;
});

function authA() { return authHeader({ id: 1, role: 'gerant', restaurant_id: RID_A }); }
function authB() { return authHeader({ id: 2, role: 'gerant', restaurant_id: RID_B }); }

describe('shiftHours helper', () => {
  it('computes hours for normal day shift minus break', () => {
    expect(shiftHours('09:00', '17:30', 30)).toBeCloseTo(8, 2);
  });
  it('handles overnight shift wrapping past midnight', () => {
    expect(shiftHours('22:00', '02:00', 0)).toBe(4);
  });
  it('returns 0 for invalid times', () => {
    expect(shiftHours('bogus', '17:00', 0)).toBe(0);
  });
  it('never returns negative when break exceeds shift length', () => {
    expect(shiftHours('09:00', '10:00', 999)).toBe(0);
  });
});

describe('weekBounds helper', () => {
  it('snaps any in-week date to Mon..Sun', () => {
    const w = weekBounds('2026-04-29'); // Wed
    expect(w.from).toBe('2026-04-27');
    expect(w.to).toBe('2026-05-03');
  });
});

describe('POST /api/planning/members', () => {
  it('creates a member with default contract_hours when omitted', async () => {
    const res = await request(app)
      .post('/api/planning/members')
      .set(authA())
      .send({ name: 'Alice Chef', role: 'Cuisinier', hourly_rate: 14.5 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.restaurant_id).toBe(RID_A);
    expect(res.body.contract_hours).toBe(35);
    expect(res.body.hourly_rate).toBe(14.5);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/planning/members')
      .set(authA())
      .send({ role: 'Plongeur' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/planning/members tenant isolation', () => {
  let mA, mB;
  beforeAll(async () => {
    const r1 = await request(app).post('/api/planning/members').set(authA()).send({ name: 'Tenant A Member' });
    mA = r1.body.id;
    const r2 = await request(app).post('/api/planning/members').set(authB()).send({ name: 'Tenant B Member' });
    mB = r2.body.id;
  });

  it('lists only the caller\'s members', async () => {
    const a = await request(app).get('/api/planning/members').set(authA());
    expect(a.status).toBe(200);
    const aIds = a.body.map(m => m.id);
    expect(aIds).toContain(mA);
    expect(aIds).not.toContain(mB);

    const b = await request(app).get('/api/planning/members').set(authB());
    const bIds = b.body.map(m => m.id);
    expect(bIds).toContain(mB);
    expect(bIds).not.toContain(mA);
  });

  it('returns 404 when updating another tenant\'s member', async () => {
    const res = await request(app).put(`/api/planning/members/${mB}`).set(authA()).send({ name: 'Hijack' });
    expect(res.status).toBe(404);
  });

  it('soft-deletes member and excludes from list', async () => {
    const create = await request(app).post('/api/planning/members').set(authA()).send({ name: 'Soon To Go' });
    const id = create.body.id;
    const del = await request(app).delete(`/api/planning/members/${id}`).set(authA());
    expect(del.status).toBe(200);
    const list = await request(app).get('/api/planning/members').set(authA());
    expect(list.body.find(m => m.id === id)).toBeUndefined();
    // row still in DB with deleted_at set
    const row = get('SELECT deleted_at FROM staff_members WHERE id = ?', [id]);
    expect(row.deleted_at).not.toBeNull();
  });
});

describe('Shifts CRUD', () => {
  let memberId;
  beforeAll(async () => {
    const r = await request(app).post('/api/planning/members').set(authA())
      .send({ name: 'Bob Shift', hourly_rate: 12 });
    memberId = r.body.id;
  });

  it('creates a shift and returns it', async () => {
    const res = await request(app).post('/api/planning/shifts').set(authA())
      .send({ staff_member_id: memberId, date: '2026-04-29', start_time: '09:00', end_time: '17:00', break_minutes: 30 });
    expect(res.status).toBe(201);
    expect(res.body.staff_member_id).toBe(memberId);
    expect(res.body.status).toBe('planned');
  });

  it('rejects shift for member from another tenant', async () => {
    const r = await request(app).post('/api/planning/members').set(authB()).send({ name: 'Other Tenant' });
    const otherMemberId = r.body.id;
    const res = await request(app).post('/api/planning/shifts').set(authA())
      .send({ staff_member_id: otherMemberId, date: '2026-04-29', start_time: '09:00', end_time: '17:00' });
    expect(res.status).toBe(404);
  });

  it('rejects invalid status on PUT', async () => {
    const c = await request(app).post('/api/planning/shifts').set(authA())
      .send({ staff_member_id: memberId, date: '2026-04-30', start_time: '10:00', end_time: '14:00' });
    const res = await request(app).put(`/api/planning/shifts/${c.body.id}`).set(authA())
      .send({ status: 'BOGUS' });
    expect(res.status).toBe(400);
  });

  it('lists shifts in a date window with computed hours/cost', async () => {
    const res = await request(app)
      .get('/api/planning/shifts?from=2026-04-29&to=2026-04-29')
      .set(authA());
    expect(res.status).toBe(200);
    const found = res.body.find(s => s.date === '2026-04-29' && s.start_time === '09:00:00' || s.start_time === '09:00');
    expect(found).toBeDefined();
    expect(found.hours).toBeCloseTo(7.5, 2); // 8h - 30m break
    expect(found.cost).toBeCloseTo(7.5 * 12, 2);
  });
});

describe('GET /api/planning/week', () => {
  it('returns members + shifts for the calendar week containing date', async () => {
    const r = await request(app).post('/api/planning/members').set(authA())
      .send({ name: 'Carol Week', hourly_rate: 10 });
    const memberId = r.body.id;
    await request(app).post('/api/planning/shifts').set(authA())
      .send({ staff_member_id: memberId, date: '2026-04-30', start_time: '08:00', end_time: '12:00' });

    const res = await request(app).get('/api/planning/week?date=2026-04-30').set(authA());
    expect(res.status).toBe(200);
    expect(res.body.from).toBe('2026-04-27');
    expect(res.body.to).toBe('2026-05-03');
    const myShift = res.body.shifts.find(s => s.staff_member_id === memberId);
    expect(myShift).toBeDefined();
    expect(myShift.hours).toBe(4);
    expect(myShift.cost).toBe(40);
  });
});

describe('GET /api/planning/labor-cost', () => {
  it('aggregates total hours and cost over the period and excludes cancelled shifts', async () => {
    const r = await request(app).post('/api/planning/members').set(authA())
      .send({ name: 'Dora Cost', hourly_rate: 20 });
    const memberId = r.body.id;
    await request(app).post('/api/planning/shifts').set(authA())
      .send({ staff_member_id: memberId, date: '2026-05-04', start_time: '09:00', end_time: '13:00' }); // 4h * 20 = 80
    const cancelled = await request(app).post('/api/planning/shifts').set(authA())
      .send({ staff_member_id: memberId, date: '2026-05-05', start_time: '09:00', end_time: '17:00' });
    await request(app).put(`/api/planning/shifts/${cancelled.body.id}`).set(authA()).send({ status: 'cancelled' });

    const res = await request(app)
      .get('/api/planning/labor-cost?from=2026-05-04&to=2026-05-06')
      .set(authA());
    expect(res.status).toBe(200);
    expect(res.body.total_hours).toBe(4);
    expect(res.body.total_cost).toBe(80);
    expect(res.body.by_member.find(m => m.name === 'Dora Cost')).toBeDefined();
  });
});
