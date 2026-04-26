'use strict';

// ═══════════════════════════════════════════
// Parse a supplier mercuriale spreadsheet (.xlsx, .xls, .csv) into a normalized
// item list.
//
// Real-world supplier sheets vary wildly: header row position, column order,
// French vs English labels, comma decimals, currency symbols, etc. We pick a
// header row by keyword match, map known column variants, then iterate the
// remaining rows. Anything we can't make sense of is dropped quietly — the
// supplier reviews everything in the UI before saving.
//
// This module deliberately knows nothing about HTTP, Gemini, or the database.
// PDF extraction lives in the route handler (Gemini Vision); this file only
// handles the deterministic spreadsheet path.
// ═══════════════════════════════════════════

const xlsx = require('xlsx');
const { categorize } = require('./mercuriale-categorize');

const MAX_ITEMS = 2000; // hard cap so a runaway sheet can't spike memory

// Keyword variants per logical column. Lowercase, accent-stripped at compare time.
const COLUMN_KEYWORDS = {
  name: [
    'produit', 'designation', 'libelle', 'nom',
    'article', 'description', 'name', 'item', 'reference',
  ],
  price: [
    'prix', 'tarif', 'price', 'cout', 'pu ht', 'pu', 'p.u.',
    'prix unitaire', 'unit price', 'prix ht',
  ],
  unit: [
    'unite', 'unit', 'cond', 'conditionnement', 'um', 'u.m.',
  ],
  category: [
    'categorie', 'category', 'famille', 'rayon', 'groupe',
  ],
};

function strip(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function isHeaderCell(value, keywords) {
  const v = strip(value);
  if (!v) return false;
  return keywords.some(k => v === k || v.includes(k));
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

// Locate the header row + column mapping in a [row][col] matrix. Scans up to
// the first 20 rows so we tolerate cover sheets or branding banners above the
// actual table.
function findHeader(rows) {
  const limit = Math.min(20, rows.length);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    let nameCol = -1, priceCol = -1, unitCol = -1, categoryCol = -1;
    for (let c = 0; c < row.length; c++) {
      const text = row[c];
      if (text == null || String(text).trim() === '') continue;
      if (nameCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.name)) nameCol = c;
      else if (priceCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.price)) priceCol = c;
      else if (unitCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.unit)) unitCol = c;
      else if (categoryCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.category)) categoryCol = c;
    }
    if (nameCol >= 0 && priceCol >= 0) {
      return { headerRow: r, nameCol, priceCol, unitCol, categoryCol };
    }
  }
  return null;
}

// Read an .xlsx, .xls, or .csv buffer into a normalized item array.
// Synchronous because xlsx (sheetjs) does all parsing in-memory.
function parseXlsxBuffer(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  // header:1 + raw:false coerces every cell to its formatted string, which
  // gives us "12,50 €" instead of a Date or formula object — exactly what
  // parsePrice() expects to clean up.
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false, blankrows: false });
  if (!rows.length) return [];

  const header = findHeader(rows);
  if (!header) return [];

  const items = [];
  for (let r = header.headerRow + 1; r < rows.length && items.length < MAX_ITEMS; r++) {
    const row = rows[r] || [];
    const name = String(row[header.nameCol] == null ? '' : row[header.nameCol]).trim();
    const price = parsePrice(row[header.priceCol]);
    if (!name || price == null) continue;

    const unit = (header.unitCol >= 0 ? String(row[header.unitCol] == null ? '' : row[header.unitCol]).trim() : '') || 'kg';
    const rawCategory = header.categoryCol >= 0
      ? String(row[header.categoryCol] == null ? '' : row[header.categoryCol]).trim()
      : '';
    const category = categorize(name, rawCategory);

    items.push({ name: name.slice(0, 200), category, unit: unit.slice(0, 40), price });
  }
  return items;
}

// Normalize and dedupe an arbitrary array of {name, category, unit, price}
// items. Used by both the spreadsheet path and the Gemini PDF path so the
// output shape going to the review UI is identical.
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
    const category = categorize(name, supplied);
    out.push({
      name: name.slice(0, 200),
      category,
      unit: unit.slice(0, 40),
      price,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

module.exports = { parseXlsxBuffer, normalizeItems, parsePrice, MAX_ITEMS };
