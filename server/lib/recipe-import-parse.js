'use strict';

// ═══════════════════════════════════════════
// Parse a chef's recipe spreadsheet (.xlsx, .xls, .csv) into a normalized list
// of fiches techniques, ready for review + import.
//
// Real chef exports vary wildly: a banner/logo above the table, French or
// English headers, comma decimals, units glued to quantities ("800 g"), merged
// recipe-name cells (so the name only appears on the first ingredient row), and
// two broad layouts:
//
//   FORMAT A — one row per ingredient, with a "Recette" column grouping rows:
//     Recette          | Portions | Prix vente | Ingrédient | Quantité | Unité | Coût
//     Boeuf bourguignon | 4       | 18,50      | Boeuf      | 800      | g     | 12,50
//                       |         |            | Carottes   | 300      | g     |
//     Blanquette        | 6       | 16,00      | Veau       | 1        | kg    | 18,00
//
//   FORMAT B — one row per recipe, ingredients packed in a free-text cell:
//     Nom         | Portions | Prix | Ingrédients
//     Tarte tatin | 8        | 24   | Pâte 250g, Pommes 600g, Sucre 100g
//
// We pick a header row by keyword match, decide the layout from which columns
// exist, then build recipes. Anything we can't make sense of is dropped quietly
// or flagged as a warning — the restaurateur reviews everything in the preview
// UI before a single row is written to the database.
//
// This module knows nothing about HTTP or the database — only buffers in,
// plain objects out — so it stays trivially unit-testable. The deterministic
// twin of mercuriale-parse.js.
// ═══════════════════════════════════════════

const xlsx = require('xlsx');

const MAX_RECIPES = 500;          // hard cap so a runaway sheet can't spike memory
const MAX_INGREDIENTS_PER_RECIPE = 100;
const HEADER_SCAN_ROWS = 15;      // tolerate cover/branding rows above the table

// Canonical units the costing engine understands (server/utils/units.js).
// Everything else is normalized into one of these; unknown tokens fall back to
// a sensible default so the recipe still imports and the user can fix it.
const UNIT_ALIASES = {
  g: 'g', gr: 'g', gramme: 'g', grammes: 'g', grs: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  mg: 'mg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml',
  cl: 'cl', centilitre: 'cl', centilitres: 'cl',
  dl: 'dl',
  l: 'l', litre: 'l', litres: 'l', lt: 'l',
  piece: 'pièce', pieces: 'pièce', 'pièce': 'pièce', 'pièces': 'pièce',
  pc: 'pièce', pcs: 'pièce', unite: 'pièce', 'unité': 'pièce', unites: 'pièce', 'unités': 'pièce', u: 'pièce',
  botte: 'botte', bottes: 'botte',
  sachet: 'sachet', sachets: 'sachet',
  barquette: 'barquette', barquettes: 'barquette',
  portion: 'portions', portions: 'portions',
  cas: 'pièce', cac: 'pièce', // cuillères — treated as count, user can refine
};

// Keyword variants per logical column. Compared after lowercasing + accent
// stripping. Substring match, so order matters when one keyword is a prefix of
// another. The recipe-name keys are checked first so a sheet that labels its
// first column "Nom du plat" doesn't lose it to the ingredient pass.
const COLUMN_KEYWORDS = {
  recipe: ['recette', 'nom du plat', 'nom de la recette', 'nom', 'fiche', 'plat', 'preparation', 'menu', 'intitule'],
  ingredient: ['ingredient', 'ingredients', 'denomination', 'designation', 'produit', 'article', 'matiere', 'composant', 'denree'],
  quantity: ['quantite', 'qte', 'qty', 'poids', 'volume', 'quantity'],
  unit: ['unite', 'unit', 'um', 'u.m', 'mesure'],
  cost: ['cout', 'prix unitaire', 'pu ht', 'pu', 'p.u', 'cost', 'prix achat', 'prix d\'achat', 'tarif'],
  portions: ['portions', 'portion', 'couverts', 'nb portions', 'rendement', 'parts', 'pax'],
  selling_price: ['prix de vente', 'prix vente', 'pv ttc', 'pv ht', 'pv', 'selling', 'prix carte'],
  category: ['categorie', 'category', 'famille', 'type', 'rubrique'],
};

