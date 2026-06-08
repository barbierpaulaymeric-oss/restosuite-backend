// ═══════════════════════════════════════════
// Gemini-Vision-backed scanners + import confirmation.
//
// /scan-invoice     → extract supplier invoice items (multipart OR base64)
// /scan-mercuriale  → extract price list + fuzzy-match to local ingredients
// /import-mercuriale → upsert supplier_prices after user validation
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const multer = require('multer');
const {
  all, get, run, fs,
  GEMINI_API_KEY, buildGeminiUrl, geminiHeaders, selectModel,
  upload, ALLOWED_MIME_TYPES,
} = require('./ai-core');
const { parseXlsxBuffer } = require('../lib/mercuriale-parse');

const router = Router();

// ─── Mercuriale-only uploader: image/PDF (Gemini path) + xlsx/xls/csv
// (deterministic parser path). Kept separate from ai-core's `upload` so the
// invoice scanner stays image/PDF-only — invoices don't ship as spreadsheets.
const SPREADSHEET_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',
  'application/csv',
]);
const SPREADSHEET_EXT_RE = /\.(xlsx|xls|csv)$/i;
const MERCURIALE_MIME_TYPES = new Set([...ALLOWED_MIME_TYPES, ...SPREADSHEET_MIME_TYPES]);

function isSpreadsheetUpload(file) {
  if (!file) return false;
  if (SPREADSHEET_MIME_TYPES.has(file.mimetype)) return true;
  // Browsers occasionally send octet-stream for .csv/.xls — fall back to extension.
  if (file.originalname && SPREADSHEET_EXT_RE.test(file.originalname)) return true;
  return false;
}

