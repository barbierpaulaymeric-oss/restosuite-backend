'use strict';

// ═══════════════════════════════════════════
// Returns / claims — restaurateur-initiated requests for damaged, wrong,
// missing, or short-DLC products from a delivery. On send, dispatches a
// French structured email to a returns-specific mailbox when available
// (supplier_integrations.returns_email > suppliers.returns_email > suppliers.email).
//
// Status state machine: draft → sent → in_progress → (resolved | rejected).
// rejected → in_progress is allowed so a refused claim can be re-opened after
// the supplier and restaurateur align on a resolution.
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const { all, get, run, db } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const { resolveReturnsEmail, buildEmail } = require('../lib/returns');

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = new Set(['draft', 'sent', 'in_progress', 'resolved', 'rejected']);
const VALID_TYPES = new Set(['return', 'credit']);
const VALID_REASONS = new Set(['qualite', 'quantite', 'dlc', 'abime', 'manquant', 'autre']);

// pending → validated → paid; either can flip to disputed; disputed → pending
// Mirror invoices.js status pattern. Manual updates only — no auto-transitions.
const STATUS_TRANSITIONS = {
  draft:       ['sent', 'rejected'],
  sent:        ['in_progress', 'resolved', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved:    ['in_progress'],
  rejected:    ['in_progress', 'resolved'],
};

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'tmp', 'restosuite-uploads', 'returns');

function ensureUploadDir() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    console.warn('returns: upload dir create failed:', e.message);
  }
}

