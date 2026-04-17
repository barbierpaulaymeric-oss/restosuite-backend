// ═══════════════════════════════════════════
// Export PMS complet — Route API
// GET /api/pms/export         (JSON)
// GET /api/pms/export/pdf     (PDF côté serveur)
// ═══════════════════════════════════════════

const { Router } = require('express');
const { all, get } = require('../db');
const { requireAuth } = require('./auth');
const PDFDocument = require('pdfkit');
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

// ─── PDF helpers ─────────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PDF_MARGIN = 40;
const CONTENT_W = PAGE_W - 2 * PDF_MARGIN;

function pmsSection(doc, title, yRef) {
  let y = yRef;
  if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1B2A4A');
  doc.rect(PDF_MARGIN, y, CONTENT_W, 16).fill('#E8EEF8').stroke('#1B2A4A');
  doc.fillColor('#1B2A4A').text(title.toUpperCase(), PDF_MARGIN + 6, y + 4, { width: CONTENT_W - 12 });
  return y + 20;
}

function pmsRow(doc, label, value, y, shade) {
  if (y + 14 > 800) { doc.addPage(); y = PDF_MARGIN; }
  if (shade) doc.rect(PDF_MARGIN, y, CONTENT_W, 13).fill('#F8F9FC').stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#555');
  doc.text(label, PDF_MARGIN + 4, y + 3, { width: 140 });
  doc.font('Helvetica').fontSize(7.5).fillColor('#000');
  doc.text(String(value || '—'), PDF_MARGIN + 148, y + 3, { width: CONTENT_W - 152 });
  return y + 14;
}

function pmsStat(doc, label, value, y) {
  if (y + 13 > 800) { doc.addPage(); y = PDF_MARGIN; }
  doc.font('Helvetica').fontSize(7.5).fillColor('#000');
  doc.text(`• ${label} : `, PDF_MARGIN + 4, y + 2, { continued: true, width: 200 });
  doc.font('Helvetica-Bold').text(String(value), { continued: false });
  return y + 13;
}

