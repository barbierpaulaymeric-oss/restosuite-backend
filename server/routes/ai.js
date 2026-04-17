const { Router } = require('express');
const { all, get, run } = require('../db');
const { requireAuth } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── Multer config for invoice uploads ───
const uploadDir = '/tmp/restosuite-uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } });

// All AI routes require a valid JWT
router.use(requireAuth);

const VOICE_PARSE_SYSTEM = `Tu es un assistant culinaire professionnel spécialisé dans les fiches techniques de restaurant français.
À partir d'une transcription vocale d'un chef, tu dois extraire une fiche technique structurée en JSON.

## Règles de conversion des mesures informelles
- "un trait" = 5 ml (5 cl = 0.5)
- "une pincée" = 1 g
- "une pointe de couteau" = 0.5 g
- "une cuillère à soupe" / "une c.à.s." = 15 ml ou 15 g
- "une cuillère à café" / "une c.à.c." = 5 ml ou 5 g
- "un verre" = 200 ml
- "une louche" = 250 ml
- "une noix de beurre" = 15 g
- "une noisette de beurre" = 8 g

## Pourcentages de perte standard par catégorie
### Viandes
- Filet de bœuf : 18-22%
- Entrecôte : 10-15%
- Côte de bœuf : 25-30%
- Agneau (gigot) : 20-25%
- Agneau (carré) : 30-35%
- Porc (filet mignon) : 8-12%
- Veau (noix) : 15-20%
- Volaille entière : 30-40%
- Suprême de volaille : 5-10%

### Poissons
- Poisson entier → filet : 45-55%
- Bar, dorade : 50-55%
- Saumon (filet avec peau) : 10-15%
- Sole (entière → filets) : 50-60%
- Cabillaud : 15-20%
- Coquilles Saint-Jacques : 60-70% (avec coquille)
- Crevettes : 30-40% (avec carapace)
- Homard : 50-60%

### Légumes
- Oignons : 10-15%
- Échalotes : 12-18%
- Ail : 15-20%
- Carottes : 15-20%
- Poireaux : 30-40%
- Pommes de terre : 15-25%
- Tomates (mondées) : 10-15%
- Champignons : 10-20%
- Courgettes : 5-10%
- Aubergines : 5-10%
- Artichauts : 60-70%
- Asperges : 30-40%
- Haricots verts : 5-10%
- Épinards : 20-30%
- Salade (frisée, batavia) : 30-40%

### Fruits
- Agrumes (segments) : 30-40%
- Pommes/Poires (épluchées) : 20-25%
- Fruits rouges : 5-10%
- Ananas : 40-50%
- Mangue : 30-35%

### Herbes
- Persil, ciboulette, cerfeuil : 20-30%
- Estragon, basilic : 30-40%

## Format de sortie
Retourne UNIQUEMENT un objet JSON valide avec cette structure :
{
  "name": "Nom du plat",
  "category": "entrée|plat|dessert|amuse-bouche|accompagnement|sauce|base",
  "portions": 1,
  "prep_time_min": null,
  "cooking_time_min": null,
  "ingredients": [
    {
      "name": "nom de l'ingrédient",
      "gross_quantity": 220,
      "net_quantity": 180,
      "unit": "g",
      "waste_percent": 18,
      "notes": "paré, en brunoise, etc."
    }
  ],
  "steps": ["Étape 1...", "Étape 2..."]
}

## Règles
- Si le chef mentionne des quantités nettes ("180g de filet de bœuf paré"), calcule le brut en fonction du pourcentage de perte
- Si le chef mentionne des quantités brutes, calcule le net
- Si aucune indication, suppose que c'est du brut
- Les noms d'ingrédients en minuscules
- Déduis la catégorie du plat à partir du contexte
- Si le chef ne mentionne pas les étapes, déduis-les logiquement à partir des ingrédients et techniques mentionnées
- Utilise les unités les plus courantes en cuisine (g, kg, cl, l, pièce)`;

