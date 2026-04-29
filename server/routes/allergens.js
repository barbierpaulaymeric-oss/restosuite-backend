const { Router } = require('express');
const PDFDocument = require('pdfkit');
const { db, all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const router = Router();

// ═══════════════════════════════════════════
// 14 allergènes réglementaires INCO (UE)
// ═══════════════════════════════════════════
const INCO_ALLERGENS = [
  { id: 1,  code: 'gluten',      name: 'Gluten',           icon: '🌾', description: 'Blé, seigle, orge, avoine, épeautre, kamut' },
  { id: 2,  code: 'crustaces',   name: 'Crustacés',        icon: '🦐', description: 'Crevettes, crabes, homard, langoustines' },
  { id: 3,  code: 'oeufs',       name: 'Œufs',             icon: '🥚', description: 'Œufs et produits à base d\'œufs' },
  { id: 4,  code: 'poissons',    name: 'Poissons',         icon: '🐟', description: 'Poissons et produits à base de poissons' },
  { id: 5,  code: 'arachides',   name: 'Arachides',        icon: '🥜', description: 'Cacahuètes et produits à base d\'arachides' },
  { id: 6,  code: 'soja',        name: 'Soja',             icon: '🫘', description: 'Soja et produits à base de soja' },
  { id: 7,  code: 'lait',        name: 'Lait',             icon: '🥛', description: 'Lait et produits laitiers (lactose inclus)' },
  { id: 8,  code: 'fruits_coque',name: 'Fruits à coque',   icon: '🌰', description: 'Amandes, noisettes, noix, cajou, pécan, pistache, macadamia' },
  { id: 9,  code: 'celeri',      name: 'Céleri',           icon: '🥬', description: 'Céleri et produits à base de céleri' },
  { id: 10, code: 'moutarde',    name: 'Moutarde',         icon: '🟡', description: 'Moutarde et produits à base de moutarde' },
  { id: 11, code: 'sesame',      name: 'Sésame',           icon: '⚪', description: 'Graines de sésame et produits à base de sésame' },
  { id: 12, code: 'sulfites',    name: 'Sulfites',         icon: '🍷', description: 'Anhydride sulfureux et sulfites (>10mg/kg ou 10mg/l)' },
  { id: 13, code: 'lupin',       name: 'Lupin',            icon: '🌿', description: 'Lupin et produits à base de lupin' },
  { id: 14, code: 'mollusques',  name: 'Mollusques',       icon: '🦪', description: 'Moules, huîtres, escargots, calamars, poulpe' }
];

// GET /api/allergens — Liste des 14 allergènes INCO
router.get('/', (req, res) => {
  res.json(INCO_ALLERGENS);
});

// GET /api/allergens/ingredients/:id — Allergènes d'un ingrédient (parsed from text field)
router.get('/ingredients/:id', requireAuth, (req, res) => {
  try {
    const ingredient = get('SELECT allergens FROM ingredients WHERE id = ? AND restaurant_id = ?', [Number(req.params.id), req.user.restaurant_id]);
    if (!ingredient) return res.status(404).json({ error: 'Ingrédient non trouvé' });

    const parsed = parseAllergenText(ingredient.allergens);
    res.json({ ingredient_id: Number(req.params.id), allergens: parsed });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/allergens/ingredients/:id — Mettre à jour les allergènes d'un ingrédient
router.put('/ingredients/:id', requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const ingredient = get('SELECT * FROM ingredients WHERE id = ? AND restaurant_id = ?', [id, req.user.restaurant_id]);
    if (!ingredient) return res.status(404).json({ error: 'Ingrédient non trouvé' });

    const { allergen_codes } = req.body; // Array of codes like ['gluten', 'lait', 'oeufs']
    if (!Array.isArray(allergen_codes)) {
      return res.status(400).json({ error: 'allergen_codes must be an array' });
    }

    // Validate codes
    const validCodes = INCO_ALLERGENS.map(a => a.code);
    const invalid = allergen_codes.filter(c => !validCodes.includes(c));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Codes invalides: ${invalid.join(', ')}` });
    }

    // Store as comma-separated names for backward compatibility
    const allergenNames = allergen_codes.map(code => {
      const a = INCO_ALLERGENS.find(x => x.code === code);
      return a ? a.name : code;
    });
    const allergenText = allergenNames.length > 0 ? allergenNames.join(', ') : null;

    run('UPDATE ingredients SET allergens = ? WHERE id = ? AND restaurant_id = ?', [allergenText, id, req.user.restaurant_id]);

    // Audit trail (allergen declaration is regulatory under INCO)
    try {
      const { writeAudit } = require('../lib/audit-log');
      writeAudit({
        restaurant_id: req.user.restaurant_id,
        account_id: req.user.id,
        table_name: 'ingredients',
        record_id: id,
        action: 'update',
        new_values: { allergens: allergenText, codes: allergen_codes }
      });
    } catch {}

    res.json({
      ingredient_id: id,
      allergens: allergenText,
      allergen_codes
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/allergens/recipes/:id — Allergènes calculés automatiquement pour une recette
router.get('/recipes/:id', requireAuth, (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [recipeId, req.user.restaurant_id]);
    if (!recipe) return res.status(404).json({ error: 'Recette non trouvée' });

    const allergens = getRecipeAllergens(recipeId);
    res.json({
      recipe_id: recipeId,
      recipe_name: recipe.name,
      allergens,
      inco_display: allergens.map(a => `${a.icon} ${a.name}`).join(', '),
      allergen_count: allergens.length
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/allergens/menu — Allergènes de toutes les recettes (pour affichage carte)
router.get('/menu', requireAuth, (req, res) => {
  try {
    const recipes = all('SELECT id, name, selling_price FROM recipes WHERE restaurant_id = ? ORDER BY name', [req.user.restaurant_id]);
    const result = recipes.map(r => ({
      recipe_id: r.id,
      recipe_name: r.name,
      selling_price: r.selling_price,
      allergens: getRecipeAllergens(r.id)
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Helpers ───

function parseAllergenText(text) {
  if (!text) return [];
  const normalized = text.toLowerCase().trim();
  const found = [];

  for (const allergen of INCO_ALLERGENS) {
    // Check if the allergen name (or common variants) appears in the text
    const variants = getAllergenVariants(allergen.code);
    if (variants.some(v => normalized.includes(v))) {
      found.push(allergen);
    }
  }
  return found;
}

function getAllergenVariants(code) {
  const map = {
    'gluten':       ['gluten', 'blé', 'ble', 'seigle', 'orge', 'avoine', 'épeautre', 'epeautre'],
    'crustaces':    ['crustacé', 'crustace', 'crevette', 'crabe', 'homard', 'langoustine'],
    'oeufs':        ['oeuf', 'œuf', 'oeufs', 'œufs', 'egg'],
    'poissons':     ['poisson', 'fish'],
    'arachides':    ['arachide', 'cacahuète', 'cacahuete', 'peanut'],
    'soja':         ['soja', 'soy'],
    'lait':         ['lait', 'lactose', 'lacto', 'dairy', 'fromage', 'crème', 'creme', 'beurre', 'produit laitier'],
    'fruits_coque': ['fruit à coque', 'fruits à coque', 'fruits a coque', 'amande', 'noisette', 'noix', 'cajou', 'pécan', 'pecan', 'pistache', 'macadamia'],
    'celeri':       ['céleri', 'celeri'],
    'moutarde':     ['moutarde', 'mustard'],
    'sesame':       ['sésame', 'sesame'],
    'sulfites':     ['sulfite', 'soufre', 'so2', 'anhydride sulfureux'],
    'lupin':        ['lupin'],
    'mollusques':   ['mollusque', 'moule', 'huître', 'huitre', 'escargot', 'calamar', 'poulpe', 'seiche']
  };
  return map[code] || [code];
}

function getRecipeAllergens(recipeId, visited = new Set()) {
  if (visited.has(recipeId)) return [];
  visited.add(recipeId);

  const ingredients = all(`
    SELECT ri.ingredient_id, ri.sub_recipe_id, i.allergens as allergen_text
    FROM recipe_ingredients ri
    LEFT JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = ?
  `, [recipeId]);

  const foundSet = new Set();

  for (const ing of ingredients) {
    if (ing.sub_recipe_id) {
      // Recurse into sub-recipe
      const subAllergens = getRecipeAllergens(ing.sub_recipe_id, new Set(visited));
      subAllergens.forEach(a => foundSet.add(a.code));
    } else if (ing.allergen_text) {
      const parsed = parseAllergenText(ing.allergen_text);
      parsed.forEach(a => foundSet.add(a.code));
    }
  }

  return INCO_ALLERGENS.filter(a => foundSet.has(a.code));
}

// ─── INCO: Affichage allergènes menu complet ───
router.get('/menu-display', requireAuth, (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const recipes = db.prepare(`
      SELECT r.id, r.name, r.category
      FROM recipes r
      WHERE r.restaurant_id = ?
      ORDER BY r.category, r.name
    `).all(rid);

    const result = recipes.map(recipe => {
      // Use the recipe-allergens helper so we honour both the comma-separated
      // legacy format AND sub-recipe inheritance (matches /api/allergens/recipes/:id).
      const allergens = getRecipeAllergens(recipe.id);
      return {
        ...recipe,
        allergen_codes: allergens.map(a => a.code).sort()
      };
    });

    res.json({ items: result, total: result.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── INCO: Fiche allergènes PDF (carte client / inspecteur) ───
// Letter codes used in the PDF in place of emoji (PDFKit's default Helvetica
// has no emoji glyphs). Standard French INCO single/double-letter shorthand.
const INCO_PDF_CODES = {
  gluten:       'G',
  crustaces:    'C',
  oeufs:        'O',
  poissons:     'P',
  arachides:    'A',
  soja:         'S',
  lait:         'L',
  fruits_coque: 'FC',
  celeri:       'Cé',
  moutarde:     'Mo',
  sesame:       'Sé',
  sulfites:     'Su',
  lupin:        'Lu',
  mollusques:   'Mol'
};

router.get('/card-pdf', requireAuth, (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const restaurant = get('SELECT name FROM restaurants WHERE id = ?', [rid]) || {};
    const recipes = all(
      'SELECT id, name, category FROM recipes WHERE restaurant_id = ? ORDER BY category, name',
      [rid]
    );

    const items = recipes.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category || 'Sans catégorie',
      allergens: getRecipeAllergens(r.id)
    }));
    const byCategory = {};
    for (const it of items) (byCategory[it.category] ||= []).push(it);

    const restaurantName = (restaurant.name || 'Restaurant').slice(0, 80);
    const slug = restaurantName
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'restaurant';
    const today = new Date();
    const isoDate = today.toISOString().slice(0, 10);
    const dateFr = today.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fiche-allergenes-${slug}-${isoDate}.pdf"`
    );

    const MARGIN = 42;
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const CONTENT_W = PAGE_W - 2 * MARGIN;
    const FOOTER_Y = PAGE_H - 32;
    const BODY_BOTTOM = PAGE_H - 60;

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: 60, left: MARGIN, right: MARGIN },
      bufferPages: true
    });
    doc.pipe(res);

    // ─── Header (page 1) ───
    doc.font('Times-Bold').fontSize(22).fillColor('#1a1a1a');
    doc.text(restaurantName, MARGIN, MARGIN, { width: CONTENT_W });

    doc.font('Helvetica').fontSize(9).fillColor('#666');
    doc.text(`Fiche allergènes — Édition du ${dateFr}`, MARGIN, doc.y + 4, {
      width: CONTENT_W
    });

    doc.moveDown(0.6);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666');
    doc.text(
      "Conformément au Règlement (UE) n°1169/2011 (INCO), les 14 allergènes majeurs susceptibles d'être présents dans nos plats sont indiqués ci-dessous. N'hésitez pas à demander conseil à notre équipe.",
      MARGIN,
      doc.y,
      { width: CONTENT_W }
    );

    let y = doc.y + 8;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y)
       .lineWidth(0.5).strokeColor('#1a1a1a').stroke();
    y += 14;

    // ─── Body ───
    const ensureSpace = (need) => {
      if (y + need > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
      }
    };

    if (items.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#666');
      doc.text(
        "Aucun plat enregistré. Renseignez vos recettes et leurs allergènes pour générer la fiche.",
        MARGIN,
        y,
        { width: CONTENT_W }
      );
      y = doc.y + 4;
    }

    for (const [category, list] of Object.entries(byCategory)) {
      ensureSpace(46);
      doc.font('Times-Bold').fontSize(13).fillColor('#1a1a1a');
      doc.text(category, MARGIN, y, { width: CONTENT_W });
      y = doc.y + 4;
      doc.moveTo(MARGIN, y).lineTo(MARGIN + 64, y)
         .lineWidth(1.2).strokeColor('#C45A18').stroke();
      y += 10;

      for (const item of list) {
        doc.font('Helvetica-Bold').fontSize(10);
        const nameH = doc.heightOfString(item.name, { width: CONTENT_W });
        const allergenLine = item.allergens.length === 0
          ? 'Aucun allergène déclaré'
          : item.allergens
              .map(a => INCO_PDF_CODES[a.code] || a.code)
              .join('  ·  ');
        doc.font('Helvetica').fontSize(9);
        const allergenH = doc.heightOfString(allergenLine, { width: CONTENT_W });
        const blockH = nameH + 2 + allergenH + 14;

        ensureSpace(blockH);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#222');
        doc.text(item.name, MARGIN, y, { width: CONTENT_W });
        y += nameH + 2;

        doc.font('Helvetica').fontSize(9)
           .fillColor(item.allergens.length === 0 ? '#999' : '#444');
        doc.text(allergenLine, MARGIN, y, { width: CONTENT_W });
        y += allergenH + 12;
      }
      y += 6;
    }

    // ─── Legend page ───
    doc.addPage();
    y = MARGIN;
    doc.font('Times-Bold').fontSize(16).fillColor('#1a1a1a');
    doc.text('Légende — Les 14 allergènes INCO', MARGIN, y, { width: CONTENT_W });
    y = doc.y + 6;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + 90, y)
       .lineWidth(1.2).strokeColor('#C45A18').stroke();
    y += 14;

    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666');
    doc.text(
      "Chaque code ci-dessous correspond à l'un des 14 allergènes à déclaration obligatoire (Règlement UE n°1169/2011, Annexe II).",
      MARGIN,
      y,
      { width: CONTENT_W }
    );
    y = doc.y + 12;

    const colW = (CONTENT_W - 16) / 2;
    const colXs = [MARGIN, MARGIN + colW + 16];
    const half = Math.ceil(INCO_ALLERGENS.length / 2);
    let yL = y;
    let yR = y;

    for (let i = 0; i < INCO_ALLERGENS.length; i++) {
      const a = INCO_ALLERGENS[i];
      const code = INCO_PDF_CODES[a.code] || a.code;
      const isLeft = i < half;
      const colX = colXs[isLeft ? 0 : 1];
      const cy = isLeft ? yL : yR;

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#C45A18');
      doc.text(code, colX, cy, { width: 32 });

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a');
      doc.text(a.name, colX + 32, cy, { width: colW - 32 });
      const nameH2 = doc.heightOfString(a.name, { width: colW - 32 });

      doc.font('Helvetica').fontSize(8).fillColor('#555');
      doc.text(a.description, colX + 32, cy + nameH2 + 1, { width: colW - 32 });
      const descH = doc.heightOfString(a.description, { width: colW - 32 });

      const blockH = nameH2 + 1 + descH + 12;
      if (isLeft) yL += blockH; else yR += blockH;
    }

    // ─── Footer on every page ───
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#888');
      doc.text(
        `${restaurantName} — Conforme INCO Règlement (UE) n°1169/2011 — Page ${i - range.start + 1}/${range.count}`,
        MARGIN,
        FOOTER_Y,
        { width: CONTENT_W, align: 'center', lineBreak: false }
      );
    }

    doc.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur génération PDF allergènes' });
    } else {
      try { res.end(); } catch {}
    }
  }
});

module.exports = router;
module.exports.INCO_ALLERGENS = INCO_ALLERGENS;
module.exports.getRecipeAllergens = getRecipeAllergens;
