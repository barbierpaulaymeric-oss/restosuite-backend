'use strict';

const { get, run } = require('../db');
const { findCandidates, runRetentionPurge } = require('../lib/retention-purge');

// Helpers — insert a restaurant + its gérant account with a chosen inactivity.
function seedTenant({ rid, email, lastLoginExpr, active }) {
  run('INSERT INTO restaurants (id, name) VALUES (?, ?)', [rid, `Resto ${rid}`]);
  run(
    `INSERT INTO accounts (id, name, pin, role, restaurant_id, email, created_at, last_login)
     VALUES (?, ?, ?, 'gerant', ?, ?, datetime('now','-5 years'), ${lastLoginExpr})`,
    [rid * 10, `Gérant ${rid}`, '0000', rid, email]
  );
  if (active) {
    run(
      `INSERT INTO subscriptions (account_id, status, plan) VALUES (?, 'active', 'pro')`,
      [rid * 10]
    );
  }
}

describe('RGPD retention purge (anonymisation des comptes inactifs)', () => {
  beforeAll(() => {
    // R1: inactif 4 ans, pas d'abo, non-démo → CANDIDAT
    seedTenant({ rid: 1, email: 'old@bistrot.fr', lastLoginExpr: "datetime('now','-4 years')", active: false });
    // R2: connexion récente → épargné
    seedTenant({ rid: 2, email: 'recent@bistrot.fr', lastLoginExpr: "datetime('now')", active: false });
    // R3: vieux mais abonnement actif → épargné
    seedTenant({ rid: 3, email: 'paying@bistrot.fr', lastLoginExpr: "datetime('now','-4 years')", active: true });
    // R4: compte démo, vieux → épargné
    seedTenant({ rid: 4, email: 'demo@restosuite.fr', lastLoginExpr: "datetime('now','-4 years')", active: false });
  });

  it('ne retient que le restaurant inactif >3 ans, sans abo, non-démo', () => {
    const ids = findCandidates().map(c => c.restaurant_id).sort();
    expect(ids).toEqual([1]);
  });

  it('dry-run ne modifie rien', async () => {
    const res = await runRetentionPurge({ dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.candidates).toBe(1);
    expect(res.anonymized).toBe(0);
    const a = get('SELECT name, anonymized_at FROM accounts WHERE restaurant_id = 1');
    expect(a.name).toBe('Gérant 1');
    expect(a.anonymized_at).toBeNull();
  });

  it('mode activé anonymise le candidat et épargne les autres', async () => {
    const res = await runRetentionPurge({ dryRun: false });
    expect(res.anonymized).toBe(1);

    const r1 = get('SELECT name, email, first_name, anonymized_at FROM accounts WHERE restaurant_id = 1');
    expect(r1.name).toBe('[compte supprimé]');
    expect(r1.email).toMatch(/@deleted\.invalid$/);
    expect(r1.anonymized_at).not.toBeNull();

    // Les autres tenants restent intacts
    expect(get('SELECT name FROM accounts WHERE restaurant_id = 2').name).toBe('Gérant 2');
    expect(get('SELECT name FROM accounts WHERE restaurant_id = 3').name).toBe('Gérant 3');
    expect(get('SELECT name FROM accounts WHERE restaurant_id = 4').name).toBe('Gérant 4');
  });

  it('un compte déjà anonymisé n\'est plus candidat (idempotent)', () => {
    const ids = findCandidates().map(c => c.restaurant_id);
    expect(ids).not.toContain(1);
  });
});