router.post('/parse-voice', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const response = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Transcription vocale du chef :\n"${text}"\n\nAnalyse cette transcription et retourne la fiche technique en JSON.` }] }],
        systemInstruction: { parts: [{ text: VOICE_PARSE_SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', err);
      return res.status(502).json({ error: 'AI service error', details: err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Empty AI response' });

    const parsed = JSON.parse(content);

    // Match ingredients with existing DB entries (fuzzy) and enrich with prices
    if (parsed.ingredients && parsed.ingredients.length > 0) {
      let estimatedCost = 0;
      for (const ing of parsed.ingredients) {
        const name = (ing.name || '').toLowerCase().trim();
        // Exact match first, then fuzzy
        let match = get('SELECT * FROM ingredients WHERE name = ?', [name]);
        if (!match) {
          match = get('SELECT * FROM ingredients WHERE name LIKE ? ORDER BY LENGTH(name) ASC LIMIT 1', [`%${name}%`]);
        }
        if (match) {
          ing.ingredient_id = match.id;
          ing.matched_name = match.name;
          ing.price_per_unit = match.price_per_unit || 0;
          ing.price_unit = match.price_unit || 'kg';
          // Calc cost for this ingredient
          if (match.price_per_unit > 0) {
            const p = match.price_per_unit;
            const pu = match.price_unit || 'kg';
            let costPerBase = 0;
            if (pu === 'kg') costPerBase = p / 1000;
            else if (pu === 'g') costPerBase = p;
            else if (pu === 'l') costPerBase = p / 1000;
            else if (pu === 'cl') costPerBase = p / 100;
            else if (pu === 'pièce' || pu === 'botte') costPerBase = p;
            else costPerBase = p / 1000;

            let qtyInBase = ing.gross_quantity || 0;
            const unit = ing.unit || 'g';
            if (unit === 'kg') qtyInBase *= 1000;
            else if (unit === 'l') qtyInBase *= 1000;
            else if (unit === 'cl') qtyInBase *= 10;

            ing.estimated_cost = Math.round(qtyInBase * costPerBase * 100) / 100;
            estimatedCost += ing.estimated_cost;
          }
          // Use DB waste_percent if AI didn't provide one
          if (!ing.waste_percent && match.waste_percent) {
            ing.waste_percent = match.waste_percent;
          }
        }
      }
      parsed.estimated_total_cost = Math.round(estimatedCost * 100) / 100;
      if (parsed.portions > 0) {
        parsed.estimated_cost_per_portion = Math.round((estimatedCost / parsed.portions) * 100) / 100;
      }
    }

    res.json(parsed);
  } catch (e) {
    console.error('AI parse error:', e);
    res.status(500).json({ error: 'Failed to parse voice input', details: e.message });
  }
});

// Voice-based recipe modification & supplier preferences
const VOICE_MODIFY_SYSTEM = `Tu es un assistant culinaire professionnel.
Le chef te donne une instruction vocale pour modifier une fiche technique existante ou exprimer une préférence fournisseur.

## Types d'instructions possibles

### Modification de recette
- "Change la quantité de bœuf à 200g"
- "Enlève les câpres"
- "Ajoute 50g de cornichons ciselés"
- "Passe à 6 portions"
- "Le temps de cuisson c'est 15 minutes"

### Préférence fournisseur
- "Pour le bœuf je veux Bigard, meilleure qualité"
- "Les échalotes toujours chez Pomona"
- "Le beurre je préfère AOP Poitou chez Metro, c'est plus cher mais la qualité est là"

## Format de sortie
Retourne un JSON avec cette structure :
{
  "actions": [
    {
      "type": "modify_ingredient",
      "ingredient_name": "filet de bœuf",
      "changes": { "gross_quantity": 200, "unit": "g" }
    },
    {
      "type": "remove_ingredient",
      "ingredient_name": "câpres"
    },
    {
      "type": "add_ingredient",
      "ingredient": { "name": "cornichons", "gross_quantity": 50, "unit": "g", "waste_percent": 5, "notes": "ciselés" }
    },
    {
      "type": "modify_recipe",
      "changes": { "portions": 6 }
    },
    {
      "type": "supplier_preference",
      "ingredient_name": "filet de bœuf",
      "supplier_name": "Bigard",
      "reason": "meilleure qualité",
      "quality_rating": 5,
      "scope": "global"
    }
  ]
}

## Règles
- scope peut être "global" (pour tout l'ingrédient) ou "recipe" (juste pour cette recette)
- Si le chef dit "toujours" ou "je veux", c'est global
- Si le chef dit "pour cette recette" ou "ici", c'est recipe
- Recalcule le brut/net si la quantité change en tenant compte du % de perte
- Retourne UNIQUEMENT le JSON, rien d'autre`;

router.post('/modify-voice', async (req, res) => {
  const { text, recipe_id } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  // Get current recipe context for the AI
  let recipeContext = '';
  if (recipe_id) {
    const recipe = get('SELECT * FROM recipes WHERE id = ?', [recipe_id]);
    if (recipe) {
      const ingredients = all(`
        SELECT ri.*, i.name as ingredient_name 
        FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id 
        WHERE ri.recipe_id = ?`, [recipe_id]);
      recipeContext = `\n\nRecette actuelle: "${recipe.name}" (${recipe.portions} portions)\nIngrédients: ${ingredients.map(i => `${i.ingredient_name} ${i.gross_quantity}${i.unit}`).join(', ')}`;
    }
  }

  try {
    const response = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Instruction vocale du chef :\n"${text}"${recipeContext}\n\nAnalyse et retourne les actions à effectuer en JSON.` }] }],
        systemInstruction: { parts: [{ text: VOICE_MODIFY_SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'AI service error', details: err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Empty AI response' });

    const actions = JSON.parse(content);
    
    // Apply supplier preferences immediately
    if (actions.actions) {
      const { run: dbRun } = require('../db');
      for (const action of actions.actions) {
        if (action.type === 'supplier_preference') {
          // Find or create supplier
          let supplier = get('SELECT * FROM suppliers WHERE LOWER(name) = LOWER(?)', [action.supplier_name]);
          if (!supplier) {
            const info = dbRun(
              'INSERT INTO suppliers (name, quality_rating, quality_notes) VALUES (?, ?, ?)',
              [action.supplier_name, action.quality_rating || 3, action.reason || null]
            );
            supplier = get('SELECT * FROM suppliers WHERE id = ?', [info.lastInsertRowid]);
          }
          
          // Find ingredient
          const ingredient = get('SELECT * FROM ingredients WHERE LOWER(name) LIKE ?', 
            [`%${action.ingredient_name.toLowerCase()}%`]);
          
          if (supplier && ingredient) {
            // Save preference
            try {
              dbRun(
                `INSERT OR REPLACE INTO ingredient_supplier_prefs (ingredient_id, recipe_id, supplier_id, reason)
                 VALUES (?, ?, ?, ?)`,
                [ingredient.id, action.scope === 'recipe' ? recipe_id : null, supplier.id, action.reason || null]
              );
              
              // Also update ingredient's preferred supplier if global
              if (action.scope === 'global') {
                dbRun('UPDATE ingredients SET preferred_supplier_id = ? WHERE id = ?', [supplier.id, ingredient.id]);
              }
              
              action.applied = true;
              action.supplier_id = supplier.id;
              action.ingredient_id = ingredient.id;
            } catch (e) {
              action.applied = false;
              action.error = e.message;
            }
          }
        }
      }
    }

    res.json(actions);
  } catch (e) {
    console.error('AI modify error:', e);
    res.status(500).json({ error: 'Failed to process voice command', details: e.message });
  }
});

router.post('/suggest-suppliers', async (req, res) => {
  const { ingredient_ids } = req.body;
  if (!ingredient_ids || !ingredient_ids.length) {
    return res.status(400).json({ error: 'ingredient_ids required' });
  }

  const suggestions = ingredient_ids.map(id => {
    const ingredient = get('SELECT * FROM ingredients WHERE id = ?', [id]);
    if (!ingredient) return { ingredient_id: id, error: 'not found' };

    const best = get(`
      SELECT sp.*, s.name as supplier_name, s.quality_rating,
             (sp.price / s.quality_rating) as value_score
      FROM supplier_prices sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.ingredient_id = ?
      ORDER BY value_score ASC LIMIT 1
    `, [id]);

    return {
      ingredient_id: id,
      ingredient_name: ingredient.name,
      best_supplier: best ? {
        supplier_id: best.supplier_id,
        supplier_name: best.supplier_name,
        price: best.price,
        unit: best.unit,
        quality_rating: best.quality_rating,
        value_score: Math.round(best.value_score * 100) / 100
      } : null
    };
  });

  res.json(suggestions);
});

// ═══════════════════════════════════════════
// POST /api/ai/scan-invoice — Scan facture fournisseur via Gemini Vision
// ═══════════════════════════════════════════
router.post('/scan-invoice', upload.single('invoice'), async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  let imageBase64 = null;
  let mimeType = 'image/jpeg';

  // Support multipart file upload OR base64 in body
  let filePath = null;
  if (req.file) {
    filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    imageBase64 = fileBuffer.toString('base64');
    mimeType = req.file.mimetype || 'image/jpeg';
  } else if (req.body && req.body.image_base64) {
    imageBase64 = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
    mimeType = req.body.mime_type || 'image/jpeg';
  }

  if (!imageBase64) {
    // Cleanup on early exit
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    return res.status(400).json({ error: 'Image requise (fichier ou base64)' });
  }

  const prompt = "Extrais les données de cette facture fournisseur de restaurant. Retourne un JSON avec : supplier_name, invoice_number, invoice_date, items (array de {product_name, quantity, unit, unit_price, total_price, batch_number, dlc}), total_ht, tva, total_ttc. Si un champ n'est pas visible, mets null.";

  try {
    const response = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini Vision error:', err);
      // Cleanup on error
      if (filePath) {
        try { fs.unlinkSync(filePath); } catch {}
      }
      return res.status(502).json({ error: 'Erreur service IA', details: err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      // Cleanup on error
      if (filePath) {
        try { fs.unlinkSync(filePath); } catch {}
      }
      return res.status(502).json({ error: 'Réponse IA vide' });
    }

    const parsed = JSON.parse(content);

    // Match product_name with existing ingredients (fuzzy)
    if (parsed.items && Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        const name = (item.product_name || '').toLowerCase().trim();
        if (!name) continue;
        let match = get('SELECT id, name FROM ingredients WHERE LOWER(name) = ?', [name]);
        if (!match) {
          match = get('SELECT id, name FROM ingredients WHERE LOWER(name) LIKE ? ORDER BY LENGTH(name) ASC LIMIT 1', [`%${name}%`]);
        }
        if (match) {
          item.ingredient_id = match.id;
          item.matched_ingredient = match.name;
        }
      }
    }

    res.json(parsed);
  } catch (e) {
    console.error('Invoice scan error:', e);
    // Cleanup on error
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    res.status(500).json({ error: 'Erreur scan facture', details: e.message });
  } finally {
    // Final cleanup to ensure file is always deleted
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/scan-mercuriale — Import mercuriale fournisseur via IA
// Scan une mercuriale (liste de prix) et met à jour les prix en masse
// ═══════════════════════════════════════════
router.post('/scan-mercuriale', upload.single('mercuriale'), async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  let imageBase64 = null;
  let mimeType = 'image/jpeg';
  let filePath = null;

  if (req.file) {
    filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    imageBase64 = fileBuffer.toString('base64');
    mimeType = req.file.mimetype || 'image/jpeg';
  } else if (req.body && req.body.image_base64) {
    imageBase64 = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
    mimeType = req.body.mime_type || 'image/jpeg';
  }

  if (!imageBase64) {
    // Cleanup on early exit
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    return res.status(400).json({ error: 'Image ou document requis' });
  }

  const prompt = `Extrais les données de cette mercuriale (liste de prix) fournisseur pour un restaurant.
Retourne un JSON avec :
- supplier_name: nom du fournisseur (si visible)
- date: date de la mercuriale (si visible)
- items: array de {
    product_name: nom du produit tel qu'écrit,
    category: catégorie (fruits, légumes, viandes, poissons, épicerie, produits laitiers, boissons, etc.),
    unit: unité de vente (kg, L, pièce, barquette, etc.),
    conditioning: conditionnement si précisé (ex: "carton de 10kg", "lot de 6"),
    price: prix unitaire HT en euros (nombre),
    origin: origine/provenance si mentionnée,
    organic: true si bio/organique
  }
Si un champ n'est pas visible, mets null. Extrais TOUS les produits listés, même les catégories.`;

  try {
    const response = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini mercuriale error:', err);
      // Cleanup on error
      if (filePath) {
        try { fs.unlinkSync(filePath); } catch {}
      }
      return res.status(502).json({ error: 'Erreur service IA', details: err });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      // Cleanup on error
      if (filePath) {
        try { fs.unlinkSync(filePath); } catch {}
      }
      return res.status(502).json({ error: 'Réponse IA vide' });
    }

    const parsed = JSON.parse(content);

    // Fuzzy match products with existing ingredients
    if (parsed.items && Array.isArray(parsed.items)) {
      const allIngredients = all('SELECT id, name FROM ingredients');

      for (const item of parsed.items) {
        const name = (item.product_name || '').toLowerCase().trim();
        if (!name) continue;

        // Exact match
        let match = allIngredients.find(i => i.name.toLowerCase() === name);

        // Partial match (contains)
        if (!match) {
          match = allIngredients.find(i => i.name.toLowerCase().includes(name) || name.includes(i.name.toLowerCase()));
        }

        // Fuzzy: first word match
        if (!match) {
          const firstWord = name.split(/\s+/)[0];
          if (firstWord.length >= 3) {
            match = allIngredients.find(i => i.name.toLowerCase().startsWith(firstWord));
          }
        }

        if (match) {
          item.ingredient_id = match.id;
          item.matched_ingredient = match.name;
          item.match_confidence = item.product_name.toLowerCase() === match.name.toLowerCase() ? 'exact' : 'fuzzy';
        }
      }
    }

    // Try to match supplier
    if (parsed.supplier_name) {
      const supplierMatch = get('SELECT id, name FROM suppliers WHERE LOWER(name) LIKE ? ORDER BY LENGTH(name) LIMIT 1',
        [`%${parsed.supplier_name.toLowerCase()}%`]);
      if (supplierMatch) {
        parsed.supplier_id = supplierMatch.id;
        parsed.matched_supplier = supplierMatch.name;
      }
    }

    const matched = (parsed.items || []).filter(i => i.ingredient_id).length;
    const total = (parsed.items || []).length;

    res.json({
      ...parsed,
      summary: {
        total_items: total,
        matched_items: matched,
        unmatched_items: total - matched,
        match_rate: total > 0 ? Math.round(matched / total * 100) : 0
      }
    });
  } catch (e) {
    console.error('Mercuriale scan error:', e);
    // Cleanup on error
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    res.status(500).json({ error: 'Erreur scan mercuriale', details: e.message });
  } finally {
    // Final cleanup to ensure file is always deleted
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/import-mercuriale — Confirmer l'import des prix
// Après validation par l'utilisateur, met à jour les prix en masse
// ═══════════════════════════════════════════
router.post('/import-mercuriale', (req, res) => {
  try {
    const { supplier_id, items } = req.body;
    if (!supplier_id) return res.status(400).json({ error: 'supplier_id requis' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article à importer' });
    }

    const supplier = get('SELECT id, name FROM suppliers WHERE id = ?', [Number(supplier_id)]);
    if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      if (!item.ingredient_id || !item.price || item.price <= 0) {
        skipped++;
        continue;
      }

      const unit = item.unit || 'kg';

      // Upsert supplier_prices
      const existing = get('SELECT id, price FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ?',
        [item.ingredient_id, supplier_id]);

      if (existing) {
        if (existing.price !== item.price) {
          run('UPDATE supplier_prices SET price = ?, unit = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
            [item.price, unit, existing.id]);
          updated++;
        } else {
          skipped++; // Same price, no update needed
          continue;
        }
      } else {
        run('INSERT INTO supplier_prices (ingredient_id, supplier_id, price, unit) VALUES (?, ?, ?, ?)',
          [item.ingredient_id, supplier_id, item.price, unit]);
        created++;
      }

      // Record in price_history
      run('INSERT INTO price_history (ingredient_id, supplier_id, price, recorded_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [item.ingredient_id, supplier_id, item.price]);
    }

    res.json({
      success: true,
      supplier_name: supplier.name,
      updated,
      created,
      skipped,
      total: items.length
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur import', details: e.message });
  }
});

// ═══════════════════════════════════════════
// GET /api/ai/menu-suggestions — Suggestions menu par marge
// ═══════════════════════════════════════════
router.get('/menu-suggestions', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    // Get all recipes with cost data
    const recipes = all(`
      SELECT r.id, r.name, r.category, r.selling_price, r.notes,
        COALESCE((
          SELECT SUM(
            ri.gross_quantity * COALESCE(
              (SELECT sp.price / CASE
                WHEN sp.unit = 'kg' THEN 1000
                WHEN sp.unit = 'L' THEN 1000
                ELSE 1
              END FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id ORDER BY sp.last_updated DESC LIMIT 1),
              0
            )
          )
          FROM recipe_ingredients ri WHERE ri.recipe_id = r.id
        ), 0) as total_cost
      FROM recipes r
      WHERE r.recipe_type = 'plat' OR r.recipe_type IS NULL
    `);

    const recipesData = recipes
      .filter(r => r.selling_price > 0)
      .map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        selling_price: r.selling_price,
        total_cost: Math.round(r.total_cost * 100) / 100,
        food_cost_pct: r.selling_price > 0 ? Math.round((r.total_cost / r.selling_price) * 1000) / 10 : null,
        margin: Math.round((r.selling_price - r.total_cost) * 100) / 100
      }));

    // Get ingredients in stock
    const stockIngredients = all(`
      SELECT i.name, s.quantity, s.unit
      FROM stock s JOIN ingredients i ON i.id = s.ingredient_id
      WHERE s.quantity > 0
      ORDER BY s.quantity DESC LIMIT 30
    `);

    const prompt = `Voici les fiches techniques d'un restaurant avec leur food cost :
${JSON.stringify(recipesData, null, 2)}

Ingrédients actuellement en stock :
${JSON.stringify(stockIngredients, null, 2)}

Analyse et donne :
1) Les 3 plats les plus rentables à mettre en avant
2) Les 3 plats avec le food cost trop élevé et des suggestions pour les améliorer (substitution d'ingrédients)
3) Une suggestion de plat du jour basée sur les ingrédients en stock

Réponds en JSON avec cette structure :
{
  "top_profitable": [{"name": "...", "food_cost_pct": ..., "reason": "..."}],
  "to_improve": [{"name": "...", "food_cost_pct": ..., "suggestion": "..."}],
  "daily_special": {"name": "...", "description": "...", "key_ingredients": ["..."]}
}`;

    const geminiRes = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      })
    });

    if (!geminiRes.ok) {
      // Fallback: return raw data analysis
      const sorted = [...recipesData].sort((a, b) => a.food_cost_pct - b.food_cost_pct);
      return res.json({
        top_profitable: sorted.slice(0, 3).map(r => ({ name: r.name, food_cost_pct: r.food_cost_pct, reason: 'Meilleur ratio coût/prix' })),
        to_improve: sorted.slice(-3).reverse().map(r => ({ name: r.name, food_cost_pct: r.food_cost_pct, suggestion: 'Revoir les portions ou substituer des ingrédients coûteux' })),
        daily_special: { name: 'Suggestion non disponible', description: 'Service IA temporairement indisponible', key_ingredients: [] },
        fallback: true
      });
    }

    const data = await geminiRes.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return res.status(502).json({ error: 'Réponse IA vide' });

    const suggestions = JSON.parse(content);
    res.json(suggestions);
  } catch (e) {
    console.error('Menu suggestions error:', e);
    res.status(500).json({ error: 'Erreur suggestions menu', details: e.message });
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/chef — Assistant IA "Chef" contextuel
// Chat avec un assistant qui connaît les données du restaurant
// ═══════════════════════════════════════════
router.post('/chef', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { message, conversation_history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message requis' });

  try {
    // Build restaurant context from real data
    const context = buildRestaurantContext();

    const systemPrompt = `Tu es "Chef", l'assistant IA expert de RestoSuite. Tu connais parfaitement ce restaurant et ses données.

CONTEXTE DU RESTAURANT :
${context}

RÈGLES :
- Réponds en français, de manière concise et professionnelle
- Base tes réponses sur les données réelles du restaurant ci-dessus
- Pour les questions sur les coûts, utilise les prix et food cost réels
- Pour les conseils, sois pratique et actionnable
- Si tu ne connais pas une info spécifique, dis-le honnêtement
- Tu peux suggérer des optimisations basées sur les données
- Utilise les ratios standards de la restauration (food cost 25-30%, etc.)
- Formate tes réponses de manière claire avec des paragraphes courts

DOMAINES D'EXPERTISE :
- Fiches techniques et costing
- Gestion des stocks et approvisionnement
- HACCP et hygiène alimentaire
- Analyse de marge et food cost
- Optimisation des pertes
- Gestion fournisseurs
- Réglementation restauration (allergènes INCO, traçabilité)
- Conseils culinaires et techniques`;

    // Build conversation
    const contents = [];

    // Add system context as first user message
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt + '\n\nVoici ma première question : Bonjour !' }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Bonjour ! Je suis Chef, votre assistant IA RestoSuite. Je connais les données de votre restaurant et je suis prêt à vous aider. Que puis-je faire pour vous ?' }]
    });

    // Add conversation history
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history.slice(-10)) { // Keep last 10 exchanges
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      }
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini Chef error:', err);
      return res.status(502).json({ error: 'Erreur service IA' });
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) return res.status(502).json({ error: 'Réponse IA vide' });

    res.json({ reply });
  } catch (e) {
    console.error('Chef AI error:', e);
    res.status(500).json({ error: 'Erreur assistant', details: e.message });
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/assistant — Advanced AI with action detection
// ═══════════════════════════════════════════
router.post('/assistant', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { message, conversation_history, context_page, context_id } = req.body;
  const user = req.user; // From requireAuth middleware

  if (!message) return res.status(400).json({ error: 'Message requis' });

  try {
    // Build restaurant context from real data
    const context = buildRestaurantContext();

    // Fetch page-specific context if provided
    let pageContext = '';
    if (context_page && context_id) {
      pageContext = buildPageContext(context_page, context_id);
    }

    const systemPrompt = `Tu es "Chef", l'assistant IA expert de RestoSuite. Tu connais parfaitement ce restaurant et ses données.

CONTEXTE DU RESTAURANT :
${context}
${pageContext}

CAPACITÉS D'ACTION :
Tu peux détecter les demandes d'action et retourner un plan d'action structuré. Les types d'actions possibles :
- add_ingredient: ajouter un ingrédient à une recette
- modify_ingredient: modifier quantité/notes d'un ingrédient
- remove_ingredient: supprimer un ingrédient
- create_recipe: créer une nouvelle fiche technique
- modify_recipe: modifier les paramètres d'une recette (portions, prix, etc)
- delete_recipe: supprimer une recette
- add_supplier: créer un nouveau fournisseur
- create_order: créer une commande
- record_temperature: enregistrer une température HACCP
- record_loss: enregistrer une perte stock
- modify_supplier_price: modifier le prix d'un ingrédient chez un fournisseur

RÈGLES :
- Réponds en français, de manière concise et professionnelle
- Base tes réponses sur les données réelles du restaurant ci-dessus
- Pour les questions sur les coûts, utilise les prix et food cost réels
- Pour les conseils, sois pratique et actionnable
- Si tu ne connais pas une info spécifique, dis-le honnêtement
- Tu peux suggérer des optimisations basées sur les données
- Formate tes réponses de manière claire avec des paragraphes courts
- Respecte les rôles : ${user.role}. Utilise \`requires_confirmation: true\` pour toute action modifiant les données
- JAMAIS d'HTML ou de Markdown. Texte brut avec retours à la ligne (\n) pour les listes

DOMAINES D'EXPERTISE :
- Fiches techniques et costing
- Gestion des stocks et approvisionnement
- HACCP et hygiène alimentaire
- Analyse de marge et food cost
- Optimisation des pertes
- Gestion fournisseurs
- Réglementation restauration (allergènes INCO, traçabilité)
- Conseils culinaires et techniques`;

    // Build conversation
    const contents = [];

    // Add system context as first user message
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt + '\n\nVoici ma première question : Bonjour !' }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Bonjour ! Je suis Chef, votre assistant IA RestoSuite. Je connais les données de votre restaurant et je peux effectuer des actions pour vous. Que puis-je faire ?' }]
    });

    // Add conversation history
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history.slice(-10)) { // Keep last 10 exchanges
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      }
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // First call: get text response and action detection
    const response = await fetch(GEMINI_URL, {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              reply: { type: 'string', description: 'Réponse textuelle au message' },
              actions: {
                type: 'array',
                description: 'Actions détectées',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['add_ingredient', 'modify_ingredient', 'remove_ingredient', 'create_recipe', 'modify_recipe', 'delete_recipe', 'add_supplier', 'create_order', 'record_temperature', 'record_loss', 'modify_supplier_price'] },
                    description: { type: 'string' },
                    params: { type: 'object' },
                    requires_confirmation: { type: 'boolean' }
                  },
                  required: ['type', 'description', 'params', 'requires_confirmation']
                }
              }
            },
            required: ['reply']
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini Assistant error:', err);
      return res.status(502).json({ error: 'Erreur service IA' });
    }

    const data = await response.json();
    let result = { reply: '', actions: [] };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) {
      try {
        // Try to parse as JSON (structured output)
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        result = {
          reply: parsed.reply || '',
          actions: parsed.actions || []
        };
      } catch (e) {
        // Fallback: treat as plain text response
        result.reply = content;
      }
    }

    if (!result.reply) return res.status(502).json({ error: 'Réponse IA vide' });

    // Filter actions based on user role
    if (result.actions && result.actions.length > 0) {
      result.actions = filterActionsByRole(result.actions, user.role);
    }

    res.json(result);
  } catch (e) {
    console.error('Chef AI error:', e);
    res.status(500).json({ error: 'Erreur assistant', details: e.message });
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/execute-action — Execute a confirmed action
// ═══════════════════════════════════════════
router.post('/execute-action', async (req, res) => {
  const { type, params } = req.body;
  const user = req.user;

  if (!type || !params) {
    return res.status(400).json({ error: 'type et params requis' });
  }

  try {
    let result = null;

    switch (type) {
      case 'add_ingredient': {
        // Add ingredient to a recipe
        const { recipe_id, ingredient_id, gross_quantity, unit, notes } = params;
        if (!recipe_id || !ingredient_id) {
          return res.status(400).json({ error: 'recipe_id et ingredient_id requis' });
        }
        run(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, gross_quantity, unit, notes) VALUES (?, ?, ?, ?, ?)',
          [recipe_id, ingredient_id, gross_quantity || 0, unit || 'g', notes || '']
        );
        result = { success: true, message: 'Ingrédient ajouté' };
        break;
      }

      case 'modify_ingredient': {
        // Update ingredient in recipe
        const { recipe_id, ingredient_id, changes } = params;
        if (!recipe_id || !ingredient_id) {
          return res.status(400).json({ error: 'recipe_id et ingredient_id requis' });
        }
        const setClauses = [];
        const values = [];
        for (const [key, value] of Object.entries(changes)) {
          if (['gross_quantity', 'net_quantity', 'unit', 'notes'].includes(key)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
          }
        }
        if (setClauses.length > 0) {
          values.push(recipe_id, ingredient_id);
          run(
            `UPDATE recipe_ingredients SET ${setClauses.join(', ')} WHERE recipe_id = ? AND ingredient_id = ?`,
            values
          );
        }
        result = { success: true, message: 'Ingrédient modifié' };
        break;
      }

      case 'remove_ingredient': {
        const { recipe_id, ingredient_id } = params;
        if (!recipe_id || !ingredient_id) {
          return res.status(400).json({ error: 'recipe_id et ingredient_id requis' });
        }
        run('DELETE FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ?', [recipe_id, ingredient_id]);
        result = { success: true, message: 'Ingrédient supprimé' };
        break;
      }

      case 'create_recipe': {
        const { name, category, portions, selling_price, recipe_type } = params;
        if (!name) return res.status(400).json({ error: 'name requis' });
        const info = run(
          'INSERT INTO recipes (name, category, portions, selling_price, recipe_type) VALUES (?, ?, ?, ?, ?)',
          [name, category || 'plat', portions || 1, selling_price || 0, recipe_type || 'plat']
        );
        result = { success: true, message: 'Fiche créée', recipe_id: info.lastInsertRowid };
        break;
      }

      case 'modify_recipe': {
        const { recipe_id, changes } = params;
        if (!recipe_id) return res.status(400).json({ error: 'recipe_id requis' });
        const setClauses = [];
        const values = [];
        for (const [key, value] of Object.entries(changes)) {
          if (['name', 'category', 'portions', 'selling_price', 'recipe_type', 'description'].includes(key)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
          }
        }
        if (setClauses.length > 0) {
          values.push(recipe_id);
          run(`UPDATE recipes SET ${setClauses.join(', ')} WHERE id = ?`, values);
        }
        result = { success: true, message: 'Fiche modifiée' };
        break;
      }

      case 'delete_recipe': {
        const { recipe_id } = params;
        if (!recipe_id) return res.status(400).json({ error: 'recipe_id requis' });
        // Delete recipe_ingredients first (FK constraint)
        run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipe_id]);
        run('DELETE FROM recipes WHERE id = ?', [recipe_id]);
        result = { success: true, message: 'Fiche supprimée' };
        break;
      }

      case 'add_supplier': {
        const { name, email, phone } = params;
        if (!name) return res.status(400).json({ error: 'name requis' });
        const info = run(
          'INSERT INTO suppliers (name, email, phone) VALUES (?, ?, ?)',
          [name, email || null, phone || null]
        );
        result = { success: true, message: 'Fournisseur créé', supplier_id: info.lastInsertRowid };
        break;
      }

      case 'create_order': {
        const { supplier_id, ingredient_id, quantity, unit, notes } = params;
        if (!supplier_id || !ingredient_id) {
          return res.status(400).json({ error: 'supplier_id et ingredient_id requis' });
        }
        const info = run(
          'INSERT INTO orders (supplier_id, ingredient_id, quantity, unit, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [supplier_id, ingredient_id, quantity || 0, unit || 'kg', 'pending', notes || '']
        );
        result = { success: true, message: 'Commande créée', order_id: info.lastInsertRowid };
        break;
      }

      case 'record_temperature': {
        const { location, temperature, timestamp } = params;
        if (!location || temperature === undefined) {
          return res.status(400).json({ error: 'location et temperature requis' });
        }
        const info = run(
          'INSERT INTO haccp_temperatures (location, temperature, recorded_at) VALUES (?, ?, ?)',
          [location, temperature, timestamp || new Date().toISOString()]
        );
        result = { success: true, message: 'Température enregistrée', record_id: info.lastInsertRowid };
        break;
      }

      case 'record_loss': {
        const { ingredient_id, quantity, reason, notes } = params;
        if (!ingredient_id || !quantity) {
          return res.status(400).json({ error: 'ingredient_id et quantity requis' });
        }
        run(
          'INSERT INTO stock_movements (ingredient_id, quantity, movement_type, reason, notes, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
          [ingredient_id, -Math.abs(quantity), 'perte', reason || '', notes || '', new Date().toISOString()]
        );
        result = { success: true, message: 'Perte enregistrée' };
        break;
      }

      case 'modify_supplier_price': {
        const { supplier_id, ingredient_id, price, unit } = params;
        if (!supplier_id || !ingredient_id || price === undefined) {
          return res.status(400).json({ error: 'supplier_id, ingredient_id et price requis' });
        }
        run(
          'INSERT OR REPLACE INTO supplier_prices (supplier_id, ingredient_id, price, unit, last_updated) VALUES (?, ?, ?, ?, ?)',
          [supplier_id, ingredient_id, price, unit || 'kg', new Date().toISOString()]
        );
        result = { success: true, message: 'Prix mis à jour' };
        break;
      }

      default:
        return res.status(400).json({ error: `Action non reconnue: ${type}` });
    }

    res.json(result);
  } catch (e) {
    console.error('Execute action error:', e);
    res.status(500).json({ error: 'Erreur exécution action', details: e.message });
  }
});