function strip(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function cellText(value) {
  return String(value == null ? '' : value).trim();
}

// A header cell matches a logical column when its stripped text equals or
// contains one of the keywords. "selling_price" keywords are checked before
// "cost"/"price" elsewhere because "prix de vente" also contains "prix".
function matchesColumn(value, keywords) {
  const v = strip(value);
  if (!v) return false;
  return keywords.some(k => v === k || v.includes(k));
}

// Parse a number cell tolerant of "0,8", "1.5", "800 g", "12,50 €", thin spaces
// and NBSP thousands separators. Returns null when there's no usable number.
function parseNumber(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw)
    .replace(/[  \s]/g, '')   // strip spaces / NBSP / thin space
    .replace(/[^\d.,-]/g, '');           // drop units, currency, letters
  if (!s) return null;
  // If both separators present, assume the LAST one is the decimal sep.
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parsePositive(raw) {
  const n = parseNumber(raw);
  return n != null && n > 0 ? n : null;
}

// Normalize a unit token to the canonical set. Pulls a trailing unit out of a
// quantity string too (handled by the caller via splitQuantityUnit). Unknown
// tokens fall through as the cleaned lowercased string (≤16 chars) so we never
// silently mislabel — the user sees and can correct it in the preview.
function normalizeUnit(raw, fallback = 'g') {
  const v = strip(raw).replace(/\./g, '');
  if (!v) return fallback;
  if (UNIT_ALIASES[v]) return UNIT_ALIASES[v];
  // token like "g)" or "kg." already stripped; try first word
  const first = v.split(/[\s/]/)[0];
  if (UNIT_ALIASES[first]) return UNIT_ALIASES[first];
  return v.slice(0, 16);
}

// "800 g" / "1,5 kg" / "2pièces" → { quantity, unit } when a unit is glued to
// the number. Returns { quantity, unit:null } when no unit token is found.
function splitQuantityUnit(raw) {
  const s = cellText(raw);
  if (!s) return { quantity: null, unit: null };
  const m = s.match(/^([\d.,\s  ]+)\s*([a-zA-Zàâéèêëïîôûùç.]+)?\s*$/);
  if (!m) return { quantity: parsePositive(s), unit: null };
  const quantity = parsePositive(m[1]);
  const unitTok = m[2] ? normalizeUnit(m[2], null) : null;
  return { quantity, unit: unitTok };
}

// Locate the header row + column map. Scans the first HEADER_SCAN_ROWS rows.
// A valid header must expose at least a recipe OR ingredient column so we don't
// latch onto a stray "Total" banner row. Recipe-level numeric columns
// (portions / selling_price) are optional.
function findHeader(rows) {
  const limit = Math.min(HEADER_SCAN_ROWS, rows.length);
  let best = null;
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    const map = {
      recipeCol: -1, ingredientCol: -1, quantityCol: -1, unitCol: -1,
      costCol: -1, portionsCol: -1, sellingCol: -1, categoryCol: -1,
    };
    // selling_price before cost so "prix de vente" doesn't get eaten by "prix".
    for (let c = 0; c < row.length; c++) {
      const text = row[c];
      if (cellText(text) === '') continue;
      if (map.recipeCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.recipe)) { map.recipeCol = c; continue; }
      if (map.sellingCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.selling_price)) { map.sellingCol = c; continue; }
      if (map.portionsCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.portions)) { map.portionsCol = c; continue; }
      if (map.ingredientCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.ingredient)) { map.ingredientCol = c; continue; }
      if (map.quantityCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.quantity)) { map.quantityCol = c; continue; }
      if (map.unitCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.unit)) { map.unitCol = c; continue; }
      if (map.costCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.cost)) { map.costCol = c; continue; }
      if (map.categoryCol < 0 && matchesColumn(text, COLUMN_KEYWORDS.category)) { map.categoryCol = c; continue; }
    }
    // Fallback: a bare "Prix" / "Tarif" column (common on recipe-per-row sheets)
    // is the dish selling price — but only when it isn't an ingredient-cost
    // column ("prix unitaire", "prix d'achat", "coût"), which the cost pass owns.
    if (map.sellingCol < 0) {
      for (let c = 0; c < row.length; c++) {
        if (c === map.costCol || c === map.recipeCol || c === map.ingredientCol) continue;
        const v = strip(row[c]);
        if (!v) continue;
        if ((v === 'prix' || v === 'tarif' || v === 'prix ttc' || v === 'prix de vente') && !/unit|achat|cout|revient/.test(v)) {
          map.sellingCol = c;
          break;
        }
      }
    }

    const score = Object.values(map).filter(c => c >= 0).length;
    if ((map.recipeCol >= 0 || map.ingredientCol >= 0) && (!best || score > best.score)) {
      best = { headerRow: r, score, ...map };
    }
  }
  return best;
}

