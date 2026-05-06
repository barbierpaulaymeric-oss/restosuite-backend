// ═══════════════════════════════════════════
// Accountant-friendly monthly exports — RestoSuite branded
//
// CSV (UTF-8 BOM, ';' separator, French Excel friendly):
//   GET /api/exports/monthly-purchases?month=YYYY-MM
//   GET /api/exports/monthly-food-cost?month=YYYY-MM
//   GET /api/exports/stock-variance?month=YYYY-MM
//
// XLSX (.xlsx, branded, auto-width, frozen header):
//   GET /api/exports/monthly-purchases-xlsx?month=YYYY-MM
//   GET /api/exports/monthly-food-cost-xlsx?month=YYYY-MM
//   GET /api/exports/stock-variance-xlsx?month=YYYY-MM
//
// PDF (orange-accent header, footer, page numbers):
//   GET /api/exports/haccp-summary?month=YYYY-MM
//   GET /api/exports/monthly-report?month=YYYY-MM
//
// Every query is scoped by req.user.restaurant_id; cross-tenant rows are
// impossible by construction.
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get } = require('../db');
const { requireAuth } = require('./auth');
const PDFDocument = require('pdfkit');
const { writeBrandedCsv } = require('../lib/csv-branding');
const { writeBrandedXlsx } = require('../lib/xlsx-branding');
const {
  BRAND, MARGIN, CONTENT_W, PAGE_BOTTOM,
  pdfBrandedHeader, pdfBrandedFooter, pdfBrandedTableHeader, pdfBrandedTableRow,
  pdfSection, pdfStat, checkPageBreak,
} = require('../lib/pdf-branding');

const router = Router();
router.use(requireAuth);

const TVA_RESTAURATION = 0.10; // taux normal restauration sur place

// ─── Month parsing ─────────────────────────────────────────────────────────
function parseMonth(raw) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}$/.test(raw)) return null;
  const [yStr, mStr] = raw.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2100) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: `${monthNames[month - 1]} ${year}`,
    iso: raw,
  };
}

function r2(n) {
  const v = Number(n) || 0;
  return Math.round(v * 100) / 100;
}

function fmtPeriod(month) {
  const fromStr = new Date(month.start).toLocaleDateString('fr-FR');
  const toStr = new Date(new Date(month.end).getTime() - 86400000).toLocaleDateString('fr-FR');
  return `${month.label} (du ${fromStr} au ${toStr})`;
}

// ───────────────────────────────────────────────────────────────────────────
// Data extractors — pure SQL, used by both CSV and XLSX paths
// ───────────────────────────────────────────────────────────────────────────

function purchasesData(rid, month) {
  const orders = all(`
    SELECT po.id, po.reference, po.status, po.total_amount,
           po.sent_at, po.created_at,
           COALESCE(po.sent_at, po.created_at) AS effective_date,
           s.name AS supplier_name, s.id AS supplier_id
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
    WHERE po.restaurant_id = ?
      AND po.status != 'brouillon'
      AND COALESCE(po.sent_at, po.created_at) >= ?
      AND COALESCE(po.sent_at, po.created_at) <  ?
    ORDER BY effective_date ASC, po.id ASC
  `, [rid, rid, month.start, month.end]);

  const rows = [];
  let sumHt = 0, sumTva = 0, sumTtc = 0;

  for (const po of orders) {
    const items = all(`
      SELECT poi.product_name, poi.quantity, poi.unit
      FROM purchase_order_items poi
      WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?
      ORDER BY poi.id ASC
    `, [po.id, rid]);

    const itemSummary = items
      .map(it => `${it.product_name} (${r2(it.quantity)} ${it.unit || ''})`.trim())
      .join(' | ');

    const ht = Number(po.total_amount) || 0;
    const tva = ht * TVA_RESTAURATION;
    const ttc = ht + tva;
    sumHt += ht; sumTva += tva; sumTtc += ttc;

    rows.push([
      po.effective_date ? po.effective_date.slice(0, 10) : '',
      po.supplier_name || `Fournisseur #${po.supplier_id || ''}`,
      po.reference || `PO-${po.id}`,
      po.status,
      itemSummary,
      r2(ht),
      `${(TVA_RESTAURATION * 100).toFixed(0)}%`,
      r2(tva),
      r2(ttc),
    ]);
  }

  const totals = ['TOTAL', '', '', '', '', r2(sumHt), '', r2(sumTva), r2(sumTtc)];
  return { rows, totals, sumHt, sumTva, sumTtc };
}

