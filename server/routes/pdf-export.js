const PDFDocument = require('pdfkit');

// Page layout constants (A4 in points: 595.28 x 841.89)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42; // ~15mm
const CONTENT_W = PAGE_W - 2 * MARGIN;

// Column split
const LEFT_RATIO = 0.48;
const LEFT_W = CONTENT_W * LEFT_RATIO;
const RIGHT_W = CONTENT_W * (1 - LEFT_RATIO);
const COL_LEFT_X = MARGIN;
const COL_RIGHT_X = MARGIN + LEFT_W;

// Sub-column widths within left column (Denrées | Qté | Unité | P.unit | Total)
const SUB_COLS = {
  denrees: LEFT_W * 0.40,
  qty: LEFT_W * 0.13,
  unite: LEFT_W * 0.12,
  punit: LEFT_W * 0.17,
  total: LEFT_W * 0.18
};
const SUB_X = {
  denrees: COL_LEFT_X,
  qty: COL_LEFT_X + SUB_COLS.denrees,
  unite: COL_LEFT_X + SUB_COLS.denrees + SUB_COLS.qty,
  punit: COL_LEFT_X + SUB_COLS.denrees + SUB_COLS.qty + SUB_COLS.unite,
  total: COL_LEFT_X + SUB_COLS.denrees + SUB_COLS.qty + SUB_COLS.unite + SUB_COLS.punit
};

const FONT_SIZE = 8;
const TITLE_SIZE = 10;
const HEADER_SIZE = 11;
const ROW_HEIGHT = 14;
const GRAY_HEADER = '#A0A0A0';
const GRAY_LIGHT = '#E0E0E0';
const GRAY_LINE = '#C0C0C0';

