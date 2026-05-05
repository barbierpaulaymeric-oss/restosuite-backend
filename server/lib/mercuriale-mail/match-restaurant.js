'use strict';

// Restaurant-identification layer for the email-based mercuriale flow.
//
// FoodFlow (and similar wholesalers) send ONE email from their own address
// containing a mercuriale for a SPECIFIC restaurant client. The sender domain
// alone is not enough to know which restaurant should receive the catalog,
// so we scan the email metadata + Excel banner for any of:
//
//   1. external_id   (FF-XXXX pattern)        → supplier_integrations
//   2. email         (chef@restaurant.fr)     → accounts.email
//   3. name          ("Restaurant: X" label)  → restaurants.name
//
// All three lookups are passed in by the orchestrator so this module stays
// pure (no DB / no IMAP) and can be unit-tested with simple POJOs.

const xlsx = require('xlsx');

const EXTERNAL_ID_RE = /\bFF-[A-Z0-9-]{1,40}\b/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const NAME_LABEL_RE = /(restaurant|client|pour|établissement|etablissement)\s*[:\-]\s*([^\n\r,;]+?)(?:\s*\(|\s*$|\s*[\n\r])/gi;

const IGNORED_EMAIL_LOCALPARTS = new Set([
  'mercuriale', 'no-reply', 'noreply', 'do-not-reply', 'donotreply',
  'postmaster', 'mailer-daemon', 'bounce', 'support',
]);

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[^\S\n]+/g, ' ');
}

function uniqueUpper(arr) {
  return Array.from(new Set(arr.map(s => String(s).toUpperCase().trim()))).filter(Boolean);
}

function uniqueLower(arr) {
  return Array.from(new Set(arr.map(s => String(s).toLowerCase().trim()))).filter(Boolean);
}

function uniqueTrim(arr) {
  return Array.from(new Set(arr.map(s => String(s).trim()))).filter(Boolean);
}

function extractIdentifiers({ subject, text, html, banner } = {}) {
  const haystack = [subject || '', text || '', stripHtml(html), banner || ''].join('\n');

  const externalIds = uniqueUpper(haystack.match(EXTERNAL_ID_RE) || []);

  const emailsRaw = uniqueLower(haystack.match(EMAIL_RE) || []);
  const emails = emailsRaw.filter(e => {
    const local = e.split('@')[0];
    return !IGNORED_EMAIL_LOCALPARTS.has(local);
  });

  const names = [];
  for (const m of haystack.matchAll(NAME_LABEL_RE)) {
    const candidate = (m[2] || '').trim();
    if (candidate.length >= 2 && candidate.length <= 120) names.push(candidate);
  }

  return {
    externalIds,
    emails,
    names: uniqueTrim(names),
  };
}

function extractExcelBannerText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return '';
  let wb;
  try {
    wb = xlsx.read(buffer, { type: 'buffer' });
  } catch {
    return '';
  }
  const sheetName = wb.SheetNames && wb.SheetNames[0];
  if (!sheetName) return '';
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return '';
  let rows;
  try {
    rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false, blankrows: false });
  } catch {
    return '';
  }
  const cells = [];
  const limit = Math.min(rows.length, 8);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    for (const cell of row) {
      if (cell == null) continue;
      const s = String(cell).trim();
      if (s) cells.push(s);
    }
  }
  return cells.join(' ');
}

function matchRestaurant({ email, excelBuffer, lookups } = {}) {
  if (!email || typeof email !== 'object') return null;
  const lk = lookups || {};
  const banner = excelBuffer ? extractExcelBannerText(excelBuffer) : '';
  const ids = extractIdentifiers({
    subject: email.subject,
    text: email.text,
    html: email.html,
    banner,
  });

  if (typeof lk.byExternalId === 'function') {
    for (const ext of ids.externalIds) {
      const hit = lk.byExternalId(ext);
      if (hit && hit.restaurantId) {
        return {
          restaurantId: hit.restaurantId,
          ...(hit.supplierId ? { supplierId: hit.supplierId } : {}),
          matchedBy: 'external_id',
          matchedValue: ext,
        };
      }
    }
  }

  if (typeof lk.byEmail === 'function') {
    for (const em of ids.emails) {
      const hit = lk.byEmail(em);
      if (hit && hit.restaurantId) {
        return {
          restaurantId: hit.restaurantId,
          matchedBy: 'email',
          matchedValue: em,
        };
      }
    }
  }

  if (typeof lk.byName === 'function') {
    for (const nm of ids.names) {
      const hit = lk.byName(nm);
      if (hit && hit.restaurantId) {
        return {
          restaurantId: hit.restaurantId,
          matchedBy: 'name',
          matchedValue: nm,
        };
      }
    }
  }

  return null;
}

module.exports = { extractIdentifiers, extractExcelBannerText, matchRestaurant };
