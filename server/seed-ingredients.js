// ═══════════════════════════════════════════
// Seed: Common French kitchen ingredients
// with average market prices (France 2026)
// ═══════════════════════════════════════════

const commonIngredients = [
  // Légumes
  { name: 'oignon', category: 'légumes', default_unit: 'g', price_per_unit: 1.50, price_unit: 'kg', waste_percent: 10 },
  { name: 'carotte', category: 'légumes', default_unit: 'g', price_per_unit: 1.80, price_unit: 'kg', waste_percent: 15 },
  { name: 'pomme de terre', category: 'légumes', default_unit: 'g', price_per_unit: 1.20, price_unit: 'kg', waste_percent: 15 },
  { name: 'tomate', category: 'légumes', default_unit: 'g', price_per_unit: 3.50, price_unit: 'kg', waste_percent: 5 },
  { name: 'ail', category: 'légumes', default_unit: 'g', price_per_unit: 8.00, price_unit: 'kg', waste_percent: 20 },
  { name: 'échalote', category: 'légumes', default_unit: 'g', price_per_unit: 5.50, price_unit: 'kg', waste_percent: 10 },
  { name: 'poireau', category: 'légumes', default_unit: 'g', price_per_unit: 2.50, price_unit: 'kg', waste_percent: 30 },
  { name: 'céleri', category: 'légumes', default_unit: 'g', price_per_unit: 3.00, price_unit: 'kg', waste_percent: 25 },
  { name: 'champignon', category: 'légumes', default_unit: 'g', price_per_unit: 6.00, price_unit: 'kg', waste_percent: 5 },
  { name: 'salade', category: 'légumes', default_unit: 'pièce', price_per_unit: 1.50, price_unit: 'pièce', waste_percent: 20 },
  { name: 'courgette', category: 'légumes', default_unit: 'g', price_per_unit: 2.50, price_unit: 'kg', waste_percent: 5 },
  { name: 'poivron', category: 'légumes', default_unit: 'g', price_per_unit: 4.00, price_unit: 'kg', waste_percent: 15 },

  // Fruits
  { name: 'citron', category: 'fruits', default_unit: 'pièce', price_per_unit: 0.50, price_unit: 'pièce', waste_percent: 30 },
  { name: 'pomme', category: 'fruits', default_unit: 'g', price_per_unit: 2.50, price_unit: 'kg', waste_percent: 10 },

  // Viandes
  { name: 'poulet entier', category: 'viandes', default_unit: 'g', price_per_unit: 6.50, price_unit: 'kg', waste_percent: 35 },
  { name: 'suprême de volaille', category: 'viandes', default_unit: 'g', price_per_unit: 12.00, price_unit: 'kg', waste_percent: 5 },
  { name: 'entrecôte', category: 'viandes', default_unit: 'g', price_per_unit: 28.00, price_unit: 'kg', waste_percent: 10 },
  { name: 'filet de bœuf', category: 'viandes', default_unit: 'g', price_per_unit: 45.00, price_unit: 'kg', waste_percent: 15 },
  { name: 'porc (échine)', category: 'viandes', default_unit: 'g', price_per_unit: 8.00, price_unit: 'kg', waste_percent: 10 },
  { name: 'agneau (épaule)', category: 'viandes', default_unit: 'g', price_per_unit: 16.00, price_unit: 'kg', waste_percent: 20 },
  { name: 'lardons', category: 'viandes', default_unit: 'g', price_per_unit: 9.00, price_unit: 'kg', waste_percent: 0 },
  { name: 'jambon', category: 'viandes', default_unit: 'g', price_per_unit: 15.00, price_unit: 'kg', waste_percent: 0 },

  // Poissons
  { name: 'saumon', category: 'poissons', default_unit: 'g', price_per_unit: 22.00, price_unit: 'kg', waste_percent: 30 },
  { name: 'cabillaud', category: 'poissons', default_unit: 'g', price_per_unit: 18.00, price_unit: 'kg', waste_percent: 40 },
  { name: 'crevette', category: 'poissons', default_unit: 'g', price_per_unit: 16.00, price_unit: 'kg', waste_percent: 45 },

  // Produits laitiers
  { name: 'beurre', category: 'produits laitiers', default_unit: 'g', price_per_unit: 10.00, price_unit: 'kg', waste_percent: 0 },
  { name: 'crème liquide', category: 'produits laitiers', default_unit: 'ml', price_per_unit: 4.00, price_unit: 'l', waste_percent: 0 },
  { name: 'crème épaisse', category: 'produits laitiers', default_unit: 'ml', price_per_unit: 5.00, price_unit: 'l', waste_percent: 0 },
  { name: 'lait', category: 'produits laitiers', default_unit: 'ml', price_per_unit: 1.20, price_unit: 'l', waste_percent: 0 },
  { name: 'fromage râpé', category: 'produits laitiers', default_unit: 'g', price_per_unit: 8.00, price_unit: 'kg', waste_percent: 0 },
  { name: 'parmesan', category: 'produits laitiers', default_unit: 'g', price_per_unit: 25.00, price_unit: 'kg', waste_percent: 5 },
  { name: 'œuf', category: 'produits laitiers', default_unit: 'pièce', price_per_unit: 0.30, price_unit: 'pièce', waste_percent: 12 },
  { name: 'mascarpone', category: 'produits laitiers', default_unit: 'g', price_per_unit: 7.00, price_unit: 'kg', waste_percent: 0 },

  // Épicerie sèche
  { name: 'farine', category: 'épicerie', default_unit: 'g', price_per_unit: 1.00, price_unit: 'kg', waste_percent: 0 },
  { name: 'sucre', category: 'épicerie', default_unit: 'g', price_per_unit: 1.50, price_unit: 'kg', waste_percent: 0 },
  { name: 'sel', category: 'épicerie', default_unit: 'g', price_per_unit: 0.50, price_unit: 'kg', waste_percent: 0 },
  { name: 'poivre', category: 'épicerie', default_unit: 'g', price_per_unit: 30.00, price_unit: 'kg', waste_percent: 0 },
  { name: 'huile d\'olive', category: 'épicerie', default_unit: 'ml', price_per_unit: 8.00, price_unit: 'l', waste_percent: 0 },
  { name: 'huile végétale', category: 'épicerie', default_unit: 'ml', price_per_unit: 3.00, price_unit: 'l', waste_percent: 0 },
  { name: 'vinaigre', category: 'épicerie', default_unit: 'ml', price_per_unit: 4.00, price_unit: 'l', waste_percent: 0 },
  { name: 'pâtes', category: 'épicerie', default_unit: 'g', price_per_unit: 2.50, price_unit: 'kg', waste_percent: 0 },
  { name: 'riz', category: 'épicerie', default_unit: 'g', price_per_unit: 2.00, price_unit: 'kg', waste_percent: 0 },
  { name: 'fond de veau', category: 'épicerie', default_unit: 'ml', price_per_unit: 6.00, price_unit: 'l', waste_percent: 0 },
  { name: 'fond blanc', category: 'épicerie', default_unit: 'ml', price_per_unit: 5.00, price_unit: 'l', waste_percent: 0 },
  { name: 'concentré de tomate', category: 'épicerie', default_unit: 'g', price_per_unit: 4.00, price_unit: 'kg', waste_percent: 0 },
  { name: 'moutarde', category: 'épicerie', default_unit: 'g', price_per_unit: 5.00, price_unit: 'kg', waste_percent: 0 },

  // Herbes et épices
  { name: 'persil', category: 'herbes', default_unit: 'botte', price_per_unit: 1.00, price_unit: 'botte', waste_percent: 30 },
  { name: 'ciboulette', category: 'herbes', default_unit: 'botte', price_per_unit: 1.50, price_unit: 'botte', waste_percent: 10 },
  { name: 'thym', category: 'herbes', default_unit: 'botte', price_per_unit: 1.00, price_unit: 'botte', waste_percent: 40 },
];

module.exports = function seedIngredients(db, get, run) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ingredients (name, category, default_unit, price_per_unit, price_unit, waste_percent)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((ingredients) => {
    for (const ing of ingredients) {
      stmt.run(ing.name, ing.category, ing.default_unit, ing.price_per_unit, ing.price_unit, ing.waste_percent);
    }
  });

  try {
    insertMany(commonIngredients);
    // Also update existing ingredients that have price_per_unit = 0 with seed prices
    const updateStmt = db.prepare(`
      UPDATE ingredients SET price_per_unit = ?, price_unit = ?
      WHERE name = ? AND (price_per_unit IS NULL OR price_per_unit = 0)
    `);
    const updateMany = db.transaction((ingredients) => {
      for (const ing of ingredients) {
        updateStmt.run(ing.price_per_unit, ing.price_unit, ing.name);
      }
    });
    updateMany(commonIngredients);
  } catch (e) {
    console.error('Seed ingredients error:', e.message);
  }
};
