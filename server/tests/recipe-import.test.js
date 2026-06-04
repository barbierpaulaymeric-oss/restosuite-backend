'use strict';

const request = require('supertest');
const xlsx = require('xlsx');
const app = require('../app');
const { authHeader } = require('./helpers/auth');
const { get } = require('../db');

const AUTH = authHeader();

function sheetBuffer(rows) {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('Recipe import — auth', () => {
  it('POST /api/recipes/import/preview → 401 without token', async () => {
    const res = await request(app).post('/api/recipes/import/preview');
    expect(res.status).toBe(401);
  });
});

describe('Recipe import — preview', () => {
  it('parses an uploaded xlsx into recipes without writing to the DB', async () => {
    const buf = sheetBuffer([
      ['Recette', 'Portions', 'Prix de vente', 'Ingrédient', 'Quantité', 'Unité', 'Coût unitaire'],
      ['Risotto champignons', 4, '14,50', 'Riz arborio', '320', 'g', '3,20'],
      ['', '', '', 'Champignons', '250', 'g', '4,00'],
      ['', '', '', 'Parmesan', '80', 'g', ''],
    ]);
    const res = await request(app)
      .post('/api/recipes/import/preview')
      .set(AUTH)
      .attach('file', buf, 'fiches.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary.recipe_count).toBe(1);
    expect(res.body.summary.ingredient_count).toBe(3);
    const r = res.body.recipes[0];
    expect(r.name).toBe('Risotto champignons');
    expect(r.portions).toBe(4);
    expect(r.selling_price).toBe(14.5);
    expect(r.ingredients).toHaveLength(3);

    // Nothing should have been persisted by a preview.
    const found = get('SELECT id FROM recipes WHERE name = ? AND restaurant_id = 1', ['Risotto champignons']);
    expect(found).toBeUndefined();
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/recipes/import/preview').set(AUTH);
    expect(res.status).toBe(400);
  });
});

describe('Recipe import — commit', () => {
  it('creates recipes + ingredients from reviewed payload', async () => {
    const payload = {
      recipes: [
        {
          name: 'Import test gratin',
          category: 'Plats',
          portions: 6,
          selling_price: 12,
          recipe_type: 'plat',
          ingredients: [
            { name: 'import test pommes de terre', gross_quantity: 1, unit: 'kg', price_per_unit: 1.2, price_unit: 'kg' },
            { name: 'import test crème', gross_quantity: 200, unit: 'ml' },
            { name: 'no quantity ingredient', gross_quantity: null, unit: 'g' }, // dropped
          ],
        },
        { name: '', portions: 2 }, // invalid — should be reported as failed
      ],
    };

    const res = await request(app).post('/api/recipes/import').set(AUTH).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.recipe_ids).toHaveLength(1);

    // Verify the recipe + ingredients landed, quantity-less line dropped.
    const recipeId = res.body.recipe_ids[0];
    const full = await request(app).get(`/api/recipes/${recipeId}`).set(AUTH);
    expect(full.status).toBe(200);
    expect(full.body.name).toBe('Import test gratin');
    expect(full.body.portions).toBe(6);
    expect(full.body.ingredients).toHaveLength(2);

    // Cleanup
    await request(app).delete(`/api/recipes/${recipeId}`).set(AUTH);
  });

  it('returns 400 with an empty recipe list', async () => {
    const res = await request(app).post('/api/recipes/import').set(AUTH).send({ recipes: [] });
    expect(res.status).toBe(400);
  });
});

describe('Recipe import — template', () => {
  it('GET /api/recipes/import/template → xlsx attachment', async () => {
    const res = await request(app).get('/api/recipes/import/template').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('modele-fiches-techniques');
  });
});
