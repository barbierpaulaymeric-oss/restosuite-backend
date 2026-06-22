'use strict';

// Builds a branded, professional XLSX purchase order. Receives plain DTOs and
// returns a Buffer — no DB, no SMTP.
//
// Uses ExcelJS (not SheetJS CE) because we need two things SheetJS Community
// can't deliver reliably: an embedded logo image and cell styling that Excel
// actually honours. The header row keeps the exact French labels
// ("Référence / Produit / Quantité / Unité / Prix unitaire HT / Total HT") so
// the inbound keyword parser can still re-import the file without special-casing.

const path = require('path');
const ExcelJS = require('exceljs');

// RestoSuite brand palette
const NAVY = 'FF0F2E26';   // headers / titles
const ORANGE = 'FF1F7A4D'; // accents
const WHITE = 'FFFFFFFF';
const ROW_ALT = 'FFFAF7F4'; // zebra striping
const TOTAL_BG = 'FFFCE9DD'; // light orange tint behind total
const GREY = 'FF6B6B6B';
const BORDER = 'FFE2DAD0';

const MONEY_FMT = '#,##0.00" €"';
const QTY_FMT = '0.###';

const LOGO_PATH = path.join(__dirname, '..', '..', '..', 'client', 'assets', 'logo-512.png');

function providerLabel(name) {
  if (name === 'foodflow') return 'FoodFlow ID';
  return `${name} ID`;
}

function thinBorder() {
  const side = { style: 'thin', color: { argb: BORDER } };
  return { top: side, bottom: side, left: side, right: side };
}

async function buildOrderXlsx({ restaurant, supplier, integration, po, items }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RestoSuite';
  wb.company = (restaurant && restaurant.name) || 'RestoSuite';
  const ws = wb.addWorksheet('Commande', {
    views: [{ showGridLines: false }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });

  // ── Logo (floats over cells; never blocks generation if the file is absent) ──
  try {
    const imageId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 58, height: 58 },
      editAs: 'oneCell',
    });
  } catch (_) { /* logo optional */ }

  // ── Title block (to the right of the logo) ──
  ws.mergeCells('B1:F1');
  const titleCell = ws.getCell('B1');
  titleCell.value = 'Bon de commande';
  titleCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  ws.mergeCells('B2:F2');
  const subCell = ws.getCell('B2');
  subCell.value = 'Édité par RestoSuite — www.restosuite.fr';
  subCell.font = { name: 'Calibri', size: 10, color: { argb: ORANGE } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };

  ws.getRow(1).height = 30;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 6; // small spacer under the logo

  // ── Meta block: aligned labels in col A, value merged across B:F so long
  //    restaurant / supplier names are never truncated. ──
  const dateValue = po.sent_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const meta = [
    ['Date', dateValue],
    ['Restaurant', (restaurant && restaurant.name) || ''],
    ['Fournisseur', (supplier && supplier.name) || ''],
    ['Référence', po.reference || ''],
  ];
  if (integration && integration.external_id) {
    meta.push([providerLabel(integration.provider), integration.external_id]);
  }

  let r = 4; // first meta row (rows 1-3 used by header block)
  for (const [label, value] of meta) {
    const labelCell = ws.getCell(`A${r}`);
    labelCell.value = label;
    labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: NAVY } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws.mergeCells(`B${r}:F${r}`);
    const valueCell = ws.getCell(`B${r}`);
    valueCell.value = value;
    valueCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(r).height = 16;
    r++;
  }

  r++; // blank spacer before the table

  // ── Table header ──
  const columns = ['Référence', 'Produit', 'Quantité', 'Unité', 'Prix unitaire HT', 'Total HT'];
  const headerRowIdx = r;
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((label, c) => {
    const cell = headerRow.getCell(c + 1);
    cell.value = label;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle', horizontal: c >= 2 ? 'center' : 'left', wrapText: true };
    cell.border = thinBorder();
  });
  headerRow.height = 22;
  r++;

  // ── Data rows ──
  const list = items || [];
  list.forEach((it, i) => {
    const qty = Number(it.quantity) || 0;
    const unitPrice = Number(it.unit_price) || 0;
    const totalRaw = Number(it.total_price);
    const total = Number.isFinite(totalRaw) ? totalRaw : qty * unitPrice;
    const row = ws.getRow(r);
    const values = [
      it.sku || it.reference || '',
      it.product_name || it.name || '',
      qty,
      it.unit || '',
      unitPrice,
      total,
    ];
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
      cell.border = thinBorder();
      if (c === 2) { cell.numFmt = QTY_FMT; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
      else if (c === 3) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
      else if (c === 4 || c === 5) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }
      else { cell.alignment = { horizontal: 'left', vertical: 'middle' }; }
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT } };
      }
    });
    row.height = 18;
    r++;
  });

  // ── Total row ──
  const totalRow = ws.getRow(r);
  ws.mergeCells(`A${r}:E${r}`);
  const totalLabel = totalRow.getCell(1);
  totalLabel.value = 'Total commande HT';
  totalLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
  totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
  const totalValue = totalRow.getCell(6);
  totalValue.value = Number(po.total_amount) || 0;
  totalValue.numFmt = MONEY_FMT;
  totalValue.font = { name: 'Calibri', size: 11, bold: true, color: { argb: NAVY } };
  totalValue.alignment = { horizontal: 'right', vertical: 'middle' };
  totalValue.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
  // thick top separator across the total row
  const topSep = { top: { style: 'medium', color: { argb: ORANGE } }, bottom: { style: 'thin', color: { argb: BORDER } } };
  for (let c = 1; c <= 6; c++) {
    const cell = totalRow.getCell(c);
    cell.border = Object.assign({}, cell.border, topSep);
  }
  totalRow.height = 22;

  // ── Auto-size columns to their longest content (capped so nothing explodes) ──
  const caps = [
    { min: 12, max: 24 }, // Référence
    { min: 22, max: 48 }, // Produit
    { min: 10, max: 12 }, // Quantité
    { min: 8, max: 12 },  // Unité
    { min: 16, max: 18 }, // Prix unitaire HT
    { min: 14, max: 18 }, // Total HT
  ];
  columns.forEach((label, c) => {
    let longest = label.length;
    for (const it of list) {
      let text;
      if (c === 0) text = String(it.sku || it.reference || '');
      else if (c === 1) text = String(it.product_name || it.name || '');
      else if (c === 2) text = String(Number(it.quantity) || 0);
      else if (c === 3) text = String(it.unit || '');
      else if (c === 4) text = formatMoneyStr(Number(it.unit_price) || 0);
      else text = formatMoneyStr(Number(it.total_price) || (Number(it.quantity) || 0) * (Number(it.unit_price) || 0));
      if (text.length > longest) longest = text.length;
    }
    const { min, max } = caps[c];
    ws.getColumn(c + 1).width = Math.min(max, Math.max(min, longest + 2));
  });

  // Freeze everything above the first data row so headers stay visible
  ws.views = [{ state: 'frozen', ySplit: headerRowIdx, showGridLines: false }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Rough rendered string of a money value ("1234.56 €") for column sizing.
function formatMoneyStr(n) {
  return `${(Number(n) || 0).toFixed(2)} €`;
}

module.exports = { buildOrderXlsx };
