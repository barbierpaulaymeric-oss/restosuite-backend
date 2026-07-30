'use strict';

/**
 * Contrat /api/ai/parse-voice avec client Gemini MOCKÉ.
 *
 * ai.test.js vérifie le comportement sans clé ; ce fichier vérifie le contrat
 * fonctionnel complet (200 + fiche structurée + enrichissement prix depuis la
 * base du tenant) sans qu'AUCUNE requête réseau ne parte : global.fetch est
 * remplacé par un mock qui renvoie une réponse Gemini canonique.
 *
 * La clé est posée AVANT le require de l'app (ai-core la lit au require) —
 * c'est une valeur factice, jamais utilisée puisque fetch est mocké. Chaque
 * fichier de test a son propre registre de modules Jest, donc cette clé ne
 * fuit pas dans les autres suites.
 */

process.env.GEMINI_API_KEY = 'test-mock-key-jamais-utilisee';

const request = require('supertest');
const app = require('../app');
const { run } = require('../db');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

// Réponse Gemini canonique (JSON-mode) telle que la route l'attend.
// Nom d'ingrédient unique : la base :memory: est seedée avec des ingrédients
// de démo (dont « pommes ») — le test ne doit dépendre que de SA fixture.
const GEMINI_RECIPE = {
  name: 'Tarte aux pommes',
  portions: 4,
  ingredients: [
    { name: 'fruit-contrat-test', gross_quantity: 500, unit: 'g' },
    { name: 'farine-inconnue-test', gross_quantity: 200, unit: 'g' },
  ],
  steps: ['Préparer la pâte', 'Cuire 40 minutes'],
};

function mockGeminiFetch(payload = GEMINI_RECIPE) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  });
}

describe('POST /api/ai/parse-voice — contrat avec Gemini mocké', () => {
  const realFetch = global.fetch;

  beforeAll(() => {
    // Ingrédient existant du tenant 1 → l'enrichissement prix doit matcher.
    run(
      `INSERT INTO ingredients (name, price_per_unit, price_unit, restaurant_id)
       VALUES ('fruit-contrat-test', 2.5, 'kg', 1)`
    );
  });

  afterEach(() => { global.fetch = realFetch; });

  test('200 + fiche structurée + enrichissement prix du tenant', async () => {
    global.fetch = mockGeminiFetch();

    const res = await request(app)
      .post('/api/ai/parse-voice')
      .set(AUTH)
      .send({ text: '500g de pommes et 200g de farine pour 4 personnes' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Tarte aux pommes');
    expect(res.body.portions).toBe(4);
    expect(res.body.ingredients).toHaveLength(2);

    // L'ingrédient connu du tenant est matché et coûté (2.5€/kg × 500g = 1.25€)
    const fruit = res.body.ingredients.find(i => i.name === 'fruit-contrat-test');
    expect(fruit.matched_name).toBe('fruit-contrat-test');
    expect(fruit.estimated_cost).toBeCloseTo(1.25, 2);
    expect(res.body.estimated_total_cost).toBeCloseTo(1.25, 2);
    expect(res.body.estimated_cost_per_portion).toBeCloseTo(0.31, 1);

    // Une seule « requête » Gemini, vers l'API attendue — et via le mock.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });

  test('502 si Gemini renvoie une réponse vide (contrat d\'erreur)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });

    const res = await request(app)
      .post('/api/ai/parse-voice')
      .set(AUTH)
      .send({ text: 'nimporte quoi' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Empty AI response');
  });

  test('400 sans texte — la validation passe avant tout appel', async () => {
    global.fetch = mockGeminiFetch();
    const res = await request(app).post('/api/ai/parse-voice').set(AUTH).send({});
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
