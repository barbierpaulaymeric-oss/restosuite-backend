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
// Key = CANONICAL category; value = max temp (°C).
const RECEPTION_MAX_TEMP = Object.freeze({
  viande_fraiche:  4,    // Viande fraîche / charcuterie / traiteur réfrigéré: ≤ +4°C
  surgeles:       -18,   // Surgelés: ≤ -18°C
  laitiers:        4,    // Produits laitiers / ovoproduits: ≤ +4°C
  fruits_legumes:  8,    // Fruits/légumes: ≤ +8°C
  mer:             2,    // Produits de la mer: ≤ +2°C
});

// ─── CCP2 COOKING: min core temperature ───
// Key = CANONICAL category; value = min target temp (°C).
// Default baseline is 63°C per Arrêté 21/12/2009.
const COOKING_MIN_TEMP = Object.freeze({
  volaille:           65,  // Volaille: DGAL/N2012-8156 (min légal 65°C ; 70°C recommandé)
  viande_hachee:      70,  // Viande hachée: DGAL/N2012-8156
  remise_temperature: 75,  // Remise en température: HACCP guide pro
});

const COOKING_MIN_BASELINE = 63;

// ─── UI slug → canonical category ───
// The client forms speak human slugs ("viande", "poisson", …); the legal
// tables above use canonical keys. This map is the single bridge. Every value
// a client <select> can emit MUST resolve here (verified by unit test), else
// the CCP check silently no-ops — the exact regression this fixes.
const RECEPTION_CATEGORY_ALIASES = Object.freeze({
  // canonical keys map to themselves so API callers can pass either form
  viande_fraiche: 'viande_fraiche', surgeles: 'surgeles', laitiers: 'laitiers',
  fruits_legumes: 'fruits_legumes', mer: 'mer',
  // UI slugs (client/js/views/haccp-reception.js)
  viande:      'viande_fraiche',
  volaille:    'viande_fraiche',   // volaille fraîche ≤ +4°C
  poisson:     'mer',
  surgele:     'surgeles',
  laitier:     'laitiers',
  ovo:         'laitiers',         // ovoproduits réfrigérés ≤ +4°C
  charcuterie: 'viande_fraiche',
  traiteur:    'viande_fraiche',   // plats cuisinés réfrigérés ≤ +4°C
  legume:      'fruits_legumes',
  // sec / autre have no legal reception temperature → no CCP check
  sec:   null,
  autre: null,
});

const COOKING_CATEGORY_ALIASES = Object.freeze({
  volaille: 'volaille', viande_hachee: 'viande_hachee', remise_temperature: 'remise_temperature',
  standard: null, // baseline 63°C
});

// UI slugs that a reception <select> is allowed to submit (the ones we handle).
const VALID_RECEPTION_CATEGORIES = Object.freeze(Object.keys(RECEPTION_CATEGORY_ALIASES));
const VALID_COOKING_CATEGORIES = Object.freeze(Object.keys(COOKING_CATEGORY_ALIASES));

function normalizeReceptionCategory(category) {
  if (!category) return null;
  return Object.prototype.hasOwnProperty.call(RECEPTION_CATEGORY_ALIASES, category)
    ? RECEPTION_CATEGORY_ALIASES[category]
    : null;
}

function normalizeCookingCategory(category) {
  if (!category) return null;
  return Object.prototype.hasOwnProperty.call(COOKING_CATEGORY_ALIASES, category)
    ? COOKING_CATEGORY_ALIASES[category]
    : null;
}

// Validate reception temperature. `category` accepts a UI slug or canonical key.
// Returns:
//   { ok: true }                                   — conforme (or no threshold)
//   { ok: false, error }                           — bad input (number/range) → caller should 400
//   { ok: false, exceeded: true, max, error }      — CCP1 deviation → caller records a documented
//                                                     non-conformité (a reception must stay recordable)
function validateReceptionTemp(category, temp) {
  if (temp == null) return { ok: true }; // temperature is optional on reception
  if (typeof temp !== 'number' || Number.isNaN(temp)) {
    return { ok: false, error: 'temperature_at_reception doit être un nombre' };
  }
  if (temp < -30 || temp > 60) {
    return { ok: false, error: 'temperature_at_reception doit être entre -30 et +60°C' };
  }
  const key = normalizeReceptionCategory(category);
  if (key && Object.prototype.hasOwnProperty.call(RECEPTION_MAX_TEMP, key)) {
    const max = RECEPTION_MAX_TEMP[key];
    if (temp > max) {
      return {
        ok: false,
        exceeded: true,
        max,
        canonical: key,
        error: `Température ${temp}°C non conforme : la catégorie "${category}" exige ≤ ${max}°C (CCP1 réception).`,
      };
    }
  }
  return { ok: true };
}

// Compute the legal minimum cooking target for a product_category (UI slug or
// canonical). Unknown / missing category → baseline 63°C.
function minCookingTempFor(category) {
  const key = normalizeCookingCategory(category);
  if (key && Object.prototype.hasOwnProperty.call(COOKING_MIN_TEMP, key)) {
    return COOKING_MIN_TEMP[key];
  }
  return COOKING_MIN_BASELINE;
}

// Validate the declared cooking target against the category's legal minimum.
// Unlike reception, the TARGET is an intention (not a measurement): aiming
// below the legal floor is rejected outright (caller 400s).
function validateCookingTarget(category, target_temperature) {
  const min = minCookingTempFor(category);
  if (target_temperature < min) {
    const key = normalizeCookingCategory(category);
    const ref = key && COOKING_MIN_TEMP[key]
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
  RECEPTION_CATEGORY_ALIASES,
  COOKING_CATEGORY_ALIASES,
  VALID_RECEPTION_CATEGORIES,
  VALID_COOKING_CATEGORIES,
  normalizeReceptionCategory,
  normalizeCookingCategory,
  validateReceptionTemp,
  minCookingTempFor,
  validateCookingTarget,
};
