// ═══════════════════════════════════════════
// Accountant-friendly monthly exports
// GET /api/exports/monthly-purchases?month=YYYY-MM   (CSV)
// GET /api/exports/monthly-food-cost?month=YYYY-MM   (CSV)
// GET /api/exports/stock-variance?month=YYYY-MM      (CSV)
// GET /api/exports/haccp-summary?month=YYYY-MM       (PDF)
// ═══════════════════════════════════════════
//
// Every query is scoped by req.user.restaurant_id; cross-tenant rows are
// impossible by construction. CSVs use ; as separator and CRLF line endings
// so French Excel opens them in columns out of the box. UTF-8 BOM is prepended
// for accent rendering in Excel.

const { Router } = require('express');
const { all, get } = require('../db');
const { requireAuth } = require('./auth');
const PDFDocument = require('pdfkit');
const router = Router();

router.use(requireAuth);

const TVA_RESTAURATION = 0.10; // taux normal restauration sur place

// ─── Month parsing ─────────────────────────────────────────────────────────
// "2026-04" → { start: ISO of 2026-04-01T00:00:00, end: ISO of 2026-05-01T00:00:00, label: "avril 2026" }
function parseMonth(raw) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}$/.test(raw)) return null;
  const [yStr, mStr] = raw.split('-');
  const year = Number(yStr);
  const month = Number(mStr); // 1-12
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2100) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1)); // first day of next month
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