function foodCostData(rid, month) {
  const sold = all(`
    SELECT r.id AS recipe_id, r.name, r.category, r.selling_price, r.portions,
           SUM(oi.quantity) AS portions_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.restaurant_id = ?
    JOIN recipes r ON r.id = oi.recipe_id AND r.restaurant_id = ?
    WHERE oi.restaurant_id = ?
      AND o.created_at >= ?
      AND o.created_at <  ?
    GROUP BY r.id
    ORDER BY portions_sold DESC, r.name ASC
  `, [rid, rid, rid, month.start, month.end]);

  const rows = [];
  let totalCost = 0, totalRevenue = 0;

  for (const recipe of sold) {
    const ingredients = all(`
      SELECT ri.gross_quantity, ri.unit, i.price_per_unit, i.default_unit
      FROM recipe_ingredients ri
      LEFT JOIN ingredients i ON i.id = ri.ingredient_id AND i.restaurant_id = ?
      WHERE ri.recipe_id = ? AND ri.restaurant_id = ?
    `, [rid, recipe.recipe_id, rid]);

    const portions = Math.max(1, Number(recipe.portions) || 1);
    let recipeCost = 0;
    for (const ri of ingredients) {
      const qty = Number(ri.gross_quantity) || 0;
      const price = Number(ri.price_per_unit) || 0;
      recipeCost += qty * price;
    }
    const unitCost = recipeCost / portions;
    const sellingPrice = Number(recipe.selling_price) || 0;
    const margin = sellingPrice - unitCost;
    const foodCostPct = sellingPrice > 0 ? (unitCost / sellingPrice) * 100 : 0;
    const portionsSold = Number(recipe.portions_sold) || 0;
    const totalCostRow = unitCost * portionsSold;
    const totalRevenueRow = sellingPrice * portionsSold;
    totalCost += totalCostRow;
    totalRevenue += totalRevenueRow;

    rows.push([
      recipe.name,
      recipe.category || '',
      portionsSold,
      r2(unitCost),
      r2(sellingPrice),
      r2(margin),
      r2(foodCostPct),
      r2(totalCostRow),
      r2(totalRevenueRow),
      r2(totalRevenueRow - totalCostRow),
    ]);
  }
  const overallFC = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
  const totals = [
    'TOTAL', '', '', '', '', '',
    r2(overallFC), r2(totalCost), r2(totalRevenue), r2(totalRevenue - totalCost),
  ];
  return { rows, totals, totalCost, totalRevenue };
}

function stockVarianceData(rid, month) {
  const ingredients = all(`
    SELECT i.id, i.name, i.default_unit, i.price_per_unit,
           COALESCE(s.quantity, 0) AS closing_stock
    FROM ingredients i
    LEFT JOIN stock s ON s.ingredient_id = i.id AND s.restaurant_id = ?
    WHERE i.restaurant_id = ?
    ORDER BY i.name ASC
  `, [rid, rid]);

  const movements = all(`
    SELECT ingredient_id, movement_type, SUM(quantity) AS qty
    FROM stock_movements
    WHERE restaurant_id = ?
      AND recorded_at >= ?
      AND recorded_at <  ?
    GROUP BY ingredient_id, movement_type
  `, [rid, month.start, month.end]);

  const byIng = new Map();
  for (const m of movements) {
    const id = m.ingredient_id;
    if (!byIng.has(id)) byIng.set(id, { reception: 0, consumption: 0, loss: 0 });
    const bucket = byIng.get(id);
    const t = (m.movement_type || '').toLowerCase();
    const q = Math.abs(Number(m.qty) || 0);
    if (t === 'reception' || t === 'réception' || t === 'entree' || t === 'entrée' || t === 'in') {
      bucket.reception += q;
    } else if (t === 'perte' || t === 'casse' || t === 'loss' || t === 'waste' || t === 'dechet' || t === 'déchet') {
      bucket.loss += q;
    } else {
      bucket.consumption += q;
    }
  }

  const rows = [];
  for (const ing of ingredients) {
    const m = byIng.get(ing.id) || { reception: 0, consumption: 0, loss: 0 };
    const closing = Number(ing.closing_stock) || 0;
    const opening = closing - m.reception + m.consumption + m.loss;
    const variance = closing - (opening + m.reception - m.consumption - m.loss);
    const unitValue = Number(ing.price_per_unit) || 0;
    const stockValue = closing * unitValue;
    rows.push([
      ing.name,
      ing.default_unit || '',
      r2(opening),
      r2(m.reception),
      r2(m.consumption),
      r2(m.loss),
      r2(closing),
      r2(variance),
      r2(unitValue),
      r2(stockValue),
    ]);
  }
  return { rows };
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Monthly purchases — CSV
// ───────────────────────────────────────────────────────────────────────────
router.get('/monthly-purchases', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};
    const { rows, totals } = purchasesData(rid, month);
    writeBrandedCsv(res, {
      filename: `achats-${month.iso}.csv`,
      title: 'Historique des achats',
      restaurantName: restaurant.name || '',
      period: month.label,
      columns: ['Date', 'Fournisseur', 'N° commande', 'Statut', 'Articles', 'Total HT (€)', 'Taux TVA', 'TVA (€)', 'Total TTC (€)'],
      rows: rows.map(r => [
        r[0], r[1], r[2], r[3], r[4],
        Number(r[5]).toFixed(2), r[6], Number(r[7]).toFixed(2), Number(r[8]).toFixed(2),
      ]),
      totals: [totals[0], '', '', '', '', Number(totals[5]).toFixed(2), '', Number(totals[7]).toFixed(2), Number(totals[8]).toFixed(2)],
    });
  } catch (e) {
    console.error('monthly-purchases export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
  }
});