const mercurialeUpload = multer({
  dest: '/tmp/restosuite-uploads',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (MERCURIALE_MIME_TYPES.has(file.mimetype) || (file.originalname && SPREADSHEET_EXT_RE.test(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Formats acceptés : JPEG, PNG, WebP, GIF, PDF, XLSX, XLS, CSV.'));
    }
  },
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
// POST /api/ai/scan-delivery — Scan d'un bon de livraison via Gemini Vision
//
// Cuisine pro : à la réception, le chef photographie le BL papier pour
// extraire les lignes et comparer avec le contrôle (écarts qté, manquant).
// Différence avec /scan-invoice : on n'attend ni prix unitaire ni totaux —
// un BL n'en porte pas (le tarif vient de la mercuriale).
// ═══════════════════════════════════════════
router.post('/scan-delivery', upload.single('delivery'), async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  let imageBase64 = null;
  let mimeType = 'image/jpeg';
  let filePath = null;

  if (req.file) {
    filePath = req.file.path;
    imageBase64 = fs.readFileSync(filePath).toString('base64');
    mimeType = req.file.mimetype || 'image/jpeg';
  } else if (req.body && req.body.image_base64) {
    imageBase64 = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
    mimeType = req.body.mime_type || 'image/jpeg';
  }

  if (!imageBase64) {
    if (filePath) { try { fs.unlinkSync(filePath); } catch {} }
    return res.status(400).json({ error: 'Image requise (fichier ou base64)' });
  }

  const prompt = "Extrais les données de ce bon de livraison fournisseur de restaurant. Retourne un JSON: supplier_name, delivery_number, delivery_date (format YYYY-MM-DD), items (array de {product_name, quantity, unit, unit_price, total_price, batch_number, dlc}), total_ht, total_ttc. Les prix peuvent figurer ou non sur le BL — si présents, les extraire ; si absents, mettre null. Si un champ n'est pas visible, mets null.";

  try {
    const response = await fetch(buildGeminiUrl(selectModel('scan-invoice', req.user?.restaurant_id)), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBase64 } },
        ]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini Vision (BL) error:', err);
      if (filePath) { try { fs.unlinkSync(filePath); } catch {} }
      return res.status(502).json({ error: 'Erreur service IA', details: err });
    }
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      if (filePath) { try { fs.unlinkSync(filePath); } catch {} }
      return res.status(502).json({ error: 'Réponse IA vide' });
    }

    const parsed = JSON.parse(content);

    // Match product_name avec les ingrédients du tenant (PENTEST_REPORT).
    const rid = req.user && req.user.restaurant_id;
    if (parsed.items && Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        const name = (item.product_name || '').toLowerCase().trim();
        if (!name) continue;
        let match = get('SELECT id, name FROM ingredients WHERE LOWER(name) = ? AND restaurant_id = ?', [name, rid]);
        if (!match) {
          match = get('SELECT id, name FROM ingredients WHERE LOWER(name) LIKE ? AND restaurant_id = ? ORDER BY LENGTH(name) ASC LIMIT 1', [`%${name}%`, rid]);
        }
        if (match) {
          item.ingredient_id = match.id;
          item.matched_ingredient = match.name;
        }
      }
    }

    res.json(parsed);
  } catch (e) {
    console.error('Delivery scan error:', e);
    if (filePath) { try { fs.unlinkSync(filePath); } catch {} }
    res.status(500).json({ error: 'Erreur scan BL' });
  } finally {
    if (filePath) { try { fs.unlinkSync(filePath); } catch {} }
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/scan-mercuriale — Import mercuriale fournisseur
// XLSX/XLS/CSV → deterministic parser (lib/mercuriale-parse).
// Image/PDF → Gemini Vision OCR.
// Both paths return the same response shape.
// ═══════════════════════════════════════════
router.post('/scan-mercuriale', mercurialeUpload.single('mercuriale'), async (req, res) => {
  // ─── Spreadsheet path: deterministic, no Gemini needed ───
  if (req.file && isSpreadsheetUpload(req.file)) {
    const sheetPath = req.file.path;
    try {
      const buffer = fs.readFileSync(sheetPath);
      const rawItems = parseXlsxBuffer(buffer);
      const items = rawItems.map(it => ({
        product_name: it.name,
        category: it.category || null,
        unit: it.unit || 'kg',
        conditioning: it.packaging || null,
        price: it.price,
        sku: it.sku || null,
        organic: false,
        origin: null,
      }));

      const rid = req.user && req.user.restaurant_id;
      if (items.length > 0 && rid) {
        const allIngredients = all(
          'SELECT id, name FROM ingredients WHERE restaurant_id = ?',
          [rid]
        );
        for (const item of items) {
          const name = (item.product_name || '').toLowerCase().trim();
          if (!name) continue;
          let match = allIngredients.find(i => i.name.toLowerCase() === name);
          if (!match) {
            match = allIngredients.find(i => i.name.toLowerCase().includes(name) || name.includes(i.name.toLowerCase()));
          }
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

      const matched = items.filter(i => i.ingredient_id).length;
      const total = items.length;

      return res.json({
        supplier_name: null,
        date: null,
        items,
        summary: {
          total_items: total,
          matched_items: matched,
          unmatched_items: total - matched,
          match_rate: total > 0 ? Math.round(matched / total * 100) : 0,
        },
      });
    } catch (e) {
      console.error('Mercuriale spreadsheet parse error:', e);
      return res.status(400).json({ error: 'Lecture du tableur impossible' });
    } finally {
      try { fs.unlinkSync(sheetPath); } catch {}
    }
  }

  // ─── Image/PDF path: Gemini Vision ───
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

    let priceUpdated = 0;     // existing supplier_prices row updated (matched products)
    let priceCreated = 0;     // new supplier_prices row (matched products, first time)
    let catalogCreated = 0;   // new supplier_catalog row
    let catalogUpdated = 0;   // existing supplier_catalog row updated (real change)
    let unchanged = 0;        // catalog row identical to incoming — silently skipped
    let skipped = 0;          // dropped because input was invalid

    for (const item of items) {
      const price = Number(item.price);
      if (!item.product_name || !Number.isFinite(price) || price <= 0) {
        skipped++;
        continue;
      }
      const unit = item.unit || 'kg';
      const productName = String(item.product_name).trim();
      const sku = item.sku || null;
      const category = item.category || null;
      let ingredientId = item.ingredient_id ? Number(item.ingredient_id) : null;

      // Verify the ingredient (if provided) belongs to this tenant
      if (ingredientId) {
        const ingOk = get('SELECT id FROM ingredients WHERE id = ? AND restaurant_id = ?', [ingredientId, rid]);
        if (!ingOk) ingredientId = null; // fall through to catalog-only insert
      }

      // ─── ALWAYS upsert supplier_catalog so products (matched or not) appear
      //     in the order form even when they have no local ingredient mapping.
      //     Match priority: SKU first (stable across renames), then case-insensitive name.
      let existingCat = null;
      if (sku) {
        existingCat = get(
          'SELECT * FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(sku) = LOWER(?)',
          [supplier_id, rid, sku]
        );
      }
      if (!existingCat) {
        existingCat = get(
          'SELECT * FROM supplier_catalog WHERE supplier_id = ? AND restaurant_id = ? AND LOWER(product_name) = LOWER(?)',
          [supplier_id, rid, productName]
        );
      }
      if (existingCat) {
        // Treat as identical only when nothing the user could see has changed
        // — name, price, unit, sku, category, plus the new ingredient mapping.
        const sameIngredient = (existingCat.ingredient_id || null) === ingredientId
          || (ingredientId === null);
        const isIdentical =
          (existingCat.product_name || '') === productName &&
          Number(existingCat.price) === price &&
          (existingCat.unit || null) === unit &&
          (existingCat.sku || null) === sku &&
          (existingCat.category || null) === category &&
          sameIngredient;
        if (isIdentical) {
          unchanged++;
        } else {
          // Always overwrite with incoming mercuriale data — the latest scan
          // is authoritative. COALESCE keeps the prior ingredient mapping when
          // this scan didn't include one.
          run(
            `UPDATE supplier_catalog
                SET product_name = ?, category = ?, unit = ?, price = ?,
                    sku = ?, ingredient_id = COALESCE(?, ingredient_id), updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND restaurant_id = ?`,
            [productName, category, unit, price, sku, ingredientId, existingCat.id, rid]
          );
          if (Number(existingCat.price) !== price) {
            run(
              `INSERT INTO price_change_notifications
                 (restaurant_id, supplier_id, product_name, old_price, new_price, change_type)
               VALUES (?, ?, ?, ?, ?, 'update')`,
              [rid, Number(supplier_id), productName, existingCat.price, price]
            );
          }
          catalogUpdated++;
        }
      } else {
        run(
          `INSERT INTO supplier_catalog
             (restaurant_id, supplier_id, product_name, category, unit, price, sku, ingredient_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [rid, Number(supplier_id), productName, category, unit, price, sku, ingredientId]
        );
        run(
          `INSERT INTO price_change_notifications
             (restaurant_id, supplier_id, product_name, old_price, new_price, change_type)
           VALUES (?, ?, ?, NULL, ?, 'new')`,
          [rid, Number(supplier_id), productName, price]
        );
        catalogCreated++;
      }

      // ─── For matched items, also upsert supplier_prices + price_history.
      //     This keeps the existing /suppliers/:id/prices flow working for
      //     ingredient-keyed analytics (food cost, suggestions, etc.).
      if (ingredientId) {
        const existing = get(
          'SELECT id, price FROM supplier_prices WHERE ingredient_id = ? AND supplier_id = ? AND restaurant_id = ?',
          [ingredientId, supplier_id, rid]
        );
        if (existing) {
          if (Number(existing.price) !== price) {
            run('UPDATE supplier_prices SET price = ?, unit = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ? AND restaurant_id = ?',
              [price, unit, existing.id, rid]);
            priceUpdated++;
            run('INSERT INTO price_history (restaurant_id, ingredient_id, supplier_id, price, recorded_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [rid, ingredientId, Number(supplier_id), price]);
          }
        } else {
          run('INSERT INTO supplier_prices (restaurant_id, ingredient_id, supplier_id, price, unit) VALUES (?, ?, ?, ?, ?)',
            [rid, ingredientId, Number(supplier_id), price, unit]);
          priceCreated++;
          run('INSERT INTO price_history (restaurant_id, ingredient_id, supplier_id, price, recorded_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [rid, ingredientId, Number(supplier_id), price]);
        }
      }
    }

    res.json({
      success: true,
      supplier_name: supplier.name,
      // backward-compatible counts (still used by existing UI summary):
      updated: priceUpdated,
      created: priceCreated + catalogCreated,
      skipped,
      total: items.length,
      // detailed breakdown:
      matched_created: priceCreated,
      matched_updated: priceUpdated,
      catalog_created: catalogCreated,
      catalog_updated: catalogUpdated,
      unchanged
    });
  } catch (e) {
    console.error('Supplier import error:', e);
    res.status(500).json({ error: 'Erreur import' });
  }
});

module.exports = router;
