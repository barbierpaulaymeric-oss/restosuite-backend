'use strict';

// Every newly-registered restaurant must get its own default HACCP plan de
// maîtrise sanitaire (dangers + CCP + arbre de décision). Regression guard for
// the 2026-07-05 critical: the plan used to be homed to restaurant_id=1 only,
// leaving every other tenant with an empty PMS / blank DDPP export.

const request = require('supertest');
const app = require('../app');
const { db, get } = require('../db');
const { seedDefaultHaccpPlan, restaurantHasHaccpPlan } = require('../lib/haccp-default-plan');

describe('Default HACCP plan is seeded per restaurant', () => {
  async function registerAndGetRid(tag) {
    const email = `plan_${tag}_${Date.now()}@example.com`;
    const res = await request(app).post('/api/auth/register').send({
      email, password: 'Str0ngPass', first_name: 'Test', accepted_terms: true,
    });
    expect([200, 201]).toContain(res.status);
    const acct = get('SELECT restaurant_id FROM accounts WHERE email = ?', [email]);
    expect(acct && acct.restaurant_id).toBeTruthy();
    return acct.restaurant_id;
  }

  it('each registered restaurant gets ITS OWN populated plan (per-tenant, no leak)', async () => {
    const ridA = await registerAndGetRid('a');
    const ridB = await registerAndGetRid('b');
    expect(ridA).not.toBe(ridB); // distinct tenants

    for (const rid of [ridA, ridB]) {
      const hazards = get('SELECT COUNT(*) AS c FROM haccp_hazard_analysis WHERE restaurant_id = ?', [rid]);
      const ccps = get('SELECT COUNT(*) AS c FROM haccp_ccp WHERE restaurant_id = ?', [rid]);
      const dt = get('SELECT COUNT(*) AS c FROM haccp_decision_tree_results WHERE restaurant_id = ?', [rid]);
      expect(hazards.c).toBe(11);
      expect(ccps.c).toBe(3);
      expect(dt.c).toBe(11);
    }
  });

  it('seedDefaultHaccpPlan is idempotent (no double-seed)', () => {
    // Use a high, unused restaurant id.
    const rid = 999001;
    try { db.prepare('INSERT INTO restaurants (id, name) VALUES (?, ?)').run(rid, 'Idem test'); } catch { /* may exist */ }
    const first = seedDefaultHaccpPlan(db, rid);
    expect(first.seeded).toBe(true);
    expect(restaurantHasHaccpPlan(db, rid)).toBe(true);
    const second = seedDefaultHaccpPlan(db, rid);
    expect(second.seeded).toBe(false);
    const count = get('SELECT COUNT(*) AS c FROM haccp_hazard_analysis WHERE restaurant_id = ?', [rid]);
    expect(count.c).toBe(11); // not 22
  });
});
