const { Router } = require('express');
const { all, get } = require('../db');
const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

module.exports = router;
