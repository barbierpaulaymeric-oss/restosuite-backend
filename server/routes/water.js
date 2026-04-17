// ═══════════════════════════════════════════
// Gestion de l'eau — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/water — liste toutes les analyses
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM water_management WHERE restaurant_id = ? ORDER BY analysis_date DESC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/water/latest — dernière analyse
router.get('/latest', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const item = get('SELECT * FROM water_management WHERE restaurant_id = ? ORDER BY analysis_date DESC LIMIT 1', [rid]);
    res.json({ item: item || null });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/water/:id — détail
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const item = get('SELECT * FROM water_management WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
    if (!item) return res.status(404).json({ error: 'Analyse introuvable' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/water — créer une analyse
router.post('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      analysis_date, analysis_type, provider, results, conformity,
      next_analysis_date, report_ref, water_source, treatment, notes,
    } = req.body;

    if (!analysis_date) return res.status(400).json({ error: 'analysis_date est requis' });
    const validTypes = ['microbiologique', 'physico-chimique', 'complète'];
    if (analysis_type && !validTypes.includes(analysis_type)) {
      return res.status(400).json({ error: 'analysis_type invalide' });
    }
    const validSources = ['réseau public', 'forage', 'autre'];
    if (water_source && !validSources.includes(water_source)) {
      return res.status(400).json({ error: 'water_source invalide' });
    }

    const info = run(
      `INSERT INTO water_management
        (restaurant_id, analysis_date, analysis_type, provider, results, conformity, next_analysis_date, report_ref, water_source, treatment, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rid,
        analysis_date,
        analysis_type || 'complète',
        provider || null,
        results || null,
        conformity !== undefined ? (conformity ? 1 : 0) : 1,
        next_analysis_date || null,
        report_ref || null,
        water_source || 'réseau public',
        treatment || null,
        notes || null,
      ]
    );
    res.status(201).json(get('SELECT * FROM water_management WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/water/:id — mettre à jour
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM water_management WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Analyse introuvable' });

    const {
      analysis_date, analysis_type, provider, results, conformity,
      next_analysis_date, report_ref, water_source, treatment, notes,
    } = req.body;

    run(
      `UPDATE water_management SET
        analysis_date=?, analysis_type=?, provider=?, results=?, conformity=?,
        next_analysis_date=?, report_ref=?, water_source=?, treatment=?, notes=?
       WHERE id=? AND restaurant_id=?`,
      [
        analysis_date || existing.analysis_date,
        analysis_type || existing.analysis_type,
        provider !== undefined ? provider : existing.provider,
        results !== undefined ? results : existing.results,
        conformity !== undefined ? (conformity ? 1 : 0) : existing.conformity,
        next_analysis_date !== undefined ? next_analysis_date : existing.next_analysis_date,
        report_ref !== undefined ? report_ref : existing.report_ref,
        water_source || existing.water_source,
        treatment !== undefined ? treatment : existing.treatment,
        notes !== undefined ? notes : existing.notes,
        id,
        rid,
      ]
    );
    res.json(get('SELECT * FROM water_management WHERE id = ? AND restaurant_id = ?', [id, rid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/water/:id — supprimer
router.delete('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM water_management WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Analyse introuvable' });
    run('DELETE FROM water_management WHERE id = ? AND restaurant_id = ?', [id, rid]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
