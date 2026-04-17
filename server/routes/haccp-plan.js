// ═══════════════════════════════════════════
// HACCP Plan formalisé — Routes API
// ═══════════════════════════════════════════

const { Router } = require('express');
const { db, all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { writeAudit } = require('../lib/audit-log');
const router = Router();

router.use(requireAuth);

// GET /api/haccp-plan — Overview: count of hazards, CCPs, and completion status
router.get('/', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const hazardCount = get('SELECT COUNT(*) as c FROM haccp_hazard_analysis WHERE restaurant_id = ?', [rid]) || { c: 0 };
    const ccpCount = get('SELECT COUNT(*) as c FROM haccp_ccp WHERE restaurant_id = ?', [rid]) || { c: 0 };
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
    const rid = req.user.restaurant_id;
    const hazards = all(`
      SELECT h.*,
        (SELECT result FROM haccp_decision_tree_results WHERE hazard_analysis_id = h.id AND restaurant_id = ? ORDER BY id DESC LIMIT 1) as dt_result
      FROM haccp_hazard_analysis h
      WHERE h.restaurant_id = ?
      ORDER BY h.step_name, h.hazard_type
    `, [rid, rid]);
    res.json({ items: hazards, total: hazards.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/hazards', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
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
      `INSERT INTO haccp_hazard_analysis (restaurant_id, step_name, hazard_type, hazard_description, severity, probability, is_ccp, preventive_measures)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rid, step_name, hazard_type || 'B', hazard_description, sev, prob, is_ccp ? 1 : 0, preventive_measures || '']
    );
    const created = get('SELECT * FROM haccp_hazard_analysis WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'haccp_hazard_analysis', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: created });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/hazards/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM haccp_hazard_analysis WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Danger introuvable' });

    const { step_name, hazard_type, hazard_description, severity, probability, is_ccp, preventive_measures } = req.body;
    const sev = severity !== undefined ? Number(severity) : existing.severity;
    const prob = probability !== undefined ? Number(probability) : existing.probability;

    run(
      `UPDATE haccp_hazard_analysis
       SET step_name=?, hazard_type=?, hazard_description=?, severity=?, probability=?, is_ccp=?, preventive_measures=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND restaurant_id=?`,
      [
        step_name || existing.step_name,
        hazard_type || existing.hazard_type,
        hazard_description || existing.hazard_description,
        sev, prob,
        is_ccp !== undefined ? (is_ccp ? 1 : 0) : existing.is_ccp,
        preventive_measures !== undefined ? preventive_measures : existing.preventive_measures,
        id,
        rid,
      ]
    );
    const updated = get('SELECT * FROM haccp_hazard_analysis WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'haccp_hazard_analysis', record_id: id, action: 'update', old_values: existing, new_values: updated });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/hazards/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const existing = get('SELECT * FROM haccp_hazard_analysis WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!existing) return res.status(404).json({ error: 'Danger introuvable' });
    run('DELETE FROM haccp_hazard_analysis WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'haccp_hazard_analysis', record_id: id, action: 'delete', old_values: existing, new_values: null });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
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
    const rid = req.user.restaurant_id;
    const ccps = all(`
      SELECT c.*, h.step_name, h.hazard_type, h.hazard_description, h.severity, h.probability
      FROM haccp_ccp c
      JOIN haccp_hazard_analysis h ON h.id = c.hazard_analysis_id AND h.restaurant_id = ?
      WHERE c.restaurant_id = ?
      ORDER BY c.ccp_number
    `, [rid, rid]);
    res.json({ items: ccps, total: ccps.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/ccps', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const {
      hazard_analysis_id, ccp_number, critical_limits,
      monitoring_procedure, monitoring_frequency, corrective_actions,
      verification_procedure, records_kept, responsible_person,
    } = req.body;

    if (!hazard_analysis_id || !ccp_number) {
      return res.status(400).json({ error: 'hazard_analysis_id et ccp_number sont requis' });
    }
    const hazard = get('SELECT * FROM haccp_hazard_analysis WHERE id = ? AND restaurant_id = ?', [hazard_analysis_id, rid]);
    if (!hazard) return res.status(404).json({ error: 'Danger introuvable' });

    const existing = get('SELECT id FROM haccp_ccp WHERE hazard_analysis_id = ? AND restaurant_id = ?', [hazard_analysis_id, rid]);
    let recordId;

    let ccpOldRow = null;
    let ccpAction = 'create';
    if (existing) {
      ccpOldRow = get('SELECT * FROM haccp_ccp WHERE id = ? AND restaurant_id = ?', [existing.id, rid]);
      ccpAction = 'update';
      run(
        `UPDATE haccp_ccp
         SET ccp_number=?, critical_limits=?, monitoring_procedure=?, monitoring_frequency=?,
             corrective_actions=?, verification_procedure=?, records_kept=?, responsible_person=?,
             updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND restaurant_id=?`,
        [
          ccp_number,
          critical_limits || '', monitoring_procedure || '', monitoring_frequency || '',
          corrective_actions || '', verification_procedure || '', records_kept || '',
          responsible_person || '', existing.id, rid,
        ]
      );
      recordId = existing.id;
    } else {
      const info = run(
        `INSERT INTO haccp_ccp
         (restaurant_id, hazard_analysis_id, ccp_number, critical_limits, monitoring_procedure, monitoring_frequency,
          corrective_actions, verification_procedure, records_kept, responsible_person)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rid, hazard_analysis_id, ccp_number,
          critical_limits || '', monitoring_procedure || '', monitoring_frequency || '',
          corrective_actions || '', verification_procedure || '', records_kept || '',
          responsible_person || '',
        ]
      );
      recordId = info.lastInsertRowid;
    }
    // Ensure hazard is marked CCP
    run('UPDATE haccp_hazard_analysis SET is_ccp=1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND restaurant_id=?', [hazard_analysis_id, rid]);

    const ccpRow = get('SELECT * FROM haccp_ccp WHERE id = ? AND restaurant_id = ?', [recordId, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'haccp_ccp', record_id: recordId, action: ccpAction, old_values: ccpOldRow, new_values: ccpRow });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.status(201).json(ccpRow);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/ccps/:id', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const id = Number(req.params.id);
    const ccp = get('SELECT * FROM haccp_ccp WHERE id = ? AND restaurant_id = ?', [id, rid]);
    if (!ccp) return res.status(404).json({ error: 'CCP introuvable' });
    run('DELETE FROM haccp_ccp WHERE id = ? AND restaurant_id = ?', [id, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'haccp_ccp', record_id: id, action: 'delete', old_values: ccp, new_values: null });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
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
    const rid = req.user.restaurant_id;
    const hazardId = Number(req.params.hazardId);
    const result = get(
      'SELECT * FROM haccp_decision_tree_results WHERE hazard_analysis_id = ? AND restaurant_id = ? ORDER BY id DESC LIMIT 1',
      [hazardId, rid]
    );
    res.json(result || null);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/decision-tree/:hazardId', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const hazardId = Number(req.params.hazardId);
    const hazard = get('SELECT * FROM haccp_hazard_analysis WHERE id = ? AND restaurant_id = ?', [hazardId, rid]);
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

    run('DELETE FROM haccp_decision_tree_results WHERE hazard_analysis_id = ? AND restaurant_id = ?', [hazardId, rid]);
    const info = run(
      `INSERT INTO haccp_decision_tree_results
       (restaurant_id, hazard_analysis_id, q1_preventive_measure, q2_step_designed_eliminate, q3_contamination_possible, q4_subsequent_step_eliminate, result)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rid, hazardId, q1 ? 1 : 0, q2 ? 1 : 0, q3 ? 1 : 0, q4 ? 1 : 0, result]
    );

    // Sync is_ccp on hazard
    run(
      'UPDATE haccp_hazard_analysis SET is_ccp=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND restaurant_id=?',
      [result === 'CCP' ? 1 : 0, hazardId, rid]
    );

    const dtResult = get('SELECT * FROM haccp_decision_tree_results WHERE id = ? AND restaurant_id = ?', [info.lastInsertRowid, rid]);
    try {
      writeAudit({ restaurant_id: rid, account_id: req.user.id ?? null, table_name: 'haccp_decision_tree_results', record_id: info.lastInsertRowid, action: 'create', old_values: null, new_values: dtResult });
    } catch (auditErr) { console.error('audit_log write failed:', auditErr); }
    res.json(dtResult);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
// SYNTHÈSE
// ═══════════════════════════════════════════

router.get('/summary', (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const hazards = all('SELECT * FROM haccp_hazard_analysis WHERE restaurant_id = ? ORDER BY step_name, hazard_type', [rid]);
    const ccps = all(`
      SELECT c.*, h.step_name, h.hazard_type, h.hazard_description
      FROM haccp_ccp c
      JOIN haccp_hazard_analysis h ON h.id = c.hazard_analysis_id AND h.restaurant_id = ?
      WHERE c.restaurant_id = ?
      ORDER BY c.ccp_number
    `, [rid, rid]);
    const dtResults = all('SELECT * FROM haccp_decision_tree_results WHERE restaurant_id = ? ORDER BY hazard_analysis_id', [rid]);

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
