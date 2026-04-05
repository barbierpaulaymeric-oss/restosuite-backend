const { Router } = require('express');
const { all, get, run, db } = require('../db');
const router = Router();

// GET /api/purchase-orders — List all purchase orders
router.get('/', (req, res) => {
  try {
    const { status, supplier_id } = req.query;
    let sql = `SELECT po.*, s.name as supplier_name
               FROM purchase_orders po
               LEFT JOIN suppliers s ON s.id = po.supplier_id`;
    const conditions = [];
    const params = [];

    if (status) { conditions.push('po.status = ?'); params.push(status); }
    if (supplier_id) { conditions.push('po.supplier_id = ?'); params.push(Number(supplier_id)); }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY po.created_at DESC';

    const orders = all(sql, params);

    // Enrich with items
    const enriched = orders.map(po => {
      const items = all(`
        SELECT poi.*, i.name as ingredient_name, i.default_unit as ingredient_unit
        FROM purchase_order_items poi
        LEFT JOIN ingredients i ON i.id = poi.ingredient_id
        WHERE poi.purchase_order_id = ?
      `, [po.id]);
      return { ...po, items };
    });

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

// GET /api/purchase-orders/suggest — Suggest items based on low stock
// IMPORTANT: Must be BEFORE /:id to avoid Express matching "suggest" as an ID
router.get('/suggest', (req, res) => {
  try {
    // Find all ingredients where current stock is below min_quantity
    const lowStock = all(`
      SELECT s.ingredient_id, s.quantity as current_qty, s.min_quantity, s.unit,
             i.name as ingredient_name, i.preferred_supplier_id,
             sp.price as last_price, sp.unit as price_unit,
             sup.name as supplier_name, sup.id as supplier_id
      FROM stock s
      JOIN ingredients i ON i.id = s.ingredient_id
      LEFT JOIN supplier_prices sp ON sp.ingredient_id = i.id
      LEFT JOIN suppliers sup ON sup.id = COALESCE(i.preferred_supplier_id, sp.supplier_id)
      WHERE s.quantity <= s.min_quantity AND s.min_quantity > 0
      ORDER BY (s.min_quantity - s.quantity) DESC
    `);

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
    res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

// GET /api/purchase-orders/:id — Detail
router.get('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const po = get(`SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone
                     FROM purchase_orders po
                     LEFT JOIN suppliers s ON s.id = po.supplier_id
                     WHERE po.id = ?`, [id]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });

    const items = all(`
      SELECT poi.*, i.name as ingredient_name, i.default_unit as ingredient_unit
      FROM purchase_order_items poi
      LEFT JOIN ingredients i ON i.id = poi.ingredient_id
      WHERE poi.purchase_order_id = ?
    `, [po.id]);

    res.json({ ...po, items });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

// POST /api/purchase-orders — Create a purchase order
router.post('/', (req, res) => {
  try {
    const { supplier_id, items, notes, expected_delivery, reference } = req.body;

    if (!supplier_id) return res.status(400).json({ error: 'supplier_id requis' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article requis' });
    }

    // Verify supplier exists
    const supplier = get('SELECT id FROM suppliers WHERE id = ?', [Number(supplier_id)]);
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
          const ing = get('SELECT name FROM ingredients WHERE id = ?', [item.ingredient_id]);
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
      const countToday = get("SELECT COUNT(*) as c FROM purchase_orders WHERE date(created_at) = date('now')");
      const seq = String((countToday?.c || 0) + 1).padStart(3, '0');
      const ref = reference || `PO-${today}-${seq}`;

      const result = run(
        `INSERT INTO purchase_orders (supplier_id, reference, notes, total_amount, expected_delivery, status)
         VALUES (?, ?, ?, ?, ?, 'brouillon')`,
        [Number(supplier_id), ref, notes || null, Math.round(totalAmount * 100) / 100, expected_delivery || null]
      );
      const poId = result.lastInsertRowid;

      for (const item of resolvedItems) {
        run(
          `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_name, quantity, unit, unit_price, total_price, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [poId, item.ingredient_id || null, item.product_name, item.quantity, item.unit || 'kg', item.unit_price, item.total_price, item.notes || null]
        );
      }

      return poId;
    });

    const poId = transaction();
    const po = get('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?', [poId]);
    const poItems = all(`SELECT poi.*, i.name as ingredient_name FROM purchase_order_items poi LEFT JOIN ingredients i ON i.id = poi.ingredient_id WHERE poi.purchase_order_id = ?`, [poId]);

    res.status(201).json({ ...po, items: poItems });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

// PUT /api/purchase-orders/:id — Update a purchase order (only brouillon status)
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const po = get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
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

      run(`UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP${extra} WHERE id = ?`, [status, id]);
    }

    if (notes !== undefined) {
      run('UPDATE purchase_orders SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [notes, id]);
    }
    if (expected_delivery !== undefined) {
      run('UPDATE purchase_orders SET expected_delivery = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [expected_delivery, id]);
    }

    // Update items if provided (only for brouillon)
    if (items && Array.isArray(items) && (po.status === 'brouillon' || status === 'brouillon')) {
      const transaction = db.transaction(() => {
        run('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
        let totalAmount = 0;

        for (const item of items) {
          let productName = item.product_name;
          if (!productName && item.ingredient_id) {
            const ing = get('SELECT name FROM ingredients WHERE id = ?', [item.ingredient_id]);
            productName = ing ? ing.name : `Ingrédient #${item.ingredient_id}`;
          }
          const unitPrice = item.unit_price || 0;
          const qty = item.quantity || 0;
          const totalPrice = Math.round(unitPrice * qty * 100) / 100;
          totalAmount += totalPrice;

          run(
            `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_name, quantity, unit, unit_price, total_price, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, item.ingredient_id || null, productName, qty, item.unit || 'kg', unitPrice, totalPrice, item.notes || null]
          );
        }

        run('UPDATE purchase_orders SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [Math.round(totalAmount * 100) / 100, id]);
      });
      transaction();
    }

    // Return updated
    const updated = get('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?', [id]);
    const updatedItems = all(`SELECT poi.*, i.name as ingredient_name FROM purchase_order_items poi LEFT JOIN ingredients i ON i.id = poi.ingredient_id WHERE poi.purchase_order_id = ?`, [id]);
    res.json({ ...updated, items: updatedItems });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

// POST /api/purchase-orders/:id/receive — Receive a purchase order (creates stock movements)
router.post('/:id/receive', (req, res) => {
  try {
    const id = Number(req.params.id);
    const po = get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });
    if (po.status !== 'confirmée' && po.status !== 'envoyée') {
      return res.status(400).json({ error: 'Cette commande ne peut pas être réceptionnée' });
    }

    const items = all('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
    const { reception_notes } = req.body || {};

    const transaction = db.transaction(() => {
      // Update PO status
      run("UPDATE purchase_orders SET status = 'réceptionnée', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, notes = COALESCE(notes || ' | ', '') || ? WHERE id = ?",
        [reception_notes ? `Réception: ${reception_notes}` : '', id]);

      // Create stock movements for each item with an ingredient_id
      for (const item of items) {
        if (!item.ingredient_id) continue;

        // Record stock movement (reception)
        run(
          `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, unit, reason, supplier_id, unit_price, recorded_at)
           VALUES (?, 'reception', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [item.ingredient_id, item.quantity, item.unit, `Commande ${po.reference}`, po.supplier_id, item.unit_price]
        );

        // Update stock
        const stock = get('SELECT * FROM stock WHERE ingredient_id = ?', [item.ingredient_id]);
        if (stock) {
          run('UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE ingredient_id = ?',
            [item.quantity, item.ingredient_id]);
        } else {
          run('INSERT INTO stock (ingredient_id, quantity, unit) VALUES (?, ?, ?)',
            [item.ingredient_id, item.quantity, item.unit]);
        }

        // Update price history
        if (item.unit_price > 0) {
          run('INSERT INTO price_history (ingredient_id, supplier_id, price, recorded_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [item.ingredient_id, po.supplier_id, item.unit_price]);

          // Update supplier_prices
          const existing = get('SELECT id FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ?', [item.ingredient_id, po.supplier_id]);
          if (existing) {
            run('UPDATE supplier_prices SET price = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [item.unit_price, existing.id]);
          } else {
            run('INSERT INTO supplier_prices (ingredient_id, supplier_id, price, unit) VALUES (?, ?, ?, ?)',
              [item.ingredient_id, po.supplier_id, item.unit_price, item.unit]);
          }
        }
      }
    });

    transaction();

    const updated = get('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?', [id]);
    const updatedItems = all(`SELECT poi.*, i.name as ingredient_name FROM purchase_order_items poi LEFT JOIN ingredients i ON i.id = poi.ingredient_id WHERE poi.purchase_order_id = ?`, [id]);
    res.json({ ...updated, items: updatedItems, stock_updated: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

// DELETE /api/purchase-orders/:id — Delete (only brouillon)
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const po = get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
    if (!po) return res.status(404).json({ error: 'Commande introuvable' });
    if (po.status !== 'brouillon' && po.status !== 'annulée') {
      return res.status(400).json({ error: 'Seules les commandes brouillon/annulées peuvent être supprimées' });
    }

    run('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
    run('DELETE FROM purchase_orders WHERE id = ?', [id]);
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur', details: e.message });
  }
});

module.exports = router;
