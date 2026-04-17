// ═══════════════════════════════════════════
// HACCP Plan formalisé — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { db, all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/haccp-plan — Overview: count of hazards, CCPs, and completion status
router.get('/', (req, res) => {
  try {
    const hazardCount = get('SELECT COUNT(*) as c FROM haccp_hazard_analysis') || { c: 0 };
    const ccpCount = get('SELECT COUNT(*) as c FROM haccp_ccp') || { c: 0 };
    res.json({
      hazard_count: hazardCount.c,
      ccp_count: ccpCount.c,
      status: hazardCount.c > 0 ? 'in_progress' : 'empty'
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// ANALYSE DES DANGERS
// ═══════════════════════════════════════════

router.get('/hazards', (req, res) => {
  try {
    const hazards = all(`
      SELECT h.*,
        (SELECT result FROM haccp_decision_tree_results WHERE hazard_analysis_id = h.id ORDER BY id DESC LIMIT 1) as dt_result
      FROM haccp_hazard_analysis h
      ORDER BY h.step_name, h.hazard_type
    `);
    res.json({ items: hazards, total: hazards.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/hazards', (req, res) => {
  try {
    const { step_name, hazard_type, hazard_description, severity, probability, is_ccp, preventive_measures } = req.body;
    if (!step_name || !hazard_description) {
      return res.status(400).json({ error: 'step_name et hazard_description sont requis' });
    }
    const sev = Number(severity) || 3;
    const prob = Number(probability) || 3;
    if (sev < 1 || sev > 5 || prob < 1 || prob > 5) {
      return res.status(400).json({ error: 'Gravité et probabilité doivent être entre 1 et 5' });
    }
    const info = run(
      `INSERT INTO haccp_hazard_analysis (step_name, hazard_type, hazard_description, severity, probability, is_ccp, preventive_measures)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [step_name, hazard_type || 'B', hazard_description, sev, prob, is_ccp ? 1 : 0, preventive_measures || '']
    );
    res.status(201).json(get('SELECT * FROM haccp_hazard_analysis WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/hazards/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM haccp_hazard_analysis WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Danger introuvable' });

    const { step_name, hazard_type, hazard_description, severity, probability, is_ccp, preventive_measures } = req.body;
    const sev = severity !== undefined ? Number(severity) : existing.severity;
    const prob = probability !== undefined ? Number(probability) : existing.probability;

    run(
      `UPDATE haccp_hazard_analysis
       SET step_name=?, hazard_type=?, hazard_description=?, severity=?, probability=?, is_ccp=?, preventive_measures=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [
        step_name || existing.step_name,
        hazard_type || existing.hazard_type,
        hazard_description || existing.hazard_description,
        sev, prob,
        is_ccp !== undefined ? (is_ccp ? 1 : 0) : existing.is_ccp,
        preventive_measures !== undefined ? preventive_measures : existing.preventive_measures,
        id,
      ]
    );
    res.json(get('SELECT * FROM haccp_hazard_analysis WHERE id = ?', [id]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/hazards/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM haccp_hazard_analysis WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Danger introuvable' });
    run('DELETE FROM haccp_hazard_analysis WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// CCP — Points Critiques de Contrôle
// ═══════════════════════════════════════════

router.get('/ccps', (req, res) => {
  try {
    const ccps = all(`
      SELECT c.*, h.step_name, h.hazard_type, h.hazard_description, h.severity, h.probability
      FROM haccp_ccp c
      JOIN haccp_hazard_analysis h ON h.id = c.hazard_analysis_id
      ORDER BY c.ccp_number
    `);
    res.json({ items: ccps, total: ccps.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/ccps', (req, res) => {
  try {
    const {
      hazard_analysis_id, ccp_number, critical_limits,
      monitoring_procedure, monitoring_frequency, corrective_actions,
      verification_procedure, records_kept, responsible_person,
    } = req.body;

    if (!hazard_analysis_id || !ccp_number) {
      return res.status(400).json({ error: 'hazard_analysis_id et ccp_number sont requis' });
    }
    const hazard = get('SELECT * FROM haccp_hazard_analysis WHERE id = ?', [hazard_analysis_id]);
    if (!hazard) return res.status(404).json({ error: 'Danger introuvable' });

    const existing = get('SELECT id FROM haccp_ccp WHERE hazard_analysis_id = ?', [hazard_analysis_id]);
    let recordId;

    if (existing) {
      run(
        `UPDATE haccp_ccp
         SET ccp_number=?, critical_limits=?, monitoring_procedure=?, monitoring_frequency=?,
             corrective_actions=?, verification_procedure=?, records_kept=?, responsible_person=?,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [
          ccp_number,
          critical_limits || '', monitoring_procedure || '', monitoring_frequency || '',
          corrective_actions || '', verification_procedure || '', records_kept || '',
          responsible_person || '', existing.id,
        ]
      );
      recordId = existing.id;
    } else {
      const info = run(
        `INSERT INTO haccp_ccp
         (hazard_analysis_id, ccp_number, critical_limits, monitoring_procedure, monitoring_frequency,
          corrective_actions, verification_procedure, records_kept, responsible_person)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hazard_analysis_id, ccp_number,
          critical_limits || '', monitoring_procedure || '', monitoring_frequency || '',
          corrective_actions || '', verification_procedure || '', records_kept || '',
          responsible_person || '',
        ]
      );
      recordId = info.lastInsertRowid;
    }
    // Ensure hazard is marked CCP
    run('UPDATE haccp_hazard_analysis SET is_ccp=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [hazard_analysis_id]);

    res.status(201).json(get('SELECT * FROM haccp_ccp WHERE id = ?', [recordId]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/ccps/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const ccp = get('SELECT * FROM haccp_ccp WHERE id = ?', [id]);
    if (!ccp) return res.status(404).json({ error: 'CCP introuvable' });
    run('DELETE FROM haccp_ccp WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// ARBRE DE DÉCISION (Codex Alimentarius)
// ═══════════════════════════════════════════

router.get('/decision-tree/:hazardId', (req, res) => {
  try {
    const hazardId = Number(req.params.hazardId);
    const result = get(
      'SELECT * FROM haccp_decision_tree_results WHERE hazard_analysis_id = ? ORDER BY id DESC LIMIT 1',
      [hazardId]
    );
    res.json(result || null);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/decision-tree/:hazardId', (req, res) => {
  try {
    const hazardId = Number(req.params.hazardId);
    const hazard = get('SELECT * FROM haccp_hazard_analysis WHERE id = ?', [hazardId]);
    if (!hazard) return res.status(404).json({ error: 'Danger introuvable' });

    const { q1, q2, q3, q4 } = req.body;

    // Codex Alimentarius decision tree logic
    let result;
    if (!q1) {
      result = 'PRP';          // Pas de mesure préventive → PRP simple
    } else if (q2) {
      result = 'CCP';          // Étape conçue pour éliminer → CCP
    } else if (!q3) {
      result = 'PRP';          // Pas de contamination possible → PRP
    } else if (q4) {
      result = 'PRPO';         // Étape ultérieure élimine → PRPO
    } else {
      result = 'CCP';          // Aucune étape ultérieure → CCP
    }

    run('DELETE FROM haccp_decision_tree_results WHERE hazard_analysis_id = ?', [hazardId]);
    const info = run(
      `INSERT INTO haccp_decision_tree_results
       (hazard_analysis_id, q1_preventive_measure, q2_step_designed_eliminate, q3_contamination_possible, q4_subsequent_step_eliminate, result)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hazardId, q1 ? 1 : 0, q2 ? 1 : 0, q3 ? 1 : 0, q4 ? 1 : 0, result]
    );

    // Sync is_ccp on hazard
    run(
      'UPDATE haccp_hazard_analysis SET is_ccp=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [result === 'CCP' ? 1 : 0, hazardId]
    );

    res.json(get('SELECT * FROM haccp_decision_tree_results WHERE id = ?', [info.lastInsertRowid]));
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// SYNTHÈSE
// ═══════════════════════════════════════════

router.get('/summary', (req, res) => {
  try {
    const hazards = all('SELECT * FROM haccp_hazard_analysis ORDER BY step_name, hazard_type');
    const ccps = all(`
      SELECT c.*, h.step_name, h.hazard_type, h.hazard_description
      FROM haccp_ccp c
      JOIN haccp_hazard_analysis h ON h.id = c.hazard_analysis_id
      ORDER BY c.ccp_number
    `);
    const dtResults = all('SELECT * FROM haccp_decision_tree_results ORDER BY hazard_analysis_id');

    const stats = {
      total_hazards: hazards.length,
      total_ccp: hazards.filter(h => h.is_ccp).length,
      biological: hazards.filter(h => h.hazard_type === 'B').length,
      chemical: hazards.filter(h => h.hazard_type === 'C').length,
      physical: hazards.filter(h => h.hazard_type === 'P').length,
      high_risk: hazards.filter(h => h.severity * h.probability > 15).length,
    };

    res.json({ hazards, ccps, dtResults, stats });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
