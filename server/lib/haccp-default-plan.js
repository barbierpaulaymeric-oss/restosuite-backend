'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Default HACCP "plan de maîtrise sanitaire" (hazard analysis + CCPs + Codex
// decision tree), seeded PER RESTAURANT.
//
// Historically this plan was seeded once, globally, and the Phase-2 tenancy
// backfill homed every seeded row to restaurant_id=1 — so every restaurant
// other than #1 opened the app (and the DDPP export) with an EMPTY plan, the
// first document a health inspector asks for (audit 2026-07-05, critical).
//
// This module makes the default plan tenant-scoped: called at registration for
// each new restaurant, and by a migration that backfills existing tenants that
// have no plan yet. Idempotent — never double-seeds a restaurant that already
// has hazards.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_HAZARDS = [
  { step_name: 'Réception', hazard_type: 'B', hazard_description: 'Contamination par Salmonella spp. via viandes ou œufs', severity: 5, probability: 3, is_ccp: 0, preventive_measures: 'Contrôle température à réception (<4°C), vérification certificats fournisseur, audit fournisseur annuel' },
  { step_name: 'Réception', hazard_type: 'C', hazard_description: 'Résidus de pesticides sur légumes et fruits', severity: 3, probability: 2, is_ccp: 0, preventive_measures: 'Fournisseurs certifiés, fiche de conformité, analyses périodiques' },
  { step_name: 'Réception', hazard_type: 'P', hazard_description: 'Corps étrangers (éclats de verre, métal) dans les emballages', severity: 4, probability: 2, is_ccp: 0, preventive_measures: 'Inspection visuelle à réception, procédure de refus des emballages détériorés' },
  { step_name: 'Stockage', hazard_type: 'B', hazard_description: 'Prolifération de Listeria monocytogenes en chambre froide', severity: 5, probability: 3, is_ccp: 1, preventive_measures: 'Température maintenue <4°C, surveillance 2×/jour, séparation cru/cuit' },
  { step_name: 'Stockage', hazard_type: 'C', hazard_description: 'Contamination croisée par allergènes (gluten, lait, noix)', severity: 4, probability: 3, is_ccp: 0, preventive_measures: 'Stockage séparé allergènes, emballages hermétiques, étiquetage rigoureux' },
  { step_name: 'Préparation', hazard_type: 'B', hazard_description: 'Contamination croisée via surfaces et ustensiles souillés', severity: 4, probability: 4, is_ccp: 0, preventive_measures: 'Nettoyage-désinfection des plans de travail, planches colorées HACCP, lavage mains fréquent' },
  { step_name: 'Préparation', hazard_type: 'P', hazard_description: 'Corps étrangers issus du personnel (bijoux, cheveux)', severity: 3, probability: 3, is_ccp: 0, preventive_measures: 'Port de toque et filet, interdiction bijoux, contrôle encadrement' },
  { step_name: 'Cuisson', hazard_type: 'B', hazard_description: 'Survie de pathogènes (Salmonella, E. coli) si température insuffisante', severity: 5, probability: 3, is_ccp: 1, preventive_measures: 'Cuisson à cœur ≥75°C, contrôle thermomètre sonde, fiche de validation cuisson' },
  { step_name: 'Refroidissement', hazard_type: 'B', hazard_description: 'Prolifération de Clostridium perfringens lors du refroidissement lent', severity: 4, probability: 4, is_ccp: 1, preventive_measures: 'Refroidissement 63°C→10°C en <2h par cellule de refroidissement, enregistrement des temps' },
  { step_name: 'Service', hazard_type: 'B', hazard_description: 'Contamination par le personnel lors du service (mains, toux)', severity: 3, probability: 3, is_ccp: 0, preventive_measures: 'Formation hygiène, port de gants si contact direct, service chaud >63°C ou froid <4°C' },
  { step_name: 'Service', hazard_type: 'C', hazard_description: 'Non-déclaration allergènes INCO (EU 1169/2011)', severity: 5, probability: 2, is_ccp: 0, preventive_measures: 'Affichage carte allergènes, formation équipe salle, procédure alerte cuisine' },
];

// CCP definitions keyed by the (step_name, hazard_type='B') hazard they attach to.
const DEFAULT_CCPS = [
  { step: 'Stockage', ccp_number: 'CCP1',
    critical_limits: 'Température chambre froide ≤4°C en permanence',
    monitoring_procedure: 'Lecture du thermomètre numérique de la chambre froide positive',
    monitoring_frequency: '2 fois par jour (ouverture et fermeture)',
    corrective_actions: 'Vérification thermostat ; transfert immédiat des produits si T°>5°C ; alerte maintenance si anomalie persistante >2h',
    verification_procedure: 'Calibration du thermomètre trimestrielle ; revue mensuelle des fiches relevé',
    records_kept: 'Fiche relevé température journalière (Fiche T-CF-001)',
    responsible_person: 'Responsable cuisine / Chef de partie froid' },
  { step: 'Cuisson', ccp_number: 'CCP2',
    critical_limits: 'Température à cœur ≥75°C pendant ≥2 minutes (70°C pendant ≥2 min pour volaille)',
    monitoring_procedure: 'Mesure à la sonde thermométrique au centre géométrique du produit en fin de cuisson',
    monitoring_frequency: 'À chaque cuisson — 100 % des lots',
    corrective_actions: 'Prolonger la cuisson jusqu\'à T° cible atteinte ; rejeter le lot si T° non atteignable après 2 corrections',
    verification_procedure: 'Calibration annuelle de la sonde ; audit procédure par responsable qualité trimestriel',
    records_kept: 'Fiche cuisson journalière (Fiche C-001) ; registre de calibration sonde',
    responsible_person: 'Chef de cuisine / Cuisinier responsable' },
  { step: 'Refroidissement', ccp_number: 'CCP3',
    critical_limits: 'Passage de 63°C à moins de 10°C en ≤2 heures (cellule de refroidissement rapide)',
    monitoring_procedure: 'Mesure sonde au cœur du produit au départ (≥63°C) et à l\'arrivée (<10°C) ; chronométrage de la durée',
    monitoring_frequency: 'À chaque refroidissement — 100 % des préparations chaudes destinées à la conservation',
    corrective_actions: 'Si délai >2h : destruction de la préparation et traçabilité ; si cellule défaillante : alerte maintenance immédiate et suspension de la production',
    verification_procedure: 'Contrôle de la cellule hebdomadaire (cycle test à vide) ; maintenance préventive semestrielle',
    records_kept: 'Fiche refroidissement rapide (Fiche RF-001) avec heures et températures',
    responsible_person: 'Chef de cuisine / Commis responsable refroidissement' },
];

