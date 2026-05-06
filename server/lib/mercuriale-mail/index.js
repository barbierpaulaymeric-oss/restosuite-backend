'use strict';

// Orchestrator for the email-based mercuriale flow.
//   runInboundCycle({ fetchFn? })   — pulls UNSEEN emails, identifies the
//                                     destination restaurant + supplier from
//                                     the mail content (subject/body/Excel),
//                                     auto-creating the supplier row when a
//                                     restaurant is matched but the supplier
//                                     is unknown, then upserts items into
//                                     supplier_catalog.
//   dispatchOrderEmail({ rid, supplier_id, po_id, sendFn? })
//                                   — builds an XLSX from the PO + integration
//                                     metadata, sends it to the supplier.
//
// Routing philosophy: WHO sent the mail is a fallback signal — WHAT's in the
// mail (restaurant name / account email / external_id / supplier name in
// the "Fournisseur" Excel column) is canonical. FoodFlow ships from one
// shared address for many tenants and end users can forward their own
// mercuriale, so sender-only routing is not enough.
//
// fetchFn / sendFn are injectable so tests don't need a live IMAP/SMTP server.
// Production callers omit them; the wrappers in ./imap-client and ./smtp-client
// are loaded lazily so that simply requiring this module never opens a socket.

const { db, get, all, run } = require('../../db');
const { processInbound, pickAttachment } = require('./process-inbound');
const { buildOrderXlsx } = require('./build-outbound');
const { matchRestaurant, extractSupplierNamesFromXlsx } = require('./match-restaurant');

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

// Resolve the supplier from the Excel "Fournisseur" column (case-insensitive
// name match against suppliers WHERE restaurant_id = ?). Auto-creates a new
// supplier row when no name matches, so a fresh tenant receiving its first
// mercuriale doesn't bounce off an alert. Returns null only when the Excel
// has no "Fournisseur" values at all.
function resolveOrCreateSupplier(restaurantId, supplierNames) {
  if (!supplierNames || !supplierNames.length) return null;
  for (const name of supplierNames) {
    const hit = get(
      'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?) AND restaurant_id = ?',
      [name, restaurantId]
    );
    if (hit && hit.id) {
      return { id: hit.id, name, autoCreated: false };
    }
  }
  const newName = supplierNames[0].slice(0, 120);
  const info = run(
    'INSERT INTO suppliers (restaurant_id, name) VALUES (?, ?)',
    [restaurantId, newName]
  );
  return { id: info.lastInsertRowid, name: newName, autoCreated: true };
}

function formatIdentifiersBlock(identifiers, supplierResolution) {
  const ids = identifiers || {};
  const lines = ['--- Identifiants extraits ---'];
  lines.push(`Noms de restaurant : ${(ids.names || []).join(', ') || '(aucun)'}`);
  lines.push(`Emails : ${(ids.emails || []).join(', ') || '(aucun)'}`);
  lines.push(`external_id / références : ${(ids.externalIds || []).join(', ') || '(aucun)'}`);
  lines.push(`Fournisseurs (colonne Excel) : ${(ids.supplierNames || []).join(', ') || '(aucun)'}`);
  if (supplierResolution) {
    lines.push(`Résolution fournisseur : ${supplierResolution}`);
  }
  return lines.join('\n');
}

function buildUnmatchedAlert(email, identifiers) {
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
      formatIdentifiersBlock(identifiers, null),
      ``,
      `--- Contenu de l'email ---`,
      body,
    ].join('\n'),
  };
}

