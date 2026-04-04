// ═══════════════════════════════════════════
// Utility functions — shared across views
// ═══════════════════════════════════════════

function formatQuantity(qty, unit) {
  if (!qty && qty !== 0) return '—';
  unit = (unit || '').toLowerCase().trim();

  // Grammes → kg
  if ((unit === 'g' || unit === 'gr' || unit === 'grammes') && qty >= 1000) {
    return (qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1) + ' kg';
  }
  // Milligrammes → g
  if (unit === 'mg' && qty >= 1000) {
    return (qty / 1000).toFixed(1) + ' g';
  }
  // Millilitres → L
  if ((unit === 'ml' || unit === 'millilitres') && qty >= 1000) {
    return (qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1) + ' L';
  }
  // Centilitres → L
  if ((unit === 'cl' || unit === 'centilitres') && qty >= 100) {
    return (qty / 100).toFixed(qty % 100 === 0 ? 0 : 1) + ' L';
  }

  // Arrondir les décimales inutiles
  const rounded = Math.round(qty * 100) / 100;
  const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(rounded < 10 ? 1 : 0);
  return display + ' ' + unit;
}
