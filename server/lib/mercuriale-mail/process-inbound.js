'use strict';

// Pure decision layer for an inbound supplier email.
// Inputs are POJOs (no IMAP/DB) so callers — both the live IMAP poller and
// the unit tests — can exercise the same code path without standing up a
// mailbox or seeding rows.

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

function processInbound({ email, restaurantId, lookupSupplier }) {
  if (!email || typeof email !== 'object') return { ok: false, reason: 'no_email' };
  const att = pickAttachment(email.attachments);
  if (!att) return { ok: false, reason: 'no_attachment' };
  const sender = String(email.from || '').toLowerCase().trim();
  if (!sender) return { ok: false, reason: 'no_sender' };
  const supplier = lookupSupplier(sender, restaurantId);
  if (!supplier || !supplier.id) return { ok: false, reason: 'no_match' };
  let raw;
  try { raw = parseXlsxBuffer(att.content); }
  catch { return { ok: false, reason: 'parse_error' }; }
  const items = normalizeItems(raw);
  if (!items.length) return { ok: false, reason: 'no_items' };
  return { ok: true, supplierId: supplier.id, items };
}

module.exports = { processInbound, pickAttachment };
