'use strict';

// FoodFlow supplier-side integration adapter.
//
// v1 ships as a file-import shim: fetchMercuriale() expects items[] in the
// caller's payload (provided by the existing /import-mercuriale UI tagged
// with provider=foodflow) and only normalizes them. Swapping to a real HTTP
// client is a single-file change — the route layer never sees the difference.
//
// Contract (every supplier provider must implement):
//   - name:                 string
//   - authenticate({ external_id, credentials? }) → { ok, error? }
//   - fetchMercuriale({ external_id, credentials?, items? }) →
//       { ok, items?: [{name, category, unit, price, sku?, packaging?, tva_rate?}], error? }
//   - postOrder({ external_id, credentials?, order: {reference, total_amount, items} }) →
//       { ok, external_ref?, status?, error? }

const NAME = 'foodflow';
const ID_REGEX = /^FF-[A-Z0-9-]{1,40}$/i;

function authenticate({ external_id }) {
  if (!external_id || typeof external_id !== 'string') {
    return { ok: false, error: 'FoodFlow ID requis' };
  }
  if (!ID_REGEX.test(external_id)) {
    return { ok: false, error: 'FoodFlow ID invalide (format attendu: FF-XXXXX)' };
  }
  return { ok: true };
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const price = Number(raw.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    name,
    category: raw.category ? String(raw.category) : null,
    unit: raw.unit ? String(raw.unit) : 'kg',
    price,
    sku: raw.sku ? String(raw.sku) : null,
    packaging: raw.packaging ? String(raw.packaging) : null,
    tva_rate: Number.isFinite(Number(raw.tva_rate)) ? Number(raw.tva_rate) : null,
  };
}

function fetchMercuriale({ external_id, items }) {
  // v1 file-import shim. v2 will replace this body with:
  //   const r = await fetch(`https://api.foodflow.example/v1/suppliers/${external_id}/catalog`, ...)
  //   if (!r.ok) return { ok: false, error: `FoodFlow ${r.status}` };
  //   const data = await r.json();
  //   return { ok: true, items: data.items.map(normalizeItem).filter(Boolean) };
  if (!external_id) return { ok: false, error: 'FoodFlow ID manquant' };
  if (!Array.isArray(items)) {
    return {
      ok: false,
      error: 'items[] requis (mode file-import). Téléversez la mercuriale via /import-mercuriale.',
    };
  }
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const n = normalizeItem(raw);
    if (!n) continue;
    const key = n.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return { ok: true, items: out };
}

function postOrder({ external_id, order }) {
  if (!external_id) return { ok: false, error: 'FoodFlow ID manquant' };
  if (!order || !order.reference) {
    return { ok: false, error: 'order.reference requis' };
  }
  // v1: synthesize a deterministic external_ref so the UI can display it and
  // any future webhook can correlate on it. v2 will POST to
  // https://api.foodflow.example/v1/orders and use the server-assigned id.
  return {
    ok: true,
    external_ref: `${external_id}/${order.reference}`,
    status: 'pending_dispatch',
  };
}

module.exports = {
  name: NAME,
  authenticate,
  fetchMercuriale,
  postOrder,
};
