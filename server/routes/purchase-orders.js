const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/purchase-orders — List all purchase orders
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { status, supplier_id } = req.query;
    let sql = `SELECT po.*, s.name as supplier_name
               FROM purchase_orders po
               LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
               WHERE po.restaurant_id = ?`;
    const params = [rid, rid];

    if (status) { sql += ' AND po.status = ?'; params.push(status); }
    if (supplier_id) { sql += ' AND po.supplier_id = ?'; params.push(Number(supplier_id)); }

    sql += ' ORDER BY po.created_at DESC';

    const orders = all(sql, params);

    // Enrich with items
    const enriched = orders.map(po => {
      const items = all(`
        SELECT poi.*, i.name as ingredient_name, i.default_unit as ingredient_unit
        FROM purchase_order_items poi
        LEFT JOIN ingredients i ON i.id = poi.ingredient_id AND i.restaurant_id = ?
        WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?
      `, [rid, po.id, rid]);
      return { ...po, items };
    });

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/purchase-orders/suggest — Suggest items based on low stock
// IMPORTANT: Must be BEFORE /:id to avoid Express matching "suggest" as an ID
router.get('/suggest', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    // Find all ingredients where current stock is below min_quantity
    const lowStock = all(`
      SELECT s.ingredient_id, s.quantity as current_qty, s.min_quantity, s.unit,
             i.name as ingredient_name, i.preferred_supplier_id,
             sp.price as last_price, sp.unit as price_unit,
             sup.name as supplier_name, sup.id as supplier_id
      FROM stock s
      JOIN ingredients i ON i.id = s.ingredient_id AND i.restaurant_id = ?
      LEFT JOIN supplier_prices sp ON sp.ingredient_id = i.id AND sp.restaurant_id = ?
      LEFT JOIN suppliers sup ON sup.id = COALESCE(i.preferred_supplier_id, sp.supplier_id) AND sup.restaurant_id = ?
      WHERE s.restaurant_id = ? AND s.quantity <= s.min_quantity AND s.min_quantity > 0
      ORDER BY (s.min_quantity - s.quantity) DESC
    `, [rid, rid, rid, rid]);

    // Group by supplier
    const bySupplier = {};
    for (const item of lowStock) {
      const sid = item.supplier_id || 0;
      if (!bySupplier[sid]) {
        bySupplier[sid] = {
          supplier_id: sid,
          supplier_name: item.supplier_name || 'Sans fournisseur',
          items: []
        };
      }
      const suggestedQty = Math.max(item.min_quantity * 2 - item.current_qty, item.min_quantity);
      bySupplier[sid].items.push({
        ingredient_id: item.ingredient_id,
        ingredient_name: item.ingredient_name,
        current_qty: item.current_qty,
        min_quantity: item.min_quantity,
        suggested_qty: Math.round(suggestedQty * 100) / 100,
        unit: item.unit,
        last_price: item.last_price || 0,
        price_unit: item.price_unit || item.unit
      });
    }

    res.json(Object.values(bySupplier));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// GET /api/purchase-orders/analytics — Statistiques d'achat
// IMPORTANT: Must be BEFORE /:id
// ═══════════════════════════════════════════
router.get('/analytics', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { period } = req.query;
    const days = period === '90' ? 90 : period === '30' ? 30 : 60;
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    // Total spending by supplier
    const bySupplier = all(`
      SELECT s.id as supplier_id, s.name as supplier_name,
             COUNT(po.id) as order_count,
             COALESCE(SUM(po.total_amount), 0) as total_spent,
             AVG(po.total_amount) as avg_order
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
      WHERE po.restaurant_id = ? AND po.status = 'réceptionnée' AND date(po.created_at) >= ?
      GROUP BY s.id
      ORDER BY total_spent DESC
    `, [rid, rid, dateFrom]);

    // Monthly trend
    const monthlyTrend = all(`
      SELECT strftime('%Y-%m', created_at) as month,
             COUNT(*) as order_count,
             SUM(total_amount) as total_amount
      FROM purchase_orders
      WHERE restaurant_id = ? AND status = 'réceptionnée' AND date(created_at) >= ?
      GROUP BY month
      ORDER BY month
    `, [rid, dateFrom]);

    // Top purchased items
    const topItems = all(`
      SELECT poi.ingredient_id, i.name as ingredient_name,
             SUM(poi.quantity) as total_qty, poi.unit,
             AVG(poi.unit_price) as avg_price,
             SUM(poi.total_price) as total_spent,
             COUNT(DISTINCT po.id) as order_count
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id AND po.restaurant_id = ?
      LEFT JOIN ingredients i ON i.id = poi.ingredient_id AND i.restaurant_id = ?
      WHERE poi.restaurant_id = ? AND po.status = 'réceptionnée' AND date(po.created_at) >= ?
      GROUP BY poi.ingredient_id
      ORDER BY total_spent DESC
      LIMIT 20
    `, [rid, rid, rid, dateFrom]);

    // Overall stats
    const overall = get(`
      SELECT COUNT(*) as total_orders,
             COALESCE(SUM(total_amount), 0) as total_spent,
             COALESCE(AVG(total_amount), 0) as avg_order,
             COUNT(DISTINCT supplier_id) as supplier_count
      FROM purchase_orders
      WHERE restaurant_id = ? AND status = 'réceptionnée' AND date(created_at) >= ?
    `, [rid, dateFrom]);

    // Average lead time (sent → received)
    const leadTime = get(`
      SELECT AVG(julianday(received_at) - julianday(sent_at)) as avg_days
      FROM purchase_orders
      WHERE restaurant_id = ? AND status = 'réceptionnée' AND sent_at IS NOT NULL AND received_at IS NOT NULL AND date(created_at) >= ?
    `, [rid, dateFrom]);

    // Price trends for key items (last 3 prices)
    const priceChanges = all(`
      SELECT ph.ingredient_id, i.name as ingredient_name,
             ph.price as current_price, ph.recorded_at,
             (SELECT ph2.price FROM price_history ph2
              WHERE ph2.ingredient_id = ph.ingredient_id
              ORDER BY ph2.recorded_at DESC LIMIT 1 OFFSET 1) as previous_price
      FROM price_history ph
      JOIN ingredients i ON i.id = ph.ingredient_id AND i.restaurant_id = ?
      WHERE date(ph.recorded_at) >= ?
      GROUP BY ph.ingredient_id
      HAVING COUNT(*) >= 2
      ORDER BY ABS(ph.price - COALESCE((SELECT ph2.price FROM price_history ph2
        WHERE ph2.ingredient_id = ph.ingredient_id
        ORDER BY ph2.recorded_at DESC LIMIT 1 OFFSET 1), ph.price)) DESC
      LIMIT 10
    `, [rid, dateFrom]);

    res.json({
      period_days: days,
      overall: {
        total_orders: overall.total_orders,
        total_spent: Math.round(overall.total_spent * 100) / 100,
        avg_order: Math.round(overall.avg_order * 100) / 100,
        supplier_count: overall.supplier_count,
        avg_lead_time_days: leadTime.avg_days ? Math.round(leadTime.avg_days * 10) / 10 : null
      },
      by_supplier: bySupplier.map(s => ({
        ...s,
        total_spent: Math.round(s.total_spent * 100) / 100,
        avg_order: Math.round(s.avg_order * 100) / 100
      })),
      monthly_trend: monthlyTrend,
      top_items: topItems,
      price_changes: priceChanges
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/purchase-orders/:id — Detail
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const po = get(`SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone
                     FROM purchase_orders po
                     LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
                     WHERE po.id = ? AND po.restaurant_id = ?`, [rid, id, rid]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });

    const items = all(`
      SELECT poi.*, i.name as ingredient_name, i.default_unit as ingredient_unit
      FROM purchase_order_items poi
      LEFT JOIN ingredients i ON i.id = poi.ingredient_id AND i.restaurant_id = ?
      WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?
    `, [rid, po.id, rid]);

    res.json({ ...po, items });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/purchase-orders — Create a purchase order
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { supplier_id, items, notes, expected_delivery, reference } = req.body;

    if (!supplier_id) return res.status(400).json({ error: 'supplier_id requis' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article requis' });
    }

    // Verify supplier exists (within tenant)
    const supplier = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [Number(supplier_id), rid]);
    if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

    // Validate items
    for (const item of items) {
      if (!item.product_name && !item.ingredient_id) {
        return res.status(400).json({ error: 'product_name ou ingredient_id requis pour chaque ligne' });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: 'Quantité invalide' });
      }
    }

    const transaction = db.transaction(() => {
      let totalAmount = 0;

      // Resolve product names from ingredient_id if needed
      const resolvedItems = items.map(item => {
        let productName = item.product_name;
        if (!productName && item.ingredient_id) {
          const ing = get('SELECT name FROM ingredients WHERE id = ? AND restaurant_id = ?', [item.ingredient_id, rid]);
          productName = ing ? ing.name : `Ingrédient #${item.ingredient_id}`;
        }
        const unitPrice = item.unit_price || 0;
        const qty = item.quantity;
        const totalPrice = Math.round(unitPrice * qty * 100) / 100;
        totalAmount += totalPrice;
        return { ...item, product_name: productName, unit_price: unitPrice, total_price: totalPrice };
      });

      // Generate reference: PO-YYYYMMDD-XXX
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = get(
        "SELECT COUNT(*) as c FROM purchase_orders WHERE restaurant_id = ? AND date(created_at) = date('now')",
        [rid]
      );
      const seq = String((countToday?.c || 0) + 1).padStart(3, '0');
      const ref = reference || `PO-${today}-${seq}`;

      const result = run(
        `INSERT INTO purchase_orders (supplier_id, reference, notes, total_amount, expected_delivery, status, restaurant_id)
         VALUES (?, ?, ?, ?, ?, 'brouillon', ?)`,
        [Number(supplier_id), ref, notes || null, Math.round(totalAmount * 100) / 100, expected_delivery || null, rid]
      );
      const poId = result.lastInsertRowid;

      for (const item of resolvedItems) {
        run(
          `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_name, quantity, unit, unit_price, total_price, notes, restaurant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [poId, item.ingredient_id || null, item.product_name, item.quantity, item.unit || 'kg', item.unit_price, item.total_price, item.notes || null, rid]
        );
      }

      return poId;
    });

    const poId = transaction();
    const po = get(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
       WHERE po.id = ? AND po.restaurant_id = ?`,
      [rid, poId, rid]
    );
    const poItems = all(
      `SELECT poi.*, i.name as ingredient_name
       FROM purchase_order_items poi
       LEFT JOIN ingredients i ON i.id = poi.ingredient_id AND i.restaurant_id = ?
       WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?`,
      [rid, poId, rid]
    );

    res.status(201).json({ ...po, items: poItems });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/purchase-orders/:id — Update a purchase order (only brouillon status)
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const po = get('SELECT * FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });

    const { status, notes, expected_delivery, items } = req.body;

    // Status transitions
    if (status) {
      const validTransitions = {
        'brouillon': ['envoyée', 'annulée'],
        'envoyée': ['confirmée', 'annulée'],
        'confirmée': ['réceptionnée', 'annulée'],
        'réceptionnée': [],
        'annulée': ['brouillon']
      };

      const allowed = validTransitions[po.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `Transition ${po.status} → ${status} non autorisée` });
      }

      let extra = '';
      if (status === 'envoyée') extra = ", sent_at = CURRENT_TIMESTAMP";
      if (status === 'réceptionnée') extra = ", received_at = CURRENT_TIMESTAMP";

      run(
        `UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP${extra} WHERE id = ? AND restaurant_id = ?`,
        [status, id, rid]
      );
    }

    if (notes !== undefined) {
      run(
        'UPDATE purchase_orders SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
        [notes, id, rid]
      );
    }
    if (expected_delivery !== undefined) {
      run(
        'UPDATE purchase_orders SET expected_delivery = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
        [expected_delivery, id, rid]
      );
    }

    // Update items if provided (only for brouillon)
    if (items && Array.isArray(items) && (po.status === 'brouillon' || status === 'brouillon')) {
      const transaction = db.transaction(() => {
        run(
          'DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?',
          [id, rid]
        );
        let totalAmount = 0;

        for (const item of items) {
          let productName = item.product_name;
          if (!productName && item.ingredient_id) {
            const ing = get('SELECT name FROM ingredients WHERE id = ? AND restaurant_id = ?', [item.ingredient_id, rid]);
            productName = ing ? ing.name : `Ingrédient #${item.ingredient_id}`;
          }
          const unitPrice = item.unit_price || 0;
          const qty = item.quantity || 0;
          const totalPrice = Math.round(unitPrice * qty * 100) / 100;
          totalAmount += totalPrice;

          run(
            `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_name, quantity, unit, unit_price, total_price, notes, restaurant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, item.ingredient_id || null, productName, qty, item.unit || 'kg', unitPrice, totalPrice, item.notes || null, rid]
          );
        }

        run(
          'UPDATE purchase_orders SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
          [Math.round(totalAmount * 100) / 100, id, rid]
        );
      });
      transaction();
    }

    // Return updated
    const updated = get(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
       WHERE po.id = ? AND po.restaurant_id = ?`,
      [rid, id, rid]
    );
    const updatedItems = all(
      `SELECT poi.*, i.name as ingredient_name
       FROM purchase_order_items poi
       LEFT JOIN ingredients i ON i.id = poi.ingredient_id AND i.restaurant_id = ?
       WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?`,
      [rid, id, rid]
    );
    res.json({ ...updated, items: updatedItems });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/purchase-orders/:id/receive — Receive a purchase order (creates stock movements)
router.post('/:id/receive', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const po = get('SELECT * FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });
    if (po.status !== 'confirmée' && po.status !== 'envoyée') {
      return res.status(400).json({ error: 'Cette commande ne peut pas être réceptionnée' });
    }

    const items = all(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?',
      [id, rid]
    );
    const { reception_notes } = req.body || {};

    const transaction = db.transaction(() => {
      // Update PO status
      run(
        "UPDATE purchase_orders SET status = 'réceptionnée', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes || ' | ', '') || ? WHERE id = ? AND restaurant_id = ?",
        [reception_notes ? `Réception: ${reception_notes}` : '', id, rid]
      );

      // Create stock movements for each item with an ingredient_id
      for (const item of items) {
        if (!item.ingredient_id) continue;

        // Record stock movement (reception)
        run(
          `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, supplier_id, unit_price, recorded_at, restaurant_id)
           VALUES (?, 'reception', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [item.ingredient_id, item.quantity, item.unit, `Commande ${po.reference}`, po.supplier_id, item.unit_price, rid]
        );

        // Update stock
        const stock = get('SELECT * FROM stock WHERE ingredient_id = ? AND restaurant_id = ?', [item.ingredient_id, rid]);
        if (stock) {
          run(
            'UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ? AND restaurant_id = ?',
            [item.quantity, item.ingredient_id, rid]
          );
        } else {
          run(
            'INSERT INTO stock (ingredient_id, quantity, unit, restaurant_id) VALUES (?, ?, ?, ?)',
            [item.ingredient_id, item.quantity, item.unit, rid]
          );
        }

        // Update price history (price_history may be tenant-scoped; include if column present)
        if (item.unit_price > 0) {
          run(
            'INSERT INTO price_history (ingredient_id, supplier_id, price, recorded_at, restaurant_id) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)',
            [item.ingredient_id, po.supplier_id, item.unit_price, rid]
          );

          // Update supplier_prices (tenant-scoped)
          const existing = get(
            'SELECT id FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ? AND restaurant_id = ?',
            [item.ingredient_id, po.supplier_id, rid]
          );
          if (existing) {
            run(
              'UPDATE supplier_prices SET price = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
              [item.unit_price, existing.id, rid]
            );
          } else {
            run(
              'INSERT INTO supplier_prices (ingredient_id, supplier_id, price, unit, restaurant_id) VALUES (?, ?, ?, ?, ?)',
              [item.ingredient_id, po.supplier_id, item.unit_price, item.unit, rid]
            );
          }
        }
      }
    });

    transaction();

    const updated = get(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
       WHERE po.id = ? AND po.restaurant_id = ?`,
      [rid, id, rid]
    );
    const updatedItems = all(
      `SELECT poi.*, i.name as ingredient_name
       FROM purchase_order_items poi
       LEFT JOIN ingredients i ON i.id = poi.ingredient_id AND i.restaurant_id = ?
       WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?`,
      [rid, id, rid]
    );
    res.json({ ...updated, items: updatedItems, stock_updated: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/purchase-orders/:id — Delete (only brouillon)
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const po = get('SELECT * FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });
    if (po.status !== 'brouillon' && po.status !== 'annulée') {
      return res.status(400).json({ error: 'Seules les commandes brouillon/annulées peuvent être supprimées' });
    }

    run('DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?', [id, rid]);
    run('DELETE FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// POST /api/purchase-orders/:id/clone — Dupliquer une commande
// Crée un brouillon à partir d'une commande existante
// ═══════════════════════════════════════════
router.post('/:id/clone', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const po = get('SELECT * FROM purchase_orders WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });

    const items = all(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?',
      [id, rid]
    );

    const transaction = db.transaction(() => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = get(
        "SELECT COUNT(*) as c FROM purchase_orders WHERE restaurant_id = ? AND date(created_at) = date('now')",
        [rid]
      );
      const seq = String((countToday?.c || 0) + 1).padStart(3, '0');
      const ref = `PO-${today}-${seq}`;

      const result = run(
        `INSERT INTO purchase_orders (supplier_id, reference, notes, total_amount, status, restaurant_id)
         VALUES (?, ?, ?, ?, 'brouillon', ?)`,
        [po.supplier_id, ref, `Dupliqué de ${po.reference}`, po.total_amount, rid]
      );
      const newId = result.lastInsertRowid;

      for (const item of items) {
        // Fetch latest price for each ingredient (tenant-scoped)
        let latestPrice = item.unit_price;
        if (item.ingredient_id) {
          const sp = get(
            'SELECT price FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ? AND restaurant_id = ? ORDER BY last_updated DESC LIMIT 1',
            [item.ingredient_id, po.supplier_id, rid]
          );
          if (sp) latestPrice = sp.price;
        }

        run(
          `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_name, quantity, unit, unit_price, total_price, notes, restaurant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId, item.ingredient_id, item.product_name, item.quantity, item.unit, latestPrice,
           Math.round(latestPrice * item.quantity * 100) / 100, item.notes, rid]
        );
      }

      // Recalculate total
      const totalResult = get(
        'SELECT SUM(total_price) as total FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?',
        [newId, rid]
      );
      run(
        'UPDATE purchase_orders SET total_amount = ? WHERE id = ? AND restaurant_id = ?',
        [totalResult.total || 0, newId, rid]
      );

      return newId;
    });

    const newId = transaction();
    const newPo = get(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.restaurant_id = ?
       WHERE po.id = ? AND po.restaurant_id = ?`,
      [rid, newId, rid]
    );
    const newItems = all(
      `SELECT poi.*, i.name as ingredient_name
       FROM purchase_order_items poi
       LEFT JOIN ingredients i ON i.id = poi.ingredient_id AND i.restaurant_id = ?
       WHERE poi.purchase_order_id = ? AND poi.restaurant_id = ?`,
      [rid, newId, rid]
    );

    res.status(201).json({ ...newPo, items: newItems });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
