'use strict';

// Pure decision layer for an inbound supplier email.
// Inputs are POJOs (no IMAP/DB) so callers — both the live IMAP poller and
// the unit tests — can exercise the same code path without standing up a
// mailbox or seeding rows.
//
// Two resolution modes:
//   • supplierId given         → content match already resolved the supplier
//                                (FoodFlow external_id, Excel "Fournisseur"
//                                column lookup, auto-create). Sender ignored.
//   • supplierId omitted       → legacy sender→suppliers.email lookup via
//                                the lookupSupplier callback.

const { parseXlsxBuffer, normalizeItems } = require('../mercuriale-parse');

const XLSX_EXTS = /\.(xlsx|xls|csv)$/i;

function pickAttachment(attachments) {
  if (!Array.isArray(attachments)) return null;
  for (const a of attachments) {
    if (a && a.filename && XLSX_EXTS.test(a.filename) && Buffer.isBuffer(a.content)) {
      return a;
    }
  }
  return null;
}

function processInbound({ email, restaurantId, lookupSupplier, supplierId } = {}) {
  if (!email || typeof email !== 'object') return { ok: false, reason: 'no_email' };
  const att = pickAttachment(email.attachments);
  if (!att) return { ok: false, reason: 'no_attachment' };

  let resolvedSupplierId = supplierId || null;
  if (!resolvedSupplierId) {
    const sender = String(email.from || '').toLowerCase().trim();
    if (!sender) return { ok: false, reason: 'no_sender' };
    if (typeof lookupSupplier !== 'function') return { ok: false, reason: 'no_lookup' };
    const supplier = lookupSupplier(sender, restaurantId);
    if (!supplier || !supplier.id) return { ok: false, reason: 'no_match' };
    resolvedSupplierId = supplier.id;
  }

  let raw;
  try { raw = parseXlsxBuffer(att.content); }
  catch { return { ok: false, reason: 'parse_error' }; }
  const items = normalizeItems(raw);
  if (!items.length) return { ok: false, reason: 'no_items' };
  return { ok: true, supplierId: resolvedSupplierId, items };
}

module.exports = { processInbound, pickAttachment };
