const { Router } = require('express');
const PDFDocument = require('pdfkit');
const { db, all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const { detectCrossContaminationRisks } = require('../lib/cross-contamination');
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

// GET /api/allergens/recipes/:id — Allergènes + risques de contamination croisée
router.get('/recipes/:id', requireAuth, (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    const recipe = get('SELECT * FROM recipes WHERE id = ? AND restaurant_id = ?', [recipeId, req.user.restaurant_id]);
    if (!recipe) return res.status(404).json({ error: 'Recette non trouvée' });

    const allergens = getRecipeAllergens(recipeId);
    const risks = computeCrossContaminationForRecipe(recipeId, allergens);
    res.json({
      recipe_id: recipeId,
      recipe_name: recipe.name,
      allergens,
      inco_display: allergens.map(a => `${a.icon} ${a.name}`).join(', '),
      allergen_count: allergens.length,
      cross_contamination_risk: {
        count: risks.length,
        max_severity: maxSeverity(risks),
        risks,
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/allergens/menu — Allergènes de toutes les recettes (pour affichage carte)
router.get('/menu', requireAuth, (req, res) => {
  try {
    const recipes = all('SELECT id, name, selling_price FROM recipes WHERE restaurant_id = ? ORDER BY name', [req.user.restaurant_id]);
    const result = recipes.map(r => {
      const allergens = getRecipeAllergens(r.id);
      const risks = computeCrossContaminationForRecipe(r.id, allergens);
      return {
        recipe_id: r.id,
        recipe_name: r.name,
        selling_price: r.selling_price,
        allergens,
        cross_contamination_risk: {
          count: risks.length,
          max_severity: maxSeverity(risks),
        },
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/allergens/cross-contamination/:id — Détail des risques pour une recette
router.get('/cross-contamination/:id', requireAuth, (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const recipeId = Number(req.params.id);
    const recipe = get('SELECT id, name FROM recipes WHERE id = ? AND restaurant_id = ?', [recipeId, rid]);
    if (!recipe) return res.status(404).json({ error: 'Recette non trouvée' });
    const allergens = getRecipeAllergens(recipeId);
    const risks = computeCrossContaminationForRecipe(recipeId, allergens);
    res.json({
      recipe_id: recipeId,
      recipe_name: recipe.name,
      allergens,
      risks,
      max_severity: maxSeverity(risks),
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/allergens/cross-contamination — Liste de toutes les recettes à risque
router.get('/cross-contamination', requireAuth, (req, res) => {
  try {
    const rid = req.user.restaurant_id;
    const recipes = all('SELECT id, name, category FROM recipes WHERE restaurant_id = ? ORDER BY name', [rid]);
    const items = recipes.map(r => {
      const allergens = getRecipeAllergens(r.id);
      const risks = computeCrossContaminationForRecipe(r.id, allergens);
      return {
        recipe_id: r.id,
        recipe_name: r.name,
        category: r.category || null,
        allergen_codes: allergens.map(a => a.code),
        risk_count: risks.length,
        max_severity: maxSeverity(risks),
        risks,
      };
    }).filter(x => x.risk_count > 0);
    res.json({ items, total: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Cross-contamination helpers (DB-aware wrapper around the pure detector) ───
const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };
function maxSeverity(risks) {
  if (!risks || risks.length === 0) return null;
  let best = risks[0].severity;
  for (const r of risks) {
    if ((SEVERITY_RANK[r.severity] || 0) > (SEVERITY_RANK[best] || 0)) best = r.severity;
  }
  return best;
}

function computeCrossContaminationForRecipe(recipeId, allergens) {
  const ingredients = all(`
    SELECT ri.ingredient_id, ri.sub_recipe_id,
           i.name AS ingredient_name,
           i.allergens AS allergen_text,
           sr.name AS sub_recipe_name
    FROM recipe_ingredients ri
    LEFT JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN recipes sr    ON sr.id = ri.sub_recipe_id
    WHERE ri.recipe_id = ?
  `, [recipeId]);

  const flat = ingredients.map(ing => ({
    name: ing.ingredient_name || ing.sub_recipe_name || '',
  }));
  return detectCrossContaminationRisks({
    ingredients: flat,
    recipeAllergens: allergens || [],
  });
}

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
    const restaurant = get('SELECT name, address, city FROM restaurants WHERE id = ?', [rid]) || {};
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
    const restaurantLocation = [restaurant.address, restaurant.city].filter(Boolean).join(' · ');
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

    const MARGIN = 36;
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const CONTENT_W = PAGE_W - 2 * MARGIN;
    const HEADER_BOTTOM_Y = 56;
    const FOOTER_Y = PAGE_H - 32;
    const BODY_TOP = HEADER_BOTTOM_Y + 18;
    const BODY_BOTTOM = PAGE_H - 64;
    const ACCENT = '#C45A18';
    const HEADING = '#1a1a1a';

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: 64, left: MARGIN, right: MARGIN },
      bufferPages: true
    });
    doc.pipe(res);

    // ═══════════════════════════════════════════
    // PAGE 1 — Cover
    // ═══════════════════════════════════════════
    let y = MARGIN + 80;

    // Small branded eyebrow
    doc.font('Helvetica-Bold').fontSize(8).fillColor(ACCENT);
    doc.text('FICHE D’INFORMATION ALLERGÈNES', MARGIN, y, {
      width: CONTENT_W, characterSpacing: 1.5
    });
    y = doc.y + 10;

    // Restaurant name — large serif, the visual anchor
    doc.font('Times-Bold').fontSize(34).fillColor(HEADING);
    doc.text(restaurantName, MARGIN, y, { width: CONTENT_W });
    y = doc.y + 6;

    // Optional address line
    if (restaurantLocation) {
      doc.font('Helvetica').fontSize(10).fillColor('#666');
      doc.text(restaurantLocation, MARGIN, y, { width: CONTENT_W });
      y = doc.y + 4;
    }

    // Date
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#888');
    doc.text(`Édition du ${dateFr}`, MARGIN, y, { width: CONTENT_W });
    y = doc.y + 24;

    // Decorative rule
    doc.moveTo(MARGIN, y).lineTo(MARGIN + 80, y)
       .lineWidth(2).strokeColor(ACCENT).stroke();
    y += 20;

    // Intro block
    doc.font('Times-Roman').fontSize(11).fillColor('#333');
    doc.text(
      "Conformément au Règlement (UE) n°1169/2011 (INCO), les 14 allergènes à déclaration obligatoire pouvant être présents dans nos plats sont listés ci-dessous, plat par plat.",
      MARGIN, y, { width: CONTENT_W, lineGap: 2 }
    );
    y = doc.y + 8;

    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666');
    doc.text(
      "En cas de doute ou d'allergie déclarée, demandez conseil à un membre de l'équipe avant de commander. Les traces dues à des contacts en cuisine ne peuvent pas toujours être garanties absentes.",
      MARGIN, y, { width: CONTENT_W, lineGap: 2 }
    );
    y = doc.y + 22;

    // Quick stats card
    const totalDishes = items.length;
    const dishesWithAllergens = items.filter(i => i.allergens.length > 0).length;
    const cardH = 72;
    doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 6)
       .fillAndStroke('#FAF7F2', '#E8DFD2');
    doc.fillColor(HEADING);

    const cellW = CONTENT_W / 3;
    const drawStat = (n, label, x) => {
      doc.font('Times-Bold').fontSize(22).fillColor(ACCENT);
      doc.text(String(n), x, y + 14, { width: cellW, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#666');
      doc.text(label, x, y + 44, { width: cellW, align: 'center', characterSpacing: 0.5 });
    };
    drawStat(totalDishes, 'PLATS À LA CARTE', MARGIN);
    drawStat(dishesWithAllergens, 'AVEC ALLERGÈNES DÉCLARÉS', MARGIN + cellW);
    drawStat(INCO_ALLERGENS.length, 'ALLERGÈNES SUIVIS', MARGIN + cellW * 2);

    y += cardH + 28;

    // Footer-style note (kept on cover page, separate from page footer)
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#999');
    doc.text(
      "Ce document tient lieu d'information allergènes au sens de l'art. R412-14 du Code de la consommation. Conservez-le à disposition des inspecteurs de la DDPP.",
      MARGIN, FOOTER_Y - 18, { width: CONTENT_W, align: 'left' }
    );

    // ═══════════════════════════════════════════
    // BODY PAGES — Tabular per category
    // ═══════════════════════════════════════════
    const ALLERGEN_CODES = INCO_ALLERGENS.map(a => INCO_PDF_CODES[a.code] || a.code);
    const NAME_COL_W = 158;
    const ALLERGEN_AREA_W = CONTENT_W - NAME_COL_W;
    const CELL_W = ALLERGEN_AREA_W / INCO_ALLERGENS.length;
    const ROW_H = 18;
    const HEADER_ROW_H = 22;

    const drawPageHeader = (extraTitle) => {
      // Page header strip — restaurant + section
      doc.font('Helvetica-Bold').fontSize(8).fillColor(ACCENT);
      doc.text(restaurantName.toUpperCase(), MARGIN, MARGIN, {
        width: CONTENT_W / 2, characterSpacing: 1, lineBreak: false
      });
      doc.font('Helvetica').fontSize(8).fillColor('#888');
      doc.text(extraTitle || 'Fiche allergènes', MARGIN + CONTENT_W / 2, MARGIN, {
        width: CONTENT_W / 2, align: 'right', lineBreak: false
      });
      doc.moveTo(MARGIN, HEADER_BOTTOM_Y - 6).lineTo(MARGIN + CONTENT_W, HEADER_BOTTOM_Y - 6)
         .lineWidth(0.5).strokeColor('#DDD').stroke();
    };

    const drawTableHeader = (yPos) => {
      // Background bar
      doc.rect(MARGIN, yPos, CONTENT_W, HEADER_ROW_H).fill(HEADING);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
      doc.text('Plat', MARGIN + 8, yPos + 7, { width: NAME_COL_W - 8, lineBreak: false });
      for (let i = 0; i < ALLERGEN_CODES.length; i++) {
        const cellX = MARGIN + NAME_COL_W + i * CELL_W;
        doc.text(ALLERGEN_CODES[i], cellX, yPos + 7, {
          width: CELL_W, align: 'center', lineBreak: false
        });
      }
      return yPos + HEADER_ROW_H;
    };

    const newBodyPage = (title) => {
      doc.addPage();
      drawPageHeader(title);
      y = BODY_TOP;
    };

    if (items.length === 0) {
      newBodyPage('Liste des plats');
      doc.font('Helvetica-Oblique').fontSize(11).fillColor('#666');
      doc.text(
        "Aucun plat enregistré. Renseignez vos recettes et leurs allergènes pour générer la fiche.",
        MARGIN, y, { width: CONTENT_W }
      );
    } else {
      newBodyPage('Liste des plats');
      let isFirstCategory = true;

      for (const [category, list] of Object.entries(byCategory)) {
        const categoryHeaderH = isFirstCategory ? 22 : 30;
        // Need category title + table header + at least one row
        if (y + categoryHeaderH + HEADER_ROW_H + ROW_H > BODY_BOTTOM) {
          newBodyPage('Liste des plats (suite)');
        }

        // Category title
        if (!isFirstCategory) y += 8;
        doc.font('Times-Bold').fontSize(13).fillColor(HEADING);
        doc.text(category, MARGIN, y, { width: CONTENT_W });
        y = doc.y + 3;
        doc.moveTo(MARGIN, y).lineTo(MARGIN + 36, y)
           .lineWidth(1.5).strokeColor(ACCENT).stroke();
        y += 8;

        // Table header
        y = drawTableHeader(y);

        // Rows
        for (let idx = 0; idx < list.length; idx++) {
          if (y + ROW_H > BODY_BOTTOM) {
            newBodyPage('Liste des plats (suite)');
            // Re-draw category continuation + table header
            doc.font('Times-Bold').fontSize(11).fillColor('#666');
            doc.text(`${category} (suite)`, MARGIN, y, { width: CONTENT_W });
            y = doc.y + 6;
            y = drawTableHeader(y);
          }

          const item = list[idx];
          // Zebra row
          if (idx % 2 === 1) {
            doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill('#FAF7F2');
          }

          // Name cell
          doc.fillColor(HEADING).font('Helvetica').fontSize(9);
          // Truncate to fit single line if too long
          let displayName = item.name;
          while (
            doc.widthOfString(displayName) > NAME_COL_W - 12 &&
            displayName.length > 6
          ) {
            displayName = displayName.slice(0, -1);
          }
          if (displayName !== item.name) displayName = displayName.replace(/.{3}$/, '...');
          doc.text(displayName, MARGIN + 8, y + 5, {
            width: NAME_COL_W - 8, lineBreak: false
          });

          // Allergen cells
          const presentCodes = new Set(item.allergens.map(a => a.code));
          for (let i = 0; i < INCO_ALLERGENS.length; i++) {
            const code = INCO_ALLERGENS[i].code;
            const present = presentCodes.has(code);
            const cellX = MARGIN + NAME_COL_W + i * CELL_W;
            if (present) {
              doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT);
              doc.text('X', cellX, y + 4, {
                width: CELL_W, align: 'center', lineBreak: false
              });
            } else {
              doc.font('Helvetica').fontSize(10).fillColor('#CCC');
              doc.text('–', cellX, y + 4, {
                width: CELL_W, align: 'center', lineBreak: false
              });
            }
          }

          // Vertical separator after Plat column (every row)
          doc.moveTo(MARGIN + NAME_COL_W, y).lineTo(MARGIN + NAME_COL_W, y + ROW_H)
             .lineWidth(0.3).strokeColor('#DDD').stroke();

          y += ROW_H;
        }

        // Bottom rule under last row of this category
        doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y)
           .lineWidth(0.5).strokeColor('#CCC').stroke();
        y += 4;

        isFirstCategory = false;
      }
    }

    // ═══════════════════════════════════════════
    // LEGEND PAGE
    // ═══════════════════════════════════════════
    doc.addPage();
    drawPageHeader('Légende des allergènes INCO');
    y = BODY_TOP;

    doc.font('Times-Bold').fontSize(20).fillColor(HEADING);
    doc.text('Légende des 14 allergènes INCO', MARGIN, y, { width: CONTENT_W });
    y = doc.y + 6;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + 80, y)
       .lineWidth(2).strokeColor(ACCENT).stroke();
    y += 16;

    doc.font('Helvetica').fontSize(9).fillColor('#444');
    doc.text(
      "Chaque code de la grille ci-dessus correspond à l’un des 14 allergènes à déclaration obligatoire au sens du Règlement (UE) n°1169/2011, Annexe II — transposé en droit français par le Décret n°2015-447 du 17 avril 2015.",
      MARGIN, y, { width: CONTENT_W, lineGap: 2 }
    );
    y = doc.y + 18;

    const colGap = 18;
    const colW = (CONTENT_W - colGap) / 2;
    const colXs = [MARGIN, MARGIN + colW + colGap];
    const half = Math.ceil(INCO_ALLERGENS.length / 2);
    let yL = y;
    let yR = y;

    for (let i = 0; i < INCO_ALLERGENS.length; i++) {
      const a = INCO_ALLERGENS[i];
      const code = INCO_PDF_CODES[a.code] || a.code;
      const isLeft = i < half;
      const colX = colXs[isLeft ? 0 : 1];
      const cy = isLeft ? yL : yR;

      // Code badge
      doc.roundedRect(colX, cy - 1, 32, 18, 3)
         .fillAndStroke(ACCENT, ACCENT);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10);
      doc.text(code, colX, cy + 4, { width: 32, align: 'center', lineBreak: false });

      // Name
      doc.font('Helvetica-Bold').fontSize(10).fillColor(HEADING);
      doc.text(a.name, colX + 40, cy, { width: colW - 40 });
      const nameH2 = doc.heightOfString(a.name, { width: colW - 40 });

      // Description
      doc.font('Helvetica').fontSize(8.5).fillColor('#555');
      doc.text(a.description, colX + 40, cy + nameH2 + 1, { width: colW - 40, lineGap: 1 });
      const descH = doc.heightOfString(a.description, { width: colW - 40 });

      const blockH = Math.max(22, nameH2 + descH + 14);
      if (isLeft) yL += blockH; else yR += blockH;
    }

    y = Math.max(yL, yR) + 24;

    // Regulatory reference block at bottom of legend page
    if (y < BODY_BOTTOM - 80) {
      doc.roundedRect(MARGIN, y, CONTENT_W, 64, 4)
         .fillAndStroke('#FAF7F2', '#E8DFD2');
      doc.fillColor(HEADING).font('Helvetica-Bold').fontSize(9);
      doc.text('Référence réglementaire', MARGIN + 12, y + 10, {
        width: CONTENT_W - 24, lineBreak: false
      });
      doc.font('Helvetica').fontSize(8.5).fillColor('#444');
      doc.text(
        "Règlement (UE) n°1169/2011 du Parlement européen et du Conseil du 25 octobre 2011 concernant l’information des consommateurs sur les denrées alimentaires (INCO) — Annexe II.",
        MARGIN + 12, y + 24, { width: CONTENT_W - 24, lineGap: 1.5 }
      );
      doc.text(
        "Décret n°2015-447 du 17 avril 2015 — information sur les allergènes pour les denrées non préemballées.",
        MARGIN + 12, doc.y + 2, { width: CONTENT_W - 24, lineGap: 1.5 }
      );
    }

    // ═══════════════════════════════════════════
    // FOOTER on every page
    // ═══════════════════════════════════════════
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Thin top rule above footer
      doc.moveTo(MARGIN, FOOTER_Y - 8).lineTo(MARGIN + CONTENT_W, FOOTER_Y - 8)
         .lineWidth(0.3).strokeColor('#DDD').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#888');
      doc.text(
        `${restaurantName}  ·  Conforme INCO Règlement (UE) n°1169/2011  ·  Édition ${dateFr}`,
        MARGIN, FOOTER_Y, {
          width: CONTENT_W * 0.7, align: 'left', lineBreak: false
        }
      );
      doc.text(
        `Page ${i - range.start + 1} / ${range.count}`,
        MARGIN + CONTENT_W * 0.7, FOOTER_Y, {
          width: CONTENT_W * 0.3, align: 'right', lineBreak: false
        }
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
module.exports.computeCrossContaminationForRecipe = computeCrossContaminationForRecipe;
module.exports.maxSeverity = maxSeverity;
