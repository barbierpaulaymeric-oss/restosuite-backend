// ═══════════════════════════════════════════
// Export PMS complet — Route API
// GET /api/pms/export
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

router.use(requireAuth);

// GET /api/pms/export?period=1m|3m|6m|1y
router.get('/export', (req, res) => {
  try {
    const { period = '1m' } = req.query;

    const periodDays = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 }[period] || 30;
    const periodSince = new Date(Date.now() - periodDays * 24 * 3600 * 1000).toISOString();

    // ── 1. Informations générales ──
    const restaurant = get('SELECT * FROM restaurants ORDER BY id ASC LIMIT 1') || {};
    const gerant = get("SELECT * FROM accounts WHERE role = 'gerant' AND is_owner = 1 LIMIT 1")
                || get("SELECT * FROM accounts WHERE role = 'gerant' LIMIT 1")
                || {};
    const sanitarySettings = get('SELECT * FROM sanitary_settings ORDER BY id ASC LIMIT 1') || {};

    // ── 2. Analyse des dangers ──
    const hazards = all('SELECT * FROM haccp_hazard_analysis ORDER BY step_name ASC, id ASC');

    // ── 3. Points Critiques de Contrôle (CCP) ──
    const ccps = all(`
      SELECT c.*, h.step_name, h.hazard_description, h.hazard_type
      FROM haccp_ccp c
      JOIN haccp_hazard_analysis h ON h.id = c.hazard_analysis_id
      ORDER BY c.ccp_number ASC
    `);

    // ── 4. Arbre de décision ──
    const decisionTree = all(`
      SELECT d.*, h.step_name, h.hazard_description, h.hazard_type, h.severity, h.probability
      FROM haccp_decision_tree_results d
      JOIN haccp_hazard_analysis h ON h.id = d.hazard_analysis_id
      ORDER BY h.step_name ASC, d.id ASC
    `);

    // ── 5. Plan de nettoyage ──
    const cleaningTasks = all('SELECT * FROM cleaning_tasks ORDER BY zone ASC, name ASC');
    const cleaningStats = {
      total: cleaningTasks.length,
      daily:   cleaningTasks.filter(t => t.frequency === 'daily').length,
      weekly:  cleaningTasks.filter(t => t.frequency === 'weekly').length,
      monthly: cleaningTasks.filter(t => t.frequency === 'monthly').length,
    };
    const recentCleaningLogs = all(`
      SELECT l.*, t.name as task_name, t.zone, a.name as done_by
      FROM cleaning_logs l
      JOIN cleaning_tasks t ON t.id = l.task_id
      LEFT JOIN accounts a ON a.id = l.completed_by
      WHERE l.completed_at >= ?
      ORDER BY l.completed_at DESC
      LIMIT 100
    `, [periodSince]);

    // ── 6. Relevés de température ──
    const temperatureZones = all('SELECT * FROM temperature_zones ORDER BY name ASC');
    const temperatureLogs = all(`
      SELECT l.*, z.name as zone_name, z.type as zone_type, z.min_temp, z.max_temp, a.name as recorded_by_name
      FROM temperature_logs l
      JOIN temperature_zones z ON z.id = l.zone_id
      LEFT JOIN accounts a ON a.id = l.recorded_by
      WHERE l.recorded_at >= ?
      ORDER BY l.recorded_at DESC
      LIMIT 500
    `, [periodSince]);
    const tempAlerts = temperatureLogs.filter(t => t.is_alert);
    const coolingLogs = all(`
      SELECT * FROM cooling_logs WHERE created_at >= ? ORDER BY created_at DESC LIMIT 100
    `, [periodSince]);
    const reheatingLogs = all(`
      SELECT * FROM reheating_logs WHERE created_at >= ? ORDER BY created_at DESC LIMIT 100
    `, [periodSince]);

    // ── 7. Traçabilité ──
    const receptionRecords = all(`
      SELECT * FROM traceability_logs WHERE received_at >= ? ORDER BY received_at DESC LIMIT 200
    `, [periodSince]);
    const downstreamRecords = all(`
      SELECT * FROM downstream_traceability WHERE dispatch_date >= ? ORDER BY dispatch_date DESC LIMIT 200
    `, [periodSince.slice(0, 10)]);

    // ── 8. Formation du personnel ──
    const trainingRecords = all('SELECT * FROM training_records ORDER BY training_date DESC');
    const trainingStats = {
      total:    trainingRecords.length,
      realise:  trainingRecords.filter(t => t.status === 'réalisé').length,
      expire:   trainingRecords.filter(t => t.status === 'expiré').length,
      planifie: trainingRecords.filter(t => t.status === 'planifié').length,
    };

    // ── 9. Lutte contre les nuisibles ──
    const pestControl = all('SELECT * FROM pest_control ORDER BY visit_date DESC');
    const lastPestVisit = pestControl[0] || null;

    // ── 10. Maintenance des équipements ──
    const maintenance = all('SELECT * FROM equipment_maintenance ORDER BY next_maintenance_date ASC');
    const maintenanceStats = {
      total:     maintenance.length,
      a_jour:    maintenance.filter(m => m.status === 'à_jour').length,
      en_retard: maintenance.filter(m => m.status === 'en_retard').length,
      planifie:  maintenance.filter(m => m.status === 'planifié').length,
    };

    // ── 11. Gestion des déchets ──
    const wasteManagement = all('SELECT * FROM waste_management ORDER BY waste_type ASC');

    // ── 12. Procédures retrait/rappel ──
    const recallProcedures = all('SELECT * FROM recall_procedures ORDER BY alert_date DESC');
    const recallStats = {
      total:   recallProcedures.length,
      actifs:  recallProcedures.filter(r => r.status !== 'cloture' && r.status !== 'cloturé').length,
      cloture: recallProcedures.filter(r => r.status === 'cloture' || r.status === 'cloturé').length,
    };

    // ── 13. Actions correctives ──
    const correctiveActions = all(`
      SELECT * FROM corrective_actions_log
      WHERE created_at >= ?
      ORDER BY created_at DESC
      LIMIT 200
    `, [periodSince]);
    const correctiveTemplates = all('SELECT * FROM corrective_actions_templates WHERE is_active = 1 ORDER BY category ASC');

    // ── 14. Fournisseurs ──
    const suppliers = all('SELECT * FROM suppliers ORDER BY name ASC');

    // ── 15. Allergènes INCO ──
    const allergenPlan = all('SELECT * FROM allergen_management_plan ORDER BY risk_level ASC, allergen_name ASC');

    // ── 16. Gestion de l'eau ──
    const waterManagement = all('SELECT * FROM water_management ORDER BY analysis_date DESC');

    // ── 17. Audits PMS ──
    const pmsAudits = all('SELECT * FROM pms_audits ORDER BY audit_date DESC');

    // ── 18. Friteuses ──
    const fryers = all('SELECT * FROM fryers WHERE is_active = 1');
    const fryerChecks = all(`
      SELECT fc.*, f.name as fryer_name
      FROM fryer_checks fc
      JOIN fryers f ON f.id = fc.fryer_id
      WHERE fc.action_date >= ?
      ORDER BY fc.action_date DESC
      LIMIT 100
    `, [periodSince]);

    // ── 19. Non-conformités ──
    const nonConformities = all(`
      SELECT * FROM non_conformities WHERE created_at >= ? ORDER BY detected_at DESC LIMIT 100
    `, [periodSince]);

    // ── 20. Procédures TIAC ──
    const tiacProcedures = all('SELECT * FROM tiac_procedures ORDER BY date_incident DESC');

    // ── 21. Diagrammes de fabrication ──
    const fabricationDiagrams = all('SELECT * FROM fabrication_diagrams ORDER BY nom ASC').map(d => ({
      ...d,
      etapes: JSON.parse(d.etapes || '[]'),
    }));

    res.json({
      generated_at: new Date().toISOString(),
      period,
      period_days: periodDays,
      period_since: periodSince,
      restaurant: {
        ...restaurant,
        gerant_name: gerant.name || null,
        gerant_email: gerant.email || null,
      },
      sanitary_settings: sanitarySettings,
      hazard_analysis: {
        items: hazards,
        total: hazards.length,
        ccp_count:  hazards.filter(h => h.is_ccp).length,
        high_risk:  hazards.filter(h => h.severity * h.probability > 15).length,
        by_type: {
          B: hazards.filter(h => h.hazard_type === 'B').length,
          C: hazards.filter(h => h.hazard_type === 'C').length,
          P: hazards.filter(h => h.hazard_type === 'P').length,
        },
      },
      ccps: { items: ccps, total: ccps.length },
      decision_tree: { items: decisionTree, total: decisionTree.length },
      cleaning: {
        tasks: cleaningTasks,
        stats: cleaningStats,
        recent_logs: recentCleaningLogs,
      },
      temperatures: {
        zones: temperatureZones,
        logs: temperatureLogs,
        alert_count: tempAlerts.length,
        cooling_logs: coolingLogs,
        reheating_logs: reheatingLogs,
      },
      traceability: {
        reception: receptionRecords,
        downstream: downstreamRecords,
      },
      training: {
        records: trainingRecords,
        stats: trainingStats,
      },
      pest_control: {
        visits: pestControl,
        last_visit: lastPestVisit,
        compliant_count: pestControl.filter(p => p.status === 'conforme').length,
      },
      maintenance: {
        items: maintenance,
        stats: maintenanceStats,
      },
      waste: { items: wasteManagement },
      recall: {
        items: recallProcedures,
        stats: recallStats,
      },
      corrective_actions: {
        log: correctiveActions,
        templates: correctiveTemplates,
      },
      suppliers: { items: suppliers, total: suppliers.length },
      allergens: { items: allergenPlan },
      water_management: { items: waterManagement },
      pms_audits: { items: pmsAudits },
      fryers: { items: fryers, checks: fryerChecks },
      non_conformities: { items: nonConformities },
      tiac_procedures: { items: tiacProcedures, total: tiacProcedures.length },
      fabrication_diagrams: { items: fabricationDiagrams, total: fabricationDiagrams.length },
    });
  } catch (e) {
    console.error('PMS export error:', e.message);
    res.status(500).json({ error: 'Erreur lors de la génération du PMS' });
  }
});

module.exports = router;
