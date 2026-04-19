// HACCP legal temperature thresholds — French regulation
//
// Sources:
//   - Arrêté du 21 décembre 2009 (température de cuisson à cœur ≥ 63°C)
//   - Note DGAL/SDSSA/N2012-8156 (volaille 65°C, viande hachée 70°C)
//   - Règlement CE 853/2004 (produits de la mer ≤ 2°C, surgelés ≤ -18°C)
//   - Arrêté du 21/12/2009 Annexe IV (denrées périssables T°C à réception)
//
// These thresholds are CCP limits ("valeurs cibles") — a value strictly
// outside the threshold is a deviation and must be recorded as non-conforme.

// ─── CCP1 RECEPTION: max allowed temperature at delivery ───
// Key = product_category slug submitted by the UI; value = max temp (°C).
const RECEPTION_MAX_TEMP = Object.freeze({
  viande_fraiche:  4,    // Viande fraîche: ≤ +4°C
  surgeles:       -18,   // Surgelés: ≤ -18°C
  laitiers:        4,    // Produits laitiers: ≤ +4°C
  fruits_legumes:  8,    // Fruits/légumes: ≤ +8°C
  mer:             2,    // Produits de la mer: ≤ +2°C
});

// ─── CCP2 COOKING: min core temperature ───
// Key = product_category slug; value = min target temp (°C).
// Default baseline is 63°C per Arrêté 21/12/2009.
const COOKING_MIN_TEMP = Object.freeze({
  volaille:           65,  // Volaille: DGAL/N2012-8156
  viande_hachee:      70,  // Viande hachée: DGAL/N2012-8156
  remise_temperature: 75,  // Remise en température: HACCP guide pro
});

const COOKING_MIN_BASELINE = 63;

const VALID_RECEPTION_CATEGORIES = Object.freeze(Object.keys(RECEPTION_MAX_TEMP));
const VALID_COOKING_CATEGORIES = Object.freeze([...Object.keys(COOKING_MIN_TEMP), 'standard']);

// Validate reception temperature. `category` is optional; when absent,
// only the basic type/range check runs. Returns { ok: true } or
// { ok: false, error: '...' }.
function validateReceptionTemp(category, temp) {
  if (temp == null) return { ok: true }; // temperature is optional on reception
  if (typeof temp !== 'number' || Number.isNaN(temp)) {
    return { ok: false, error: 'temperature_at_reception doit être un nombre' };
  }
  if (temp < -30 || temp > 60) {
    return { ok: false, error: 'temperature_at_reception doit être entre -30 et +60°C' };
  }
  if (category && Object.prototype.hasOwnProperty.call(RECEPTION_MAX_TEMP, category)) {
    const max = RECEPTION_MAX_TEMP[category];
    if (temp > max) {
      return {
        ok: false,
        error: `Température ${temp}°C non conforme : la catégorie "${category}" exige ≤ ${max}°C (CCP1 réception).`,
      };
    }
  }
  return { ok: true };
}

// Compute the legal minimum cooking target temperature for a given
// product_category. Unknown / missing category → baseline 63°C.
function minCookingTempFor(category) {
  if (category && Object.prototype.hasOwnProperty.call(COOKING_MIN_TEMP, category)) {
    return COOKING_MIN_TEMP[category];
  }
  return COOKING_MIN_BASELINE;
}

// Validate the declared target_temperature against the category's legal
// minimum. Expects target_temperature to already be a finite number in
// an acceptable physical range (0–300°C) — the caller still does that.
function validateCookingTarget(category, target_temperature) {
  const min = minCookingTempFor(category);
  if (target_temperature < min) {
    const ref = category && COOKING_MIN_TEMP[category]
      ? `catégorie "${category}"`
      : 'baseline Arrêté 21/12/2009';
    return {
      ok: false,
      error: `target_temperature doit être ≥ ${min}°C (${ref}).`,
    };
  }
  return { ok: true };
}

module.exports = {
  RECEPTION_MAX_TEMP,
  COOKING_MIN_TEMP,
  COOKING_MIN_BASELINE,
  VALID_RECEPTION_CATEGORIES,
  VALID_COOKING_CATEGORIES,
  validateReceptionTemp,
  minCookingTempFor,
  validateCookingTarget,
};
