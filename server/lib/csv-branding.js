// ═══════════════════════════════════════════
// RestoSuite-branded CSV helpers
//
// French-accountant flavour: UTF-8 BOM (so Excel reads accents), `;` separator
// (locale default in fr-FR Excel), CRLF line endings.
//
// Each branded CSV starts with three info rows that identify the restaurant
// and the period at a glance, then a blank row, then the column headers and
// data. The brand "RestoSuite — www.restosuite.fr" is in row 1 so the file
// is recognisable even when copied/forwarded.
// ═══════════════════════════════════════════

const BOM = '﻿';
const SEP = ';';
const EOL = '\r\n';

function csvCell(v) {
  if (v == null) return '';
  let s = String(v);
  // CSV formula injection (CWE-1236): a cell whose first char is = + - @ (or a
  // leading TAB / CR) is executed as a formula by Excel/LibreOffice/Sheets when
  // the file is opened. Tenant free-text (supplier/recipe/ingredient names) flows
  // into these cells, so a low-privilege user could plant =HYPERLINK(...) / DDE.
  // Neutralize by prefixing a single quote — the standard OWASP mitigation.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csvRow(arr) {
  return arr.map(csvCell).join(SEP);
}

function safeFilename(s) {
  return String(s || 'export').replace(/[^a-zA-Z0-9.\-_]/g, '-');
}

// ─────────────────────────────────────────────────────────────────────────────
// writeBrandedCsv — single helper used by every accountant CSV.
//
// res:       Express response
// opts:
//   filename       — suggested download filename (sanitised)
//   title          — descriptive title (e.g. "Historique d'achats")
//   restaurantName — appears in row 2
//   period         — appears in row 3 (e.g. "avril 2026")
//   columns        — array of column header strings
//   rows           — array of arrays (each inner array = a data row, same length as columns)
//   totals         — optional array of cells; rendered as final "TOTAL" row in bold context
// ─────────────────────────────────────────────────────────────────────────────
function writeBrandedCsv(res, opts) {
  const {
    filename,
    title = 'Export',
    restaurantName = '',
    period = '',
    columns = [],
    rows = [],
    totals = null,
  } = opts;

  const lines = [];
  // ── Brand banner (3 lines) ──
  lines.push(csvRow(['RestoSuite — www.restosuite.fr']));
  lines.push(csvRow([title + (restaurantName ? ` — ${restaurantName}` : '')]));
  if (period) lines.push(csvRow([`Période : ${period}`]));
  lines.push(csvRow([`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`]));
  lines.push(''); // blank separator row

  // ── Column headers + data ──
  if (columns.length) lines.push(csvRow(columns));
  for (const row of rows) lines.push(csvRow(row));

  if (totals && totals.length) {
    lines.push(csvRow(totals));
  }

  const body = BOM + lines.join(EOL) + EOL;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(filename)}"`);
  res.send(body);
}

module.exports = {
  BOM, SEP, EOL,
  csvCell, csvRow,
  safeFilename,
  writeBrandedCsv,
};
