// ═══════════════════════════════════════════
// Gemini-Vision-backed scanners + import confirmation.
//
// /scan-invoice     → extract supplier invoice items (multipart OR base64)
// /scan-mercuriale  → extract price list + fuzzy-match to local ingredients
// /import-mercuriale → upsert supplier_prices after user validation
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const {
  all, get, run, fs,
  GEMINI_API_KEY, buildGeminiUrl, geminiHeaders, selectModel,
  upload,
} = require('./ai-core');

const router = Router();

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
    const response = await fetch(buildGeminiUrl(selectModel('scan-invoice', req.user?.restaurant_id)), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
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

    // Match product_name with existing ingredients (fuzzy) — tenant-scoped per
    // PENTEST_REPORT cross-tenant-leak sweep.
    const invoiceRid = req.user && req.user.restaurant_id;
    if (parsed.items && Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        const name = (item.product_name || '').toLowerCase().trim();
        if (!name) continue;
        let match = get('SELECT id, name FROM ingredients WHERE LOWER(name) = ? AND restaurant_id = ?', [name, invoiceRid]);
        if (!match) {
          match = get('SELECT id, name FROM ingredients WHERE LOWER(name) LIKE ? AND restaurant_id = ? ORDER BY LENGTH(name) ASC LIMIT 1', [`%${name}%`, invoiceRid]);
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
    res.status(500).json({ error: 'Erreur scan facture' });
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
    const response = await fetch(buildGeminiUrl(selectModel('scan-mercuriale', req.user?.restaurant_id)), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
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

    // Fuzzy match products with existing ingredients — scoped by tenant
    // (PENTEST_REPORT sweep; was unscoped `SELECT id, name FROM ingredients`).
    if (parsed.items && Array.isArray(parsed.items)) {
      const allIngredients = all(
        'SELECT id, name FROM ingredients WHERE restaurant_id = ?',
        [req.user && req.user.restaurant_id]
      );

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
    res.status(500).json({ error: 'Erreur scan mercuriale' });
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
    const rid = req.user.restaurant_id;
    const { supplier_id, items } = req.body;
    if (!supplier_id) return res.status(400).json({ error: 'supplier_id requis' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article à importer' });
    }

    const supplier = get('SELECT id, name FROM suppliers WHERE id = ? AND restaurant_id = ?', [Number(supplier_id), rid]);
    if (!supplier) return res.status(404).json({ error: 'Fournisseur introuvable' });

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      if (!item.ingredient_id || !item.price || item.price <= 0) {
        skipped++;
        continue;
      }

      // Verify ingredient belongs to caller tenant before any write
      const ingOk = get('SELECT id FROM ingredients WHERE id = ? AND restaurant_id = ?', [item.ingredient_id, rid]);
      if (!ingOk) { skipped++; continue; }

      const unit = item.unit || 'kg';

      // Upsert supplier_prices
      const existing = get('SELECT id, price FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ? AND restaurant_id = ?',
        [item.ingredient_id, supplier_id, rid]);

      if (existing) {
        if (existing.price !== item.price) {
          run('UPDATE supplier_prices SET price = ?, unit = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
            [item.price, unit, existing.id, rid]);
          updated++;
        } else {
          skipped++; // Same price, no update needed
          continue;
        }
      } else {
        run('INSERT INTO supplier_prices (restaurant_id, ingredient_id, supplier_id, price, unit) VALUES (?, ?, ?, ?, ?)',
          [rid, item.ingredient_id, supplier_id, item.price, unit]);
        created++;
      }

      // Record in price_history
      run('INSERT INTO price_history (restaurant_id, ingredient_id, supplier_id, price, recorded_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [rid, item.ingredient_id, supplier_id, item.price]);
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
    console.error('Supplier import error:', e);
    res.status(500).json({ error: 'Erreur import' });
  }
});

module.exports = router;
