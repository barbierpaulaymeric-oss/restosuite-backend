// ═══════════════════════════════════════════
// RestoSuite-branded PDF helpers (centralised)
//
// All server-generated PDFs go through these helpers so the visual identity
// stays consistent — orange accent, navy primary, logo header, web footer.
//
// PDFKit-Helvetica has no emoji glyphs, so the helpers use letter codes /
// printable shapes (✓, ⚠ via WinAnsi-safe characters) — never emoji. Callers
// that want status indicators should use STATUS_LABELS.
// ═══════════════════════════════════════════

const path = require('path');
const fs = require('fs');

// ── Brand tokens ────────────────────────────────────────────────────────────
const BRAND = Object.freeze({
  ORANGE: '#E8722A',         // primary accent — calls to action, headers, footer line
  ORANGE_SOFT: '#FFE7D5',    // table-row hover / soft tint
  NAVY: '#1B2A4A',           // section titles
  TEXT: '#1A1A1A',           // body
  MUTED: '#6B6B6B',          // periods, generated-on
  WHITE: '#FFFFFF',
  RULE: '#D8D8D8',
  ALERT: '#D93025',
  OK: '#2D8B55',
});

// A4 in points (PDFKit default)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - 2 * MARGIN;
// "y past which the next row would clobber the footer" — universal pageBreak threshold
const PAGE_BOTTOM = PAGE_H - MARGIN - 28; // reserve 28pt for footer

// ── Logo resolution ─────────────────────────────────────────────────────────
// Resolves once at module load. The 128×128 PNG renders well at 32–48pt.
const LOGO_PATH = (() => {
  const candidates = [
    path.join(__dirname, '..', '..', 'client', 'assets', 'logo-128.png'),
    path.join(__dirname, '..', '..', 'client', 'assets', 'logo-512.png'),
  ];
  for (const p of candidates) {
    try { if (fs.statSync(p).isFile()) return p; } catch {}
  }
  return null;
})();

// ── Helvetica-safe status labels (no emoji) ─────────────────────────────────
const STATUS_LABELS = Object.freeze({
  ok: 'OK',
  alert: 'ALERTE',
  warning: 'AVERT.',
  reception: 'Reception',
  consumption: 'Conso.',
  loss: 'Perte',
  adjustment: 'Ajust.',
  inventory: 'Inv.',
  pending: 'En attente',
  done: 'Fait',
});

