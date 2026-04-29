#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Demo seed — DEV / SALES ONLY. Populates a fresh DB with a fully-fledged
// Parisian bistrot ("Le Comptoir du Marché — Paris 15"), 6 staff members
// with shifts for this week, 3 suppliers, 85 ingredients, 15 recipes + 3
// sub-recipes (fond de veau / sauce béarnaise / crème anglaise), 2 weeks of
// service history (orders, covers, service sessions), supplier orders +
// delivery notes + invoices, HACCP temperature/cleaning/traceability data,
// and 3 message threads with suppliers.
//
//   FAKE ACCOUNTS CREATED (NEVER ship these to real users):
//     • Gérant:      demo@restosuite.fr            / Demo2026!
//     • Fournisseur: demo-fournisseur@restosuite.fr / Demo2026!  (PIN 1111)
//     • Extra restos: Le Bistrot de Marie, Sakura
//
//   Run manually:
//     npm run seed:demo                              # from /server
//     SEED_DEMO=true node server/seed-demo.js        # required if NODE_ENV=production
//
// Idempotent: re-running is a no-op once the demo owner exists. Every
// "ensure*" helper DELETE-then-INSERTs its own scoped rows so re-runs
// refresh catalogs/orders/messages/extras even on an already-seeded DB.
// Never wire this into server boot.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Production guard ──────────────────────────────────────────────────────
// Refuses to touch a production DB by default. Real users must never see
// "Le Comptoir du Marché" / "demo@restosuite.fr" in their account list. To
// run against a prod-shaped environment intentionally (e.g. seeding a
// staging Render instance), set SEED_DEMO=true.
if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') {
  console.error('✗ Refusing to seed demo data: NODE_ENV=production.');
  console.error('  This script creates fake restaurants and supplier accounts');
  console.error('  (demo@restosuite.fr, Le Comptoir du Marché, etc.) — never run');
  console.error('  it against a real production database.');
  console.error('  Override with SEED_DEMO=true if you really mean it.');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const { db, get, run, all } = require('./db');

const RID = 1;
const OWNER_EMAIL = 'demo@restosuite.fr';
const OWNER_PASSWORD = 'Demo2026!';

const SUPPLIER_DEMO_EMAIL = 'demo-fournisseur@restosuite.fr';
const SUPPLIER_DEMO_PASSWORD = 'Demo2026!';
const SUPPLIER_DEMO_PIN = '1111';

