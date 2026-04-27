'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Idempotent schema migrations: ALTER TABLE guards, CREATE TABLE IF NOT
// EXISTS for tables added after v1, backfills, seed data. Every block is
// wrapped in try/catch so a partial failure cannot prevent boot. Extracted
// verbatim from the original db.js (see git history).
// ═══════════════════════════════════════════════════════════════════════════

function runMigrations(db, helpers) {
  const { all, get, run } = helpers;

// ─── Migration: Add trial_start to accounts ───
try {
  const cols = all("PRAGMA table_info(accounts)");
  const hasTrialStart = cols.some(c => c.name === 'trial_start');
  if (!hasTrialStart) {
    db.exec("ALTER TABLE accounts ADD COLUMN trial_start DATETIME");
    // Backfill existing accounts: set trial_start = created_at
    db.exec("UPDATE accounts SET trial_start = created_at WHERE trial_start IS NULL");
    console.log('✅ Migration: added trial_start to accounts');
  }
} catch (e) {
  console.error('Migration trial_start error:', e.message);
}

// ─── Migration: Add recipe_type / description / photo_url to recipes ───
// public-api.js (/api/public/v1/menu) selects r.description and r.photo_url.
// These were added to prod DB manually but missed from base schema — fresh
// test DBs (and any new install) would error with "no such column".
try {
  const recipeCols = all("PRAGMA table_info(recipes)");
  if (!recipeCols.some(c => c.name === 'recipe_type')) {
    db.exec("ALTER TABLE recipes ADD COLUMN recipe_type TEXT DEFAULT 'plat'");
    console.log('✅ Migration: added recipe_type to recipes');
  }
  if (!recipeCols.some(c => c.name === 'description')) {
    db.exec("ALTER TABLE recipes ADD COLUMN description TEXT");
    console.log('✅ Migration: added description to recipes');
  }
  if (!recipeCols.some(c => c.name === 'photo_url')) {
    db.exec("ALTER TABLE recipes ADD COLUMN photo_url TEXT");
    console.log('✅ Migration: added photo_url to recipes');
  }
} catch (e) {
  console.error('Migration recipes columns error:', e.message);
}

// ─── Migration: Add sub_recipe_id to recipe_ingredients ───
try {
  const riCols = all("PRAGMA table_info(recipe_ingredients)");
  if (!riCols.some(c => c.name === 'sub_recipe_id')) {
    db.exec("ALTER TABLE recipe_ingredients ADD COLUMN sub_recipe_id INTEGER REFERENCES recipes(id)");
    // Make ingredient_id nullable for sub-recipe rows
    console.log('✅ Migration: added sub_recipe_id to recipe_ingredients');
  }
} catch (e) {
  console.error('Migration sub_recipe_id error:', e.message);
}

// ─── Migration: Add price_per_unit to ingredients ───
try {
  const ingCols = all("PRAGMA table_info(ingredients)");
  if (!ingCols.some(c => c.name === 'price_per_unit')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN price_per_unit REAL DEFAULT 0");
    console.log('✅ Migration: added price_per_unit to ingredients');
  }
  if (!ingCols.some(c => c.name === 'price_unit')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN price_unit TEXT DEFAULT 'kg'");
    console.log('✅ Migration: added price_unit to ingredients');
  }
} catch (e) {
  console.error('Migration price_per_unit error:', e.message);
}

// ─── Migration: Orders tables ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER NOT NULL,
      status TEXT DEFAULT 'en_cours',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_cost REAL DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      recipe_id INTEGER NOT NULL REFERENCES recipes(id),
      quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'en_attente',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_recipe_id ON order_items(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);
} catch (e) {
  // Tables may already exist
}

// ─── Migration: Supplier Purchase Orders ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      status TEXT DEFAULT 'brouillon',
      reference TEXT,
      notes TEXT,
      total_amount REAL DEFAULT 0,
      expected_delivery DATE,
      created_by INTEGER REFERENCES accounts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      received_at DATETIME,
      received_by INTEGER REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      ingredient_id INTEGER REFERENCES ingredients(id),
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'kg',
      unit_price REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      notes TEXT
    );
  `);
} catch (e) {
  // Tables may already exist
}

// ─── Migration: Referral program ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_code TEXT UNIQUE NOT NULL,
      referrer_account_id INTEGER NOT NULL,
      referred_account_id INTEGER,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );
  `);
  const accCols = all("PRAGMA table_info(accounts)");
  if (!accCols.some(c => c.name === 'referral_code')) {
    db.exec("ALTER TABLE accounts ADD COLUMN referral_code TEXT");
    // Create unique index separately (SQLite doesn't support UNIQUE in ALTER TABLE)
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_referral_code ON accounts(referral_code) WHERE referral_code IS NOT NULL");
    console.log('✅ Migration: added referral_code to accounts');
  }
  if (!accCols.some(c => c.name === 'referred_by')) {
    db.exec("ALTER TABLE accounts ADD COLUMN referred_by TEXT");
    console.log('✅ Migration: added referred_by to accounts');
  }
  if (!accCols.some(c => c.name === 'referral_bonus_days')) {
    db.exec("ALTER TABLE accounts ADD COLUMN referral_bonus_days INTEGER DEFAULT 0");
    console.log('✅ Migration: added referral_bonus_days to accounts');
  }
} catch (e) {
  console.error('Migration referral error:', e.message);
}

// ─── Migration: Make ingredient_id nullable in recipe_ingredients (for sub-recipes) ───
try {
  const riCols2 = all("PRAGMA table_info(recipe_ingredients)");
  const ingIdCol = riCols2.find(c => c.name === 'ingredient_id');
  if (ingIdCol && ingIdCol.notnull === 1) {
    // ingredient_id is NOT NULL — need to recreate table with nullable ingredient_id
    db.exec(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id),
        gross_quantity REAL NOT NULL,
        net_quantity REAL,
        unit TEXT NOT NULL DEFAULT 'portions',
        custom_waste_percent REAL,
        notes TEXT,
        sub_recipe_id INTEGER REFERENCES recipes(id)
      );
      INSERT INTO recipe_ingredients_new SELECT id, recipe_id, ingredient_id, gross_quantity, net_quantity, unit, custom_waste_percent, notes, sub_recipe_id FROM recipe_ingredients;
      DROP TABLE recipe_ingredients;
      ALTER TABLE recipe_ingredients_new RENAME TO recipe_ingredients;
    `);
    console.log('✅ Migration: made ingredient_id nullable in recipe_ingredients');
  }
} catch (e) {
  console.error('Migration nullable ingredient_id error:', e.message);
}

// ─── Migration: Add auth columns to accounts ───
try {
  const authCols = all("PRAGMA table_info(accounts)");
  const colNames = authCols.map(c => c.name);
  if (!colNames.includes('email')) {
    db.exec("ALTER TABLE accounts ADD COLUMN email TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email) WHERE email IS NOT NULL");
    console.log('✅ Migration: added email to accounts');
  }
  if (!colNames.includes('password_hash')) {
    db.exec("ALTER TABLE accounts ADD COLUMN password_hash TEXT");
    console.log('✅ Migration: added password_hash to accounts');
  }
  if (!colNames.includes('first_name')) {
    db.exec("ALTER TABLE accounts ADD COLUMN first_name TEXT");
    console.log('✅ Migration: added first_name to accounts');
  }
  if (!colNames.includes('last_name')) {
    db.exec("ALTER TABLE accounts ADD COLUMN last_name TEXT");
    console.log('✅ Migration: added last_name to accounts');
  }
  if (!colNames.includes('phone')) {
    db.exec("ALTER TABLE accounts ADD COLUMN phone TEXT");
    console.log('✅ Migration: added phone to accounts');
  }
  if (!colNames.includes('restaurant_id')) {
    db.exec("ALTER TABLE accounts ADD COLUMN restaurant_id INTEGER REFERENCES restaurants(id)");
    console.log('✅ Migration: added restaurant_id to accounts');
  }
  if (!colNames.includes('onboarding_step')) {
    db.exec("ALTER TABLE accounts ADD COLUMN onboarding_step INTEGER DEFAULT 0");
    console.log('✅ Migration: added onboarding_step to accounts');
  }
  if (!colNames.includes('is_owner')) {
    db.exec("ALTER TABLE accounts ADD COLUMN is_owner INTEGER DEFAULT 0");
    console.log('✅ Migration: added is_owner to accounts');
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_accounts_restaurant_id ON accounts(restaurant_id)");
} catch (e) {
  console.error('Migration auth columns error:', e.message);
}

// ─── Migration: Add staff_password to restaurants ───
try {
  const restCols = all("PRAGMA table_info(restaurants)");
  if (!restCols.some(c => c.name === 'staff_password')) {
    db.exec("ALTER TABLE restaurants ADD COLUMN staff_password TEXT");
    console.log('✅ Migration: added staff_password to restaurants');
  }
} catch (e) {
  console.error('Migration staff_password error:', e.message);
}

// ─── Migration: Add auth columns to suppliers (company-level login) ───
try {
  const suppCols = all("PRAGMA table_info(suppliers)");
  const suppColNames = suppCols.map(c => c.name);
  if (!suppColNames.includes('email')) {
    db.exec("ALTER TABLE suppliers ADD COLUMN email TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL");
    console.log('✅ Migration: added email to suppliers');
  }
  if (!suppColNames.includes('password_hash')) {
    db.exec("ALTER TABLE suppliers ADD COLUMN password_hash TEXT");
    console.log('✅ Migration: added password_hash to suppliers');
  }
  if (!suppColNames.includes('contact_name')) {
    db.exec("ALTER TABLE suppliers ADD COLUMN contact_name TEXT");
    console.log('✅ Migration: added contact_name to suppliers');
  }
} catch (e) {
  console.error('Migration supplier auth columns error:', e.message);
}

// ─── Migration: Make pin nullable in accounts (for staff who create PIN on first login) ───
try {
  const accPinCols = all("PRAGMA table_info(accounts)");
  const pinCol = accPinCols.find(c => c.name === 'pin');
  if (pinCol && pinCol.notnull === 1) {
    // Get all current column names for the copy
    const colNames = accPinCols.map(c => c.name).join(', ');
    db.exec(`DROP TABLE IF EXISTS accounts_new`);
    db.exec(`
      CREATE TABLE accounts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin TEXT,
        role TEXT NOT NULL DEFAULT 'equipier',
        permissions TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        trial_start DATETIME,
        email TEXT,
        password_hash TEXT,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        restaurant_id INTEGER REFERENCES restaurants(id),
        onboarding_step INTEGER DEFAULT 0,
        is_owner INTEGER DEFAULT 0,
        referral_code TEXT,
        referred_by TEXT,
        referral_bonus_days INTEGER DEFAULT 0
      );
      INSERT INTO accounts_new (${colNames}) SELECT ${colNames} FROM accounts;
      DROP TABLE accounts;
      ALTER TABLE accounts_new RENAME TO accounts;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email) WHERE email IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_referral_code ON accounts(referral_code) WHERE referral_code IS NOT NULL;
    `);
    console.log('✅ Migration: made pin nullable in accounts');
  }
} catch (e) {
  console.error('Migration nullable pin error:', e.message);
}

// ─── Migration: Add service_settings to restaurants ───
try {
  const restCols2 = all("PRAGMA table_info(restaurants)");
  const restColNames = restCols2.map(c => c.name);
  if (!restColNames.includes('service_start')) {
    db.exec("ALTER TABLE restaurants ADD COLUMN service_start TEXT");
    console.log('✅ Migration: added service_start to restaurants');
  }
  if (!restColNames.includes('service_end')) {
    db.exec("ALTER TABLE restaurants ADD COLUMN service_end TEXT");
    console.log('✅ Migration: added service_end to restaurants');
  }
  if (!restColNames.includes('service_active')) {
    db.exec("ALTER TABLE restaurants ADD COLUMN service_active INTEGER DEFAULT 0");
    console.log('✅ Migration: added service_active to restaurants');
  }
} catch (e) {
  console.error('Migration service settings error:', e.message);
}

// ─── Migration: Service sessions table ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      scheduled_start TEXT,
      scheduled_end TEXT,
      total_orders INTEGER DEFAULT 0,
      total_items INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      avg_ticket_time_min REAL,
      peak_hour TEXT,
      status TEXT DEFAULT 'active',
      recap_sent INTEGER DEFAULT 0
    );
  `);
} catch (e) {
  // Table may already exist
}

