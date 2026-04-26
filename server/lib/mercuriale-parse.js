'use strict';

// ═══════════════════════════════════════════
// Parse a supplier mercuriale Excel file (.xlsx) into a normalized item list.
//
// Real-world supplier sheets vary wildly: header row position, column order,
// French vs English labels, comma decimals, currency symbols, etc. We pick a
// header row by keyword match, map known column variants, then iterate the
// remaining rows. Anything we can't make sense of is dropped quietly — the
// supplier reviews everything in the UI before saving.
//
// This module deliberately knows nothing about HTTP, Gemini, or the database.
// PDF extraction lives in the route handler (Gemini Vision); this file only
// handles the deterministic XLSX path.
// ═══════════════════════════════════════════

const ExcelJS = require('exceljs');
const { categorize } = require('./mercuriale-categorize');

// Keyword variants per logical column. Lowercase, accent-stripped at compare time.
const COLUMN_KEYWORDS = {
  name: [
    'produit', 'designation', 'désignation', 'libelle', 'libellé', 'nom',
    'article', 'description', 'name', 'item', 'reference', 'référence',
  ],
  price: [
    'prix', 'tarif', 'price', 'cout', 'coût', 'pu ht', 'pu', 'p.u.',
    'prix unitaire', 'unit price', 'prix ht',
  ],
  unit: [
    'unite', 'unité', 'unit', 'cond', 'conditionnement', 'um', 'u.m.',
  ],
  category: [
    'categorie', 'catégorie', 'category', 'famille', 'rayon', 'groupe',
  ],
};

function strip(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function isHeaderCell(value, keywords) {
  const v = strip(value);
  if (!v) return false;
  return keywords.some(k => v === strip(k) || v.includes(strip(k)));
}

// Parse a price cell that may be a number, "12,50", "12.50", "12,50 €", etc.
// Returns null when the value clearly isn't a price.
function parsePrice(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 0 ? raw : null;
  const s = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cellText(cell) {
  if (!cell) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    // ExcelJS rich-text / hyperlink / formula objects
    if (Array.isArray(v.richText)) return v.richText.map(p => p.text || '').join('');
    if (typeof v.text === 'string') return v.text;
    if (typeof v.result !== 'undefined') return String(v.result);
    if (typeof v.hyperlink === 'string') return v.text || v.hyperlink;
    return '';
  }
  return String(v);
}

// Locate the header row + column mapping. Scans up to the first 20 rows so we
// tolerate cover sheets or branding banners above the actual table.
function findHeader(worksheet) {
  const limit = Math.min(20, worksheet.rowCount);
  for (let r = 1; r <= limit; r++) {
    const row = worksheet.getRow(r);
    let nameCol = null, priceCol = null, unitCol = null, categoryCol = null;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellText(cell);
      if (!text) return;
      if (nameCol == null && isHeaderCell(text, COLUMN_KEYWORDS.name)) nameCol = colNumber;
      else if (priceCol == null && isHeaderCell(text, COLUMN_KEYWORDS.price)) priceCol = colNumber;
      else if (unitCol == null && isHeaderCell(text, COLUMN_KEYWORDS.unit)) unitCol = colNumber;
      else if (categoryCol == null && isHeaderCell(text, COLUMN_KEYWORDS.category)) categoryCol = colNumber;
    });

    if (nameCol != null && priceCol != null) {
      return { headerRow: r, nameCol, priceCol, unitCol, categoryCol };
    }
  }
  return null;
}

async function parseXlsxBuffer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const header = findHeader(ws);
  if (!header) return [];

  const items = [];
  const start = header.headerRow + 1;
  const end = ws.rowCount;
  for (let r = start; r <= end; r++) {
    const row = ws.getRow(r);
    const name = cellText(row.getCell(header.nameCol)).trim();
    const price = parsePrice(cellText(row.getCell(header.priceCol)));
    if (!name || price == null) continue;

    const unit = (header.unitCol ? cellText(row.getCell(header.unitCol)).trim() : '') || 'kg';
    const rawCategory = header.categoryCol
      ? cellText(row.getCell(header.categoryCol)).trim()
      : '';
    const category = rawCategory || categorize(name);

    items.push({ name, category, unit, price });
  }
  return items;
}

// Normalize and dedupe an arbitrary array of {name, category, unit, price}
// items. Used by both the XLSX path and the Gemini PDF path so the output
// shape going to the review UI is identical.
function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.name || raw.product_name || '').trim();
    const price = parsePrice(raw.price);
    if (!name || price == null) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const unit = String(raw.unit || 'kg').trim() || 'kg';
    const supplied = String(raw.category || '').trim();
    const category = supplied || categorize(name);
    out.push({ name, category, unit, price });
  }
  return out;
}

module.exports = { parseXlsxBuffer, normalizeItems, parsePrice };
