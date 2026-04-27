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
// Order in COLUMN_KEYWORDS doesn't matter — findHeader() iterates each cell against
// every key. Order DOES matter inside a key list when one keyword is a prefix of
// another (e.g. "ref" vs "reference") since we use substring matching.
const COLUMN_KEYWORDS = {
  // SKU/code first because "reference" can be in either name or sku columns —
  // "code" / "sku" are more specific so we win the tie.
  sku: [
    'sku', 'code article', 'code', 'ref article', 'ref.', 'ref ', 'code produit',
  ],
  name: [
    'produit', 'designation', 'libelle', 'nom',
    'article', 'description', 'name', 'item',
  ],
  price: [
    'prix', 'tarif', 'price', 'cout', 'pu ht', 'pu', 'p.u.',
    'prix unitaire', 'unit price', 'prix ht',
  ],
  unit: [
    'unite', 'unit', 'um', 'u.m.',
  ],
  packaging: [
    'cond', 'conditionnement', 'packaging', 'colis', 'lot',
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
// actual table. SKU is checked before name/category because some sheets label
// the SKU column "reference" — without the priority pass it would steal the
// name column.
function findHeader(rows) {
  const limit = Math.min(20, rows.length);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    let skuCol = -1, nameCol = -1, priceCol = -1, unitCol = -1, packagingCol = -1, categoryCol = -1;
    // First pass: claim SKU column (greedy on the more specific keyword set).
    for (let c = 0; c < row.length; c++) {
      const text = row[c];
      if (text == null || String(text).trim() === '') continue;
      if (skuCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.sku)) { skuCol = c; }
    }
    // Second pass: assign the remaining logical columns, skipping the one
    // already taken by SKU.
    for (let c = 0; c < row.length; c++) {
      if (c === skuCol) continue;
      const text = row[c];
      if (text == null || String(text).trim() === '') continue;
      if (nameCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.name)) nameCol = c;
      else if (priceCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.price)) priceCol = c;
      else if (unitCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.unit)) unitCol = c;
      else if (packagingCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.packaging)) packagingCol = c;
      else if (categoryCol < 0 && isHeaderCell(text, COLUMN_KEYWORDS.category)) categoryCol = c;
    }
    if (nameCol >= 0 && priceCol >= 0) {
      return { headerRow: r, skuCol, nameCol, priceCol, unitCol, packagingCol, categoryCol };
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
    const sku = header.skuCol >= 0
      ? String(row[header.skuCol] == null ? '' : row[header.skuCol]).trim().slice(0, 64) || null
      : null;
    const packaging = header.packagingCol >= 0
      ? String(row[header.packagingCol] == null ? '' : row[header.packagingCol]).trim().slice(0, 80) || null
      : null;

    items.push({
      name: name.slice(0, 200),
      category,
      unit: unit.slice(0, 40),
      price,
      sku,
      packaging,
    });
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
    const skuRaw = raw.sku == null ? '' : String(raw.sku).trim();
    const packagingRaw = raw.packaging == null ? '' : String(raw.packaging).trim();
    // tva_rate has to be a sane number. NaN, negative, > 100 → fall back to 5.5.
    let tva = raw.tva_rate != null ? Number(raw.tva_rate) : 5.5;
    if (!Number.isFinite(tva) || tva < 0 || tva > 100) tva = 5.5;
    out.push({
      name: name.slice(0, 200),
      category,
      unit: unit.slice(0, 40),
      price,
      sku: skuRaw ? skuRaw.slice(0, 64) : null,
      packaging: packagingRaw ? packagingRaw.slice(0, 80) : null,
      tva_rate: tva,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

module.exports = { parseXlsxBuffer, normalizeItems, parsePrice, MAX_ITEMS };
