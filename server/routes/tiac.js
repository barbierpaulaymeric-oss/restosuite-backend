// ═══════════════════════════════════════════
// TIAC — Toxi-Infections Alimentaires Collectives
// Route /api/tiac
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/tiac
router.get('/', (req, res) => {
  const procedures = all('SELECT * FROM tiac_procedures ORDER BY date_incident DESC');
  res.json(procedures);
});

// GET /api/tiac/:id
router.get('/:id', (req, res) => {
  const procedure = get('SELECT * FROM tiac_procedures WHERE id = ?', [Number(req.params.id)]);
  if (!procedure) return res.status(404).json({ error: 'Procédure introuvable' });
  res.json(procedure);
});

// POST /api/tiac
router.post('/', (req, res) => {
  const {
    date_incident, description, nb_personnes, symptomes, aliments_suspects,
    mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut
  } = req.body;
  if (!date_incident || !description) {
    return res.status(400).json({ error: 'date_incident et description sont requis' });
  }
  const info = run(
    `INSERT INTO tiac_procedures
      (date_incident, description, nb_personnes, symptomes, aliments_suspects,
       mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [date_incident, description, nb_personnes || 0, symptomes || null, aliments_suspects || null,
     mesures_conservatoires || null, declaration_ars ? 1 : 0, plats_temoins_conserves ? 1 : 0,
     contact_ddpp || null, statut || 'en_cours']
  );
  res.status(201).json(get('SELECT * FROM tiac_procedures WHERE id = ?', [info.lastInsertRowid]));
});

// PUT /api/tiac/:id
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM tiac_procedures WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Procédure introuvable' });
  const {
    date_incident, description, nb_personnes, symptomes, aliments_suspects,
    mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut
  } = req.body;
  run(
    `UPDATE tiac_procedures SET
      date_incident = ?, description = ?, nb_personnes = ?, symptomes = ?, aliments_suspects = ?,
      mesures_conservatoires = ?, declaration_ars = ?, plats_temoins_conserves = ?,
      contact_ddpp = ?, statut = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      date_incident || existing.date_incident,
      description || existing.description,
      nb_personnes ?? existing.nb_personnes,
      symptomes !== undefined ? symptomes : existing.symptomes,
      aliments_suspects !== undefined ? aliments_suspects : existing.aliments_suspects,
      mesures_conservatoires !== undefined ? mesures_conservatoires : existing.mesures_conservatoires,
      declaration_ars !== undefined ? (declaration_ars ? 1 : 0) : existing.declaration_ars,
      plats_temoins_conserves !== undefined ? (plats_temoins_conserves ? 1 : 0) : existing.plats_temoins_conserves,
      contact_ddpp !== undefined ? contact_ddpp : existing.contact_ddpp,
      statut || existing.statut,
      id,
    ]
  );
  res.json(get('SELECT * FROM tiac_procedures WHERE id = ?', [id]));
});

// DELETE /api/tiac/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = run('DELETE FROM tiac_procedures WHERE id = ?', [id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Procédure introuvable' });
  res.json({ deleted: true });
});

module.exports = router;
