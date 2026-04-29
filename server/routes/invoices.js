// ═══════════════════════════════════════════
// Supplier invoices — manual CRUD + AI-scan ingest + DN reconciliation.
//
// Persistence layer behind /api/ai/scan-invoice (which only extracts; the
// caller posts the parsed result here to /from-scan). All endpoints scope
// by req.user.restaurant_id; soft-delete via deleted_at IS NULL.
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = new Set(['pending', 'validated', 'paid', 'disputed']);

// pending → validated → paid; either can flip to disputed; disputed → pending
// (to allow re-validation after resolution).
const STATUS_TRANSITIONS = {
  pending:   ['validated', 'disputed', 'paid'],
  validated: ['paid', 'disputed'],
  paid:      ['disputed'],
  disputed:  ['pending', 'validated'],
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function recomputeTotals(invoiceId, rid) {
  const items = all(
    'SELECT quantity, unit_price_ht, tva_rate FROM supplier_invoice_items WHERE invoice_id = ? AND restaurant_id = ?',
    [invoiceId, rid]
  );
  let totalHt = 0;
  let tvaAmount = 0;
  for (const it of items) {
    const lineHt = (Number(it.quantity) || 0) * (Number(it.unit_price_ht) || 0);
    totalHt += lineHt;
    tvaAmount += lineHt * ((Number(it.tva_rate) || 0) / 100);
  }
  return {
    total_ht: round2(totalHt),
    tva_amount: round2(tvaAmount),
    total_ttc: round2(totalHt + tvaAmount),
  };
}

// ═══════════════════════════════════════════
// GET /api/invoices/stats — Monthly + supplier + unpaid + overdue
// MUST be declared before /:id so Express does not match "stats" as an id.
// ═══════════════════════════════════════════
router.get('/stats', (req, res) => {
  try {
    const rid = req.user.restaurant_id;

    // Last 12 months totals (by invoice_date, fallback to created_at)
    const monthly = all(`
      SELECT strftime('%Y-%m', COALESCE(invoice_date, created_at)) AS month,
             COUNT(*) AS invoice_count,
             COALESCE(SUM(total_ht), 0) AS total_ht,
             COALESCE(SUM(tva_amount), 0) AS tva_amount,
             COALESCE(SUM(total_ttc), 0) AS total_ttc
      FROM supplier_invoices
      WHERE restaurant_id = ? AND deleted_at IS NULL
        AND COALESCE(invoice_date, date(created_at)) >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `, [rid]);

    // Top suppliers by spend (all-time, not deleted)
    const bySupplier = all(`
      SELECT inv.supplier_id,
             s.name AS supplier_name,
             COUNT(inv.id) AS invoice_count,
             COALESCE(SUM(inv.total_ttc), 0) AS total_ttc
      FROM supplier_invoices inv
      LEFT JOIN suppliers s ON s.id = inv.supplier_id AND s.restaurant_id = ?
      WHERE inv.restaurant_id = ? AND inv.deleted_at IS NULL
      GROUP BY inv.supplier_id
      ORDER BY total_ttc DESC
      LIMIT 10
    `, [rid, rid]);

    // Unpaid (not paid, not disputed)
    const unpaid = get(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_ttc), 0) AS total_ttc
      FROM supplier_invoices
      WHERE restaurant_id = ? AND deleted_at IS NULL
        AND status IN ('pending', 'validated')
    `, [rid]) || { count: 0, total_ttc: 0 };

    // Overdue (due_date < today, still unpaid)
    const overdue = get(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_ttc), 0) AS total_ttc
      FROM supplier_invoices
      WHERE restaurant_id = ? AND deleted_at IS NULL
        AND status IN ('pending', 'validated')
        AND due_date IS NOT NULL AND date(due_date) < date('now')
    `, [rid]) || { count: 0, total_ttc: 0 };

    res.json({
      monthly: monthly.map(m => ({
        month: m.month,
        invoice_count: m.invoice_count,
        total_ht: round2(m.total_ht),
        tva_amount: round2(m.tva_amount),
        total_ttc: round2(m.total_ttc),
      })),
      by_supplier: bySupplier.map(s => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        invoice_count: s.invoice_count,
        total_ttc: round2(s.total_ttc),
      })),
      unpaid: { count: unpaid.count, total_ttc: round2(unpaid.total_ttc) },
      overdue: { count: overdue.count, total_ttc: round2(overdue.total_ttc) },
    });
  } catch (e) {
    console.error('invoices/stats error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// GET /api/invoices/reconcile/:id — diff invoice items vs linked DN items
// MUST be declared before /:id.
// ═══════════════════════════════════════════
router.get('/reconcile/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);

    const invoice = get(
      'SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
      [id, rid]
    );
    if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });
    if (!invoice.delivery_note_id) {
      return res.status(400).json({ error: 'Aucun bon de livraison lié à cette facture' });
    }

    const dn = get(
      'SELECT * FROM delivery_notes WHERE id = ? AND restaurant_id = ?',
      [invoice.delivery_note_id, rid]
    );
    if (!dn) return res.status(404).json({ error: 'Bon de livraison lié introuvable' });

    const invItems = all(
      'SELECT * FROM supplier_invoice_items WHERE invoice_id = ? AND restaurant_id = ?',
      [id, rid]
    );
    const dnItems = all(
      'SELECT * FROM delivery_note_items WHERE delivery_note_id = ? AND restaurant_id = ?',
      [invoice.delivery_note_id, rid]
    );

    const EPS = 0.01;
    const matched = [];
    const qty_discrepancies = [];
    const price_discrepancies = [];
    const missing_in_invoice = []; // present on DN, absent on invoice
    const missing_in_delivery = []; // present on invoice, absent on DN

    const dnUsed = new Set();

    for (const inv of invItems) {
      // Match on ingredient_id first, then loose product-name compare
      let dn = null;
      if (inv.ingredient_id) {
        dn = dnItems.find(d => !dnUsed.has(d.id) && d.ingredient_id === inv.ingredient_id);
      }
      if (!dn) {
        const desc = String(inv.description || '').trim().toLowerCase();
        if (desc) {
          dn = dnItems.find(d =>
            !dnUsed.has(d.id) &&
            String(d.product_name || '').trim().toLowerCase() === desc
          );
        }
      }

      if (!dn) {
        missing_in_delivery.push({
          invoice_item_id: inv.id,
          description: inv.description,
          ingredient_id: inv.ingredient_id,
          quantity: inv.quantity,
          unit_price_ht: inv.unit_price_ht,
        });
        continue;
      }

      dnUsed.add(dn.id);
      const qtyDelta = (Number(inv.quantity) || 0) - (Number(dn.quantity) || 0);
      const priceDelta = (Number(inv.unit_price_ht) || 0) - (Number(dn.price_per_unit) || 0);

      const entry = {
        invoice_item_id: inv.id,
        delivery_note_item_id: dn.id,
        description: inv.description || dn.product_name,
        ingredient_id: inv.ingredient_id || dn.ingredient_id,
        invoice_quantity: inv.quantity,
        delivery_quantity: dn.quantity,
        invoice_unit_price: inv.unit_price_ht,
        delivery_unit_price: dn.price_per_unit,
        qty_delta: round2(qtyDelta),
        price_delta: round2(priceDelta),
      };

      if (Math.abs(qtyDelta) > EPS) qty_discrepancies.push(entry);
      else if (Math.abs(priceDelta) > EPS) price_discrepancies.push(entry);
      else matched.push(entry);
    }

    for (const dn of dnItems) {
      if (dnUsed.has(dn.id)) continue;
      missing_in_invoice.push({
        delivery_note_item_id: dn.id,
        product_name: dn.product_name,
        ingredient_id: dn.ingredient_id,
        quantity: dn.quantity,
        price_per_unit: dn.price_per_unit,
      });
    }

    res.json({
      invoice_id: id,
      delivery_note_id: invoice.delivery_note_id,
      summary: {
        matched: matched.length,
        qty_discrepancies: qty_discrepancies.length,
        price_discrepancies: price_discrepancies.length,
        missing_in_invoice: missing_in_invoice.length,
        missing_in_delivery: missing_in_delivery.length,
        clean: qty_discrepancies.length === 0
            && price_discrepancies.length === 0
            && missing_in_invoice.length === 0
            && missing_in_delivery.length === 0,
      },
      matched,
      qty_discrepancies,
      price_discrepancies,
      missing_in_invoice,
      missing_in_delivery,
    });
  } catch (e) {
    console.error('invoices/reconcile error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// GET /api/invoices — List with filters
// ═══════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { status, supplier_id, date_from, date_to } = req.query;

    let sql = `
      SELECT inv.*, s.name AS supplier_name
      FROM supplier_invoices inv
      LEFT JOIN suppliers s ON s.id = inv.supplier_id AND s.restaurant_id = ?
      WHERE inv.restaurant_id = ? AND inv.deleted_at IS NULL
    `;
    const params = [rid, rid];

    if (status && VALID_STATUSES.has(status)) {
      sql += ' AND inv.status = ?';
      params.push(status);
    }
    if (supplier_id) {
      sql += ' AND inv.supplier_id = ?';
      params.push(Number(supplier_id));
    }
    if (date_from) {
      sql += ' AND COALESCE(inv.invoice_date, date(inv.created_at)) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND COALESCE(inv.invoice_date, date(inv.created_at)) <= ?';
      params.push(date_to);
    }
    sql += ' ORDER BY COALESCE(inv.invoice_date, inv.created_at) DESC, inv.id DESC';

    res.json(all(sql, params));
  } catch (e) {
    console.error('invoices/list error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// GET /api/invoices/:id — Detail with items
// ═══════════════════════════════════════════
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);

    const inv = get(`
      SELECT inv.*, s.name AS supplier_name
      FROM supplier_invoices inv
      LEFT JOIN suppliers s ON s.id = inv.supplier_id AND s.restaurant_id = ?
      WHERE inv.id = ? AND inv.restaurant_id = ? AND inv.deleted_at IS NULL
    `, [rid, id, rid]);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable' });

    const items = all(`
      SELECT i.*, ing.name AS ingredient_name, ing.default_unit AS ingredient_unit
      FROM supplier_invoice_items i
      LEFT JOIN ingredients ing ON ing.id = i.ingredient_id AND ing.restaurant_id = ?
      WHERE i.invoice_id = ? AND i.restaurant_id = ?
      ORDER BY i.id
    `, [rid, id, rid]);

    res.json({ ...inv, items });
  } catch (e) {
    console.error('invoices/detail error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// POST /api/invoices — Create manually
// ═══════════════════════════════════════════
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      supplier_id, invoice_number, invoice_date, due_date,
      total_ht, tva_amount, total_ttc, status,
      payment_method, notes, pdf_path,
      delivery_note_id, purchase_order_id, items,
    } = req.body || {};

    if (status && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Statut invalide (attendu : ${[...VALID_STATUSES].join(', ')})` });
    }

    // Verify cross-table refs are in tenant
    if (supplier_id != null) {
      const s = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [Number(supplier_id), rid]);
      if (!s) return res.status(404).json({ error: 'Fournisseur introuvable' });
    }
    if (delivery_note_id != null) {
      const d = get('SELECT id FROM delivery_notes WHERE id = ? AND restaurant_id = ?', [Number(delivery_note_id), rid]);
      if (!d) return res.status(404).json({ error: 'Bon de livraison introuvable' });
    }
    if (purchase_order_id != null) {
      const p = get('SELECT id FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [Number(purchase_order_id), rid]);
      if (!p) return res.status(404).json({ error: 'Commande d\'achat introuvable' });
    }

    const insertId = db.transaction(() => {
      const result = run(`
        INSERT INTO supplier_invoices
          (restaurant_id, supplier_id, invoice_number, invoice_date, due_date,
           total_ht, tva_amount, total_ttc, status,
           payment_method, notes, pdf_path,
           delivery_note_id, purchase_order_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        rid,
        supplier_id != null ? Number(supplier_id) : null,
        invoice_number || null,
        invoice_date || null,
        due_date || null,
        round2(total_ht),
        round2(tva_amount),
        round2(total_ttc),
        status || 'pending',
        payment_method || null,
        notes || null,
        pdf_path || null,
        delivery_note_id != null ? Number(delivery_note_id) : null,
        purchase_order_id != null ? Number(purchase_order_id) : null,
      ]);
      const newId = Number(result.lastInsertRowid);

      if (Array.isArray(items)) {
        for (const it of items) {
          const qty = Number(it.quantity) || 0;
          const unitPrice = Number(it.unit_price_ht) || 0;
          const tvaRate = it.tva_rate != null ? Number(it.tva_rate) : 5.5;
          const lineHt = round2(qty * unitPrice);
          run(`
            INSERT INTO supplier_invoice_items
              (invoice_id, restaurant_id, description, quantity, unit_price_ht, tva_rate, total_ht, ingredient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            newId, rid, it.description || null,
            qty, unitPrice, tvaRate, lineHt,
            it.ingredient_id != null ? Number(it.ingredient_id) : null,
          ]);
        }
        // If caller did not provide totals, compute from items
        if (total_ht == null && tva_amount == null && total_ttc == null) {
          const t = recomputeTotals(newId, rid);
          run(`
            UPDATE supplier_invoices
               SET total_ht = ?, tva_amount = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND restaurant_id = ?
          `, [t.total_ht, t.tva_amount, t.total_ttc, newId, rid]);
        }
      }

      try {
        writeAudit({
          restaurant_id: rid, account_id: req.user.id || null,
          table_name: 'supplier_invoices', record_id: newId,
          action: 'create',
          new_values: { supplier_id, invoice_number, invoice_date, total_ttc },
        });
      } catch (auditErr) {
        console.warn('audit invoice create:', auditErr.message);
      }

      return newId;
    })();

    const created = get('SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ?', [insertId, rid]);
    const createdItems = all('SELECT * FROM supplier_invoice_items WHERE invoice_id = ? AND restaurant_id = ?', [insertId, rid]);
    res.status(201).json({ ...created, items: createdItems });
  } catch (e) {
    console.error('invoices/create error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// POST /api/invoices/from-scan — Create from /api/ai/scan-invoice payload
// Accepts: { supplier_name, supplier_id?, invoice_number, invoice_date,
//           items[], total_ht, tva, total_ttc, delivery_note_id?, purchase_order_id? }
// ═══════════════════════════════════════════
router.post('/from-scan', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const scan = req.body || {};

    // Resolve supplier: explicit id wins, else fuzzy by supplier_name
    let supplierId = scan.supplier_id != null ? Number(scan.supplier_id) : null;
    if (supplierId != null) {
      const s = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplierId, rid]);
      if (!s) return res.status(404).json({ error: 'Fournisseur introuvable' });
    } else if (scan.supplier_name) {
      const name = String(scan.supplier_name).toLowerCase().trim();
      const match = get(
        "SELECT id FROM suppliers WHERE LOWER(name) LIKE ? AND restaurant_id = ? ORDER BY LENGTH(name) ASC LIMIT 1",
        [`%${name}%`, rid]
      );
      if (match) supplierId = match.id;
    }

    if (scan.delivery_note_id != null) {
      const d = get('SELECT id FROM delivery_notes WHERE id = ? AND restaurant_id = ?', [Number(scan.delivery_note_id), rid]);
      if (!d) return res.status(404).json({ error: 'Bon de livraison introuvable' });
    }
    if (scan.purchase_order_id != null) {
      const p = get('SELECT id FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [Number(scan.purchase_order_id), rid]);
      if (!p) return res.status(404).json({ error: 'Commande d\'achat introuvable' });
    }

    const insertId = db.transaction(() => {
      const totalHtScan = scan.total_ht != null ? round2(scan.total_ht) : null;
      const tvaScan = scan.tva != null ? round2(scan.tva)
                    : scan.tva_amount != null ? round2(scan.tva_amount) : null;
      const totalTtcScan = scan.total_ttc != null ? round2(scan.total_ttc) : null;

      const result = run(`
        INSERT INTO supplier_invoices
          (restaurant_id, supplier_id, invoice_number, invoice_date,
           total_ht, tva_amount, total_ttc, status,
           notes, pdf_path,
           delivery_note_id, purchase_order_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `, [
        rid,
        supplierId,
        scan.invoice_number || null,
        scan.invoice_date || null,
        totalHtScan != null ? totalHtScan : 0,
        tvaScan != null ? tvaScan : 0,
        totalTtcScan != null ? totalTtcScan : 0,
        scan.notes || null,
        scan.pdf_path || null,
        scan.delivery_note_id != null ? Number(scan.delivery_note_id) : null,
        scan.purchase_order_id != null ? Number(scan.purchase_order_id) : null,
      ]);
      const newId = Number(result.lastInsertRowid);

      const items = Array.isArray(scan.items) ? scan.items : [];
      for (const it of items) {
        const qty = Number(it.quantity) || 0;
        // Scan output uses unit_price; we store unit_price_ht
        const unitPrice = it.unit_price_ht != null
          ? Number(it.unit_price_ht)
          : (Number(it.unit_price) || 0);
        const tvaRate = it.tva_rate != null ? Number(it.tva_rate) : 5.5;
        const lineTotal = it.total_price != null
          ? round2(it.total_price)
          : round2(qty * unitPrice);

        run(`
          INSERT INTO supplier_invoice_items
            (invoice_id, restaurant_id, description, quantity, unit_price_ht, tva_rate, total_ht, ingredient_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newId, rid,
          it.description || it.product_name || null,
          qty, unitPrice, tvaRate, lineTotal,
          it.ingredient_id != null ? Number(it.ingredient_id) : null,
        ]);
      }

      // If scan didn't report totals, derive from items
      if (totalHtScan == null && totalTtcScan == null && items.length > 0) {
        const t = recomputeTotals(newId, rid);
        run(`
          UPDATE supplier_invoices
             SET total_ht = ?, tva_amount = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND restaurant_id = ?
        `, [t.total_ht, t.tva_amount, t.total_ttc, newId, rid]);
      }

      try {
        writeAudit({
          restaurant_id: rid, account_id: req.user.id || null,
          table_name: 'supplier_invoices', record_id: newId,
          action: 'create',
          new_values: { source: 'scan', supplier_id: supplierId, invoice_number: scan.invoice_number, total_ttc: totalTtcScan },
        });
      } catch (auditErr) {
        console.warn('audit invoice from-scan:', auditErr.message);
      }

      return newId;
    })();

    const created = get('SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ?', [insertId, rid]);
    const createdItems = all('SELECT * FROM supplier_invoice_items WHERE invoice_id = ? AND restaurant_id = ?', [insertId, rid]);
    res.status(201).json({ ...created, items: createdItems, supplier_id: supplierId });
  } catch (e) {
    console.error('invoices/from-scan error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// PUT /api/invoices/:id — Update mutable fields + replace items
// Status changes go through PUT /:id/status (this endpoint ignores `status`).
// ═══════════════════════════════════════════
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const inv = get(
      'SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
      [id, rid]
    );
    if (!inv) return res.status(404).json({ error: 'Facture introuvable' });

    if (inv.status === 'paid') {
      return res.status(400).json({ error: 'Une facture payée ne peut pas être modifiée' });
    }

    const {
      supplier_id, invoice_number, invoice_date, due_date,
      total_ht, tva_amount, total_ttc,
      payment_method, notes, pdf_path,
      delivery_note_id, purchase_order_id, items,
    } = req.body || {};

    if (supplier_id != null) {
      const s = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [Number(supplier_id), rid]);
      if (!s) return res.status(404).json({ error: 'Fournisseur introuvable' });
    }
    if (delivery_note_id != null) {
      const d = get('SELECT id FROM delivery_notes WHERE id = ? AND restaurant_id = ?', [Number(delivery_note_id), rid]);
      if (!d) return res.status(404).json({ error: 'Bon de livraison introuvable' });
    }
    if (purchase_order_id != null) {
      const p = get('SELECT id FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [Number(purchase_order_id), rid]);
      if (!p) return res.status(404).json({ error: 'Commande d\'achat introuvable' });
    }

    db.transaction(() => {
      const fields = [];
      const params = [];
      const setIf = (key, value, transform = (v) => v) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          params.push(transform(value));
        }
      };
      setIf('supplier_id', supplier_id, v => v == null ? null : Number(v));
      setIf('invoice_number', invoice_number, v => v == null ? null : String(v));
      setIf('invoice_date', invoice_date, v => v || null);
      setIf('due_date', due_date, v => v || null);
      setIf('total_ht', total_ht, v => round2(v));
      setIf('tva_amount', tva_amount, v => round2(v));
      setIf('total_ttc', total_ttc, v => round2(v));
      setIf('payment_method', payment_method, v => v || null);
      setIf('notes', notes, v => v == null ? null : String(v));
      setIf('pdf_path', pdf_path, v => v || null);
      setIf('delivery_note_id', delivery_note_id, v => v == null ? null : Number(v));
      setIf('purchase_order_id', purchase_order_id, v => v == null ? null : Number(v));

      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        run(
          `UPDATE supplier_invoices SET ${fields.join(', ')} WHERE id = ? AND restaurant_id = ?`,
          [...params, id, rid]
        );
      }

      if (Array.isArray(items)) {
        run('DELETE FROM supplier_invoice_items WHERE invoice_id = ? AND restaurant_id = ?', [id, rid]);
        for (const it of items) {
          const qty = Number(it.quantity) || 0;
          const unitPrice = Number(it.unit_price_ht) || 0;
          const tvaRate = it.tva_rate != null ? Number(it.tva_rate) : 5.5;
          const lineHt = round2(qty * unitPrice);
          run(`
            INSERT INTO supplier_invoice_items
              (invoice_id, restaurant_id, description, quantity, unit_price_ht, tva_rate, total_ht, ingredient_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, rid, it.description || null,
            qty, unitPrice, tvaRate, lineHt,
            it.ingredient_id != null ? Number(it.ingredient_id) : null,
          ]);
        }
        // If totals were not explicitly set in this PUT, recompute them
        if (total_ht === undefined && tva_amount === undefined && total_ttc === undefined) {
          const t = recomputeTotals(id, rid);
          run(`
            UPDATE supplier_invoices
               SET total_ht = ?, tva_amount = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND restaurant_id = ?
          `, [t.total_ht, t.tva_amount, t.total_ttc, id, rid]);
        }
      }

      try {
        writeAudit({
          restaurant_id: rid, account_id: req.user.id || null,
          table_name: 'supplier_invoices', record_id: id,
          action: 'update',
          old_values: { status: inv.status, total_ttc: inv.total_ttc },
          new_values: { fields: fields.map(f => f.split(' = ')[0]) },
        });
      } catch (auditErr) {
        console.warn('audit invoice update:', auditErr.message);
      }
    })();

    const updated = get('SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ?', [id, rid]);
    const updatedItems = all('SELECT * FROM supplier_invoice_items WHERE invoice_id = ? AND restaurant_id = ?', [id, rid]);
    res.json({ ...updated, items: updatedItems });
  } catch (e) {
    console.error('invoices/update error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// PUT /api/invoices/:id/status — Validate / mark paid / dispute
// Body: { status, payment_date?, payment_method?, notes? }
// ═══════════════════════════════════════════
router.put('/:id/status', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const { status, payment_date, payment_method, notes } = req.body || {};

    if (!status || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Statut invalide (attendu : ${[...VALID_STATUSES].join(', ')})` });
    }

    const inv = get(
      'SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
      [id, rid]
    );
    if (!inv) return res.status(404).json({ error: 'Facture introuvable' });

    if (inv.status === status) {
      return res.json({ ...inv, unchanged: true });
    }

    const allowed = STATUS_TRANSITIONS[inv.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Transition ${inv.status} → ${status} non autorisée`,
      });
    }

    const fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];

    if (status === 'paid') {
      fields.push('payment_date = ?');
      params.push(payment_date || new Date().toISOString());
      if (payment_method) {
        fields.push('payment_method = ?');
        params.push(payment_method);
      }
    }
    if (notes != null) {
      fields.push('notes = ?');
      params.push(notes);
    }

    run(
      `UPDATE supplier_invoices SET ${fields.join(', ')} WHERE id = ? AND restaurant_id = ?`,
      [...params, id, rid]
    );

    try {
      writeAudit({
        restaurant_id: rid, account_id: req.user.id || null,
        table_name: 'supplier_invoices', record_id: id,
        action: 'update',
        old_values: { status: inv.status },
        new_values: { status, payment_date: status === 'paid' ? (payment_date || 'now') : undefined },
      });
    } catch (auditErr) {
      console.warn('audit invoice status:', auditErr.message);
    }

    const updated = get('SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json(updated);
  } catch (e) {
    console.error('invoices/status error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// DELETE /api/invoices/:id — Soft delete
// ═══════════════════════════════════════════
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const inv = get(
      'SELECT * FROM supplier_invoices WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL',
      [id, rid]
    );
    if (!inv) return res.status(404).json({ error: 'Facture introuvable' });

    run(
      `UPDATE supplier_invoices
          SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND restaurant_id = ?`,
      [id, rid]
    );

    try {
      writeAudit({
        restaurant_id: rid, account_id: req.user.id || null,
        table_name: 'supplier_invoices', record_id: id,
        action: 'delete',
        old_values: { status: inv.status, total_ttc: inv.total_ttc },
      });
    } catch (auditErr) {
      console.warn('audit invoice delete:', auditErr.message);
    }

    res.json({ deleted: true });
  } catch (e) {
    console.error('invoices/delete error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
