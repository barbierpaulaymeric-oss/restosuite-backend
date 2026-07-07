'use strict';

// Guards the CCP1/CCP2 slug↔threshold contract. The reception & cooking bug
// (audit 2026-07-05) was that UI category slugs never matched the legal
// threshold keys, so the checks silently no-op'd. These tests fail loudly if
// a client <select> value ever drifts away from a handled category again.

const {
  RECEPTION_CATEGORY_ALIASES,
  COOKING_CATEGORY_ALIASES,
  validateReceptionTemp,
  validateCookingTarget,
  minCookingTempFor,
} = require('../lib/haccp-thresholds');

// Mirror of client/js/views/haccp-reception.js CATEGORIES (non-empty values).
const UI_RECEPTION_SLUGS = ['viande', 'volaille', 'poisson', 'surgele', 'laitier', 'ovo', 'charcuterie', 'traiteur', 'legume', 'sec', 'autre'];
// Mirror of client/js/views/haccp-cooking.js COOKING_PRODUCT_PRESETS `cat`.
const UI_COOKING_CATS = ['standard', 'volaille', 'viande_hachee', 'remise_temperature'];

describe('HACCP CCP1 reception thresholds', () => {
  test('every UI reception slug resolves in the alias map (no silent no-op)', () => {
    for (const slug of UI_RECEPTION_SLUGS) {
      expect(Object.prototype.hasOwnProperty.call(RECEPTION_CATEGORY_ALIASES, slug)).toBe(true);
    }
  });

  test('surgelé received at +5°C is flagged as a CCP1 deviation (not accepted)', () => {
    const r = validateReceptionTemp('surgele', 5);
    expect(r.ok).toBe(false);
    expect(r.exceeded).toBe(true);
    expect(r.max).toBe(-18);
  });

  test('fresh meat at +10°C is a deviation; at +3°C it is conforme', () => {
    expect(validateReceptionTemp('viande', 10).exceeded).toBe(true);
    expect(validateReceptionTemp('viande', 3).ok).toBe(true);
  });

  test('poisson maps to sea-product limit (≤ +2°C)', () => {
    expect(validateReceptionTemp('poisson', 4).exceeded).toBe(true);
    expect(validateReceptionTemp('poisson', 1).ok).toBe(true);
  });

  test('categories without a legal reception temp (sec/autre) never flag', () => {
    expect(validateReceptionTemp('sec', 25).ok).toBe(true);
    expect(validateReceptionTemp('autre', 25).ok).toBe(true);
  });

  test('bad input still rejects as ok:false without exceeded', () => {
    expect(validateReceptionTemp('viande', 999)).toMatchObject({ ok: false });
    expect(validateReceptionTemp('viande', 999).exceeded).toBeUndefined();
  });
});

describe('HACCP CCP2 cooking thresholds', () => {
  test('every UI cooking preset category resolves in the alias map', () => {
    for (const cat of UI_COOKING_CATS) {
      expect(Object.prototype.hasOwnProperty.call(COOKING_CATEGORY_ALIASES, cat)).toBe(true);
    }
  });

  test('volaille target below the legal 65°C floor is rejected', () => {
    expect(minCookingTempFor('volaille')).toBe(65);
    expect(validateCookingTarget('volaille', 63).ok).toBe(false);
    expect(validateCookingTarget('volaille', 65).ok).toBe(true);
  });

  test('viande hachée requires ≥ 70°C', () => {
    expect(validateCookingTarget('viande_hachee', 68).ok).toBe(false);
    expect(validateCookingTarget('viande_hachee', 70).ok).toBe(true);
  });

  test('standard / unknown category falls back to the 63°C baseline', () => {
    expect(minCookingTempFor('standard')).toBe(63);
    expect(minCookingTempFor(null)).toBe(63);
    expect(validateCookingTarget('standard', 62).ok).toBe(false);
    expect(validateCookingTarget('standard', 63).ok).toBe(true);
  });
});
