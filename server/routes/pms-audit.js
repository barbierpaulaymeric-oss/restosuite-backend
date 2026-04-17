// ═══════════════════════════════════════════
// Vérification du PMS — Audits — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/pms-audit — liste tous les audits
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM pms_audits WHERE restaurant_id = ? ORDER BY audit_date DESC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pms-audit/schedule — prochains audits planifiés
router.get('/schedule', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = all(
      "SELECT * FROM pms_audits WHERE restaurant_id = ? AND status = 'planifié' AND audit_date >= ? ORDER BY audit_date ASC LIMIT 10",
      [rid, today]
    );
    const overdue = all(
      "SELECT * FROM pms_audits WHERE restaurant_id = ? AND status = 'planifié' AND audit_date < ? ORDER BY audit_date ASC",
      [rid, today]
    );
    res.json({ upcoming, overdue, today });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/pms-audit/:id — détail d'un audit
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const item = get('SELECT * FROM pms_audits WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
    if (!item) return res.status(404).json({ error: 'Audit introuvable' });
    if (item.findings) {
      try { item.findings = JSON.parse(item.findings); } catch (_) {}
    }
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/pms-audit — créer un audit
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      audit_date, auditor_name, audit_type, scope,
      findings, overall_score, status, next_audit_date, notes,
    } = req.body;

    if (!audit_date) return res.status(400).json({ error: 'audit_date est requis' });
    if (!auditor_name) return res.status(400).json({ error: 'auditor_name est requis' });

    const validTypes = ['interne', 'externe'];
    if (audit_type && !validTypes.includes(audit_type)) {
      return res.status(400).json({ error: 'audit_type invalide' });
    }
    const validStatuses = ['planifié', 'réalisé', 'actions_en_cours', 'clôturé'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'status invalide' });
    }
    if (overall_score !== undefined && overall_score !== null && (overall_score < 0 || overall_score > 100)) {
      return res.status(400).json({ error: 'overall_score doit être entre 0 et 100' });
    }

    const findingsStr = findings ? JSON.stringify(findings) : null;
    const info = run(
      `INSERT INTO pms_audits
        (restaurant_id, audit_date, auditor_name, audit_type, scope, findings, overall_score, status, next_audit_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        audit_date, auditor_name,
        audit_type || 'interne',
        scope || 'complet',
        findingsStr,
        overall_score !== undefined ? overall_score : null,
        status || 'planifié',
        next_audit_date || null,
        notes || null,
      ]
    );
    const item = get('SELECT * FROM pms_audits WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    if (item && item.findings) {
      try { item.findings = JSON.parse(item.findings); } catch (_) {}
    }
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/pms-audit/:id — mettre à jour
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM pms_audits WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Audit introuvable' });

    const {
      audit_date, auditor_name, audit_type, scope,
      findings, overall_score, status, next_audit_date, notes,
    } = req.body;

    const findingsStr = findings !== undefined ? JSON.stringify(findings) : existing.findings;

    run(
      `UPDATE pms_audits SET
        audit_date=?, auditor_name=?, audit_type=?, scope=?,
        findings=?, overall_score=?, status=?, next_audit_date=?, notes=?
       WHERE id=? AND restaurant_id=?`,
      [
        audit_date || existing.audit_date,
        auditor_name || existing.auditor_name,
        audit_type || existing.audit_type,
        scope || existing.scope,
        findingsStr,
        overall_score !== undefined ? overall_score : existing.overall_score,
        status || existing.status,
        next_audit_date !== undefined ? next_audit_date : existing.next_audit_date,
        notes !== undefined ? notes : existing.notes,
        id,
        rid,
      ]
    );
    const item = get('SELECT * FROM pms_audits WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (item && item.findings) {
      try { item.findings = JSON.parse(item.findings); } catch (_) {}
    }
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/pms-audit/:id — supprimer
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM pms_audits WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Audit introuvable' });
    run('DELETE FROM pms_audits WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
