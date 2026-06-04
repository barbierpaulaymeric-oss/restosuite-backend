'use strict';

const xlsx = require('xlsx');
const {
  parseRecipeWorkbook,
  parseNumber,
  normalizeUnit,
  splitQuantityUnit,
  parseIngredientCell,
} = require('../lib/recipe-import-parse');

// Build an .xlsx buffer from a 2D array of rows.
function sheetBuffer(rows) {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('recipe-import-parse — number helpers', () => {
  it('parses comma and dot decimals', () => {
    expect(parseNumber('12,50')).toBe(12.5);
    expect(parseNumber('12.50')).toBe(12.5);
    expect(parseNumber('1 234,56')).toBe(1234.56);
    expect(parseNumber('800 g')).toBe(800);
    expect(parseNumber('12,50 €')).toBe(12.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(42)).toBe(42);
  });

  it('normalizes unit aliases to the canonical set', () => {
    expect(normalizeUnit('grammes')).toBe('g');
    expect(normalizeUnit('Kg')).toBe('kg');
    expect(normalizeUnit('litres')).toBe('l');
    expect(normalizeUnit('pcs')).toBe('pièce');
    expect(normalizeUnit('unité')).toBe('pièce');
    expect(normalizeUnit('')).toBe('g'); // fallback
  });

  it('splits a quantity glued to a unit', () => {
    expect(splitQuantityUnit('800 g')).toEqual({ quantity: 800, unit: 'g' });
    expect(splitQuantityUnit('1,5kg')).toEqual({ quantity: 1.5, unit: 'kg' });
    expect(splitQuantityUnit('300')).toEqual({ quantity: 300, unit: null });
  });

  it('parses a free-text ingredient cell', () => {
    const out = parseIngredientCell('Pâte 250g, Pommes 600 g; Sucre 100g');
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ name: 'Pâte', gross_quantity: 250, unit: 'g' });
    expect(out[1]).toMatchObject({ name: 'Pommes', gross_quantity: 600 });
  });
});

describe('recipe-import-parse — Format A (one row per ingredient)', () => {
  const rows = [
    ['Mes fiches techniques'], // banner row above the table — must be skipped
    ['Recette', 'Portions', 'Prix de vente', 'Ingrédient', 'Quantité', 'Unité', 'Coût unitaire'],
    ['Bœuf bourguignon', 4, '18,50', 'Bœuf', '800', 'g', '12,50'],
    ['', '', '', 'Carottes', '300', 'g', '1,20'],
    ['', '', '', 'Vin rouge', '50', 'cl', ''],
    ['Blanquette', 6, '16,00', 'Veau', '1', 'kg', '18,00'],
    ['', '', '', 'Crème', '200', 'ml', ''],
    ['', '', '', '', '', '', ''], // blank spacer row
  ];

  it('groups ingredients under forward-filled recipe names', () => {
    const { recipes, format } = parseRecipeWorkbook(sheetBuffer(rows));
    expect(format).toBe('per-ingredient');
    expect(recipes).toHaveLength(2);

    const boeuf = recipes[0];
    expect(boeuf.name).toBe('Bœuf bourguignon');
    expect(boeuf.portions).toBe(4);
    expect(boeuf.selling_price).toBe(18.5);
    expect(boeuf.ingredients).toHaveLength(3);
    expect(boeuf.ingredients[0]).toMatchObject({ name: 'Bœuf', gross_quantity: 800, unit: 'g', price_per_unit: 12.5 });
    expect(boeuf.ingredients[2]).toMatchObject({ name: 'Vin rouge', gross_quantity: 50, unit: 'cl' });

    const blanquette = recipes[1];
    expect(blanquette.name).toBe('Blanquette');
    expect(blanquette.portions).toBe(6);
    expect(blanquette.ingredients).toHaveLength(2);
  });
});

describe('recipe-import-parse — Format B (free-text ingredients)', () => {
  const rows = [
    ['Nom', 'Portions', 'Prix', 'Ingrédients'],
    ['Tarte tatin', 8, '24', 'Pâte 250g, Pommes 600g, Sucre 100g'],
    ['Soupe de potiron', 4, '7', 'Potiron 800g; Crème 200ml; Bouillon 1l'],
  ];

  it('parses one recipe per row with packed ingredient cells', () => {
    const { recipes, format } = parseRecipeWorkbook(sheetBuffer(rows));
    expect(format).toBe('free-text');
    expect(recipes).toHaveLength(2);
    expect(recipes[0].name).toBe('Tarte tatin');
    expect(recipes[0].portions).toBe(8);
    expect(recipes[0].ingredients).toHaveLength(3);
    expect(recipes[1].ingredients[2]).toMatchObject({ name: 'Bouillon', gross_quantity: 1, unit: 'l' });
  });
});

describe('recipe-import-parse — robustness', () => {
  it('returns a warning when no header is recognized', () => {
    const { recipes, warnings } = parseRecipeWorkbook(sheetBuffer([['foo', 'bar'], ['a', 'b']]));
    expect(recipes).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('flags recipes with no ingredients', () => {
    const rows = [
      ['Recette', 'Portions'],
      ['Café gourmand', 2],
    ];
    const { recipes } = parseRecipeWorkbook(sheetBuffer(rows));
    expect(recipes).toHaveLength(1);
    expect(recipes[0].portions).toBe(2);
    expect(recipes[0].warnings.length).toBeGreaterThan(0);
  });

  it('defaults portions to 1 when absent', () => {
    const rows = [
      ['Recette', 'Ingrédient', 'Quantité', 'Unité'],
      ['Vinaigrette', 'Huile', '100', 'ml'],
    ];
    const { recipes } = parseRecipeWorkbook(sheetBuffer(rows));
    expect(recipes[0].portions).toBe(1);
  });

  it('handles an empty buffer gracefully', () => {
    const { recipes, warnings } = parseRecipeWorkbook(Buffer.from(''));
    expect(recipes).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