// ─── Migration: Add custom_roles to restaurants ───
try {
  const restCols3 = all("PRAGMA table_info(restaurants)");
  if (!restCols3.some(c => c.name === 'custom_roles')) {
    db.exec("ALTER TABLE restaurants ADD COLUMN custom_roles TEXT");
    console.log('✅ Migration: added custom_roles to restaurants');
  }
} catch (e) {
  console.error('Migration custom_roles error:', e.message);
}

// ─── Migration: Add restaurant_id to orders (required for multi-site & analytics) ───
try {
  const orderCols = all("PRAGMA table_info(orders)");
  if (!orderCols.some(c => c.name === 'restaurant_id')) {
    db.exec("ALTER TABLE orders ADD COLUMN restaurant_id INTEGER REFERENCES restaurants(id)");
    // Backfill existing orders: assign to first restaurant if exists
    const firstRestaurant = get('SELECT id FROM restaurants LIMIT 1');
    if (firstRestaurant) {
      db.exec(`UPDATE orders SET restaurant_id = ${firstRestaurant.id} WHERE restaurant_id IS NULL`);
    }
    console.log('✅ Migration: added restaurant_id to orders');
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id)");
} catch (e) {
  console.error('Migration orders restaurant_id error:', e.message);
}

// ─── Seed: Common ingredients with prices ───
try {
  const seedIngredients = require('./seed-ingredients');
  seedIngredients(db, get, run);
} catch (e) {
  console.error('Seed ingredients error:', e.message);
}

// ─── Migration: HACCP Refroidissements rapides ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cooling_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      quantity REAL,
      unit TEXT DEFAULT 'kg',
      start_time DATETIME NOT NULL,
      temp_start REAL NOT NULL,
      time_at_63c DATETIME,
      time_at_10c DATETIME,
      is_compliant INTEGER,
      notes TEXT,
      recorded_by INTEGER REFERENCES accounts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cooling_logs_start_time ON cooling_logs(start_time);
  `);
  console.log('✅ Migration: cooling_logs table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration cooling_logs error:', e.message);
}

// ─── Migration: HACCP Remises en température ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reheating_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      quantity REAL,
      unit TEXT DEFAULT 'kg',
      start_time DATETIME NOT NULL,
      temp_start REAL NOT NULL,
      time_at_63c DATETIME,
      is_compliant INTEGER,
      notes TEXT,
      recorded_by INTEGER REFERENCES accounts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reheating_logs_start_time ON reheating_logs(start_time);
  `);
  console.log('✅ Migration: reheating_logs table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration reheating_logs error:', e.message);
}

// ─── Migration: HACCP Registre de cuisson (CCP2) ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cooking_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL DEFAULT 1,
      recipe_id INTEGER,
      product_name TEXT NOT NULL,
      batch_number TEXT,
      cooking_date TEXT NOT NULL,
      cooking_time_start TEXT,
      cooking_time_end TEXT,
      target_temperature REAL NOT NULL,
      measured_temperature REAL NOT NULL,
      is_compliant INTEGER,
      thermometer_id INTEGER,
      corrective_action TEXT,
      operator TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cooking_records_restaurant_id ON cooking_records(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_cooking_records_cooking_date ON cooking_records(cooking_date);
    CREATE INDEX IF NOT EXISTS idx_cooking_records_is_compliant ON cooking_records(is_compliant);
  `);
  // Product category for CCP2 legal thresholds (63/65/70/75°C)
  const cookingCols = all('PRAGMA table_info(cooking_records)').map(c => c.name);
  if (!cookingCols.includes('product_category')) {
    db.exec("ALTER TABLE cooking_records ADD COLUMN product_category TEXT");
    console.log('✅ Migration: cooking_records.product_category ajouté (CCP2 thresholds)');
  }
  console.log('✅ Migration: cooking_records table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration cooking_records error:', e.message);
}

// ─── Migration: HACCP Gestion huiles de friture ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fryers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fryer_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fryer_id INTEGER NOT NULL REFERENCES fryers(id),
      action_type TEXT NOT NULL,
      action_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      polar_value REAL,
      notes TEXT,
      recorded_by INTEGER REFERENCES accounts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_fryer_checks_fryer_id ON fryer_checks(fryer_id);
    CREATE INDEX IF NOT EXISTS idx_fryer_checks_action_date ON fryer_checks(action_date);
  `);
  console.log('✅ Migration: fryers + fryer_checks tables ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration fryers error:', e.message);
}

// ─── Migration: Add is_compliant + corrective_action to fryer_checks ───
// Arrêté 21/12/2009 Art 6 — polar compounds must be ≤ 25%. Track compliance flag
// server-side so non-compliant records can't silently pass.
try {
  const cols = all("PRAGMA table_info(fryer_checks)");
  if (!cols.some(c => c.name === 'is_compliant')) {
    db.exec("ALTER TABLE fryer_checks ADD COLUMN is_compliant INTEGER DEFAULT 1");
    console.log('✅ Migration: added is_compliant to fryer_checks');
  }
  if (!cols.some(c => c.name === 'corrective_action')) {
    db.exec("ALTER TABLE fryer_checks ADD COLUMN corrective_action TEXT");
    console.log('✅ Migration: added corrective_action to fryer_checks');
  }
} catch (e) {
  console.error('Migration fryer_checks compliance error:', e.message);
}

// ─── Migration: HACCP Non-conformités ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS non_conformities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'autre',
      severity TEXT DEFAULT 'mineure',
      status TEXT DEFAULT 'ouvert',
      corrective_action TEXT,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      detected_by INTEGER REFERENCES accounts(id),
      resolved_at DATETIME,
      resolved_by INTEGER REFERENCES accounts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_non_conformities_status ON non_conformities(status);
    CREATE INDEX IF NOT EXISTS idx_non_conformities_detected_at ON non_conformities(detected_at);
  `);
  console.log('✅ Migration: non_conformities table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration non_conformities error:', e.message);
}

// ─── Migration: HACCP Plan formalisé ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS haccp_hazard_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step_name TEXT NOT NULL,
      hazard_type TEXT NOT NULL DEFAULT 'B',
      hazard_description TEXT NOT NULL,
      severity INTEGER NOT NULL DEFAULT 3,
      probability INTEGER NOT NULL DEFAULT 3,
      is_ccp INTEGER DEFAULT 0,
      preventive_measures TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS haccp_ccp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hazard_analysis_id INTEGER NOT NULL REFERENCES haccp_hazard_analysis(id) ON DELETE CASCADE,
      ccp_number TEXT NOT NULL,
      critical_limits TEXT,
      monitoring_procedure TEXT,
      monitoring_frequency TEXT,
      corrective_actions TEXT,
      verification_procedure TEXT,
      records_kept TEXT,
      responsible_person TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS haccp_decision_tree_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hazard_analysis_id INTEGER NOT NULL REFERENCES haccp_hazard_analysis(id) ON DELETE CASCADE,
      q1_preventive_measure INTEGER,
      q2_step_designed_eliminate INTEGER,
      q3_contamination_possible INTEGER,
      q4_subsequent_step_eliminate INTEGER,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_haccp_hazard_step ON haccp_hazard_analysis(step_name);
    CREATE INDEX IF NOT EXISTS idx_haccp_ccp_hazard ON haccp_ccp(hazard_analysis_id);
    CREATE INDEX IF NOT EXISTS idx_haccp_dt_hazard ON haccp_decision_tree_results(hazard_analysis_id);
  `);
  console.log('✅ Migration: HACCP Plan tables ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration haccp plan error:', e.message);
}