function cleanName(raw, max = 200) {
  return cellText(raw).replace(/\s+/g, ' ').slice(0, max);
}

// Parse a free-text ingredient cell ("Pâte 250g, Pommes 600g; Sucre 100 g")
// into structured lines. Splits on comma / semicolon / newline, then peels a
// trailing "<qty><unit>" off each chunk.
function parseIngredientCell(text) {
  const out = [];
  const chunks = cellText(text).split(/[,;\n]+/).map(c => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    // e.g. "Farine 250 g" or "250 g farine" or "Sel"
    const trailing = chunk.match(/^(.*?)[\s:]+([\d.,]+)\s*([a-zA-Zàâéèêëïîôûùç]+)?\.?$/);
    const leading = chunk.match(/^([\d.,]+)\s*([a-zA-Zàâéèêëïîôûùç]+)?\.?\s+(.*)$/);
    let name = chunk, quantity = null, unit = null;
    if (trailing && parsePositive(trailing[2]) != null) {
      name = trailing[1];
      quantity = parsePositive(trailing[2]);
      unit = trailing[3] ? normalizeUnit(trailing[3], null) : null;
    } else if (leading && parsePositive(leading[1]) != null) {
      quantity = parsePositive(leading[1]);
      unit = leading[2] ? normalizeUnit(leading[2], null) : null;
      name = leading[3];
    }
    name = cleanName(name);
    if (!name) continue;
    out.push({ name, gross_quantity: quantity, unit: unit || 'g' });
    if (out.length >= MAX_INGREDIENTS_PER_RECIPE) break;
  }
  return out;
}

function makeRecipe(name) {
  return {
    name: cleanName(name),
    category: null,
    portions: null,
    selling_price: null,
    recipe_type: 'plat',
    ingredients: [],
    warnings: [],
  };
}

// Build recipes from a per-ingredient-row layout (Format A). The recipe name
// forward-fills: a blank name cell means "same recipe as the row above", which
// is how merged cells and most hand-made chef sheets render once flattened.
function parseFormatA(rows, h) {
  const recipes = [];
  const byName = new Map();
  let current = null;

  for (let r = h.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const rawRecipeName = h.recipeCol >= 0 ? cleanName(row[h.recipeCol]) : '';
    const ingName = h.ingredientCol >= 0 ? cleanName(row[h.ingredientCol]) : '';

    // New recipe group whenever a recipe-name cell is present.
    if (rawRecipeName) {
      const key = rawRecipeName.toLowerCase();
      if (byName.has(key)) {
        current = byName.get(key);
      } else {
        if (recipes.length >= MAX_RECIPES) break;
        current = makeRecipe(rawRecipeName);
        byName.set(key, current);
        recipes.push(current);
      }
      // Recipe-level fields read from whichever row carries them.
      if (h.portionsCol >= 0 && current.portions == null) {
        const p = parsePositive(row[h.portionsCol]);
        if (p != null) current.portions = Math.round(p);
      }
      if (h.sellingCol >= 0 && current.selling_price == null) {
        const sp = parsePositive(row[h.sellingCol]);
        if (sp != null) current.selling_price = sp;
      }
      if (h.categoryCol >= 0 && !current.category) {
        const cat = cleanName(row[h.categoryCol], 80);
        if (cat) current.category = cat;
      }
    }

    if (!current) continue; // ingredient rows before any named recipe → skip

    if (!ingName) continue; // blank/spacer row within a recipe group

    if (current.ingredients.length >= MAX_INGREDIENTS_PER_RECIPE) continue;

    const qtyCell = h.quantityCol >= 0 ? row[h.quantityCol] : null;
    const split = splitQuantityUnit(qtyCell);
    let unit = null;
    if (h.unitCol >= 0) unit = normalizeUnit(row[h.unitCol], null);
    if (!unit) unit = split.unit; // unit glued to the quantity cell
    if (!unit) unit = 'g';

    const cost = h.costCol >= 0 ? parsePositive(row[h.costCol]) : null;

    const ing = {
      name: ingName,
      gross_quantity: split.quantity,
      unit,
    };
    if (cost != null) {
      ing.price_per_unit = cost;
      ing.price_unit = unit;
    }
    current.ingredients.push(ing);
  }

  return recipes;
}

