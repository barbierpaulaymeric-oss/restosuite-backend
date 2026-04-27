'use strict';

// ═══════════════════════════════════════════
// Restaurant ↔ supplier messaging — restaurant side.
//
// All endpoints require the gérant JWT (requireAuth). Conversations are keyed
// on (supplier_id, restaurant_id) → a deterministic conversation_id string,
// stored alongside denormalized restaurant_id/supplier_id columns so tenancy
// filtering is a simple WHERE.
//
// Supplier-side endpoints live in routes/supplier-portal.js under the
// X-Supplier-Token middleware so the messaging surface is split by auth model.
// Both sides write to the same `messages` table.
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

function conversationId(supplierId, restaurantId) {
  return `supplier_${Number(supplierId)}_restaurant_${Number(restaurantId)}`;
}

// GET /api/messages/conversations — one row per supplier the restaurant has
// chatted with, plus every supplier (so the chef can start a new conversation
// from the list). last_message_at, last_preview, and unread_count come from
// LEFT JOINs against the messages table.
router.get('/conversations', (req, res) => {
  const rid = req.user.restaurant_id;
  const rows = all(
    `SELECT s.id  AS supplier_id,
            s.name AS supplier_name,
            s.contact_name AS supplier_contact,
            (SELECT message FROM messages m
              WHERE m.supplier_id = s.id AND m.restaurant_id = ?
              ORDER BY m.created_at DESC LIMIT 1)             AS last_message,
            (SELECT sender_type FROM messages m
              WHERE m.supplier_id = s.id AND m.restaurant_id = ?
              ORDER BY m.created_at DESC LIMIT 1)             AS last_sender_type,
            (SELECT created_at FROM messages m
              WHERE m.supplier_id = s.id AND m.restaurant_id = ?
              ORDER BY m.created_at DESC LIMIT 1)             AS last_message_at,
            (SELECT COUNT(*) FROM messages m
              WHERE m.supplier_id = s.id AND m.restaurant_id = ?
                AND m.sender_type = 'supplier' AND m.read_at IS NULL) AS unread_count
       FROM suppliers s
      WHERE s.restaurant_id = ?
      ORDER BY (last_message_at IS NULL), last_message_at DESC, s.name ASC`,
    [rid, rid, rid, rid, rid]
  );
  res.json(rows);
});

// GET /api/messages/unread-count — total unread messages from suppliers across
// every conversation the restaurant owns. Drives the nav badge.
router.get('/unread-count', (req, res) => {
  const rid = req.user.restaurant_id;
  const row = get(
    `SELECT COUNT(*) AS c FROM messages
      WHERE restaurant_id = ? AND sender_type = 'supplier' AND read_at IS NULL`,
    [rid]
  );
  res.json({ count: row.c });
});

// GET /api/messages/conversations/:supplierId — full thread with one supplier.
// Marks all incoming (sender_type='supplier') messages as read in a single
// UPDATE before returning, so the badge ticks down on tab open.
router.get('/conversations/:supplierId', (req, res) => {
  const rid = req.user.restaurant_id;
  const supplierId = Number(req.params.supplierId);
  // Verify the supplier belongs to this restaurant — cross-tenant returns 404.
  const supplier = get(
    'SELECT id, name, contact_name, email, phone FROM suppliers WHERE id = ? AND restaurant_id = ?',
    [supplierId, rid]
  );
  if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

  // Mark read BEFORE selecting so the response carries up-to-date read_at.
  run(
    `UPDATE messages SET read_at = datetime('now')
      WHERE supplier_id = ? AND restaurant_id = ?
        AND sender_type = 'supplier' AND read_at IS NULL`,
    [supplierId, rid]
  );

  const messages = all(
    `SELECT id, conversation_id, sender_type, sender_id, sender_name, message,
            related_to, related_id, read_at, created_at
       FROM messages
      WHERE supplier_id = ? AND restaurant_id = ?
      ORDER BY created_at ASC
      LIMIT 500`,
    [supplierId, rid]
  );
  res.json({ supplier, messages });
});

// POST /api/messages/conversations/:supplierId — restaurant sends a message.
// Body: { message, related_to?, related_id? }. The sender's display name is
// taken from req.user (account.name) when present.
router.post('/conversations/:supplierId', (req, res) => {
  const rid = req.user.restaurant_id;
  const accountId = req.user.id;
  const supplierId = Number(req.params.supplierId);
  const supplier = get('SELECT id FROM suppliers WHERE id = ? AND restaurant_id = ?', [supplierId, rid]);
  if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

  const message = req.body && typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'Message requis' });
  if (message.length > 2000) return res.status(400).json({ error: 'Message trop long (max 2000 caractères)' });

  const relatedTo = req.body && typeof req.body.related_to === 'string'
    ? req.body.related_to.trim().slice(0, 32) || null
    : null;
  const relatedId = req.body && req.body.related_id != null
    ? Number(req.body.related_id) || null
    : null;

  // Pull the gérant's display name. Fall back to email if the account has no
  // name set, then to "Restaurant" as a last resort.
  const acct = get('SELECT name, email FROM accounts WHERE id = ?', [accountId]);
  const senderName = (acct && (acct.name || acct.email)) || 'Restaurant';

  const result = run(
    `INSERT INTO messages
       (conversation_id, restaurant_id, supplier_id,
        sender_type, sender_id, sender_name,
        message, related_to, related_id)
     VALUES (?, ?, ?, 'restaurant', ?, ?, ?, ?, ?)`,
    [
      conversationId(supplierId, rid), rid, supplierId,
      accountId, senderName,
      message, relatedTo, relatedId,
    ]
  );
  const row = get('SELECT * FROM messages WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(row);
});

module.exports = router;