// 1b. Monthly purchases — XLSX
router.get('/monthly-purchases-xlsx', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};
    const { rows, totals } = purchasesData(rid, month);
    writeBrandedXlsx(res, {
      filename: `achats-${month.iso}.xlsx`,
      sheetName: `Achats ${month.iso}`,
      title: 'Historique des achats',
      restaurantName: restaurant.name || '',
      period: month.label,
      columns: [
        { label: 'Date', width: 12 },
        { label: 'Fournisseur', width: 28 },
        { label: 'N° commande', width: 16 },
        { label: 'Statut', width: 12 },
        { label: 'Articles', width: 50 },
        { label: 'Total HT (€)', width: 14, type: 'number', format: '#,##0.00' },
        { label: 'Taux TVA', width: 10 },
        { label: 'TVA (€)', width: 12, type: 'number', format: '#,##0.00' },
        { label: 'Total TTC (€)', width: 14, type: 'number', format: '#,##0.00' },
      ],
      rows,
      totals,
    });
  } catch (e) {
    console.error('monthly-purchases-xlsx export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Monthly food-cost — CSV
// ───────────────────────────────────────────────────────────────────────────
router.get('/monthly-food-cost', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};
    const { rows, totals } = foodCostData(rid, month);
    writeBrandedCsv(res, {
      filename: `food-cost-${month.iso}.csv`,
      title: 'Food cost — recettes vendues',
      restaurantName: restaurant.name || '',
      period: month.label,
      columns: [
        'Fiche technique', 'Catégorie', 'Portions vendues',
        'Coût ingrédients unitaire (€)', 'Prix vente unitaire (€)',
        'Marge unitaire (€)', 'Food cost %',
        'Coût ingrédients total (€)', 'CA total (€)', 'Marge totale (€)',
      ],
      rows: rows.map(r => [
        r[0], r[1], r[2],
        Number(r[3]).toFixed(2), Number(r[4]).toFixed(2),
        Number(r[5]).toFixed(2), Number(r[6]).toFixed(1),
        Number(r[7]).toFixed(2), Number(r[8]).toFixed(2), Number(r[9]).toFixed(2),
      ]),
      totals: [
        totals[0], '', '', '', '', '',
        Number(totals[6]).toFixed(1),
        Number(totals[7]).toFixed(2),
        Number(totals[8]).toFixed(2),
        Number(totals[9]).toFixed(2),
      ],
    });
  } catch (e) {
    console.error('monthly-food-cost export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
  }
});

// 2b. Monthly food-cost — XLSX
router.get('/monthly-food-cost-xlsx', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};
    const { rows, totals } = foodCostData(rid, month);
    writeBrandedXlsx(res, {
      filename: `food-cost-${month.iso}.xlsx`,
      sheetName: `Food cost ${month.iso}`,
      title: 'Food cost — recettes vendues',
      restaurantName: restaurant.name || '',
      period: month.label,
      columns: [
        { label: 'Fiche technique', width: 32 },
        { label: 'Catégorie', width: 14 },
        { label: 'Portions vendues', width: 14, type: 'number', format: '#,##0' },
        { label: 'Coût ingr. unit. (€)', width: 18, type: 'number', format: '#,##0.00' },
        { label: 'Prix vente unit. (€)', width: 18, type: 'number', format: '#,##0.00' },
        { label: 'Marge unit. (€)', width: 14, type: 'number', format: '#,##0.00' },
        { label: 'Food cost %', width: 12, type: 'number', format: '0.0' },
        { label: 'Coût ingr. total (€)', width: 18, type: 'number', format: '#,##0.00' },
        { label: 'CA total (€)', width: 14, type: 'number', format: '#,##0.00' },
        { label: 'Marge totale (€)', width: 16, type: 'number', format: '#,##0.00' },
      ],
      rows,
      totals,
    });
  } catch (e) {
    console.error('monthly-food-cost-xlsx export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Stock variance — CSV
// ───────────────────────────────────────────────────────────────────────────
router.get('/stock-variance', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};
    const { rows } = stockVarianceData(rid, month);
    writeBrandedCsv(res, {
      filename: `variance-stock-${month.iso}.csv`,
      title: 'Variance de stock',
      restaurantName: restaurant.name || '',
      period: month.label,
      columns: [
        'Ingrédient', 'Unité',
        'Stock initial', 'Réceptions', 'Consommation', 'Pertes', 'Stock final',
        'Variance', 'Valeur unitaire (€)', 'Valeur stock final (€)',
      ],
      rows: rows.map(r => [
        r[0], r[1],
        Number(r[2]).toFixed(3), Number(r[3]).toFixed(3),
        Number(r[4]).toFixed(3), Number(r[5]).toFixed(3),
        Number(r[6]).toFixed(3), Number(r[7]).toFixed(3),
        Number(r[8]).toFixed(4), Number(r[9]).toFixed(2),
      ]),
    });
  } catch (e) {
    console.error('stock-variance export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
  }
});