// Persist a base64 data URL (data:image/png;base64,...) to disk and return
// the relative path stored in DB. Returns null on bad input — never throws,
// since a single bad photo shouldn't kill the whole request.
function savePhotoDataUrl(dataUrl, requestId) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  const m = dataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
  if (!m) return null;
  const ext = m[1].toLowerCase().replace('jpeg', 'jpg');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0 || buf.length > 8 * 1024 * 1024) return null; // 8MB cap
  ensureUploadDir();
  const filename = `ret${requestId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const fp = path.join(UPLOAD_DIR, filename);
  try {
    fs.writeFileSync(fp, buf);
    return `tmp/restosuite-uploads/returns/${filename}`;
  } catch (e) {
    console.warn('returns: photo write failed:', e.message);
    return null;
  }
}

function ownedRequest(id, rid) {
  return get('SELECT * FROM return_requests WHERE id = ? AND restaurant_id = ?', [id, rid]);
}

function loadItems(requestId, rid) {
  return all(
    'SELECT * FROM return_request_items WHERE return_request_id = ? AND restaurant_id = ? ORDER BY id',
    [requestId, rid]
  );
}

function nextReference() {
  const year = new Date().getFullYear();
  const count = get(
    `SELECT COUNT(*) AS c FROM return_requests WHERE strftime('%Y', created_at) = ?`,
    [String(year)]
  );
  const seq = ((count && count.c) || 0) + 1;
  return `RET-${year}-${String(seq).padStart(4, '0')}`;
}

// ─── GET /api/returns/stats ─────────────────────────────────────────────
// Declared before /:id so Express does not match "stats" as a numeric id.
router.get('/stats', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const byStatus = all(
      `SELECT status, COUNT(*) AS count
         FROM return_requests
        WHERE restaurant_id = ?
        GROUP BY status`,
      [rid]
    );
    const total = byStatus.reduce((s, r) => s + r.count, 0);
    const open = byStatus
      .filter(r => r.status === 'sent' || r.status === 'in_progress')
      .reduce((s, r) => s + r.count, 0);
    const credit = get(
      `SELECT COALESCE(SUM(credit_amount), 0) AS total
         FROM return_requests
        WHERE restaurant_id = ? AND status = 'resolved' AND type = 'credit'`,
      [rid]
    ) || { total: 0 };
    res.json({
      total,
      open,
      by_status: byStatus,
      credit_total_resolved: Math.round((credit.total || 0) * 100) / 100,
    });
  } catch (e) {
    console.error('returns/stats error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/returns ───────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { status, supplier_id } = req.query;

    let sql = `
      SELECT rr.*, s.name AS supplier_name,
             (SELECT COUNT(*) FROM return_request_items i
                WHERE i.return_request_id = rr.id AND i.restaurant_id = rr.restaurant_id) AS item_count
        FROM return_requests rr
        LEFT JOIN suppliers s ON s.id = rr.supplier_id
       WHERE rr.restaurant_id = ?
    `;
    const params = [rid];
    if (status && VALID_STATUSES.has(status)) {
      sql += ' AND rr.status = ?';
      params.push(status);
    }
    if (supplier_id) {
      sql += ' AND rr.supplier_id = ?';
      params.push(Number(supplier_id));
    }
    sql += ' ORDER BY rr.created_at DESC, rr.id DESC';
    res.json(all(sql, params));
  } catch (e) {
    console.error('returns/list error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/returns/:id ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ error: 'Demande introuvable' });

    const row = get(
      `SELECT rr.*, s.name AS supplier_name, s.email AS supplier_email
         FROM return_requests rr
         LEFT JOIN suppliers s ON s.id = rr.supplier_id
        WHERE rr.id = ? AND rr.restaurant_id = ?`,
      [id, rid]
    );
    if (!row) return res.status(404).json({ error: 'Demande introuvable' });

    const items = loadItems(id, rid);
    res.json({ ...row, items });
  } catch (e) {
    console.error('returns/detail error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/returns ──────────────────────────────────────────────────
// Create a new return/claim request. Items are inserted in the same TX so a
// validation failure on item N doesn't leave a partial request behind.
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      supplier_id, delivery_note_id, type, notes, items, status,
    } = req.body || {};

    if (!supplier_id) return res.status(400).json({ error: 'supplier_id requis' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un produit requis' });
    }
    const reqType = type && VALID_TYPES.has(type) ? type : 'return';
    const reqStatus = status && VALID_STATUSES.has(status) ? status : 'draft';

    const supplier = get(
      'SELECT id FROM suppliers WHERE id = ? AND (restaurant_id IS NULL OR restaurant_id = ?)',
      [Number(supplier_id), rid]
    );
    if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

    if (delivery_note_id != null) {
      const dn = get(
        'SELECT id FROM delivery_notes WHERE id = ? AND (restaurant_id IS NULL OR restaurant_id = ?)',
        [Number(delivery_note_id), rid]
      );
      if (!dn) return res.status(404).json({ error: 'Bon de livraison introuvable' });
    }

    const reference = nextReference();

    const newId = db.transaction(() => {
      const result = run(
        `INSERT INTO return_requests
           (restaurant_id, supplier_id, delivery_note_id, type, status, reference, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rid,
          Number(supplier_id),
          delivery_note_id != null ? Number(delivery_note_id) : null,
          reqType,
          reqStatus,
          reference,
          notes || null,
          req.user.id || null,
        ]
      );
      const id = Number(result.lastInsertRowid);

      for (const it of items) {
        const reason = it.reason && VALID_REASONS.has(it.reason) ? it.reason : 'autre';
        const qty = Number(it.quantity);
        const photoPath = it.photo_data_url
          ? savePhotoDataUrl(it.photo_data_url, id)
          : (typeof it.photo_path === 'string' ? it.photo_path : null);
        run(
          `INSERT INTO return_request_items
             (return_request_id, restaurant_id, product_name, quantity, unit, reason, comment, photo_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            rid,
            String(it.product_name || '').trim() || 'Produit',
            Number.isFinite(qty) ? qty : 1,
            it.unit || null,
            reason,
            it.comment || null,
            photoPath,
          ]
        );
      }
      return id;
    })();

    writeAudit({
      restaurant_id: rid,
      account_id: req.user.id,
      table_name: 'return_requests',
      record_id: newId,
      action: 'create',
      new_values: { supplier_id, type: reqType, status: reqStatus, reference, item_count: items.length },
    });

    const created = get(
      `SELECT rr.*, s.name AS supplier_name
         FROM return_requests rr
         LEFT JOIN suppliers s ON s.id = rr.supplier_id
        WHERE rr.id = ?`,
      [newId]
    );
    const itemRows = loadItems(newId, rid);
    res.status(201).json({ ...created, items: itemRows });
  } catch (e) {
    console.error('returns/create error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /api/returns/:id/status ────────────────────────────────────────
// Manual status transitions. credit_amount only set when type=credit and
// status moving to resolved.
router.put('/:id/status', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ error: 'Demande introuvable' });

    const { status, credit_amount } = req.body || {};
    if (!status || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Statut invalide (attendu : ${[...VALID_STATUSES].join(', ')})` });
    }

    const row = ownedRequest(id, rid);
    if (!row) return res.status(404).json({ error: 'Demande introuvable' });

    const allowed = STATUS_TRANSITIONS[row.status] || [];
    if (status !== row.status && !allowed.includes(status)) {
      return res.status(400).json({ error: `Transition ${row.status} → ${status} non autorisée` });
    }

    const resolvedAt = status === 'resolved' ? new Date().toISOString() : row.resolved_at;
    const credit = (status === 'resolved' && row.type === 'credit' && credit_amount != null)
      ? Number(credit_amount)
      : row.credit_amount;

    run(
      `UPDATE return_requests
          SET status = ?, credit_amount = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND restaurant_id = ?`,
      [status, credit, resolvedAt, id, rid]
    );

    writeAudit({
      restaurant_id: rid,
      account_id: req.user.id,
      table_name: 'return_requests',
      record_id: id,
      action: 'update',
      old_values: { status: row.status },
      new_values: { status, credit_amount: credit },
    });

    const updated = ownedRequest(id, rid);
    res.json(updated);
  } catch (e) {
    console.error('returns/status error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/returns/:id/send ─────────────────────────────────────────
// Build the email and dispatch via SMTP. Best-effort: a failed send leaves
// the request in 'draft' so the user can retry. Skipped silently in test
// mode unless a sendFn is injected via app.locals.returnsSendFn.
router.post('/:id/send', async (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ error: 'Demande introuvable' });

    const row = ownedRequest(id, rid);
    if (!row) return res.status(404).json({ error: 'Demande introuvable' });
    if (row.status !== 'draft') {
      return res.status(400).json({ error: 'Demande déjà envoyée' });
    }

    const items = loadItems(id, rid);
    if (items.length === 0) {
      return res.status(400).json({ error: 'Aucun produit dans la demande' });
    }

    const supplier = get('SELECT * FROM suppliers WHERE id = ?', [row.supplier_id]);
    const integration = get(
      `SELECT * FROM supplier_integrations
        WHERE supplier_id = ? AND restaurant_id = ?
        ORDER BY id DESC LIMIT 1`,
      [row.supplier_id, rid]
    );

    const target = resolveReturnsEmail({ supplier, integration });
    if (!target) {
      return res.status(400).json({
        error: 'Aucune adresse email configurée pour ce fournisseur',
        hint: 'Ajoutez un email sur la fiche fournisseur (ou retours_email pour une adresse dédiée).',
      });
    }

    const restaurant = get('SELECT * FROM restaurants WHERE id = ?', [rid]);
    const deliveryNote = row.delivery_note_id
      ? get('SELECT * FROM delivery_notes WHERE id = ? AND (restaurant_id IS NULL OR restaurant_id = ?)',
            [row.delivery_note_id, rid])
      : null;

    const email = buildEmail({ request: row, items, restaurant, supplier, deliveryNote, integration });

    // Resolve send transport — injectable for tests, real SMTP in prod.
    let sendFn = req.app && req.app.locals && req.app.locals.returnsSendFn;
    if (!sendFn) {
      if (process.env.NODE_ENV === 'test') {
        sendFn = async () => ({ ok: true, simulated: true });
      } else {
        try {
          const { sendPlainEmail } = require('../lib/mercuriale-mail/smtp-client');
          sendFn = sendPlainEmail;
        } catch (e) {
          sendFn = null;
        }
      }
    }

    let sendError = null;
    if (sendFn) {
      try {
        // CC the restaurateur so they have a copy in their inbox. Falls back
        // to silent if the account row has no email — still send to supplier.
        const ccList = [];
        const account = req.user.id ? get('SELECT email FROM accounts WHERE id = ?', [req.user.id]) : null;
        if (account && account.email) ccList.push(account.email);

        await sendFn({
          to: target.email,
          cc: ccList.length ? ccList : undefined,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
      } catch (e) {
        sendError = e.message || String(e);
      }
    } else {
      sendError = 'Service email indisponible';
    }

    if (sendError) {
      console.warn(`returns/send id=${id} failed: ${sendError}`);
      return res.status(502).json({ error: 'Envoi email échoué', detail: sendError });
    }

    run(
      `UPDATE return_requests
          SET status = 'sent',
              email_sent_to = ?,
              email_sent_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND restaurant_id = ?`,
      [target.email, id, rid]
    );

    writeAudit({
      restaurant_id: rid,
      account_id: req.user.id,
      table_name: 'return_requests',
      record_id: id,
      action: 'update',
      new_values: { event: 'send', email_sent_to: target.email, source: target.source, status: 'sent' },
    });

    const updated = ownedRequest(id, rid);
    res.json({ ...updated, email_target: target });
  } catch (e) {
    console.error('returns/send error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/returns/:id ────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ error: 'Demande introuvable' });

    const row = ownedRequest(id, rid);
    if (!row) return res.status(404).json({ error: 'Demande introuvable' });

    db.transaction(() => {
      run('DELETE FROM return_request_items WHERE return_request_id = ? AND restaurant_id = ?', [id, rid]);
      run('DELETE FROM return_requests WHERE id = ? AND restaurant_id = ?', [id, rid]);
    })();

    writeAudit({
      restaurant_id: rid,
      account_id: req.user.id,
      table_name: 'return_requests',
      record_id: id,
      action: 'delete',
      old_values: { reference: row.reference, status: row.status },
    });

    res.json({ deleted: true });
  } catch (e) {
    console.error('returns/delete error:', e.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
