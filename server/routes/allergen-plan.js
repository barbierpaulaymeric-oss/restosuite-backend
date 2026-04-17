// ═══════════════════════════════════════════
// Plan de gestion des allergènes — Routes API
// Règlement INCO (UE) n°1169/2011 — 14 allergènes majeurs
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/allergen-plan — liste tous les allergènes du plan
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM allergen_management_plan WHERE restaurant_id = ? ORDER BY id ASC', [rid]);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/allergen-plan/summary — résumé pour export PMS
router.get('/summary', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const items = all('SELECT * FROM allergen_management_plan WHERE restaurant_id = ? ORDER BY id ASC', [rid]);
    const present = items.filter(i => i.presence_in_menu);
    const byRisk = {
      élevé: present.filter(i => i.risk_level === 'élevé').length,
      moyen: present.filter(i => i.risk_level === 'moyen').length,
      faible: present.filter(i => i.risk_level === 'faible').length,
    };
    const lastReview = items.reduce((acc, i) => (!acc || i.last_review_date > acc) ? i.last_review_date : acc, null);
    res.json({
      total_allergens: items.length,
      present_in_menu: present.length,
      by_risk: byRisk,
      last_review_date: lastReview,
      items,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/allergen-plan/:id — détail d'un allergène
router.get('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const item = get('SELECT * FROM allergen_management_plan WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), rid]);
    if (!item) return res.status(404).json({ error: 'Allergène introuvable' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/allergen-plan/:id — mettre à jour un allergène
router.put('/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM allergen_management_plan WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Allergène introuvable' });

    const {
      risk_level, presence_in_menu, cross_contamination_risk,
      preventive_measures, cleaning_procedure, staff_training_ref,
      display_method, last_review_date, notes,
    } = req.body;

    const validRisks = ['élevé', 'moyen', 'faible'];
    if (risk_level && !validRisks.includes(risk_level)) {
      return res.status(400).json({ error: 'risk_level invalide' });
    }

    run(
      `UPDATE allergen_management_plan SET
        risk_level = ?, presence_in_menu = ?, cross_contamination_risk = ?,
        preventive_measures = ?, cleaning_procedure = ?, staff_training_ref = ?,
        display_method = ?, last_review_date = ?, notes = ?
       WHERE id = ? AND restaurant_id = ?`,
      [
        risk_level !== undefined ? risk_level : existing.risk_level,
        presence_in_menu !== undefined ? (presence_in_menu ? 1 : 0) : existing.presence_in_menu,
        cross_contamination_risk !== undefined ? cross_contamination_risk : existing.cross_contamination_risk,
        preventive_measures !== undefined ? preventive_measures : existing.preventive_measures,
        cleaning_procedure !== undefined ? cleaning_procedure : existing.cleaning_procedure,
        staff_training_ref !== undefined ? staff_training_ref : existing.staff_training_ref,
        display_method !== undefined ? display_method : existing.display_method,
        last_review_date !== undefined ? last_review_date : existing.last_review_date,
        notes !== undefined ? notes : existing.notes,
        id,
        rid,
      ]
    );
    res.json(get('SELECT * FROM allergen_management_plan WHERE id = ? AND restaurant_id = ?', [id, rid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
