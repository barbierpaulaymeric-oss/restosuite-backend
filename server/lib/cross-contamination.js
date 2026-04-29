// ═══════════════════════════════════════════
// Cross-contamination risk detection.
//
// Heuristic, not regulatory: scans a recipe's ingredient names + their declared
// INCO allergens for combinations that signal a cross-contamination risk during
// prep / service. Returned shape is a plain array of { code, severity, message }.
//
// Severity: 'high' (allergen-claim conflict — e.g. an ingredient named "Pain
// sans gluten" alongside an ingredient that contains gluten); 'medium' (high-
// risk allergen pairs — peanuts + tree nuts, mixed seafood); 'low' (5+ distinct
// allergens — every shared surface is a risk).
//
// Pure function — no DB writes. Caller passes whatever they already have to
// avoid double-loading rows.
// ═══════════════════════════════════════════
'use strict';

// ingredientName → INCO allergen code that the name's "free-from" claim
// implies. e.g. "Pain sans gluten" claims to be free of `gluten`.
const FREE_FROM_PATTERNS = [
  { pattern: /sans\s+gluten|gluten[-\s]?free/i,                 code: 'gluten' },
  { pattern: /sans\s+lactose|lactose[-\s]?free|sans\s+lait|dairy[-\s]?free/i, code: 'lait' },
  { pattern: /sans\s+(noix|arachide|fruits?\s+à\s+coque)|nut[-\s]?free/i, codes: ['fruits_coque', 'arachides'] },
  { pattern: /sans\s+(œuf|oeuf|egg)|egg[-\s]?free/i,            code: 'oeufs' },
  { pattern: /sans\s+(soja|soy)|soy[-\s]?free/i,                code: 'soja' },
  { pattern: /vegan|végan|végétalien/i,                         codes: ['oeufs', 'lait', 'poissons', 'crustaces', 'mollusques'] },
  { pattern: /sans\s+poisson|fish[-\s]?free/i,                  code: 'poissons' },
  { pattern: /sans\s+sésame|sans\s+sesame/i,                    code: 'sesame' },
];

// High-risk allergen pairs: when both are present in the same recipe, the
// kitchen has to manage two distinct contamination vectors at the same station.
const HIGH_RISK_PAIRS = [
  { a: 'arachides',  b: 'fruits_coque', label: 'Arachides + fruits à coque (très haut risque allergique)' },
  { a: 'crustaces',  b: 'mollusques',   label: 'Crustacés + mollusques (poste fruits de mer mixte)' },
  { a: 'poissons',   b: 'crustaces',    label: 'Poissons + crustacés' },
];

const MANY_ALLERGENS_THRESHOLD = 5;

/**
 * Detect cross-contamination risks for a recipe.
 *
 * @param {Object} input
 * @param {Array<{name:string, allergen_codes?:string[]}>} input.ingredients
 *        — flat ingredient list. allergen_codes can be omitted; presence of
 *        the matching code on another ingredient triggers the conflict.
 * @param {Array<{code:string}>} input.recipeAllergens
 *        — allergens already computed for the recipe (pass result of
 *        getRecipeAllergens to avoid re-running it).
 * @returns {Array<{code:string, severity:'high'|'medium'|'low', message:string}>}
 */
function detectCrossContaminationRisks({ ingredients = [], recipeAllergens = [] }) {
  const risks = [];
  const allergenCodes = new Set(
    recipeAllergens.filter(a => a && a.code).map(a => a.code)
  );

  // ── Free-from claim conflicts (severity: high) ─────────────────────────
  for (const ing of ingredients) {
    if (!ing || !ing.name) continue;
    for (const { pattern, code, codes } of FREE_FROM_PATTERNS) {
      if (!pattern.test(ing.name)) continue;
      const claimedFree = codes ? codes : [code];
      for (const c of claimedFree) {
        if (allergenCodes.has(c)) {
          risks.push({
            code: `claim_conflict_${c}`,
            severity: 'high',
            message: `« ${ing.name} » est étiqueté sans ${c}, mais la recette contient un autre ingrédient porteur de cet allergène.`,
          });
        }
      }
    }
  }

  // ── High-risk allergen pairs (severity: medium) ────────────────────────
  for (const pair of HIGH_RISK_PAIRS) {
    if (allergenCodes.has(pair.a) && allergenCodes.has(pair.b)) {
      risks.push({
        code: `pair_${pair.a}_${pair.b}`,
        severity: 'medium',
        message: pair.label,
      });
    }
  }

  // ── Many allergens (severity: low) ─────────────────────────────────────
  if (allergenCodes.size >= MANY_ALLERGENS_THRESHOLD) {
    risks.push({
      code: 'many_allergens',
      severity: 'low',
      message: `${allergenCodes.size} allergènes différents — vigilance accrue lors du dressage.`,
    });
  }

  // Dedupe by code (claim_conflict on the same allergen from multiple
  // ingredients should appear once, not N times).
  const seen = new Set();
  return risks.filter(r => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });
}

module.exports = {
  detectCrossContaminationRisks,
  FREE_FROM_PATTERNS,
  HIGH_RISK_PAIRS,
  MANY_ALLERGENS_THRESHOLD,
};