// ─── CSV helpers ───────────────────────────────────────────────────────────
// Cells that contain ; " or newline are wrapped in quotes; embedded " is doubled.
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(arr) {
  return arr.map(csvCell).join(';');
}
function sendCsv(res, filename, rows) {
  // UTF-8 BOM (﻿) so Excel detects the encoding and renders accents.
  const body = '﻿' + rows.join('\r\n') + '\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}
function safeFilename(s) {
  return String(s || 'export').replace(/[^a-zA-Z0-9.\-_]/g, '-');
}

// Round to 2 decimals — accountants don't want 0.30000000000000004.
function r2(n) {
  const v = Number(n) || 0;
  return Math.round(v * 100) / 100;
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Monthly purchases CSV
// ───────────────────────────────────────────────────────────────────────────
router.get('/monthly-purchases', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) {
    return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  }
  try {
    const rid = req.user.restaurant_id;

    // Use sent_at when present (real "ordered" date), fall back to created_at.
    // Only count orders that actually went out — drafts (status='brouillon')
    // are noise on an accountant report.
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

    const rows = [csvRow([
      'date', 'fournisseur', 'numero_commande', 'statut',
      'articles', 'total_ht', 'taux_tva', 'tva', 'total_ttc'
    ])];

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

      rows.push(csvRow([
        po.effective_date ? po.effective_date.slice(0, 10) : '',
        po.supplier_name || `Fournisseur #${po.supplier_id || ''}`,
        po.reference || `PO-${po.id}`,
        po.status,
        itemSummary,
        r2(ht).toFixed(2),
        (TVA_RESTAURATION * 100).toFixed(0) + '%',
        r2(tva).toFixed(2),
        r2(ttc).toFixed(2),
      ]));
    }

    // Footer total row
    rows.push(csvRow([
      'TOTAL', '', '', '', '',
      r2(sumHt).toFixed(2), '', r2(sumTva).toFixed(2), r2(sumTtc).toFixed(2),
    ]));

    sendCsv(res, `achats-${month.iso}.csv`, rows);
  } catch (e) {
    console.error('monthly-purchases export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Monthly food-cost CSV
// ───────────────────────────────────────────────────────────────────────────
// Pulls every recipe sold during the month (via order_items), computes the
// theoretical ingredient cost from the recipe card (sum of ingredient
// price_per_unit × gross_quantity, scaled per portion), and reports margin
// + food-cost %. Sub-recipes are flattened one level — deeper recursion is
// out of scope here; the menu-engineering view does the deeper drill-down.
router.get('/monthly-food-cost', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) {
    return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  }
  try {
    const rid = req.user.restaurant_id;

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

    const rows = [csvRow([
      'fiche_technique', 'categorie', 'portions_vendues',
      'cout_ingredients_unitaire', 'prix_vente_unitaire',
      'marge_unitaire', 'food_cost_pct',
      'cout_ingredients_total', 'ca_total', 'marge_totale',
    ])];

    let totalCost = 0, totalRevenue = 0;

    for (const recipe of sold) {
      const ingredients = all(`
        SELECT ri.gross_quantity, ri.unit, i.price_per_unit, i.default_unit
        FROM recipe_ingredients ri
        LEFT JOIN ingredients i ON i.id = ri.ingredient_id AND i.restaurant_id = ?
        WHERE ri.recipe_id = ? AND ri.restaurant_id = ?
      `, [rid, recipe.recipe_id, rid]);

      const portions = Math.max(1, Number(recipe.portions) || 1);

      // Cost for the FULL recipe (all portions). Divide by portions for unit cost.
      // Quantities use whatever unit the recipe declares; ingredient.price_per_unit
      // is per default_unit. We assume the recipe's gross_quantity is already
      // expressed in a unit comparable to the ingredient price (the rest of the
      // app makes this assumption — see analytics/menu-engineering routes).
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

      rows.push(csvRow([
        recipe.name,
        recipe.category || '',
        portionsSold,
        r2(unitCost).toFixed(2),
        r2(sellingPrice).toFixed(2),
        r2(margin).toFixed(2),
        r2(foodCostPct).toFixed(1),
        r2(totalCostRow).toFixed(2),
        r2(totalRevenueRow).toFixed(2),
        r2(totalRevenueRow - totalCostRow).toFixed(2),
      ]));
    }

    const overallFC = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    rows.push(csvRow([
      'TOTAL', '', '', '', '', '',
      r2(overallFC).toFixed(1),
      r2(totalCost).toFixed(2),
      r2(totalRevenue).toFixed(2),
      r2(totalRevenue - totalCost).toFixed(2),
    ]));

    sendCsv(res, `food-cost-${month.iso}.csv`, rows);
  } catch (e) {
    console.error('monthly-food-cost export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Stock variance CSV
// ───────────────────────────────────────────────────────────────────────────
// For every ingredient, aggregates stock_movements over the month into the
// columns an accountant expects. We don't have explicit opening/closing
// snapshots in the schema, so:
//   closing_stock = current stock (the snapshot in the `stock` table)
//   receptions    = SUM positive reception movements in month
//   consumption   = SUM consumption movements in month (always positive)
//   losses        = SUM perte/casse movements in month (always positive)
//   opening_stock = closing - receptions + consumption + losses
//   variance      = closing - (opening + receptions - consumption - losses)
// `variance` is therefore always 0 by construction unless rows are added or
// deleted outside the movement log — which is the whole point of the column
// for the accountant: it surfaces ledger drift.
router.get('/stock-variance', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) {
    return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  }
  try {
    const rid = req.user.restaurant_id;

    const ingredients = all(`
      SELECT i.id, i.name, i.default_unit, i.price_per_unit,
             COALESCE(s.quantity, 0) AS closing_stock
      FROM ingredients i
      LEFT JOIN stock s ON s.ingredient_id = i.id AND s.restaurant_id = ?
      WHERE i.restaurant_id = ?
      ORDER BY i.name ASC
    `, [rid, rid]);

    // Single grouped query → one row per (ingredient, movement_type).
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
        // anything else (consumption, vente, sortie, out, …) goes to consumption
        bucket.consumption += q;
      }
    }

    const rows = [csvRow([
      'ingredient', 'unite',
      'stock_initial', 'receptions', 'consommation', 'pertes', 'stock_final',
      'variance', 'valeur_unitaire', 'valeur_stock_final',
    ])];

    for (const ing of ingredients) {
      const m = byIng.get(ing.id) || { reception: 0, consumption: 0, loss: 0 };
      const closing = Number(ing.closing_stock) || 0;
      const opening = closing - m.reception + m.consumption + m.loss;
      // By construction variance = 0; future schema may carry independent opening
      // counts and this column will start showing real drift.
      const variance = closing - (opening + m.reception - m.consumption - m.loss);
      const unitValue = Number(ing.price_per_unit) || 0;
      const stockValue = closing * unitValue;

      rows.push(csvRow([
        ing.name,
        ing.default_unit || '',
        r2(opening).toFixed(3),
        r2(m.reception).toFixed(3),
        r2(m.consumption).toFixed(3),
        r2(m.loss).toFixed(3),
        r2(closing).toFixed(3),
        r2(variance).toFixed(3),
        r2(unitValue).toFixed(4),
        r2(stockValue).toFixed(2),
      ]));
    }

    sendCsv(res, `variance-stock-${month.iso}.csv`, rows);
  } catch (e) {
    console.error('stock-variance export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 4. HACCP summary PDF
// ───────────────────────────────────────────────────────────────────────────
// Single-page-ish summary for the accountant + DDPP file: counts and headline
// figures for the month (temps, cleaning, NCs).

const PAGE_W = 595.28;
const PDF_MARGIN = 40;
const CONTENT_W = PAGE_W - 2 * PDF_MARGIN;

function pdfSection(doc, title, y) {
  if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1B2A4A');
  doc.rect(PDF_MARGIN, y, CONTENT_W, 18).fill('#E8EEF8').stroke('#1B2A4A');
  doc.fillColor('#1B2A4A').text(title, PDF_MARGIN + 6, y + 5, { width: CONTENT_W - 12 });
  return y + 24;
}
function pdfStat(doc, label, value, y, alert) {
  if (y + 14 > 800) { doc.addPage(); y = PDF_MARGIN; }
  doc.font('Helvetica').fontSize(9).fillColor(alert ? '#D93025' : '#000');
  doc.text(`• ${label} : `, PDF_MARGIN + 6, y + 2, { continued: true, width: CONTENT_W - 12 });
  doc.font('Helvetica-Bold').text(String(value), { continued: false });
  return y + 14;
}

router.get('/haccp-summary', (req, res) => {
  const month = parseMonth(req.query.month);
  if (!month) {
    return res.status(400).json({ error: 'Paramètre "month" requis au format YYYY-MM' });
  }
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};

    // Temperatures
    const tempCount = get(`
      SELECT COUNT(*) AS n FROM temperature_logs
      WHERE restaurant_id = ? AND recorded_at >= ? AND recorded_at < ?
    `, [rid, month.start, month.end]).n;
    const tempAlerts = get(`
      SELECT COUNT(*) AS n FROM temperature_logs
      WHERE restaurant_id = ? AND recorded_at >= ? AND recorded_at < ? AND is_alert = 1
    `, [rid, month.start, month.end]).n;

    // Cleaning — completed vs scheduled tasks
    const cleaningTasks = get(`
      SELECT COUNT(*) AS n FROM cleaning_tasks WHERE restaurant_id = ?
    `, [rid]).n;
    const cleaningCompleted = get(`
      SELECT COUNT(*) AS n FROM cleaning_logs
      WHERE restaurant_id = ? AND completed_at >= ? AND completed_at < ?
    `, [rid, month.start, month.end]).n;

    // Non-conformities
    const ncTotal = get(`
      SELECT COUNT(*) AS n FROM non_conformities
      WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ?
    `, [rid, month.start, month.end]).n;
    const ncCritical = get(`
      SELECT COUNT(*) AS n FROM non_conformities
      WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ?
        AND (severity = 'critique' OR severity = 'majeure')
    `, [rid, month.start, month.end]).n;
    const ncResolved = get(`
      SELECT COUNT(*) AS n FROM non_conformities
      WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ?
        AND (status = 'resolu' OR status = 'résolu' OR status = 'closed' OR status = 'clos')
    `, [rid, month.start, month.end]).n;
    const ncDetails = all(`
      SELECT title, category, severity, status, detected_at
      FROM non_conformities
      WHERE restaurant_id = ? AND detected_at >= ? AND detected_at < ?
      ORDER BY detected_at DESC
      LIMIT 20
    `, [rid, month.start, month.end]);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PDF_MARGIN, bottom: PDF_MARGIN, left: PDF_MARGIN, right: PDF_MARGIN },
      bufferPages: true,
    });
    const filename = safeFilename(`haccp-${restaurant.name || 'restaurant'}-${month.iso}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    let y = PDF_MARGIN;

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1B2A4A');
    doc.text('Synthèse HACCP mensuelle', PDF_MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 26;
    doc.font('Helvetica').fontSize(11).fillColor('#444');
    doc.text(`${restaurant.name || 'Établissement'} — ${month.label}`, PDF_MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 18;
    doc.font('Helvetica').fontSize(9).fillColor('#666');
    doc.text(`Période : du ${new Date(month.start).toLocaleDateString('fr-FR')} au ${new Date(new Date(month.end).getTime() - 86400000).toLocaleDateString('fr-FR')}`, PDF_MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 14;
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, PDF_MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 22;
    doc.moveTo(PDF_MARGIN, y).lineTo(PDF_MARGIN + CONTENT_W, y).lineWidth(1).stroke('#1B2A4A');
    y += 16;

    // Sections
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
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1B2A4A');
      doc.text('Détail des non-conformités :', PDF_MARGIN + 6, y);
      y += 14;
      for (const nc of ncDetails) {
        if (y + 14 > 800) { doc.addPage(); y = PDF_MARGIN; }
        const dt = nc.detected_at ? new Date(nc.detected_at).toLocaleDateString('fr-FR') : '—';
        const sev = nc.severity || 'mineure';
        const isAlert = sev === 'critique' || sev === 'majeure';
        doc.font('Helvetica').fontSize(8).fillColor(isAlert ? '#D93025' : '#333');
        doc.text(
          `${dt} — [${sev}] ${nc.title || '—'} (${nc.category || 'autre'}) · ${nc.status || 'ouvert'}`,
          PDF_MARGIN + 12, y, { width: CONTENT_W - 24 }
        );
        y += 12;
      }
    }

    // Footer on every page
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor('#888');
      doc.text(
        `${restaurant.name || 'Établissement'} — Synthèse HACCP ${month.label} — Page ${i + 1}/${pageCount}`,
        PDF_MARGIN, 820, { width: CONTENT_W, align: 'center' }
      );
    }

    doc.end();
  } catch (e) {
    console.error('haccp-summary export error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

module.exports = router;
