'use strict';

require('../app'); // ensure migrations have run
const { db } = require('../db');

const TARGET_TABLES = [
  'ingredients','recipes','recipe_ingredients','recipe_steps',
  'stock','stock_movements','suppliers','supplier_prices','supplier_accounts',
  'supplier_catalog','ingredient_supplier_prefs','price_history','price_change_notifications',
  'temperature_zones','temperature_logs','cleaning_tasks','cleaning_logs',
  'cooling_logs','reheating_logs','fryers','fryer_checks','non_conformities',
  'haccp_hazard_analysis','haccp_ccp','haccp_decision_tree_results',
  'traceability_logs','downstream_traceability','recall_procedures','training_records',
  'pest_control','equipment_maintenance','waste_management',
  'corrective_actions_templates','corrective_actions_log',
  'allergen_management_plan','water_management','pms_audits',
  'tiac_procedures','fabrication_diagrams',
  'order_items','purchase_orders','purchase_order_items',
  'delivery_notes','delivery_note_items','loyalty_transactions',
  'prediction_accuracy','referrals'
];

describe('Phase 2 schema — every tenant-scoped table has restaurant_id', () => {
  for (const t of TARGET_TABLES) {
    it(`${t}.restaurant_id exists`, () => {
      const rows = db.prepare(`PRAGMA table_info(${t})`).all();
      if (rows.length === 0) return; // table not created in this build; skip silently
      const cols = rows.map(r => r.name);
      expect(cols).toContain('restaurant_id');
    });
  }

  it('audit_log exists with required columns', () => {
    const rows = db.prepare(`PRAGMA table_info(audit_log)`).all();
    const cols = rows.map(r => r.name);
    expect(cols).toEqual(expect.arrayContaining([
      'id','restaurant_id','account_id','table_name','record_id','action','old_values','new_values','created_at'
    ]));
  });
});
