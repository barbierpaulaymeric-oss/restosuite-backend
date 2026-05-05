'use strict';

// Pure XLSX builder for an outbound purchase order. Receives plain DTOs and
// returns a Buffer — no DB, no SMTP. Same shape as the inbound parser so the
// receiving end can re-import without special-casing.

const xlsx = require('xlsx');

function providerLabel(name) {
  if (name === 'foodflow') return 'FoodFlow ID';
  return `${name} ID`;
}

function buildOrderXlsx({ restaurant, supplier, integration, po, items }) {
  const meta = [
    ['Bon de commande'],
    ['Date', po.sent_at || new Date().toISOString().slice(0, 19).replace('T', ' ')],
    ['Restaurant', restaurant && restaurant.name],
    ['Fournisseur', supplier && supplier.name],
    ['Référence', po.reference],
  ];
  if (integration && integration.external_id) {
    meta.push([providerLabel(integration.provider), integration.external_id]);
  }
  meta.push([]);
  meta.push(['Référence', 'Produit', 'Quantité', 'Unité', 'Prix unitaire HT', 'Total HT']);
  for (const it of (items || [])) {
    const qty = Number(it.quantity) || 0;
    const unitPrice = Number(it.unit_price) || 0;
    const total = Number(it.total_price);
    meta.push([
      it.sku || it.reference || '',
      it.product_name || it.name || '',
      qty,
      it.unit || '',
      unitPrice,
      Number.isFinite(total) ? total : qty * unitPrice,
    ]);
  }
  meta.push([]);
  meta.push(['', '', '', '', 'Total commande HT', Number(po.total_amount) || 0]);

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(meta);
  xlsx.utils.book_append_sheet(wb, ws, 'Commande');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildOrderXlsx };
