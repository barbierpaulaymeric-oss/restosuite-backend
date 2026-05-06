'use strict';

// Restaurant + supplier identification layer for the email-based mercuriale
// flow. WHO sent the mail is treated as a fallback signal — WHAT's in the
// mail is canonical. FoodFlow (and similar wholesalers) send one shared
// address for many tenants, and end users can also forward their mercuriale
// from a personal mailbox, so sender-only routing is not enough.
//
// We scan, in priority order:
//
//   1. Restaurant NAME (subject / body / Excel banner)        → restaurants.name
//   2. Account EMAIL  (body / Excel banner)                   → accounts.email
//   3. external_id    (FF-XXXX or numeric labelled IDs)       → supplier_integrations
//   4. Supplier NAME  (Excel "Fournisseur" column)            → suppliers.name
//
// All four lookups are passed in by the orchestrator so this module stays
// pure (no DB / no IMAP) and can be unit-tested with simple POJOs.
//
// extractIdentifiers / extractExcelBannerText / extractSupplierNamesFromXlsx
// are also exported so the orchestrator can include them in the unmatched-
// alert email when nothing resolves.

const xlsx = require('xlsx');

const EXTERNAL_ID_RE = /\bFF-[A-Z0-9-]{1,40}\b/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Numeric IDs (3-12 digits) scoped to identifier-like keywords so we don't
// match arbitrary prices/dates. Captures e.g. "référence client : 89764",
// "client 89764", "ID: 89764", "code 89764", "n° 89764".
const NUMERIC_ID_LABEL_RE = /(?:r[ée]f(?:[ée]rence)?(?:\s*client)?|client|identifiant|code|n[o°]|num[ée]ro|\bid\b)\s*[:#=\-]?\s*([0-9]{3,12})\b/gi;

// "Restaurant: X" / "Pour: X" / "Pour X" (no separator) / "Établissement: X".
// The optional separator branch handles inline phrasing like
// "voici la mercuriale pour TestRestoSuite (référence …)" — a colon/dash
// after "pour" is uncommon in natural French.
const NAME_LABEL_RE = /(?:restaurant|client|pour|établissement|etablissement)\s*(?:[:\-]\s*|\s+)([^\n\r,;()]+?)(?=\s*\(|\s*$|\s*[\n\r,;])/gi;

const IGNORED_EMAIL_LOCALPARTS = new Set([
  'mercuriale', 'no-reply', 'noreply', 'do-not-reply', 'donotreply',
  'postmaster', 'mailer-daemon', 'bounce', 'support',
]);

// Header keywords for the supplier-name column in the data table. Lowercase,
// accent-stripped at compare time. "fournisseur" / "supplier" cover the
// FoodFlow + Metro / PassionFroid layouts we've observed.
const SUPPLIER_COLUMN_KEYWORDS = ['fournisseur', 'supplier', 'vendeur'];

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

function stripAccents(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Common stopwords that look like restaurant-name candidates after a "pour"
// label but aren't actually identifiers (e.g. "Pour information", "Pour vous").
// Filtered out to keep matchRestaurant from probing nonsense lookups.
const NAME_STOPWORDS = new Set([
  'information', 'info', 'vous', 'toi', 'tous', 'mémoire', 'memoire',
  'rappel', 'confirmation', 'la semaine', 'cette semaine', 'la livraison',
]);

function extractIdentifiers({ subject, text, html, banner } = {}) {
  const haystack = [subject || '', text || '', stripHtml(html), banner || ''].join('\n');

  const externalIdsAlpha = uniqueUpper(haystack.match(EXTERNAL_ID_RE) || []);
  const externalIdsNumeric = [];
  for (const m of haystack.matchAll(NUMERIC_ID_LABEL_RE)) {
    const digits = (m[1] || '').trim();
    if (digits) externalIdsNumeric.push(digits);
  }
  const externalIds = uniqueUpper([...externalIdsAlpha, ...externalIdsNumeric]);

  const emailsRaw = uniqueLower(haystack.match(EMAIL_RE) || []);
  const emails = emailsRaw.filter(e => {
    const local = e.split('@')[0];
    return !IGNORED_EMAIL_LOCALPARTS.has(local);
  });

  const names = [];
  for (const m of haystack.matchAll(NAME_LABEL_RE)) {
    const candidate = (m[1] || '').trim();
    if (candidate.length < 2 || candidate.length > 120) continue;
    if (NAME_STOPWORDS.has(candidate.toLowerCase())) continue;
    names.push(candidate);
  }

  return {
    externalIds,
    emails,
    names: uniqueTrim(names),
  };
}

function readSheetRows(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return [];
  let wb;
  try {
    wb = xlsx.read(buffer, { type: 'buffer', codepage: 65001 });
  } catch {
    return [];
  }
  const sheetName = wb.SheetNames && wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  try {
    return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false, blankrows: false }) || [];
  } catch {
    return [];
  }
}

function extractExcelBannerText(buffer) {
  const rows = readSheetRows(buffer);
  if (!rows.length) return '';
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

// Find the supplier-name column ("Fournisseur") in the spreadsheet header
// and return distinct non-empty values found in that column. Header is
// scanned in the first 20 rows so cover sheets / banners above the data
// table don't trip detection. Distinct order preserved so the first row's
// value (most common in data dumps) is tried first.
function extractSupplierNamesFromXlsx(buffer) {
  const rows = readSheetRows(buffer);
  if (!rows.length) return [];
  const headerLimit = Math.min(20, rows.length);
  let headerRow = -1;
  let supplierCol = -1;
  for (let r = 0; r < headerLimit; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell == null) continue;
      const norm = stripAccents(String(cell)).toLowerCase().trim();
      if (!norm) continue;
      if (SUPPLIER_COLUMN_KEYWORDS.some(k => norm === k || norm.includes(k))) {
        headerRow = r;
        supplierCol = c;
        break;
      }
    }
    if (supplierCol >= 0) break;
  }
  if (supplierCol < 0) return [];
  const out = [];
  const seen = new Set();
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const cell = row[supplierCol];
    if (cell == null) continue;
    const s = String(cell).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.slice(0, 120));
    if (out.length >= 5) break;
  }
  return out;
}

function matchRestaurant({ email, excelBuffer, lookups } = {}) {
  const empty = { externalIds: [], emails: [], names: [], supplierNames: [] };
  if (!email || typeof email !== 'object') {
    return { restaurantId: null, identifiers: empty };
  }
  const lk = lookups || {};
  const banner = excelBuffer ? extractExcelBannerText(excelBuffer) : '';
  const ids = extractIdentifiers({
    subject: email.subject,
    text: email.text,
    html: email.html,
    banner,
  });
  const supplierNames = excelBuffer ? extractSupplierNamesFromXlsx(excelBuffer) : [];
  const identifiers = { ...ids, supplierNames };

  // Priority 1: restaurant name (subject/body/banner) — strongest user-
  // controlled signal.
  if (typeof lk.byName === 'function') {
    for (const nm of identifiers.names) {
      const hit = lk.byName(nm);
      if (hit && hit.restaurantId) {
        return {
          restaurantId: hit.restaurantId,
          matchedBy: 'name',
          matchedValue: nm,
          identifiers,
        };
      }
    }
  }

  // Priority 2: account email — unique across tenants.
  if (typeof lk.byEmail === 'function') {
    for (const em of identifiers.emails) {
      const hit = lk.byEmail(em);
      if (hit && hit.restaurantId) {
        return {
          restaurantId: hit.restaurantId,
          matchedBy: 'email',
          matchedValue: em,
          identifiers,
        };
      }
    }
  }

  // Priority 3: external_id — only present when a supplier_integrations
  // row is configured. Yields supplierId as a bonus when it hits.
  if (typeof lk.byExternalId === 'function') {
    for (const ext of identifiers.externalIds) {
      const hit = lk.byExternalId(ext);
      if (hit && hit.restaurantId) {
        return {
          restaurantId: hit.restaurantId,
          ...(hit.supplierId ? { supplierId: hit.supplierId } : {}),
          matchedBy: 'external_id',
          matchedValue: ext,
          identifiers,
        };
      }
    }
  }

  return { restaurantId: null, identifiers };
}

module.exports = {
  extractIdentifiers,
  extractExcelBannerText,
  extractSupplierNamesFromXlsx,
  matchRestaurant,
};