// ─── Seed: HACCP default hazard analysis ───
try {
  const existingHazards = get("SELECT COUNT(*) as count FROM haccp_hazard_analysis");
  if (existingHazards && existingHazards.count === 0) {
    const defaultHazards = [
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
    const insertHazard = db.prepare(
      `INSERT INTO haccp_hazard_analysis (step_name, hazard_type, hazard_description, severity, probability, is_ccp, preventive_measures)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const h of defaultHazards) {
      insertHazard.run(h.step_name, h.hazard_type, h.hazard_description, h.severity, h.probability, h.is_ccp, h.preventive_measures);
    }
    console.log(`✅ Seed: ${defaultHazards.length} dangers HACCP par défaut insérés`);
  }
} catch (e) {
  console.error('Seed haccp hazards error:', e.message);
}

// ─── Seed: HACCP CCP — limites critiques des 3 CCP ───
try {
  const existingCCPs = get("SELECT COUNT(*) as count FROM haccp_ccp");
  if (existingCCPs && existingCCPs.count === 0) {
    const stockage  = get("SELECT id FROM haccp_hazard_analysis WHERE step_name='Stockage'       AND hazard_type='B' LIMIT 1");
    const cuisson   = get("SELECT id FROM haccp_hazard_analysis WHERE step_name='Cuisson'        AND hazard_type='B' LIMIT 1");
    const refroid   = get("SELECT id FROM haccp_hazard_analysis WHERE step_name='Refroidissement' AND hazard_type='B' LIMIT 1");

    if (stockage && cuisson && refroid) {
      const insertCCP = db.prepare(`
        INSERT INTO haccp_ccp
          (hazard_analysis_id, ccp_number, critical_limits, monitoring_procedure, monitoring_frequency,
           corrective_actions, verification_procedure, records_kept, responsible_person)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      insertCCP.run(
        stockage.id, 'CCP1',
        'Température chambre froide ≤4°C en permanence',
        'Lecture du thermomètre numérique de la chambre froide positive',
        '2 fois par jour (ouverture et fermeture)',
        'Vérification thermostat ; transfert immédiat des produits si T°>5°C ; alerte maintenance si anomalie persistante >2h',
        'Calibration du thermomètre trimestrielle ; revue mensuelle des fiches relevé',
        'Fiche relevé température journalière (Fiche T-CF-001)',
        'Responsable cuisine / Chef de partie froid'
      );
      insertCCP.run(
        cuisson.id, 'CCP2',
        'Température à cœur ≥75°C pendant ≥2 minutes (70°C pendant ≥2 min pour volaille)',
        'Mesure à la sonde thermométrique au centre géométrique du produit en fin de cuisson',
        'À chaque cuisson — 100 % des lots',
        'Prolonger la cuisson jusqu\'à T° cible atteinte ; rejeter le lot si T° non atteignable après 2 corrections',
        'Calibration annuelle de la sonde ; audit procédure par responsable qualité trimestriel',
        'Fiche cuisson journalière (Fiche C-001) ; registre de calibration sonde',
        'Chef de cuisine / Cuisinier responsable'
      );
      insertCCP.run(
        refroid.id, 'CCP3',
        'Passage de 63°C à moins de 10°C en ≤2 heures (cellule de refroidissement rapide)',
        'Mesure sonde au cœur du produit au départ (≥63°C) et à l\'arrivée (<10°C) ; chronométrage de la durée',
        'À chaque refroidissement — 100 % des préparations chaudes destinées à la conservation',
        'Si délai >2h : destruction de la préparation et traçabilité ; si cellule défaillante : alerte maintenance immédiate et suspension de la production',
        'Contrôle de la cellule hebdomadaire (cycle test à vide) ; maintenance préventive semestrielle',
        'Fiche refroidissement rapide (Fiche RF-001) avec heures et températures',
        'Chef de cuisine / Commis responsable refroidissement'
      );
      console.log('✅ Seed: 3 CCP HACCP avec limites critiques insérés (CCP1/2/3)');
    }
  }
} catch (e) {
  console.error('Seed haccp CCPs error:', e.message);
}

// ─── Seed: HACCP Arbre de décision — résultats Codex Alimentarius pour les 11 dangers ───
try {
  const existingDT = get("SELECT COUNT(*) as count FROM haccp_decision_tree_results");
  if (existingDT && existingDT.count === 0) {
    const hazards = all("SELECT id, step_name, hazard_type, is_ccp FROM haccp_hazard_analysis ORDER BY id");
    if (hazards && hazards.length > 0) {
      const insertDT = db.prepare(`
        INSERT INTO haccp_decision_tree_results
          (hazard_analysis_id, q1_preventive_measure, q2_step_designed_eliminate, q3_contamination_possible, q4_subsequent_step_eliminate, result)
        VALUES (?, ?, ?, ?, ?, ?)`);

      // Arbre de décision Codex Alimentarius : Q1 mesure préventive ? Q2 étape conçue pour éliminer ?
      // Q3 contamination possible ? Q4 étape ultérieure élimine ?
      // Logique : !Q1→PRP | Q2→CCP | !Q3→PRP | Q4→PRPO | sinon→CCP
      const dtRules = {
        // Réception / Biologique / Salmonella → PRPO (cuisson éliminera)
        'Réception-B':   { q1:1, q2:0, q3:1, q4:1, result:'PRPO' },
        // Réception / Chimique / Pesticides → PRP (pas de contamination significative si fournisseur certifié)
        'Réception-C':   { q1:1, q2:0, q3:0, q4:0, result:'PRP'  },
        // Réception / Physique / Corps étrangers → PRPO (inspection possible en préparation)
        'Réception-P':   { q1:1, q2:0, q3:1, q4:1, result:'PRPO' },
        // Stockage / Biologique / Listeria → CCP (maîtrise T° essentielle, pas d'étape ultérieure d'élimination)
        'Stockage-B':    { q1:1, q2:1, q3:1, q4:0, result:'CCP'  },
        // Stockage / Chimique / Allergènes → PRP (séparation physique, pas de contamination si protocole suivi)
        'Stockage-C':    { q1:1, q2:0, q3:0, q4:0, result:'PRP'  },
        // Préparation / Biologique / Contamination croisée → PRPO (cuisson éliminera les pathogènes)
        'Préparation-B': { q1:1, q2:0, q3:1, q4:1, result:'PRPO' },
        // Préparation / Physique / Corps étrangers → PRP (BPH suffisantes, risque faible)
        'Préparation-P': { q1:1, q2:0, q3:0, q4:0, result:'PRP'  },
        // Cuisson / Biologique / Salmonella → CCP (étape conçue pour éliminer les pathogènes)
        'Cuisson-B':     { q1:1, q2:1, q3:1, q4:0, result:'CCP'  },
        // Refroidissement / Biologique / Clostridium → CCP (maîtrise vitesse refroidissement critique)
        'Refroidissement-B': { q1:1, q2:1, q3:1, q4:0, result:'CCP' },
        // Service / Biologique / Personnel → PRP (BPH et hygiène du personnel suffisantes)
        'Service-B':     { q1:1, q2:0, q3:0, q4:0, result:'PRP'  },
        // Service / Chimique / Allergènes INCO → PRP (information consommateur, pas d'élimination physique)
        'Service-C':     { q1:1, q2:0, q3:0, q4:0, result:'PRP'  },
      };

      for (const h of hazards) {
        const key = `${h.step_name}-${h.hazard_type}`;
        const rule = dtRules[key];
        if (rule) {
          insertDT.run(h.id, rule.q1, rule.q2, rule.q3, rule.q4, rule.result);
        }
      }
      console.log(`✅ Seed: ${hazards.length} résultats arbre de décision HACCP insérés`);
    }
  }
} catch (e) {
  console.error('Seed haccp decision tree error:', e.message);
}

// ─── Migration: Recall Procedures (retrait/rappel produits) ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recall_procedures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      lot_number TEXT,
      reason TEXT NOT NULL DEFAULT 'sanitaire',
      alert_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      alert_source TEXT NOT NULL DEFAULT 'interne',
      severity TEXT NOT NULL DEFAULT 'majeur',
      status TEXT NOT NULL DEFAULT 'alerte',
      actions_taken TEXT,
      quantity_affected REAL,
      quantity_unit TEXT DEFAULT 'kg',
      supplier_id INTEGER REFERENCES suppliers(id),
      notification_sent INTEGER DEFAULT 0,
      closure_date DATETIME,
      closure_notes TEXT,
      created_by INTEGER REFERENCES accounts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_recall_status ON recall_procedures(status);
    CREATE INDEX IF NOT EXISTS idx_recall_alert_date ON recall_procedures(alert_date);
  `);
  console.log('✅ Migration: recall_procedures table ready');
} catch (e) {
  // Table may already exist
}

// ─── Seed: Recall examples ───
try {
  const recallCount = get("SELECT COUNT(*) as c FROM recall_procedures");
  if (recallCount && recallCount.c === 0) {
    db.prepare(`
      INSERT INTO recall_procedures (product_name, lot_number, reason, alert_date, alert_source, severity, status, actions_taken, quantity_affected, quantity_unit, notification_sent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Fromage blanc entier bio', 'FB-2026-0312', 'sanitaire',
      new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      'DGAL', 'critique', 'cloturé',
      'Lots retirés des frigos, fournisseur contacté, DDPP notifiée, destruction documentée',
      12.5, 'kg', 1
    );
    db.prepare(`
      INSERT INTO recall_procedures (product_name, lot_number, reason, alert_date, alert_source, severity, status, actions_taken, quantity_affected, quantity_unit, notification_sent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Sauce pesto basilic', 'PST-2026-B02', 'etiquetage',
      new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      'fournisseur', 'majeur', 'en_cours',
      'Lots identifiés en stock, mise en quarantaine effectuée',
      4, 'unités', 0
    );
    console.log('✅ Seed: 2 procédures de rappel insérées');
  }
} catch (e) {
  console.error('Seed recall error:', e.message);
}

// ─── Migration: BPH — Formation du personnel ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      training_topic TEXT NOT NULL,
      trainer TEXT,
      training_date DATE NOT NULL,
      next_renewal_date DATE,
      duration_hours REAL,
      certificate_ref TEXT,
      status TEXT NOT NULL DEFAULT 'planifié',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_training_employee ON training_records(employee_name);
    CREATE INDEX IF NOT EXISTS idx_training_date ON training_records(training_date);
    CREATE INDEX IF NOT EXISTS idx_training_renewal ON training_records(next_renewal_date);
  `);
  console.log('✅ Migration: training_records table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration training error:', e.message);
}

// ─── Seed: Formations types ───
try {
  const trainingCount = get("SELECT COUNT(*) as c FROM training_records");
  if (trainingCount && trainingCount.c === 0) {
    const today = new Date();
    const fmtDate = (d) => d.toISOString().slice(0, 10);
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmtDate(d); };
    const daysLater = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmtDate(d); };
    const insertTraining = db.prepare(
      `INSERT INTO training_records (employee_name, training_topic, trainer, training_date, next_renewal_date, duration_hours, certificate_ref, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertTraining.run('Marie Dupont', 'Hygiène alimentaire HACCP', 'AFPA Formation', daysAgo(180), daysLater(185), 14, 'HACCP-2025-001', 'réalisé', 'Formation initiale réglementaire');
    insertTraining.run('Jean Martin', 'Allergènes alimentaires INCO', 'CFOR', daysAgo(90), daysLater(275), 7, 'ALLERG-2025-042', 'réalisé', 'Réglementation EU 1169/2011');
    insertTraining.run('Sophie Leblanc', 'Nettoyage et désinfection', 'Chef de cuisine', daysAgo(30), daysLater(335), 3.5, null, 'réalisé', null);
    insertTraining.run('Paul Bernard', 'Gestes de premiers secours SST', 'Croix Rouge', daysAgo(400), daysLater(-35), 14, 'SST-2024-A18', 'expiré', 'Renouvellement à planifier');
    insertTraining.run('Marie Dupont', 'Hygiène alimentaire HACCP — Recyclage', 'AFPA Formation', daysLater(15), daysLater(380), 7, null, 'planifié', 'Recyclage annuel obligatoire');
    console.log('✅ Seed: 5 formations types insérées');
  }
} catch (e) {
  console.error('Seed training error:', e.message);
}

// ─── Migration: BPH — Lutte contre les nuisibles ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pest_control (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT,
      contract_ref TEXT,
      visit_date DATE NOT NULL,
      next_visit_date DATE,
      findings TEXT,
      actions_taken TEXT,
      bait_stations_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'conforme',
      report_ref TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pest_control_visit_date ON pest_control(visit_date);
    CREATE INDEX IF NOT EXISTS idx_pest_control_status ON pest_control(status);
  `);
  console.log('✅ Migration: pest_control table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration pest_control error:', e.message);
}

