// ═══════════════════════════════════════════
// RestoSuite-branded XLSX helpers
//
// Uses the SheetJS `xlsx` lib bundled at server/package.json. SheetJS Community
// Edition supports cell styles (fills, fonts, alignment) when written via
// XLSX.write(..., { type:'buffer', bookType:'xlsx' }) — but only the
// !cols, !merges and explicit cell .s attributes survive the roundtrip.
//
// We therefore write CELLS as objects {v, t, s?} rather than raw values, and
// set !cols for column widths. Style limitations: SheetJS CE writes the .s
// blocks but Excel sometimes ignores them; LibreOffice and Numbers honour
// them. The visible result with Excel is still correct (just monochrome).
//
// The buffer is streamed to the response with the correct Content-Type so
// browsers download as `.xlsx` directly.
// ═══════════════════════════════════════════

const XLSX = require('xlsx');

const BRAND = {
  ORANGE: 'E8722A',
  WHITE: 'FFFFFF',
  NAVY: '1B2A4A',
  ROW_ALT: 'FAF7F4',
};

const HEADER_STYLE = {
  fill: { fgColor: { rgb: BRAND.ORANGE } },
  font: { color: { rgb: BRAND.WHITE }, bold: true, sz: 11, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
  border: {
    top:    { style: 'thin', color: { rgb: BRAND.ORANGE } },
    bottom: { style: 'thin', color: { rgb: BRAND.ORANGE } },
    left:   { style: 'thin', color: { rgb: BRAND.ORANGE } },
    right:  { style: 'thin', color: { rgb: BRAND.ORANGE } },
  },
};

const TITLE_STYLE = {
  font: { color: { rgb: BRAND.NAVY }, bold: true, sz: 16, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'left' },
};
const SUBTITLE_STYLE = {
  font: { color: { rgb: '6B6B6B' }, sz: 10, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'left' },
};
const TOTAL_STYLE = {
  font: { bold: true, sz: 11, name: 'Calibri' },
  fill: { fgColor: { rgb: 'FFE7D5' } },
};

function safeFilename(s) {
  return String(s || 'export').replace(/[^a-zA-Z0-9.\-_]/g, '-');
}

// Convert cell index (0-based) to A1 letters
function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}
function ref(col, row) { return `${colLetter(col)}${row + 1}`; }

// ─────────────────────────────────────────────────────────────────────────────
// writeBrandedXlsx — single helper for accountant XLSX exports.
//
// res:       Express response
// opts:
//   filename       — suggested download filename
//   sheetName      — Excel sheet tab name (max 31 chars, sanitised)
//   title          — branded H1 in row 1
//   restaurantName — row 2
//   period         — row 3
//   columns        — array of { label, width?, type? ('number'|'date'|'string'), format? }
//   rows           — array of arrays of values (same length as columns)
//   totals         — optional array of cells; final TOTAL row, styled in orange tint
// ─────────────────────────────────────────────────────────────────────────────
function writeBrandedXlsx(res, opts) {
  const {
    filename,
    sheetName = 'Export',
    title = 'Export',
    restaurantName = '',
    period = '',
    columns = [],
    rows = [],
    totals = null,
  } = opts;

  const ws = {};
  let r = 0;

  // ── Row 0: title ──
  ws[ref(0, r)] = { v: 'RestoSuite — ' + title, t: 's', s: TITLE_STYLE };
  r++;
  // ── Row 1: restaurant ──
  ws[ref(0, r)] = { v: restaurantName, t: 's', s: SUBTITLE_STYLE };
  r++;
  // ── Row 2: period ──
  if (period) {
    ws[ref(0, r)] = { v: 'Période : ' + period, t: 's', s: SUBTITLE_STYLE };
    r++;
  }
  // ── Row 3: generated stamp ──
  ws[ref(0, r)] = {
    v: `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    t: 's', s: SUBTITLE_STYLE,
  };
  r++;
  r++; // blank spacer row

  // ── Header row ──
  const headerRow = r;
  for (let c = 0; c < columns.length; c++) {
    ws[ref(c, r)] = { v: columns[c].label, t: 's', s: HEADER_STYLE };
  }
  r++;

  // ── Data rows ──
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (let c = 0; c < row.length; c++) {
      const col = columns[c] || {};
      const v = row[c];
      const cell = {};
      if (v == null) {
        cell.v = '';
        cell.t = 's';
      } else if (col.type === 'number' || typeof v === 'number') {
        cell.v = Number(v) || 0;
        cell.t = 'n';
        if (col.format) cell.z = col.format;
      } else if (col.type === 'date') {
        cell.v = v;
        cell.t = 's';
      } else {
        cell.v = String(v);
        cell.t = 's';
      }
      if (i % 2 === 1) {
        cell.s = { fill: { fgColor: { rgb: BRAND.ROW_ALT } } };
      }
      ws[ref(c, r)] = cell;
    }
    r++;
  }

  // ── Totals row ──
  if (totals && totals.length) {
    for (let c = 0; c < totals.length; c++) {
      const v = totals[c];
      const col = columns[c] || {};
      const cell = { s: TOTAL_STYLE };
      if (v == null) { cell.v = ''; cell.t = 's'; }
      else if (col.type === 'number' || typeof v === 'number') {
        cell.v = Number(v) || 0;
        cell.t = 'n';
        if (col.format) cell.z = col.format;
      } else { cell.v = String(v); cell.t = 's'; }
      ws[ref(c, r)] = cell;
    }
    r++;
  }

  // ── Sheet metadata ──
  const lastCol = Math.max(0, columns.length - 1);
  ws['!ref'] = `A1:${colLetter(lastCol)}${r}`;
  ws['!cols'] = columns.map(c => ({ wch: Math.max(12, c.width || 18) }));
  ws['!rows'] = []; // header heights handled by Excel default
  // Freeze panes below the header row so column titles stay visible while scrolling
  ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };

  // Wrap as workbook
  const safeSheet = sheetName.slice(0, 31).replace(/[\/\\\*\?\[\]:]/g, '-');
  const wb = { SheetNames: [safeSheet], Sheets: { [safeSheet]: ws } };
  wb.Props = {
    Title: title,
    Author: 'RestoSuite',
    Company: restaurantName || 'RestoSuite',
    Application: 'RestoSuite (www.restosuite.fr)',
    CreatedDate: new Date(),
  };

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(filename)}"`);
  res.send(buf);
}

module.exports = {
  BRAND,
  writeBrandedXlsx,
  safeFilename,
};
