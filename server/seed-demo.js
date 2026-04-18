#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Demo seed — populates the DB with realistic French brasserie data so the
// product can be explored without hand-entering anything.
//
//   node server/seed-demo.js
//
// Idempotent: re-running is a no-op once the demo owner exists. Everything is
// scoped to restaurant_id = 1. Never wire this into server boot — it's a
// developer/sales tool only.
// ═══════════════════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const { db, get, run, all } = require('./db');

const RID = 1;
const OWNER_EMAIL = 'demo@restosuite.fr';
const OWNER_PASSWORD = 'Demo2026!';

function log(msg) { console.log(`  ${msg}`); }
function section(title) { console.log(`\n▸ ${title}`); }

// ─── Idempotency guard ─────────────────────────────────────────────────────
const existing = get('SELECT id FROM accounts WHERE email = ?', [OWNER_EMAIL]);
if (existing) {
  console.log(`✅ Demo data already present (${OWNER_EMAIL} exists, account id=${existing.id}). Nothing to do.`);
  process.exit(0);
}

console.log('🌱 Seeding demo data for Chez Laurent — Paris 11…');

// ─── 1. Restaurant ─────────────────────────────────────────────────────────
section('Restaurant');
const restaurantRow = get('SELECT id FROM restaurants WHERE id = ?', [RID]);
if (restaurantRow) {
  run(
    `UPDATE restaurants SET
       name = ?, type = ?, address = ?, city = ?, postal_code = ?,
       phone = ?, covers = ?, siret = ?, plan = ?,
       service_start = ?, service_end = ?, service_active = 1
     WHERE id = ?`,
    ['Chez Laurent - Paris 11', 'brasserie', '42 rue de la Roquette',
     'Paris', '75011', '01 43 57 12 34', 45, '12345678900012', 'pro',
     '11:30', '23:00', RID]
  );
  log(`Restaurant ${RID} updated`);
} else {
  run(
    `INSERT INTO restaurants (id, name, type, address, city, postal_code, phone, covers, siret, plan, service_start, service_end, service_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [RID, 'Chez Laurent - Paris 11', 'brasserie', '42 rue de la Roquette',
     'Paris', '75011', '01 43 57 12 34', 45, '12345678900012', 'pro',
     '11:30', '23:00']
  );
  log(`Restaurant ${RID} created`);
}

// ─── 2. Accounts ───────────────────────────────────────────────────────────
section('Accounts');
const ownerHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
const ownerPerms = JSON.stringify({
  view_recipes: true, view_costs: true, edit_recipes: true,
  view_suppliers: true, export_pdf: true
});

const ownerResult = run(
  `INSERT INTO accounts (name, pin, role, permissions, email, password_hash, first_name, last_name, phone, restaurant_id, onboarding_step, is_owner, trial_start)
   VALUES (?, NULL, 'gerant', ?, ?, ?, ?, ?, ?, ?, 10, 1, datetime('now'))`,
  ['Laurent Martin', ownerPerms, OWNER_EMAIL, ownerHash, 'Laurent', 'Martin', '06 12 34 56 78', RID]
);
const ownerId = ownerResult.lastInsertRowid;
log(`Gérant: ${OWNER_EMAIL} / ${OWNER_PASSWORD} (id=${ownerId})`);

const staffPerms = JSON.stringify({ view_recipes: true });
const staff = [
  { name: 'Thomas Moreau', first: 'Thomas', last: 'Moreau', pin: '1234', role: 'cuisinier', zones: ['Cuisine'], skills: ['Cuisson', 'Découpe', 'Sauces'] },
  { name: 'Julie Dubois',  first: 'Julie',  last: 'Dubois',  pin: '5678', role: 'equipier',  zones: ['Cuisine', 'Plonge'], skills: ['Mise en place', 'Plonge'] },
  { name: 'Marc Bernard',  first: 'Marc',   last: 'Bernard', pin: '9012', role: 'salle',     zones: ['Salle'],   skills: ['Service', 'Bar', 'Encaissement'] },
];

for (const s of staff) {
  const pinHash = bcrypt.hashSync(s.pin, 10);
  run(
    `INSERT INTO accounts (name, pin, role, permissions, first_name, last_name, restaurant_id, is_owner, zones, skills, hire_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, date('now', '-90 days'))`,
    [s.name, pinHash, s.role, staffPerms, s.first, s.last, RID, JSON.stringify(s.zones), JSON.stringify(s.skills)]
  );
  log(`Staff: ${s.name} (${s.role}) PIN=${s.pin}`);
}

// ─── 3. Suppliers ──────────────────────────────────────────────────────────
section('Suppliers');
const suppliers = [
  { name: 'Metro Paris Nation',   contact: 'Service pro', phone: '01 40 09 40 00', email: 'pro@metro.fr',               rating: 4, notes: 'Grossiste généraliste, livraison 6j/7' },
  { name: 'Pomona TerreAzur',     contact: 'Sylvie D.',   phone: '01 49 29 30 00', email: 'commandes@pomona-terreazur.fr', rating: 5, notes: 'Fruits & légumes, très bon rapport qualité/prix' },
  { name: 'Bigard Boucherie Pro', contact: 'Julien B.',   phone: '02 98 85 33 33', email: 'pro@bigard.fr',              rating: 5, notes: 'Viandes françaises, traçabilité complète' },
  { name: 'France Boissons',      contact: 'Karine L.',   phone: '03 88 65 65 65', email: 'commandes@france-boissons.fr', rating: 4, notes: 'Boissons & spiritueux' },
  { name: 'Brake France',         contact: 'Pierre M.',   phone: '01 58 31 99 00', email: 'pro@brake.fr',               rating: 3, notes: 'Surgelés & produits de la mer' },
  { name: 'Marée du Jour',        contact: 'Antoine R.',  phone: '02 98 44 20 20', email: 'commandes@maree-du-jour.fr', rating: 5, notes: 'Poissonnerie Rungis, arrivages quotidiens' },
];
const supplierIds = {};
for (const s of suppliers) {
  const r = run(
    `INSERT INTO suppliers (name, contact, phone, email, quality_rating, quality_notes, restaurant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [s.name, s.contact, s.phone, s.email, s.rating, s.notes, RID]
  );
  supplierIds[s.name] = r.lastInsertRowid;
  log(`${s.name} (★${s.rating})`);
}

// ─── 3b. Supplier portal accounts (Metro, Pomona, France Boissons) ─────────
section('Supplier portal accounts');
const supplierLogins = [
  { supplier: 'Metro Paris Nation',   name: 'Metro Pro',        email: 'pro@metro.fr',                  pin: '1111' },
  { supplier: 'Pomona TerreAzur',     name: 'Pomona Commandes', email: 'commandes@pomona-terreazur.fr', pin: '2222' },
  { supplier: 'France Boissons',      name: 'FB Commandes',     email: 'commandes@france-boissons.fr',  pin: '3333' },
];
for (const sl of supplierLogins) {
  const pinHash = bcrypt.hashSync(sl.pin, 10);
  run(
    `INSERT INTO supplier_accounts (supplier_id, name, email, pin, restaurant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [supplierIds[sl.supplier], sl.name, sl.email, pinHash, RID]
  );
  log(`${sl.name} PIN=${sl.pin}`);
}

// ─── 4. Ingredients ────────────────────────────────────────────────────────
section('Ingredients');
// The boot-time seed may already have inserted generic names (UNIQUE COLLATE NOCASE).
// We INSERT OR IGNORE to top up, then fetch ids for recipe wiring.
const ingredients = [
  // Viandes
  { name: 'entrecôte de bœuf',        cat: 'viandes',    unit: 'g',     price: 32.00, priceUnit: 'kg', waste: 8,  allergens: null },
  { name: 'suprême de volaille',      cat: 'viandes',    unit: 'g',     price: 12.50, priceUnit: 'kg', waste: 5,  allergens: null },
  { name: 'cuisse de canard confite', cat: 'viandes',    unit: 'pièce', price: 4.50,  priceUnit: 'pièce', waste: 0, allergens: null },
  { name: 'bœuf haché 15% MG',        cat: 'viandes',    unit: 'g',     price: 11.00, priceUnit: 'kg', waste: 0,  allergens: null },
  { name: 'lardons fumés',            cat: 'viandes',    unit: 'g',     price: 9.80,  priceUnit: 'kg', waste: 0,  allergens: null },
  { name: 'foie de porc',             cat: 'viandes',    unit: 'g',     price: 6.00,  priceUnit: 'kg', waste: 10, allergens: null },
  // Poissons
  { name: 'pavé de saumon',           cat: 'poissons',   unit: 'g',     price: 24.00, priceUnit: 'kg', waste: 8,  allergens: 'poisson' },
  { name: 'saumon extra-frais sashimi', cat: 'poissons', unit: 'g',     price: 32.00, priceUnit: 'kg', waste: 15, allergens: 'poisson' },
  // Légumes
  { name: 'pomme de terre bintje',    cat: 'légumes',    unit: 'g',     price: 1.40,  priceUnit: 'kg', waste: 18, allergens: null },
  { name: 'champignons de Paris',     cat: 'légumes',    unit: 'g',     price: 5.80,  priceUnit: 'kg', waste: 10, allergens: null },
  { name: 'cèpes frais',              cat: 'légumes',    unit: 'g',     price: 38.00, priceUnit: 'kg', waste: 15, allergens: null },
  { name: 'oignon jaune',             cat: 'légumes',    unit: 'g',     price: 1.50,  priceUnit: 'kg', waste: 10, allergens: null },
  { name: 'échalote grise',           cat: 'légumes',    unit: 'g',     price: 5.50,  priceUnit: 'kg', waste: 10, allergens: null },
  { name: 'ail rose',                 cat: 'légumes',    unit: 'g',     price: 9.00,  priceUnit: 'kg', waste: 20, allergens: null },
  { name: 'cœur de romaine',          cat: 'légumes',    unit: 'pièce', price: 1.80,  priceUnit: 'pièce', waste: 15, allergens: null },
  { name: 'tomate cœur de bœuf',      cat: 'légumes',    unit: 'g',     price: 4.20,  priceUnit: 'kg', waste: 5,  allergens: null },
  { name: 'pomme golden',             cat: 'fruits',     unit: 'g',     price: 2.40,  priceUnit: 'kg', waste: 10, allergens: null },
  // Produits laitiers
  { name: 'beurre AOP Charentes',     cat: 'produits laitiers', unit: 'g',  price: 12.00, priceUnit: 'kg', waste: 0, allergens: 'lait' },
  { name: 'crème liquide 35% MG',     cat: 'produits laitiers', unit: 'ml', price: 5.20,  priceUnit: 'l',  waste: 0, allergens: 'lait' },
  { name: 'parmesan reggiano',        cat: 'produits laitiers', unit: 'g',  price: 28.00, priceUnit: 'kg', waste: 5, allergens: 'lait' },
  { name: 'gruyère râpé',             cat: 'produits laitiers', unit: 'g',  price: 14.50, priceUnit: 'kg', waste: 0, allergens: 'lait' },
  { name: 'œuf fermier',              cat: 'produits laitiers', unit: 'pièce', price: 0.42, priceUnit: 'pièce', waste: 12, allergens: 'œuf' },
  { name: 'mascarpone',               cat: 'produits laitiers', unit: 'g',  price: 7.80,  priceUnit: 'kg', waste: 0, allergens: 'lait' },
  // Épicerie
  { name: 'pain de mie brioché',      cat: 'épicerie',   unit: 'g',     price: 6.00,  priceUnit: 'kg', waste: 5,  allergens: 'gluten,lait,œuf' },
  { name: 'farine T55',               cat: 'épicerie',   unit: 'g',     price: 1.10,  priceUnit: 'kg', waste: 0,  allergens: 'gluten' },
  { name: 'riz arborio',              cat: 'épicerie',   unit: 'g',     price: 3.80,  priceUnit: 'kg', waste: 0,  allergens: null },
  { name: 'bouillon de volaille',     cat: 'épicerie',   unit: 'ml',    price: 4.50,  priceUnit: 'l',  waste: 0,  allergens: null },
  { name: 'vin blanc de cuisson',     cat: 'épicerie',   unit: 'ml',    price: 3.80,  priceUnit: 'l',  waste: 0,  allergens: 'sulfites' },
  { name: 'sucre semoule',            cat: 'épicerie',   unit: 'g',     price: 1.20,  priceUnit: 'kg', waste: 0,  allergens: null },
  { name: 'chocolat noir 70%',        cat: 'épicerie',   unit: 'g',     price: 14.00, priceUnit: 'kg', waste: 0,  allergens: 'lait,soja' },
  { name: 'gousse de vanille',        cat: 'épicerie',   unit: 'pièce', price: 2.80,  priceUnit: 'pièce', waste: 0, allergens: null },
  { name: 'miel de Provence',         cat: 'épicerie',   unit: 'g',     price: 18.00, priceUnit: 'kg', waste: 0,  allergens: null },
  // Herbes
  { name: 'thym frais',               cat: 'herbes',     unit: 'botte', price: 1.20, priceUnit: 'botte', waste: 40, allergens: null },
  { name: 'persil plat',              cat: 'herbes',     unit: 'botte', price: 1.00, priceUnit: 'botte', waste: 30, allergens: null },
];

const insertIng = db.prepare(
  `INSERT OR IGNORE INTO ingredients (name, category, default_unit, price_per_unit, price_unit, waste_percent, allergens, restaurant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const updateIng = db.prepare(
  `UPDATE ingredients SET price_per_unit = ?, price_unit = ?, waste_percent = ?, allergens = ?, category = ?, restaurant_id = ?
   WHERE name = ? COLLATE NOCASE`
);
for (const ing of ingredients) {
  insertIng.run(ing.name, ing.cat, ing.unit, ing.price, ing.priceUnit, ing.waste, ing.allergens, RID);
  updateIng.run(ing.price, ing.priceUnit, ing.waste, ing.allergens, ing.cat, RID, ing.name);
}
log(`${ingredients.length} ingredients upserted`);

// Build ingredient name → id lookup
const ingredientId = {};
for (const row of all(`SELECT id, name FROM ingredients WHERE restaurant_id = ? OR restaurant_id IS NULL`, [RID])) {
  ingredientId[row.name.toLowerCase()] = row.id;
}
function ingId(name) {
  const id = ingredientId[name.toLowerCase()];
  if (!id) throw new Error(`Ingredient not found: ${name}`);
  return id;
}

// ─── 4b. Supplier prices (varied per supplier for ≥10 staples) ─────────────
section('Supplier prices');
const supplierPrices = [
  // product,                         supplier,                  price, unit
  ['entrecôte de bœuf',              'Bigard Boucherie Pro',    32.00, 'kg'],
  ['entrecôte de bœuf',              'Metro Paris Nation',      34.50, 'kg'],
  ['suprême de volaille',            'Bigard Boucherie Pro',    12.50, 'kg'],
  ['suprême de volaille',            'Metro Paris Nation',      13.20, 'kg'],
  ['cuisse de canard confite',       'Metro Paris Nation',       4.50, 'pièce'],
  ['pavé de saumon',                 'Marée du Jour',           24.00, 'kg'],
  ['pavé de saumon',                 'Brake France',            22.50, 'kg'],
  ['saumon extra-frais sashimi',     'Marée du Jour',           32.00, 'kg'],
  ['pomme de terre bintje',          'Pomona TerreAzur',         1.40, 'kg'],
  ['pomme de terre bintje',          'Metro Paris Nation',       1.55, 'kg'],
  ['champignons de Paris',           'Pomona TerreAzur',         5.80, 'kg'],
  ['cèpes frais',                    'Pomona TerreAzur',        38.00, 'kg'],
  ['oignon jaune',                   'Pomona TerreAzur',         1.50, 'kg'],
  ['cœur de romaine',                'Pomona TerreAzur',         1.80, 'pièce'],
  ['tomate cœur de bœuf',            'Pomona TerreAzur',         4.20, 'kg'],
  ['beurre AOP Charentes',           'Metro Paris Nation',      12.00, 'kg'],
  ['crème liquide 35% MG',           'Metro Paris Nation',       5.20, 'l'],
  ['parmesan reggiano',              'Metro Paris Nation',      28.00, 'kg'],
  ['œuf fermier',                    'Pomona TerreAzur',         0.42, 'pièce'],
  ['vin blanc de cuisson',           'France Boissons',          3.80, 'l'],
  ['chocolat noir 70%',              'Metro Paris Nation',      14.00, 'kg'],
];
const insertSP = db.prepare(
  `INSERT OR IGNORE INTO supplier_prices (ingredient_id, supplier_id, price, unit, restaurant_id)
   VALUES (?, ?, ?, ?, ?)`
);
let spCount = 0;
for (const [name, supplier, price, unit] of supplierPrices) {
  const sid = supplierIds[supplier];
  const iid = ingredientId[name.toLowerCase()];
  if (sid && iid) {
    insertSP.run(iid, sid, price, unit, RID);
    spCount++;
  }
}
log(`${spCount} supplier prices`);

// ─── 5. Recipes ────────────────────────────────────────────────────────────
section('Recipes');
// name, category, type, portions, prep, cook, sell, description, ingredients[]
// Each ingredient: [name, gross_qty, unit]
const recipes = [
  // ───── Entrées ─────
  {
    name: 'Salade César', cat: 'Entrées', type: 'entrée', portions: 1, prep: 10, cook: 5, sell: 12.50,
    desc: 'Romaine, copeaux de parmesan, croûtons maison, sauce César anchois.',
    ingredients: [
      ['cœur de romaine', 1, 'pièce'],
      ['parmesan reggiano', 30, 'g'],
      ['pain de mie brioché', 40, 'g'],
      ['œuf fermier', 1, 'pièce'],
      ['ail rose', 2, 'g'],
    ],
    steps: [
      'Laver et ciseler la romaine.',
      'Préparer les croûtons : dés de pain rissolés au beurre et à l\'ail.',
      'Monter la sauce César (jaune d\'œuf, anchois, parmesan, citron).',
      'Dresser : salade, sauce, croûtons, copeaux de parmesan.',
    ],
  },
  {
    name: 'Soupe à l\'oignon gratinée', cat: 'Entrées', type: 'entrée', portions: 1, prep: 15, cook: 45, sell: 9.80,
    desc: 'Oignons caramélisés, bouillon corsé, croûte au gruyère.',
    ingredients: [
      ['oignon jaune', 300, 'g'],
      ['beurre AOP Charentes', 30, 'g'],
      ['bouillon de volaille', 400, 'ml'],
      ['vin blanc de cuisson', 80, 'ml'],
      ['pain de mie brioché', 50, 'g'],
      ['gruyère râpé', 60, 'g'],
    ],
    steps: [
      'Émincer finement les oignons.',
      'Suer au beurre à couvert 20 min puis caraméliser à feu vif.',
      'Déglacer au vin blanc, ajouter le bouillon, mijoter 20 min.',
      'Verser en caquelon, recouvrir de pain et gruyère, gratiner 10 min.',
    ],
  },
  {
    name: 'Tartare de saumon à l\'aneth', cat: 'Entrées', type: 'entrée', portions: 1, prep: 15, cook: 0, sell: 14.50,
    desc: 'Saumon extra-frais haché au couteau, échalote, aneth, citron.',
    ingredients: [
      ['saumon extra-frais sashimi', 140, 'g'],
      ['échalote grise', 15, 'g'],
      ['œuf fermier', 1, 'pièce'],
      ['pain de mie brioché', 40, 'g'],
    ],
    steps: [
      'Tailler le saumon au couteau (jamais hachoir).',
      'Mélanger avec échalote ciselée, aneth, jus de citron, sel, poivre.',
      'Dresser en cercle, jaune d\'œuf au centre.',
      'Servir avec toasts grillés.',
    ],
  },
  {
    name: 'Terrine de campagne maison', cat: 'Entrées', type: 'entrée', portions: 8, prep: 30, cook: 90, sell: 8.90,
    desc: 'Terrine traditionnelle porc et foie, cornichons, pain de campagne.',
    ingredients: [
      ['foie de porc', 400, 'g'],
      ['bœuf haché 15% MG', 300, 'g'],
      ['oignon jaune', 100, 'g'],
      ['œuf fermier', 2, 'pièce'],
      ['thym frais', 0.3, 'botte'],
    ],
    steps: [
      'Hacher les viandes grossièrement.',
      'Mélanger avec oignon suée, œufs, thym, sel, poivre, 4-épices.',
      'Garnir une terrine, couvrir, cuire au bain-marie 90 min à 160°C.',
      'Presser 24h au frais avant service.',
    ],
  },

  // ───── Plats ─────
  {
    name: 'Entrecôte grillée, frites maison', cat: 'Plats', type: 'plat', portions: 1, prep: 10, cook: 15, sell: 26.50,
    desc: 'Entrecôte bœuf race à viande, frites bintje, beurre maître d\'hôtel.',
    ingredients: [
      ['entrecôte de bœuf', 250, 'g'],
      ['pomme de terre bintje', 300, 'g'],
      ['beurre AOP Charentes', 25, 'g'],
      ['persil plat', 0.1, 'botte'],
      ['ail rose', 3, 'g'],
    ],
    steps: [
      'Tailler les pommes de terre en frites, double cuisson (160°C puis 180°C).',
      'Saisir l\'entrecôte 2 min par face (saignant), reposer 5 min.',
      'Monter beurre maître d\'hôtel (beurre, persil, citron, échalote).',
      'Dresser viande, beurre posé sur le dessus, frites.',
    ],
  },
  {
    name: 'Pavé de saumon beurre blanc', cat: 'Plats', type: 'plat', portions: 1, prep: 15, cook: 15, sell: 24.00,
    desc: 'Saumon rôti peau croustillante, beurre blanc, riz sauvage.',
    ingredients: [
      ['pavé de saumon', 160, 'g'],
      ['riz arborio', 80, 'g'],
      ['beurre AOP Charentes', 40, 'g'],
      ['échalote grise', 30, 'g'],
      ['vin blanc de cuisson', 100, 'ml'],
      ['crème liquide 35% MG', 30, 'ml'],
    ],
    steps: [
      'Cuire le riz en pilaf.',
      'Réduire échalote + vin blanc à sec, ajouter crème, monter au beurre.',
      'Saisir saumon côté peau 4 min, retourner 2 min (rosé à cœur).',
      'Dresser saumon, beurre blanc, riz.',
    ],
  },
  {
    name: 'Suprême de volaille, jus au fond de veau', cat: 'Plats', type: 'plat', portions: 1, prep: 10, cook: 20, sell: 19.80,
    desc: 'Suprême fermier rôti, jus corsé, pommes grenaille.',
    ingredients: [
      ['suprême de volaille', 200, 'g'],
      ['pomme de terre bintje', 250, 'g'],
      ['beurre AOP Charentes', 20, 'g'],
      ['échalote grise', 20, 'g'],
      ['bouillon de volaille', 150, 'ml'],
      ['thym frais', 0.1, 'botte'],
    ],
    steps: [
      'Sauter les pommes grenaille avec ail et thym.',
      'Saisir suprême côté peau 5 min, finir au four 10 min à 180°C.',
      'Déglacer la poêle au bouillon, réduire, monter au beurre.',
      'Dresser, napper de jus.',
    ],
  },
  {
    name: 'Confit de canard, pommes sarladaises', cat: 'Plats', type: 'plat', portions: 1, prep: 10, cook: 25, sell: 22.50,
    desc: 'Cuisse confite dorée, pommes sautées à la graisse de canard, ail, persil.',
    ingredients: [
      ['cuisse de canard confite', 1, 'pièce'],
      ['pomme de terre bintje', 300, 'g'],
      ['ail rose', 4, 'g'],
      ['persil plat', 0.2, 'botte'],
    ],
    steps: [
      'Réchauffer la cuisse côté peau, four 200°C 20 min.',
      'Sauter pommes de terre en rondelles à la graisse de canard.',
      'Ajouter ail et persil ciselé en fin de cuisson.',
      'Dresser cuisse croustillante sur pommes sarladaises.',
    ],
  },
  {
    name: 'Risotto aux cèpes', cat: 'Plats', type: 'plat', portions: 1, prep: 10, cook: 25, sell: 21.00,
    desc: 'Risotto crémeux aux cèpes frais, parmesan reggiano.',
    ingredients: [
      ['riz arborio', 100, 'g'],
      ['cèpes frais', 80, 'g'],
      ['oignon jaune', 40, 'g'],
      ['vin blanc de cuisson', 80, 'ml'],
      ['bouillon de volaille', 500, 'ml'],
      ['parmesan reggiano', 40, 'g'],
      ['beurre AOP Charentes', 25, 'g'],
    ],
    steps: [
      'Suer oignon au beurre, nacrer le riz, déglacer au vin blanc.',
      'Mouiller au bouillon chaud louche par louche 18 min.',
      'Sauter les cèpes à part.',
      'Incorporer cèpes, beurre et parmesan, rectifier.',
    ],
  },
  {
    name: 'Burger maison bœuf fermier', cat: 'Plats', type: 'plat', portions: 1, prep: 10, cook: 10, sell: 17.50,
    desc: 'Steak haché 15% MG, pain brioché, gruyère fondu, lardons.',
    ingredients: [
      ['bœuf haché 15% MG', 180, 'g'],
      ['pain de mie brioché', 120, 'g'],
      ['gruyère râpé', 40, 'g'],
      ['lardons fumés', 40, 'g'],
      ['tomate cœur de bœuf', 50, 'g'],
      ['cœur de romaine', 0.3, 'pièce'],
    ],
    steps: [
      'Façonner le steak haché, saisir 3 min par face.',
      'Ajouter gruyère en fin de cuisson.',
      'Toaster le pain, garnir : salade, tomate, steak, lardons.',
      'Servir avec frites maison.',
    ],
  },

  // ───── Desserts ─────
  {
    name: 'Crème brûlée à la vanille', cat: 'Desserts', type: 'dessert', portions: 1, prep: 15, cook: 60, sell: 8.50,
    desc: 'Crème onctueuse à la vanille bourbon, caramel craquant.',
    ingredients: [
      ['crème liquide 35% MG', 150, 'ml'],
      ['œuf fermier', 2, 'pièce'],
      ['sucre semoule', 30, 'g'],
      ['gousse de vanille', 0.3, 'pièce'],
    ],
    steps: [
      'Infuser la vanille dans la crème chaude.',
      'Blanchir jaunes + sucre, mêler à la crème.',
      'Cuire au bain-marie 90°C 50 min.',
      'Refroidir, caraméliser au sucre brûlé au service.',
    ],
  },
  {
    name: 'Tarte Tatin, crème épaisse', cat: 'Desserts', type: 'dessert', portions: 6, prep: 20, cook: 45, sell: 7.50,
    desc: 'Tarte Tatin de pommes caramélisées, pâte croustillante.',
    ingredients: [
      ['pomme golden', 1000, 'g'],
      ['sucre semoule', 120, 'g'],
      ['beurre AOP Charentes', 80, 'g'],
      ['farine T55', 200, 'g'],
      ['œuf fermier', 1, 'pièce'],
    ],
    steps: [
      'Caraméliser sucre + beurre en moule à Tatin.',
      'Disposer pommes pelées en rosace, cuire 15 min.',
      'Couvrir de pâte brisée, cuire 30 min à 180°C.',
      'Démouler chaud, servir avec crème épaisse.',
    ],
  },
  {
    name: 'Mousse au chocolat noir', cat: 'Desserts', type: 'dessert', portions: 1, prep: 15, cook: 0, sell: 7.00,
    desc: 'Mousse aérienne au chocolat 70%, noisette de chantilly.',
    ingredients: [
      ['chocolat noir 70%', 60, 'g'],
      ['œuf fermier', 2, 'pièce'],
      ['sucre semoule', 20, 'g'],
      ['crème liquide 35% MG', 30, 'ml'],
    ],
    steps: [
      'Fondre le chocolat au bain-marie.',
      'Incorporer jaunes puis beurre, refroidir à 35°C.',
      'Monter blancs en neige, serrer au sucre, incorporer.',
      'Laisser prendre 3h au frais.',
    ],
  },
  {
    name: 'Île flottante, caramel au beurre salé', cat: 'Desserts', type: 'dessert', portions: 1, prep: 20, cook: 10, sell: 7.50,
    desc: 'Blancs pochés, crème anglaise vanille, caramel.',
    ingredients: [
      ['œuf fermier', 2, 'pièce'],
      ['sucre semoule', 40, 'g'],
      ['crème liquide 35% MG', 120, 'ml'],
      ['gousse de vanille', 0.25, 'pièce'],
      ['beurre AOP Charentes', 15, 'g'],
    ],
    steps: [
      'Crème anglaise : jaunes + sucre + crème vanillée à 83°C.',
      'Monter blancs fermes, pocher 1 min en cuillères au lait frémissant.',
      'Caramel au beurre salé : sucre brun, beurre, crème.',
      'Dresser crème, île, filet de caramel.',
    ],
  },
  {
    name: 'Tiramisu au café', cat: 'Desserts', type: 'dessert', portions: 6, prep: 25, cook: 0, sell: 7.80,
    desc: 'Mascarpone, café corsé, biscuits imbibés, cacao.',
    ingredients: [
      ['mascarpone', 250, 'g'],
      ['œuf fermier', 3, 'pièce'],
      ['sucre semoule', 80, 'g'],
      ['farine T55', 20, 'g'],
    ],
    steps: [
      'Blanchir jaunes + sucre, ajouter mascarpone.',
      'Incorporer blancs montés.',
      'Tremper biscuits dans café fort, alterner avec crème.',
      'Réserver 12h, poudrer de cacao au service.',
    ],
  },
];

const insertRecipe = db.prepare(
  `INSERT INTO recipes (name, category, recipe_type, portions, prep_time_min, cooking_time_min, selling_price, description, restaurant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertRI = db.prepare(
  `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, unit, restaurant_id)
   VALUES (?, ?, ?, ?, ?)`
);
const insertStep = db.prepare(
  `INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)`
);

const seedRecipes = db.transaction(() => {
  for (const r of recipes) {
    const rec = insertRecipe.run(r.name, r.cat, r.type, r.portions, r.prep, r.cook, r.sell, r.desc, RID);
    const rid = rec.lastInsertRowid;
    for (const [iname, qty, unit] of r.ingredients) {
      insertRI.run(rid, ingId(iname), qty, unit, RID);
    }
    r.steps.forEach((s, i) => insertStep.run(rid, i + 1, s));
  }
});
seedRecipes();
log(`${recipes.length} recipes + ingredients + steps`);

// ─── 6. Temperature zones & logs (30 days) ─────────────────────────────────
section('Temperature logs (30 days)');
// Ensure we have the 7 zones (the boot seed creates 4). Upsert gracefully.
const demoZones = [
  { name: 'Frigo cuisine 1',          type: 'fridge',    min: 0, max: 4 },
  { name: 'Frigo cuisine 2',          type: 'fridge',    min: 0, max: 4 },
  { name: 'Chambre froide positive',  type: 'cold_room', min: 0, max: 3 },
  { name: 'Chambre froide négative',  type: 'freezer',   min: -25, max: -18 },
  { name: 'Congélateur desserts',     type: 'freezer',   min: -25, max: -18 },
  { name: 'Vitrine entrées',          type: 'fridge',    min: 0, max: 4 },
  { name: 'Cave à vin',               type: 'fridge',    min: 10, max: 14 },
];
// Wipe any demo zones for idempotency correctness then re-insert.
// The boot-seeded default zones (Frigo 1/2/Congélateur/Chambre froide positive)
// may already exist — we leave them and add the missing ones.
const existingZoneNames = new Set(
  all('SELECT name FROM temperature_zones WHERE restaurant_id = ?', [RID]).map(z => z.name)
);
const insertZone = db.prepare(
  `INSERT INTO temperature_zones (name, type, min_temp, max_temp, restaurant_id) VALUES (?, ?, ?, ?, ?)`
);
for (const z of demoZones) {
  if (!existingZoneNames.has(z.name)) {
    insertZone.run(z.name, z.type, z.min, z.max, RID);
  }
}
const allZones = all('SELECT id, name, min_temp, max_temp FROM temperature_zones WHERE restaurant_id = ?', [RID]);

const insertTempLog = db.prepare(
  `INSERT INTO temperature_logs (zone_id, temperature, recorded_by, recorded_at, is_alert, operator_name, restaurant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const seedTempLogs = db.transaction(() => {
  const now = Date.now();
  let total = 0;
  let alerts = 0;
  for (const zone of allZones) {
    const target = (zone.min_temp + zone.max_temp) / 2;
    const tolerance = (zone.max_temp - zone.min_temp) / 2;
    for (let d = 30; d >= 0; d--) {
      // two reads per day: 09:00 and 18:00
      for (const hour of [9, 18]) {
        const ts = new Date(now - d * 86400000);
        ts.setHours(hour, Math.floor(Math.random() * 30), 0, 0);
        // Normal distribution around target ±tolerance, with ~3% chance of a breach
        const breach = Math.random() < 0.03;
        let temp;
        if (breach) {
          temp = zone.max_temp + (0.5 + Math.random() * 2.5);
          alerts++;
        } else {
          temp = target + (Math.random() - 0.5) * 2 * tolerance * 0.7;
        }
        temp = Math.round(temp * 10) / 10;
        const isAlert = (temp < zone.min_temp - 0.3 || temp > zone.max_temp + 0.3) ? 1 : 0;
        const operator = staff[Math.floor(Math.random() * staff.length)].name;
        insertTempLog.run(zone.id, temp, ownerId, ts.toISOString().replace('T', ' ').slice(0, 19), isAlert, operator, RID);
        total++;
      }
    }
  }
  return { total, alerts };
});
const { total: logTotal, alerts: logAlerts } = seedTempLogs();
log(`${logTotal} temperature readings across ${allZones.length} zones (${logAlerts} alerts)`);

// ─── 7. Cleaning logs (last 14 days) ───────────────────────────────────────
section('Cleaning logs (14 days)');
const cleaningTasks = all('SELECT id, frequency FROM cleaning_tasks WHERE restaurant_id = ?', [RID]);
const insertCleanLog = db.prepare(
  `INSERT INTO cleaning_logs (task_id, completed_by, completed_at, notes, restaurant_id) VALUES (?, ?, ?, ?, ?)`
);
const seedCleanLogs = db.transaction(() => {
  const now = Date.now();
  let total = 0;
  for (const task of cleaningTasks) {
    const freq = task.frequency || 'daily';
    // daily = every day for 14 days; weekly = every 7 days; monthly = once
    const interval = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : 14;
    for (let d = 14; d >= 0; d -= interval) {
      const ts = new Date(now - d * 86400000);
      ts.setHours(22 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
      insertCleanLog.run(task.id, ownerId, ts.toISOString().replace('T', ' ').slice(0, 19), 'Fait conformément au plan', RID);
      total++;
    }
  }
  return total;
});
const cleanTotal = seedCleanLogs();
log(`${cleanTotal} cleaning executions across ${cleaningTasks.length} tasks`);

// ─── 8. Traceability: 5 recent deliveries ──────────────────────────────────
section('Traceability (5 entries)');
const tracEntries = [
  { product: 'Entrecôte de bœuf (origine France)', supplier: 'Bigard Boucherie Pro', batch: 'BG-2026-0412', daysAgo: 3, dlc: 5, temp: 2.8, qty: 6, unit: 'kg', notes: 'Lot conforme, chaîne du froid respectée.' },
  { product: 'Saumon frais Norvège', supplier: 'Marée du Jour', batch: 'MJ-SAUM-0416', daysAgo: 2, dlc: 3, temp: 1.6, qty: 4.5, unit: 'kg', notes: 'Emballage sous glace, aspect parfait.' },
  { product: 'Pommes de terre bintje', supplier: 'Pomona TerreAzur', batch: 'PTA-BT-0411', daysAgo: 5, dlc: 14, temp: 8.0, qty: 25, unit: 'kg', notes: 'Livraison en cageots, pas de germination.' },
  { product: 'Œufs fermiers plein air', supplier: 'Pomona TerreAzur', batch: 'PTA-OE-0417', daysAgo: 1, dlc: 21, temp: 6.5, qty: 120, unit: 'pièce', notes: 'Calibre M, catégorie A.' },
  { product: 'Crème liquide 35% MG', supplier: 'Metro Paris Nation', batch: 'MET-CR-0415', daysAgo: 4, dlc: 18, temp: 3.2, qty: 5, unit: 'l', notes: 'Bon état, scellés intacts.' },
];
const insertTrac = db.prepare(
  `INSERT INTO traceability_logs (product_name, supplier, batch_number, dlc, temperature_at_reception, quantity, unit, received_by, received_at, notes, etat_emballage, conformite_organoleptique, numero_bl, restaurant_id)
   VALUES (?, ?, ?, date('now', ?), ?, ?, ?, ?, datetime('now', ?), ?, 'intact', 'conforme', ?, ?)`
);
for (const t of tracEntries) {
  insertTrac.run(
    t.product, t.supplier, t.batch,
    `+${t.dlc} days`,
    t.temp, t.qty, t.unit, ownerId,
    `-${t.daysAgo} days`,
    t.notes, `BL-${t.batch}`, RID
  );
}
log(`${tracEntries.length} traceability entries`);

// ─── 9. HACCP plan — ensure 3 CCPs are scoped to this restaurant ───────────
section('HACCP plan');
// The boot seed inserts default haccp_hazard_analysis and 3 haccp_ccp rows
// without restaurant_id; Phase 2 backfilled them to RID=1. Confirm and log.
const ccpCount = get('SELECT COUNT(*) as c FROM haccp_ccp WHERE restaurant_id = ?', [RID]);
const hazardCount = get('SELECT COUNT(*) as c FROM haccp_hazard_analysis WHERE restaurant_id = ?', [RID]);
log(`${hazardCount.c} dangers analysés, ${ccpCount.c} CCP (étape critique) en place`);

// ─── 10. Alto AI preferences ───────────────────────────────────────────────
section('Alto AI preferences');
const aiPrefs = [
  { key: 'establishment_type', value: 'brasserie' },
  { key: 'tone',               value: 'tu' },
  { key: 'cuisine_style',      value: 'française traditionnelle' },
  { key: 'covers_target',      value: '45' },
  { key: 'service_hours',      value: '11:30-14:30, 19:00-23:00' },
];
const insertPref = db.prepare(
  `INSERT OR IGNORE INTO ai_preferences (restaurant_id, account_id, pref_key, pref_value) VALUES (?, ?, ?, ?)`
);
for (const p of aiPrefs) {
  insertPref.run(RID, ownerId, p.key, p.value);
}
log(`${aiPrefs.length} préférences Alto`);

// ─── Done ──────────────────────────────────────────────────────────────────
console.log(`
✅ Demo seed complete for "Chez Laurent — Paris 11" (restaurant_id=${RID}).

   Login:
     Gérant    → ${OWNER_EMAIL}   /  ${OWNER_PASSWORD}
     Cuisinier → Thomas Moreau    PIN 1234
     Équipier  → Julie Dubois     PIN 5678
     Salle     → Marc Bernard     PIN 9012
`);