// ─── Seed: Visites nuisibles ───
try {
  const pestCount = get("SELECT COUNT(*) as c FROM pest_control");
  if (pestCount && pestCount.c === 0) {
    const today = new Date();
    const fmtDate = (d) => d.toISOString().slice(0, 10);
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmtDate(d); };
    const daysLater = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmtDate(d); };
    const insertPest = db.prepare(
      `INSERT INTO pest_control (provider_name, contract_ref, visit_date, next_visit_date, findings, actions_taken, bait_stations_count, status, report_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertPest.run('Anticimex Pro', 'ANTI-2026-0042', daysAgo(90), daysLater(2), 'RAS — aucune trace d\'infestation', 'Vérification et renouvellement des appâts', 8, 'conforme', 'RPT-2026-Q1');
    insertPest.run('Anticimex Pro', 'ANTI-2026-0042', daysAgo(180), daysLater(-90), 'Traces d\'excréments rongeurs en réserve sèche', 'Pose de pièges supplémentaires, colmatage interstices mur', 12, 'action-requise', 'RPT-2025-Q4');
    insertPest.run('Anticimex Pro', 'ANTI-2026-0042', daysAgo(270), daysLater(-180), 'RAS', 'Contrôle des appâts, rapport de conformité', 8, 'conforme', 'RPT-2025-Q3');
    console.log('✅ Seed: 3 visites nuisibles insérées');
  }
} catch (e) {
  console.error('Seed pest_control error:', e.message);
}

// ─── Migration: BPH — Maintenance des équipements ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_name TEXT NOT NULL,
      equipment_type TEXT NOT NULL DEFAULT 'autre',
      location TEXT,
      last_maintenance_date DATE,
      next_maintenance_date DATE,
      maintenance_type TEXT DEFAULT 'préventive',
      provider TEXT,
      cost REAL,
      status TEXT NOT NULL DEFAULT 'planifié',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment_maintenance(equipment_type);
    CREATE INDEX IF NOT EXISTS idx_equipment_next_date ON equipment_maintenance(next_maintenance_date);
    CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment_maintenance(status);
  `);
  console.log('✅ Migration: equipment_maintenance table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration equipment_maintenance error:', e.message);
}

// ─── Seed: Équipements types ───
try {
  const equipCount = get("SELECT COUNT(*) as c FROM equipment_maintenance");
  if (equipCount && equipCount.c === 0) {
    const today = new Date();
    const fmtDate = (d) => d.toISOString().slice(0, 10);
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmtDate(d); };
    const daysLater = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmtDate(d); };
    const insertEquip = db.prepare(
      `INSERT INTO equipment_maintenance (equipment_name, equipment_type, location, last_maintenance_date, next_maintenance_date, maintenance_type, provider, cost, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertEquip.run('Chambre froide positive', 'froid', 'Cuisine', daysAgo(60), daysLater(120), 'préventive', 'FrigoTech SARL', 280, 'à_jour', 'Entretien annuel compresseur et joints');
    insertEquip.run('Congélateur armoire', 'froid', 'Réserve', daysAgo(45), daysLater(135), 'préventive', 'FrigoTech SARL', 150, 'à_jour', null);
    insertEquip.run('Four mixte Rational', 'cuisson', 'Cuisine', daysAgo(30), daysLater(60), 'préventive', 'Rational Service', 450, 'à_jour', 'Nettoyage programme + vérification sondes');
    insertEquip.run('Hotte aspirante', 'ventilation', 'Cuisine', daysAgo(120), daysLater(-30), 'préventive', 'AirClean Pro', 320, 'en_retard', 'Nettoyage filtres en retard');
    insertEquip.run('Lave-vaisselle tunnel', 'lavage', 'Plonge', daysAgo(10), daysLater(80), 'préventive', 'Electrolux Service', 180, 'à_jour', 'Vérification températures lavage et rinçage');
    insertEquip.run('Vitrine réfrigérée', 'froid', 'Salle', daysAgo(200), daysLater(10), 'préventive', 'FrigoTech SARL', 200, 'planifié', 'Contrôle étanchéité porte et thermostat');
    console.log('✅ Seed: 6 équipements insérés');
  }
} catch (e) {
  console.error('Seed equipment_maintenance error:', e.message);
}

// ─── Migration: BPH — Gestion des déchets ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS waste_management (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waste_type TEXT NOT NULL,
      collection_provider TEXT,
      collection_frequency TEXT DEFAULT 'hebdomadaire',
      last_collection_date DATE,
      next_collection_date DATE,
      contract_ref TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_waste_type ON waste_management(waste_type);
    CREATE INDEX IF NOT EXISTS idx_waste_next_collection ON waste_management(next_collection_date);
  `);
  console.log('✅ Migration: waste_management table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration waste_management error:', e.message);
}

// ─── Seed: Filières déchets ───
try {
  const wasteCount = get("SELECT COUNT(*) as c FROM waste_management");
  if (wasteCount && wasteCount.c === 0) {
    const today = new Date();
    const fmtDate = (d) => d.toISOString().slice(0, 10);
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmtDate(d); };
    const daysLater = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmtDate(d); };
    const insertWaste = db.prepare(
      `INSERT INTO waste_management (waste_type, collection_provider, collection_frequency, last_collection_date, next_collection_date, contract_ref, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insertWaste.run('alimentaire', 'Paprec Group', 'hebdomadaire', daysAgo(3), daysLater(4), 'PAP-2026-R142', 'Bac vert 240L — déchets organiques');
    insertWaste.run('emballage', 'Veolia', 'hebdomadaire', daysAgo(2), daysLater(5), 'VEO-2026-C088', 'Carton, plastique, métal');
    insertWaste.run('huile', 'Sevia SAS', 'mensuelle', daysAgo(15), daysLater(15), 'SEV-2026-H22', 'Huile de friture usagée — contrat BSDA obligatoire');
    insertWaste.run('verre', 'Veolia', 'bimestrielle', daysAgo(30), daysLater(30), 'VEO-2026-V019', 'Bouteilles et bocaux');
    insertWaste.run('autre', 'Castorama Pro', 'mensuelle', daysAgo(20), daysLater(10), null, 'Piles, néons, DEEE');
    console.log('✅ Seed: 5 filières déchets insérées');
  }
} catch (e) {
  console.error('Seed waste_management error:', e.message);
}

// ─── Migration: Add zones + skills + hire_date to accounts ───
try {
  const accColsFull = all("PRAGMA table_info(accounts)");
  if (!accColsFull.some(c => c.name === 'zones')) {
    db.exec("ALTER TABLE accounts ADD COLUMN zones TEXT DEFAULT '[]'");
    console.log('✅ Migration: added zones to accounts');
  }
  if (!accColsFull.some(c => c.name === 'skills')) {
    db.exec("ALTER TABLE accounts ADD COLUMN skills TEXT DEFAULT '[]'");
    console.log('✅ Migration: added skills to accounts');
  }
  if (!accColsFull.some(c => c.name === 'hire_date')) {
    db.exec("ALTER TABLE accounts ADD COLUMN hire_date DATE");
    console.log('✅ Migration: added hire_date to accounts');
  }
  if (!accColsFull.some(c => c.name === 'training_notes')) {
    db.exec("ALTER TABLE accounts ADD COLUMN training_notes TEXT DEFAULT ''");
    console.log('✅ Migration: added training_notes to accounts');
  }
  // EVAL_ULTIMATE: per-account PIN lockout (global IP-based limiter is
  // trivially parallelised across a botnet; 4-digit PIN keyspace = 10⁴).
  if (!accColsFull.some(c => c.name === 'failed_pin_attempts')) {
    db.exec("ALTER TABLE accounts ADD COLUMN failed_pin_attempts INTEGER DEFAULT 0");
    console.log('✅ Migration: added failed_pin_attempts to accounts');
  }
  if (!accColsFull.some(c => c.name === 'pin_locked_until')) {
    db.exec("ALTER TABLE accounts ADD COLUMN pin_locked_until DATETIME");
    console.log('✅ Migration: added pin_locked_until to accounts');
  }
} catch (e) {
  console.error('Migration accounts zones/skills error:', e.message);
}

// ─── Migration: Add plan to restaurants ───
try {
  const restPlanCols = all("PRAGMA table_info(restaurants)");
  if (!restPlanCols.some(c => c.name === 'plan')) {
    db.exec("ALTER TABLE restaurants ADD COLUMN plan TEXT DEFAULT 'discovery'");
    console.log('✅ Migration: added plan to restaurants');
  }
} catch (e) {
  console.error('Migration restaurants.plan error:', e.message);
}

// ─── Migration: Actions correctives ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS corrective_actions_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      trigger_condition TEXT,
      action_description TEXT,
      responsible_role TEXT,
      deadline_hours INTEGER,
      escalation_procedure TEXT,
      documentation_required TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cat_templates ON corrective_actions_templates(category);
    CREATE INDEX IF NOT EXISTS idx_cat_templates_active ON corrective_actions_templates(is_active);

    CREATE TABLE IF NOT EXISTS corrective_actions_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES corrective_actions_templates(id),
      category TEXT,
      trigger_description TEXT,
      action_taken TEXT,
      responsible_person TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      status TEXT DEFAULT 'en_cours',
      notes TEXT,
      related_record_id INTEGER,
      related_record_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cal_status ON corrective_actions_log(status);
    CREATE INDEX IF NOT EXISTS idx_cal_category ON corrective_actions_log(category);
    CREATE INDEX IF NOT EXISTS idx_cal_created ON corrective_actions_log(created_at);
  `);
  console.log('✅ Migration: corrective_actions tables ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration corrective_actions error:', e.message);
}