function generatePDF(recipe, res) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
  });

  // Pipe to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="fiche-${recipe.name.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, '').replace(/\s+/g, '-')}.pdf"`);
  doc.pipe(res);

  let y = MARGIN;

  // === HEADER ===
  // Title block
  doc.font('Helvetica-Bold').fontSize(HEADER_SIZE);
  doc.text('RESTOSUITE', COL_LEFT_X, y, { width: LEFT_W });
  doc.font('Helvetica').fontSize(8);
  doc.text('Fiche Technique Professionnelle', COL_LEFT_X, y + 14);

  doc.font('Helvetica-Bold').fontSize(HEADER_SIZE);
  doc.text('FICHE TECHNIQUE DE FABRICATION', COL_RIGHT_X, y, { width: RIGHT_W, align: 'right' });
  
  y += 32;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(1).stroke('#000');
  y += 8;

  // Chef line
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
  doc.text('CHEF /', COL_LEFT_X, y);
  doc.moveTo(COL_LEFT_X + 35, y + 9).lineTo(MARGIN + CONTENT_W, y + 9).lineWidth(0.5).stroke(GRAY_LINE);
  y += 18;

  // Recipe name box
  doc.rect(MARGIN, y, CONTENT_W, 20).lineWidth(0.5).stroke(GRAY_LINE);
  doc.rect(MARGIN, y, 130, 20).fill(GRAY_LIGHT).stroke(GRAY_LINE);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(FONT_SIZE);
  doc.text('Intitulé de la recette', MARGIN + 4, y + 6);
  doc.font('Helvetica').text(recipe.name, MARGIN + 134, y + 6, { width: CONTENT_W - 138 });
  y += 22;

  // Category box
  doc.rect(MARGIN, y, CONTENT_W, 20).lineWidth(0.5).stroke(GRAY_LINE);
  doc.rect(MARGIN, y, 130, 20).fill(GRAY_LIGHT).stroke(GRAY_LINE);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(FONT_SIZE);
  doc.text('Catégorie', MARGIN + 4, y + 6);
  doc.font('Helvetica').text(recipe.category || '—', MARGIN + 134, y + 6);
  y += 24;

  // === TWO COLUMN HEADERS ===
  const bodyStartY = y;

  // Left column header: "Bon d'économat"
  doc.rect(COL_LEFT_X, y, LEFT_W, 18).fill(GRAY_HEADER).stroke('#000');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
  doc.text("Bon d'économat", COL_LEFT_X, y + 4, { width: LEFT_W, align: 'center' });

  // Right column header: "Réalisation"
  doc.rect(COL_RIGHT_X, y, RIGHT_W, 18).fill(GRAY_HEADER).stroke('#000');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
  doc.text('Réalisation', COL_RIGHT_X, y + 4, { width: RIGHT_W, align: 'center' });
  y += 18;

  // Sub-column headers
  doc.rect(COL_LEFT_X, y, LEFT_W, ROW_HEIGHT).fill(GRAY_LIGHT).stroke(GRAY_LINE);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7);
  doc.text('Denrées', SUB_X.denrees + 3, y + 3);
  doc.text('Qté', SUB_X.qty + 2, y + 3, { width: SUB_COLS.qty, align: 'center' });
  doc.text('Unité', SUB_X.unite + 2, y + 3, { width: SUB_COLS.unite, align: 'center' });
  doc.text('P. unit', SUB_X.punit + 2, y + 3, { width: SUB_COLS.punit, align: 'center' });
  doc.text('Total', SUB_X.total + 2, y + 3, { width: SUB_COLS.total, align: 'center' });

  // Vertical lines for sub-columns
  const subColXs = [SUB_X.qty, SUB_X.unite, SUB_X.punit, SUB_X.total, COL_LEFT_X + LEFT_W];
  y += ROW_HEIGHT;

  // === INGREDIENTS ROWS ===
  const ingredientStartY = y;
  let rightTextY = y + 4;

  // Group ingredients by notes/component (if they have section markers)
  // For now, list them flat with component grouping via notes
  doc.font('Helvetica').fontSize(FONT_SIZE);

  let totalCost = 0;
  const ingredients = recipe.ingredients || [];

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    const cost = ing.cost || 0;
    totalCost += cost;

    // Get unit price from cost / gross_quantity
    const unitPrice = ing.gross_quantity > 0 ? (cost / ing.gross_quantity) : 0;

    doc.fillColor('#000');

    // Ingredient name (capitalize first letter)
    const rawName = (ing.ingredient_name || ing.name || '');
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const displayName = ing.notes ? `${name} (${ing.notes})` : name;
    
    // Calculate row height based on text length
    doc.font('Helvetica').fontSize(FONT_SIZE);
    const textH = doc.heightOfString(displayName, { width: SUB_COLS.denrees - 6 });
    const thisRowHeight = Math.max(ROW_HEIGHT, textH + 6);

    doc.text(displayName, SUB_X.denrees + 3, y + 3, { width: SUB_COLS.denrees - 6 });
    
    // Quantity
    doc.text(String(ing.gross_quantity), SUB_X.qty + 2, y + 3, { width: SUB_COLS.qty, align: 'center' });
    
    // Unit
    doc.text(ing.unit || 'g', SUB_X.unite + 2, y + 3, { width: SUB_COLS.unite, align: 'center' });
    
    // Unit price
    if (unitPrice > 0) {
      doc.text(unitPrice.toFixed(2), SUB_X.punit + 2, y + 3, { width: SUB_COLS.punit, align: 'center' });
    } else {
      doc.fillColor('#999').text('—', SUB_X.punit + 2, y + 3, { width: SUB_COLS.punit, align: 'center' });
      doc.fillColor('#000');
    }
    
    // Total
    if (cost > 0) {
      doc.text(cost.toFixed(2), SUB_X.total + 2, y + 3, { width: SUB_COLS.total, align: 'center' });
    } else {
      doc.fillColor('#999').text('—', SUB_X.total + 2, y + 3, { width: SUB_COLS.total, align: 'center' });
      doc.fillColor('#000');
    }

    // Row line
    doc.moveTo(COL_LEFT_X, y + thisRowHeight).lineTo(COL_LEFT_X + LEFT_W, y + thisRowHeight).lineWidth(0.25).stroke(GRAY_LINE);

    // Vertical lines for this row
    for (const sx of subColXs) {
      doc.moveTo(sx, y).lineTo(sx, y + thisRowHeight).lineWidth(0.25).stroke(GRAY_LINE);
    }

    y += thisRowHeight;

    // Check page break
    if (y > PAGE_H - MARGIN - 80) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // === TOTALS ROW ===
  y += 4;
  doc.rect(COL_LEFT_X, y, LEFT_W, ROW_HEIGHT * 2 + 8).lineWidth(0.5).stroke(GRAY_LINE);
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
  doc.text('Coût matière total :', COL_LEFT_X + 4, y + 4);
  doc.text(`${(recipe.total_cost || 0).toFixed(2)} €`, SUB_X.total + 2, y + 4, { width: SUB_COLS.total, align: 'center' });
  
  doc.text(`Coût / portion (×${recipe.portions || 1}) :`, COL_LEFT_X + 4, y + 4 + ROW_HEIGHT);
  doc.text(`${(recipe.cost_per_portion || 0).toFixed(2)} €`, SUB_X.total + 2, y + 4 + ROW_HEIGHT, { width: SUB_COLS.total, align: 'center' });

  if (recipe.selling_price) {
    doc.text(`Food cost : ${recipe.food_cost_percent || 0}%`, COL_LEFT_X + 4, y + 4 + ROW_HEIGHT * 2);
    doc.text(`Marge : ${(recipe.margin || 0).toFixed(2)} €`, SUB_X.punit + 2, y + 4 + ROW_HEIGHT * 2);
  }

  y += ROW_HEIGHT * 2 + 12;

  // Footer: temps + couverts
  doc.rect(COL_LEFT_X, y, LEFT_W / 2, 18).lineWidth(0.5).stroke(GRAY_LINE);
  doc.rect(COL_LEFT_X, y, 100, 18).fill(GRAY_LIGHT).stroke(GRAY_LINE);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(FONT_SIZE);
  doc.text('Temps réalisation', COL_LEFT_X + 4, y + 5);
  doc.font('Helvetica');
  const prepTime = (recipe.prep_time_min || 0) + (recipe.cooking_time_min || 0);
  doc.text(prepTime > 60 ? `${Math.floor(prepTime / 60)}h${prepTime % 60 > 0 ? prepTime % 60 : ''}` : `${prepTime} min`, COL_LEFT_X + 104, y + 5);

  doc.rect(COL_LEFT_X + LEFT_W / 2, y, LEFT_W / 2, 18).lineWidth(0.5).stroke(GRAY_LINE);
  doc.rect(COL_LEFT_X + LEFT_W / 2, y, 100, 18).fill(GRAY_LIGHT).stroke(GRAY_LINE);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(FONT_SIZE);
  doc.text('Nbre couverts', COL_LEFT_X + LEFT_W / 2 + 4, y + 5);
  doc.font('Helvetica');
  doc.text(String(recipe.portions || '—'), COL_LEFT_X + LEFT_W / 2 + 104, y + 5);

  // === RIGHT COLUMN: RÉALISATION ===
  const steps = recipe.steps || [];
  let stepY = ingredientStartY + 4;
  doc.font('Helvetica').fontSize(FONT_SIZE);

  for (const step of steps) {
    const instrText = `${step.step_number}. ${step.instruction}`;
    const textHeight = doc.heightOfString(instrText, { width: RIGHT_W - 12 });
    
    if (stepY + textHeight > PAGE_H - MARGIN - 20) {
      // Would need page break handling for very long recipes
      break;
    }

    doc.text(instrText, COL_RIGHT_X + 6, stepY, { width: RIGHT_W - 12 });
    stepY += textHeight + 4;
  }

  // === FRAME ===
  // Outer border for the two-column body
  const bodyEndY = Math.max(y + 18, stepY + 10);
  doc.rect(MARGIN, bodyStartY, CONTENT_W, bodyEndY - bodyStartY).lineWidth(1).stroke('#000');
  // Center divider
  doc.moveTo(COL_RIGHT_X, bodyStartY).lineTo(COL_RIGHT_X, bodyEndY).lineWidth(0.75).stroke('#000');
  // Left column outer border
  doc.moveTo(COL_LEFT_X, bodyStartY).lineTo(COL_LEFT_X, bodyEndY).lineWidth(1).stroke('#000');

  doc.end();
}

module.exports = { generatePDF };
