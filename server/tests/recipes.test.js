'use strict';

const request = require('supertest');
const app = require('../app');
const { authHeader } = require('./helpers/auth');

const AUTH = authHeader();

describe('Recipes — requires auth', () => {
  it('GET /api/recipes → 401 without token', async () => {
    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(401);
  });
});

describe('Recipes — CRUD', () => {
  let recipeId;

  it('GET /api/recipes → 200 with paginated recipes', async () => {
    const res = await request(app).get('/api/recipes').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recipes');
    expect(Array.isArray(res.body.recipes)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });

  it('POST /api/recipes → 201 with recipe data', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({ name: 'Tarte tatin test', category: 'Desserts', portions: 6, selling_price: 8.50 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Tarte tatin test');
    recipeId = res.body.id;
  });

  it('POST /api/recipes → 400 without name', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({ category: 'Desserts', portions: 4 });
    expect(res.status).toBe(400);
  });

  it('GET /api/recipes/:id → 200 with recipe details', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(recipeId);
    // Cost fields are always present (even if 0)
    expect(res.body).toHaveProperty('total_cost');
    expect(res.body).toHaveProperty('cost_per_portion');
    expect(res.body).toHaveProperty('food_cost_percent');
  });

  it('GET /api/recipes/999999 → 404 for unknown recipe', async () => {
    const res = await request(app).get('/api/recipes/999999').set(AUTH);
    expect(res.status).toBe(404);
  });

  it('PUT /api/recipes/:id → 200 updated recipe', async () => {
    const res = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .set(AUTH)
      .send({ name: 'Tarte tatin modifiée', portions: 8 });
    expect(res.status).toBe(200);
    expect(res.body.portions).toBe(8);
  });

  it('DELETE /api/recipes/:id → 200', async () => {
    const res = await request(app).delete(`/api/recipes/${recipeId}`).set(AUTH);
    expect(res.status).toBe(200);
  });

  it('GET deleted recipe → 404', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}`).set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('Recipes — Food Cost Calculation', () => {
  let recipeId;
  let ingredientId;
  let supplierId;

  beforeAll(async () => {
    // Create ingredient
    const ing = await request(app)
      .post('/api/ingredients')
      .set(AUTH)
      .send({ name: 'Beurre coût-test', category: 'Crèmerie', default_unit: 'kg' });
    expect(ing.status).toBe(201);
    ingredientId = ing.body.id;

    // Create supplier
    const sup = await request(app)
      .post('/api/suppliers')
      .set(AUTH)
      .send({ name: 'Fournisseur coût-test', contact: 'Test' });
    expect(sup.status).toBe(201);
    supplierId = sup.body.id;

    // Set supplier price: 5€/kg for this ingredient
    await request(app)
      .post('/api/prices')
      .set(AUTH)
      .send({ ingredient_id: ingredientId, supplier_id: supplierId, price: 5.0, unit: 'kg' });

    // Create recipe with 500g of beurre inline
    const rec = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({
        name: 'Recette coût-test',
        portions: 4,
        selling_price: 10.0,
        ingredients: [
          { ingredient_id: ingredientId, gross_quantity: 500, unit: 'g' }
        ]
      });
    expect(rec.status).toBe(201);
    recipeId = rec.body.id;
  });

  it('GET /api/recipes/:id returns total_cost', async () => {
    const res = await request(app)
      .get(`/api/recipes/${recipeId}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    // 500g at 5€/kg = 2.5€
    expect(res.body.total_cost).toBeCloseTo(2.5, 1);
  });

  it('food_cost_percent = (cost_per_portion / selling_price) * 100', async () => {
    const res = await request(app)
      .get(`/api/recipes/${recipeId}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    // total_cost=2.5, portions=4 → cost_per_portion=0.63 (rounded to 2dp)
    // selling_price=10.0 → food_cost_percent ≈ 6.25%
    expect(res.body.cost_per_portion).toBeCloseTo(0.63, 1);
    expect(res.body.food_cost_percent).toBeCloseTo(6.25, 0);
  });

  it('margin = selling_price - cost_per_portion', async () => {
    const res = await request(app)
      .get(`/api/recipes/${recipeId}`)
      .set(AUTH);
    expect(res.status).toBe(200);
    // margin = 10.0 - 0.63 = 9.37 (rounded)
    expect(res.body.margin).toBeCloseTo(9.37, 1);
  });
});

describe('Recipes — Input Validation', () => {
  it('rejects negative portions', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({ name: 'Bad portions', portions: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects non-integer portions', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({ name: 'Float portions', portions: 1.5 });
    expect(res.status).toBe(400);
  });

  it('rejects negative selling_price', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set(AUTH)
      .send({ name: 'Negative price', selling_price: -5.0 });
    expect(res.status).toBe(400);
  });
});