// 3b. Stock variance — XLSX
router.get('/stock-variance-xlsx', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};
    const { rows } = stockVarianceData(rid, month);
    writeBrandedXlsx(res, {
      filename: `variance-stock-${month.iso}.xlsx`,
      sheetName: `Stock ${month.iso}`,
      title: 'Variance de stock',
      restaurantName: restaurant.name || '',
      period: month.label,
      columns: [
        { label: 'Ingrédient', width: 30 },
        { label: 'Unité', width: 8 },
        { label: 'Stock initial', width: 14, type: 'number', format: '#,##0.000' },
        { label: 'Réceptions', width: 14, type: 'number', format: '#,##0.000' },
        { label: 'Consommation', width: 14, type: 'number', format: '#,##0.000' },
        { label: 'Pertes', width: 12, type: 'number', format: '#,##0.000' },
        { label: 'Stock final', width: 14, type: 'number', format: '#,##0.000' },
        { label: 'Variance', width: 12, type: 'number', format: '#,##0.000' },
        { label: 'Valeur unit. (€)', width: 14, type: 'number', format: '#,##0.0000' },
        { label: 'Valeur stock final (€)', width: 18, type: 'number', format: '#,##0.00' },
      ],
      rows,
    });
  } catch (e) {
    console.error('stock-variance-xlsx export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 4. HACCP summary — branded PDF
// ───────────────────────────────────────────────────────────────────────────
router.get('/haccp-summary', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};

    const tempCount = get(`SELECT COUNT(*) AS n FROM temperature_logs WHERE restaurant_id = ? AND recorded_at >= ? AND recorded_at < ?`, [rid, month.start, month.end]).n;
    const tempAlerts = get(`SELECT COUNT(*) AS n FROM temperature_logs WHERE restaurant_id = ? AND recorded_at >= ? AND recorded_at < ? AND is_alert = 1`, [rid, month.start, month.end]).n;
    const cleaningTasks = get(`SELECT COUNT(*) AS n FROM cleaning_tasks WHERE restaurant_id = ?`, [rid]).n;
    const cleaningCompleted = get(`SELECT COUNT(*) AS n FROM cleaning_logs WHERE restaurant_id = ? AND completed_at >= ? AND completed_at < ?`, [rid, month.start, month.end]).n;
    const ncTotal = get(`SELECT COUNT(*) AS n FROM non_conformities WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ?`, [rid, month.start, month.end]).n;
    const ncCritical = get(`SELECT COUNT(*) AS n FROM non_conformities WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ? AND (severity = 'critique' OR severity = 'majeure')`, [rid, month.start, month.end]).n;
    const ncResolved = get(`SELECT COUNT(*) AS n FROM non_conformities WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ? AND (status = 'resolu' OR status = 'résolu' OR status = 'closed' OR status = 'clos')`, [rid, month.start, month.end]).n;
    const ncDetails = all(`SELECT title, category, severity, status, detected_at FROM non_conformities WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ? ORDER BY detected_at DESC LIMIT 20`, [rid, month.start, month.end]);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
    });
    const filename = `haccp-${(restaurant.name || 'restaurant').replace(/[^a-zA-Z0-9.\-_]/g, '-')}-${month.iso}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    let y = pdfBrandedHeader(doc, {
      title: 'Synthèse HACCP mensuelle',
      restaurantName: restaurant.name || 'Établissement',
      period: fmtPeriod(month),
    });

    y = pdfSection(doc, '1. Relevés de température', y);
    y = pdfStat(doc, 'Nombre de relevés', tempCount, y);
    y = pdfStat(doc, 'Alertes (hors limites)', tempAlerts, y, tempAlerts > 0);
    y = pdfStat(doc, 'Taux de conformité', tempCount > 0 ? `${(((tempCount - tempAlerts) / tempCount) * 100).toFixed(1)} %` : 'n/a', y);
    y += 8;

    y = pdfSection(doc, '2. Plan de nettoyage', y);
    y = pdfStat(doc, 'Tâches planifiées', cleaningTasks, y);
    y = pdfStat(doc, 'Tâches réalisées sur la période', cleaningCompleted, y);
    y += 8;

    y = pdfSection(doc, '3. Non-conformités', y);
    y = pdfStat(doc, 'Total détectées', ncTotal, y);
    y = pdfStat(doc, 'Critiques / majeures', ncCritical, y, ncCritical > 0);
    y = pdfStat(doc, 'Résolues', ncResolved, y);
    y = pdfStat(doc, 'En cours', ncTotal - ncResolved, y, (ncTotal - ncResolved) > 0);
    y += 6;

    if (ncDetails.length > 0) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND.NAVY);
      doc.text('Détail des non-conformités :', MARGIN + 6, y);
      y += 14;
      for (const nc of ncDetails) {
        y = checkPageBreak(doc, y, 14);
        const dt = nc.detected_at ? new Date(nc.detected_at).toLocaleDateString('fr-FR') : '—';
        const sev = nc.severity || 'mineure';
        const isAlert = sev === 'critique' || sev === 'majeure';
        doc.font('Helvetica').fontSize(8).fillColor(isAlert ? BRAND.ALERT : BRAND.TEXT);
        doc.text(
          `${dt} — [${sev}] ${nc.title || '—'} (${nc.category || 'autre'}) · ${nc.status || 'ouvert'}`,
          MARGIN + 12, y, { width: CONTENT_W - 24 }
        );
        y += 12;
      }
    }

    pdfBrandedFooter(doc, { restaurantName: restaurant.name, label: `Synthèse HACCP ${month.label}` });
    doc.end();
  } catch (e) {
    console.error('haccp-summary export error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 5. Monthly all-in-one PDF report (cover + purchases + food-cost + stock
//    variance + invoices + waste + HACCP summary).
// ───────────────────────────────────────────────────────────────────────────
router.get('/monthly-report', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });

  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};

    // ── 1. Purchases summary ─────────────────────────────────────────────
    const purchaseTotals = get(`
      SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS total
      FROM purchase_orders
      WHERE restaurant_id = ?
        AND status != 'brouillon'
        AND COALESCE(sent_at, created_at) >= ?
        AND COALESCE(sent_at, created_at) <  ?
    `, [rid, month.start, month.end]) || { n: 0, total: 0 };

    const topSuppliers = all(`
      SELECT s.name AS supplier_name,
             COUNT(po.id) AS order_count,
             COALESCE(SUM(po.total_amount), 0) AS total_ttc
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
      WHERE po.restaurant_id = ?
        AND po.status != 'brouillon'
        AND COALESCE(po.sent_at, po.created_at) >= ?
        AND COALESCE(po.sent_at, po.created_at) <  ?
      GROUP BY po.supplier_id
      ORDER BY total_ttc DESC
      LIMIT 10
    `, [rid, rid, month.start, month.end]);

    // ── 2. Food cost (top 10 by revenue) ─────────────────────────────────
    let foodCostRows = [];
    let foodCostTotals = { revenue: 0, cost: 0 };
    try {
      const recipes = all(`
        SELECT r.id, r.name, r.category, r.portions, r.selling_price,
               COALESCE(SUM(oi.quantity), 0) AS portions_sold
        FROM recipes r
        LEFT JOIN order_items oi
          ON oi.recipe_id = r.id
         AND oi.restaurant_id = ?
         AND oi.created_at >= ?
         AND oi.created_at <  ?
        WHERE r.restaurant_id = ?
        GROUP BY r.id
        HAVING portions_sold > 0
        ORDER BY portions_sold DESC
      `, [rid, month.start, month.end, rid]);

      for (const recipe of recipes) {
        const ingredients = all(`
          SELECT ri.gross_quantity, i.price_per_unit
          FROM recipe_ingredients ri
          LEFT JOIN ingredients i ON i.id = ri.ingredient_id AND i.restaurant_id = ?
          WHERE ri.recipe_id = ? AND ri.restaurant_id = ?
        `, [rid, recipe.id, rid]);
        const portions = Math.max(1, Number(recipe.portions) || 1);
        let recipeCost = 0;
        for (const ri of ingredients) {
          recipeCost += (Number(ri.gross_quantity) || 0) * (Number(ri.price_per_unit) || 0);
        }
        const unitCost = recipeCost / portions;
        const sellingPrice = Number(recipe.selling_price) || 0;
        const portionsSold = Number(recipe.portions_sold) || 0;
        const totalRev  = sellingPrice * portionsSold;
        const totalCost = unitCost * portionsSold;
        foodCostRows.push({
          name: recipe.name,
          portions_sold: portionsSold,
          unit_cost: unitCost,
          selling_price: sellingPrice,
          food_cost_pct: sellingPrice > 0 ? (unitCost / sellingPrice) * 100 : 0,
          total_revenue: totalRev,
        });
        foodCostTotals.revenue += totalRev;
        foodCostTotals.cost    += totalCost;
      }
      foodCostRows.sort((a, b) => b.total_revenue - a.total_revenue);
      foodCostRows = foodCostRows.slice(0, 10);
    } catch {
      foodCostRows = [];
    }
    const overallFC = foodCostTotals.revenue > 0
      ? (foodCostTotals.cost / foodCostTotals.revenue) * 100
      : 0;

    // ── 3. Stock variance (top 10 by loss value) ─────────────────────────
    let varianceRows = [];
    try {
      const ingredients = all(`
        SELECT i.id, i.name, i.default_unit, i.price_per_unit
        FROM ingredients i
        WHERE i.restaurant_id = ?
      `, [rid]);
      const movements = all(`
        SELECT ingredient_id, movement_type, SUM(quantity) AS qty
        FROM stock_movements
        WHERE restaurant_id = ?
          AND recorded_at >= ?
          AND recorded_at <  ?
        GROUP BY ingredient_id, movement_type
      `, [rid, month.start, month.end]);

      const byIng = new Map();
      for (const m of movements) {
        const id = m.ingredient_id;
        if (!byIng.has(id)) byIng.set(id, { reception: 0, consumption: 0, loss: 0 });
        const bucket = byIng.get(id);
        const t = (m.movement_type || '').toLowerCase();
        const q = Math.abs(Number(m.qty) || 0);
        if (t === 'reception' || t === 'réception' || t === 'entree' || t === 'entrée' || t === 'in') bucket.reception += q;
        else if (t === 'perte' || t === 'casse' || t === 'loss' || t === 'waste' || t === 'dechet' || t === 'déchet') bucket.loss += q;
        else bucket.consumption += q;
      }
      for (const ing of ingredients) {
        const m = byIng.get(ing.id) || { reception: 0, consumption: 0, loss: 0 };
        if (m.reception === 0 && m.consumption === 0 && m.loss === 0) continue;
        varianceRows.push({
          name: ing.name,
          unit: ing.default_unit || '',
          reception: m.reception,
          consumption: m.consumption,
          loss: m.loss,
          loss_value: m.loss * (Number(ing.price_per_unit) || 0),
        });
      }
      varianceRows.sort((a, b) => b.loss_value - a.loss_value);
      varianceRows = varianceRows.slice(0, 10);
    } catch {
      varianceRows = [];
    }

    // ── 4. Supplier invoices summary ────────────────────────────────────
    let invoicesByStatus = [];
    let invoicesTotals = { count: 0, ht: 0, tva: 0, ttc: 0 };
    try {
      invoicesByStatus = all(`
        SELECT status,
               COUNT(*) AS n,
               COALESCE(SUM(total_ht), 0) AS ht,
               COALESCE(SUM(tva_amount), 0) AS tva,
               COALESCE(SUM(total_ttc), 0) AS ttc
        FROM supplier_invoices
        WHERE restaurant_id = ?
          AND deleted_at IS NULL
          AND COALESCE(invoice_date, date(created_at)) >= ?
          AND COALESCE(invoice_date, date(created_at)) <  ?
        GROUP BY status
        ORDER BY status
      `, [rid, month.startDate, month.endDate]);
      for (const s of invoicesByStatus) {
        invoicesTotals.count += s.n;
        invoicesTotals.ht   += Number(s.ht)  || 0;
        invoicesTotals.tva  += Number(s.tva) || 0;
        invoicesTotals.ttc  += Number(s.ttc) || 0;
      }
    } catch {
      invoicesByStatus = [];
    }

    // ── 5. Waste summary ────────────────────────────────────────────────
    let wasteSummary = { count: 0, value: 0 };
    let wasteByReason = [];
    try {
      const totalRow = get(`
        SELECT COUNT(*) AS n, COALESCE(SUM(estimated_value), 0) AS v
        FROM waste_management
        WHERE restaurant_id = ?
          AND date >= ? AND date <= ?
      `, [rid, month.startDate, month.endDate]);
      wasteSummary.count = (totalRow && totalRow.n) || 0;
      wasteSummary.value = Number(totalRow && totalRow.v) || 0;
      wasteByReason = all(`
        SELECT COALESCE(NULLIF(reason, ''), 'Non précisé') AS reason,
               COUNT(*) AS n,
               COALESCE(SUM(estimated_value), 0) AS v
        FROM waste_management
        WHERE restaurant_id = ?
          AND date >= ? AND date <= ?
        GROUP BY reason
        ORDER BY v DESC
        LIMIT 8
      `, [rid, month.startDate, month.endDate]);
    } catch {
      wasteSummary = { count: 0, value: 0 };
      wasteByReason = [];
    }

    // ── 6. HACCP summary ────────────────────────────────────────────────
    let haccp = { tempCount: 0, tempAlerts: 0, ncTotal: 0, ncCritical: 0, ncResolved: 0 };
    try {
      haccp.tempCount  = get(`SELECT COUNT(*) AS n FROM temperature_logs WHERE restaurant_id = ? AND recorded_at >= ? AND recorded_at < ?`, [rid, month.start, month.end]).n;
      haccp.tempAlerts = get(`SELECT COUNT(*) AS n FROM temperature_logs WHERE restaurant_id = ? AND recorded_at >= ? AND recorded_at < ? AND is_alert = 1`, [rid, month.start, month.end]).n;
      haccp.ncTotal    = get(`SELECT COUNT(*) AS n FROM non_conformities WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ?`, [rid, month.start, month.end]).n;
      haccp.ncCritical = get(`SELECT COUNT(*) AS n FROM non_conformities WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ? AND (severity = 'critique' OR severity = 'majeure')`, [rid, month.start, month.end]).n;
      haccp.ncResolved = get(`SELECT COUNT(*) AS n FROM non_conformities WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ? AND (status = 'resolu' OR status = 'résolu' OR status = 'closed' OR status = 'clos')`, [rid, month.start, month.end]).n;
    } catch {}

    // ───────────────────────── Render PDF ─────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
    });
    const filename = `rapport-mensuel-${(restaurant.name || 'restaurant').replace(/[^a-zA-Z0-9.\-_]/g, '-')}-${month.iso}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── Cover page ───────────────────────────────────────────────────────
    let y = pdfBrandedHeader(doc, {
      title: 'Rapport mensuel comptable',
      restaurantName: restaurant.name || 'Établissement',
      period: fmtPeriod(month),
    });
    y += 24;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND.NAVY);
    doc.text('Sommaire', MARGIN, y);
    y += 18;
    const toc = [
      '1. Synthèse achats fournisseurs',
      '2. Food cost — top recettes vendues',
      '3. Variance de stock — pertes',
      '4. Factures fournisseurs',
      '5. Pertes & gaspillage',
      '6. Synthèse HACCP',
    ];
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.TEXT);
    for (const line of toc) {
      doc.text(`   ${line}`, MARGIN + 12, y, { width: CONTENT_W - 24 });
      y += 16;
    }

    // ── Section 1: purchases ─────────────────────────────────────────────
    doc.addPage();
    y = MARGIN;
    y = pdfSection(doc, '1. Synthèse achats fournisseurs', y);
    y = pdfStat(doc, 'Commandes envoyées', purchaseTotals.n, y);
    y = pdfStat(doc, 'Total achats (HT estimé)', `${r2(purchaseTotals.total).toFixed(2)} €`, y);
    y += 10;

    if (topSuppliers.length > 0) {
      const cols = [
        { label: 'Fournisseur', width: 230 },
        { label: 'Cdes', width: 70, align: 'right' },
        { label: 'Total HT (€)', width: 110, align: 'right' },
      ];
      y = pdfBrandedTableHeader(doc, y, cols);
      let i = 0;
      for (const s of topSuppliers) {
        y = checkPageBreak(doc, y, 18);
        y = pdfBrandedTableRow(doc, y, cols, [
          s.supplier_name || '—',
          s.order_count,
          r2(s.total_ttc).toFixed(2),
        ], i++);
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(BRAND.MUTED);
      doc.text('Aucune commande envoyée sur cette période.', MARGIN + 6, y);
      y += 14;
    }

    // ── Section 2: food cost ─────────────────────────────────────────────
    if (y + 80 > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; } else y += 16;
    y = pdfSection(doc, '2. Food cost — top recettes vendues', y);
    y = pdfStat(doc, "Chiffre d'affaires recettes", `${r2(foodCostTotals.revenue).toFixed(2)} €`, y);
    y = pdfStat(doc, 'Coût ingrédients estimé', `${r2(foodCostTotals.cost).toFixed(2)} €`, y);
    y = pdfStat(doc, 'Food cost global', `${r2(overallFC).toFixed(1)} %`, y, overallFC > 35);
    y += 10;

    if (foodCostRows.length > 0) {
      const cols = [
        { label: 'Recette', width: 180 },
        { label: 'Vendues', width: 55, align: 'right' },
        { label: 'Coût u.', width: 60, align: 'right' },
        { label: 'Vente', width: 60, align: 'right' },
        { label: 'FC %', width: 50, align: 'right' },
        { label: 'CA', width: 75, align: 'right' },
      ];
      y = pdfBrandedTableHeader(doc, y, cols);
      let i = 0;
      for (const r of foodCostRows) {
        y = checkPageBreak(doc, y, 18);
        y = pdfBrandedTableRow(doc, y, cols, [
          r.name,
          r.portions_sold,
          `${r2(r.unit_cost).toFixed(2)}€`,
          `${r2(r.selling_price).toFixed(2)}€`,
          `${r2(r.food_cost_pct).toFixed(0)}%`,
          `${r2(r.total_revenue).toFixed(2)}€`,
        ], i++);
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(BRAND.MUTED);
      doc.text('Aucune vente enregistrée — vérifiez la saisie service.', MARGIN + 6, y);
      y += 14;
    }

    // ── Section 3: stock variance ────────────────────────────────────────
    if (y + 80 > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; } else y += 16;
    y = pdfSection(doc, '3. Variance de stock — pertes', y);
    if (varianceRows.length > 0) {
      const cols = [
        { label: 'Ingrédient', width: 180 },
        { label: 'Unité', width: 50 },
        { label: 'Récept.', width: 65, align: 'right' },
        { label: 'Conso.', width: 65, align: 'right' },
        { label: 'Pertes', width: 60, align: 'right' },
        { label: 'Val. pertes', width: 90, align: 'right' },
      ];
      y = pdfBrandedTableHeader(doc, y, cols);
      let i = 0;
      for (const v of varianceRows) {
        y = checkPageBreak(doc, y, 18);
        y = pdfBrandedTableRow(doc, y, cols, [
          v.name,
          v.unit,
          r2(v.reception).toFixed(2),
          r2(v.consumption).toFixed(2),
          r2(v.loss).toFixed(2),
          `${r2(v.loss_value).toFixed(2)} €`,
        ], i++, { alert: v.loss_value > 100 });
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(BRAND.MUTED);
      doc.text('Aucun mouvement de stock sur cette période.', MARGIN + 6, y);
      y += 14;
    }

    // ── Section 4: invoices ──────────────────────────────────────────────
    if (y + 80 > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; } else y += 16;
    y = pdfSection(doc, '4. Factures fournisseurs', y);
    y = pdfStat(doc, 'Total factures', invoicesTotals.count, y);
    y = pdfStat(doc, 'Total HT', `${r2(invoicesTotals.ht).toFixed(2)} €`, y);
    y = pdfStat(doc, 'TVA', `${r2(invoicesTotals.tva).toFixed(2)} €`, y);
    y = pdfStat(doc, 'Total TTC', `${r2(invoicesTotals.ttc).toFixed(2)} €`, y);
    y += 10;

    if (invoicesByStatus.length > 0) {
      const cols = [
        { label: 'Statut', width: 110 },
        { label: 'Cnt', width: 50, align: 'right' },
        { label: 'HT', width: 90, align: 'right' },
        { label: 'TVA', width: 80, align: 'right' },
        { label: 'TTC', width: 90, align: 'right' },
      ];
      y = pdfBrandedTableHeader(doc, y, cols);
      let i = 0;
      for (const s of invoicesByStatus) {
        y = checkPageBreak(doc, y, 18);
        y = pdfBrandedTableRow(doc, y, cols, [
          s.status || '—',
          s.n,
          `${r2(s.ht).toFixed(2)}€`,
          `${r2(s.tva).toFixed(2)}€`,
          `${r2(s.ttc).toFixed(2)}€`,
        ], i++);
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(BRAND.MUTED);
      doc.text('Aucune facture sur cette période.', MARGIN + 6, y);
      y += 14;
    }

    // ── Section 5: waste ────────────────────────────────────────────────
    if (y + 80 > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; } else y += 16;
    y = pdfSection(doc, '5. Pertes & gaspillage', y);
    y = pdfStat(doc, 'Événements de perte', wasteSummary.count, y);
    y = pdfStat(doc, 'Valeur totale perdue', `${r2(wasteSummary.value).toFixed(2)} €`, y, wasteSummary.value > 0);
    y += 10;

    if (wasteByReason.length > 0) {
      const cols = [
        { label: 'Motif', width: 280 },
        { label: 'Cnt', width: 60, align: 'right' },
        { label: 'Valeur', width: 100, align: 'right' },
      ];
      y = pdfBrandedTableHeader(doc, y, cols);
      let i = 0;
      for (const w of wasteByReason) {
        y = checkPageBreak(doc, y, 18);
        y = pdfBrandedTableRow(doc, y, cols, [
          w.reason,
          w.n,
          `${r2(w.v).toFixed(2)} €`,
        ], i++);
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(BRAND.MUTED);
      doc.text('Aucune perte enregistrée — saisissez les pertes pour analyse.', MARGIN + 6, y);
      y += 14;
    }

    // ── Section 6: HACCP summary ────────────────────────────────────────
    if (y + 80 > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; } else y += 16;
    y = pdfSection(doc, '6. Synthèse HACCP', y);
    y = pdfStat(doc, 'Relevés de température', haccp.tempCount, y);
    y = pdfStat(doc, 'Alertes (hors limites)', haccp.tempAlerts, y, haccp.tempAlerts > 0);
    y = pdfStat(doc, 'Taux de conformité', haccp.tempCount > 0 ? `${(((haccp.tempCount - haccp.tempAlerts) / haccp.tempCount) * 100).toFixed(1)} %` : 'n/a', y);
    y = pdfStat(doc, 'Non-conformités totales', haccp.ncTotal, y);
    y = pdfStat(doc, 'Critiques / majeures', haccp.ncCritical, y, haccp.ncCritical > 0);
    y = pdfStat(doc, 'Résolues', haccp.ncResolved, y);

    pdfBrandedFooter(doc, { restaurantName: restaurant.name, label: `Rapport mensuel ${month.label}` });
    doc.end();
  } catch (e) {
    console.error('monthly-report export error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la génération du rapport mensuel' });
  }
});

module.exports = router;
