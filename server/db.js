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

module.exports = { db, all, get, run };