// Build recipes from a one-row-per-recipe layout (Format B). Each row is a
// recipe; ingredients live in a free-text cell parsed by parseIngredientCell.
function parseFormatB(rows, h) {
  const recipes = [];
  for (let r = h.headerRow + 1; r < rows.length && recipes.length < MAX_RECIPES; r++) {
    const row = rows[r] || [];
    const name = h.recipeCol >= 0 ? cleanName(row[h.recipeCol]) : '';
    if (!name) continue;
    const recipe = makeRecipe(name);
    if (h.portionsCol >= 0) {
      const p = parsePositive(row[h.portionsCol]);
      if (p != null) recipe.portions = Math.round(p);
    }
    if (h.sellingCol >= 0) {
      const sp = parsePositive(row[h.sellingCol]);
      if (sp != null) recipe.selling_price = sp;
    }
    if (h.categoryCol >= 0) recipe.category = cleanName(row[h.categoryCol], 80) || null;
    if (h.ingredientCol >= 0) recipe.ingredients = parseIngredientCell(row[h.ingredientCol]);
    recipes.push(recipe);
  }
  return recipes;
}

// Finalize: defaults, per-recipe warnings, and drop empties.
function finalizeRecipes(recipes) {
  const out = [];
  for (const recipe of recipes) {
    if (!recipe.name) continue;
    if (recipe.portions == null) recipe.portions = 1;
    // Ingredients with no quantity stay (user fills in preview) but get flagged.
    const missingQty = recipe.ingredients.filter(i => i.gross_quantity == null).length;
    if (recipe.ingredients.length === 0) {
      recipe.warnings.push('Aucun ingrédient détecté — vous pourrez les ajouter après l\'import.');
    } else if (missingQty > 0) {
      recipe.warnings.push(`${missingQty} ingrédient(s) sans quantité — à compléter.`);
    }
    out.push(recipe);
  }
  return out;
}