function log(msg) { console.log(`  ${msg}`); }
function section(title) { console.log(`\n▸ ${title}`); }
function pad2(n) { return String(n).padStart(2, '0'); }
function sqlDateTime(d) { return d.toISOString().replace('T', ' ').slice(0, 19); }
function sqlDate(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n, hour = 9, minute = 0) {
  const d = new Date(Date.now() - n * 86_400_000);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── Supplier catalog demo data (3 suppliers) ──────────────────────────────
// Metro Paris Nation: generalist wholesaler — épicerie/produits secs +
// boissons + condiments (~50 products).
// PassionFroid: cold-chain + surgelés specialist — viandes premium,
// poissons frais, frites surgelées (~25 products).
// TerreAzur: fruits & légumes specialist — légumes du jour, herbes,
// fruits de saison (~30 products).
//
// SKU convention: <2-3 letter supplier>-<3-letter cat>-<NNN>. tva_rate=5.5
// for foodstuffs (default), 20 for alcohol. Categories use the 13-bucket
// scheme from server/lib/mercuriale-categorize.js.
const SUPPLIER_CATALOG_DATA = {
  'Metro Paris Nation': [
    // Viandes
    { sku: 'MET-VIA-001', name: 'Entrecôte de bœuf',     category: 'Viandes', unit: 'kg', price: 18.90, tva_rate: 5.5, packaging: 'Sous vide 2 pièces ~500g' },
    { sku: 'MET-VIA-002', name: 'Filet de poulet',       category: 'Viandes', unit: 'kg', price: 8.50,  tva_rate: 5.5, packaging: 'Barquette 2.5 kg' },
    { sku: 'MET-VIA-003', name: 'Bavette d\'aloyau',     category: 'Viandes', unit: 'kg', price: 16.50, tva_rate: 5.5, packaging: 'Sous vide 1.5 kg' },
    { sku: 'MET-VIA-004', name: 'Steak haché 15% MG',    category: 'Viandes', unit: 'kg', price: 9.80,  tva_rate: 5.5, packaging: 'Carton 5 kg (50×100g)' },
    { sku: 'MET-VIA-005', name: 'Magret de canard',      category: 'Viandes', unit: 'kg', price: 19.50, tva_rate: 5.5, packaging: 'Sous vide 2 pièces ~700g' },
    { sku: 'MET-VIA-006', name: 'Saucisse de Toulouse',  category: 'Viandes', unit: 'kg', price: 7.90,  tva_rate: 5.5, packaging: 'Barquette 1 kg' },
    // Charcuterie
    { sku: 'MET-CHA-001', name: 'Lardons fumés',         category: 'Charcuterie', unit: 'kg', price: 6.50,  tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    { sku: 'MET-CHA-002', name: 'Jambon de Paris',       category: 'Charcuterie', unit: 'kg', price: 9.80,  tva_rate: 5.5, packaging: 'Bloc sous vide ~2 kg' },
    { sku: 'MET-CHA-003', name: 'Saucisson sec',         category: 'Charcuterie', unit: 'kg', price: 18.50, tva_rate: 5.5, packaging: 'Lot de 4 pièces ~250g' },
    // Poissons d'appoint
    { sku: 'MET-POI-001', name: 'Filet de saumon',       category: 'Poissons', unit: 'kg', price: 19.00, tva_rate: 5.5, packaging: 'Caisse 2 kg' },
    { sku: 'MET-POI-002', name: 'Cabillaud',             category: 'Poissons', unit: 'kg', price: 15.50, tva_rate: 5.5, packaging: 'Caisse 3 kg sur glace' },
    { sku: 'MET-POI-003', name: 'Crevettes roses cuites', category: 'Poissons', unit: 'kg', price: 14.90, tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    // Légumes
    { sku: 'MET-LEG-001', name: 'Pommes de terre',       category: 'Légumes', unit: 'kg', price: 1.20, tva_rate: 5.5, packaging: 'Sac 25 kg' },
    { sku: 'MET-LEG-002', name: 'Carottes',              category: 'Légumes', unit: 'kg', price: 1.50, tva_rate: 5.5, packaging: 'Sac 10 kg' },
    { sku: 'MET-LEG-003', name: 'Oignons jaunes',        category: 'Légumes', unit: 'kg', price: 1.80, tva_rate: 5.5, packaging: 'Filet 5 kg' },
    { sku: 'MET-LEG-004', name: 'Tomates grappe',        category: 'Légumes', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Cagette 6 kg' },
    { sku: 'MET-LEG-005', name: 'Champignons de Paris',  category: 'Légumes', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Barquette 500g' },
    { sku: 'MET-LEG-006', name: 'Ail',                   category: 'Légumes', unit: 'kg', price: 6.00, tva_rate: 5.5, packaging: 'Filet 1 kg' },
    // Fruits
    { sku: 'MET-FRU-001', name: 'Citrons',               category: 'Fruits', unit: 'kg', price: 2.80, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'MET-FRU-002', name: 'Pommes Golden',         category: 'Fruits', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Cagette 7 kg' },
    // Produits laitiers
    { sku: 'MET-LAI-001', name: 'Beurre doux',           category: 'Produits laitiers', unit: 'kg', price: 8.50,  tva_rate: 5.5, packaging: 'Plaque 5 kg' },
    { sku: 'MET-LAI-002', name: 'Crème fraîche 35%',     category: 'Produits laitiers', unit: 'L',  price: 4.20,  tva_rate: 5.5, packaging: 'Bidon 5 L' },
    { sku: 'MET-LAI-003', name: 'Lait entier',           category: 'Produits laitiers', unit: 'L',  price: 1.10,  tva_rate: 5.5, packaging: 'Brique 1 L x12' },
    { sku: 'MET-LAI-004', name: 'Parmesan Reggiano',     category: 'Produits laitiers', unit: 'kg', price: 22.00, tva_rate: 5.5, packaging: 'Pointe 1 kg sous vide' },
    { sku: 'MET-LAI-005', name: 'Gruyère râpé',          category: 'Produits laitiers', unit: 'kg', price: 9.50,  tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    { sku: 'MET-LAI-006', name: 'Œufs plein air x30',    category: 'Produits laitiers', unit: 'plateau', price: 8.50, tva_rate: 5.5, packaging: 'Plateau 30 œufs' },
    { sku: 'MET-LAI-007', name: 'Mascarpone',            category: 'Produits laitiers', unit: 'kg', price: 7.80,  tva_rate: 5.5, packaging: 'Pot 1 kg' },
    // Boulangerie
    { sku: 'MET-BLG-001', name: 'Farine T55',            category: 'Boulangerie', unit: 'kg', price: 0.90, tva_rate: 5.5, packaging: 'Sac 25 kg' },
    { sku: 'MET-BLG-002', name: 'Pain de mie tranché',   category: 'Boulangerie', unit: 'pièce', price: 2.80, tva_rate: 5.5, packaging: 'Sachet 750g' },
    { sku: 'MET-BLG-003', name: 'Brioche tranchée',      category: 'Boulangerie', unit: 'pièce', price: 4.20, tva_rate: 5.5, packaging: 'Sachet 500g' },
    // Huiles/Vinaigres
    { sku: 'MET-HUI-001', name: 'Huile d\'olive vierge extra', category: 'Huiles/Vinaigres', unit: 'L', price: 6.50, tva_rate: 5.5, packaging: 'Bidon 5 L' },
    { sku: 'MET-HUI-002', name: 'Vinaigre balsamique',   category: 'Huiles/Vinaigres', unit: 'L', price: 4.80, tva_rate: 5.5, packaging: 'Bidon 1 L' },
    // Condiments/Sauces
    { sku: 'MET-CDM-001', name: 'Sel de Guérande',       category: 'Condiments/Sauces', unit: 'kg', price: 3.50,  tva_rate: 5.5, packaging: 'Sac 1 kg' },
    { sku: 'MET-CDM-002', name: 'Poivre noir moulu',     category: 'Condiments/Sauces', unit: 'kg', price: 28.00, tva_rate: 5.5, packaging: 'Sachet 250g x4' },
    { sku: 'MET-CDM-003', name: 'Moutarde de Dijon',     category: 'Condiments/Sauces', unit: 'kg', price: 3.20,  tva_rate: 5.5, packaging: 'Pot 1 kg' },
    { sku: 'MET-CDM-004', name: 'Concentré de tomate',   category: 'Condiments/Sauces', unit: 'kg', price: 2.80,  tva_rate: 5.5, packaging: 'Boîte 5/1 (4.25 kg)' },
    { sku: 'MET-CDM-005', name: 'Fond de veau',          category: 'Condiments/Sauces', unit: 'L',  price: 12.00, tva_rate: 5.5, packaging: 'Bidon 2 L' },
    { sku: 'MET-CDM-006', name: 'Bouillon de volaille',  category: 'Condiments/Sauces', unit: 'kg', price: 8.50,  tva_rate: 5.5, packaging: 'Boîte poudre 1 kg' },
    // Épicerie sèche
    { sku: 'MET-EPI-001', name: 'Sucre semoule',         category: 'Épicerie sèche', unit: 'kg', price: 1.10, tva_rate: 5.5, packaging: 'Sac 25 kg' },
    { sku: 'MET-EPI-002', name: 'Pâtes penne',           category: 'Épicerie sèche', unit: 'kg', price: 1.50, tva_rate: 5.5, packaging: 'Carton 5 kg' },
    { sku: 'MET-EPI-003', name: 'Riz arborio',           category: 'Épicerie sèche', unit: 'kg', price: 3.80, tva_rate: 5.5, packaging: 'Sac 5 kg' },
    { sku: 'MET-EPI-004', name: 'Lentilles vertes',      category: 'Épicerie sèche', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Sac 5 kg du Puy' },
    { sku: 'MET-EPI-005', name: 'Chocolat noir 70%',     category: 'Épicerie sèche', unit: 'kg', price: 14.00, tva_rate: 5.5, packaging: 'Pistoles 5 kg' },
    { sku: 'MET-EPI-006', name: 'Gousses de vanille',    category: 'Épicerie sèche', unit: 'pièce', price: 2.80, tva_rate: 5.5, packaging: 'Tube 25 pièces' },
    // Boissons (non-alcool)
    { sku: 'MET-BOI-001', name: 'Eau Évian 1.5L x6',     category: 'Boissons', unit: 'lot', price: 4.50, tva_rate: 5.5, packaging: 'Pack 6 bouteilles 1.5 L' },
    { sku: 'MET-BOI-002', name: 'Coca-Cola 33cl x24',    category: 'Boissons', unit: 'lot', price: 18.00, tva_rate: 5.5, packaging: 'Pack 24 canettes 33 cl' },
    { sku: 'MET-BOI-003', name: 'Café arabica 1kg',      category: 'Boissons', unit: 'kg', price: 24.00, tva_rate: 5.5, packaging: 'Sachet 1 kg moulu' },
    // Vins (TVA 20%)
    { sku: 'MET-VIN-001', name: 'Côtes du Rhône rouge 75cl', category: 'Boissons', unit: 'bouteille', price: 5.50, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'MET-VIN-002', name: 'Bordeaux supérieur 75cl',   category: 'Boissons', unit: 'bouteille', price: 7.20, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'MET-VIN-003', name: 'Sancerre blanc 75cl',       category: 'Boissons', unit: 'bouteille', price: 13.50, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'MET-VIN-004', name: 'Champagne brut 75cl',       category: 'Boissons', unit: 'bouteille', price: 22.00, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
  ],

  'PassionFroid': [
    // Viandes premium (cold chain)
    { sku: 'PF-VIA-001', name: 'Onglet de bœuf',         category: 'Viandes', unit: 'kg', price: 21.50, tva_rate: 5.5, packaging: 'Sous vide 1.2 kg' },
    { sku: 'PF-VIA-002', name: 'Filet mignon de porc',   category: 'Viandes', unit: 'kg', price: 14.50, tva_rate: 5.5, packaging: 'Sous vide 1 kg' },
    { sku: 'PF-VIA-003', name: 'Suprême de volaille fermier', category: 'Viandes', unit: 'kg', price: 12.50, tva_rate: 5.5, packaging: 'Barquette 2 kg' },
    { sku: 'PF-VIA-004', name: 'Cuisse de canard confite', category: 'Viandes', unit: 'pièce', price: 4.20, tva_rate: 5.5, packaging: 'Boîte 8 cuisses' },
    { sku: 'PF-VIA-005', name: 'Joue de bœuf',           category: 'Viandes', unit: 'kg', price: 13.80, tva_rate: 5.5, packaging: 'Sous vide 1.5 kg' },
    // Charcuterie premium
    { sku: 'PF-CHA-001', name: 'Pâté de campagne maison', category: 'Charcuterie', unit: 'kg', price: 14.50, tva_rate: 5.5, packaging: 'Terrine 1 kg' },
    { sku: 'PF-CHA-002', name: 'Foie gras de canard mi-cuit', category: 'Charcuterie', unit: 'kg', price: 65.00, tva_rate: 5.5, packaging: 'Lobe 500g' },
    { sku: 'PF-CHA-003', name: 'Chorizo doux',           category: 'Charcuterie', unit: 'kg', price: 16.80, tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    // Poissons frais
    { sku: 'PF-POI-001', name: 'Pavé de saumon Norvège', category: 'Poissons', unit: 'kg', price: 22.00, tva_rate: 5.5, packaging: 'Caisse 2 kg sur glace' },
    { sku: 'PF-POI-002', name: 'Saumon extra-frais sashimi', category: 'Poissons', unit: 'kg', price: 32.00, tva_rate: 5.5, packaging: 'Pavé sous vide 1 kg' },
    { sku: 'PF-POI-003', name: 'Dorade royale entière',  category: 'Poissons', unit: 'kg', price: 18.50, tva_rate: 5.5, packaging: 'Caisse 4 kg' },
    { sku: 'PF-POI-004', name: 'Lieu jaune en filet',    category: 'Poissons', unit: 'kg', price: 16.00, tva_rate: 5.5, packaging: 'Caisse 2 kg' },
    { sku: 'PF-POI-005', name: 'Noix de Saint-Jacques',  category: 'Poissons', unit: 'kg', price: 38.00, tva_rate: 5.5, packaging: 'Barquette 500g' },
    { sku: 'PF-POI-006', name: 'Gambas',                 category: 'Poissons', unit: 'kg', price: 22.00, tva_rate: 5.5, packaging: 'Boîte 2 kg surgelé' },
    { sku: 'PF-POI-007', name: 'Moules de bouchot AOP',  category: 'Poissons', unit: 'kg', price: 4.50,  tva_rate: 5.5, packaging: 'Sac 4 kg' },
    // Produits laitiers premium
    { sku: 'PF-LAI-001', name: 'Beurre AOP Charentes',   category: 'Produits laitiers', unit: 'kg', price: 12.00, tva_rate: 5.5, packaging: 'Plaque 5 kg' },
    { sku: 'PF-LAI-002', name: 'Crème liquide 35% MG',   category: 'Produits laitiers', unit: 'L',  price: 5.20,  tva_rate: 5.5, packaging: 'Bidon 5 L' },
    { sku: 'PF-LAI-003', name: 'Crème fraîche épaisse',  category: 'Produits laitiers', unit: 'kg', price: 6.20,  tva_rate: 5.5, packaging: 'Pot 1 kg' },
    { sku: 'PF-LAI-004', name: 'Mozzarella di bufala',   category: 'Produits laitiers', unit: 'kg', price: 18.00, tva_rate: 5.5, packaging: 'Boules 200g x6' },
    { sku: 'PF-LAI-005', name: 'Œufs fermiers plein air x30', category: 'Produits laitiers', unit: 'plateau', price: 9.20, tva_rate: 5.5, packaging: 'Plateau 30 œufs label rouge' },
    // Surgelés
    { sku: 'PF-SUR-001', name: 'Frites tradition surgelées', category: 'Surgelés', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Carton 10 kg' },
    { sku: 'PF-SUR-002', name: 'Petits pois surgelés',   category: 'Surgelés', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Carton 2.5 kg' },
    { sku: 'PF-SUR-003', name: 'Pommes dauphines',       category: 'Surgelés', unit: 'kg', price: 3.80, tva_rate: 5.5, packaging: 'Carton 5 kg' },
    { sku: 'PF-SUR-004', name: 'Glace vanille 5L',       category: 'Surgelés', unit: 'L',  price: 8.50, tva_rate: 5.5, packaging: 'Bac 5 L' },
    { sku: 'PF-SUR-005', name: 'Sorbet citron 5L',       category: 'Surgelés', unit: 'L',  price: 9.20, tva_rate: 5.5, packaging: 'Bac 5 L' },
  ],

  'TerreAzur': [
    // Légumes
    { sku: 'TA-LEG-001', name: 'Pommes de terre Bintje',    category: 'Légumes', unit: 'kg', price: 1.10, tva_rate: 5.5, packaging: 'Sac 25 kg' },
    { sku: 'TA-LEG-002', name: 'Carottes nouvelles',        category: 'Légumes', unit: 'kg', price: 1.40, tva_rate: 5.5, packaging: 'Cagette 10 kg' },
    { sku: 'TA-LEG-003', name: 'Oignons rosés de Roscoff',  category: 'Légumes', unit: 'kg', price: 2.20, tva_rate: 5.5, packaging: 'Filet 5 kg AOP' },
    { sku: 'TA-LEG-004', name: 'Tomates anciennes',         category: 'Légumes', unit: 'kg', price: 4.80, tva_rate: 5.5, packaging: 'Cagette 4 kg variétés' },
    { sku: 'TA-LEG-005', name: 'Courgettes vertes',         category: 'Légumes', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'TA-LEG-006', name: 'Haricots verts extra-fins', category: 'Légumes', unit: 'kg', price: 5.50, tva_rate: 5.5, packaging: 'Cagette 3 kg' },
    { sku: 'TA-LEG-007', name: 'Champignons de Paris bruns', category: 'Légumes', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Barquette 500g' },
    { sku: 'TA-LEG-008', name: 'Poireaux nouveaux',         category: 'Légumes', unit: 'kg', price: 2.20, tva_rate: 5.5, packaging: 'Botte 1 kg' },
    { sku: 'TA-LEG-009', name: 'Épinards branches',         category: 'Légumes', unit: 'kg', price: 5.00, tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    { sku: 'TA-LEG-010', name: 'Ail rose de Lautrec',       category: 'Légumes', unit: 'kg', price: 8.00, tva_rate: 5.5, packaging: 'Tresse 1 kg IGP' },
    { sku: 'TA-LEG-011', name: 'Endives belges',            category: 'Légumes', unit: 'kg', price: 2.80, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'TA-LEG-012', name: 'Aubergines',                category: 'Légumes', unit: 'kg', price: 2.40, tva_rate: 5.5, packaging: 'Cagette 6 kg' },
    { sku: 'TA-LEG-013', name: 'Poivrons rouges',           category: 'Légumes', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'TA-LEG-014', name: 'Fenouil',                   category: 'Légumes', unit: 'kg', price: 3.00, tva_rate: 5.5, packaging: 'Cagette 8 kg' },
    { sku: 'TA-LEG-015', name: 'Salade laitue batavia',     category: 'Légumes', unit: 'pièce', price: 1.10, tva_rate: 5.5, packaging: 'Pièce ~400g' },
    { sku: 'TA-LEG-016', name: 'Roquette',                  category: 'Légumes', unit: 'kg', price: 8.50, tva_rate: 5.5, packaging: 'Sachet 500g lavé' },
    { sku: 'TA-LEG-017', name: 'Cèpes frais',               category: 'Légumes', unit: 'kg', price: 38.00, tva_rate: 5.5, packaging: 'Cagette 1 kg saison' },
    { sku: 'TA-LEG-018', name: 'Échalotes grises',          category: 'Légumes', unit: 'kg', price: 5.50, tva_rate: 5.5, packaging: 'Filet 5 kg' },
    // Herbes
    { sku: 'TA-HER-001', name: 'Persil plat (botte)',       category: 'Légumes', unit: 'botte', price: 0.80, tva_rate: 5.5, packaging: 'Botte ~80g' },
    { sku: 'TA-HER-002', name: 'Basilic frais (botte)',     category: 'Légumes', unit: 'botte', price: 1.20, tva_rate: 5.5, packaging: 'Botte ~50g' },
    { sku: 'TA-HER-003', name: 'Ciboulette (botte)',        category: 'Légumes', unit: 'botte', price: 1.00, tva_rate: 5.5, packaging: 'Botte ~50g' },
    { sku: 'TA-HER-004', name: 'Thym frais (botte)',        category: 'Légumes', unit: 'botte', price: 1.50, tva_rate: 5.5, packaging: 'Botte ~30g' },
    { sku: 'TA-HER-005', name: 'Estragon frais (botte)',    category: 'Légumes', unit: 'botte', price: 1.80, tva_rate: 5.5, packaging: 'Botte ~30g' },
    // Fruits
    { sku: 'TA-FRU-001', name: 'Citrons primofiori',        category: 'Fruits', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'TA-FRU-002', name: 'Pommes Golden',             category: 'Fruits', unit: 'kg', price: 2.40, tva_rate: 5.5, packaging: 'Cagette 7 kg' },
    { sku: 'TA-FRU-003', name: 'Poires Williams',           category: 'Fruits', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Cagette 6 kg' },
    { sku: 'TA-FRU-004', name: 'Fraises gariguette',        category: 'Fruits', unit: 'kg', price: 9.50, tva_rate: 5.5, packaging: 'Barquette 500g x6' },
    { sku: 'TA-FRU-005', name: 'Framboises',                category: 'Fruits', unit: 'kg', price: 17.50, tva_rate: 5.5, packaging: 'Barquette 125g x12' },
    { sku: 'TA-FRU-006', name: 'Oranges',                   category: 'Fruits', unit: 'kg', price: 2.20, tva_rate: 5.5, packaging: 'Cagette 10 kg' },
    { sku: 'TA-FRU-007', name: 'Mangues',                   category: 'Fruits', unit: 'kg', price: 4.20, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
  ],
};

// ─── Demo purchase orders for Le Comptoir → 3 suppliers (last 14 days) ────
// 8 orders spread across Metro / PassionFroid / TerreAzur. Items reference
// catalog products by NAME (no FK) so the /stats LEFT JOIN by product_name
// still resolves the category bucket. References prefixed DEMO-PO- so we
// can DELETE-then-INSERT on every re-seed without touching real data.
const DEMO_ORDER_REFS_PREFIX = 'DEMO-PO-';
const _DEMO_ORDER_RECIPES = [
  { supplier: 'Metro Paris Nation', daysAgoCreated: 13, items: [
      { name: 'Pommes de terre',     qty: 25, unit: 'kg', price: 1.20 },
      { name: 'Riz arborio',         qty: 5,  unit: 'kg', price: 3.80 },
      { name: 'Pâtes penne',         qty: 4,  unit: 'kg', price: 1.50 },
      { name: 'Farine T55',          qty: 5,  unit: 'kg', price: 0.90 },
      { name: 'Huile d\'olive vierge extra', qty: 2, unit: 'L', price: 6.50 },
      { name: 'Sel de Guérande',     qty: 1,  unit: 'kg', price: 3.50 },
    ] },
  { supplier: 'TerreAzur', daysAgoCreated: 12, items: [
      { name: 'Pommes de terre Bintje', qty: 20, unit: 'kg', price: 1.10 },
      { name: 'Carottes nouvelles',     qty: 8,  unit: 'kg', price: 1.40 },
      { name: 'Oignons rosés de Roscoff', qty: 5, unit: 'kg', price: 2.20 },
      { name: 'Tomates anciennes',      qty: 4,  unit: 'kg', price: 4.80 },
      { name: 'Persil plat (botte)',    qty: 5,  unit: 'botte', price: 0.80 },
    ] },
  { supplier: 'PassionFroid', daysAgoCreated: 10, items: [
      { name: 'Pavé de saumon Norvège',     qty: 5, unit: 'kg', price: 22.00 },
      { name: 'Beurre AOP Charentes',       qty: 4, unit: 'kg', price: 12.00 },
      { name: 'Crème liquide 35% MG',       qty: 5, unit: 'L',  price: 5.20 },
      { name: 'Œufs fermiers plein air x30', qty: 4, unit: 'plateau', price: 9.20 },
      { name: 'Frites tradition surgelées', qty: 10, unit: 'kg', price: 2.50 },
    ] },
  { supplier: 'Metro Paris Nation', daysAgoCreated: 8, items: [
      { name: 'Bordeaux supérieur 75cl', qty: 12, unit: 'bouteille', price: 7.20 },
      { name: 'Sancerre blanc 75cl',     qty: 6,  unit: 'bouteille', price: 13.50 },
      { name: 'Café arabica 1kg',        qty: 3,  unit: 'kg', price: 24.00 },
      { name: 'Eau Évian 1.5L x6',       qty: 4,  unit: 'lot', price: 4.50 },
    ] },
  { supplier: 'TerreAzur', daysAgoCreated: 6, items: [
      { name: 'Cèpes frais',            qty: 2,  unit: 'kg', price: 38.00 },
      { name: 'Champignons de Paris bruns', qty: 3, unit: 'kg', price: 3.50 },
      { name: 'Salade laitue batavia',  qty: 12, unit: 'pièce', price: 1.10 },
      { name: 'Citrons primofiori',     qty: 4,  unit: 'kg', price: 2.50 },
      { name: 'Estragon frais (botte)', qty: 3,  unit: 'botte', price: 1.80 },
    ] },
  { supplier: 'PassionFroid', daysAgoCreated: 4, items: [
      { name: 'Onglet de bœuf',                qty: 4, unit: 'kg', price: 21.50 },
      { name: 'Suprême de volaille fermier',   qty: 5, unit: 'kg', price: 12.50 },
      { name: 'Cuisse de canard confite',      qty: 12, unit: 'pièce', price: 4.20 },
      { name: 'Foie gras de canard mi-cuit',   qty: 1, unit: 'kg', price: 65.00 },
    ] },
  { supplier: 'Metro Paris Nation', daysAgoCreated: 2, items: [
      { name: 'Steak haché 15% MG',  qty: 8, unit: 'kg', price: 9.80 },
      { name: 'Lardons fumés',       qty: 2, unit: 'kg', price: 6.50 },
      { name: 'Pain de mie tranché', qty: 6, unit: 'pièce', price: 2.80 },
      { name: 'Mascarpone',          qty: 2, unit: 'kg', price: 7.80 },
    ] },
  { supplier: 'Metro Paris Nation', daysAgoCreated: 1, items: [
      { name: 'Chocolat noir 70%',   qty: 3, unit: 'kg', price: 14.00 },
      { name: 'Sucre semoule',       qty: 5, unit: 'kg', price: 1.10 },
      { name: 'Gousses de vanille',  qty: 6, unit: 'pièce', price: 2.80 },
      { name: 'Crème fraîche 35%',   qty: 3, unit: 'L', price: 4.20 },
    ] },
];

function _orderStatusByAge(daysAgoCreated, idx, total) {
  if (idx === total - 1) return 'brouillon';                 // newest → draft
  if (daysAgoCreated <= 2) return 'envoyée';                 // recent awaiting confirmation
  return 'livrée';                                            // older delivered
}

const _DEMO_ORDER_NOTES = [
  null,
  'Livraison souhaitée avant 10h',
  'Merci de confirmer la dispo du saumon',
  'Commande hebdomadaire habituelle',
  'Service midi, livraison avant 11h impérative',
  'Préciser DLC sur le bon SVP',
  'Glace requise pour les produits frais',
  'RAS, commande standard',
  'Réception par chef Thomas, merci',
  'Bons frais SVP, weekend chargé',
  null,
  'Carton entier seulement, merci',
];
function _demoNoteFor(idx) {
  return _DEMO_ORDER_NOTES[idx % _DEMO_ORDER_NOTES.length];
}

// ─── Extra demo restaurants (Marie + Sakura) ──────────────────────────────
// Each becomes its own tenant (separate restaurant_id) with its own Metro
// suppliers row sharing the demo email so the supplier portal's
// getSupplierIdentities() (email-based) groups them under the same vendor
// for read-only views.
const EXTRA_DEMO_RESTAURANTS = [
  {
    id: 2,
    name: 'Le Bistrot de Marie - Paris 6',
    type: 'bistrot',
    address: '18 rue de Buci',
    city: 'Paris',
    postal_code: '75006',
    phone: '01 43 26 00 00',
    covers: 40,
    siret: '23456789000123',
    plan: 'pro',
    owner_email: 'marie@bistrot-marie.fr',
    owner_name: 'Marie Lefèvre',
    owner_first: 'Marie',
    owner_last: 'Lefèvre',
    metro_supplier_account: { name: 'Marie Lefèvre', pin: '4242' },
  },
  {
    id: 3,
    name: 'Sakura - Paris 2',
    type: 'fusion',
    address: '24 rue Sainte-Anne',
    city: 'Paris',
    postal_code: '75002',
    phone: '01 42 60 80 80',
    covers: 30,
    siret: '34567890000123',
    plan: 'pro',
    owner_email: 'kenji@sakura-paris.fr',
    owner_name: 'Kenji Tanaka',
    owner_first: 'Kenji',
    owner_last: 'Tanaka',
    metro_supplier_account: { name: 'Kenji Tanaka', pin: '8888' },
  },
];

const _MARIE_ORDER_RECIPES = [
  { items: [
      { name: 'Bavette d\'aloyau', qty: 4, unit: 'kg', price: 16.50 },
      { name: 'Pommes de terre',   qty: 12, unit: 'kg', price: 1.20 },
      { name: 'Beurre doux',       qty: 1.5, unit: 'kg', price: 8.50 },
    ] },
  { items: [
      { name: 'Filet de poulet',     qty: 5, unit: 'kg', price: 8.50 },
      { name: 'Crème fraîche 35%',   qty: 2, unit: 'L', price: 4.20 },
      { name: 'Champignons de Paris', qty: 2, unit: 'kg', price: 3.20 },
      { name: 'Œufs plein air x30',  qty: 2, unit: 'plateau', price: 8.50 },
    ] },
  { items: [
      { name: 'Steak haché 15% MG', qty: 8, unit: 'kg', price: 9.80 },
      { name: 'Pain de mie tranché', qty: 6, unit: 'pièce', price: 2.80 },
      { name: 'Tomates grappe',     qty: 5, unit: 'kg', price: 3.50 },
    ] },
  { items: [
      { name: 'Magret de canard',   qty: 3, unit: 'kg', price: 19.50 },
      { name: 'Pommes Golden',      qty: 4, unit: 'kg', price: 2.50 },
      { name: 'Pommes de terre',    qty: 10, unit: 'kg', price: 1.20 },
    ] },
  { items: [
      { name: 'Saucisse de Toulouse', qty: 4, unit: 'kg', price: 7.90 },
      { name: 'Lentilles vertes',     qty: 3, unit: 'kg', price: 3.50 },
      { name: 'Carottes',             qty: 4, unit: 'kg', price: 1.50 },
    ] },
  { items: [
      { name: 'Cabillaud',           qty: 2, unit: 'kg', price: 15.50 },
      { name: 'Beurre doux',         qty: 2, unit: 'kg', price: 8.50 },
      { name: 'Citrons',             qty: 2, unit: 'kg', price: 2.80 },
    ] },
];
const _SAKURA_ORDER_RECIPES = [
  { items: [
      { name: 'Filet de saumon', qty: 6, unit: 'kg', price: 19.00 },
      { name: 'Riz arborio',     qty: 8, unit: 'kg', price: 3.80 },
      { name: 'Citrons',         qty: 2, unit: 'kg', price: 2.80 },
    ] },
  { items: [
      { name: 'Crevettes roses cuites', qty: 3, unit: 'kg', price: 14.90 },
      { name: 'Riz arborio',            qty: 6, unit: 'kg', price: 3.80 },
    ] },
  { items: [
      { name: 'Filet de poulet',           qty: 4, unit: 'kg', price: 8.50 },
      { name: 'Œufs plein air x30',        qty: 3, unit: 'plateau', price: 8.50 },
    ] },
];

const EXTRA_DEMO_REF_PREFIX = 'DEMO-PO-X-';

// ─── Idempotent ensure* helpers (run on every invocation, even re-seeds) ──

function ensureSupplierDemoLogin() {
  const metro = get(
    'SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?',
    ['Metro Paris Nation', RID]
  );
  if (!metro) return false;

  const hash = bcrypt.hashSync(SUPPLIER_DEMO_PASSWORD, 10);
  run(
    `UPDATE suppliers
        SET email = ?, password_hash = ?, contact_name = ?
      WHERE id = ? AND restaurant_id = ?`,
    [SUPPLIER_DEMO_EMAIL, hash, 'Jean Dupont (commercial Metro)', metro.id, RID]
  );

  const accountExists = get(
    'SELECT id FROM supplier_accounts WHERE supplier_id = ? AND email = ? AND restaurant_id = ?',
    [metro.id, SUPPLIER_DEMO_EMAIL, RID]
  );
  if (!accountExists) {
    const pinHash = bcrypt.hashSync(SUPPLIER_DEMO_PIN, 10);
    run(
      `INSERT INTO supplier_accounts (supplier_id, name, email, pin, restaurant_id)
       VALUES (?, ?, ?, ?, ?)`,
      [metro.id, 'Jean Dupont', SUPPLIER_DEMO_EMAIL, pinHash, RID]
    );
  }
  return true;
}

function ensureSupplierCatalogs() {
  let totalInserted = 0;
  let touchedSuppliers = 0;
  const insertCatalog = db.prepare(
    `INSERT INTO supplier_catalog
       (supplier_id, product_name, category, unit, price, sku, tva_rate, packaging, restaurant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const [supplierName, products] of Object.entries(SUPPLIER_CATALOG_DATA)) {
    const supplier = get(
      'SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?',
      [supplierName, RID]
    );
    if (!supplier) continue;
    const tx = db.transaction(() => {
      run(
        'DELETE FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ?',
        [supplier.id, RID]
      );
      for (const p of products) {
        insertCatalog.run(
          supplier.id, p.name, p.category, p.unit, p.price,
          p.sku || null,
          p.tva_rate != null ? p.tva_rate : 5.5,
          p.packaging || null,
          RID
        );
      }
    });
    tx();
    totalInserted += products.length;
    touchedSuppliers++;
  }
  return { totalInserted, touchedSuppliers };
}

function ensureExtraDemoRestaurants() {
  const summary = { restaurants: 0, marie_orders: 0, sakura_orders: 0 };

  for (const r of EXTRA_DEMO_RESTAURANTS) {
    const existing = get('SELECT id FROM restaurants WHERE id = ?', [r.id]);
    if (existing) {
      run(
        `UPDATE restaurants SET
           name = ?, type = ?, address = ?, city = ?, postal_code = ?,
           phone = ?, covers = ?, siret = ?, plan = ?
         WHERE id = ?`,
        [r.name, r.type, r.address, r.city, r.postal_code, r.phone, r.covers, r.siret, r.plan, r.id]
      );
    } else {
      run(
        `INSERT INTO restaurants (id, name, type, address, city, postal_code, phone, covers, siret, plan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.name, r.type, r.address, r.city, r.postal_code, r.phone, r.covers, r.siret, r.plan]
      );
    }
    summary.restaurants++;

    const ownerExists = get('SELECT id FROM accounts WHERE email = ?', [r.owner_email]);
    if (!ownerExists) {
      const ownerHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
      const ownerPerms = JSON.stringify({
        view_recipes: true, view_costs: true, edit_recipes: true,
        view_suppliers: true, export_pdf: true,
      });
      run(
        `INSERT INTO accounts (name, pin, role, permissions, email, password_hash, first_name, last_name, restaurant_id, onboarding_step, is_owner, trial_start)
         VALUES (?, NULL, 'gerant', ?, ?, ?, ?, ?, ?, 10, 1, datetime('now'))`,
        [r.owner_name, ownerPerms, r.owner_email, ownerHash, r.owner_first, r.owner_last, r.id]
      );
    }

    let metroRow = get(
      'SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?',
      ['Metro Paris Nation', r.id]
    );
    if (!metroRow) {
      const metroHash = bcrypt.hashSync(SUPPLIER_DEMO_PASSWORD, 10);
      const metroId = run(
        `INSERT INTO suppliers (name, contact, phone, email, password_hash, contact_name, quality_rating, quality_notes, restaurant_id)
         VALUES (?, ?, ?, ?, ?, ?, 4, ?, ?)`,
        [
          'Metro Paris Nation',
          'Jean Dupont',
          '01 40 09 40 00',
          SUPPLIER_DEMO_EMAIL,
          metroHash,
          'Jean Dupont (commercial Metro)',
          'Grossiste généraliste, livraison 6j/7',
          r.id,
        ]
      ).lastInsertRowid;
      metroRow = { id: metroId };
    }

    const supplierAccountExists = get(
      'SELECT id FROM supplier_accounts WHERE supplier_id = ? AND email = ? AND restaurant_id = ?',
      [metroRow.id, SUPPLIER_DEMO_EMAIL, r.id]
    );
    if (!supplierAccountExists) {
      const pinHash = bcrypt.hashSync(r.metro_supplier_account.pin, 10);
      run(
        `INSERT INTO supplier_accounts (restaurant_id, supplier_id, name, email, pin)
         VALUES (?, ?, ?, ?, ?)`,
        [r.id, metroRow.id, r.metro_supplier_account.name, SUPPLIER_DEMO_EMAIL, pinHash]
      );
    }

    const recipes = r.id === 2 ? _MARIE_ORDER_RECIPES : _SAKURA_ORDER_RECIPES;
    run(
      `DELETE FROM purchase_order_items
        WHERE purchase_order_id IN (
          SELECT id FROM purchase_orders
           WHERE supplier_id = ? AND restaurant_id = ? AND reference LIKE ?
        )`,
      [metroRow.id, r.id, `${EXTRA_DEMO_REF_PREFIX}%`]
    );
    run(
      'DELETE FROM purchase_orders WHERE supplier_id = ? AND restaurant_id = ? AND reference LIKE ?',
      [metroRow.id, r.id, `${EXTRA_DEMO_REF_PREFIX}%`]
    );
    run(
      `DELETE FROM supplier_notifications
        WHERE supplier_id = ? AND restaurant_id = ? AND message LIKE ?`,
      [metroRow.id, r.id, '[DEMO]%']
    );

    const span = 60;
    recipes.forEach((recipe, i) => {
      const total = recipes.length;
      const idx = total - 1 - i;
      const dayOffset = Math.round((idx / Math.max(1, total - 1)) * span);
      const created = new Date(Date.now() - dayOffset * 86_400_000);
      created.setHours(8 + (i % 4), (10 + i * 13) % 60, 0, 0);
      const createdSql = sqlDateTime(created);
      const dateTag = createdSql.slice(0, 10).replace(/-/g, '');
      const ref = `${EXTRA_DEMO_REF_PREFIX}R${r.id}-${dateTag}-${pad2(idx + 1)}`;
      const status = idx === 0 ? 'envoyée' : 'livrée';

      let total_amount = 0;
      const lines = recipe.items.map(it => {
        const line = Math.round(it.qty * it.price * 100) / 100;
        total_amount += line;
        return { ...it, total: line };
      });
      total_amount = Math.round(total_amount * 100) / 100;

      const orderId = run(
        `INSERT INTO purchase_orders
           (supplier_id, restaurant_id, reference, status, total_amount, expected_delivery, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          metroRow.id, r.id, ref, status, total_amount,
          new Date(created.getTime() + 86_400_000).toISOString().slice(0, 10),
          _demoNoteFor(idx + r.id), createdSql,
        ]
      ).lastInsertRowid;

      for (const ln of lines) {
        run(
          `INSERT INTO purchase_order_items
             (purchase_order_id, restaurant_id, ingredient_id, product_name, quantity, unit, unit_price, total_price)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
          [orderId, r.id, ln.name, ln.qty, ln.unit, ln.price, ln.total]
        );
      }
      run(
        `INSERT INTO supplier_notifications
           (supplier_id, restaurant_id, type, order_id, message, read, created_at)
         VALUES (?, ?, 'order_created', ?, ?, ?, ?)`,
        [
          metroRow.id, r.id, orderId,
          `[DEMO] Nouvelle commande ${ref} — ${total_amount.toFixed(2)} €`,
          idx === 0 ? 0 : 1,
          createdSql,
        ]
      );
      if (r.id === 2) summary.marie_orders++;
      else if (r.id === 3) summary.sakura_orders++;
    });
  }

  return summary;
}

// 8 supplier orders for Le Comptoir, spread across Metro / PassionFroid /
// TerreAzur over the past 14 days. Idempotent: DELETE-then-INSERT scoped to
// reference LIKE 'DEMO-PO-%'. Real (non-DEMO-) orders stay untouched.
function ensureSupplierOrders() {
  const supplierByName = {};
  for (const name of ['Metro Paris Nation', 'PassionFroid', 'TerreAzur']) {
    const row = get(
      'SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?',
      [name, RID]
    );
    if (row) supplierByName[name] = row.id;
  }
  if (!supplierByName['Metro Paris Nation']) return { inserted: 0, notifs: 0 };

  const supplierIdList = Object.values(supplierByName);
  const placeholders = supplierIdList.map(() => '?').join(',');
  run(
    `DELETE FROM purchase_order_items
      WHERE purchase_order_id IN (
        SELECT id FROM purchase_orders
         WHERE supplier_id IN (${placeholders}) AND restaurant_id = ?
           AND reference LIKE ?
      )`,
    [...supplierIdList, RID, `${DEMO_ORDER_REFS_PREFIX}%`]
  );
  run(
    `DELETE FROM purchase_orders
      WHERE supplier_id IN (${placeholders}) AND restaurant_id = ?
        AND reference LIKE ?`,
    [...supplierIdList, RID, `${DEMO_ORDER_REFS_PREFIX}%`]
  );
  run(
    `DELETE FROM supplier_notifications
      WHERE supplier_id IN (${placeholders}) AND restaurant_id = ?
        AND message LIKE ?`,
    [...supplierIdList, RID, '[DEMO]%']
  );

  const insertOrder = db.prepare(
    `INSERT INTO purchase_orders
       (supplier_id, restaurant_id, reference, status, total_amount, expected_delivery, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO purchase_order_items
       (purchase_order_id, restaurant_id, ingredient_id, product_name, quantity, unit, unit_price, total_price)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
  );
  const insertNotif = db.prepare(
    `INSERT INTO supplier_notifications
       (supplier_id, restaurant_id, type, order_id, message, read, created_at)
     VALUES (?, ?, 'order_created', ?, ?, ?, ?)`
  );

  let inserted = 0;
  let notifs = 0;
  const total = _DEMO_ORDER_RECIPES.length;
  const tx = db.transaction(() => {
    _DEMO_ORDER_RECIPES.forEach((recipe, idx) => {
      const supplierId = supplierByName[recipe.supplier];
      if (!supplierId) return;

      const created = daysAgo(recipe.daysAgoCreated, 8 + (idx % 4), 30 + (idx * 7) % 30);
      const createdSql = sqlDateTime(created);
      const dateTag = createdSql.slice(0, 10).replace(/-/g, '');
      const ref = `${DEMO_ORDER_REFS_PREFIX}${dateTag}-${pad2(idx + 1)}`;
      const status = _orderStatusByAge(recipe.daysAgoCreated, idx, total);
      const expected = sqlDate(new Date(created.getTime() + 86_400_000));

      let total_amount = 0;
      const lines = recipe.items.map(it => {
        const line = Math.round(it.qty * it.price * 100) / 100;
        total_amount += line;
        return { ...it, total: line };
      });
      total_amount = Math.round(total_amount * 100) / 100;

      const orderId = insertOrder.run(
        supplierId, RID, ref, status, total_amount,
        expected, _demoNoteFor(idx), createdSql
      ).lastInsertRowid;

      for (const ln of lines) {
        insertItem.run(orderId, RID, ln.name, ln.qty, ln.unit, ln.price, ln.total);
      }
      inserted++;

      // Notification for the 5 most recent orders. The 2 newest stay
      // unread (badge populates), older ones are pre-marked read.
      const newestIdx = total - 1 - idx;
      if (newestIdx < 5) {
        const isUnread = newestIdx < 2 ? 1 : 0;
        insertNotif.run(
          supplierId, RID, orderId,
          `[DEMO] Nouvelle commande ${ref} — ${total_amount.toFixed(2)} €`,
          1 - isUnread,
          createdSql
        );
        notifs++;
      }
    });
  });
  tx();
  return { inserted, notifs };
}

// 3 message threads with suppliers (Metro, PassionFroid, TerreAzur). Each
// 4-6 turn conversation about a recent delivery / availability ping. The
// most recent supplier message stays unread so the restaurant's chat-badge
// in nav lights up. Idempotent: DELETE-then-INSERT scoped to conversation_id.
const _DEMO_THREADS = [
  {
    supplier: 'Metro Paris Nation',
    supplierContact: 'Jean Dupont (Metro)',
    messages: [
      { sender: 'restaurant', daysAgo: 5, hour: 10, minute: 12, related_to: 'delivery',
        msg: 'Bonjour Jean, il manquait 2 plateaux d\'œufs sur la livraison de ce matin.' },
      { sender: 'supplier', daysAgo: 5, hour: 10, minute: 47, related_to: 'delivery',
        msg: 'Bonjour Laurent, désolé pour l\'oubli. On vous les envoie demain matin en première tournée.' },
      { sender: 'restaurant', daysAgo: 5, hour: 11, minute: 5,
        msg: 'Parfait, merci pour la réactivité.' },
      { sender: 'restaurant', daysAgo: 1, hour: 14, minute: 32, related_to: 'product',
        msg: 'Pourriez-vous me confirmer la dispo des Sancerre blanc 75cl pour vendredi ?' },
      { sender: 'supplier', daysAgo: 1, hour: 15, minute: 18, related_to: 'product',
        msg: 'Oui, pas de souci, j\'en bloque 12 bouteilles pour vous.' },
    ],
  },
  {
    supplier: 'PassionFroid',
    supplierContact: 'Sandrine Bertrand (PassionFroid)',
    messages: [
      { sender: 'supplier', daysAgo: 6, hour: 8, minute: 50, related_to: 'product',
        msg: 'Bonjour Laurent, arrivage exceptionnel de noix de Saint-Jacques de la baie de Saint-Brieuc cette semaine. Intéressé ?' },
      { sender: 'restaurant', daysAgo: 6, hour: 9, minute: 22, related_to: 'product',
        msg: 'Bonjour Sandrine, oui très intéressé. 5 kg svp, calibre 30/40.' },
      { sender: 'supplier', daysAgo: 6, hour: 10, minute: 1, related_to: 'product',
        msg: 'Noté, livraison demain matin. Je vous mets aussi 2 kg de gambas en sample.' },
      { sender: 'restaurant', daysAgo: 4, hour: 11, minute: 15, related_to: 'delivery',
        msg: 'Saumon livré ce matin à 1.6°C, parfait. Merci pour la qualité.' },
      { sender: 'supplier', daysAgo: 0, hour: 9, minute: 30, related_to: 'product',
        msg: 'Petit message: hausse de 0,80€/kg sur le foie gras dès lundi prochain (saison oblige). Vous voulez stocker un peu avant ?' },
    ],
  },
  {
    supplier: 'TerreAzur',
    supplierContact: 'Mathieu Roux (TerreAzur)',
    messages: [
      { sender: 'restaurant', daysAgo: 7, hour: 7, minute: 30, related_to: 'product',
        msg: 'Bonjour Mathieu, vous avez encore des cèpes frais cette semaine ? Combien ?' },
      { sender: 'supplier', daysAgo: 7, hour: 8, minute: 12, related_to: 'product',
        msg: 'Bonjour ! Oui, arrivage de 8 kg ce matin. À 38€/kg. Je peux vous en réserver 2 kg.' },
      { sender: 'restaurant', daysAgo: 7, hour: 8, minute: 25, related_to: 'product',
        msg: 'Parfait, prenez-en 2 kg, livraison avec la commande de demain.' },
      { sender: 'restaurant', daysAgo: 3, hour: 14, minute: 0, related_to: 'delivery',
        msg: 'Les fraises gariguette de jeudi étaient un peu molles, le chef m\'a fait remonter.' },
      { sender: 'supplier', daysAgo: 3, hour: 15, minute: 45, related_to: 'delivery',
        msg: 'Désolé Laurent, lot un peu chaud à la sortie de Rungis. Je vous fais un avoir de 18€ sur la prochaine.' },
      { sender: 'supplier', daysAgo: 0, hour: 10, minute: 10, related_to: 'product',
        msg: 'Disponible aujourd\'hui : asperges vertes du Gard à 9€/kg, top qualité. Je vous en mets ?' },
    ],
  },
];

function ensureDemoMessages() {
  let inserted = 0;
  const conversationIds = [];
  const tx = db.transaction(() => {
    for (const thread of _DEMO_THREADS) {
      const supplier = get(
        'SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?',
        [thread.supplier, RID]
      );
      if (!supplier) continue;

      const conversationId = `supplier_${supplier.id}_restaurant_${RID}`;
      conversationIds.push(conversationId);
      run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);

      thread.messages.forEach((m, i) => {
        const created = daysAgo(m.daysAgo, m.hour, m.minute);
        const createdSql = sqlDateTime(created);
        // Most-recent supplier message stays unread (badge); older ones read.
        const isLast = i === thread.messages.length - 1;
        const readAt = (isLast && m.sender === 'supplier') ? null : createdSql;
        const senderName = m.sender === 'restaurant' ? 'Laurent Martin' : thread.supplierContact;
        run(
          `INSERT INTO messages
             (conversation_id, restaurant_id, supplier_id,
              sender_type, sender_id, sender_name,
              message, related_to, related_id, read_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            conversationId, RID, supplier.id,
            m.sender, 1, senderName,
            m.msg, m.related_to || null, readAt, createdSql,
          ]
        );
        inserted++;
      });
    }
  });
  tx();
  return { inserted, threads: conversationIds.length };
}

// ─── Idempotency guard ─────────────────────────────────────────────────────
const existing = get('SELECT id FROM accounts WHERE email = ?', [OWNER_EMAIL]);
if (existing) {
  const ensured = ensureSupplierDemoLogin();
  const catalog = ensureSupplierCatalogs();
  const extras = ensureExtraDemoRestaurants();
  const orders = ensureSupplierOrders();
  const messages = ensureDemoMessages();
  if (ensured) {
    console.log(`✅ Demo data already present (${OWNER_EMAIL} exists, account id=${existing.id}). Refreshed supplier-portal demo login: ${SUPPLIER_DEMO_EMAIL} / ${SUPPLIER_DEMO_PASSWORD} (PIN ${SUPPLIER_DEMO_PIN}).`);
  } else {
    console.log(`✅ Demo data already present (${OWNER_EMAIL} exists, account id=${existing.id}). Nothing to do.`);
  }
  if (catalog.touchedSuppliers > 0) {
    console.log(`   ↳ Refreshed supplier catalogs: ${catalog.totalInserted} products across ${catalog.touchedSuppliers} suppliers.`);
  }
  if (orders.inserted > 0) {
    console.log(`   ↳ Refreshed Le Comptoir purchase orders: ${orders.inserted} POs + ${orders.notifs} notifications.`);
  }
  if (extras.restaurants > 0) {
    console.log(`   ↳ Refreshed extra demo restaurants: ${extras.restaurants} resto + ${extras.marie_orders + extras.sakura_orders} cross-tenant Metro orders.`);
  }
  if (messages && messages.inserted > 0) {
    console.log(`   ↳ Refreshed demo messages: ${messages.inserted} messages across ${messages.threads} threads.`);
  }
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════
// FRESH SEED — runs on a DB that doesn't yet have the demo owner.
// ═══════════════════════════════════════════════════════════════════════════
console.log('🌱 Seeding demo data for Le Comptoir du Marché — Paris 15…');

// ─── 1. Restaurant ─────────────────────────────────────────────────────────
section('Restaurant');
const RESTAURANT_NAME = 'Le Comptoir du Marché';
const restaurantRow = get('SELECT id FROM restaurants WHERE id = ?', [RID]);
if (restaurantRow) {
  run(
    `UPDATE restaurants SET
       name = ?, type = ?, address = ?, city = ?, postal_code = ?,
       phone = ?, covers = ?, siret = ?, plan = ?,
       service_start = ?, service_end = ?, service_active = 1
     WHERE id = ?`,
    [RESTAURANT_NAME, 'bistrot gastronomique', '12 rue du Commerce',
     'Paris', '75015', '01 45 75 22 18', 45, '79234156700019', 'pro',
     '11:30', '23:00', RID]
  );
  log(`Restaurant ${RID} updated → ${RESTAURANT_NAME}`);
} else {
  run(
    `INSERT INTO restaurants (id, name, type, address, city, postal_code, phone, covers, siret, plan, service_start, service_end, service_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [RID, RESTAURANT_NAME, 'bistrot gastronomique', '12 rue du Commerce',
     'Paris', '75015', '01 45 75 22 18', 45, '79234156700019', 'pro',
     '11:30', '23:00']
  );
  log(`Restaurant ${RID} created → ${RESTAURANT_NAME}`);
}

// ─── 2. Accounts (owner + 3 staff with PIN) ────────────────────────────────
section('Accounts');
const ownerHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
const ownerPerms = JSON.stringify({
  view_recipes: true, view_costs: true, edit_recipes: true,
  view_suppliers: true, export_pdf: true,
});

const ownerResult = run(
  `INSERT INTO accounts (name, pin, role, permissions, email, password_hash, first_name, last_name, phone, restaurant_id, onboarding_step, is_owner, trial_start)
   VALUES (?, NULL, 'gerant', ?, ?, ?, ?, ?, ?, ?, 10, 1, datetime('now'))`,
  ['Laurent Martin', ownerPerms, OWNER_EMAIL, ownerHash, 'Laurent', 'Martin', '06 12 34 56 78', RID]
);
const ownerId = ownerResult.lastInsertRowid;
log(`Gérant: ${OWNER_EMAIL} / ${OWNER_PASSWORD} (id=${ownerId})`);

const staffPerms = JSON.stringify({ view_recipes: true });
// Sub-set of staff_members that ALSO get a PIN-login account. The second,
// commis #2 and plongeur don't need to clock into the app.
const staffWithAccounts = [
  { name: 'Thomas Moreau', first: 'Thomas', last: 'Moreau', pin: '1234', role: 'cuisinier', zones: ['Cuisine'], skills: ['Cuisson', 'Découpe', 'Sauces'] },
  { name: 'Julie Dubois',  first: 'Julie',  last: 'Dubois',  pin: '5678', role: 'cuisinier', zones: ['Cuisine'], skills: ['Mise en place', 'Pâtisserie'] },
  { name: 'Marc Bernard',  first: 'Marc',   last: 'Bernard', pin: '9012', role: 'salle',     zones: ['Salle'],   skills: ['Service', 'Bar', 'Encaissement'] },
];
const accountIdByName = {};
for (const s of staffWithAccounts) {
  const pinHash = bcrypt.hashSync(s.pin, 10);
  const r = run(
    `INSERT INTO accounts (name, pin, role, permissions, first_name, last_name, restaurant_id, is_owner, zones, skills, hire_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, date('now', '-180 days'))`,
    [s.name, pinHash, s.role, staffPerms, s.first, s.last, RID, JSON.stringify(s.zones), JSON.stringify(s.skills)]
  );
  accountIdByName[s.name] = r.lastInsertRowid;
  log(`Staff: ${s.name} (${s.role}) PIN=${s.pin}`);
}

// ─── 2b. Staff members (planning roster, 6 people) + shifts (this week) ───
section('Staff members & shifts (this week)');
const staffRoster = [
  { name: 'Thomas Moreau',  role: 'Chef de cuisine',       hourly_rate: 18.00, contract: 39, account: 'Thomas Moreau', email: 'thomas.moreau@lecomptoir-pdm.fr', phone: '06 23 45 67 89' },
  { name: 'Pierre Lefèvre', role: 'Second de cuisine',     hourly_rate: 15.50, contract: 39, account: null,             email: 'pierre.lefevre@lecomptoir-pdm.fr', phone: '06 34 56 78 90' },
  { name: 'Julie Dubois',   role: 'Commis de cuisine',     hourly_rate: 12.50, contract: 35, account: 'Julie Dubois',  email: 'julie.dubois@lecomptoir-pdm.fr',   phone: '06 45 67 89 01' },
  { name: 'Camille Roux',   role: 'Commis de cuisine',     hourly_rate: 12.50, contract: 35, account: null,             email: 'camille.roux@lecomptoir-pdm.fr',   phone: '06 56 78 90 12' },
  { name: 'Karim Benali',   role: 'Plongeur',              hourly_rate: 11.65, contract: 35, account: null,             email: 'karim.benali@lecomptoir-pdm.fr',   phone: '06 67 89 01 23' },
  { name: 'Marc Bernard',   role: 'Serveur',               hourly_rate: 12.00, contract: 35, account: 'Marc Bernard',   email: 'marc.bernard@lecomptoir-pdm.fr',   phone: '06 78 90 12 34' },
];

const insertStaff = db.prepare(
  `INSERT INTO staff_members (restaurant_id, name, role, email, phone, hourly_rate, contract_hours, account_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const staffIdByName = {};
for (const s of staffRoster) {
  const accId = s.account ? (accountIdByName[s.account] || null) : null;
  const r = insertStaff.run(RID, s.name, s.role, s.email, s.phone, s.hourly_rate, s.contract, accId);
  staffIdByName[s.name] = r.lastInsertRowid;
}
log(`${staffRoster.length} staff members in roster`);

// Shifts for "this week" — Monday → Sunday containing today.
// Restaurant closed Sun + Mon (typical Paris bistrot). Service Tue→Sat
// lunch (11:00-15:00) + dinner (18:30-23:30); shift count varies per role.
const today = new Date();
const dow = today.getDay(); // 0=Sun
const monday = new Date(today);
monday.setDate(today.getDate() - ((dow + 6) % 7)); // step back to Monday
monday.setHours(0, 0, 0, 0);
function dateOfWeekday(idx) { // 0=Mon, 6=Sun
  const d = new Date(monday);
  d.setDate(monday.getDate() + idx);
  return sqlDate(d);
}

// Shift template per staff member. Tuples = [weekdayIdx, start, end, break_min].
// weekday 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
const shiftPlan = {
  'Thomas Moreau':  [
    [1, '10:30', '15:00', 30], [1, '18:00', '23:30', 0],
    [2, '10:30', '15:00', 30], [2, '18:00', '23:30', 0],
    [3, '10:30', '15:00', 30], [3, '18:00', '23:30', 0],
    [4, '10:30', '15:00', 30], [4, '18:00', '23:30', 0],
    [5, '10:30', '15:00', 30], [5, '18:00', '23:30', 0],
  ],
  'Pierre Lefèvre': [
    [1, '11:00', '15:00', 30], [1, '18:30', '23:30', 0],
    [2, '11:00', '15:00', 30], [2, '18:30', '23:30', 0],
    [3, '11:00', '15:00', 30],
    [4, '11:00', '15:00', 30], [4, '18:30', '23:30', 0],
    [5, '11:00', '15:00', 30], [5, '18:30', '23:30', 0],
  ],
  'Julie Dubois':   [
    [1, '09:00', '15:00', 30],
    [2, '09:00', '15:00', 30], [2, '18:30', '23:00', 0],
    [3, '09:00', '15:00', 30],
    [4, '09:00', '15:00', 30], [4, '18:30', '23:00', 0],
    [5, '09:00', '15:00', 30], [5, '18:30', '23:30', 0],
  ],
  'Camille Roux':   [
    [1, '18:00', '23:30', 0],
    [2, '11:00', '15:00', 30], [2, '18:00', '23:30', 0],
    [3, '18:00', '23:30', 0],
    [4, '11:00', '15:00', 30], [4, '18:00', '23:30', 0],
    [5, '11:00', '15:00', 30], [5, '18:00', '23:30', 0],
  ],
  'Karim Benali':   [
    [1, '11:30', '15:30', 0], [1, '19:00', '23:30', 0],
    [2, '11:30', '15:30', 0], [2, '19:00', '23:30', 0],
    [3, '11:30', '15:30', 0], [3, '19:00', '23:30', 0],
    [4, '11:30', '15:30', 0], [4, '19:00', '23:30', 0],
    [5, '11:30', '15:30', 0], [5, '19:00', '23:30', 0],
  ],
  'Marc Bernard':   [
    [1, '11:30', '15:30', 30], [1, '18:30', '23:30', 0],
    [2, '11:30', '15:30', 30], [2, '18:30', '23:30', 0],
    [3, '11:30', '15:30', 30], [3, '18:30', '23:30', 0],
    [4, '11:30', '15:30', 30], [4, '18:30', '23:30', 0],
    [5, '11:30', '15:30', 30], [5, '18:30', '23:30', 0],
  ],
};

const insertShift = db.prepare(
  `INSERT INTO staff_shifts (restaurant_id, staff_member_id, date, start_time, end_time, break_minutes, status)
   VALUES (?, ?, ?, ?, ?, ?, 'planned')`
);
let shiftCount = 0;
for (const [name, shifts] of Object.entries(shiftPlan)) {
  const sid = staffIdByName[name];
  if (!sid) continue;
  for (const [wd, start, end, brk] of shifts) {
    insertShift.run(RID, sid, dateOfWeekday(wd), start, end, brk);
    shiftCount++;
  }
}
log(`${shiftCount} shifts planned for week of ${dateOfWeekday(0)}`);

// ─── 3. Suppliers (3) ──────────────────────────────────────────────────────
section('Suppliers');
const suppliers = [
  { name: 'Metro Paris Nation', contact: 'Jean Dupont',       phone: '01 40 09 40 00', email: SUPPLIER_DEMO_EMAIL,            rating: 4, notes: 'Grossiste généraliste, livraison 6j/7. Référent épicerie & produits secs.' },
  { name: 'PassionFroid',       contact: 'Sandrine Bertrand', phone: '01 49 29 50 00', email: 'commandes@passionfroid.fr',    rating: 5, notes: 'Spécialiste cold chain : viandes premium, poissons frais, surgelés.' },
  { name: 'TerreAzur',          contact: 'Mathieu Roux',      phone: '01 49 29 30 00', email: 'commandes@terreazur.fr',       rating: 5, notes: 'Fruits & légumes frais, herbes aromatiques. Arrivages quotidiens Rungis.' },
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

// Wire the company-login credentials onto the Metro row so the supplier
// portal's /api/supplier-portal/company-login can authenticate.
const supplierDemoHash = bcrypt.hashSync(SUPPLIER_DEMO_PASSWORD, 10);
run(
  `UPDATE suppliers SET password_hash = ?, contact_name = ?
    WHERE id = ? AND restaurant_id = ?`,
  [supplierDemoHash, 'Jean Dupont (commercial Metro)', supplierIds['Metro Paris Nation'], RID]
);
log(`Metro company-login: ${SUPPLIER_DEMO_EMAIL} / ${SUPPLIER_DEMO_PASSWORD}`);

// ─── 3b. Supplier portal accounts ──────────────────────────────────────────
section('Supplier portal accounts');
const supplierLogins = [
  { supplier: 'Metro Paris Nation', name: 'Jean Dupont',       email: SUPPLIER_DEMO_EMAIL,           pin: SUPPLIER_DEMO_PIN },
  { supplier: 'PassionFroid',       name: 'Sandrine Bertrand', email: 'commandes@passionfroid.fr',   pin: '3333' },
  { supplier: 'TerreAzur',          name: 'Mathieu Roux',      email: 'commandes@terreazur.fr',      pin: '2222' },
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

// ─── 3c. Supplier catalogs ─────────────────────────────────────────────────
section('Supplier catalogs');
{
  const catalog = ensureSupplierCatalogs();
  log(`${catalog.totalInserted} products inserted across ${catalog.touchedSuppliers} suppliers`);
}

// ─── 3d. Supplier orders (8 over last 14 days) ─────────────────────────────
section('Supplier orders');
{
  const o = ensureSupplierOrders();
  log(`${o.inserted} purchase_orders + ${o.notifs} notifications across 3 suppliers`);
}

// ─── 3e. Extra demo restaurants (Marie / Sakura) ───────────────────────────
section('Extra demo restaurants + cross-tenant Metro orders');
{
  const e = ensureExtraDemoRestaurants();
  log(`${e.restaurants} restaurant(s) · ${e.marie_orders} Marie + ${e.sakura_orders} Sakura Metro orders`);
}

// ─── 3f. Demo messages (3 threads) ─────────────────────────────────────────
section('Demo messages (3 threads)');
{
  const m = ensureDemoMessages();
  log(`${m.inserted} messages across ${m.threads} threads`);
}

// ─── 4. Ingredients (85+) ──────────────────────────────────────────────────
section('Ingredients');
// Boot-time seed-ingredients.js may already have generic names (UNIQUE
// COLLATE NOCASE on name). INSERT OR IGNORE then UPDATE so we own the row's
// price/category/allergens for our scope.
const ingredients = [
  // ── Viandes (12)
  { name: 'entrecôte de bœuf',        cat: 'viandes',    unit: 'g',     price: 32.00, priceUnit: 'kg',    waste: 8,  allergens: null },
  { name: 'onglet de bœuf',           cat: 'viandes',    unit: 'g',     price: 21.50, priceUnit: 'kg',    waste: 8,  allergens: null },
  { name: 'bavette d\'aloyau',        cat: 'viandes',    unit: 'g',     price: 17.50, priceUnit: 'kg',    waste: 8,  allergens: null },
  { name: 'joue de bœuf',             cat: 'viandes',    unit: 'g',     price: 13.80, priceUnit: 'kg',    waste: 12, allergens: null },
  { name: 'bœuf haché 15% MG',        cat: 'viandes',    unit: 'g',     price: 11.00, priceUnit: 'kg',    waste: 0,  allergens: null },
  { name: 'suprême de volaille',      cat: 'viandes',    unit: 'g',     price: 12.50, priceUnit: 'kg',    waste: 5,  allergens: null },
  { name: 'cuisse de volaille',       cat: 'viandes',    unit: 'g',     price: 7.20,  priceUnit: 'kg',    waste: 12, allergens: null },
  { name: 'magret de canard',         cat: 'viandes',    unit: 'g',     price: 19.50, priceUnit: 'kg',    waste: 8,  allergens: null },
  { name: 'cuisse de canard confite', cat: 'viandes',    unit: 'pièce', price: 4.20,  priceUnit: 'pièce', waste: 0,  allergens: null },
  { name: 'saucisse de Toulouse',     cat: 'viandes',    unit: 'g',     price: 7.90,  priceUnit: 'kg',    waste: 0,  allergens: null },
  { name: 'filet mignon de porc',     cat: 'viandes',    unit: 'g',     price: 14.50, priceUnit: 'kg',    waste: 5,  allergens: null },
  { name: 'foie de porc',             cat: 'viandes',    unit: 'g',     price: 6.00,  priceUnit: 'kg',    waste: 10, allergens: null },
  // ── Charcuterie (5)
  { name: 'lardons fumés',            cat: 'charcuterie', unit: 'g',    price: 9.80,  priceUnit: 'kg',    waste: 0,  allergens: null },
  { name: 'jambon de Paris',          cat: 'charcuterie', unit: 'g',    price: 9.80,  priceUnit: 'kg',    waste: 0,  allergens: null },
  { name: 'saucisson sec',            cat: 'charcuterie', unit: 'g',    price: 18.50, priceUnit: 'kg',    waste: 5,  allergens: null },
  { name: 'chorizo doux',             cat: 'charcuterie', unit: 'g',    price: 16.80, priceUnit: 'kg',    waste: 0,  allergens: null },
  { name: 'pâté de campagne',         cat: 'charcuterie', unit: 'g',    price: 14.50, priceUnit: 'kg',    waste: 0,  allergens: 'œuf' },
  // ── Poissons & fruits de mer (10)
  { name: 'pavé de saumon',                cat: 'poissons', unit: 'g', price: 22.00, priceUnit: 'kg',  waste: 8,  allergens: 'poisson' },
  { name: 'saumon extra-frais sashimi',    cat: 'poissons', unit: 'g', price: 32.00, priceUnit: 'kg',  waste: 15, allergens: 'poisson' },
  { name: 'cabillaud',                     cat: 'poissons', unit: 'g', price: 16.00, priceUnit: 'kg',  waste: 12, allergens: 'poisson' },
  { name: 'dorade royale',                 cat: 'poissons', unit: 'g', price: 18.50, priceUnit: 'kg',  waste: 30, allergens: 'poisson' },
  { name: 'lieu jaune',                    cat: 'poissons', unit: 'g', price: 16.00, priceUnit: 'kg',  waste: 15, allergens: 'poisson' },
  { name: 'noix de Saint-Jacques',         cat: 'poissons', unit: 'g', price: 38.00, priceUnit: 'kg',  waste: 0,  allergens: 'mollusques' },
  { name: 'gambas',                        cat: 'poissons', unit: 'g', price: 22.00, priceUnit: 'kg',  waste: 30, allergens: 'crustacés' },
  { name: 'crevettes roses cuites',        cat: 'poissons', unit: 'g', price: 14.90, priceUnit: 'kg',  waste: 25, allergens: 'crustacés' },
  { name: 'moules de bouchot',             cat: 'poissons', unit: 'g', price: 4.50,  priceUnit: 'kg',  waste: 30, allergens: 'mollusques' },
  { name: 'huîtres n°3',                   cat: 'poissons', unit: 'pièce', price: 0.95, priceUnit: 'pièce', waste: 0, allergens: 'mollusques' },
  // ── Légumes (16)
  { name: 'pomme de terre bintje',    cat: 'légumes', unit: 'g',     price: 1.40,  priceUnit: 'kg',    waste: 18, allergens: null },
  { name: 'carotte',                  cat: 'légumes', unit: 'g',     price: 1.40,  priceUnit: 'kg',    waste: 12, allergens: null },
  { name: 'oignon jaune',             cat: 'légumes', unit: 'g',     price: 1.50,  priceUnit: 'kg',    waste: 10, allergens: null },
  { name: 'échalote grise',           cat: 'légumes', unit: 'g',     price: 5.50,  priceUnit: 'kg',    waste: 10, allergens: null },
  { name: 'ail rose',                 cat: 'légumes', unit: 'g',     price: 9.00,  priceUnit: 'kg',    waste: 20, allergens: null },
  { name: 'poireau',                  cat: 'légumes', unit: 'g',     price: 2.50,  priceUnit: 'kg',    waste: 25, allergens: null },
  { name: 'courgette',                cat: 'légumes', unit: 'g',     price: 2.50,  priceUnit: 'kg',    waste: 8,  allergens: null },
  { name: 'aubergine',                cat: 'légumes', unit: 'g',     price: 2.40,  priceUnit: 'kg',    waste: 8,  allergens: null },
  { name: 'poivron rouge',            cat: 'légumes', unit: 'g',     price: 3.20,  priceUnit: 'kg',    waste: 15, allergens: null },
  { name: 'tomate cœur de bœuf',      cat: 'légumes', unit: 'g',     price: 4.20,  priceUnit: 'kg',    waste: 5,  allergens: null },
  { name: 'champignons de Paris',     cat: 'légumes', unit: 'g',     price: 5.80,  priceUnit: 'kg',    waste: 10, allergens: null },
  { name: 'cèpes frais',              cat: 'légumes', unit: 'g',     price: 38.00, priceUnit: 'kg',    waste: 15, allergens: null },
  { name: 'haricots verts',           cat: 'légumes', unit: 'g',     price: 5.50,  priceUnit: 'kg',    waste: 8,  allergens: null },
  { name: 'endive',                   cat: 'légumes', unit: 'g',     price: 2.80,  priceUnit: 'kg',    waste: 5,  allergens: null },
  { name: 'fenouil',                  cat: 'légumes', unit: 'g',     price: 3.00,  priceUnit: 'kg',    waste: 15, allergens: null },
  { name: 'cœur de romaine',          cat: 'légumes', unit: 'pièce', price: 1.80,  priceUnit: 'pièce', waste: 15, allergens: null },
  // ── Fruits (6)
  { name: 'pomme golden',             cat: 'fruits', unit: 'g',     price: 2.40,  priceUnit: 'kg', waste: 10, allergens: null },
  { name: 'poire conférence',         cat: 'fruits', unit: 'g',     price: 3.20,  priceUnit: 'kg', waste: 12, allergens: null },
  { name: 'fraise gariguette',        cat: 'fruits', unit: 'g',     price: 9.50,  priceUnit: 'kg', waste: 10, allergens: null },
  { name: 'framboise',                cat: 'fruits', unit: 'g',     price: 17.50, priceUnit: 'kg', waste: 5,  allergens: null },
  { name: 'citron',                   cat: 'fruits', unit: 'g',     price: 2.50,  priceUnit: 'kg', waste: 30, allergens: null },
  { name: 'orange',                   cat: 'fruits', unit: 'g',     price: 2.20,  priceUnit: 'kg', waste: 35, allergens: null },
  // ── Produits laitiers (9)
  { name: 'beurre AOP Charentes',     cat: 'produits laitiers', unit: 'g',     price: 12.00, priceUnit: 'kg', waste: 0, allergens: 'lait' },
  { name: 'crème liquide 35% MG',     cat: 'produits laitiers', unit: 'ml',    price: 5.20,  priceUnit: 'l',  waste: 0, allergens: 'lait' },
  { name: 'crème fraîche épaisse',    cat: 'produits laitiers', unit: 'g',     price: 6.20,  priceUnit: 'kg', waste: 0, allergens: 'lait' },
  { name: 'lait entier',              cat: 'produits laitiers', unit: 'ml',    price: 1.10,  priceUnit: 'l',  waste: 0, allergens: 'lait' },
  { name: 'parmesan reggiano',        cat: 'produits laitiers', unit: 'g',     price: 28.00, priceUnit: 'kg', waste: 5, allergens: 'lait' },
  { name: 'gruyère râpé',             cat: 'produits laitiers', unit: 'g',     price: 14.50, priceUnit: 'kg', waste: 0, allergens: 'lait' },
  { name: 'mozzarella di bufala',     cat: 'produits laitiers', unit: 'g',     price: 18.00, priceUnit: 'kg', waste: 0, allergens: 'lait' },
  { name: 'œuf fermier',              cat: 'produits laitiers', unit: 'pièce', price: 0.42,  priceUnit: 'pièce', waste: 12, allergens: 'œuf' },
  { name: 'mascarpone',               cat: 'produits laitiers', unit: 'g',     price: 7.80,  priceUnit: 'kg', waste: 0, allergens: 'lait' },
  // ── Épicerie (16)
  { name: 'pain de mie brioché',      cat: 'épicerie', unit: 'g',  price: 6.00,  priceUnit: 'kg', waste: 5,  allergens: 'gluten,lait,œuf' },
  { name: 'farine T55',               cat: 'épicerie', unit: 'g',  price: 1.10,  priceUnit: 'kg', waste: 0,  allergens: 'gluten' },
  { name: 'riz arborio',              cat: 'épicerie', unit: 'g',  price: 3.80,  priceUnit: 'kg', waste: 0,  allergens: null },
  { name: 'pâtes penne',              cat: 'épicerie', unit: 'g',  price: 1.50,  priceUnit: 'kg', waste: 0,  allergens: 'gluten' },
  { name: 'pâtes spaghetti',          cat: 'épicerie', unit: 'g',  price: 1.50,  priceUnit: 'kg', waste: 0,  allergens: 'gluten' },
  { name: 'lentilles vertes du Puy',  cat: 'épicerie', unit: 'g',  price: 3.50,  priceUnit: 'kg', waste: 0,  allergens: null },
  { name: 'bouillon de volaille',     cat: 'épicerie', unit: 'ml', price: 4.50,  priceUnit: 'l',  waste: 0,  allergens: null },
  { name: 'fond de veau',             cat: 'épicerie', unit: 'ml', price: 12.00, priceUnit: 'l',  waste: 0,  allergens: null },
  { name: 'vin blanc de cuisson',     cat: 'épicerie', unit: 'ml', price: 3.80,  priceUnit: 'l',  waste: 0,  allergens: 'sulfites' },
  { name: 'vin rouge de cuisson',     cat: 'épicerie', unit: 'ml', price: 3.80,  priceUnit: 'l',  waste: 0,  allergens: 'sulfites' },
  { name: 'huile d\'olive vierge extra', cat: 'épicerie', unit: 'ml', price: 6.50, priceUnit: 'l', waste: 0,  allergens: null },
  { name: 'huile de tournesol',       cat: 'épicerie', unit: 'ml', price: 2.80,  priceUnit: 'l',  waste: 0,  allergens: null },
  { name: 'vinaigre balsamique',      cat: 'épicerie', unit: 'ml', price: 4.80,  priceUnit: 'l',  waste: 0,  allergens: 'sulfites' },
  { name: 'moutarde de Dijon',        cat: 'épicerie', unit: 'g',  price: 3.20,  priceUnit: 'kg', waste: 0,  allergens: 'moutarde' },
  { name: 'sel de Guérande',          cat: 'épicerie', unit: 'g',  price: 3.50,  priceUnit: 'kg', waste: 0,  allergens: null },
  { name: 'poivre noir moulu',        cat: 'épicerie', unit: 'g',  price: 28.00, priceUnit: 'kg', waste: 0,  allergens: null },
  // ── Sucré (6)
  { name: 'sucre semoule',            cat: 'épicerie', unit: 'g',     price: 1.20,  priceUnit: 'kg', waste: 0, allergens: null },
  { name: 'sucre cassonade',          cat: 'épicerie', unit: 'g',     price: 1.80,  priceUnit: 'kg', waste: 0, allergens: null },
  { name: 'chocolat noir 70%',        cat: 'épicerie', unit: 'g',     price: 14.00, priceUnit: 'kg', waste: 0, allergens: 'lait,soja' },
  { name: 'gousse de vanille',        cat: 'épicerie', unit: 'pièce', price: 2.80,  priceUnit: 'pièce', waste: 0, allergens: null },
  { name: 'miel de Provence',         cat: 'épicerie', unit: 'g',     price: 18.00, priceUnit: 'kg', waste: 0, allergens: null },
  { name: 'amandes effilées',         cat: 'épicerie', unit: 'g',     price: 16.00, priceUnit: 'kg', waste: 0, allergens: 'fruits à coque' },
  // ── Herbes (5)
  { name: 'thym frais',               cat: 'herbes', unit: 'botte', price: 1.50, priceUnit: 'botte', waste: 40, allergens: null },
  { name: 'persil plat',              cat: 'herbes', unit: 'botte', price: 0.80, priceUnit: 'botte', waste: 30, allergens: null },
  { name: 'ciboulette',               cat: 'herbes', unit: 'botte', price: 1.00, priceUnit: 'botte', waste: 25, allergens: null },
  { name: 'basilic frais',            cat: 'herbes', unit: 'botte', price: 1.20, priceUnit: 'botte', waste: 30, allergens: null },
  { name: 'estragon frais',           cat: 'herbes', unit: 'botte', price: 1.80, priceUnit: 'botte', waste: 30, allergens: null },
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

// ─── 4b. Supplier prices ───────────────────────────────────────────────────
section('Supplier prices');
const supplierPrices = [
  ['entrecôte de bœuf',              'Metro Paris Nation',  18.90, 'kg'],
  ['entrecôte de bœuf',              'PassionFroid',        20.50, 'kg'],
  ['onglet de bœuf',                 'PassionFroid',        21.50, 'kg'],
  ['suprême de volaille',            'PassionFroid',        12.50, 'kg'],
  ['suprême de volaille',            'Metro Paris Nation',  13.20, 'kg'],
  ['cuisse de canard confite',       'PassionFroid',         4.20, 'pièce'],
  ['pavé de saumon',                 'PassionFroid',        22.00, 'kg'],
  ['pavé de saumon',                 'Metro Paris Nation',  19.00, 'kg'],
  ['saumon extra-frais sashimi',     'PassionFroid',        32.00, 'kg'],
  ['noix de Saint-Jacques',          'PassionFroid',        38.00, 'kg'],
  ['pomme de terre bintje',          'TerreAzur',            1.10, 'kg'],
  ['pomme de terre bintje',          'Metro Paris Nation',   1.20, 'kg'],
  ['champignons de Paris',           'TerreAzur',            5.80, 'kg'],
  ['cèpes frais',                    'TerreAzur',           38.00, 'kg'],
  ['oignon jaune',                   'TerreAzur',            1.50, 'kg'],
  ['cœur de romaine',                'TerreAzur',            1.80, 'pièce'],
  ['tomate cœur de bœuf',            'TerreAzur',            4.20, 'kg'],
  ['estragon frais',                 'TerreAzur',            1.80, 'botte'],
  ['beurre AOP Charentes',           'PassionFroid',        12.00, 'kg'],
  ['crème liquide 35% MG',           'PassionFroid',         5.20, 'l'],
  ['parmesan reggiano',              'Metro Paris Nation',  28.00, 'kg'],
  ['œuf fermier',                    'PassionFroid',         0.42, 'pièce'],
  ['vin blanc de cuisson',           'Metro Paris Nation',   3.80, 'l'],
  ['chocolat noir 70%',              'Metro Paris Nation',  14.00, 'kg'],
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

// ─── 5. Sub-recipes (3 — fond de veau, sauce béarnaise, crème anglaise) ───
section('Sub-recipes');
const subRecipes = [
  {
    name: 'Fond de veau maison', cat: 'Bases', type: 'plat', portions: 8, prep: 30, cook: 240, sell: null,
    desc: 'Fond brun corsé pour sauces et jus. Yields ~2L.',
    ingredients: [
      ['oignon jaune', 200, 'g'],
      ['carotte', 200, 'g'],
      ['vin rouge de cuisson', 250, 'ml'],
      ['fond de veau', 2000, 'ml'],
      ['thym frais', 0.3, 'botte'],
    ],
    steps: [
      'Faire colorer parures de veau et os au four 200°C 30 min.',
      'Suer la garniture aromatique, déglacer au vin rouge.',
      'Mouiller au fond + 4L d\'eau, mijoter 4h à frémissement.',
      'Passer au chinois fin, dégraisser, réduire à 2L.',
    ],
  },
  {
    name: 'Sauce béarnaise', cat: 'Bases', type: 'plat', portions: 4, prep: 20, cook: 5, sell: null,
    desc: 'Sauce émulsionnée chaude, échalote, vinaigre, estragon.',
    ingredients: [
      ['échalote grise', 30, 'g'],
      ['estragon frais', 0.3, 'botte'],
      ['vinaigre balsamique', 50, 'ml'],
      ['œuf fermier', 3, 'pièce'],
      ['beurre AOP Charentes', 200, 'g'],
    ],
    steps: [
      'Réduire échalote ciselée + vinaigre + estragon haché aux 2/3.',
      'Hors du feu, ajouter jaunes, fouetter au bain-marie 60°C.',
      'Incorporer beurre clarifié en filet en fouettant constamment.',
      'Rectifier avec sel, poivre et estragon frais.',
    ],
  },
  {
    name: 'Crème anglaise', cat: 'Bases', type: 'dessert', portions: 6, prep: 10, cook: 15, sell: null,
    desc: 'Crème vanillée à la nappe, base pour îles flottantes et glaces.',
    ingredients: [
      ['lait entier', 500, 'ml'],
      ['crème liquide 35% MG', 100, 'ml'],
      ['gousse de vanille', 1, 'pièce'],
      ['œuf fermier', 4, 'pièce'],
      ['sucre semoule', 80, 'g'],
    ],
    steps: [
      'Infuser la vanille dans le lait + crème chauds.',
      'Blanchir jaunes + sucre, verser le lait infusé.',
      'Cuire à la nappe 83°C en remuant constamment.',
      'Passer au chinois, refroidir rapidement.',
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
const insertSubRI = db.prepare(
  `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, sub_recipe_id, gross_quantity, unit, restaurant_id)
   VALUES (?, NULL, ?, ?, ?, ?)`
);
const insertStep = db.prepare(
  `INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)`
);

const subRecipeId = {};
const seedSubRecipes = db.transaction(() => {
  for (const r of subRecipes) {
    const rec = insertRecipe.run(r.name, r.cat, r.type, r.portions, r.prep, r.cook, r.sell, r.desc, RID);
    const rid = rec.lastInsertRowid;
    subRecipeId[r.name] = rid;
    for (const [iname, qty, unit] of r.ingredients) {
      insertRI.run(rid, ingId(iname), qty, unit, RID);
    }
    r.steps.forEach((s, i) => insertStep.run(rid, i + 1, s));
  }
});
seedSubRecipes();
log(`${subRecipes.length} sub-recipes (${Object.keys(subRecipeId).join(', ')})`);

// ─── 5b. Recipes (15 — 5 entrées + 5 plats + 5 desserts) ───────────────────
section('Recipes');
const recipes = [
  // ───── Entrées (5) ─────
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
      ['citron', 30, 'g'],
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
  {
    name: 'Œufs mayonnaise', cat: 'Entrées', type: 'entrée', portions: 1, prep: 15, cook: 10, sell: 6.50,
    desc: 'Classique du bistrot : œufs durs, mayonnaise maison, salade.',
    ingredients: [
      ['œuf fermier', 2, 'pièce'],
      ['huile de tournesol', 80, 'ml'],
      ['moutarde de Dijon', 10, 'g'],
      ['cœur de romaine', 0.3, 'pièce'],
      ['ciboulette', 0.1, 'botte'],
    ],
    steps: [
      'Cuire les œufs durs 9 min dans l\'eau bouillante salée.',
      'Monter la mayonnaise au fouet (jaune, moutarde, huile en filet).',
      'Refroidir les œufs, les écaler, les couper en deux.',
      'Dresser sur un lit de salade, napper de mayonnaise, ciboulette.',
    ],
  },

  // ───── Plats (5) ─────
  {
    name: 'Entrecôte grillée, sauce béarnaise', cat: 'Plats', type: 'plat', portions: 1, prep: 10, cook: 15, sell: 27.50,
    desc: 'Entrecôte bœuf race à viande, frites bintje maison, sauce béarnaise.',
    ingredients: [
      ['entrecôte de bœuf', 250, 'g'],
      ['pomme de terre bintje', 300, 'g'],
      ['beurre AOP Charentes', 25, 'g'],
      ['persil plat', 0.1, 'botte'],
    ],
    subRecipes: [
      ['Sauce béarnaise', 1, 'portion'],
    ],
    steps: [
      'Tailler les pommes de terre en frites, double cuisson (160°C puis 180°C).',
      'Saisir l\'entrecôte 2 min par face (saignant), reposer 5 min.',
      'Préparer la sauce béarnaise (cf. fiche dédiée).',
      'Dresser viande, frites, sauce en saucière.',
    ],
  },
  {
    name: 'Pavé de saumon beurre blanc', cat: 'Plats', type: 'plat', portions: 1, prep: 15, cook: 15, sell: 24.00,
    desc: 'Saumon rôti peau croustillante, beurre blanc, riz pilaf.',
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
    name: 'Suprême de volaille au fond de veau', cat: 'Plats', type: 'plat', portions: 1, prep: 10, cook: 20, sell: 19.80,
    desc: 'Suprême fermier rôti, jus corsé maison, pommes grenaille.',
    ingredients: [
      ['suprême de volaille', 200, 'g'],
      ['pomme de terre bintje', 250, 'g'],
      ['beurre AOP Charentes', 20, 'g'],
      ['échalote grise', 20, 'g'],
      ['thym frais', 0.1, 'botte'],
    ],
    subRecipes: [
      ['Fond de veau maison', 0.15, 'portion'],
    ],
    steps: [
      'Sauter les pommes grenaille avec ail et thym.',
      'Saisir suprême côté peau 5 min, finir au four 10 min à 180°C.',
      'Déglacer la poêle au fond de veau, réduire, monter au beurre.',
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

  // ───── Desserts (5) ─────
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
      ['crème fraîche épaisse', 100, 'g'],
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
      ['sucre cassonade', 40, 'g'],
      ['beurre AOP Charentes', 15, 'g'],
    ],
    subRecipes: [
      ['Crème anglaise', 0.2, 'portion'],
    ],
    steps: [
      'Préparer la crème anglaise (cf. fiche dédiée), réserver au frais.',
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

const recipeIdByName = {};
const seedRecipes = db.transaction(() => {
  for (const r of recipes) {
    const rec = insertRecipe.run(r.name, r.cat, r.type, r.portions, r.prep, r.cook, r.sell, r.desc, RID);
    const rid = rec.lastInsertRowid;
    recipeIdByName[r.name] = rid;
    for (const [iname, qty, unit] of r.ingredients) {
      insertRI.run(rid, ingId(iname), qty, unit, RID);
    }
    if (Array.isArray(r.subRecipes)) {
      for (const [subName, qty, unit] of r.subRecipes) {
        const subId = subRecipeId[subName];
        if (!subId) throw new Error(`Sub-recipe not found: ${subName}`);
        insertSubRI.run(rid, subId, qty, unit, RID);
      }
    }
    r.steps.forEach((s, i) => insertStep.run(rid, i + 1, s));
  }
});
seedRecipes();
log(`${recipes.length} recipes (5 entrées + 5 plats + 5 desserts) — 3 use sub-recipes`);

// ─── 6. Stock quantities + 2-week movement history ─────────────────────────
section('Stock quantities');
const stockItems = [
  ['entrecôte de bœuf',          5000, 'g',     1000],
  ['onglet de bœuf',             3000, 'g',      500],
  ['bavette d\'aloyau',          2500, 'g',      500],
  ['bœuf haché 15% MG',          3000, 'g',      500],
  ['suprême de volaille',        4000, 'g',     1000],
  ['cuisse de canard confite',     20, 'pièce',    5],
  ['magret de canard',           1500, 'g',      300],
  ['saucisse de Toulouse',       2000, 'g',      500],
  ['lardons fumés',              2000, 'g',      500],
  ['foie de porc',               1500, 'g',        0],
  ['pavé de saumon',             3000, 'g',     1000],
  ['saumon extra-frais sashimi', 1500, 'g',      500],
  ['cabillaud',                  1500, 'g',      300],
  ['noix de Saint-Jacques',       400, 'g',      100],
  ['gambas',                      800, 'g',        0],
  ['pomme de terre bintje',     15000, 'g',     3000],
  ['carotte',                    4000, 'g',      500],
  ['oignon jaune',               5000, 'g',     1000],
  ['échalote grise',             1500, 'g',      300],
  ['ail rose',                   1000, 'g',      200],
  ['poireau',                    2000, 'g',      500],
  ['courgette',                  3000, 'g',      500],
  ['tomate cœur de bœuf',        3000, 'g',      500],
  ['champignons de Paris',       2000, 'g',      500],
  ['cèpes frais',                 800, 'g',        0],
  ['haricots verts',             2000, 'g',      300],
  ['cœur de romaine',              20, 'pièce',    5],
  ['fenouil',                    1500, 'g',      300],
  ['pomme golden',               5000, 'g',     1000],
  ['fraise gariguette',          1500, 'g',      300],
  ['citron',                     2000, 'g',      300],
  ['orange',                     2000, 'g',      300],
  ['beurre AOP Charentes',       3000, 'g',      500],
  ['crème liquide 35% MG',       5000, 'ml',    1000],
  ['crème fraîche épaisse',      2000, 'g',      500],
  ['lait entier',                6000, 'ml',    1000],
  ['parmesan reggiano',          1500, 'g',      300],
  ['gruyère râpé',               2000, 'g',      500],
  ['mozzarella di bufala',       1000, 'g',      200],
  ['œuf fermier',                  60, 'pièce',   12],
  ['mascarpone',                 1000, 'g',        0],
  ['pain de mie brioché',        2000, 'g',      500],
  ['farine T55',                 5000, 'g',     1000],
  ['riz arborio',                3000, 'g',      500],
  ['pâtes penne',                3000, 'g',      500],
  ['lentilles vertes du Puy',    2000, 'g',      500],
  ['bouillon de volaille',       5000, 'ml',    1000],
  ['fond de veau',               2000, 'ml',      500],
  ['vin blanc de cuisson',       3000, 'ml',     500],
  ['vin rouge de cuisson',       3000, 'ml',     500],
  ['huile d\'olive vierge extra', 4000, 'ml',    1000],
  ['huile de tournesol',         5000, 'ml',    1000],
  ['vinaigre balsamique',        1000, 'ml',     200],
  ['moutarde de Dijon',           800, 'g',      200],
  ['sucre semoule',              3000, 'g',      500],
  ['sucre cassonade',            1000, 'g',      200],
  ['chocolat noir 70%',          1500, 'g',      300],
  ['gousse de vanille',            10, 'pièce',    2],
  ['miel de Provence',           1000, 'g',        0],
  ['amandes effilées',            500, 'g',      100],
  ['thym frais',                    5, 'botte',    1],
  ['persil plat',                   5, 'botte',    1],
  ['ciboulette',                    3, 'botte',    1],
  ['estragon frais',                3, 'botte',    1],
];
const upsertStock = db.prepare(
  `INSERT OR IGNORE INTO stock (restaurant_id, ingredient_id, quantity, unit, min_quantity) VALUES (?, ?, ?, ?, ?)`
);
const updateStock = db.prepare(
  `UPDATE stock SET quantity = ?, unit = ?, min_quantity = ? WHERE restaurant_id = ? AND ingredient_id = ?`
);
let stockCount = 0;
for (const [name, qty, unit, minQty] of stockItems) {
  const iid = ingId(name);
  if (!iid) continue;
  upsertStock.run(RID, iid, qty, unit, minQty);
  updateStock.run(qty, unit, minQty, RID, iid);
  stockCount++;
}
log(`${stockCount} stock items (some near threshold for low-stock alerts)`);

section('Stock movements (2 weeks of receptions, consumptions, losses)');
const insertMovement = db.prepare(
  `INSERT INTO stock_movements (restaurant_id, ingredient_id, movement_type, quantity, unit, reason, supplier_id, batch_number, dlc, unit_price, recorded_by, recorded_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const seedMovements = db.transaction(() => {
  let count = 0;
  // Receptions tied to recent supplier orders (~3-13 days ago).
  const receptions = [
    { name: 'pavé de saumon',           qty: 5000,  unit: 'g',  supplier: 'PassionFroid',       batch: 'PF-SAU-2604', dlc_days: 3,  daysAgo: 3,  price: 0.022 },
    { name: 'beurre AOP Charentes',     qty: 4000,  unit: 'g',  supplier: 'PassionFroid',       batch: 'PF-BEU-2604', dlc_days: 30, daysAgo: 3,  price: 0.012 },
    { name: 'crème liquide 35% MG',     qty: 5000,  unit: 'ml', supplier: 'PassionFroid',       batch: 'PF-CRE-2604', dlc_days: 14, daysAgo: 3,  price: 0.0052 },
    { name: 'pomme de terre bintje',    qty: 20000, unit: 'g',  supplier: 'TerreAzur',          batch: 'TA-PdT-2604', dlc_days: 14, daysAgo: 4,  price: 0.0011 },
    { name: 'tomate cœur de bœuf',      qty: 4000,  unit: 'g',  supplier: 'TerreAzur',          batch: 'TA-TOM-2604', dlc_days: 5,  daysAgo: 4,  price: 0.0042 },
    { name: 'cèpes frais',              qty: 2000,  unit: 'g',  supplier: 'TerreAzur',          batch: 'TA-CEP-2603', dlc_days: 4,  daysAgo: 6,  price: 0.038 },
    { name: 'farine T55',               qty: 5000,  unit: 'g',  supplier: 'Metro Paris Nation', batch: 'MET-FAR-2603', dlc_days: 180, daysAgo: 13, price: 0.0009 },
    { name: 'riz arborio',              qty: 5000,  unit: 'g',  supplier: 'Metro Paris Nation', batch: 'MET-RIZ-2603', dlc_days: 365, daysAgo: 13, price: 0.0038 },
    { name: 'huile d\'olive vierge extra', qty: 5000, unit: 'ml', supplier: 'Metro Paris Nation', batch: 'MET-OLI-2603', dlc_days: 270, daysAgo: 13, price: 0.0065 },
  ];
  for (const it of receptions) {
    const iid = ingId(it.name);
    const supId = supplierIds[it.supplier] || null;
    const ts = daysAgo(it.daysAgo, 8, 30);
    const dlc = sqlDate(new Date(ts.getTime() + it.dlc_days * 86_400_000));
    // Routes use 'reception' / 'consumption' / 'loss' / 'adjustment' / 'inventory'
    // (see server/routes/stock.js + the filter dropdown in stock-movements.js).
    // Earlier seed used 'in' / 'out' which read fine in SQL but never matched
    // the UI's filter labels — receptions and consumptions both showed under
    // "Tous les types" only.
    insertMovement.run(
      RID, iid, 'reception', it.qty, it.unit, `Réception ${it.supplier}`, supId,
      it.batch, dlc, it.price, ownerId, sqlDateTime(ts)
    );
    count++;
  }
  // Daily consumptions (production) for the last 14 days — a few key items
  const consumeKeys = ['entrecôte de bœuf', 'pavé de saumon', 'pomme de terre bintje', 'beurre AOP Charentes', 'œuf fermier'];
  for (let d = 14; d >= 1; d--) {
    for (const name of consumeKeys) {
      const iid = ingId(name);
      const baseQty = name === 'œuf fermier'
        ? (4 + Math.floor(Math.random() * 4))
        : (200 + Math.floor(Math.random() * 600));
      const unit = name === 'œuf fermier' ? 'pièce' : 'g';
      const ts = daysAgo(d, 11 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      insertMovement.run(
        RID, iid, 'consumption', baseQty, unit, 'Production service', null,
        null, null, null, ownerId, sqlDateTime(ts)
      );
      count++;
    }
  }
  // 3 losses over the past 2 weeks
  const losses = [
    { name: 'fraise gariguette', qty: 250, unit: 'g',  reason: 'DLC dépassée — lot moisi',  daysAgo: 8 },
    { name: 'cèpes frais',       qty: 150, unit: 'g',  reason: 'Vermine, lot écarté',        daysAgo: 5 },
    { name: 'lait entier',       qty: 500, unit: 'ml', reason: 'Brique tombée, casse',       daysAgo: 2 },
  ];
  for (const l of losses) {
    const iid = ingId(l.name);
    const ts = daysAgo(l.daysAgo, 16, 30);
    insertMovement.run(
      RID, iid, 'loss', l.qty, l.unit, l.reason, null,
      null, null, null, ownerId, sqlDateTime(ts)
    );
    count++;
  }
  return count;
});
const movementCount = seedMovements();
log(`${movementCount} stock movements (receptions + consumptions + 3 losses)`);

// ─── 7. Sales: 30 orders + 10 service sessions over 14 days ────────────────
section('Sales: orders + covers + service sessions');
const popularPlats = [
  { name: 'Entrecôte grillée, sauce béarnaise',   weight: 8 },
  { name: 'Suprême de volaille au fond de veau',  weight: 6 },
  { name: 'Confit de canard, pommes sarladaises', weight: 7 },
  { name: 'Pavé de saumon beurre blanc',          weight: 5 },
  { name: 'Risotto aux cèpes',                    weight: 4 },
].map(r => ({ ...r, id: recipeIdByName[r.name] })).filter(r => r.id);

const popularEntrees = [
  { name: 'Soupe à l\'oignon gratinée',  weight: 5 },
  { name: 'Salade César',                weight: 4 },
  { name: 'Tartare de saumon à l\'aneth', weight: 3 },
  { name: 'Œufs mayonnaise',             weight: 3 },
  { name: 'Terrine de campagne maison',  weight: 2 },
].map(r => ({ ...r, id: recipeIdByName[r.name] })).filter(r => r.id);

const popularDesserts = [
  { name: 'Crème brûlée à la vanille',          weight: 5 },
  { name: 'Tiramisu au café',                   weight: 4 },
  { name: 'Tarte Tatin, crème épaisse',         weight: 3 },
  { name: 'Mousse au chocolat noir',            weight: 3 },
  { name: 'Île flottante, caramel au beurre salé', weight: 2 },
].map(r => ({ ...r, id: recipeIdByName[r.name] })).filter(r => r.id);

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.id;
  }
  return items[0].id;
}

const insertOrder = db.prepare(
  `INSERT INTO orders (restaurant_id, table_number, status, total_cost, covers, notes, created_at)
   VALUES (?, ?, 'servi', 0, ?, ?, ?)`
);
const insertOrderItem = db.prepare(
  `INSERT INTO order_items (order_id, recipe_id, quantity, status, restaurant_id) VALUES (?, ?, ?, 'servi', ?)`
);
const insertSession = db.prepare(
  `INSERT INTO service_sessions (restaurant_id, started_at, ended_at, scheduled_start, scheduled_end, total_orders, total_items, total_revenue, total_covers, status, recap_sent)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ended', 1)`
);

// 5 most-recent service days (Tue-Sat) within last 14 days × 2 services
// each = 10 sessions. Aim for 3 orders/service ≈ 30 orders total.
const seedOrdersAndSessions = db.transaction(() => {
  let orderCount = 0;
  let itemCount = 0;
  let sessionCount = 0;
  const sessions = [];
  const serviceDays = [];
  for (let d = 13; d >= 0 && serviceDays.length < 5; d--) {
    const date = daysAgo(d, 12, 0);
    const wd = date.getDay();
    if (wd >= 2 && wd <= 6) serviceDays.push(d);
  }
  for (const d of serviceDays) {
    for (const isMidi of [true, false]) {
      const ordersThisService = 2 + Math.floor(Math.random() * 3); // 2-4
      const baseHour = isMidi ? 12 : 20;
      const sessionStart = daysAgo(d, isMidi ? 11 : 18, 30);
      const sessionEnd = daysAgo(d, isMidi ? 15 : 23, isMidi ? 0 : 30);
      let sessionRevenue = 0;
      let sessionItems = 0;
      let sessionCovers = 0;

      for (let o = 0; o < ordersThisService; o++) {
        const ts = daysAgo(d, baseHour, Math.floor(Math.random() * 90));
        const tableNum = 1 + Math.floor(Math.random() * 12);
        const tableCovers = 2 + Math.floor(Math.random() * 5); // 2-6
        const noteOptions = [null, null, null, 'Allergie noix table', 'Cuisson saignante', 'Sans gluten'];
        const note = noteOptions[Math.floor(Math.random() * noteOptions.length)];
        const ord = insertOrder.run(RID, tableNum, tableCovers, note, sqlDateTime(ts));
        const orderId = ord.lastInsertRowid;
        let orderItems = 0;
        let orderRevenue = 0;

        // Entrée (40% chance per order)
        if (Math.random() < 0.4 && popularEntrees.length > 0) {
          const qty = 1 + Math.floor(Math.random() * Math.min(2, tableCovers));
          const recipeId = weightedPick(popularEntrees);
          insertOrderItem.run(orderId, recipeId, qty, RID);
          itemCount++;
          orderItems += qty;
          const r = recipes.find(x => recipeIdByName[x.name] === recipeId);
          if (r) orderRevenue += qty * (r.sell || 0);
        }
        // Plat: roughly one per cover
        if (popularPlats.length > 0) {
          const qty = Math.max(1, tableCovers - Math.floor(Math.random() * 2));
          const recipeId = weightedPick(popularPlats);
          insertOrderItem.run(orderId, recipeId, qty, RID);
          itemCount++;
          orderItems += qty;
          const r = recipes.find(x => recipeIdByName[x.name] === recipeId);
          if (r) orderRevenue += qty * (r.sell || 0);
        }
        // Dessert (35% chance)
        if (Math.random() < 0.35 && popularDesserts.length > 0) {
          const qty = 1 + Math.floor(Math.random() * Math.min(2, tableCovers));
          const recipeId = weightedPick(popularDesserts);
          insertOrderItem.run(orderId, recipeId, qty, RID);
          itemCount++;
          orderItems += qty;
          const r = recipes.find(x => recipeIdByName[x.name] === recipeId);
          if (r) orderRevenue += qty * (r.sell || 0);
        }
        sessionRevenue += orderRevenue;
        sessionItems += orderItems;
        sessionCovers += tableCovers;
        orderCount++;
      }

      sessions.push({
        started_at: sqlDateTime(sessionStart),
        ended_at: sqlDateTime(sessionEnd),
        scheduled_start: isMidi ? '11:30' : '19:00',
        scheduled_end: isMidi ? '15:00' : '23:30',
        total_orders: ordersThisService,
        total_items: sessionItems,
        total_revenue: Math.round(sessionRevenue * 100) / 100,
        total_covers: sessionCovers,
      });
    }
  }
  for (const s of sessions) {
    insertSession.run(
      RID, s.started_at, s.ended_at, s.scheduled_start, s.scheduled_end,
      s.total_orders, s.total_items, s.total_revenue, s.total_covers
    );
    sessionCount++;
  }
  return { orderCount, itemCount, sessionCount };
});
const { orderCount, itemCount, sessionCount } = seedOrdersAndSessions();
log(`${orderCount} orders + ${itemCount} order items + ${sessionCount} service sessions (past 14 days)`);

// ─── 8. Delivery notes (5) ─────────────────────────────────────────────────
section('Delivery notes (5 receptions)');
const insertDelivery = db.prepare(
  `INSERT INTO delivery_notes (supplier_id, status, delivery_date, notes, created_at, received_at, received_by, reception_notes, total_amount, restaurant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertDeliveryItem = db.prepare(
  `INSERT INTO delivery_note_items (delivery_note_id, ingredient_id, product_name, quantity, unit, price_per_unit, batch_number, dlc, temperature_required, temperature_measured, origin, status, restaurant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const deliveries = [
  {
    supplier: 'PassionFroid', daysAgo: 3, status: 'received', notes: 'Livraison froid OK, sondes OK.', total: 245.40,
    items: [
      { name: 'pavé de saumon',         qty: 5, unit: 'kg', price: 22.00, batch: 'PF-SAU-2604', dlc_days: 3, temp_req: 4, temp_mes: 1.8, origin: 'Norvège' },
      { name: 'beurre AOP Charentes',   qty: 4, unit: 'kg', price: 12.00, batch: 'PF-BEU-2604', dlc_days: 30, temp_req: 4, temp_mes: 3.2, origin: 'France' },
      { name: 'crème liquide 35% MG',   qty: 5, unit: 'L',  price: 5.20,  batch: 'PF-CRE-2604', dlc_days: 14, temp_req: 4, temp_mes: 3.0, origin: 'France' },
    ],
  },
  {
    supplier: 'TerreAzur', daysAgo: 1, status: 'received', notes: 'Tomates un peu mûres, à utiliser rapidement.', total: 87.40,
    items: [
      { name: 'pomme de terre bintje', qty: 20, unit: 'kg', price: 1.10, batch: 'TA-PdT-2604', dlc_days: 14, temp_req: null, temp_mes: null, origin: 'France (Bretagne)' },
      { name: 'tomate cœur de bœuf',   qty: 4,  unit: 'kg', price: 4.20, batch: 'TA-TOM-2604', dlc_days: 4, temp_req: null, temp_mes: null, origin: 'France (Provence)' },
      { name: 'persil plat',            qty: 5,  unit: 'botte', price: 0.80, batch: 'TA-PER-2604', dlc_days: 4, temp_req: null, temp_mes: null, origin: 'France' },
    ],
  },
  {
    supplier: 'Metro Paris Nation', daysAgo: 8, status: 'received', notes: 'Cartons OK.', total: 168.40,
    items: [
      { name: 'farine T55',           qty: 5, unit: 'kg', price: 0.90, batch: 'MET-FAR-2603', dlc_days: 180, temp_req: null, temp_mes: null, origin: 'France' },
      { name: 'huile d\'olive vierge extra', qty: 2, unit: 'L', price: 6.50, batch: 'MET-OLI-2603', dlc_days: 270, temp_req: null, temp_mes: null, origin: 'Italie' },
      { name: 'pâtes penne',          qty: 4, unit: 'kg', price: 1.50, batch: 'MET-PEN-2603', dlc_days: 365, temp_req: null, temp_mes: null, origin: 'Italie' },
    ],
  },
  {
    supplier: 'PassionFroid', daysAgo: 4, status: 'received', notes: 'Foie gras conforme, traçabilité OK.', total: 318.50,
    items: [
      { name: 'onglet de bœuf',                qty: 4, unit: 'kg', price: 21.50, batch: 'PF-ONG-2604', dlc_days: 5, temp_req: 4, temp_mes: 2.6, origin: 'France' },
      { name: 'suprême de volaille',           qty: 5, unit: 'kg', price: 12.50, batch: 'PF-VOL-2604', dlc_days: 5, temp_req: 4, temp_mes: 2.8, origin: 'France (Loué)' },
      { name: 'cuisse de canard confite',      qty: 12, unit: 'pièce', price: 4.20, batch: 'PF-CAN-2604', dlc_days: 30, temp_req: 4, temp_mes: 3.1, origin: 'France (Sud-Ouest)' },
    ],
  },
  {
    supplier: 'TerreAzur', daysAgo: 0, status: 'pending', notes: 'Livraison annoncée 14h.', total: 96.20,
    items: [
      { name: 'cèpes frais',           qty: 1.5, unit: 'kg', price: 38.00, batch: 'TA-CEP-2604', dlc_days: 4, temp_req: null, temp_mes: null, origin: 'France (Limousin)' },
      { name: 'salade laitue batavia', qty: 12,  unit: 'pièce', price: 1.10, batch: 'TA-SAL-2604', dlc_days: 5, temp_req: null, temp_mes: null, origin: 'France' },
      { name: 'fraise gariguette',     qty: 3,   unit: 'kg', price: 9.50, batch: 'TA-FRA-2604', dlc_days: 3, temp_req: null, temp_mes: null, origin: 'France (Lot-et-Garonne)' },
    ],
  },
];
const deliveryNoteIds = [];
for (const d of deliveries) {
  const sid = supplierIds[d.supplier];
  const created = daysAgo(d.daysAgo, 7, 30);
  const received = d.status === 'received' ? daysAgo(d.daysAgo, 9, 15) : null;
  const dnId = insertDelivery.run(
    sid, d.status, sqlDate(created), d.notes,
    sqlDateTime(created),
    received ? sqlDateTime(received) : null,
    received ? ownerId : null,
    received ? d.notes : null,
    d.total, RID
  ).lastInsertRowid;
  deliveryNoteIds.push({ id: dnId, supplier: d.supplier, daysAgo: d.daysAgo, total: d.total });
  for (const it of d.items) {
    const iid = ingredientId[it.name.toLowerCase()] || null;
    const dlc = it.dlc_days != null ? sqlDate(new Date(created.getTime() + it.dlc_days * 86_400_000)) : null;
    insertDeliveryItem.run(
      dnId, iid, it.name, it.qty, it.unit, it.price,
      it.batch, dlc, it.temp_req, it.temp_mes, it.origin,
      d.status === 'received' ? 'accepted' : 'pending',
      RID
    );
  }
}
log(`${deliveries.length} delivery_notes (4 received + 1 pending)`);

// ─── 9. Supplier invoices (3 — 1 pending, 1 validated, 1 paid) ─────────────
section('Supplier invoices (3)');
const insertInvoice = db.prepare(
  `INSERT INTO supplier_invoices (restaurant_id, supplier_id, invoice_number, invoice_date, due_date, total_ht, tva_amount, total_ttc, status, payment_date, payment_method, notes, delivery_note_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertInvoiceItem = db.prepare(
  `INSERT INTO supplier_invoice_items (invoice_id, restaurant_id, description, quantity, unit_price_ht, tva_rate, total_ht, ingredient_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const invoiceData = [
  {
    supplier: 'PassionFroid', status: 'pending', daysAgo: 3, deliveryIdx: 0,
    invoice_number: 'PF-2026-0428', total_ht: 232.61, tva: 12.79, total_ttc: 245.40,
    notes: 'À valider — paiement 30j fin de mois.',
    items: [
      { description: 'Pavé de saumon Norvège — 5 kg', qty: 5, price_ht: 20.85, tva: 5.5, ingredient: 'pavé de saumon' },
      { description: 'Beurre AOP Charentes — 4 kg',   qty: 4, price_ht: 11.37, tva: 5.5, ingredient: 'beurre AOP Charentes' },
      { description: 'Crème liquide 35% MG — 5 L',    qty: 5, price_ht: 4.93,  tva: 5.5, ingredient: 'crème liquide 35% MG' },
    ],
  },
  {
    supplier: 'TerreAzur', status: 'validated', daysAgo: 8, deliveryIdx: 2,
    invoice_number: 'TA-2026-0421', total_ht: 159.62, tva: 8.78, total_ttc: 168.40,
    notes: 'Validé, en attente de paiement.',
    items: [
      { description: 'Pommes de terre Bintje — 20 kg', qty: 20, price_ht: 1.04, tva: 5.5, ingredient: 'pomme de terre bintje' },
      { description: 'Tomates anciennes — 4 kg',       qty: 4,  price_ht: 4.55, tva: 5.5, ingredient: 'tomate cœur de bœuf' },
      { description: 'Persil plat — 5 bottes',         qty: 5,  price_ht: 0.76, tva: 5.5, ingredient: 'persil plat' },
    ],
  },
  {
    supplier: 'Metro Paris Nation', status: 'paid', daysAgo: 13, paidDaysAgo: 8,
    invoice_number: 'MET-2026-0416', total_ht: 102.60, tva: 5.64, total_ttc: 108.24,
    notes: 'Réglé par virement.',
    items: [
      { description: 'Farine T55 — 5 kg',                  qty: 5, price_ht: 0.85, tva: 5.5, ingredient: 'farine T55' },
      { description: 'Riz arborio — 5 kg',                 qty: 5, price_ht: 3.60, tva: 5.5, ingredient: 'riz arborio' },
      { description: 'Huile d\'olive vierge extra — 2 L',  qty: 2, price_ht: 6.16, tva: 5.5, ingredient: 'huile d\'olive vierge extra' },
      { description: 'Pâtes penne — 4 kg',                 qty: 4, price_ht: 1.42, tva: 5.5, ingredient: 'pâtes penne' },
    ],
  },
];

for (const inv of invoiceData) {
  const sid = supplierIds[inv.supplier];
  const invoiceDate = daysAgo(inv.daysAgo, 9, 0);
  const dueDate = sqlDate(new Date(invoiceDate.getTime() + 30 * 86_400_000));
  const paymentDate = inv.status === 'paid' && inv.paidDaysAgo != null
    ? sqlDateTime(daysAgo(inv.paidDaysAgo, 11, 0)) : null;
  const paymentMethod = inv.status === 'paid' ? 'virement' : null;
  const dnId = inv.deliveryIdx != null && deliveryNoteIds[inv.deliveryIdx]
    ? deliveryNoteIds[inv.deliveryIdx].id : null;

  const invId = insertInvoice.run(
    RID, sid, inv.invoice_number, sqlDate(invoiceDate), dueDate,
    inv.total_ht, inv.tva, inv.total_ttc, inv.status,
    paymentDate, paymentMethod, inv.notes, dnId,
    sqlDateTime(invoiceDate), sqlDateTime(invoiceDate)
  ).lastInsertRowid;
  for (const it of inv.items) {
    const iid = it.ingredient ? (ingredientId[it.ingredient.toLowerCase()] || null) : null;
    const total_ht_line = Math.round(it.qty * it.price_ht * 100) / 100;
    insertInvoiceItem.run(invId, RID, it.description, it.qty, it.price_ht, it.tva, total_ht_line, iid);
  }
}
log(`3 supplier invoices: pending (PassionFroid), validated (TerreAzur), paid (Metro)`);

// ─── 10. Temperature zones (3) + 14 days of logs ───────────────────────────
section('Temperature logs (14 days, 3 zones)');
const demoZones = [
  { name: 'Chambre froide positive', type: 'cold_room', min: 2,   max: 4 },
  { name: 'Chambre froide négative', type: 'freezer',   min: -20, max: -18 },
  { name: 'Zone de stockage',        type: 'cold_room', min: 18,  max: 22 },
];
const existingZoneNames = new Set(
  all('SELECT name FROM temperature_zones WHERE restaurant_id = ?', [RID]).map(z => z.name)
);
const insertZone = db.prepare(
  `INSERT INTO temperature_zones (name, type, min_temp, max_temp, restaurant_id) VALUES (?, ?, ?, ?, ?)`
);
const updateZone = db.prepare(
  `UPDATE temperature_zones SET type = ?, min_temp = ?, max_temp = ? WHERE name = ? AND restaurant_id = ?`
);
for (const z of demoZones) {
  if (existingZoneNames.has(z.name)) {
    updateZone.run(z.type, z.min, z.max, z.name, RID);
  } else {
    insertZone.run(z.name, z.type, z.min, z.max, RID);
  }
}
const allZones = all(
  'SELECT id, name, min_temp, max_temp FROM temperature_zones WHERE restaurant_id = ? AND name IN (?, ?, ?)',
  [RID, demoZones[0].name, demoZones[1].name, demoZones[2].name]
);

const insertTempLog = db.prepare(
  `INSERT INTO temperature_logs (zone_id, temperature, recorded_by, recorded_at, is_alert, operator_name, restaurant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const operators = ['Thomas Moreau', 'Pierre Lefèvre', 'Julie Dubois'];
const seedTempLogs = db.transaction(() => {
  let total = 0;
  let alerts = 0;
  for (const zone of allZones) {
    const target = (zone.min_temp + zone.max_temp) / 2;
    const tolerance = (zone.max_temp - zone.min_temp) / 2;
    for (let d = 13; d >= 0; d--) {
      for (const hour of [9, 18]) {
        const ts = daysAgo(d, hour, Math.floor(Math.random() * 30));
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
        const operator = operators[Math.floor(Math.random() * operators.length)];
        insertTempLog.run(zone.id, temp, ownerId, sqlDateTime(ts), isAlert, operator, RID);
        total++;
      }
    }
  }
  return { total, alerts };
});
const { total: logTotal, alerts: logAlerts } = seedTempLogs();
log(`${logTotal} temperature readings across ${allZones.length} zones (${logAlerts} alerts)`);

// ─── 11. Cleaning logs (some completed, some pending) ──────────────────────
section('Cleaning logs (mix completed + pending)');
// Boot seed already creates cleaning_tasks. We log completions for ~70% of
// the daily/weekly tasks over the past 14 days, intentionally leaving some
// recent slots empty so the dashboard shows "à faire" entries.
const cleaningTasks = all('SELECT id, name, frequency FROM cleaning_tasks WHERE restaurant_id = ?', [RID]);
const insertCleanLog = db.prepare(
  `INSERT INTO cleaning_logs (task_id, completed_by, completed_at, notes, restaurant_id) VALUES (?, ?, ?, ?, ?)`
);
const seedCleanLogs = db.transaction(() => {
  let total = 0;
  for (const task of cleaningTasks) {
    const freq = task.frequency || 'daily';
    const interval = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : 14;
    // Leave the most-recent daily slot empty for ~1/3 of tasks
    const startD = (freq === 'daily' && task.id % 3 === 0) ? 12 : 13;
    for (let d = startD; d >= 0; d -= interval) {
      // Skip yesterday/today for some tasks to leave gaps
      if (d <= 1 && task.id % 4 === 0) continue;
      const ts = daysAgo(d, 22 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
      insertCleanLog.run(task.id, ownerId, sqlDateTime(ts), 'Fait conformément au plan', RID);
      total++;
    }
  }
  return total;
});
const cleanTotal = seedCleanLogs();
log(`${cleanTotal} cleaning executions across ${cleaningTasks.length} tasks (some slots intentionally empty)`);

// ─── 12. Traceability (2 — 1 beef lot, 1 salmon lot) ───────────────────────
section('Traceability (2 entries)');
const tracEntries = [
  {
    product: 'Onglet de bœuf (origine France)', supplier: 'PassionFroid',
    batch: 'PF-ONG-2604', daysAgo: 4, dlc: 5, temp: 2.6, qty: 4, unit: 'kg',
    notes: 'Lot conforme, chaîne du froid respectée. Origine: France.',
    bl: 'BL-PF-2604',
  },
  {
    product: 'Pavé de saumon Norvège', supplier: 'PassionFroid',
    batch: 'PF-SAU-2604', daysAgo: 3, dlc: 3, temp: 1.8, qty: 5, unit: 'kg',
    notes: 'Saumon emballé sous glace, aspect parfait. Approbation sanitaire FR-22-209-001.',
    bl: 'BL-PF-2604-2',
  },
];
const insertTrac = db.prepare(
  `INSERT INTO traceability_logs (product_name, supplier, batch_number, dlc, temperature_at_reception, quantity, unit, received_by, received_at, notes, etat_emballage, conformite_organoleptique, numero_bl, restaurant_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'intact', 'conforme', ?, ?)`
);
for (const t of tracEntries) {
  const received = daysAgo(t.daysAgo, 9, 30);
  const dlc = sqlDate(new Date(received.getTime() + t.dlc * 86_400_000));
  insertTrac.run(
    t.product, t.supplier, t.batch, dlc,
    t.temp, t.qty, t.unit, ownerId, sqlDateTime(received),
    t.notes, t.bl, RID
  );
}
log(`${tracEntries.length} traceability entries (1 beef + 1 salmon)`);

// ─── 13. HACCP plan check ──────────────────────────────────────────────────
section('HACCP plan');
const ccpCount = get('SELECT COUNT(*) as c FROM haccp_ccp WHERE restaurant_id = ?', [RID]);
const hazardCount = get('SELECT COUNT(*) as c FROM haccp_hazard_analysis WHERE restaurant_id = ?', [RID]);
log(`${hazardCount.c} dangers analysés, ${ccpCount.c} CCP (étape critique) en place`);

// ─── 14. Alto AI preferences ───────────────────────────────────────────────
section('Alto AI preferences');
const aiPrefs = [
  { key: 'establishment_type', value: 'bistrot gastronomique' },
  { key: 'tone',               value: 'tu' },
  { key: 'cuisine_style',      value: 'française traditionnelle revisitée' },
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
✅ Demo seed complete for "${RESTAURANT_NAME}" (restaurant_id=${RID}).

   Login restaurant :
     Gérant     → ${OWNER_EMAIL}   /  ${OWNER_PASSWORD}
     Cuisinier  → Thomas Moreau    PIN 1234
     Cuisinier  → Julie Dubois     PIN 5678
     Salle      → Marc Bernard     PIN 9012

   Login fournisseur (portail Metro Paris Nation) :
     Email      → ${SUPPLIER_DEMO_EMAIL}
     Mot de passe → ${SUPPLIER_DEMO_PASSWORD}
     PIN membre  → ${SUPPLIER_DEMO_PIN}  (Jean Dupont)

   Ouvrir l'app sur http://localhost:3000 et se connecter pour démarrer.
`);