// ─────────────────────────────────────────────────────────────────────────────
// pdfBrandedHeader — orange accent + logo + title + restaurant + period
// Returns the y-cursor for the next row.
//
// opts: { title, subtitle, restaurantName, period }  — all optional except title
// ─────────────────────────────────────────────────────────────────────────────
function pdfBrandedHeader(doc, opts = {}) {
  const { title, subtitle, restaurantName, period } = opts;
  let y = MARGIN;

  // Logo — leftmost, 36pt square. Skipped silently if asset missing.
  const logoSize = 36;
  let textX = MARGIN;
  if (LOGO_PATH) {
    try {
      doc.image(LOGO_PATH, MARGIN, y, { width: logoSize, height: logoSize });
      textX = MARGIN + logoSize + 12;
    } catch {}
  }

  // RestoSuite wordmark + tagline (right of logo)
  doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND.NAVY);
  doc.text('RestoSuite', textX, y, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(BRAND.MUTED);
  doc.text('La gestion de restaurant moderne', textX, y + 16, { lineBreak: false });

  // Generated-on stamp (right side)
  const stamp = `Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.font('Helvetica').fontSize(8).fillColor(BRAND.MUTED);
  doc.text(stamp, MARGIN, y + 4, { width: CONTENT_W, align: 'right', lineBreak: false });

  y += logoSize + 8;

  // Orange accent line — the strongest brand cue
  doc.rect(MARGIN, y, CONTENT_W, 3).fill(BRAND.ORANGE);
  y += 14;

  // Title (large)
  if (title) {
    doc.font('Helvetica-Bold').fontSize(18).fillColor(BRAND.NAVY);
    doc.text(title, MARGIN, y, { width: CONTENT_W, lineBreak: false });
    y += 24;
  }
  // Subtitle (e.g. restaurant name)
  if (subtitle || restaurantName) {
    doc.font('Helvetica').fontSize(11).fillColor(BRAND.TEXT);
    doc.text(subtitle || restaurantName, MARGIN, y, { width: CONTENT_W, lineBreak: false });
    y += 16;
  }
  if (restaurantName && subtitle && subtitle !== restaurantName) {
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.MUTED);
    doc.text(restaurantName, MARGIN, y, { width: CONTENT_W, lineBreak: false });
    y += 14;
  }
  // Period
  if (period) {
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.MUTED);
    doc.text(period, MARGIN, y, { width: CONTENT_W, lineBreak: false });
    y += 14;
  }

  // Thin separator under the header block
  y += 4;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(0.5).strokeColor(BRAND.RULE).stroke();
  y += 12;

  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// pdfBrandedTableHeader — orange band, white bold text
// columns = [{ label, width, align? }]
// ─────────────────────────────────────────────────────────────────────────────
function pdfBrandedTableHeader(doc, y, columns) {
  const totalW = columns.reduce((a, c) => a + c.width, 0);
  doc.rect(MARGIN, y, totalW, 20).fill(BRAND.ORANGE);
  doc.fillColor(BRAND.WHITE).font('Helvetica-Bold').fontSize(8.5);
  let x = MARGIN;
  for (const col of columns) {
    doc.text(col.label, x + 5, y + 6, {
      width: col.width - 10,
      align: col.align || 'left',
      lineBreak: false,
    });
    x += col.width;
  }
  // Reset fill so caller draws data rows in default text color
  doc.fillColor(BRAND.TEXT);
  return y + 20;
}

// ─────────────────────────────────────────────────────────────────────────────
// pdfBrandedTableRow — uniform body-row renderer with zebra striping
// rowIndex (0-based) drives the alt-row tint.
// ─────────────────────────────────────────────────────────────────────────────
function pdfBrandedTableRow(doc, y, columns, cells, rowIndex = 0, opts = {}) {
  const totalW = columns.reduce((a, c) => a + c.width, 0);
  const rowH = opts.rowHeight || 16;
  const alert = !!opts.alert;

  if (alert) {
    doc.rect(MARGIN, y, totalW, rowH).fill('#FFEBEA');
  } else if (rowIndex % 2 === 1) {
    doc.rect(MARGIN, y, totalW, rowH).fill('#FAF7F4');
  }
  doc.fillColor(alert ? BRAND.ALERT : BRAND.TEXT);
  doc.font('Helvetica').fontSize(8.5);
  let x = MARGIN;
  for (let i = 0; i < cells.length; i++) {
    const col = columns[i];
    doc.text(String(cells[i] == null ? '' : cells[i]), x + 5, y + 4, {
      width: col.width - 10,
      align: col.align || 'left',
      lineBreak: false,
    });
    x += col.width;
  }
  return y + rowH;
}

// ─────────────────────────────────────────────────────────────────────────────
// pdfSection — orange-bar section header (used between mixed-table sections
// of monthly-report.pdf etc.)
// ─────────────────────────────────────────────────────────────────────────────
function pdfSection(doc, title, y) {
  if (y + 26 > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; }
  // Left orange tab + navy title bar
  doc.rect(MARGIN, y, 4, 20).fill(BRAND.ORANGE);
  doc.rect(MARGIN + 4, y, CONTENT_W - 4, 20).fill('#F5F2EE');
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND.NAVY);
  doc.text(title, MARGIN + 12, y + 5, { width: CONTENT_W - 16, lineBreak: false });
  doc.fillColor(BRAND.TEXT);
  return y + 26;
}

function pdfStat(doc, label, value, y, alert) {
  if (y + 14 > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; }
  doc.font('Helvetica').fontSize(9).fillColor(alert ? BRAND.ALERT : BRAND.TEXT);
  doc.text(`• ${label} : `, MARGIN + 6, y + 2, { continued: true, width: CONTENT_W - 12, lineBreak: false });
  doc.font('Helvetica-Bold').text(String(value), { continued: false, lineBreak: false });
  doc.fillColor(BRAND.TEXT);
  return y + 14;
}

function checkPageBreak(doc, y, needed = 18) {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// pdfBrandedFooter — must be called LAST (after doc.bufferedPages is set).
// Walks every page and stamps the footer band in-place.
//
// Caller pattern:
//   const doc = new PDFDocument({ ..., bufferPages: true });
//   ...
//   pdfBrandedFooter(doc, { restaurantName, label });
//   doc.end();
// ─────────────────────────────────────────────────────────────────────────────
function pdfBrandedFooter(doc, opts = {}) {
  const { restaurantName, label } = opts;
  const range = doc.bufferedPageRange();
  const total = range.count;
  const footerY = PAGE_H - 28;

  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    // Thin orange line above the footer
    doc.moveTo(MARGIN, footerY - 6).lineTo(MARGIN + CONTENT_W, footerY - 6)
       .lineWidth(0.75).strokeColor(BRAND.ORANGE).stroke();

    doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.MUTED);
    // Left: brand
    doc.text('Généré par RestoSuite — www.restosuite.fr', MARGIN, footerY,
      { width: CONTENT_W * 0.55, align: 'left', lineBreak: false });
    // Right: page n / total + optional context
    const pageStr = `Page ${i + 1} / ${total}`;
    const contextBits = [];
    if (restaurantName) contextBits.push(restaurantName);
    if (label) contextBits.push(label);
    contextBits.push(pageStr);
    doc.text(contextBits.join('  ·  '), MARGIN + CONTENT_W * 0.45, footerY,
      { width: CONTENT_W * 0.55, align: 'right', lineBreak: false });
  }
}

module.exports = {
  BRAND,
  PAGE_W, PAGE_H, MARGIN, CONTENT_W, PAGE_BOTTOM,
  LOGO_PATH,
  STATUS_LABELS,
  pdfBrandedHeader,
  pdfBrandedTableHeader,
  pdfBrandedTableRow,
  pdfBrandedFooter,
  pdfSection,
  pdfStat,
  checkPageBreak,
};
