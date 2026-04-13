const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.NODE_ENV === 'production' && fs.existsSync('/data')
  ? '/data'
  : path.join(__dirname, 'data');
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
    ingredient_id INTEGER REFERENCES ingredients(id),
    gross_quantity REAL NOT NULL,
    net_quantity REAL,
    unit TEXT NOT NULL DEFAULT 'portions',
    custom_waste_percent REAL,
    notes TEXT,
    sub_recipe_id INTEGER REFERENCES recipes(id)
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

  -- Restaurants
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    phone TEXT,
    covers INTEGER DEFAULT 30,
    siret TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Tables (plan de salle)
  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER REFERENCES restaurants(id),
    table_number INTEGER NOT NULL,
    zone TEXT DEFAULT 'Salle',
    seats INTEGER DEFAULT 4,
    position_x REAL,
    position_y REAL,
    active INTEGER DEFAULT 1
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

  -- Bons de livraison fournisseur
  CREATE TABLE IF NOT EXISTS delivery_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    status TEXT DEFAULT 'pending',
    delivery_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_at DATETIME,
    received_by INTEGER REFERENCES accounts(id),
    reception_notes TEXT,
    total_amount REAL DEFAULT 0
  );

  -- Lignes de bon de livraison
  CREATE TABLE IF NOT EXISTS delivery_note_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_note_id INTEGER NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
    ingredient_id INTEGER REFERENCES ingredients(id),
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT DEFAULT 'kg',
    price_per_unit REAL,
    batch_number TEXT,
    dlc DATE,
    temperature_required REAL,
    temperature_measured REAL,
    fishing_zone TEXT,
    fishing_method TEXT,
    origin TEXT,
    sanitary_approval TEXT,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    notes TEXT
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

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
  CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);
  CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_sub_recipe_id ON recipe_ingredients(sub_recipe_id);
  CREATE INDEX IF NOT EXISTS idx_supplier_prices_ingredient_id ON supplier_prices(ingredient_id);
  CREATE INDEX IF NOT EXISTS idx_supplier_prices_supplier_id ON supplier_prices(supplier_id);
  CREATE INDEX IF NOT EXISTS idx_supplier_prices_last_updated ON supplier_prices(last_updated);
  CREATE INDEX IF NOT EXISTS idx_stock_ingredient_id ON stock(ingredient_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient_id ON stock_movements(ingredient_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_recorded_at ON stock_movements(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
  CREATE INDEX IF NOT EXISTS idx_price_history_ingredient_id ON price_history(ingredient_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_temperature_logs_zone_id ON temperature_logs(zone_id);
  CREATE INDEX IF NOT EXISTS idx_temperature_logs_recorded_at ON temperature_logs(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_cleaning_logs_task_id ON cleaning_logs(task_id);
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

module.exports = { db, all, get, run };
