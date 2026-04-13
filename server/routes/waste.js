// ═══════════════════════════════════════════
// BPH Gestion des déchets — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/waste — list all
router.get('/', (req, res) => {
  try {
    const items = all('SELECT * FROM waste_management ORDER BY waste_type ASC');
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/waste — create
router.post('/', (req, res) => {
  try {
    const { waste_type, collection_provider, collection_frequency, last_collection_date, next_collection_date, contract_ref, notes } = req.body;
    if (!waste_type) return res.status(400).json({ error: 'waste_type est requis' });
    const validTypes = ['alimentaire', 'emballage', 'huile', 'verre', 'autre'];
    if (!validTypes.includes(waste_type)) return res.status(400).json({ error: 'Type de déchet invalide' });
    const info = run(
      `INSERT INTO waste_management (waste_type, collection_provider, collection_frequency, last_collection_date, next_collection_date, contract_ref, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [waste_type, collection_provider || null, collection_frequency || 'hebdomadaire',
       last_collection_date || null, next_collection_date || null, contract_ref || null, notes || null]
    );
    res.status(201).json(get('SELECT * FROM waste_management WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/waste/:id — update
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM waste_management WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Filière introuvable' });
    const { waste_type, collection_provider, collection_frequency, last_collection_date, next_collection_date, contract_ref, notes } = req.body;
    run(
      `UPDATE waste_management SET
        waste_type=?, collection_provider=?, collection_frequency=?,
        last_collection_date=?, next_collection_date=?, contract_ref=?, notes=?
       WHERE id=?`,
      [
        waste_type || existing.waste_type,
        collection_provider !== undefined ? collection_provider : existing.collection_provider,
        collection_frequency || existing.collection_frequency,
        last_collection_date !== undefined ? last_collection_date : existing.last_collection_date,
        next_collection_date !== undefined ? next_collection_date : existing.next_collection_date,
        contract_ref !== undefined ? contract_ref : existing.contract_ref,
        notes !== undefined ? notes : existing.notes,
        id,
      ]
    );
    res.json(get('SELECT * FROM waste_management WHERE id = ?', [id]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/waste/:id — delete
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM waste_management WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Filière introuvable' });
    run('DELETE FROM waste_management WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
