'use strict';

// Supplier-side external integrations (FoodFlow first; pluggable for Metro etc.).
// Path: /api/supplier-integrations  (distinct from /api/integrations which serves
// the restaurant-level TheFork/POS/Deliveroo concept).
//
// Per-(supplier, provider) connection. Sync upserts the supplier's mercuriale
// into supplier_catalog using the same shape as POST /supplier-portal/save-mercuriale.
// Auth: requireAuth + tenant-scoped — every query filters by req.user.restaurant_id
// and cross-tenant lookups return 404 (per project convention, see
// feedback_cross_tenant_404_not_403).

const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const { getProvider, listProviders } = require('../lib/integrations');

const router = Router();
router.use(requireAuth);

// ─── Helpers ─────────────────────────────────────────────────────────

function ownedSupplier(supplierId, rid) {
  return get('SELECT * FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplierId, rid]);
}

function ownedIntegration(id, rid) {
  return get('SELECT * FROM supplier_integrations WHERE id = ? AND restaurant_id = ?', [id, rid]);
}

function publicRow(row) {
  if (!row) return null;
  // credentials are intentionally NOT returned — write-only.
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    supplier_id: row.supplier_id,
    provider: row.provider,
    external_id: row.external_id,
    status: row.status,
    last_sync_at: row.last_sync_at,
    last_sync_error: row.last_sync_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────

// GET /api/supplier-integrations — list this tenant's connections
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const rows = all(
      `SELECT si.*, s.name as supplier_name
         FROM supplier_integrations si
         LEFT JOIN suppliers s ON s.id = si.supplier_id AND s.restaurant_id = ?
        WHERE si.restaurant_id = ?
        ORDER BY si.updated_at DESC`,
      [rid, rid]
    );
    res.json(rows.map(r => ({ ...publicRow(r), supplier_name: r.supplier_name })));
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/supplier-integrations/providers — list the providers this server supports
router.get('/providers', (req, res) => {
  res.json({ providers: listProviders() });
});

// GET /api/supplier-integrations/:id — read a single connection
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ error: 'Intégration introuvable' });
    const row = ownedIntegration(id, rid);
    if (!row) return res.status(404).json({ error: 'Intégration introuvable' });
    res.json(publicRow(row));
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/supplier-integrations — connect a supplier to an external provider
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { supplier_id, provider, external_id, credentials } = req.body || {};

    if (!supplier_id || !provider || !external_id) {
      return res.status(400).json({ error: 'supplier_id, provider, external_id requis' });
    }

    const adapter = getProvider(provider);
    if (!adapter) {
      return res.status(400).json({ error: `provider inconnu : ${provider}` });
    }

    // Format check first — cheaper than a DB roundtrip, and lets the caller
    // distinguish "bad input" (400) from "already connected" (409).
    const auth = adapter.authenticate({ external_id, credentials });
    if (!auth.ok) {
      return res.status(400).json({ error: auth.error || `Authentification ${provider} échouée` });
    }

    const supplier = ownedSupplier(Number(supplier_id), rid);
    if (!supplier) {
      // 404 (not 403) — hide id existence from cross-tenant probes.
      return res.status(404).json({ error: 'Fournisseur introuvable' });
    }

    const existing = get(
      'SELECT id FROM supplier_integrations WHERE supplier_id = ? AND provider = ? AND restaurant_id = ?',
      [Number(supplier_id), provider, rid]
    );
    if (existing) {
      return res.status(409).json({ error: 'Intégration déjà active pour ce fournisseur' });
    }

    const info = run(
      `INSERT INTO supplier_integrations
         (restaurant_id, supplier_id, provider, external_id, credentials, status)
       VALUES (?, ?, ?, ?, ?, 'connected')`,
      [rid, Number(supplier_id), provider, external_id, credentials ? JSON.stringify(credentials) : null]
    );

    writeAudit({
      restaurant_id: rid,
      account_id: req.user.id,
      table_name: 'supplier_integrations',
      record_id: info.lastInsertRowid,
      action: 'create',
      new_values: { supplier_id: Number(supplier_id), provider, external_id, status: 'connected' },
    });

    const row = get('SELECT * FROM supplier_integrations WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(publicRow(row));
  } catch (e) {
    console.error('supplier-integrations connect error:', e.message);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/supplier-integrations/:id/sync — pull mercuriale via the provider
// adapter and upsert into supplier_catalog. v1 expects items[] in the body
// (file-import shim); v2 will fetch from the provider HTTP API instead.
router.post('/:id/sync', (req, res) => {
  const rid = req.user.restaurant_id;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(404).json({ error: 'Intégration introuvable' });

  const integ = ownedIntegration(id, rid);
  if (!integ) return res.status(404).json({ error: 'Intégration introuvable' });

  const adapter = getProvider(integ.provider);
  if (!adapter) {
    return res.status(500).json({ error: `Adaptateur ${integ.provider} indisponible` });
  }

  const { items } = req.body || {};
  const result = adapter.fetchMercuriale({
    external_id: integ.external_id,
    credentials: integ.credentials ? safeJSON(integ.credentials) : null,
    items,
  });
  if (!result.ok) {
    run(
      `UPDATE supplier_integrations
          SET last_sync_error = ?, status = 'error', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND restaurant_id = ?`,
      [result.error || 'sync failed', id, rid]
    );
    return res.status(400).json({ error: result.error || 'Synchronisation impossible' });
  }

  let created = 0;
  let updated = 0;
  const supplierId = integ.supplier_id;

  const tx = db.transaction(() => {
    for (const it of result.items) {
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

    run(
      `UPDATE supplier_integrations
          SET last_sync_at = CURRENT_TIMESTAMP,
              last_sync_error = NULL,
              status = 'connected',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND restaurant_id = ?`,
      [id, rid]
    );
  });

  try {
    tx();
  } catch (e) {
    console.error('supplier-integrations sync error:', e.message);
    return res.status(500).json({ error: 'Erreur enregistrement' });
  }

  writeAudit({
    restaurant_id: rid,
    account_id: req.user.id,
    table_name: 'supplier_integrations',
    record_id: id,
    action: 'update',
    new_values: { sync: 'ok', provider: integ.provider, created, updated, total: created + updated },
  });

  res.json({ ok: true, created, updated, total: created + updated });
});

// DELETE /api/supplier-integrations/:id — disconnect
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ error: 'Intégration introuvable' });

    const integ = ownedIntegration(id, rid);
    if (!integ) return res.status(404).json({ error: 'Intégration introuvable' });

    run('DELETE FROM supplier_integrations WHERE id = ? AND restaurant_id = ?', [id, rid]);

    writeAudit({
      restaurant_id: rid,
      account_id: req.user.id,
      table_name: 'supplier_integrations',
      record_id: id,
      action: 'delete',
      old_values: { supplier_id: integ.supplier_id, provider: integ.provider, external_id: integ.external_id },
    });

    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ─── Hook used by purchase-orders.js when a PO transitions to 'envoyée' ───
// Looks up an active integration for the supplier and dispatches via the
// provider adapter. Failures are swallowed (logged) so they never roll back
// the order transition. Returns the dispatch result for audit purposes, or
// null if no integration is configured.
function dispatchOrder({ rid, supplier_id, order }) {
  try {
    const integ = get(
      `SELECT * FROM supplier_integrations
         WHERE supplier_id = ? AND restaurant_id = ? AND status = 'connected'
         ORDER BY id DESC LIMIT 1`,
      [supplier_id, rid]
    );
    if (!integ) return null;
    const adapter = getProvider(integ.provider);
    if (!adapter) return null;
    const r = adapter.postOrder({
      external_id: integ.external_id,
      credentials: integ.credentials ? safeJSON(integ.credentials) : null,
      order,
    });
    return { provider: integ.provider, integration_id: integ.id, ...r };
  } catch (e) {
    console.warn('supplier-integrations dispatchOrder failed:', e.message);
    return null;
  }
}

module.exports = router;
module.exports.dispatchOrder = dispatchOrder;