// ─── Seed: Actions correctives templates ───
try {
  const catCount = get("SELECT COUNT(*) as c FROM corrective_actions_templates");
  if (catCount && catCount.c === 0) {
    const insertTpl = db.prepare(`
      INSERT INTO corrective_actions_templates
        (category, trigger_condition, action_description, responsible_role, deadline_hours, escalation_procedure, documentation_required)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertTpl.run('temperature', 'Température chambre froide > 4°C', 'Vérifier la sonde, transférer les denrées dans une autre enceinte froide, appeler le technicien si anomalie persistante > 1h', 'cuisinier', 1, 'Contacter le responsable de site si température > 8°C ou si durée > 2h', "Relevé de température, bon d'intervention technicien");
    insertTpl.run('temperature', 'Température plat chaud < 63°C au service', 'Remettre le plat en température à > 63°C dans les 30 minutes. Si impossible, jeter et renouveler la préparation', 'cuisinier', 1, 'Alerter le responsable si la non-conformité est récurrente', 'Fiche de relevé température, fiche de non-conformité');
    insertTpl.run('reception', 'Température réception viande > 4°C', 'Refuser la livraison, noter la non-conformité sur le bon de livraison, contacter le fournisseur immédiatement', 'cuisinier', 0, 'Notifier le responsable achats et enregistrer dans le registre fournisseurs', 'Bon de livraison annoté, fiche de non-conformité fournisseur');
    insertTpl.run('cleaning', 'Nettoyage non-conforme (contrôle visuel ou ATP)', 'Refaire le nettoyage et la désinfection, réaliser un contrôle visuel, re-valider sur le plan de nettoyage', 'cuisinier', 2, 'Si récidive, revoir le protocole avec le responsable HACCP', 'Plan de nettoyage, fiche de validation nettoyage');
    insertTpl.run('storage', 'Présence de nuisible constatée', 'Isoler la zone concernée, contacter le prestataire de lutte contre les nuisibles sous 24h, renforcer les contrôles visuels', 'gerant', 24, 'Alerter immédiatement le responsable et documenter les preuves (photos)', 'Fiche de signalement nuisible, rapport prestataire');
    insertTpl.run('reception', 'Réception non-conforme — DLC dépassée', "Refuser l'intégralité du lot, notifier le fournisseur par écrit, enregistrer la non-conformité dans le registre", 'cuisinier', 0, 'Informer le responsable achats pour suivi fournisseur', 'Bon de livraison, fiche de non-conformité, courrier fournisseur');
    insertTpl.run('reception', 'Réception non-conforme — emballage détérioré', 'Refuser le lot concerné, vérifier les autres colis, notifier le fournisseur', 'cuisinier', 0, 'Consigner dans le registre de réception', 'Bon de livraison annoté, photos si possible, fiche NC');
    insertTpl.run('storage', 'Denrée sans étiquetage ou traçabilité manquante', 'Identifier le produit par recoupement. Apposer une étiquette provisoire ou jeter si non identifiable', 'cuisinier', 4, 'Signaler au responsable si le produit non traçable a déjà été utilisé', 'Fiche de traçabilité, étiquette provisoire');
    insertTpl.run('temperature', 'Rupture de la chaîne du froid (denrée hors froid)', 'Évaluer la durée et la température atteinte. Jeter si > 2h hors froid ou si température > 8°C', 'cuisinier', 0, 'Alerter le responsable si la rupture est due à une panne équipement', 'Fiche de non-conformité, enregistrement température');
    insertTpl.run('preparation', 'Contamination croisée suspectée', 'Isoler les denrées potentiellement contaminées, nettoyer et désinfecter les surfaces et ustensiles, alerter le responsable', 'cuisinier', 1, 'Si consommation déjà effectuée, alerter le responsable pour évaluer le risque sanitaire', 'Fiche de non-conformité, liste des denrées concernées');
    insertTpl.run('service', 'Allergène non déclaré identifié dans un plat servi', "Retirer immédiatement le plat du service, alerter l'équipe en salle, informer les clients concernés", 'gerant', 0, 'Contacter le service sanitaire si un client a consommé le produit et présente des symptômes', "Fiche de non-conformité, liste clients informés, rapport d'incident");
    insertTpl.run('preparation', 'Huile de friture dégradée (TPC > 25%)', 'Arrêter immédiatement, vidanger et remplacer l\'huile, ne pas servir les produits frits en attente', 'cuisinier', 0, 'Si la mesure TPC n\'est pas réalisée quotidiennement, revoir la procédure', 'Test TPC enregistré, bon de vidange huile');
    insertTpl.run('service', 'Plat non servi dans les temps (> 2h à température ambiante)', 'Jeter les denrées non servies dans le délai réglementaire, renouveler la préparation', 'cuisinier', 0, 'Analyser la cause et mettre en place des mesures préventives', 'Fiche de perte, fiche de non-conformité');
    insertTpl.run('cleaning', 'Désinfectant hors concentration requise', 'Préparer une nouvelle solution à la concentration correcte, re-désinfecter toutes les surfaces traitées', 'cuisinier', 1, 'Vérifier et renouveler le stock de produits désinfectants', 'Fiche de préparation désinfectant, plan de nettoyage');
    insertTpl.run('temperature', 'Relevé de température manquant (oubli de saisie)', "Retrouver l'information par tout moyen disponible ou reconstituer avec mention 'reconstitué'. Renforcer les contrôles", 'cuisinier', 4, 'Si manquant > 3 fois par mois, mettre en place un système d\'alerte automatique', 'Fiche de relevé complétée, action préventive documentée');
    console.log("✅ Seed: 15 modèles d'actions correctives insérés");
  }
} catch (e) {
  console.error('Seed corrective_actions_templates error:', e.message);
}

// ─── Migration: Traçabilité aval ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS downstream_traceability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      batch_number TEXT,
      production_date TEXT,
      destination_type TEXT CHECK(destination_type IN ('salle','livraison','traiteur','autre')),
      destination_name TEXT,
      quantity REAL,
      unit TEXT DEFAULT 'kg',
      dispatch_date TEXT,
      dispatch_time TEXT,
      temperature_at_dispatch REAL,
      responsible_person TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_dt_dispatch_date ON downstream_traceability(dispatch_date);
    CREATE INDEX IF NOT EXISTS idx_dt_batch_number ON downstream_traceability(batch_number);
    CREATE INDEX IF NOT EXISTS idx_dt_product_name ON downstream_traceability(product_name);
  `);
  console.log('✅ Migration: downstream_traceability table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration downstream_traceability error:', e.message);
}

// ─── Seed: Traçabilité aval ───
try {
  const dtCount = get("SELECT COUNT(*) as c FROM downstream_traceability");
  if (dtCount && dtCount.c === 0) {
    const insertDT = db.prepare(`
      INSERT INTO downstream_traceability
        (product_name, batch_number, production_date, destination_type, destination_name, quantity, unit, dispatch_date, dispatch_time, temperature_at_dispatch, responsible_person, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDT.run('Blanquette de veau', 'BV-2026-04-13-001', '2026-04-13', 'salle', 'Salle principale', 8.5, 'kg', '2026-04-13', '11:45', 63.2, 'Marie Dupont', 'Service déjeuner — plat du jour');
    insertDT.run('Tarte aux pommes', 'TAP-2026-04-12-003', '2026-04-12', 'livraison', 'Livraison bureau Michelin', 2.4, 'kg', '2026-04-12', '09:30', 6.1, 'Thomas Bernard', 'Commande spéciale — 8 portions');
    insertDT.run('Saumon gravlax', 'SG-2026-04-11-002', '2026-04-10', 'traiteur', 'Événement Mairie de Paris', 5.0, 'kg', '2026-04-11', '14:00', 4.8, 'Sophie Martin', 'Prestation traiteur 50 couverts — lot vérifié OK');
    insertDT.run('Fond de veau brun', 'FV-2026-04-10-001', '2026-04-09', 'salle', 'Cuisine chaude', 3.0, 'L', '2026-04-10', '10:15', 65.0, 'Lucas Girard', 'Base sauce — sortie stock journalier');
    insertDT.run('Mousse au chocolat', 'MC-2026-04-09-004', '2026-04-09', 'autre', 'Livraison hôpital Lariboisière', 1.8, 'kg', '2026-04-09', '08:00', 5.2, 'Marie Dupont', 'Commande institutionnelle hebdomadaire');
    console.log("✅ Seed: 5 entrées traçabilité aval insérées");
  }
} catch (e) {
  console.error('Seed downstream_traceability error:', e.message);
}

// ─── Migration: Plan de gestion des allergènes ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS allergen_management_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      allergen_code TEXT NOT NULL UNIQUE,
      allergen_name TEXT NOT NULL,
      risk_level TEXT CHECK(risk_level IN ('élevé','moyen','faible')) DEFAULT 'moyen',
      presence_in_menu INTEGER DEFAULT 0,
      cross_contamination_risk TEXT,
      preventive_measures TEXT,
      cleaning_procedure TEXT,
      staff_training_ref TEXT,
      display_method TEXT,
      last_review_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Migration: allergen_management_plan table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration allergen_management_plan error:', e.message);
}

// ─── Seed: Plan de gestion des allergènes ───
try {
  const ampCount = get("SELECT COUNT(*) as c FROM allergen_management_plan");
  if (ampCount && ampCount.c === 0) {
    const insertAMP = db.prepare(`
      INSERT INTO allergen_management_plan
        (allergen_code, allergen_name, risk_level, presence_in_menu, cross_contamination_risk, preventive_measures, cleaning_procedure, staff_training_ref, display_method, last_review_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAMP.run('gluten', 'Gluten (blé, seigle, orge, avoine)', 'élevé', 1, 'Élevé — farine en suspension dans l\'air, ustensiles partagés', 'Utiliser des ustensiles dédiés sans gluten. Préparer les plats sans gluten avant les préparations ordinaires. Zone de préparation séparée si possible.', 'Nettoyage et désinfection complète des surfaces après préparation. Rinçage soigneux des ustensiles. Changer de tablier avant les préparations.', 'Formation HACCP allergènes — Module 3', 'Carte + ardoise + mention orale au service', '2026-04-01');
    insertAMP.run('crustaces', 'Crustacés (crevettes, crabes, homard)', 'élevé', 1, 'Moyen — vapeurs de cuisson, eau de rinçage', 'Stocker les crustacés dans des bacs hermétiques séparés. Cuire dans une casserole dédiée. Rincer la planche à découper à l\'eau chaude savonneuse.', 'Nettoyage des surfaces avec désinfectant après manipulation. Laver les ustensiles à 60°C minimum.', 'Formation HACCP allergènes — Module 3', 'Carte + mention orale sur demande', '2026-04-01');
    insertAMP.run('oeufs', 'Œufs et ovoproduits', 'élevé', 1, 'Élevé — présents dans de nombreuses préparations (mayonnaise, pâtisseries)', 'Identifier clairement les préparations contenant des œufs. Utiliser des équipements séparés pour les mayonnaises et sauces. Ne pas réutiliser les coquilles.', 'Nettoyage standard des surfaces. Attention particulière aux mélanges et émulsions.', 'Formation HACCP allergènes — Module 3', 'Carte + fiche technique sur demande', '2026-04-01');
    insertAMP.run('poissons', 'Poissons et produits dérivés', 'élevé', 1, 'Moyen — jus de cuisson, fumage, vapeurs', 'Stocker les poissons séparément des autres denrées. Utiliser des planches à découper dédiées (code couleur). Éviter les sauces communes.', 'Nettoyage à l\'eau chaude + désinfectant après découpe. Renouveler l\'huile de cuisson après poisson.', 'Formation HACCP allergènes — Module 3', 'Carte + ardoise', '2026-04-01');
    insertAMP.run('arachides', 'Arachides (cacahuètes)', 'élevé', 1, 'Élevé — huile d\'arachide, sauces asiatiques, traces dans huiles', 'Proscrire l\'huile d\'arachide en cuisine. Vérifier la composition de toutes les sauces. Former le personnel aux risques de choc anaphylactique.', 'Nettoyage complet des surfaces et ustensiles après utilisation. Ne jamais réutiliser les huiles ayant cuit des arachides.', 'Formation HACCP allergènes — Module 3 + Formation choc anaphylactique', 'Mention explicite sur la carte + oral systématique au service', '2026-04-01');
    insertAMP.run('soja', 'Soja et dérivés', 'moyen', 1, 'Moyen — sauces, marinades, tofu', 'Vérifier la composition des sauces de soja et substituts. Étiqueter clairement les plats contenant du tofu ou des produits à base de soja.', 'Nettoyage standard des équipements de cuisson.', 'Formation HACCP allergènes — Module 3', 'Carte + fiche technique sur demande', '2026-04-01');
    insertAMP.run('lait', 'Lait et produits laitiers (lactose)', 'élevé', 1, 'Élevé — beurre, crème, fromages présents dans de nombreux plats', 'Identifier tous les plats contenant du lait ou dérivés. Proposer des alternatives (lait végétal, margarine) sur demande. Séparer les préparations.', 'Nettoyage soigneux des ustensiles et récipients. Éviter les contaminations croisées avec les mêmes louches.', 'Formation HACCP allergènes — Module 3', 'Carte + ardoise + mention orale', '2026-04-01');
    insertAMP.run('fruits_coque', 'Fruits à coque (amandes, noisettes, noix, cajou...)', 'élevé', 1, 'Élevé — huiles, pâtes, poudres en suspension', 'Stocker dans des contenants hermétiques. Utiliser des planches et couteaux dédiés. Éviter les préparations au même poste.', 'Nettoyage approfondi après utilisation. Aspirer les poussières et éclats.', 'Formation HACCP allergènes — Module 3 + Formation choc anaphylactique', 'Mention explicite sur la carte', '2026-04-01');
    insertAMP.run('celeri', 'Céleri (branches, graines, feuilles)', 'faible', 0, 'Faible — utilisé ponctuellement en garniture', 'Étiqueter les bouquets garnis contenant du céleri. Signaler dans les fonds et bouillons.', 'Nettoyage standard.', 'Formation HACCP allergènes — Module 3', 'Mention sur demande', '2026-04-01');
    insertAMP.run('moutarde', 'Moutarde et graines de moutarde', 'moyen', 1, 'Moyen — vinaigrettes, sauces, marinades', 'Identifier tous les plats avec moutarde (sauces, vinaigres). Ne pas utiliser les mêmes contenants. Proposer des alternatives sans moutarde.', 'Nettoyage des récipients à vinaigrette. Attention aux sauces du commerce.', 'Formation HACCP allergènes — Module 3', 'Carte + mention orale', '2026-04-01');
    insertAMP.run('sesame', 'Sésame (graines, huile, tahini)', 'moyen', 1, 'Moyen — pains, houmous, huile de sésame', 'Vérifier la composition des pains achetés. Signaler l\'huile de sésame dans les assaisonnements. Séparer les préparations avec tahini.', 'Nettoyage des surfaces après utilisation. Éviter les mélanges d\'huiles.', 'Formation HACCP allergènes — Module 3', 'Carte + mention sur demande', '2026-04-01');
    insertAMP.run('sulfites', 'Sulfites et anhydride sulfureux (>10mg/kg)', 'faible', 1, 'Faible — vins, charcuteries, conserves', 'Informer les clients lors du service de vin ou charcuteries. Vérifier les teneurs dans les produits du commerce.', 'Aucune procédure spécifique — risque minimal en cuisine.', 'Formation HACCP allergènes — Module 3', 'Mention sur la carte des vins + oral', '2026-04-01');
    insertAMP.run('lupin', 'Lupin (farine, graines)', 'faible', 0, 'Faible — peut remplacer la farine de blé dans certains produits', 'Vérifier les étiquettes des farines et pains du commerce. Ne pas substituer sans vérification.', 'Nettoyage standard si utilisation.', 'Formation HACCP allergènes — Module 3', 'Mention sur demande', '2026-04-01');
    insertAMP.run('mollusques', 'Mollusques (moules, huîtres, escargots, poulpe)', 'moyen', 1, 'Moyen — vapeurs de cuisson, eau de cuisson, jus', 'Cuire séparément des autres poissons. Utiliser des casseroles dédiées. Prévenir les clients systématiquement lors du service.', 'Nettoyage à l\'eau chaude + désinfectant après cuisson. Éliminer les eaux de cuisson.', 'Formation HACCP allergènes — Module 3', 'Carte + ardoise + mention orale', '2026-04-01');
    console.log("✅ Seed: 14 allergènes INCO insérés dans allergen_management_plan");
  }
} catch (e) {
  console.error('Seed allergen_management_plan error:', e.message);
}

// ─── Migration: Gestion de l'eau ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS water_management (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_date TEXT NOT NULL,
      analysis_type TEXT CHECK(analysis_type IN ('microbiologique','physico-chimique','complète')) DEFAULT 'complète',
      provider TEXT,
      results TEXT,
      conformity INTEGER DEFAULT 1,
      next_analysis_date TEXT,
      report_ref TEXT,
      water_source TEXT CHECK(water_source IN ('réseau public','forage','autre')) DEFAULT 'réseau public',
      treatment TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wm_analysis_date ON water_management(analysis_date);
  `);
  console.log('✅ Migration: water_management table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration water_management error:', e.message);
}

// ─── Seed: Gestion de l'eau ───
try {
  const wmCount = get("SELECT COUNT(*) as c FROM water_management");
  if (wmCount && wmCount.c === 0) {
    const insertWM = db.prepare(`
      INSERT INTO water_management
        (analysis_date, analysis_type, provider, results, conformity, next_analysis_date, report_ref, water_source, treatment, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertWM.run('2026-01-15', 'complète', 'Laboratoire Eurofins Environnement', 'pH 7.4, Turbidité 0.3 NTU, Nitrates 12mg/L, Bactéries coliformes 0 UFC/100mL, Légionelles <10 UFC/L — Conforme aux normes en vigueur', 1, '2026-07-15', 'EUR-2026-0115-EAU', 'réseau public', 'Aucun traitement complémentaire — eau du réseau municipal', 'Analyse annuelle réglementaire. Résultats conformes.');
    insertWM.run('2025-07-10', 'microbiologique', 'Laboratoire Eurofins Environnement', 'Bactéries coliformes 0 UFC/100mL, E.coli 0 UFC/100mL, Entérocoques 0 UFC/100mL — Conforme', 1, '2026-01-15', 'EUR-2025-0710-EAU', 'réseau public', 'Aucun traitement', 'Analyse semestrielle. Conforme.');
    insertWM.run('2025-01-20', 'physico-chimique', 'Eurofins Environnement', 'pH 7.2, Chlore résiduel 0.12mg/L, Dureté 28°f, Nitrates 10mg/L — Conforme', 1, '2025-07-10', 'EUR-2025-0120-EAU', 'réseau public', 'Adoucisseur — réglage 20°f', 'Résultats conformes. Dureté légèrement élevée — adoucisseur en place.');
    console.log("✅ Seed: 3 analyses eau insérées");
  }
} catch (e) {
  console.error('Seed water_management error:', e.message);
}

// ─── Migration: Audits PMS ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pms_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_date TEXT NOT NULL,
      auditor_name TEXT NOT NULL,
      audit_type TEXT CHECK(audit_type IN ('interne','externe')) DEFAULT 'interne',
      scope TEXT CHECK(scope IN ('complet','partiel')) DEFAULT 'complet',
      findings TEXT,
      overall_score INTEGER CHECK(overall_score BETWEEN 0 AND 100),
      status TEXT CHECK(status IN ('planifié','réalisé','actions_en_cours','clôturé')) DEFAULT 'planifié',
      next_audit_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pa_audit_date ON pms_audits(audit_date);
    CREATE INDEX IF NOT EXISTS idx_pa_status ON pms_audits(status);
  `);
  console.log('✅ Migration: pms_audits table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration pms_audits error:', e.message);
}

// ─── Seed: Audits PMS ───
try {
  const paCount = get("SELECT COUNT(*) as c FROM pms_audits");
  if (paCount && paCount.c === 0) {
    const insertPA = db.prepare(`
      INSERT INTO pms_audits
        (audit_date, auditor_name, audit_type, scope, findings, overall_score, status, next_audit_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const findings = JSON.stringify([
      { section: 'Températures', finding: 'Relevés complets et conformes sur les 3 derniers mois', severity: 'conforme', action_required: null },
      { section: 'Nettoyage & Désinfection', finding: 'Plan de nettoyage respecté à 95%. 2 tâches quotidiennes non tracées semaine 12', severity: 'mineure', action_required: 'Rappel équipe + renforcement suivi semaine 13' },
      { section: 'Traçabilité', finding: 'DLC correctement renseignées. 1 étiquette illisible constatée en chambre froide', severity: 'mineure', action_required: 'Réétiqueter et former le personnel à la lisibilité des étiquettes' },
      { section: 'Gestion des allergènes', finding: 'Affichage carte conforme INCO. Formation personnel à jour', severity: 'conforme', action_required: null },
      { section: 'Lutte contre les nuisibles', finding: 'Contrat dératisation valide. Dernier passage conforme. Aucun signe d\'infestation', severity: 'conforme', action_required: null },
      { section: 'Formation du personnel', finding: 'Modules HACCP complétés à 80%. 2 nouveaux employés en attente de formation', severity: 'majeure', action_required: 'Planifier formation HACCP pour 2 employés avant fin de période d\'essai (J+30)' },
      { section: 'Maintenance des équipements', finding: 'Contrats de maintenance à jour. Sonde thermomètre n°2 à étalonner', severity: 'mineure', action_required: 'Étalonner sonde thermomètre n°2 — contact prestataire sous 15 jours' },
    ]);
    insertPA.run('2026-01-15', 'Marie Dupont — Responsable HACCP', 'interne', 'complet', findings, 82, 'clôturé', '2026-04-15', 'Audit trimestriel Q1 2026. Score 82/100. 1 non-conformité majeure résolue (formation personnel).');
    const findingsFuture = JSON.stringify([
      { section: 'Températures', finding: 'À vérifier', severity: 'en attente', action_required: null },
      { section: 'Nettoyage & Désinfection', finding: 'À vérifier', severity: 'en attente', action_required: null },
      { section: 'Traçabilité', finding: 'À vérifier', severity: 'en attente', action_required: null },
      { section: 'Gestion des allergènes', finding: 'À vérifier', severity: 'en attente', action_required: null },
      { section: 'Lutte contre les nuisibles', finding: 'À vérifier', severity: 'en attente', action_required: null },
    ]);
    insertPA.run('2026-04-15', 'Marie Dupont — Responsable HACCP', 'interne', 'complet', findingsFuture, null, 'planifié', '2026-07-15', 'Audit trimestriel Q2 2026 — planifié.');
    console.log("✅ Seed: 2 audits PMS insérés");
  }
} catch (e) {
  console.error('Seed pms_audits error:', e.message);
}

// ─── Migration: Paramètres sanitaires ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sanitary_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER REFERENCES restaurants(id),
      sanitary_approval_number TEXT,
      sanitary_approval_date TEXT,
      sanitary_approval_type TEXT CHECK(sanitary_approval_type IN ('agrément','dérogation','déclaration')) DEFAULT 'déclaration',
      activity_type TEXT CHECK(activity_type IN ('restaurant','traiteur','fabrication','entreposage')) DEFAULT 'restaurant',
      dd_pp_office TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Migration: sanitary_settings table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration sanitary_settings error:', e.message);
}

