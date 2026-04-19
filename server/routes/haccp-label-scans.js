'use strict';

// ═══════════════════════════════════════════
// HACCP label scans — CCP1 réception viande/poisson
// POST /extract   → Gemini Vision OCR, no DB write
// GET  /          → list scans for restaurant (photo_data excluded)
// GET  /:id       → single scan with photo_data
// POST /          → save scan + photo (base64, compressed client-side)
// DELETE /:id     → delete scan
// Mounted at /api/haccp/label-scans (planGate('essential') inherited from index.js)
// ═══════════════════════════════════════════

const { Router } = require('express');
const { get, all, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const { GEMINI_API_KEY, buildGeminiUrl, geminiHeaders, selectModel } = require('./ai-core');

const router = Router();
router.use(requireAuth);

const VALID_CATEGORIES = ['viande', 'volaille', 'poisson', 'charcuterie', 'fromage', 'produit_laitier', 'autre'];

function safeAudit(payload) {
  try { writeAudit(payload); } catch (e) { console.error('audit_log write failed:', e.message); }
}

// ─── POST /extract — Gemini Vision OCR, no DB write ───────────────────────
router.post('/extract', async (req, res) => {
  const { image_base64 } = req.body || {};
  if (!image_base64) return res.status(400).json({ error: 'image_base64 requis' });

  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const raw = image_base64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `Tu es un expert HACCP. Analyse cette photo d'une étiquette de produit alimentaire (viande, poisson, volaille, charcuterie ou fromage).
Extrais les informations suivantes et retourne un JSON strict :
{
  "product_name": "nom du produit (ex: Poulet fermier, Filet de saumon)",
  "supplier": "nom du fournisseur ou de l'abattoir",
  "batch_number": "numéro de lot (N° lot, LOT, L:, etc.)",
  "expiry_date": "date DLC ou DDM au format YYYY-MM-DD (convertis si nécessaire)",
  "category": "une valeur parmi: viande, volaille, poisson, charcuterie, fromage, produit_laitier, autre"
}
Si un champ n'est pas visible sur l'étiquette, mets null. Ne devine pas.`;

  try {
    const response = await fetch(buildGeminiUrl(selectModel('scan-label', req.user?.restaurant_id)), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: raw } }
        ]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini label scan error:', err);
      return res.status(502).json({ error: 'Erreur service IA', details: err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Réponse IA vide' });

    let parsed;
    try { parsed = JSON.parse(content); } catch { return res.status(502).json({ error: 'Réponse IA malformée' }); }

    res.json(parsed);
  } catch (e) {
    console.error('Label extract error:', e);
    res.status(500).json({ error: 'Erreur extraction IA' });
  }
});

// ─── GET / — list scans (photo_data excluded for performance) ─────────────
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    if (Number.isNaN(limit) || Number.isNaN(offset)) return res.status(400).json({ error: 'Paramètres de pagination invalides' });

    const items = all(
      `SELECT id, restaurant_id, product_name, supplier, batch_number, expiry_date,
              temperature, category, scanned_at, created_by
       FROM label_scans
       WHERE restaurant_id = ?
       ORDER BY scanned_at DESC
       LIMIT ? OFFSET ?`,
      [rid, limit, offset]
    );
    const row = get('SELECT COUNT(*) as total FROM label_scans WHERE restaurant_id = ?', [rid]);
    res.json({ items, total: row.total, limit, offset });
  } catch (e) {
    console.error('Label scan list error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /:id — single scan with photo_data ───────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = parseInt(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
    const row = get('SELECT * FROM label_scans WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!row) return res.status(404).json({ error: 'Scan introuvable' });
    res.json(row);
  } catch (e) {
    console.error('Label scan get error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST / — save scan ───────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const { product_name, supplier, batch_number, expiry_date, temperature, category, photo_data } = req.body || {};

    if (!product_name || !product_name.trim()) return res.status(400).json({ error: 'product_name requis' });
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Catégorie invalide. Valeurs acceptées : ${VALID_CATEGORIES.join(', ')}` });
    }

    let tempVal = null;
    if (temperature !== undefined && temperature !== null && temperature !== '') {
      const t = Number(temperature);
      if (Number.isNaN(t)) return res.status(400).json({ error: 'temperature doit être un nombre' });
      tempVal = t;
    }

    const info = run(
      `INSERT INTO label_scans (restaurant_id, product_name, supplier, batch_number, expiry_date, temperature, category, photo_data, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, product_name.trim(), supplier || null, batch_number || null, expiry_date || null, tempVal, category || null, photo_data || null, req.user.id ?? null]
    );

    const created = get('SELECT * FROM label_scans WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    safeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'label_scans', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });

    res.status(201).json(created);
  } catch (e) {
    console.error('Label scan save error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = parseInt(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
    const existing = get('SELECT * FROM label_scans WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Scan introuvable' });
    run('DELETE FROM label_scans WHERE id = ? AND restaurant_id = ?', [id, rid]);
    safeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'label_scans', record_id: id, action: 'delete', old_values: existing, new_values: null });
    res.json({ deleted: true });
  } catch (e) {
    console.error('Label scan delete error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
