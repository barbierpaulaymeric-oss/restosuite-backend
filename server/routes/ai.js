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

    res.json(JSON.parse(content));
  } catch (e) {
    console.error('AI parse error:', e);
    res.status(500).json({ error: 'Failed to parse voice input', details: e.message });
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