// ─── Migration: Protocoles nettoyage enrichis ───
try {
  const cleaningCols = all('PRAGMA table_info(cleaning_tasks)');
  const cleaningColNames = cleaningCols.map(c => c.name);
  if (!cleaningColNames.includes('concentration')) {
    db.exec("ALTER TABLE cleaning_tasks ADD COLUMN concentration TEXT");
    console.log('✅ Migration: cleaning_tasks.concentration ajouté');
  }
  if (!cleaningColNames.includes('temps_contact')) {
    db.exec("ALTER TABLE cleaning_tasks ADD COLUMN temps_contact TEXT");
    console.log('✅ Migration: cleaning_tasks.temps_contact ajouté');
  }
  if (!cleaningColNames.includes('temperature_eau')) {
    db.exec("ALTER TABLE cleaning_tasks ADD COLUMN temperature_eau TEXT");
    console.log('✅ Migration: cleaning_tasks.temperature_eau ajouté');
  }
  if (!cleaningColNames.includes('rincage')) {
    db.exec("ALTER TABLE cleaning_tasks ADD COLUMN rincage TEXT");
    console.log('✅ Migration: cleaning_tasks.rincage ajouté');
  }
  if (!cleaningColNames.includes('epi')) {
    db.exec("ALTER TABLE cleaning_tasks ADD COLUMN epi TEXT");
    console.log('✅ Migration: cleaning_tasks.epi ajouté');
  }

  // Enrichir les tâches de nettoyage existantes si elles n'ont pas encore de protocole
  const existingTasks = all('SELECT * FROM cleaning_tasks');
  const enrichedProtocols = {
    'Plans de travail': {
      concentration: '5ml/L',
      temps_contact: '5 minutes',
      temperature_eau: '40°C',
      rincage: 'Rinçage eau claire obligatoire',
      epi: 'Gants nitrile, tablier imperméable',
    },
    'Sols cuisine': {
      concentration: 'Dilution 1:20',
      temps_contact: '10 minutes',
      temperature_eau: '50°C',
      rincage: 'Rinçage eau claire après désinfection',
      epi: 'Gants de ménage, bottes antidérapantes',
    },
    'Frigos': {
      concentration: '10ml/L',
      temps_contact: '15 minutes',
      temperature_eau: '30°C (eau tiède)',
      rincage: 'Rinçage eau claire + séchage obligatoire',
      epi: 'Gants nitrile, lunettes de protection',
    },
    'Hotte et filtres': {
      concentration: 'Pur (dégraissant concentré)',
      temps_contact: '20 minutes (trempage)',
      temperature_eau: '60°C',
      rincage: 'Rinçage eau chaude sous pression',
      epi: 'Gants résistants aux produits chimiques, lunettes, tablier',
    },
    'Congélateur': {
      concentration: '10ml/L',
      temps_contact: '15 minutes',
      temperature_eau: 'Température ambiante',
      rincage: 'Rinçage eau claire + séchage complet avant remise en froid',
      epi: 'Gants nitrile, vêtements chauds',
    },
  };

  const updateProtocol = db.prepare(
    'UPDATE cleaning_tasks SET concentration = ?, temps_contact = ?, temperature_eau = ?, rincage = ?, epi = ? WHERE name = ? AND concentration IS NULL'
  );
  for (const [name, proto] of Object.entries(enrichedProtocols)) {
    updateProtocol.run(proto.concentration, proto.temps_contact, proto.temperature_eau, proto.rincage, proto.epi, name);
  }
  console.log('✅ Migration: protocoles nettoyage enrichis');
} catch (e) {
  console.error('Migration cleaning protocols error:', e.message);
}

