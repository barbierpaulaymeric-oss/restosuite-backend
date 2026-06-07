'use strict';

// Relances anti-churn (J+1/J+3/J+7) — server/lib/retention-mailer.js
// On mocke le client SMTP pour capturer les envois sans toucher au réseau, et
// on fabrique des comptes directement en base avec un created_at contrôlé.

const sentEmails = [];
jest.mock('../lib/mercuriale-mail/smtp-client', () => ({
  sendPlainEmail: jest.fn(async (msg) => { sentEmails.push(msg); return { messageId: 'mock' }; }),
}));

// runRetentionCycle est env-gated : il faut des creds SMTP « présents ».
process.env.MERCURIALE_EMAIL = 'test@restosuite.fr';
process.env.MERCURIALE_PASSWORD = 'x';

require('../db'); // initialise le schéma + migrations (retention_emails_sent)
const { run, get, all } = require('../db');
const { runRetentionCycle } = require('../lib/retention-mailer');

let _seq = 0;
// Crée un compte gérant. ageDays = ancienneté du compte (created_at), activated
// = first_recipe_at renseigné (compte activé → jamais relancé).
function makeOwner({ email, ageDays = 0, activated = false } = {}) {
  _seq += 1;
  const addr = email || `owner${_seq}@brasserie.fr`;
  const res = run(
    `INSERT INTO accounts (name, pin, role, permissions, email, is_owner, first_name, created_at, first_recipe_at)
     VALUES (?, '0000', 'gerant', '{}', ?, 1, 'Camille',
             datetime('now', ?), ?)`,
    [`Compte ${_seq}`, addr, `-${ageDays} days`, activated ? "2026-01-01 00:00:00" : null]
  );
  return res.lastInsertRowid;
}

function sentTypesFor(accountId) {
  return all('SELECT email_type FROM retention_emails_sent WHERE account_id = ? ORDER BY email_type', [accountId])
    .map(r => r.email_type);
}

beforeEach(() => {
  sentEmails.length = 0;
  run('DELETE FROM retention_emails_sent');
  run('DELETE FROM accounts');
});

describe('runRetentionCycle', () => {
  it('envoie la relance J+1 à un gérant non activé créé il y a 1 jour', async () => {
    const id = makeOwner({ email: 'j1@resto.fr', ageDays: 1 });
    const r = await runRetentionCycle();
    expect(r.sent).toBe(1);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('j1@resto.fr');
    expect(sentEmails[0].subject).toMatch(/première fiche/i);
    expect(sentTypesFor(id)).toEqual(['j1']);
  });

  it('ne renvoie pas une relance déjà envoyée (idempotent entre deux cycles)', async () => {
    const id = makeOwner({ ageDays: 1 });
    await runRetentionCycle();
    await runRetentionCycle();
    expect(sentEmails).toHaveLength(1);
    expect(sentTypesFor(id)).toEqual(['j1']);
  });

  it('ne relance jamais un compte déjà activé (first_recipe_at renseigné)', async () => {
    makeOwner({ ageDays: 7, activated: true });
    const r = await runRetentionCycle();
    expect(r.sent).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('exclut les comptes démo / test', async () => {
    makeOwner({ email: 'demo@restosuite.fr', ageDays: 3 });
    makeOwner({ email: 'marc@test.com', ageDays: 3 });
    const r = await runRetentionCycle();
    expect(r.sent).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('ne relance pas un compte trop récent (< 1 jour)', async () => {
    makeOwner({ ageDays: 0 });
    const r = await runRetentionCycle();
    expect(r.sent).toBe(0);
  });

  it('respecte la progression J+1 → J+3 → J+7 (une relance par cycle)', async () => {
    // Compte de 7 jours qui n'a encore rien reçu : un cycle envoie J+1, le
    // suivant J+3, puis J+7 — jamais plusieurs d'un coup.
    const id = makeOwner({ ageDays: 7 });

    await runRetentionCycle();
    expect(sentTypesFor(id)).toEqual(['j1']);

    await runRetentionCycle();
    expect(sentTypesFor(id).sort()).toEqual(['j1', 'j3']);

    await runRetentionCycle();
    expect(sentTypesFor(id).sort()).toEqual(['j1', 'j3', 'j7']);

    // Plus rien à envoyer ensuite.
    await runRetentionCycle();
    expect(sentEmails).toHaveLength(3);
  });

  it('la relance J+7 mentionne le nombre de jours restants sur l\'essai', async () => {
    const id = makeOwner({ ageDays: 7 });
    run("INSERT INTO retention_emails_sent (account_id, email_type) VALUES (?, 'j1'), (?, 'j3')", [id, id]);
    await runRetentionCycle();
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].subject).toMatch(/essai gratuit continue/i);
    // 60 - 7 = 53 jours restants.
    expect(sentEmails[0].text).toMatch(/53 jours/);
  });
});

describe('runRetentionCycle — SMTP non configuré', () => {
  it('ne fait rien si les creds SMTP sont absents', async () => {
    const savedEmail = process.env.MERCURIALE_EMAIL;
    delete process.env.MERCURIALE_EMAIL;
    const r = await runRetentionCycle();
    expect(r.reason).toBe('smtp-disabled');
    expect(r.sent).toBe(0);
    process.env.MERCURIALE_EMAIL = savedEmail;
  });
});