function filterActionsByRole(actions, role) {
  // Restrict certain actions based on role
  const roleRestrictions = {
    'cuisinier': ['create_recipe', 'delete_recipe', 'add_supplier', 'modify_supplier_price'],
    'equipier': ['add_ingredient', 'modify_ingredient', 'create_recipe', 'delete_recipe', 'add_supplier', 'create_order', 'modify_supplier_price'],
    'salle': ['add_ingredient', 'modify_ingredient', 'create_recipe', 'delete_recipe', 'add_supplier', 'create_order', 'modify_supplier_price'],
  };

  if (!roleRestrictions[role]) {
    return actions; // gerant has full access
  }

  return actions.filter(action => !roleRestrictions[role].includes(action.type));
}

function buildPageContext(page, id) {
  try {
    if (page === 'recipe' && id) {
      const recipe = get('SELECT * FROM recipes WHERE id = ?', [id]);
      if (!recipe) return '';

      const ingredients = all(
        'SELECT ri.*, i.name, i.price_per_unit FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.recipe_id = ?',
        [id]
      );

      let totalCost = 0;
      const ingList = ingredients.map(ing => {
        const costPerBase = ing.price_per_unit ? ing.price_per_unit / (ing.price_unit === 'kg' ? 1000 : 1) : 0;
        const qty = ing.gross_quantity * (ing.unit === 'kg' ? 1000 : ing.unit === 'l' ? 1000 : 1);
        const cost = qty * costPerBase;
        totalCost += cost;
        return `${ing.name} (${ing.gross_quantity}${ing.unit})`;
      }).join(', ');

      return `\n\nCONTEXTE RECETTE :
Fiche: "${recipe.name}" (${recipe.portions} portions, prix vente ${recipe.selling_price}€)
Ingrédients: ${ingList}
Coût estimé: ${totalCost.toFixed(2)}€
Food cost: ${recipe.selling_price > 0 ? (totalCost / recipe.selling_price * 100).toFixed(1) : 0}%`;
    } else if (page === 'stock' && id) {
      const stock = get('SELECT s.*, i.name FROM stock s JOIN ingredients i ON i.id = s.ingredient_id WHERE s.id = ?', [id]);
      if (!stock) return '';
      return `\n\nCONTEXTE STOCK :
Ingrédient: "${stock.name}"
Quantité en stock: ${stock.quantity}${stock.unit}
Minimum: ${stock.min_quantity}${stock.unit}`;
    }
    return '';
  } catch (e) {
    return '';
  }
}

