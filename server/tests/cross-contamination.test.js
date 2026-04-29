'use strict';

// Cross-contamination detection: pure helper unit tests + integration tests
// against /api/allergens/cross-contamination endpoints.

const request = require('supertest');
const app = require('../app');
const { run, get } = require('../db');
const { authHeader } = require('./helpers/auth');
const { detectCrossContaminationRisks } = require('../lib/cross-contamination');

let RID, RID_OTHER;
function tag() { return Math.random().toString(36).slice(2, 8); }

beforeAll(() => {
  const t = tag();
  RID = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`XContam Test ${t}`]
  ).lastInsertRowid;
  RID_OTHER = run(
    `INSERT INTO restaurants (name, type, plan) VALUES (?, 'brasserie', 'pro')`,
    [`XContam Other ${t}`]
  ).lastInsertRowid;
});

function auth(rid = RID) { return authHeader({ id: 1, role: 'gerant', restaurant_id: rid }); }

describe('detectCrossContaminationRisks (pure helper)', () => {
  it('returns empty array when there are no risks', () => {
    const r = detectCrossContaminationRisks({
      ingredients: [{ name: 'Tomate' }, { name: 'Basilic' }],
      recipeAllergens: [],
    });
    expect(r).toEqual([]);
  });

  it('flags free-from claim conflict when "sans gluten" coexists with gluten', () => {
    const r = detectCrossContaminationRisks({
      ingredients: [{ name: 'Pain sans gluten' }, { name: 'Farine de blé' }],
      recipeAllergens: [{ code: 'gluten' }],
    });
    expect(r.some(x => x.code === 'claim_conflict_gluten' && x.severity === 'high')).toBe(true);
  });

  it('flags peanuts + tree nuts as a high-risk pair', () => {
    const r = detectCrossContaminationRisks({
      ingredients: [],
      recipeAllergens: [{ code: 'arachides' }, { code: 'fruits_coque' }],
    });
    expect(r.some(x => x.code === 'pair_arachides_fruits_coque' && x.severity === 'medium')).toBe(true);
  });

  it('flags many-allergens recipes (>=5)', () => {
    const codes = ['gluten', 'lait', 'oeufs', 'poissons', 'soja'];
    const r = detectCrossContaminationRisks({
      ingredients: [],
      recipeAllergens: codes.map(c => ({ code: c })),
    });
    expect(r.some(x => x.code === 'many_allergens' && x.severity === 'low')).toBe(true);
  });

  it('vegan ingredient flags conflict with any animal-origin allergen', () => {
    const r = detectCrossContaminationRisks({
      ingredients: [{ name: 'Plat vegan signature' }],
      recipeAllergens: [{ code: 'lait' }],
    });
    expect(r.some(x => x.code === 'claim_conflict_lait')).toBe(true);
  });

  it('dedupes the same risk code across multiple ingredients', () => {
    const r = detectCrossContaminationRisks({
      ingredients: [{ name: 'Sauce sans gluten' }, { name: 'Pain sans gluten' }],
      recipeAllergens: [{ code: 'gluten' }],
    });
    expect(r.filter(x => x.code === 'claim_conflict_gluten')).toHaveLength(1);
  });
});

describe('GET /api/allergens/cross-contamination/:id (integration)', () => {
  let recipeId, glutenIngId, sansGlutenIngId;

  beforeAll(() => {
    const t = tag();
    glutenIngId = run(
      `INSERT INTO ingredients (name, default_unit, restaurant_id, allergens)
       VALUES (?, 'kg', ?, 'gluten')`,
      [`Farine T55 ${t}`, RID]
    ).lastInsertRowid;
    sansGlutenIngId = run(
      `INSERT INTO ingredients (name, default_unit, restaurant_id, allergens)
       VALUES (?, 'kg', ?, NULL)`,
      [`Pain sans gluten ${t}`, RID]
    ).lastInsertRowid;
    recipeId = run(
      `INSERT INTO recipes (name, portions, restaurant_id) VALUES (?, 1, ?)`,
      [`Sandwich mixte ${t}`, RID]
    ).lastInsertRowid;
    run(
      `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, unit, restaurant_id)
       VALUES (?, ?, 0.1, 'kg', ?)`,
      [recipeId, glutenIngId, RID]
    );
    run(
      `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, unit, restaurant_id)
       VALUES (?, ?, 0.05, 'kg', ?)`,
      [recipeId, sansGlutenIngId, RID]
    );
  });

  it('returns the recipe with detected free-from conflict', async () => {
    const res = await request(app)
      .get(`/api/allergens/cross-contamination/${recipeId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.recipe_id).toBe(recipeId);
    expect(Array.isArray(res.body.risks)).toBe(true);
    expect(res.body.risks.find(r => r.code === 'claim_conflict_gluten')).toBeDefined();
    expect(res.body.max_severity).toBe('high');
  });

  it('returns 404 for cross-tenant recipe access', async () => {
    const res = await request(app)
      .get(`/api/allergens/cross-contamination/${recipeId}`)
      .set(auth(RID_OTHER));
    expect(res.status).toBe(404);
  });

  it('GET /api/allergens/cross-contamination lists all risky recipes for the tenant', async () => {
    const res = await request(app)
      .get('/api/allergens/cross-contamination')
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.find(i => i.recipe_id === recipeId)).toBeDefined();
  });
});

describe('GET /api/allergens/recipes/:id includes cross_contamination_risk summary', () => {
  it('attaches a {count, max_severity, risks} object', async () => {
    const t = tag();
    const ingId = run(
      `INSERT INTO ingredients (name, default_unit, restaurant_id, allergens)
       VALUES (?, 'kg', ?, 'arachide')`,
      [`Cacahuètes ${t}`, RID]
    ).lastInsertRowid;
    const ingId2 = run(
      `INSERT INTO ingredients (name, default_unit, restaurant_id, allergens)
       VALUES (?, 'kg', ?, 'noisettes')`,
      [`Noisettes ${t}`, RID]
    ).lastInsertRowid;
    const recipeId = run(
      `INSERT INTO recipes (name, portions, restaurant_id) VALUES (?, 1, ?)`,
      [`Mix nuts ${t}`, RID]
    ).lastInsertRowid;
    run(`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, unit, restaurant_id)
         VALUES (?, ?, 0.1, 'kg', ?)`, [recipeId, ingId, RID]);
    run(`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, unit, restaurant_id)
         VALUES (?, ?, 0.1, 'kg', ?)`, [recipeId, ingId2, RID]);

    const res = await request(app)
      .get(`/api/allergens/recipes/${recipeId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.cross_contamination_risk).toBeDefined();
    expect(res.body.cross_contamination_risk.count).toBeGreaterThan(0);
    expect(res.body.cross_contamination_risk.max_severity).toBe('medium');
  });
});