// Codex Alimentarius decision-tree result per (step_name-hazard_type).
const DT_RULES = {
  'Réception-B':   { q1: 1, q2: 0, q3: 1, q4: 1, result: 'PRPO' },
  'Réception-C':   { q1: 1, q2: 0, q3: 0, q4: 0, result: 'PRP' },
  'Réception-P':   { q1: 1, q2: 0, q3: 1, q4: 1, result: 'PRPO' },
  'Stockage-B':    { q1: 1, q2: 1, q3: 1, q4: 0, result: 'CCP' },
  'Stockage-C':    { q1: 1, q2: 0, q3: 0, q4: 0, result: 'PRP' },
  'Préparation-B': { q1: 1, q2: 0, q3: 1, q4: 1, result: 'PRPO' },
  'Préparation-P': { q1: 1, q2: 0, q3: 0, q4: 0, result: 'PRP' },
  'Cuisson-B':     { q1: 1, q2: 1, q3: 1, q4: 0, result: 'CCP' },
  'Refroidissement-B': { q1: 1, q2: 1, q3: 1, q4: 0, result: 'CCP' },
  'Service-B':     { q1: 1, q2: 0, q3: 0, q4: 0, result: 'PRP' },
  'Service-C':     { q1: 1, q2: 0, q3: 0, q4: 0, result: 'PRP' },
};

// True if `restaurantId` already has any hazard rows (so we never double-seed).
function restaurantHasHaccpPlan(db, restaurantId) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM haccp_hazard_analysis WHERE restaurant_id = ?').get(restaurantId);
  return !!(row && row.c > 0);
}

// Seeds the default plan for one restaurant inside a transaction. No-op if the
// restaurant already has a plan. Requires the three haccp_* tables to already
// carry a restaurant_id column (guaranteed post Phase-2 migration).
function seedDefaultHaccpPlan(db, restaurantId) {
  if (!restaurantId) return { seeded: false, reason: 'no restaurant_id' };
  if (restaurantHasHaccpPlan(db, restaurantId)) return { seeded: false, reason: 'already has plan' };

  const insertHazard = db.prepare(
    `INSERT INTO haccp_hazard_analysis (restaurant_id, step_name, hazard_type, hazard_description, severity, probability, is_ccp, preventive_measures)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertCCP = db.prepare(
    `INSERT INTO haccp_ccp (restaurant_id, hazard_analysis_id, ccp_number, critical_limits, monitoring_procedure, monitoring_frequency, corrective_actions, verification_procedure, records_kept, responsible_person)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertDT = db.prepare(
    `INSERT INTO haccp_decision_tree_results (restaurant_id, hazard_analysis_id, q1_preventive_measure, q2_step_designed_eliminate, q3_contamination_possible, q4_subsequent_step_eliminate, result)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    // step_name → hazard id (the (step,'B') hazard, used to attach CCPs)
    const bHazardIdByStep = {};
    for (const h of DEFAULT_HAZARDS) {
      const info = insertHazard.run(restaurantId, h.step_name, h.hazard_type, h.hazard_description, h.severity, h.probability, h.is_ccp, h.preventive_measures);
      if (h.hazard_type === 'B') bHazardIdByStep[h.step_name] = info.lastInsertRowid;
      const rule = DT_RULES[`${h.step_name}-${h.hazard_type}`];
      if (rule) insertDT.run(restaurantId, info.lastInsertRowid, rule.q1, rule.q2, rule.q3, rule.q4, rule.result);
    }
    for (const c of DEFAULT_CCPS) {
      const hazardId = bHazardIdByStep[c.step];
      if (!hazardId) continue;
      insertCCP.run(restaurantId, hazardId, c.ccp_number, c.critical_limits, c.monitoring_procedure, c.monitoring_frequency, c.corrective_actions, c.verification_procedure, c.records_kept, c.responsible_person);
    }
  });
  tx();
  return { seeded: true, hazards: DEFAULT_HAZARDS.length, ccps: DEFAULT_CCPS.length };
}

module.exports = {
  DEFAULT_HAZARDS,
  DEFAULT_CCPS,
  DT_RULES,
  restaurantHasHaccpPlan,
  seedDefaultHaccpPlan,
};