function buildRestaurantContext() {
  try {
    const parts = [];

    // Recipe stats
    const recipeStats = get(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN recipe_type = 'plat' THEN 1 END) as plats,
             COUNT(CASE WHEN recipe_type = 'sous_recette' THEN 1 END) as sous_recettes,
             AVG(CASE WHEN selling_price > 0 THEN
               (SELECT SUM(ri.gross_quantity * COALESCE(
                 (SELECT sp.price / CASE WHEN sp.unit = 'kg' THEN 1000 WHEN sp.unit = 'L' THEN 1000 ELSE 1 END
                  FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id ORDER BY sp.last_updated DESC LIMIT 1), 0))
               FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) / selling_price * 100 END) as avg_food_cost
      FROM recipes r
    `);
    parts.push(`FICHES : ${recipeStats.total} fiches techniques (${recipeStats.plats} plats, ${recipeStats.sous_recettes} sous-recettes). Food cost moyen : ${recipeStats.avg_food_cost ? recipeStats.avg_food_cost.toFixed(1) + '%' : 'non calculé'}.`);

    // Top 5 recipes by food cost
    const topRecipes = all(`
      SELECT r.name, r.selling_price, r.category,
        COALESCE((SELECT SUM(ri.gross_quantity * COALESCE(
          (SELECT sp.price / CASE WHEN sp.unit = 'kg' THEN 1000 WHEN sp.unit = 'L' THEN 1000 ELSE 1 END
           FROM supplier_prices sp WHERE sp.ingredient_id = ri.ingredient_id ORDER BY sp.last_updated DESC LIMIT 1), 0))
        FROM recipe_ingredients ri WHERE ri.recipe_id = r.id), 0) as cost
      FROM recipes r WHERE r.selling_price > 0 AND (r.recipe_type = 'plat' OR r.recipe_type IS NULL)
      ORDER BY (cost / r.selling_price) DESC LIMIT 5
    `);
    if (topRecipes.length > 0) {
      parts.push('TOP 5 FOOD COST (les plus chers) : ' + topRecipes.map(r =>
        `${r.name} (coût: ${r.cost.toFixed(2)}€, vente: ${r.selling_price}€, FC: ${r.selling_price > 0 ? (r.cost / r.selling_price * 100).toFixed(1) : 0}%)`
      ).join(', '));
    }

    // Stock summary
    const stockSummary = get(`
      SELECT COUNT(*) as total_items,
             COALESCE(SUM(s.quantity * COALESCE(i.price_per_unit, 0)), 0) as total_value,
             COUNT(CASE WHEN s.quantity <= s.min_quantity AND s.min_quantity > 0 THEN 1 END) as low_stock
      FROM stock s JOIN ingredients i ON i.id = s.ingredient_id
    `);
    parts.push(`STOCK : ${stockSummary.total_items} ingrédients en stock, valeur totale ${stockSummary.total_value.toFixed(2)}€, ${stockSummary.low_stock} en stock bas.`);

    // Suppliers
    const supplierCount = get('SELECT COUNT(*) as c FROM suppliers').c;
    parts.push(`FOURNISSEURS : ${supplierCount} fournisseurs référencés.`);

    // Recent losses
    const losses = get(`
      SELECT COALESCE(SUM(ABS(sm.quantity) * COALESCE(i.price_per_unit, 0)), 0) as loss_value
      FROM stock_movements sm LEFT JOIN ingredients i ON i.id = sm.ingredient_id
      WHERE sm.movement_type = 'perte' AND date(sm.recorded_at) >= date('now', '-30 days')
    `);
    parts.push(`PERTES (30j) : ${losses.loss_value.toFixed(2)}€ de pertes déclarées.`);

    // Ingredients list (categories)
    const categories = all(`
      SELECT category, COUNT(*) as c FROM ingredients WHERE category IS NOT NULL GROUP BY category ORDER BY c DESC LIMIT 8
    `);
    if (categories.length > 0) {
      parts.push('CATÉGORIES INGRÉDIENTS : ' + categories.map(c => `${c.category} (${c.c})`).join(', '));
    }

    return parts.join('\n');
  } catch (e) {
    return 'Données du restaurant non disponibles: ' + e.message;
  }
}

module.exports = router;
