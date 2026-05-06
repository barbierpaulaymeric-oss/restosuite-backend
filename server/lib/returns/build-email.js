'use strict';

// Pure helper: build the supplier-facing French email for a return request.
// No DB access, no transport — caller injects the row + items + restaurant
// + supplier metadata. Tested in server/tests/returns/build-email.test.js.

const REASON_LABELS = {
  qualite: 'Qualité non conforme',
  quantite: 'Erreur de quantité',
  dlc: 'DLC trop courte',
  abime: 'Produit abîmé',
  manquant: 'Produit manquant',
  autre: 'Autre',
};

const TYPE_LABELS = {
  return: 'Retour produit',
  credit: 'Demande d\'avoir',
};

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtQty(qty, unit) {
  const n = Number(qty);
  const v = Number.isFinite(n) ? (Math.round(n * 100) / 100) : qty;
  const u = unit ? ` ${unit}` : '';
  return `${v}${u}`;
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason || 'Autre';
}

function typeLabel(type) {
  return TYPE_LABELS[type] || 'Retour produit';
}

// Restaurant + supplier are plain { name, ... } objects — kept loose so the
// caller doesn't need to load the full row, only the bits we render.
function buildSubject({ request, restaurant }) {
  const ref = request.reference || `RET-${request.id || ''}`;
  const restoName = restaurant && restaurant.name ? restaurant.name : 'restaurant client';
  return `[${typeLabel(request.type)}] ${ref} — ${restoName}`;
}

function buildText({ request, items, restaurant, supplier, deliveryNote }) {
  const ref = request.reference || `RET-${request.id || ''}`;
  const lines = [];
  lines.push(`Bonjour,`);
  lines.push('');
  lines.push(`Nous vous adressons une ${typeLabel(request.type).toLowerCase()} relative à une livraison récente.`);
  lines.push('');
  lines.push(`Restaurant      : ${restaurant && restaurant.name ? restaurant.name : '—'}`);
  lines.push(`Référence       : ${ref}`);
  if (deliveryNote) {
    lines.push(`Bon de livraison: ${deliveryNote.id}${deliveryNote.delivery_date ? ` du ${fmtDate(deliveryNote.delivery_date)}` : ''}`);
  }
  lines.push(`Type de demande : ${typeLabel(request.type)}`);
  lines.push('');
  lines.push('Produits concernés :');
  for (const it of (items || [])) {
    lines.push(`  • ${it.product_name} — ${fmtQty(it.quantity, it.unit)} — ${reasonLabel(it.reason)}${it.comment ? ` (${it.comment})` : ''}`);
  }
  if (request.notes) {
    lines.push('');
    lines.push('Commentaire :');
    lines.push(request.notes);
  }
  lines.push('');
  lines.push('Merci de prendre en charge cette demande dans les meilleurs délais.');
  lines.push('Bien cordialement,');
  lines.push(restaurant && restaurant.name ? restaurant.name : '');
  return lines.filter(l => l !== undefined).join('\n');
}

function buildHtml({ request, items, restaurant, supplier, deliveryNote }) {
  const ref = request.reference || `RET-${request.id || ''}`;
  const itemRows = (items || []).map(it => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${escapeHtml(it.product_name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(fmtQty(it.quantity, it.unit))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${escapeHtml(reasonLabel(it.reason))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280">${escapeHtml(it.comment || '')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px">
  <h2 style="color:#E8722A;margin:0 0 16px">${escapeHtml(typeLabel(request.type))} — ${escapeHtml(ref)}</h2>
  <p>Bonjour,</p>
  <p>Nous vous adressons une <strong>${escapeHtml(typeLabel(request.type).toLowerCase())}</strong> relative à une livraison récente.</p>

  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Restaurant</td><td style="padding:4px 0"><strong>${escapeHtml(restaurant && restaurant.name ? restaurant.name : '—')}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Référence</td><td style="padding:4px 0">${escapeHtml(ref)}</td></tr>
    ${deliveryNote ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Bon de livraison</td><td style="padding:4px 0">N°${escapeHtml(deliveryNote.id)}${deliveryNote.delivery_date ? ` du ${escapeHtml(fmtDate(deliveryNote.delivery_date))}` : ''}</td></tr>` : ''}
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Type</td><td style="padding:4px 0">${escapeHtml(typeLabel(request.type))}</td></tr>
  </table>

  <h3 style="margin:24px 0 8px">Produits concernés</h3>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <thead>
      <tr style="background:#f9fafb">
        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb">Produit</th>
        <th style="text-align:right;padding:8px;border-bottom:2px solid #e5e7eb">Quantité</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb">Motif</th>
        <th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb">Commentaire</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  ${request.notes ? `<h3 style="margin:24px 0 8px">Commentaire</h3><p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:6px">${escapeHtml(request.notes)}</p>` : ''}

  <p style="margin-top:24px">Merci de prendre en charge cette demande dans les meilleurs délais.</p>
  <p>Bien cordialement,<br><strong>${escapeHtml(restaurant && restaurant.name ? restaurant.name : '')}</strong></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#9ca3af;font-size:12px">Email envoyé via RestoSuite</p>
</body></html>`;
}

function buildEmail(opts) {
  return {
    subject: buildSubject(opts),
    text: buildText(opts),
    html: buildHtml(opts),
  };
}

module.exports = {
  REASON_LABELS,
  TYPE_LABELS,
  reasonLabel,
  typeLabel,
  buildSubject,
  buildText,
  buildHtml,
  buildEmail,
};
