'use strict';

// Dashboard admin — les comptes de démo / test ne doivent jamais apparaître
// dans la liste des restaurateurs ni dans les statistiques de la plateforme.

const request = require('supertest');
const app = require('../app');
const { get, run } = require('../db');
const { authHeader } = require('./helpers/auth');

// Le portail admin n'est accessible qu'à l'email admin par défaut.
const ADMIN_AUTH = authHeader({ id: 9001, email: 'barbierpaulaymeric@gmail.com' });

const DEMO = [
  { rid: 8801, aid: 8801, email: 'demo@restosuite.fr', name: 'Démo' },
  { rid: 8802, aid: 8802, email: 'marcdupontbrasserie@test.com', name: 'Marc Démo' },
  { rid: 8803, aid: 8803, email: 'marie@bistrot-marie.fr', name: 'Marie Démo' },
  { rid: 8804, aid: 8804, email: 'kenji@sakura-paris.fr', name: 'Kenji Démo' },
];
const REAL = { rid: 8810, aid: 8810, email: 'vrai-resto@gmail.com', name: 'Vrai Resto' };

beforeAll(() => {
  for (const u of [...DEMO, REAL]) {
    if (!get('SELECT id FROM restaurants WHERE id = ?', [u.rid])) {
      run(`INSERT INTO restaurants (id, name, plan) VALUES (?, ?, 'free')`, [u.rid, u.name]);
    }
    if (!get('SELECT id FROM accounts WHERE id = ?', [u.aid])) {
      run(
        `INSERT INTO accounts (id, name, email, role, restaurant_id, is_owner)
         VALUES (?, ?, ?, 'gerant', ?, 1)`,
        [u.aid, u.name, u.email, u.rid]
      );
    }
  }
});

describe('GET /api/admin/users — exclusion des comptes démo', () => {
  it('renvoie le compte réel mais aucun compte démo/test', async () => {
    const res = await request(app).get('/api/admin/users').set(ADMIN_AUTH);
    expect(res.status).toBe(200);

    const emails = res.body.users.map(u => (u.email || '').toLowerCase());
    expect(emails).toContain(REAL.email);
    for (const u of DEMO) {
      expect(emails).not.toContain(u.email);
    }
  });
});

describe('GET /api/admin/restaurants — exclusion des restaurants démo', () => {
  it('exclut les restaurants liés à un propriétaire démo', async () => {
    const res = await request(app).get('/api/admin/restaurants').set(ADMIN_AUTH);
    expect(res.status).toBe(200);

    const ids = res.body.restaurants.map(r => r.id);
    expect(ids).toContain(REAL.rid);
    for (const u of DEMO) {
      expect(ids).not.toContain(u.rid);
    }
  });
});

describe('GET /api/admin/stats — compteurs sans les comptes démo', () => {
  it('ne compte pas les 4 comptes démo dans totalUsers', async () => {
    const res = await request(app).get('/api/admin/stats').set(ADMIN_AUTH);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalUsers).toBe('number');
    // Les comptes démo (insérés ci-dessus) ne doivent pas gonfler le compteur :
    // on vérifie via la liste filtrée que les emails démo sont bien absents.
    const list = await request(app).get('/api/admin/users').set(ADMIN_AUTH);
    expect(res.body.totalUsers).toBe(list.body.users.length);
  });
});