// Upsert mercuriale items into supplier_catalog for one (supplier, restaurant)
// pair. Returns detailed counts: created/updated/unchanged. An item is
// considered "unchanged" — and therefore silently skipped — when name, price,
// unit, sku, packaging and tva_rate all match the existing row, so we don't
// bump updated_at or fire downstream notifications for a no-op import.
// Backward-compatible: still returns a number-coercible total via valueOf so
// callers that did `+= upsertCatalog(...)` keep working.
function upsertCatalog(rid, supplierId, items) {
  let created = 0, updated = 0, unchanged = 0;
  const tx = db.transaction(() => {
    for (const it of items) {
      let existing = null;
      if (it.sku) {
        existing = get(
          'SELECT * FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(sku) = LOWER(?)',
          [supplierId, rid, it.sku]
        );
      }
      if (!existing) {
        existing = get(
          'SELECT * FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(product_name) = LOWER(?)',
          [supplierId, rid, it.name]
        );
      }
      if (existing) {
        if (catalogRowMatches(existing, it)) {
          unchanged++;
          continue;
        }
        // Always overwrite with the incoming mercuriale data — suppliers re-send
        // mercuriales weekly/monthly, the latest version is authoritative.
        run(
          `UPDATE supplier_catalog
              SET product_name = ?, category = ?, unit = ?, price = ?,
                  sku = ?, tva_rate = ?, packaging = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND restaurant_id = ?`,
          [it.name, it.category, it.unit, it.price, it.sku, it.tva_rate, it.packaging, existing.id, rid]
        );
        // Audit price evolution so the restaurateur can review history later.
        if (Number(existing.price) !== Number(it.price)) {
          run(
            `INSERT INTO price_change_notifications
               (restaurant_id, supplier_id, product_name, old_price, new_price, change_type)
             VALUES (?, ?, ?, ?, ?, 'update')`,
            [rid, supplierId, it.name, existing.price, it.price]
          );
        }
        updated++;
      } else {
        run(
          `INSERT INTO supplier_catalog
             (restaurant_id, supplier_id, product_name, category, unit, price, sku, tva_rate, packaging)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, supplierId, it.name, it.category, it.unit, it.price, it.sku, it.tva_rate, it.packaging]
        );
        run(
          `INSERT INTO price_change_notifications
             (restaurant_id, supplier_id, product_name, old_price, new_price, change_type)
           VALUES (?, ?, ?, NULL, ?, 'new')`,
          [rid, supplierId, it.name, it.price]
        );
        created++;
      }
    }
  });
  tx();
  // Object that doubles as a number for legacy `n += upsertCatalog(...)` callers.
  const total = created + updated;
  return Object.assign(Object.create({ valueOf() { return total; } }), {
    created, updated, unchanged, total,
  });
}

// True if the new mercuriale item is byte-for-byte identical to the existing
// catalog row on the fields the upsert would otherwise overwrite. Loose-equals
// numeric compare so 1.5 === '1.5' (stringly DB return) doesn't churn rows.
function catalogRowMatches(existing, item) {
  const norm = (v) => v == null || v === '' ? null : v;
  // eslint-disable-next-line eqeqeq
  const numEq = (a, b) => Number(a) == Number(b);
  return (
    norm(existing.product_name) === norm(item.name) &&
    norm(existing.category) === norm(item.category) &&
    norm(existing.unit) === norm(item.unit) &&
    numEq(existing.price, item.price) &&
    norm(existing.sku) === norm(item.sku) &&
    numEq(existing.tva_rate, item.tva_rate || 5.5) &&
    norm(existing.packaging) === norm(item.packaging)
  );
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
  const result = {
    processed: 0,
    matched: 0,
    items_upserted: 0,
    suppliers_created: 0,
    unmatched_alerts: 0,
    errors: [],
  };

  for (const email of emails) {
    result.processed++;

    const att = pickAttachment(email.attachments);
    const excelBuffer = att && Buffer.isBuffer(att.content) ? att.content : null;

    // Step 1: content-based restaurant match (name → email → external_id).
    let match = null;
    try {
      match = matchRestaurant({ email, excelBuffer, lookups: dbLookups() });
    } catch (e) {
      result.errors.push({ uid: email.uid, error: `match: ${e.message}` });
    }
    const identifiers = (match && match.identifiers) || {
      externalIds: [], emails: [], names: [], supplierNames: [],
    };

    if (match && match.restaurantId) {
      // Step 2: resolve the supplier. external_id matches piggyback the
      // supplier_integrations.supplier_id; otherwise look up by name in the
      // Excel "Fournisseur" column (auto-create if absent).
      let supplierId = match.supplierId || null;
      let supplierMatchedBy = match.supplierId ? 'integration' : null;
      let supplierResolution = null;

      if (!supplierId) {
        try {
          const supRes = resolveOrCreateSupplier(match.restaurantId, identifiers.supplierNames);
          if (supRes) {
            supplierId = supRes.id;
            supplierMatchedBy = supRes.autoCreated ? 'auto_created' : 'name';
            supplierResolution = `${supplierMatchedBy}=${supRes.name}`;
            if (supRes.autoCreated) result.suppliers_created++;
          }
        } catch (e) {
          result.errors.push({ uid: email.uid, error: `supplier_resolve: ${e.message}` });
        }
      } else {
        supplierResolution = `integration supplier_id=${supplierId}`;
      }

      if (supplierId) {
        try {
          const out = processInbound({
            email,
            restaurantId: match.restaurantId,
            supplierId,
          });
          if (out.ok) {
            const n = upsertCatalog(match.restaurantId, supplierId, out.items);
            result.items_upserted += n;
            result.matched++;
            console.log(
              `📧 Mercuriale matched uid=${email.uid} restaurant=${match.restaurantId}`
                + ` via ${match.matchedBy}=${match.matchedValue}`
                + ` supplier=${supplierId} (${supplierMatchedBy})`
                + ` items=${Number(n)}`
            );
            continue;
          }
        } catch (e) {
          result.errors.push({ uid: email.uid, error: e.message });
        }
      }
    }

    // Step 3: legacy fallback — sender email → suppliers.email across all
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
              + ` via sender=${email.from} supplier=${out.supplierId} items=${Number(n)}`
          );
        } catch (e) {
          result.errors.push({ uid: email.uid, error: e.message });
        }
        break;
      }
    }
    if (legacyHit) continue;

    // Step 4: nothing matched — alert the platform admin so the routing
    // mapping can be added (or to flag the email as junk). Identifiers
    // included so PA can paste them directly into supplier_integrations or
    // create the missing restaurant/supplier rows.
    try {
      await alerter(buildUnmatchedAlert(email, identifiers));
      result.unmatched_alerts++;
      console.warn(
        `📧 Mercuriale unmatched uid=${email.uid} from=${email.from}`
          + ` subject="${(email.subject || '').slice(0, 80)}"`
          + ` ids={names:[${(identifiers.names || []).join('|')}],`
          + `emails:[${(identifiers.emails || []).join('|')}],`
          + `ext:[${(identifiers.externalIds || []).join('|')}],`
          + `suppliers:[${(identifiers.supplierNames || []).join('|')}]}`
          + ` — alert sent`
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