// ─── Migration: Traçabilité réception enrichie ───
try {
  const traceCols = all('PRAGMA table_info(traceability_logs)');
  const traceColNames = traceCols.map(c => c.name);
  if (!traceColNames.includes('etat_emballage')) {
    db.exec("ALTER TABLE traceability_logs ADD COLUMN etat_emballage TEXT");
    console.log('✅ Migration: traceability_logs.etat_emballage ajouté');
  }
  if (!traceColNames.includes('conformite_organoleptique')) {
    db.exec("ALTER TABLE traceability_logs ADD COLUMN conformite_organoleptique TEXT");
    console.log('✅ Migration: traceability_logs.conformite_organoleptique ajouté');
  }
  if (!traceColNames.includes('numero_bl')) {
    db.exec("ALTER TABLE traceability_logs ADD COLUMN numero_bl TEXT");
    console.log('✅ Migration: traceability_logs.numero_bl ajouté');
  }
  if (!traceColNames.includes('ddm')) {
    db.exec("ALTER TABLE traceability_logs ADD COLUMN ddm DATE");
    console.log('✅ Migration: traceability_logs.ddm ajouté');
  }
  if (!traceColNames.includes('product_category')) {
    db.exec("ALTER TABLE traceability_logs ADD COLUMN product_category TEXT");
    console.log('✅ Migration: traceability_logs.product_category ajouté (CCP1 thresholds)');
  }
  console.log('✅ Migration: traçabilité réception enrichie');
} catch (e) {
  console.error('Migration traceability enrichie error:', e.message);
}

// ─── Migration: TIAC (Toxi-Infections Alimentaires Collectives) ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tiac_procedures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_incident DATE NOT NULL,
      description TEXT NOT NULL,
      nb_personnes INTEGER DEFAULT 0,
      symptomes TEXT,
      aliments_suspects TEXT,
      mesures_conservatoires TEXT,
      declaration_ars INTEGER DEFAULT 0,
      plats_temoins_conserves INTEGER DEFAULT 0,
      contact_ddpp TEXT,
      statut TEXT DEFAULT 'en_cours',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Migration: tiac_procedures table ready');

  const tiacCount = get('SELECT COUNT(*) as c FROM tiac_procedures');
  if (tiacCount && tiacCount.c === 0) {
    run(
      `INSERT INTO tiac_procedures
        (date_incident, description, nb_personnes, symptomes, aliments_suspects, mesures_conservatoires, declaration_ars, plats_temoins_conserves, contact_ddpp, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        '2026-03-15',
        'Signalement de 3 clients présentant des symptômes gastro-entérites après le service du midi. Repas identique : menu du jour (entrée salade César, plat poulet rôti-légumes, dessert tarte citron).',
        3,
        'Nausées, vomissements, diarrhées — apparition 4 à 6h après le repas',
        'Poulet rôti (cuisson insuffisante suspectée) — lot LOT-2026-0312',
        'Mise en quarantaine du stock de poulet concerné. Arrêt du service poulet. Nettoyage et désinfection complète de la cuisine. Convocation de l\'équipe.',
        1,
        1,
        'DDPP 75 — Tél : 01 40 07 22 00 — Réf. dossier : TIAC-2026-042',
        'clos',
      ]
    );
    console.log('✅ Seed: 1 procédure TIAC insérée');
  }
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration tiac_procedures error:', e.message);
}

// ─── Migration: Diagrammes de fabrication ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fabrication_diagrams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      description TEXT,
      etapes TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Migration: fabrication_diagrams table ready');

  const diagCount = get('SELECT COUNT(*) as c FROM fabrication_diagrams');
  if (diagCount && diagCount.c === 0) {
    const etapesServiceRestaurant = JSON.stringify([
      { ordre: 1, nom: 'Réception', description: 'Réception des marchandises — contrôle température, état emballage, DDM/DLC, n° lot', ccp: false, point_maitrise: 'Vérification T° : viandes <4°C, surgelés <-18°C' },
      { ordre: 2, nom: 'Stockage', description: 'Stockage en chambre froide positive ou négative selon nature du produit', ccp: false, point_maitrise: 'Respect de la chaîne du froid, FIFO, séparation cru/cuit' },
      { ordre: 3, nom: 'Préparation', description: 'Préparation et mise en place — découpe, assemblage, mise en portion', ccp: false, point_maitrise: 'Hygiène des mains, propreté du matériel, T° ambiante <18°C' },
      { ordre: 4, nom: 'Cuisson', description: 'Cuisson des aliments selon les procédures définies par type de produit', ccp: true, point_maitrise: 'CCP : T° à cœur ≥70°C pendant 2 min (volailles : 75°C)' },
      { ordre: 5, nom: 'Refroidissement', description: 'Refroidissement rapide si préparation à l\'avance (liaison froide)', ccp: true, point_maitrise: 'CCP : passage de +63°C à +10°C en moins de 2h' },
      { ordre: 6, nom: 'Remise en température', description: 'Remise en température des plats préparés à l\'avance (liaison froide)', ccp: true, point_maitrise: 'CCP : T° à cœur ≥63°C en moins d\'1h, service immédiat' },
      { ordre: 7, nom: 'Service', description: 'Dressage et envoi des assiettes en salle — temps d\'attente limité', ccp: false, point_maitrise: 'Plats chauds maintenus à ≥63°C, plats froids à ≤10°C' },
    ]);
    run(
      `INSERT INTO fabrication_diagrams (nom, description, etapes)
       VALUES (?, ?, ?)`,
      [
        'Service restaurant — liaison chaude',
        'Diagramme de fabrication pour le service en salle en liaison chaude. Couvre l\'ensemble du flux de production depuis la réception des matières premières jusqu\'au service client.',
        etapesServiceRestaurant,
      ]
    );
    console.log('✅ Seed: 1 diagramme de fabrication inséré');
  }
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration fabrication_diagrams error:', e.message);
}

// ─── Santé du personnel ───────────────────────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_health_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      restaurant_id INTEGER,
      staff_name TEXT NOT NULL,
      record_type TEXT CHECK(record_type IN ('aptitude','visite_medicale','maladie','blessure','formation_hygiene')) NOT NULL,
      date_record TEXT NOT NULL,
      date_expiry TEXT,
      notes TEXT,
      document_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Migration: staff_health_records table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration staff_health_records error:', e.message);
}

// ─── Plats témoins (witness meals) — Arrêté 21/12/2009 art. 32 ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS witness_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      meal_date TEXT NOT NULL,
      meal_type TEXT NOT NULL CHECK(meal_type IN ('petit_dejeuner','dejeuner','diner','gouter','collation')),
      service_type TEXT CHECK(service_type IN ('sur_place','livraison','emporter','traiteur')),
      samples TEXT,
      storage_temperature REAL,
      storage_location TEXT,
      kept_until TEXT NOT NULL,
      disposed_date TEXT,
      disposed_by TEXT,
      quantity_per_sample TEXT DEFAULT '100g minimum',
      is_complete INTEGER DEFAULT 0,
      notes TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_witness_meals_restaurant_date ON witness_meals(restaurant_id, meal_date DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_witness_meals_kept_until ON witness_meals(restaurant_id, kept_until)`);
  console.log('✅ Migration: witness_meals table ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration witness_meals error:', e.message);
}