// Decide the layout from the detected columns and route to the right builder.
// Per-ingredient rows (an ingredient column with NO recipe-name column, or a
// quantity column present) → Format A. A lone recipe column whose neighbour is
// a free-text ingredient list → Format B.
function buildRecipes(rows, h) {
  const hasIngredientCol = h.ingredientCol >= 0;
  const hasQuantityCol = h.quantityCol >= 0;
  const hasRecipeCol = h.recipeCol >= 0;

  // Format B: a recipe-per-row sheet where ingredients are a free-text blob.
  // Heuristic: recipe column present, ingredient column present, but NO explicit
  // quantity/unit columns AND the ingredient cells look multi-item.
  if (hasRecipeCol && hasIngredientCol && !hasQuantityCol && !(h.unitCol >= 0)) {
    let multiItem = 0, sampled = 0;
    for (let r = h.headerRow + 1; r < rows.length && sampled < 8; r++) {
      const cell = cellText((rows[r] || [])[h.ingredientCol]);
      if (!cell) continue;
      sampled++;
      if (/[,;\n]/.test(cell) || /\d+\s*(g|kg|ml|cl|l|pi)/i.test(cell)) multiItem++;
    }
    if (sampled > 0 && multiItem / sampled >= 0.5) {
      return { recipes: parseFormatB(rows, h), format: 'free-text' };
    }
  }

  // Format A covers everything else with an ingredient column. When there's a
  // recipe column it groups by it; when there isn't, the whole sheet is treated
  // as a single recipe whose name we don't know yet.
  if (hasIngredientCol) {
    if (!hasRecipeCol) {
      // Single unnamed recipe — synthesize a placeholder name.
      const single = makeRecipe('Fiche importée');
      single.warnings.push('Nom de recette absent du fichier — renommez la fiche.');
      const tmp = { ...h, recipeCol: -1 };
      // Reuse Format A row loop by faking a current recipe.
      for (let r = h.headerRow + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const ingName = cleanName(row[h.ingredientCol]);
        if (!ingName) continue;
        if (single.ingredients.length >= MAX_INGREDIENTS_PER_RECIPE) break;
        const split = splitQuantityUnit(tmp.quantityCol >= 0 ? row[tmp.quantityCol] : null);
        let unit = tmp.unitCol >= 0 ? normalizeUnit(row[tmp.unitCol], null) : null;
        if (!unit) unit = split.unit || 'g';
        const cost = tmp.costCol >= 0 ? parsePositive(row[tmp.costCol]) : null;
        const ing = { name: ingName, gross_quantity: split.quantity, unit };
        if (cost != null) { ing.price_per_unit = cost; ing.price_unit = unit; }
        single.ingredients.push(ing);
      }
      if (tmp.portionsCol >= 0 || tmp.sellingCol >= 0) {
        for (let r = h.headerRow + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          if (single.portions == null && tmp.portionsCol >= 0) {
            const p = parsePositive(row[tmp.portionsCol]); if (p != null) single.portions = Math.round(p);
          }
          if (single.selling_price == null && tmp.sellingCol >= 0) {
            const sp = parsePositive(row[tmp.sellingCol]); if (sp != null) single.selling_price = sp;
          }
        }
      }
      return { recipes: [single], format: 'single' };
    }
    return { recipes: parseFormatA(rows, h), format: 'per-ingredient' };
  }

  // No ingredient column at all: treat each recipe-name row as a shell.
  if (hasRecipeCol) {
    const recipes = [];
    for (let r = h.headerRow + 1; r < rows.length && recipes.length < MAX_RECIPES; r++) {
      const row = rows[r] || [];
      const name = cleanName(row[h.recipeCol]);
      if (!name) continue;
      const recipe = makeRecipe(name);
      if (h.portionsCol >= 0) { const p = parsePositive(row[h.portionsCol]); if (p != null) recipe.portions = Math.round(p); }
      if (h.sellingCol >= 0) { const sp = parsePositive(row[h.sellingCol]); if (sp != null) recipe.selling_price = sp; }
      if (h.categoryCol >= 0) recipe.category = cleanName(row[h.categoryCol], 80) || null;
      recipes.push(recipe);
    }
    return { recipes, format: 'names-only' };
  }

  return { recipes: [], format: 'unknown' };
}

// ─── Public entry point ───
// Read an .xlsx / .xls / .csv buffer into { recipes, format, warnings }.
// codepage:65001 forces UTF-8 for CSVs (sheetjs defaults to Latin-1, which
// mangles "Désignation"). Throws nothing — returns an empty result with a
// top-level warning when the sheet can't be understood.
function parseRecipeWorkbook(buffer) {
  let wb;
  try {
    wb = xlsx.read(buffer, { type: 'buffer', codepage: 65001 });
  } catch (e) {
    return { recipes: [], format: 'unknown', warnings: ['Fichier illisible ou corrompu.'] };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { recipes: [], format: 'unknown', warnings: ['Le fichier ne contient aucune feuille.'] };
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false, blankrows: false });
  if (!rows.length) return { recipes: [], format: 'unknown', warnings: ['La feuille est vide.'] };

  const header = findHeader(rows);
  if (!header) {
    return {
      recipes: [],
      format: 'unknown',
      warnings: ['Aucun en-tête reconnu. Attendu : une colonne "Recette" et/ou "Ingrédient". Téléchargez le modèle pour le bon format.'],
    };
  }

  const { recipes: raw, format } = buildRecipes(rows, header);
  const recipes = finalizeRecipes(raw);
  const warnings = [];
  if (recipes.length === 0) warnings.push('Aucune fiche n\'a pu être extraite du fichier.');
  return { recipes, format, warnings };
}

module.exports = {
  parseRecipeWorkbook,
  // exported for unit tests
  parseNumber,
  normalizeUnit,
  splitQuantityUnit,
  parseIngredientCell,
  findHeader,
  MAX_RECIPES,
  MAX_INGREDIENTS_PER_RECIPE,
};
