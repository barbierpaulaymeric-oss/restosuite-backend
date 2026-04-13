// ═══════════════════════════════════════════
// Diagrammes de fabrication
// Route /api/fabrication-diagrams
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/fabrication-diagrams
router.get('/', (req, res) => {
  const diagrams = all('SELECT * FROM fabrication_diagrams ORDER BY nom ASC');
  res.json(diagrams.map(d => ({ ...d, etapes: JSON.parse(d.etapes || '[]') })));
});

// GET /api/fabrication-diagrams/:id
router.get('/:id', (req, res) => {
  const diagram = get('SELECT * FROM fabrication_diagrams WHERE id = ?', [Number(req.params.id)]);
  if (!diagram) return res.status(404).json({ error: 'Diagramme introuvable' });
  res.json({ ...diagram, etapes: JSON.parse(diagram.etapes || '[]') });
});

// POST /api/fabrication-diagrams
router.post('/', (req, res) => {
  const { nom, description, etapes } = req.body;
  if (!nom) return res.status(400).json({ error: 'Le nom est requis' });
  if (!Array.isArray(etapes) || etapes.length === 0) {
    return res.status(400).json({ error: 'Au moins une étape est requise' });
  }
  const info = run(
    'INSERT INTO fabrication_diagrams (nom, description, etapes) VALUES (?, ?, ?)',
    [nom, description || null, JSON.stringify(etapes)]
  );
  const diagram = get('SELECT * FROM fabrication_diagrams WHERE id = ?', [info.lastInsertRowid]);
  res.status(201).json({ ...diagram, etapes: JSON.parse(diagram.etapes) });
});

// PUT /api/fabrication-diagrams/:id
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM fabrication_diagrams WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Diagramme introuvable' });
  const { nom, description, etapes } = req.body;
  run(
    'UPDATE fabrication_diagrams SET nom = ?, description = ?, etapes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [
      nom || existing.nom,
      description !== undefined ? description : existing.description,
      etapes ? JSON.stringify(etapes) : existing.etapes,
      id,
    ]
  );
  const diagram = get('SELECT * FROM fabrication_diagrams WHERE id = ?', [id]);
  res.json({ ...diagram, etapes: JSON.parse(diagram.etapes) });
});

// DELETE /api/fabrication-diagrams/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = run('DELETE FROM fabrication_diagrams WHERE id = ?', [id]);
  if (info.changes === 0) return res.status(404).json({ error: 'Diagramme introuvable' });
  res.json({ deleted: true });
});

module.exports = router;
