// ═══════════════════════════════════════════
// Agrément sanitaire — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

function getOrCreate(restaurantId) {
  let row = get('SELECT * FROM sanitary_settings WHERE restaurant_id = ?', [restaurantId]);
  if (!row) {
    run('INSERT INTO sanitary_settings (restaurant_id) VALUES (?)', [restaurantId]);
    row = get('SELECT * FROM sanitary_settings WHERE restaurant_id = ?', [restaurantId]);
  }
  return row;
}

// GET /api/sanitary — récupérer les paramètres sanitaires du restaurant
router.get('/', (req, res) => {
  try {
    const restaurantId = req.user.restaurant_id || 1;
    const settings = getOrCreate(restaurantId);
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/sanitary — mettre à jour les paramètres sanitaires
router.put('/', (req, res) => {
  try {
    const restaurantId = req.user.restaurant_id || 1;
    getOrCreate(restaurantId);

    const {
      sanitary_approval_number, sanitary_approval_date, sanitary_approval_type,
      activity_type, dd_pp_office, notes,
    } = req.body;

    const validApprovalTypes = ['agrément', 'dérogation', 'déclaration'];
    if (sanitary_approval_type && !validApprovalTypes.includes(sanitary_approval_type)) {
      return res.status(400).json({ error: 'sanitary_approval_type invalide' });
    }
    const validActivityTypes = ['restaurant', 'traiteur', 'fabrication', 'entreposage'];
    if (activity_type && !validActivityTypes.includes(activity_type)) {
      return res.status(400).json({ error: 'activity_type invalide' });
    }

    run(
      `UPDATE sanitary_settings SET
        sanitary_approval_number=?, sanitary_approval_date=?, sanitary_approval_type=?,
        activity_type=?, dd_pp_office=?, notes=?, updated_at=CURRENT_TIMESTAMP
       WHERE restaurant_id=?`,
      [
        sanitary_approval_number !== undefined ? sanitary_approval_number : null,
        sanitary_approval_date !== undefined ? sanitary_approval_date : null,
        sanitary_approval_type || 'déclaration',
        activity_type || 'restaurant',
        dd_pp_office !== undefined ? dd_pp_office : null,
        notes !== undefined ? notes : null,
        restaurantId,
      ]
    );
    res.json(get('SELECT * FROM sanitary_settings WHERE restaurant_id = ?', [restaurantId]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
