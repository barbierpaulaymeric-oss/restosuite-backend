// ═══════════════════════════════════════════
// Conversion d'unités pour la gestion de stock
// Utilisé par orders.js (déduction stock) et variance.js (analyse)
// ═══════════════════════════════════════════

// Base units: everything converts to grams (mass) or milliliters (volume)
const UNIT_TO_BASE = {
  // Mass → grams
  'g': 1,
  'kg': 1000,
  'mg': 0.001,
  // Volume → milliliters
  'ml': 1,
  'cl': 10,
  'dl': 100,
  'l': 1000,
  'L': 1000,
  // Count (no conversion)
  'pièce': null,
  'piece': null,
  'pièces': null,
  'pieces': null,
  'unité': null,
  'unite': null,
  'unités': null,
  'unites': null,
  'botte': null,
  'bottes': null,
  'sachet': null,
  'sachets': null,
  'barquette': null,
  'barquettes': null,
  'portions': null,
};

// Group units by type for compatibility check
const UNIT_TYPE = {};
for (const [unit, factor] of Object.entries(UNIT_TO_BASE)) {
  if (factor === null) {
    UNIT_TYPE[unit] = 'count';
  } else if (['g', 'kg', 'mg'].includes(unit)) {
    UNIT_TYPE[unit] = 'mass';
  } else {
    UNIT_TYPE[unit] = 'volume';
  }
}

/**
 * Convert a quantity from one unit to another.
 * Returns the converted quantity, or the original quantity if conversion is not possible.
 *
 * @param {number} quantity - The quantity to convert
 * @param {string} fromUnit - Source unit (e.g., 'g', 'kg', 'ml', 'l')
 * @param {string} toUnit - Target unit (e.g., 'g', 'kg', 'ml', 'l')
 * @returns {number} Converted quantity
 */
function convertUnit(quantity, fromUnit, toUnit) {
  if (!fromUnit || !toUnit) return quantity;

  // Normalize unit names (lowercase, trim)
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();

  // Same unit — no conversion needed
  if (from === to) return quantity;

  const fromFactor = UNIT_TO_BASE[from];
  const toFactor = UNIT_TO_BASE[to];

  // If either unit is unknown or a count unit, no conversion possible
  if (fromFactor === undefined || toFactor === undefined) return quantity;
  if (fromFactor === null || toFactor === null) return quantity;

  // Check units are same type (mass↔mass or volume↔volume, not mass↔volume)
  if (UNIT_TYPE[from] !== UNIT_TYPE[to]) return quantity;

  // Convert: source → base → target
  return quantity * fromFactor / toFactor;
}

/**
 * Check if two units are compatible (same type).
 * @param {string} unit1
 * @param {string} unit2
 * @returns {boolean}
 */
function unitsCompatible(unit1, unit2) {
  if (!unit1 || !unit2) return false;
  const u1 = unit1.toLowerCase().trim();
  const u2 = unit2.toLowerCase().trim();
  if (u1 === u2) return true;
  const type1 = UNIT_TYPE[u1];
  const type2 = UNIT_TYPE[u2];
  if (!type1 || !type2) return false;
  return type1 === type2;
}

module.exports = { convertUnit, unitsCompatible };
