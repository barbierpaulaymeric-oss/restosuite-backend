'use strict';

// Orchestrator for the email-based mercuriale flow.
//   runInboundCycle({ fetchFn? })   — pulls UNSEEN emails, matches sender to a
//                                     supplier across all restaurants, upserts
//                                     items into supplier_catalog.
//   dispatchOrderEmail({ rid, supplier_id, po_id, sendFn? })
//                                   — builds an XLSX from the PO + integration
//                                     metadata, sends it to the supplier.
//
// fetchFn / sendFn are injectable so tests don't need a live IMAP/SMTP server.
// Production callers omit them; the wrappers in ./imap-client and ./smtp-client
// are loaded lazily so that simply requiring this module never opens a socket.

const { db, get, all, run } = require('../../db');
const { processInbound } = require('./process-inbound');
const { buildOrderXlsx } = require('./build-outbound');

function defaultLookupSupplier(senderEmail, restaurantId) {
  return get(
    'SELECT id FROM suppliers WHERE LOWER(email) = LOWER(?) AND restaurant_id = ?',
    [senderEmail, restaurantId]
  );
}

function upsertCatalog(rid, supplierId, items) {
  let n = 0;
  const tx = db.transaction(() => {
    for (const it of items) {
      let existing = null;
      if (it.sku) {
        existing = get(
          'SELECT id, price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(sku) = LOWER(?)',
          [supplierId, rid, it.sku]
        );
      }
      if (!existing) {
        existing = get(
          'SELECT id, price FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(product_name) = LOWER(?)',
          [supplierId, rid, it.name]
        );
      }
      if (existing) {
        run(
          `UPDATE supplier_catalog
              SET product_name = ?, category = ?, unit = ?, price = ?,
                  sku = ?, tva_rate = ?, packaging = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND restaurant_id = ?`,
          [it.name, it.category, it.unit, it.price, it.sku, it.tva_rate, it.packaging, existing.id, rid]
        );
      } else {
        run(
          `INSERT INTO supplier_catalog
             (restaurant_id, supplier_id, product_name, category, unit, price, sku, tva_rate, packaging)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, supplierId, it.name, it.category, it.unit, it.price, it.sku, it.tva_rate, it.packaging]
        );
      }
      n++;
    }
  });
  tx();
  return n;
}

async function runInboundCycle({ fetchFn } = {}) {
  const fetcher = fetchFn || (async () => {
    const { fetchUnseen } = require('./imap-client');
    return fetchUnseen({ markSeen: true });
  });
  const emails = await fetcher();
  const result = { processed: 0, matched: 0, items_upserted: 0, errors: [] };

  // Suppliers can belong to any tenant — we resolve by sender email across all
  // restaurants. Most installs share one inbox per tenant, but multi-site
  // setups could share one mailbox; iterate restaurants until a match is found.
  const restaurants = all('SELECT id FROM restaurants');

  for (const email of emails) {
    result.processed++;
    for (const r of restaurants) {
      let out;
      try {
        out = processInbound({
          email,
          restaurantId: r.id,
          lookupSupplier: defaultLookupSupplier,
        });
      } catch (e) {
        result.errors.push({ uid: email.uid, error: e.message });
        break;
      }
      if (out.ok) {
        try {
          const n = upsertCatalog(r.id, out.supplierId, out.items);
          result.items_upserted += n;
          result.matched++;
        } catch (e) {
          result.errors.push({ uid: email.uid, error: e.message });
        }
        break;
      }
    }
  }
  return result;
}

async function dispatchOrderEmail({ rid, supplier_id, po_id, sendFn }) {
  const supplier = get(
    'SELECT id, name, email FROM suppliers WHERE id = ? AND restaurant_id = ?',
    [supplier_id, rid]
  );
  if (!supplier) return { ok: false, error: 'fournisseur introuvable' };
  if (!supplier.email) return { ok: false, error: 'fournisseur sans email' };

  const restaurant = get('SELECT id, name FROM restaurants WHERE id = ?', [rid]);
  const po = get(
    'SELECT id, reference, total_amount, sent_at FROM purchase_orders WHERE id = ? AND restaurant_id = ?',
    [po_id, rid]
  );
  if (!po) return { ok: false, error: 'commande introuvable' };

  const items = all(
    `SELECT product_name, quantity, unit, unit_price, total_price
       FROM purchase_order_items WHERE purchase_order_id = ? AND restaurant_id = ?`,
    [po_id, rid]
  );

  const integration = get(
    `SELECT provider, external_id FROM supplier_integrations
       WHERE supplier_id = ? AND restaurant_id = ? AND status = 'connected'
       ORDER BY id DESC LIMIT 1`,
    [supplier_id, rid]
  );

  const xlsxBuffer = buildOrderXlsx({ restaurant, supplier, integration, po, items });
  const sender = sendFn || (async (args) => {
    const { sendOrderEmail } = require('./smtp-client');
    return sendOrderEmail(args);
  });
  try {
    await sender({
      to: supplier.email,
      subject: `Bon de commande ${po.reference} — ${restaurant && restaurant.name}`,
      text: `Bonjour,\n\nVeuillez trouver ci-joint le bon de commande ${po.reference}.\n\nCordialement,\n${restaurant && restaurant.name}\n\n— Envoyé automatiquement par RestoSuite.`,
      xlsxBuffer,
      filename: `commande-${po.reference}.xlsx`,
    });
    return { ok: true, to: supplier.email };
  } catch (e) {
    return { ok: false, to: supplier.email, error: e.message };
  }
}

module.exports = { runInboundCycle, dispatchOrderEmail, upsertCatalog };