// GET /api/pms/export/pdf?period=1m|3m|6m|1y
router.get('/export/pdf', (req, res) => {
  try {
    const { period = '1m' } = req.query;
    const periodDays = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 }[period] || 30;
    const periodSince = new Date(Date.now() - periodDays * 24 * 3600 * 1000).toISOString();
    const periodLabel = { '1m': '1 mois', '3m': '3 mois', '6m': '6 mois', '1y': '1 an' }[period] || '1 mois';

    // ── Données ──
    const restaurant = get('SELECT * FROM restaurants ORDER BY id ASC LIMIT 1') || {};
    const gerant = get("SELECT * FROM accounts WHERE role = 'gerant' AND is_owner = 1 LIMIT 1")
                || get("SELECT * FROM accounts WHERE role = 'gerant' LIMIT 1") || {};
    const sanitary = get('SELECT * FROM sanitary_settings ORDER BY id ASC LIMIT 1') || {};
    const hazards = all('SELECT * FROM haccp_hazard_analysis ORDER BY step_name ASC');
    const ccps = all('SELECT c.*, h.step_name FROM haccp_ccp c JOIN haccp_hazard_analysis h ON h.id = c.hazard_analysis_id ORDER BY c.ccp_number ASC');
    const cleaningTasks = all('SELECT * FROM cleaning_tasks ORDER BY zone ASC, name ASC');
    const cleaningLogs = all(`SELECT l.*, t.name as task_name FROM cleaning_logs l JOIN cleaning_tasks t ON t.id = l.task_id WHERE l.completed_at >= ? ORDER BY l.completed_at DESC LIMIT 200`, [periodSince]);
    const tempLogs = all(`SELECT tl.*, tz.name as zone_name FROM temperature_logs tl JOIN temperature_zones tz ON tz.id = tl.zone_id WHERE tl.recorded_at >= ? ORDER BY tl.recorded_at DESC LIMIT 300`, [periodSince]);
    const tempAlerts = tempLogs.filter(t => t.is_alert);
    const receptions = all(`SELECT * FROM traceability_logs WHERE received_at >= ? ORDER BY received_at DESC LIMIT 100`, [periodSince]);
    const training = all('SELECT * FROM training_records ORDER BY training_date DESC');
    const pestControl = all('SELECT * FROM pest_control ORDER BY visit_date DESC LIMIT 10');
    const maintenance = all('SELECT * FROM equipment_maintenance ORDER BY next_maintenance_date ASC');
    const nonConf = all(`SELECT * FROM non_conformities WHERE created_at >= ? ORDER BY detected_at DESC LIMIT 50`, [periodSince]);
    const recalls = all('SELECT * FROM recall_procedures ORDER BY alert_date DESC LIMIT 20');
    const tiac = all('SELECT * FROM tiac_procedures ORDER BY date_incident DESC LIMIT 10');
    const waterMgmt = all('SELECT * FROM water_management ORDER BY analysis_date DESC LIMIT 5');
    const staffHealth = (() => { try { return all('SELECT * FROM staff_health_records ORDER BY date_record DESC LIMIT 50'); } catch { return []; } })();
    const pmsAudits = all('SELECT * FROM pms_audits ORDER BY audit_date DESC LIMIT 5');

    // ── PDF ──
    const doc = new PDFDocument({ size: 'A4', margins: { top: PDF_MARGIN, bottom: PDF_MARGIN, left: PDF_MARGIN, right: PDF_MARGIN }, bufferPages: true });
    const filename = `PMS-DDPP-${restaurant.name || 'restaurant'}-${new Date().toISOString().slice(0, 10)}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── PAGE 1 : Garde ──────────────────────────────────────────────────────
    let y = PDF_MARGIN;
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1B2A4A');
    doc.text('PLAN DE MAÎTRISE SANITAIRE', PDF_MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 26;
    doc.font('Helvetica').fontSize(11).fillColor('#444');
    doc.text('Document officiel — Contrôle DDPP / DGAL', PDF_MARGIN, y, { align: 'center', width: CONTENT_W });
    y += 20;
    doc.moveTo(PDF_MARGIN, y).lineTo(PDF_MARGIN + CONTENT_W, y).lineWidth(1).stroke('#1B2A4A');
    y += 16;

    // Infos établissement
    y = pmsSection(doc, '1. Identification de l\'établissement', y);
    y = pmsRow(doc, 'Établissement', restaurant.name, y, false);
    y = pmsRow(doc, 'Adresse', restaurant.address, y, true);
    y = pmsRow(doc, 'Téléphone', restaurant.phone, y, false);
    y = pmsRow(doc, 'Email', restaurant.email, y, true);
    y = pmsRow(doc, 'Gérant / Responsable', gerant.name, y, false);
    y = pmsRow(doc, 'N° agrément DDPP', sanitary.agrement_number, y, true);
    y = pmsRow(doc, 'Activité', sanitary.activite_type, y, false);
    y = pmsRow(doc, 'Date du document', new Date().toLocaleDateString('fr-FR'), y, true);
    y = pmsRow(doc, 'Période couverte', `${periodLabel} (depuis le ${new Date(periodSince).toLocaleDateString('fr-FR')})`, y, false);
    y += 10;

    // ── Analyse des dangers ──
    y = pmsSection(doc, '2. Analyse des dangers HACCP', y);
    y = pmsStat(doc, 'Total étapes analysées', hazards.length, y);
    y = pmsStat(doc, 'Dangers biologiques', hazards.filter(h => h.hazard_type === 'B').length, y);
    y = pmsStat(doc, 'Dangers chimiques', hazards.filter(h => h.hazard_type === 'C').length, y);
    y = pmsStat(doc, 'Dangers physiques', hazards.filter(h => h.hazard_type === 'P').length, y);
    y = pmsStat(doc, 'Points Critiques de Contrôle (CCP)', hazards.filter(h => h.is_ccp).length, y);
    y += 6;
    // CCP détail
    for (const ccp of ccps) {
      if (y + 28 > 800) { doc.addPage(); y = PDF_MARGIN; }
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1B2A4A');
      doc.text(`CCP ${ccp.ccp_number} — ${ccp.step_name}`, PDF_MARGIN + 4, y + 2, { width: CONTENT_W - 8 });
      y += 11;
      doc.font('Helvetica').fontSize(7).fillColor('#333');
      doc.text(`Limite critique : ${ccp.critical_limits || '—'}`, PDF_MARGIN + 10, y + 2, { width: CONTENT_W - 20 });
      y += 10;
      doc.text(`Surveillance : ${ccp.monitoring_procedure || '—'} (${ccp.monitoring_frequency || '—'})`, PDF_MARGIN + 10, y + 2, { width: CONTENT_W - 20 });
      y += 10;
    }
    y += 4;

    // ── Températures ──
    if (y + 40 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, `3. Relevés de température — ${periodLabel}`, y);
    y = pmsStat(doc, 'Relevés effectués', tempLogs.length, y);
    y = pmsStat(doc, 'Alertes température', tempAlerts.length, y);
    if (tempAlerts.length > 0) {
      doc.font('Helvetica').fontSize(7).fillColor('#D93025');
      for (const al of tempAlerts.slice(0, 5)) {
        if (y + 12 > 800) { doc.addPage(); y = PDF_MARGIN; }
        const dt = new Date(al.recorded_at).toLocaleDateString('fr-FR');
        doc.text(`  ⚠ ${dt} — ${al.zone_name} : ${al.temperature}°C`, PDF_MARGIN + 4, y + 2, { width: CONTENT_W - 8 });
        y += 12;
      }
      if (tempAlerts.length > 5) {
        doc.text(`  ... et ${tempAlerts.length - 5} autre(s) alerte(s)`, PDF_MARGIN + 4, y + 2);
        y += 12;
      }
      doc.fillColor('#000');
    }
    y += 4;

    // ── Nettoyage ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, `4. Plan de nettoyage — ${periodLabel}`, y);
    y = pmsStat(doc, 'Tâches de nettoyage planifiées', cleaningTasks.length, y);
    y = pmsStat(doc, 'Tâches réalisées (période)', cleaningLogs.length, y);
    y += 4;

    // ── Traçabilité ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, `5. Traçabilité amont — ${periodLabel}`, y);
    y = pmsStat(doc, 'Réceptions enregistrées', receptions.length, y);
    const dlcAlerts = receptions.filter(r => r.dlc && new Date(r.dlc) < new Date());
    if (dlcAlerts.length > 0) y = pmsStat(doc, '⚠ DLC dépassées détectées', dlcAlerts.length, y);
    y += 4;

    // ── Formation ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '6. Formation du personnel', y);
    y = pmsStat(doc, 'Formations enregistrées', training.length, y);
    y = pmsStat(doc, 'Réalisées', training.filter(t => t.status === 'réalisé').length, y);
    y = pmsStat(doc, 'Expirées', training.filter(t => t.status === 'expiré').length, y);
    y += 4;

    // ── Santé du personnel ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '7. Santé du personnel (Arr. 21/12/2009 + CE 852/2004)', y);
    if (staffHealth.length === 0) {
      doc.font('Helvetica').fontSize(7.5).fillColor('#555');
      doc.text('Aucun enregistrement de santé du personnel', PDF_MARGIN + 4, y + 2);
      y += 13;
    } else {
      y = pmsStat(doc, 'Enregistrements santé', staffHealth.length, y);
      const unfitNow = staffHealth.filter(s => ['maladie','blessure'].includes(s.record_type) && (!s.date_expiry || s.date_expiry >= new Date().toISOString().slice(0,10)));
      if (unfitNow.length > 0) y = pmsStat(doc, '⚠ Personnel actuellement inapte', unfitNow.length, y);
    }
    y += 4;

    // ── Nuisibles ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '8. Lutte contre les nuisibles', y);
    y = pmsStat(doc, 'Visites enregistrées', pestControl.length, y);
    if (pestControl[0]) {
      y = pmsRow(doc, 'Dernière visite', `${new Date(pestControl[0].visit_date).toLocaleDateString('fr-FR')} — ${pestControl[0].provider_name || '—'} (${pestControl[0].status})`, y, false);
    }
    y += 4;

    // ── Maintenance ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '9. Maintenance des équipements', y);
    y = pmsStat(doc, 'Équipements suivis', maintenance.length, y);
    y = pmsStat(doc, 'À jour', maintenance.filter(m => m.status === 'à_jour').length, y);
    y = pmsStat(doc, 'En retard', maintenance.filter(m => m.status === 'en_retard').length, y);
    y += 4;

    // ── Non-conformités ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, `10. Non-conformités — ${periodLabel}`, y);
    y = pmsStat(doc, 'Non-conformités détectées', nonConf.length, y);
    y = pmsStat(doc, 'Critiques', nonConf.filter(n => n.severity === 'critique').length, y);
    y = pmsStat(doc, 'Résolues', nonConf.filter(n => n.status === 'resolu').length, y);
    y += 4;

    // ── Retrait/Rappel ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '11. Procédures retrait/rappel', y);
    y = pmsStat(doc, 'Procédures enregistrées', recalls.length, y);
    y = pmsStat(doc, 'Actives', recalls.filter(r => r.status !== 'cloture').length, y);
    y += 4;

    // ── TIAC ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '12. Toxi-infections alimentaires collectives (TIAC)', y);
    y = pmsStat(doc, 'Procédures TIAC enregistrées', tiac.length, y);
    if (tiac.length > 0) {
      for (const t of tiac.slice(0, 3)) {
        if (y + 12 > 800) { doc.addPage(); y = PDF_MARGIN; }
        const dt = new Date(t.date_incident).toLocaleDateString('fr-FR');
        doc.font('Helvetica').fontSize(7).fillColor('#333');
        doc.text(`  ${dt} — ${t.description ? t.description.slice(0, 80) : '—'}`, PDF_MARGIN + 4, y + 2, { width: CONTENT_W - 8 });
        y += 12;
      }
    }
    y += 4;

    // ── Gestion de l'eau ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '13. Gestion de l\'eau', y);
    y = pmsStat(doc, 'Analyses enregistrées', waterMgmt.length, y);
    if (waterMgmt[0]) {
      y = pmsRow(doc, 'Dernière analyse', `${new Date(waterMgmt[0].analysis_date).toLocaleDateString('fr-FR')} — ${waterMgmt[0].analysis_type || '—'} (conformité : ${waterMgmt[0].conformity || '—'})`, y, false);
    }
    y += 4;

    // ── Audits PMS ──
    if (y + 30 > 800) { doc.addPage(); y = PDF_MARGIN; }
    y = pmsSection(doc, '14. Audits PMS', y);
    y = pmsStat(doc, 'Audits réalisés', pmsAudits.length, y);
    if (pmsAudits[0]) {
      y = pmsRow(doc, 'Dernier audit', `${new Date(pmsAudits[0].audit_date).toLocaleDateString('fr-FR')} — ${pmsAudits[0].audit_type} — Score : ${pmsAudits[0].overall_score}/100`, y, false);
    }
    y += 4;

    // ── Pied de page sur toutes les pages ──────────────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(7).fillColor('#888');
      doc.text(
        `${restaurant.name || 'Établissement'} — PMS DDPP — Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} — Page ${i + 1}/${pageCount}`,
        PDF_MARGIN, 820, { width: CONTENT_W, align: 'center' }
      );
    }

    doc.end();
  } catch (e) {
    console.error('PMS PDF export error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
  }
});

module.exports = router;
