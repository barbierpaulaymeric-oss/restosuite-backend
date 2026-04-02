const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'restosuite.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    category TEXT,
    default_unit TEXT DEFAULT 'g',
    waste_percent REAL DEFAULT 0,
    allergens TEXT,
    preferred_supplier_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    quality_rating INTEGER DEFAULT 3,
    quality_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS supplier_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    price REAL NOT NULL,
    unit TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ingredient_id, supplier_id)
  );
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    portions INTEGER DEFAULT 1,
    prep_time_min INTEGER,
    cooking_time_min INTEGER,
    selling_price REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    gross_quantity REAL NOT NULL,
    net_quantity REAL,
    unit TEXT NOT NULL,
    custom_waste_percent REAL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS recipe_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER REFERENCES ingredients(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    price REAL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'equipier',
    permissions TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT DEFAULT 'free',
    plan TEXT DEFAULT 'free',
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );
  CREATE TABLE IF NOT EXISTS ingredient_supplier_prefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    recipe_id INTEGER REFERENCES recipes(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    reason TEXT,
    UNIQUE(ingredient_id, recipe_id, supplier_id)
  );

  -- Stock actuel
  CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    min_quantity REAL DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
  );

  -- Mouvements de stock (entrées/sorties)
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    reason TEXT,
    supplier_id INTEGER,
    batch_number TEXT,
    dlc DATE,
    unit_price REAL,
    recorded_by INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (recorded_by) REFERENCES accounts(id)
  );

  -- HACCP: Zones de température
  CREATE TABLE IF NOT EXISTS temperature_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'fridge',
    min_temp REAL NOT NULL DEFAULT 0,
    max_temp REAL NOT NULL DEFAULT 4,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- HACCP: Relevés de température
  CREATE TABLE IF NOT EXISTS temperature_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL,
    temperature REAL NOT NULL,
    recorded_by INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    is_alert INTEGER DEFAULT 0,
    FOREIGN KEY (zone_id) REFERENCES temperature_zones(id),
    FOREIGN KEY (recorded_by) REFERENCES accounts(id)
  );

  -- HACCP: Plan de nettoyage
  CREATE TABLE IF NOT EXISTS cleaning_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    zone TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',
    product TEXT,
    method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cleaning_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    completed_by INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (task_id) REFERENCES cleaning_tasks(id),
    FOREIGN KEY (completed_by) REFERENCES accounts(id)
  );

  -- Portail fournisseur: Comptes fournisseur
  CREATE TABLE IF NOT EXISTS supplier_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    pin TEXT NOT NULL,
    access_token TEXT,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Portail fournisseur: Catalogue
  CREATE TABLE IF NOT EXISTS supplier_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL,
    price REAL NOT NULL,
    min_order REAL DEFAULT 0,
    available INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Portail fournisseur: Notifications de changement de prix
  CREATE TABLE IF NOT EXISTS price_change_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    old_price REAL,
    new_price REAL,
    change_type TEXT DEFAULT 'update',
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- HACCP: Traçabilité (réception marchandise)
  CREATE TABLE IF NOT EXISTS traceability_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    supplier TEXT,
    batch_number TEXT,
    dlc DATE,
    temperature_at_reception REAL,
    quantity REAL,
    unit TEXT DEFAULT 'kg',
    received_by INTEGER,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (received_by) REFERENCES accounts(id)
  );
`);

// ─── HACCP: Seed default zones & cleaning tasks ───
const zoneCount = get('SELECT COUNT(*) as c FROM temperature_zones');
if (zoneCount && zoneCount.c === 0) {
  const defaultZones = [
    { name: 'Frigo 1', type: 'fridge', min_temp: 0, max_temp: 4 },
    { name: 'Frigo 2', type: 'fridge', min_temp: 0, max_temp: 4 },
    { name: 'Congélateur', type: 'freezer', min_temp: -25, max_temp: -18 },
    { name: 'Chambre froide positive', type: 'cold_room', min_temp: 0, max_temp: 3 },
  ];
  for (const z of defaultZones) {
    run('INSERT INTO temperature_zones (name, type, min_temp, max_temp) VALUES (?, ?, ?, ?)',
      [z.name, z.type, z.min_temp, z.max_temp]);
  }
}

const taskCount = get('SELECT COUNT(*) as c FROM cleaning_tasks');
if (taskCount && taskCount.c === 0) {
  const defaultTasks = [
    { name: 'Plans de travail', zone: 'Cuisine', frequency: 'daily', product: 'Dégraissant + désinfectant', method: 'Nettoyer, rincer, désinfecter' },
    { name: 'Sols cuisine', zone: 'Cuisine', frequency: 'daily', product: 'Détergent sols', method: 'Balayer puis laver' },
    { name: 'Frigos', zone: 'Stockage', frequency: 'weekly', product: 'Nettoyant alimentaire', method: 'Vider, nettoyer parois et clayettes, rincer' },
    { name: 'Hotte et filtres', zone: 'Cuisine', frequency: 'weekly', product: 'Dégraissant', method: 'Démonter filtres, tremper, nettoyer' },
    { name: 'Congélateur', zone: 'Stockage', frequency: 'monthly', product: 'Nettoyant alimentaire', method: 'Dégivrer si nécessaire, nettoyer' },
  ];
  for (const t of defaultTasks) {
    run('INSERT INTO cleaning_tasks (name, zone, frequency, product, method) VALUES (?, ?, ?, ?, ?)',
      [t.name, t.zone, t.frequency, t.product, t.method]);
  }
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}
function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

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

// ─── Migration: Add recipe_type to recipes ───
try {
  const recipeCols = all("PRAGMA table_info(recipes)");
  if (!recipeCols.some(c => c.name === 'recipe_type')) {
    db.exec("ALTER TABLE recipes ADD COLUMN recipe_type TEXT DEFAULT 'plat'");
    console.log('✅ Migration: added recipe_type to recipes');
  }
} catch (e) {
  console.error('Migration recipe_type error:', e.message);
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
  `);
} catch (e) {
  // Tables may already exist
}

// ─── Seed: Common ingredients with prices ───
try {
  const seedIngredients = require('./seed-ingredients');
  seedIngredients(db, get, run);
} catch (e) {
  console.error('Seed ingredients error:', e.message);
}

module.exports = { db, all, get, run };
