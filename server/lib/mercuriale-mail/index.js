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
const { processInbound, pickAttachment } = require('./process-inbound');
const { buildOrderXlsx } = require('./build-outbound');
const { matchRestaurant } = require('./match-restaurant');

const ADMIN_ALERT_EMAIL = 'barbierpaulaymeric@gmail.com';

function defaultLookupSupplier(senderEmail, restaurantId) {
  return get(
    'SELECT id FROM suppliers WHERE LOWER(email) = LOWER(?) AND restaurant_id = ?',
    [senderEmail, restaurantId]
  );
}

function dbLookups() {
  return {
    byExternalId: (id) => get(
      `SELECT restaurant_id AS restaurantId, supplier_id AS supplierId
         FROM supplier_integrations
        WHERE LOWER(external_id) = LOWER(?)
          AND provider = 'foodflow'
          AND status = 'connected'
        ORDER BY id DESC LIMIT 1`,
      [id]
    ) || null,
    byEmail: (e) => get(
      `SELECT restaurant_id AS restaurantId
         FROM accounts
        WHERE LOWER(email) = LOWER(?)
          AND restaurant_id IS NOT NULL
        ORDER BY id DESC LIMIT 1`,
      [e]
    ) || null,
    byName: (n) => get(
      `SELECT id AS restaurantId
         FROM restaurants
        WHERE LOWER(name) = LOWER(?)
        ORDER BY id DESC LIMIT 1`,
      [n]
    ) || null,
  };
}

function buildUnmatchedAlert(email) {
  const subject = email.subject ? String(email.subject) : '(sans objet)';
  const from = email.from ? String(email.from) : '(expéditeur inconnu)';
  const date = email.date ? new Date(email.date).toISOString() : '(sans date)';
  const att = pickAttachment(email.attachments);
  const attachmentName = att ? att.filename : '(aucune pièce jointe XLSX)';
  const body = String(email.text || '').slice(0, 4000);

  return {
    to: ADMIN_ALERT_EMAIL,
    subject: `[RestoSuite] Mercuriale non rattachée — ${from}`,
    text: [
      `Une mercuriale reçue n'a pas pu être rattachée à un restaurant.`,
      ``,
      `Expéditeur : ${from}`,
      `Sujet : ${subject}`,
      `Date : ${date}`,
      `Pièce jointe : ${attachmentName}`,
      ``,
      `--- Contenu de l'email ---`,
      body,
    ].join('\n'),
  };
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

async function runInboundCycle({ fetchFn, sendAlertFn } = {}) {
  const fetcher = fetchFn || (async () => {
    const { fetchUnseen } = require('./imap-client');
    return fetchUnseen({ markSeen: true });
  });
  const alerter = sendAlertFn || (async (args) => {
    const { sendPlainEmail } = require('./smtp-client');
    return sendPlainEmail(args);
  });
  const emails = await fetcher();
  const result = { processed: 0, matched: 0, items_upserted: 0, unmatched_alerts: 0, errors: [] };

  for (const email of emails) {
    result.processed++;

    // Step 1: try identifier-based match (external_id, account email,
    // restaurant name found in subject/body/Excel banner). FoodFlow and
    // similar wholesalers send from one shared address for many clients,
    // so the sender alone can't pick the right tenant.
    const att = pickAttachment(email.attachments);
    const excelBuffer = att && Buffer.isBuffer(att.content) ? att.content : null;
    let match = null;
    try {
      match = matchRestaurant({ email, excelBuffer, lookups: dbLookups() });
    } catch (e) {
      result.errors.push({ uid: email.uid, error: e.message });
    }

    if (match && match.restaurantId) {
      try {
        const out = processInbound({
          email,
          restaurantId: match.restaurantId,
          lookupSupplier: (sender, rid) => match.supplierId
            ? { id: match.supplierId }
            : defaultLookupSupplier(sender, rid),
        });
        if (out.ok) {
          const n = upsertCatalog(match.restaurantId, out.supplierId, out.items);
          result.items_upserted += n;
          result.matched++;
          console.log(
            `📧 Mercuriale matched uid=${email.uid} restaurant=${match.restaurantId}`
              + ` via ${match.matchedBy}=${match.matchedValue}`
              + ` supplier=${out.supplierId} items=${n}`
          );
          continue;
        }
      } catch (e) {
        result.errors.push({ uid: email.uid, error: e.message });
      }
    }

    // Step 2: legacy fallback — sender email → suppliers.email across all
    // restaurants. Single-tenant installs and pre-existing flows still rely
    // on this path.
    let legacyHit = false;
    const restaurants = all('SELECT id FROM restaurants');
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
          legacyHit = true;
          console.log(
            `📧 Mercuriale matched uid=${email.uid} restaurant=${r.id}`
              + ` via sender=${email.from} supplier=${out.supplierId} items=${n}`
          );
        } catch (e) {
          result.errors.push({ uid: email.uid, error: e.message });
        }
        break;
      }
    }
    if (legacyHit) continue;

    // Step 3: nothing matched — alert the platform admin so the routing
    // mapping can be added (or to flag the email as junk).
    try {
      await alerter(buildUnmatchedAlert(email));
      result.unmatched_alerts++;
      console.warn(
        `📧 Mercuriale unmatched uid=${email.uid} from=${email.from}`
          + ` subject="${(email.subject || '').slice(0, 80)}" — alert sent`
      );
    } catch (e) {
      result.errors.push({ uid: email.uid, error: `alert: ${e.message}` });
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
