// ═══════════════════════════════════════════
// Conversational Alto endpoints.
//
// /api/ai/chef      → restaurant-aware Q&A (no action detection)
// /api/ai/assistant → full Alto with shortcut matching, onboarding, and
//                     structured action detection (filtered by role)
// ═══════════════════════════════════════════
'use strict';

const { Router } = require('express');
const {
  run,
  GEMINI_API_KEY, buildGeminiUrl, geminiHeaders, selectModel,
  buildRestaurantContext, buildPageContext,
  loadPersonalizationContext, matchShortcut, scrubPII,
  filterActionsByRole,
} = require('./ai-core');

const router = Router();

// ═══════════════════════════════════════════
// POST /api/ai/chef — Assistant IA "Chef" contextuel
// Chat avec un assistant qui connaît les données du restaurant
// ═══════════════════════════════════════════
router.post('/chef', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const rawMessage = req.body && req.body.message;
  const conversation_history = req.body && req.body.conversation_history;
  if (!rawMessage) return res.status(400).json({ error: 'Message requis' });
  // PENTEST_REPORT A.6 — redact PII on the way out to Gemini.
  const message = scrubPII(rawMessage);

  try {
    // Build restaurant context from real data (tenant-scoped)
    const context = buildRestaurantContext(req.user?.restaurant_id);

    // Load personalization context (preferences, recent learning, shortcuts)
    const perso = loadPersonalizationContext(req.user?.restaurant_id, req.user?.id);

    const systemPrompt = `Tu es Alto, l'assistant culinaire intelligent de RestoSuite. Tu connais parfaitement ce restaurant et ses données.

CONTEXTE DU RESTAURANT :
${context}
${perso.block}

RÈGLES :
- Réponds en français, de manière concise et professionnelle
- Base tes réponses sur les données réelles du restaurant ci-dessus
- Pour les questions sur les coûts, utilise les prix et food cost réels
- Pour les conseils, sois pratique et actionnable
- Si tu ne connais pas une info spécifique, dis-le honnêtement
- Tu peux suggérer des optimisations basées sur les données
- Utilise les ratios standards de la restauration (food cost 25-30%, etc.)
- Formate tes réponses de manière claire avec des paragraphes courts
- Respecte les préférences utilisateur ci-dessus (tutoiement/vouvoiement, type d'établissement, etc.)

DOMAINES D'EXPERTISE :
- Fiches techniques et costing
- Gestion des stocks et approvisionnement
- HACCP et hygiène alimentaire
- Analyse de marge et food cost
- Optimisation des pertes
- Gestion fournisseurs
- Réglementation restauration (allergènes INCO, traçabilité)
- Conseils culinaires et techniques`;

    // Build conversation (systemInstruction handles language + context; no synthetic first turn needed)
    const contents = [];

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

    const chefModel = selectModel('chef', req.user?.restaurant_id);
    const response = await fetch(buildGeminiUrl(chefModel), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Alto/chef] Gemini ${response.status} (model=${chefModel}):`, err.slice(0, 500));
      return res.status(502).json({ error: 'Erreur service IA', status: response.status });
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      console.error('[Alto/chef] Empty reply. Raw:', JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: 'Réponse IA vide' });
    }

    res.json({ reply });
  } catch (e) {
    console.error('[Alto/chef] Exception:', e && e.name, e && e.message, e && e.stack);
    const hint = e && e.name === 'TimeoutError' ? 'Timeout IA (30s)' : 'Erreur assistant';
    res.status(500).json({ error: hint });
  }
});

// ═══════════════════════════════════════════
// POST /api/ai/assistant — Advanced AI with action detection
// ═══════════════════════════════════════════
router.post('/assistant', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const rawMessage = req.body && req.body.message;
  const conversation_history = req.body && req.body.conversation_history;
  const context_page = req.body && req.body.context_page;
  const context_id = req.body && req.body.context_id;
  const user = req.user; // From requireAuth middleware

  if (!rawMessage) return res.status(400).json({ error: 'Message requis' });
  // PENTEST_REPORT A.6 — redact PII (emails, phones, card-like numbers, NIR)
  // before the user's message lands in the Gemini request. The user's intent
  // is preserved since domain-relevant text is unaffected.
  const message = scrubPII(rawMessage);

  try {
    // ─── Shortcut fuzzy match — skip Gemini if a trigger matches ───
    const shortcutHit = matchShortcut(user.restaurant_id, message);
    if (shortcutHit) {
      // Bump usage counter + last_used
      try {
        run(
          `UPDATE ai_shortcuts
              SET usage_count = COALESCE(usage_count, 0) + 1,
                  last_used_at = CURRENT_TIMESTAMP
            WHERE id = ? AND restaurant_id = ?`,
          [shortcutHit.id, user.restaurant_id]
        );
      } catch (usageErr) {
        // Usage-counter bump must never block the response; log at warn level.
        console.warn('shortcut usage counter bump failed:', usageErr.message);
      }

      let templateObj = null;
      if (shortcutHit.action_template) {
        try {
          templateObj = typeof shortcutHit.action_template === 'string'
            ? JSON.parse(shortcutHit.action_template)
            : shortcutHit.action_template;
        } catch (_) { templateObj = null; }
      }

      const action = {
        type: shortcutHit.action_type,
        description: shortcutHit.description || `Raccourci : ${shortcutHit.trigger_phrase}`,
        params: (templateObj && typeof templateObj === 'object') ? templateObj : {},
        requires_confirmation: true,
      };
      const filtered = filterActionsByRole([action], user.role);
      return res.json({
        reply: `Raccourci détecté : « ${shortcutHit.trigger_phrase} ».`,
        actions: filtered,
        shortcut_used: shortcutHit.id,
      });
    }

    // Build restaurant context from real data (tenant-scoped)
    const context = buildRestaurantContext(user.restaurant_id);

    // Fetch page-specific context if provided (tenant-scoped)
    let pageContext = '';
    if (context_page && context_id) {
      pageContext = buildPageContext(context_page, context_id, user.restaurant_id);
    }

    // Load personalization + onboarding state
    const perso = loadPersonalizationContext(user.restaurant_id, user.id);
    const onboardingBlock = perso.onboardingComplete
      ? ''
      : `\n\nONBOARDING (PREMIÈRE UTILISATION) :
L'utilisateur n'a pas encore configuré Alto. Dans ta réponse, pose-lui 2 questions courtes avant toute autre chose :
1. Quel type d'établissement ? (bistrot, brasserie, gastronomique, cantine, traiteur, food-truck, autre)
2. Préfère-t-il le tutoiement ou le vouvoiement ?
Explique brièvement que ses réponses vont personnaliser Alto. Ne propose aucune action (actions: []) tant que l'onboarding n'est pas fait.`;

    const systemPrompt = `Tu es Alto, l'assistant culinaire intelligent de RestoSuite. Tu connais parfaitement ce restaurant et ses données, et tu aides le chef et l'équipe à saisir tous leurs relevés HACCP et opérationnels en langage naturel (voix ou texte).

CONTEXTE DU RESTAURANT :
${context}
${pageContext}
${perso.block}${onboardingBlock}

CAPACITÉS D'ACTION :
Tu peux détecter les demandes d'action et retourner un plan d'action structuré dans le champ \`actions\`. Types d'actions disponibles :

— Fiches techniques / stock / fournisseurs —
- add_ingredient: ajouter un ingrédient à une recette
- modify_ingredient: modifier quantité/notes d'un ingrédient
- remove_ingredient: supprimer un ingrédient
- create_recipe: créer une nouvelle fiche technique
- modify_recipe: modifier les paramètres d'une recette (portions, prix)
- delete_recipe: supprimer une recette
- add_supplier: créer un nouveau fournisseur
- create_order: créer une commande
- modify_supplier_price: modifier le prix d'un ingrédient chez un fournisseur
- record_loss: enregistrer une perte stock
- record_waste: enregistrer un déchet (poubelle, jeté)

— HACCP températures & CCP —
- record_temperature: enregistrer une température (frigo, chambre froide, congélateur, plat chaud…). Params: { location, temperature, notes? }. Le backend résout la zone par son nom.
- record_cooking: relevé CCP2 cuisson (T° à cœur ≥75°C / volaille ≥70°C). Params: { product_name, measured_temperature, target_temperature?, recipe_id?, batch_number?, operator?, notes? }
- record_cooling: refroidissement rapide (63°→10°C en <2h). Params: { product_name, quantity?, unit?, start_time?, temp_start, time_at_63c?, time_at_10c?, notes? }
- record_reheating: remise en température (≥63°C en <1h). Params: { product_name, quantity?, unit?, start_time?, temp_start, time_at_63c?, notes? }
- record_fryer_check: contrôle huile de friture / TPC. Params: { fryer_id ou fryer_name, action_type ("controle"|"vidange"|"filtration"), polar_value?, notes? }
- record_thermometer_calibration: étalonnage thermomètre. Params: { thermometer_id, reference_temperature, measured_temperature, tolerance?, calibrated_by?, notes? }

— HACCP nettoyage & traçabilité —
- record_cleaning: tâche de nettoyage réalisée. Params: { task_id ou task_name, notes? }
- record_traceability_in: réception marchandise / DLC / N° lot. Params: { product_name, supplier?, batch_number?, dlc?, temperature_at_reception?, quantity?, unit?, notes? }
- record_traceability_out: expédition / sortie de lot (livraison, traiteur). Params: { product_name, batch_number?, destination_type, destination_name?, quantity?, unit?, dispatch_date?, dispatch_time?, temperature_at_dispatch?, responsible_person?, notes? }
- record_witness_meal: plats témoins (arrêté 21/12/2009). Params: { meal_date, meal_type, service_type?, samples?, storage_temperature?, storage_location?, kept_until, operator?, notes? }

— HACCP non-conformités & actions correctives —
- record_non_conformity: signaler une non-conformité. Params: { title, description?, category?, severity? ("mineure"|"majeure"|"critique"), corrective_action? }
- record_corrective_action: consigner une action corrective réalisée. Params: { category, trigger_description, action_taken, responsible_person?, started_at?, completed_at?, status?, notes? }

— BPH / Managériaux (gérant) —
- record_training: formation hygiène/HACCP. Params: { employee_name, training_topic, trainer?, training_date, next_renewal_date?, duration_hours?, certificate_ref?, notes? }
- record_pest_control: visite dératisation/lutte nuisibles. Params: { provider_name?, visit_date, next_visit_date?, findings?, actions_taken?, bait_stations_count?, status?, report_ref? }
- record_equipment_maintenance: entretien équipement. Params: { equipment_name, equipment_type?, location?, last_maintenance_date?, next_maintenance_date?, provider?, cost?, status?, notes? }
- record_staff_health: visite médicale/aptitude/maladie personnel. Params: { staff_name, record_type ("aptitude"|"visite_medicale"|"maladie"|"blessure"|"formation_hygiene"), date_record, date_expiry?, notes? }
- record_recall: procédure de retrait/rappel. Params: { product_name, lot_number?, reason?, severity?, quantity_affected?, quantity_unit?, actions_taken? }
- record_tiac: toxi-infection alimentaire collective. Params: { date_incident, description, nb_personnes?, symptomes?, aliments_suspects?, mesures_conservatoires?, contact_ddpp? }
- record_water_analysis: analyse qualité eau. Params: { analysis_date, analysis_type?, provider?, results?, conformity?, next_analysis_date?, report_ref?, water_source? }
- record_pms_audit: audit PMS. Params: { audit_date, auditor_name, audit_type?, scope?, findings?, overall_score?, status?, next_audit_date? }

RÈGLE TRÈS IMPORTANTE — ENTRÉES BATCH :
Si l'utilisateur énonce plusieurs relevés dans une seule phrase, tu DOIS produire AUTANT d'actions distinctes. Exemples :
- "frigo 1 à 3, frigo 2 à 4.5, chambre froide à -18" → 3 actions record_temperature (une par zone)
- "j'ai fait le nettoyage des plans de travail et des frigos" → 2 actions record_cleaning
- "cuisson poulet rôti à 78°, cuisson saumon à 65°" → 2 actions record_cooking
Ne regroupe JAMAIS plusieurs relevés dans une seule action. Chaque température, chaque nettoyage, chaque cuisson = une action atomique.

RÈGLES GÉNÉRALES :
- Réponds en français, de manière concise et professionnelle
- Base tes réponses sur les données réelles du restaurant ci-dessus
- Pour les questions sur les coûts, utilise les prix et food cost réels
- Pour les conseils, sois pratique et actionnable
- Si tu ne connais pas une info spécifique, dis-le honnêtement
- Tu peux suggérer des optimisations basées sur les données
- Formate \`reply\` en texte brut, paragraphes courts, sans HTML ni Markdown (utilise \\n pour les listes)
- Respecte le rôle de l'utilisateur : ${user.role}. Utilise \`requires_confirmation: true\` pour toute action qui modifie les données (crée/met à jour/supprime)
- Quand une date/heure est implicite ("maintenant", "à l'instant"), ne renseigne pas le champ — le backend mettra l'horodatage courant

DOMAINES D'EXPERTISE :
- Fiches techniques et costing
- Gestion des stocks et approvisionnement
- HACCP et hygiène alimentaire (CCP1 stockage, CCP2 cuisson, CCP3 refroidissement)
- Analyse de marge et food cost
- Optimisation des pertes
- Gestion fournisseurs
- Réglementation restauration (allergènes INCO, traçabilité, arrêté 21/12/2009)
- Conseils culinaires et techniques`;

    // Build conversation (systemInstruction handles language + context; no synthetic first turn needed)
    const contents = [];

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
    const assistantModel = selectModel('assistant', user.restaurant_id);
    const response = await fetch(buildGeminiUrl(assistantModel), {
      signal: AbortSignal.timeout(30000),
      method: 'POST',
      headers: geminiHeaders(),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
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
                    type: { type: 'string', enum: [
                      'add_ingredient', 'modify_ingredient', 'remove_ingredient',
                      'create_recipe', 'modify_recipe', 'delete_recipe',
                      'add_supplier', 'create_order', 'modify_supplier_price',
                      'record_temperature', 'record_loss', 'record_waste',
                      'record_cooking', 'record_cooling', 'record_reheating',
                      'record_fryer_check', 'record_thermometer_calibration',
                      'record_cleaning',
                      'record_traceability_in', 'record_traceability_out', 'record_witness_meal',
                      'record_non_conformity', 'record_corrective_action',
                      'record_training', 'record_pest_control', 'record_equipment_maintenance',
                      'record_staff_health', 'record_recall', 'record_tiac',
                      'record_water_analysis', 'record_pms_audit',
                    ] },
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
      console.error(`[Alto/assistant] Gemini ${response.status} (model=${assistantModel}):`, err.slice(0, 500));
      return res.status(502).json({ error: 'Erreur service IA', status: response.status });
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

    if (!result.reply) {
      console.error('[Alto/assistant] Empty reply. Raw:', JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: 'Réponse IA vide' });
    }

    // Filter actions based on user role
    if (result.actions && result.actions.length > 0) {
      result.actions = filterActionsByRole(result.actions, user.role);
    }

    res.json(result);
  } catch (e) {
    console.error('[Alto/assistant] Exception:', e && e.name, e && e.message, e && e.stack);
    const hint = e && e.name === 'TimeoutError' ? 'Timeout IA (30s)' : 'Erreur assistant';
    res.status(500).json({ error: hint });
  }
});

module.exports = router;
