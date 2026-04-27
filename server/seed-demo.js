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

// Hoisted up so ensureSupplierDemoLogin() (which runs before the early-exit
// guard for already-seeded DBs) can reach them. Original definitions further
// down are now redundant but kept removed to avoid a second source of truth.
const SUPPLIER_DEMO_EMAIL = 'demo-fournisseur@restosuite.fr';
const SUPPLIER_DEMO_PASSWORD = 'Demo2026!';
const SUPPLIER_DEMO_PIN = '1111';

function log(msg) { console.log(`  ${msg}`); }
function section(title) { console.log(`\n▸ ${title}`); }

// ─── Supplier catalog demo data ─────────────────────────────────────────────
// Realistic French wholesale prices for the demo brasserie. Categories use the
// 13-bucket scheme from server/lib/mercuriale-categorize.js so the supplier
// portal review UI shows products under the same labels the categorizer
// auto-assigns. Adjust prices freely — this is sales-demo data, not a price
// ledger. NEVER store anything tenant-private in this constant.
const SUPPLIER_CATALOG_DATA = {
  // ~60 products across most categories — this is the supplier prospects log into
  // (demo-fournisseur@restosuite.fr) so the catalog has to look generously stocked.
  // SKU convention: MET-<3-letter-cat>-<NNN>. tva_rate=5.5 for foodstuffs (default),
  // 20 for alcohol — none here. packaging mirrors realistic French wholesale formats.
  'Metro Paris Nation': [
    // Viandes
    { sku: 'MET-VIA-001', name: 'Entrecôte de bœuf',     category: 'Viandes', unit: 'kg', price: 18.90, tva_rate: 5.5, packaging: 'Sous vide 2 pièces ~500g' },
    { sku: 'MET-VIA-002', name: 'Filet de poulet',       category: 'Viandes', unit: 'kg', price: 8.50,  tva_rate: 5.5, packaging: 'Barquette 2.5 kg' },
    { sku: 'MET-VIA-003', name: 'Côtes d\'agneau',       category: 'Viandes', unit: 'kg', price: 22.00, tva_rate: 5.5, packaging: 'Sous vide 1 kg' },
    { sku: 'MET-VIA-004', name: 'Bavette d\'aloyau',     category: 'Viandes', unit: 'kg', price: 16.50, tva_rate: 5.5, packaging: 'Sous vide 1.5 kg' },
    { sku: 'MET-VIA-005', name: 'Escalope de veau',      category: 'Viandes', unit: 'kg', price: 24.00, tva_rate: 5.5, packaging: 'Barquette 1 kg' },
    { sku: 'MET-VIA-006', name: 'Steak haché 15% MG',    category: 'Viandes', unit: 'kg', price: 9.80,  tva_rate: 5.5, packaging: 'Carton 5 kg (50×100g)' },
    { sku: 'MET-VIA-007', name: 'Magret de canard',      category: 'Viandes', unit: 'kg', price: 19.50, tva_rate: 5.5, packaging: 'Sous vide 2 pièces ~700g' },
    { sku: 'MET-VIA-008', name: 'Saucisse de Toulouse',  category: 'Viandes', unit: 'kg', price: 7.90,  tva_rate: 5.5, packaging: 'Barquette 1 kg' },
    { sku: 'MET-VIA-009', name: 'Cuisses de poulet',     category: 'Viandes', unit: 'kg', price: 6.20,  tva_rate: 5.5, packaging: 'Carton 5 kg' },
    { sku: 'MET-VIA-010', name: 'Jarret de porc',        category: 'Viandes', unit: 'kg', price: 5.90,  tva_rate: 5.5, packaging: 'Sous vide ~1.2 kg' },
    // Charcuterie
    { sku: 'MET-CHA-001', name: 'Lardons fumés',         category: 'Charcuterie', unit: 'kg', price: 6.50,  tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    { sku: 'MET-CHA-002', name: 'Jambon de Paris',       category: 'Charcuterie', unit: 'kg', price: 9.80,  tva_rate: 5.5, packaging: 'Bloc sous vide ~2 kg' },
    { sku: 'MET-CHA-003', name: 'Saucisson sec',         category: 'Charcuterie', unit: 'kg', price: 18.50, tva_rate: 5.5, packaging: 'Lot de 4 pièces ~250g' },
    // Poissons
    { sku: 'MET-POI-001', name: 'Filet de saumon',       category: 'Poissons', unit: 'kg', price: 19.00, tva_rate: 5.5, packaging: 'Caisse 2 kg' },
    { sku: 'MET-POI-002', name: 'Cabillaud',             category: 'Poissons', unit: 'kg', price: 15.50, tva_rate: 5.5, packaging: 'Caisse 3 kg sur glace' },
    { sku: 'MET-POI-003', name: 'Crevettes roses cuites', category: 'Poissons', unit: 'kg', price: 14.90, tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    { sku: 'MET-POI-004', name: 'Moules de bouchot',     category: 'Poissons', unit: 'kg', price: 4.50,  tva_rate: 5.5, packaging: 'Sac 4 kg AOP' },
    { sku: 'MET-POI-005', name: 'Bar de ligne',          category: 'Poissons', unit: 'kg', price: 28.00, tva_rate: 5.5, packaging: 'Pièce entière 0.6–1 kg' },
    { sku: 'MET-POI-006', name: 'Thon rouge',            category: 'Poissons', unit: 'kg', price: 32.00, tva_rate: 5.5, packaging: 'Pavé sous vide 500g' },
    { sku: 'MET-POI-007', name: 'Noix de Saint-Jacques', category: 'Poissons', unit: 'kg', price: 38.00, tva_rate: 5.5, packaging: 'Barquette 500g' },
    { sku: 'MET-POI-008', name: 'Gambas',                category: 'Poissons', unit: 'kg', price: 22.00, tva_rate: 5.5, packaging: 'Boîte 2 kg surgelé' },
    // Légumes
    { sku: 'MET-LEG-001', name: 'Pommes de terre',       category: 'Légumes', unit: 'kg', price: 1.20, tva_rate: 5.5, packaging: 'Sac 25 kg' },
    { sku: 'MET-LEG-002', name: 'Carottes',              category: 'Légumes', unit: 'kg', price: 1.50, tva_rate: 5.5, packaging: 'Sac 10 kg' },
    { sku: 'MET-LEG-003', name: 'Oignons jaunes',        category: 'Légumes', unit: 'kg', price: 1.80, tva_rate: 5.5, packaging: 'Filet 5 kg' },
    { sku: 'MET-LEG-004', name: 'Tomates grappe',        category: 'Légumes', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Cagette 6 kg' },
    { sku: 'MET-LEG-005', name: 'Courgettes',            category: 'Légumes', unit: 'kg', price: 2.80, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'MET-LEG-006', name: 'Haricots verts',        category: 'Légumes', unit: 'kg', price: 4.90, tva_rate: 5.5, packaging: 'Cagette 3 kg' },
    { sku: 'MET-LEG-007', name: 'Champignons de Paris',  category: 'Légumes', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Barquette 500g' },
    { sku: 'MET-LEG-008', name: 'Poireaux',              category: 'Légumes', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Botte 1 kg' },
    { sku: 'MET-LEG-009', name: 'Épinards frais',        category: 'Légumes', unit: 'kg', price: 5.50, tva_rate: 5.5, packaging: 'Sachet 1 kg lavé' },
    { sku: 'MET-LEG-010', name: 'Ail',                   category: 'Légumes', unit: 'kg', price: 6.00, tva_rate: 5.5, packaging: 'Filet 1 kg' },
    // Fruits
    { sku: 'MET-FRU-001', name: 'Citrons',               category: 'Fruits', unit: 'kg', price: 2.80, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'MET-FRU-002', name: 'Pommes Golden',         category: 'Fruits', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Cagette 7 kg' },
    { sku: 'MET-FRU-003', name: 'Fraises',               category: 'Fruits', unit: 'kg', price: 8.90, tva_rate: 5.5, packaging: 'Barquette 500g x8' },
    { sku: 'MET-FRU-004', name: 'Framboises',            category: 'Fruits', unit: 'kg', price: 18.00, tva_rate: 5.5, packaging: 'Barquette 125g x12' },
    // Produits laitiers
    { sku: 'MET-LAI-001', name: 'Beurre doux',           category: 'Produits laitiers', unit: 'kg', price: 8.50,  tva_rate: 5.5, packaging: 'Plaque 5 kg' },
    { sku: 'MET-LAI-002', name: 'Crème fraîche 35%',     category: 'Produits laitiers', unit: 'L',  price: 4.20,  tva_rate: 5.5, packaging: 'Bidon 5 L' },
    { sku: 'MET-LAI-003', name: 'Lait entier',           category: 'Produits laitiers', unit: 'L',  price: 1.10,  tva_rate: 5.5, packaging: 'Brique 1 L x12' },
    { sku: 'MET-LAI-004', name: 'Parmesan Reggiano',     category: 'Produits laitiers', unit: 'kg', price: 22.00, tva_rate: 5.5, packaging: 'Pointe 1 kg sous vide' },
    { sku: 'MET-LAI-005', name: 'Gruyère râpé',          category: 'Produits laitiers', unit: 'kg', price: 9.50,  tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    { sku: 'MET-LAI-006', name: 'Mozzarella',            category: 'Produits laitiers', unit: 'kg', price: 8.00,  tva_rate: 5.5, packaging: 'Boules 125g x10' },
    { sku: 'MET-LAI-007', name: 'Œufs plein air x30',    category: 'Produits laitiers', unit: 'plateau', price: 8.50, tva_rate: 5.5, packaging: 'Plateau 30 œufs' },
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
    { sku: 'MET-EPI-003', name: 'Riz basmati',           category: 'Épicerie sèche', unit: 'kg', price: 2.20, tva_rate: 5.5, packaging: 'Sac 5 kg' },
    { sku: 'MET-EPI-004', name: 'Lentilles vertes',      category: 'Épicerie sèche', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Sac 5 kg du Puy' },
    // Surgelés
    { sku: 'MET-SUR-001', name: 'Frites tradition',      category: 'Surgelés', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Carton 10 kg' },
    { sku: 'MET-SUR-002', name: 'Petits pois',           category: 'Surgelés', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Carton 2.5 kg' },
    // Boissons (non-alcoolisées → TVA 5.5)
    { sku: 'MET-BOI-001', name: 'Eau Évian 1.5L x6',     category: 'Boissons', unit: 'lot', price: 4.50,  tva_rate: 5.5, packaging: 'Pack de 6 bouteilles 1.5 L' },
    { sku: 'MET-BOI-002', name: 'Coca-Cola 33cl x24',    category: 'Boissons', unit: 'lot', price: 18.00, tva_rate: 5.5, packaging: 'Pack de 24 canettes 33 cl' },
  ],

  // ~40 products: F&L specialist with slightly tighter prices on hero items and
  // a deeper bench (heritage tomatoes, herbs, exotic fruits) Metro doesn't carry.
  // SKU convention: POM-<3-letter-cat>-<NNN>. All TVA 5.5 (frais alimentaire).
  'Pomona TerreAzur': [
    // Légumes
    { sku: 'POM-LEG-001', name: 'Pommes de terre Bintje',    category: 'Légumes', unit: 'kg', price: 1.10, tva_rate: 5.5, packaging: 'Sac 25 kg' },
    { sku: 'POM-LEG-002', name: 'Carottes nouvelles',        category: 'Légumes', unit: 'kg', price: 1.40, tva_rate: 5.5, packaging: 'Cagette 10 kg' },
    { sku: 'POM-LEG-003', name: 'Oignons rosés de Roscoff',  category: 'Légumes', unit: 'kg', price: 2.20, tva_rate: 5.5, packaging: 'Filet 5 kg AOP' },
    { sku: 'POM-LEG-004', name: 'Tomates anciennes',         category: 'Légumes', unit: 'kg', price: 4.80, tva_rate: 5.5, packaging: 'Cagette 4 kg variétés' },
    { sku: 'POM-LEG-005', name: 'Courgettes vertes',         category: 'Légumes', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'POM-LEG-006', name: 'Haricots verts extra-fins', category: 'Légumes', unit: 'kg', price: 5.50, tva_rate: 5.5, packaging: 'Cagette 3 kg' },
    { sku: 'POM-LEG-007', name: 'Champignons de Paris bruns', category: 'Légumes', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Barquette 500g' },
    { sku: 'POM-LEG-008', name: 'Poireaux nouveaux',         category: 'Légumes', unit: 'kg', price: 2.20, tva_rate: 5.5, packaging: 'Botte 1 kg' },
    { sku: 'POM-LEG-009', name: 'Épinards branches',         category: 'Légumes', unit: 'kg', price: 5.00, tva_rate: 5.5, packaging: 'Sachet 1 kg' },
    { sku: 'POM-LEG-010', name: 'Ail rose de Lautrec',       category: 'Légumes', unit: 'kg', price: 8.00, tva_rate: 5.5, packaging: 'Tresse 1 kg IGP' },
    { sku: 'POM-LEG-011', name: 'Endives belges',            category: 'Légumes', unit: 'kg', price: 2.80, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'POM-LEG-012', name: 'Artichauts violets',        category: 'Légumes', unit: 'pièce', price: 2.50, tva_rate: 5.5, packaging: 'Cagette 12 pièces' },
    { sku: 'POM-LEG-013', name: 'Asperges vertes',           category: 'Légumes', unit: 'kg', price: 9.50, tva_rate: 5.5, packaging: 'Botte 500g' },
    { sku: 'POM-LEG-014', name: 'Aubergines',                category: 'Légumes', unit: 'kg', price: 2.40, tva_rate: 5.5, packaging: 'Cagette 6 kg' },
    { sku: 'POM-LEG-015', name: 'Poivrons rouges',           category: 'Légumes', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'POM-LEG-016', name: 'Fenouil',                   category: 'Légumes', unit: 'kg', price: 3.00, tva_rate: 5.5, packaging: 'Cagette 8 kg' },
    { sku: 'POM-LEG-017', name: 'Radis roses (botte)',       category: 'Légumes', unit: 'botte', price: 1.20, tva_rate: 5.5, packaging: 'Botte 250g' },
    { sku: 'POM-LEG-018', name: 'Salade laitue batavia',     category: 'Légumes', unit: 'pièce', price: 1.10, tva_rate: 5.5, packaging: 'Pièce ~400g' },
    { sku: 'POM-LEG-019', name: 'Roquette',                  category: 'Légumes', unit: 'kg', price: 8.50, tva_rate: 5.5, packaging: 'Sachet 500g lavé' },
    { sku: 'POM-LEG-020', name: 'Mâche',                     category: 'Légumes', unit: 'kg', price: 12.00, tva_rate: 5.5, packaging: 'Sachet 250g lavé' },
    // Herbes (catégorisées Légumes par le catégoriseur)
    { sku: 'POM-HER-001', name: 'Persil plat (botte)',       category: 'Légumes', unit: 'botte', price: 0.80, tva_rate: 5.5, packaging: 'Botte ~80g' },
    { sku: 'POM-HER-002', name: 'Basilic frais (botte)',     category: 'Légumes', unit: 'botte', price: 1.20, tva_rate: 5.5, packaging: 'Botte ~50g' },
    { sku: 'POM-HER-003', name: 'Coriandre (botte)',         category: 'Légumes', unit: 'botte', price: 1.00, tva_rate: 5.5, packaging: 'Botte ~80g' },
    { sku: 'POM-HER-004', name: 'Menthe fraîche (botte)',    category: 'Légumes', unit: 'botte', price: 1.20, tva_rate: 5.5, packaging: 'Botte ~50g' },
    { sku: 'POM-HER-005', name: 'Thym frais (botte)',        category: 'Légumes', unit: 'botte', price: 1.50, tva_rate: 5.5, packaging: 'Botte ~30g' },
    // Fruits
    { sku: 'POM-FRU-001', name: 'Citrons primofiori',        category: 'Fruits', unit: 'kg', price: 2.50, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'POM-FRU-002', name: 'Pommes Granny Smith',       category: 'Fruits', unit: 'kg', price: 2.80, tva_rate: 5.5, packaging: 'Cagette 7 kg' },
    { sku: 'POM-FRU-003', name: 'Pommes Pink Lady',          category: 'Fruits', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Cagette 6 kg' },
    { sku: 'POM-FRU-004', name: 'Fraises gariguette',        category: 'Fruits', unit: 'kg', price: 9.50, tva_rate: 5.5, packaging: 'Barquette 500g x6' },
    { sku: 'POM-FRU-005', name: 'Framboises',                category: 'Fruits', unit: 'kg', price: 17.50, tva_rate: 5.5, packaging: 'Barquette 125g x12' },
    { sku: 'POM-FRU-006', name: 'Mangues',                   category: 'Fruits', unit: 'kg', price: 4.20, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'POM-FRU-007', name: 'Ananas Victoria',           category: 'Fruits', unit: 'pièce', price: 2.80, tva_rate: 5.5, packaging: 'Cagette 8 pièces' },
    { sku: 'POM-FRU-008', name: 'Bananes',                   category: 'Fruits', unit: 'kg', price: 1.80, tva_rate: 5.5, packaging: 'Carton 18 kg' },
    { sku: 'POM-FRU-009', name: 'Oranges sanguines',         category: 'Fruits', unit: 'kg', price: 2.90, tva_rate: 5.5, packaging: 'Cagette 10 kg' },
    { sku: 'POM-FRU-010', name: 'Kiwis',                     category: 'Fruits', unit: 'kg', price: 3.50, tva_rate: 5.5, packaging: 'Plateau 3 kg' },
    { sku: 'POM-FRU-011', name: 'Pamplemousses roses',       category: 'Fruits', unit: 'kg', price: 2.20, tva_rate: 5.5, packaging: 'Cagette 9 kg' },
    { sku: 'POM-FRU-012', name: 'Poires Williams',           category: 'Fruits', unit: 'kg', price: 3.20, tva_rate: 5.5, packaging: 'Cagette 6 kg' },
    { sku: 'POM-FRU-013', name: 'Cerises',                   category: 'Fruits', unit: 'kg', price: 12.00, tva_rate: 5.5, packaging: 'Barquette 500g x10' },
    { sku: 'POM-FRU-014', name: 'Abricots',                  category: 'Fruits', unit: 'kg', price: 5.80, tva_rate: 5.5, packaging: 'Cagette 5 kg' },
    { sku: 'POM-FRU-015', name: 'Melons charentais',         category: 'Fruits', unit: 'pièce', price: 3.50, tva_rate: 5.5, packaging: 'Cagette 8 pièces' },
  ],

  // ~30 products: drinks-only wholesaler. Bottles ('bouteille'), kegs ('fût')
  // and packs ('lot') are all real units the brasserie buyer will see — we
  // intentionally don't normalize to per-litre prices here.
  // SKU convention: FRB-<3-letter-type>-<NNN> (VIN/BIE/SOF/SPI). Alcoholic
  // drinks → TVA 20%; non-alcoholic softs/eaux/jus → TVA 5.5%.
  'France Boissons': [
    // Vins (TVA 20% — alcohol)
    { sku: 'FRB-VIN-001', name: 'Côtes du Rhône rouge 75cl',   category: 'Boissons', unit: 'bouteille', price: 5.50,  tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'FRB-VIN-002', name: 'Bordeaux supérieur 75cl',     category: 'Boissons', unit: 'bouteille', price: 7.20,  tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'FRB-VIN-003', name: 'Bourgogne aligoté 75cl',      category: 'Boissons', unit: 'bouteille', price: 9.80,  tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'FRB-VIN-004', name: 'Sancerre blanc 75cl',         category: 'Boissons', unit: 'bouteille', price: 13.50, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'FRB-VIN-005', name: 'Côtes de Provence rosé 75cl', category: 'Boissons', unit: 'bouteille', price: 6.80,  tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'FRB-VIN-006', name: 'Champagne brut 75cl',         category: 'Boissons', unit: 'bouteille', price: 22.00, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'FRB-VIN-007', name: 'Crémant d\'Alsace 75cl',      category: 'Boissons', unit: 'bouteille', price: 11.50, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    { sku: 'FRB-VIN-008', name: 'Pouilly-Fumé 75cl',           category: 'Boissons', unit: 'bouteille', price: 16.00, tva_rate: 20, packaging: 'Carton 6 bouteilles' },
    // Bières (TVA 20% — alcohol)
    { sku: 'FRB-BIE-001', name: 'Heineken fût 30L',            category: 'Boissons', unit: 'fût', price: 95.00, tva_rate: 20, packaging: 'Fût 30 L' },
    { sku: 'FRB-BIE-002', name: 'Stella Artois fût 30L',       category: 'Boissons', unit: 'fût', price: 88.00, tva_rate: 20, packaging: 'Fût 30 L' },
    { sku: 'FRB-BIE-003', name: 'Leffe Blonde fût 20L',        category: 'Boissons', unit: 'fût', price: 78.00, tva_rate: 20, packaging: 'Fût 20 L' },
    { sku: 'FRB-BIE-004', name: '1664 33cl x24',               category: 'Boissons', unit: 'lot', price: 22.00, tva_rate: 20, packaging: 'Pack 24 canettes 33 cl' },
    { sku: 'FRB-BIE-005', name: 'Carlsberg 33cl x24',          category: 'Boissons', unit: 'lot', price: 19.50, tva_rate: 20, packaging: 'Pack 24 canettes 33 cl' },
    { sku: 'FRB-BIE-006', name: 'Guinness 50cl x12',           category: 'Boissons', unit: 'lot', price: 28.00, tva_rate: 20, packaging: 'Pack 12 canettes 50 cl' },
    // Soft drinks + eaux (TVA 5.5 — non-alcoholic)
    { sku: 'FRB-SOF-001', name: 'Coca-Cola 33cl x24',          category: 'Boissons', unit: 'lot', price: 17.50, tva_rate: 5.5, packaging: 'Pack 24 canettes 33 cl' },
    { sku: 'FRB-SOF-002', name: 'Coca-Cola Zero 33cl x24',     category: 'Boissons', unit: 'lot', price: 17.50, tva_rate: 5.5, packaging: 'Pack 24 canettes 33 cl' },
    { sku: 'FRB-SOF-003', name: 'Orangina 33cl x24',           category: 'Boissons', unit: 'lot', price: 18.00, tva_rate: 5.5, packaging: 'Pack 24 canettes 33 cl' },
    { sku: 'FRB-SOF-004', name: 'Schweppes Tonic 25cl x24',    category: 'Boissons', unit: 'lot', price: 19.50, tva_rate: 5.5, packaging: 'Pack 24 bouteilles 25 cl' },
    { sku: 'FRB-SOF-005', name: 'Perrier 33cl x24',            category: 'Boissons', unit: 'lot', price: 16.50, tva_rate: 5.5, packaging: 'Pack 24 bouteilles 33 cl' },
    { sku: 'FRB-SOF-006', name: 'Eau Vittel 1L x12',           category: 'Boissons', unit: 'lot', price: 8.50,  tva_rate: 5.5, packaging: 'Pack 12 bouteilles 1 L' },
    { sku: 'FRB-SOF-007', name: 'Jus d\'orange Tropicana 1L x6', category: 'Boissons', unit: 'lot', price: 14.50, tva_rate: 5.5, packaging: 'Pack 6 briques 1 L' },
    { sku: 'FRB-SOF-008', name: 'Limonade artisanale 33cl x12', category: 'Boissons', unit: 'lot', price: 12.00, tva_rate: 5.5, packaging: 'Pack 12 bouteilles 33 cl' },
    // Spiritueux (TVA 20% — alcohol)
    { sku: 'FRB-SPI-001', name: 'Whisky JB 70cl',              category: 'Boissons', unit: 'bouteille', price: 18.50, tva_rate: 20, packaging: 'Bouteille 70 cl' },
    { sku: 'FRB-SPI-002', name: 'Vodka Smirnoff 70cl',         category: 'Boissons', unit: 'bouteille', price: 16.00, tva_rate: 20, packaging: 'Bouteille 70 cl' },
    { sku: 'FRB-SPI-003', name: 'Gin Bombay Sapphire 70cl',    category: 'Boissons', unit: 'bouteille', price: 24.00, tva_rate: 20, packaging: 'Bouteille 70 cl' },
    { sku: 'FRB-SPI-004', name: 'Rhum Bacardi 70cl',           category: 'Boissons', unit: 'bouteille', price: 17.50, tva_rate: 20, packaging: 'Bouteille 70 cl' },
    { sku: 'FRB-SPI-005', name: 'Cognac Hennessy VS 70cl',     category: 'Boissons', unit: 'bouteille', price: 38.00, tva_rate: 20, packaging: 'Bouteille 70 cl' },
    { sku: 'FRB-SPI-006', name: 'Pastis Ricard 1L',            category: 'Boissons', unit: 'bouteille', price: 18.50, tva_rate: 20, packaging: 'Bouteille 1 L' },
    { sku: 'FRB-SPI-007', name: 'Liqueur Cointreau 70cl',      category: 'Boissons', unit: 'bouteille', price: 22.00, tva_rate: 20, packaging: 'Bouteille 70 cl' },
    { sku: 'FRB-SPI-008', name: 'Martini Bianco 1L',           category: 'Boissons', unit: 'bouteille', price: 12.50, tva_rate: 20, packaging: 'Bouteille 1 L' },
  ],
};

// Idempotent: deletes the supplier's existing demo catalog rows then bulk-
// inserts the fresh list inside one transaction. supplier_catalog has no
// UNIQUE constraint on (supplier_id, product_name), so INSERT OR REPLACE
// would silently keep duplicates on every re-run — DELETE-then-INSERT is
// the only safe pattern here. Noops for any supplier that doesn't exist
// yet (the full-seed path will create them and call this again).
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

// ─── Incremental supplier-portal demo provisioning ─────────────────────────
// Production was seeded before the demo supplier credentials existed (commit
// 4dfb53e). The early-exit guard below blocks a full re-seed, so without this
// helper there's no way to add the supplier-portal rows to an existing demo DB
// short of hand-editing SQLite. Runs idempotently before the guard: if the
// Metro supplier row exists we attach the company login + member account; if
// not we no-op and let the full seed below create both from scratch.
function ensureSupplierDemoLogin() {
  const metro = get(
    'SELECT id FROM suppliers WHERE name = ? AND restaurant_id = ?',
    ['Metro Paris Nation', RID]
  );
  if (!metro) return false; // full seed path will create everything

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

// ─── Idempotency guard ─────────────────────────────────────────────────────
const existing = get('SELECT id FROM accounts WHERE email = ?', [OWNER_EMAIL]);
if (existing) {
  const ensured = ensureSupplierDemoLogin();
  const catalog = ensureSupplierCatalogs();
  if (ensured) {
    console.log(`✅ Demo data already present (${OWNER_EMAIL} exists, account id=${existing.id}). Refreshed supplier-portal demo login: ${SUPPLIER_DEMO_EMAIL} / ${SUPPLIER_DEMO_PASSWORD} (PIN ${SUPPLIER_DEMO_PIN}).`);
  } else {
    console.log(`✅ Demo data already present (${OWNER_EMAIL} exists, account id=${existing.id}). Nothing to do.`);
  }
  if (catalog.touchedSuppliers > 0) {
    console.log(`   ↳ Refreshed supplier catalogs: ${catalog.totalInserted} products across ${catalog.touchedSuppliers} suppliers.`);
  }
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
// The Metro entry doubles as the demo supplier-portal login. SUPPLIER_DEMO_*
// constants are hoisted to the top of the file so ensureSupplierDemoLogin()
// can reach them when re-seeding an existing demo DB.
const suppliers = [
  { name: 'Metro Paris Nation',   contact: 'Jean Dupont', phone: '01 40 09 40 00', email: SUPPLIER_DEMO_EMAIL,            rating: 4, notes: 'Grossiste généraliste, livraison 6j/7' },
  { name: 'Pomona TerreAzur',     contact: 'Sylvie D.',   phone: '01 49 29 30 00', email: 'commandes@pomona-terreazur.fr', rating: 5, notes: 'Fruits & légumes, très bon rapport qualité/prix' },
  { name: 'Bigard Boucherie Pro', contact: 'Julien B.',   phone: '02 98 85 33 33', email: 'pro@bigard.fr',                rating: 5, notes: 'Viandes françaises, traçabilité complète' },
  { name: 'France Boissons',      contact: 'Karine L.',   phone: '03 88 65 65 65', email: 'commandes@france-boissons.fr', rating: 4, notes: 'Boissons & spiritueux' },
  { name: 'Brake France',         contact: 'Pierre M.',   phone: '01 58 31 99 00', email: 'pro@brake.fr',                 rating: 3, notes: 'Surgelés & produits de la mer' },
  { name: 'Marée du Jour',        contact: 'Antoine R.',  phone: '02 98 44 20 20', email: 'commandes@maree-du-jour.fr',   rating: 5, notes: 'Poissonnerie Rungis, arrivages quotidiens' },
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

// Wire the company-login credentials onto the Metro row. password_hash and
// contact_name live in the suppliers table (not supplier_accounts) — that's
// what /api/supplier-portal/company-login authenticates against.
const supplierDemoHash = bcrypt.hashSync(SUPPLIER_DEMO_PASSWORD, 10);
run(
  `UPDATE suppliers
      SET password_hash = ?, contact_name = ?
    WHERE id = ? AND restaurant_id = ?`,
  [supplierDemoHash, 'Jean Dupont (commercial Metro)', supplierIds['Metro Paris Nation'], RID]
);
log(`Metro company-login: ${SUPPLIER_DEMO_EMAIL} / ${SUPPLIER_DEMO_PASSWORD}`);

// ─── 3b. Supplier portal accounts (Metro, Pomona, France Boissons) ─────────
section('Supplier portal accounts');
const supplierLogins = [
  { supplier: 'Metro Paris Nation',   name: 'Jean Dupont',      email: SUPPLIER_DEMO_EMAIL,             pin: SUPPLIER_DEMO_PIN },
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

// ─── 3c. Supplier catalogs (Metro / Pomona / France Boissons) ──────────────
// Same helper used by the early-exit guard so any future re-seed (or first-
// run) ends with the demo catalogs in identical state.
section('Supplier catalogs');
{
  const catalog = ensureSupplierCatalogs();
  log(`${catalog.totalInserted} products inserted across ${catalog.touchedSuppliers} suppliers`);
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

// ─── 5b. Stock quantities (realistic brasserie levels) ─────────────────────
section('Stock quantities');
const stockItems = [
  ['entrecôte de bœuf',        5000, 'g',      1000],
  ['suprême de volaille',      4000, 'g',      1000],
  ['cuisse de canard confite',   20, 'pièce',     5],
  ['bœuf haché 15% MG',        3000, 'g',       500],
  ['lardons fumés',            2000, 'g',       500],
  ['foie de porc',             1500, 'g',         0],
  ['pavé de saumon',           3000, 'g',      1000],
  ['saumon extra-frais sashimi', 1500, 'g',      500],
  ['pomme de terre bintje',   15000, 'g',      3000],
  ['champignons de Paris',     2000, 'g',       500],
  ['cèpes frais',               800, 'g',         0],
  ['oignon jaune',             5000, 'g',      1000],
  ['échalote grise',           1500, 'g',       300],
  ['ail rose',                 1000, 'g',       200],
  ['cœur de romaine',            20, 'pièce',     5],
  ['tomate cœur de bœuf',      3000, 'g',       500],
  ['pomme golden',             5000, 'g',      1000],
  ['beurre AOP Charentes',     3000, 'g',       500],
  ['crème liquide 35% MG',     5000, 'ml',     1000],
  ['parmesan reggiano',        1500, 'g',       300],
  ['gruyère râpé',             2000, 'g',       500],
  ['œuf fermier',                60, 'pièce',    12],
  ['mascarpone',               1000, 'g',         0],
  ['pain de mie brioché',      2000, 'g',       500],
  ['farine T55',               5000, 'g',      1000],
  ['riz arborio',              3000, 'g',       500],
  ['bouillon de volaille',     5000, 'ml',     1000],
  ['vin blanc de cuisson',     3000, 'ml',      500],
  ['sucre semoule',            3000, 'g',       500],
  ['chocolat noir 70%',        1500, 'g',       300],
  ['gousse de vanille',          10, 'pièce',     2],
  ['miel de Provence',         1000, 'g',         0],
  ['thym frais',                  5, 'botte',     1],
  ['persil plat',                 5, 'botte',     1],
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
log(`${stockCount} stock items with realistic quantities`);

// ─── 5c. Sales data (orders + order_items, last 30 days) ────────────────────
section('Sales data (orders)');
// Lookup recipe IDs by name (inserted in section 5)
const recipeRow = (name) => get('SELECT id FROM recipes WHERE name = ? AND restaurant_id = ?', [name, RID]);
const popularPlats = [
  { name: 'Burger maison bœuf fermier',          weight: 8 },
  { name: 'Entrecôte grillée, frites maison',    weight: 7 },
  { name: 'Confit de canard, pommes sarladaises', weight: 6 },
  { name: 'Pavé de saumon beurre blanc',          weight: 5 },
  { name: 'Risotto aux cèpes',                    weight: 4 },
  { name: 'Suprême de volaille, jus au fond de veau', weight: 3 },
].map(r => ({ ...r, row: recipeRow(r.name) })).filter(r => r.row);

const popularEntrees = [
  { name: 'Soupe à l\'oignon gratinée',  weight: 5 },
  { name: 'Salade César',                weight: 4 },
  { name: 'Tartare de saumon à l\'aneth', weight: 3 },
  { name: 'Terrine de campagne maison',  weight: 2 },
].map(r => ({ ...r, row: recipeRow(r.name) })).filter(r => r.row);

const popularDesserts = [
  { name: 'Crème brûlée à la vanille',          weight: 5 },
  { name: 'Tiramisu au café',                   weight: 4 },
  { name: 'Tarte Tatin, crème épaisse',         weight: 3 },
  { name: 'Île flottante, caramel au beurre salé', weight: 2 },
].map(r => ({ ...r, row: recipeRow(r.name) })).filter(r => r.row);

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.row.id;
  }
  return items[0].row.id;
}

const insertOrder = db.prepare(
  `INSERT INTO orders (restaurant_id, table_number, status, total_cost, created_at) VALUES (?, ?, 'servi', 0, ?)`
);
const insertOrderItem = db.prepare(
  `INSERT INTO order_items (order_id, recipe_id, quantity, status, restaurant_id) VALUES (?, ?, ?, 'servi', ?)`
);

const seedOrders = db.transaction(() => {
  let orderCount = 0, itemCount = 0;
  const now = Date.now();
  for (let d = 29; d >= 0; d--) {
    // ~10-18 covers per service (midi + soir) depending on day of week
    const dayOfWeek = new Date(now - d * 86400000).getDay(); // 0=Sun
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const ordersPerDay = isWeekend ? 14 + Math.floor(Math.random() * 6) : 8 + Math.floor(Math.random() * 6);

    for (let o = 0; o < ordersPerDay; o++) {
      const isMidi = o < ordersPerDay / 2;
      const baseHour = isMidi ? 12 : 20;
      const ts = new Date(now - d * 86400000);
      ts.setHours(baseHour, Math.floor(Math.random() * 90), 0, 0);
      const tableNum = 1 + Math.floor(Math.random() * 12);
      const ord = insertOrder.run(RID, tableNum, ts.toISOString().replace('T', ' ').slice(0, 19));
      const orderId = ord.lastInsertRowid;

      // Entrée (40% chance)
      if (Math.random() < 0.4 && popularEntrees.length > 0) {
        insertOrderItem.run(orderId, weightedPick(popularEntrees), 1, RID);
        itemCount++;
      }
      // Plat (always)
      if (popularPlats.length > 0) {
        const qty = Math.random() < 0.15 ? 2 : 1; // 15% chance of 2 same dish
        insertOrderItem.run(orderId, weightedPick(popularPlats), qty, RID);
        itemCount++;
      }
      // Dessert (35% chance)
      if (Math.random() < 0.35 && popularDesserts.length > 0) {
        insertOrderItem.run(orderId, weightedPick(popularDesserts), 1, RID);
        itemCount++;
      }
      orderCount++;
    }
  }
  return { orderCount, itemCount };
});
const { orderCount, itemCount } = seedOrders();
log(`${orderCount} orders + ${itemCount} order items (30 days)`);

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

   Login restaurant :
     Gérant     → ${OWNER_EMAIL}   /  ${OWNER_PASSWORD}
     Cuisinier  → Thomas Moreau    PIN 1234
     Équipier   → Julie Dubois     PIN 5678
     Salle      → Marc Bernard     PIN 9012

   Login fournisseur (portail Metro Paris Nation) :
     Email      → ${SUPPLIER_DEMO_EMAIL}
     Mot de passe → ${SUPPLIER_DEMO_PASSWORD}
     PIN membre  → ${SUPPLIER_DEMO_PIN}  (Jean Dupont)
`);