// ─── Migration: supplier_accounts.token_expires_at ───
try {
  const saColNames = all("PRAGMA table_info(supplier_accounts)").map(c => c.name);
  if (!saColNames.includes('token_expires_at')) {
    db.exec("ALTER TABLE supplier_accounts ADD COLUMN token_expires_at DATETIME");
    console.log('✅ Migration: added token_expires_at to supplier_accounts');
  }
} catch (e) {
  console.error('Migration supplier_accounts.token_expires_at error:', e.message);
}

// ─── Migration: HACCP Étalonnage des thermomètres (DDPP requirement) ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS thermometers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      serial_number TEXT,
      location TEXT,
      type TEXT DEFAULT 'digital',
      last_calibration_date TEXT,
      next_calibration_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_thermometers_restaurant_id ON thermometers(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_thermometers_next_calibration ON thermometers(next_calibration_date);

    CREATE TABLE IF NOT EXISTS thermometer_calibrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL DEFAULT 1,
      thermometer_id TEXT NOT NULL,
      thermometer_name TEXT,
      thermometer_location TEXT,
      calibration_date TEXT NOT NULL,
      next_calibration_date TEXT,
      reference_temperature REAL NOT NULL,
      measured_temperature REAL NOT NULL,
      deviation REAL,
      is_compliant INTEGER DEFAULT 1,
      tolerance REAL DEFAULT 0.5,
      corrective_action TEXT,
      calibrated_by TEXT,
      certificate_reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_calibrations_restaurant_id ON thermometer_calibrations(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_calibrations_thermometer_id ON thermometer_calibrations(thermometer_id);
    CREATE INDEX IF NOT EXISTS idx_calibrations_calibration_date ON thermometer_calibrations(calibration_date);
  `);
  console.log('✅ Migration: thermometers + thermometer_calibrations tables ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration thermometers error:', e.message);
}

// ─── Migration: link temperature_logs to thermometers (probative value) ───
try {
  const tlCols = db.prepare("PRAGMA table_info(temperature_logs)").all().map(c => c.name);
  if (!tlCols.includes('thermometer_id')) {
    db.exec('ALTER TABLE temperature_logs ADD COLUMN thermometer_id INTEGER REFERENCES thermometers(id)');
    console.log('✅ Migration: added thermometer_id to temperature_logs');
  }
} catch (e) {
  console.error('Migration temperature_logs.thermometer_id error:', e.message);
}

// ─── DDPP probative-value migrations: cooking core measurement point + temperature operator ───
try {
  // cooking_records: add core_temp_point ("point de piqûre") — DDPP requires
  // recording WHERE the probe was inserted (cœur du produit / centre géométrique).
  const ccCols = db.prepare("PRAGMA table_info(cooking_records)").all().map(c => c.name);
  if (!ccCols.includes('core_temp_point')) {
    db.exec("ALTER TABLE cooking_records ADD COLUMN core_temp_point TEXT");
    console.log("✅ Migration: added cooking_records.core_temp_point (point de piqûre)");
  }
  // temperature_logs: add operator_name — staff using a tablet may not be a logged-in account.
  const tlCols = db.prepare("PRAGMA table_info(temperature_logs)").all().map(c => c.name);
  if (!tlCols.includes('operator_name')) {
    db.exec("ALTER TABLE temperature_logs ADD COLUMN operator_name TEXT");
    console.log("✅ Migration: added temperature_logs.operator_name (responsable du relevé)");
  }
} catch (e) {
  console.warn('⚠️ DDPP fields migration error:', e.message);
}

// ─── JWT revocation blacklist (referenced by routes/auth.js) ───
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jwt_blacklist (
      jti TEXT PRIMARY KEY,
      account_id INTEGER,
      expires_at INTEGER NOT NULL,
      revoked_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_exp ON jwt_blacklist(expires_at);
  `);
} catch (e) {
  console.warn('⚠️ jwt_blacklist migration error:', e.message);
}

// ─── Non-conformity ↔ corrective-action FK link ───
try {
  const ncCols = db.prepare("PRAGMA table_info(non_conformities)").all().map(c => c.name);
  if (ncCols.length && !ncCols.includes('corrective_action_id')) {
    db.exec("ALTER TABLE non_conformities ADD COLUMN corrective_action_id INTEGER");
    db.exec("CREATE INDEX IF NOT EXISTS idx_nc_corrective_action ON non_conformities(corrective_action_id)");
    console.log("✅ Migration: added non_conformities.corrective_action_id");
  }
} catch (e) {
  console.warn('⚠️ NC ↔ CA link migration error:', e.message);
}

// ─── Phase 2 multi-tenancy: restaurant_id on every tenant-scoped table ───
try {
  const PHASE2_TABLES = [
    'ingredients','recipes','recipe_ingredients','recipe_steps',
    'stock','stock_movements','suppliers','supplier_prices','supplier_accounts',
    'supplier_catalog','ingredient_supplier_prefs','price_history','price_change_notifications',
    'temperature_zones','temperature_logs','cleaning_tasks','cleaning_logs',
    'cooling_logs','reheating_logs','cooking_records','fryers','fryer_checks','non_conformities',
    'haccp_hazard_analysis','haccp_ccp','haccp_decision_tree_results',
    'traceability_logs','downstream_traceability','recall_procedures','training_records',
    'pest_control','equipment_maintenance','waste_management',
    'corrective_actions_templates','corrective_actions_log',
    'allergen_management_plan','water_management','pms_audits',
    'tiac_procedures','fabrication_diagrams','witness_meals',
    'order_items','purchase_orders','purchase_order_items',
    'delivery_notes','delivery_note_items','loyalty_transactions',
    'prediction_accuracy','referrals',
    'thermometers','thermometer_calibrations'
  ];
  for (const t of PHASE2_TABLES) {
    const tableExists = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?"
    ).get(t);
    if (!tableExists) continue;
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
    if (!cols.includes('restaurant_id')) {
      // First-time migration on this DB: add the column and backfill pre-existing
      // rows (which by definition have no tenant) to tenant 1. Guard: only touch
      // NULL rows, never overwrite existing non-null tenant ids. Critically, this
      // UPDATE only runs in the same `if` block as the ALTER — once the column
      // exists it will never run again, so a prod DB that already has multi-tenant
      // data is never re-homogenized to tenant 1 on restart.
      db.exec(`ALTER TABLE ${t} ADD COLUMN restaurant_id INTEGER DEFAULT 1`);
      const nullCount = db.prepare(`SELECT COUNT(*) as c FROM ${t} WHERE restaurant_id IS NULL`).get().c;
      if (nullCount > 0) {
        db.exec(`UPDATE ${t} SET restaurant_id = 1 WHERE restaurant_id IS NULL`);
        console.log(`  ↳ backfilled ${nullCount} row(s) in ${t} to restaurant_id=1`);
      }
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${t}_restaurant_id ON ${t}(restaurant_id)`);
  }
  console.log('✅ Migration: Phase 2 restaurant_id backfill complete');
} catch (e) {
  console.warn('⚠️ Phase 2 migration error:', e.message);
}

// ─── Supplier portal v2: SKU, TVA, packaging on supplier_catalog ───
// Each ALTER is wrapped individually so a partial-state DB (one column added,
// others not) heals on next boot. supplier_notifications is the supplier-side
// counterpart of price_change_notifications (which is gérant-facing): when a
// restaurant creates a purchase_order we drop a row here so the supplier's
// "Commandes" tab shows an unread badge.
try {
  const supplierCatalogCols = db.prepare("PRAGMA table_info('supplier_catalog')").all().map(c => c.name);
  if (!supplierCatalogCols.includes('sku')) {
    db.exec("ALTER TABLE supplier_catalog ADD COLUMN sku TEXT");
  }
  if (!supplierCatalogCols.includes('tva_rate')) {
    // 5.5% is the French reduced rate for foodstuffs — covers most catalog
    // items. Beverages with alcohol get 20% explicitly via the seed/UI.
    db.exec("ALTER TABLE supplier_catalog ADD COLUMN tva_rate REAL DEFAULT 5.5");
  }
  if (!supplierCatalogCols.includes('packaging')) {
    db.exec("ALTER TABLE supplier_catalog ADD COLUMN packaging TEXT");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      restaurant_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      order_id INTEGER,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_notifications_supplier_read
      ON supplier_notifications(supplier_id, read);
    CREATE INDEX IF NOT EXISTS idx_supplier_notifications_created
      ON supplier_notifications(created_at);
  `);
  console.log('✅ Migration: supplier-portal v2 (sku, tva_rate, packaging, notifications) ready');
} catch (e) {
  console.warn('⚠️ Supplier portal v2 migration error:', e.message);
}

// ─── Alto AI personalization: preferences, learning, shortcuts ───
// No FK REFERENCES (keeps :memory: test DB happy — matches cooling_logs convention)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      account_id INTEGER,
      pref_key TEXT NOT NULL,
      pref_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(restaurant_id, account_id, pref_key)
    );
    CREATE INDEX IF NOT EXISTS idx_ai_preferences_restaurant ON ai_preferences(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_ai_preferences_lookup ON ai_preferences(restaurant_id, account_id, pref_key);

    CREATE TABLE IF NOT EXISTS ai_learning (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      account_id INTEGER,
      action_type TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('confirmed','rejected','modified')),
      user_message TEXT,
      action_params TEXT,
      feedback_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_learning_restaurant ON ai_learning(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_ai_learning_recent ON ai_learning(restaurant_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ai_shortcuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      account_id INTEGER,
      trigger_phrase TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_template TEXT,
      description TEXT,
      usage_count INTEGER DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ai_shortcuts_restaurant ON ai_shortcuts(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_ai_shortcuts_trigger ON ai_shortcuts(restaurant_id, trigger_phrase);
  `);
  console.log('✅ Migration: ai_preferences, ai_learning, ai_shortcuts tables ready');
} catch (e) {
  if (!e.message.includes('already exists')) console.error('Migration ai_* tables error:', e.message);
}

// ─── audit_log (append-only, hash-chained for tamper-evidence) ───
// Each row carries a SHA-256 of its own canonical content plus the previous
// row's hash. Verifying the chain detects any DBA-level UPDATE/DELETE — the
// three experts flagged this as the #1 convergent hardening priority.
try {
  db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    account_id INTEGER,
    table_name TEXT NOT NULL,
    record_id INTEGER,
    action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
    old_values TEXT,
    new_values TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    previous_hash TEXT,
    row_hash TEXT
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_restaurant ON audit_log(restaurant_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id)`);

  // Backfill for pre-existing installs: add the two columns if missing.
  try {
    const cols = db.prepare(`PRAGMA table_info(audit_log)`).all().map(c => c.name);
    if (!cols.includes('previous_hash')) {
      db.exec(`ALTER TABLE audit_log ADD COLUMN previous_hash TEXT`);
    }
    if (!cols.includes('row_hash')) {
      db.exec(`ALTER TABLE audit_log ADD COLUMN row_hash TEXT`);
    }
  } catch (e) {
    console.warn('⚠️ audit_log column backfill error:', e.message);
  }
  console.log('✅ Migration: audit_log table ready (hash-chained)');
} catch (e) {
  console.warn('⚠️ audit_log migration error:', e.message);
}

}

module.exports = { runMigrations };
