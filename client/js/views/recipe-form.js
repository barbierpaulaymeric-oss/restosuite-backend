// ═══════════════════════════════════════════
// Recipe Form — New / Edit (with sub-recipes)
// ═══════════════════════════════════════════

let formIngredients = [];
let formSubRecipes = [];
let formSteps = [];
let allIngredients = [];
let allRecipesForSub = [];

async function renderRecipeForm(editId) {
  // Check edit permission
  const perms = getPermissions();
  if (!perms.edit_recipes) {
    location.hash = '#/';
    return;
  }

  const app = document.getElementById('app');
  const isEdit = !!editId;
  let recipe = null;

  if (isEdit) {
    app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      recipe = await API.getRecipe(editId);
    } catch (e) {
      app.innerHTML = '<div class="empty-state"><p>Fiche introuvable</p></div>';
      return;
    }
  }

  // Load ingredients for autocomplete
  try { allIngredients = await API.getIngredients(); } catch(e) { allIngredients = []; }
  // Load sub-recipes
  try {
    const allRecipes = await API.getRecipes();
    allRecipesForSub = allRecipes.filter(r =>
      (r.recipe_type === 'sous_recette' || r.recipe_type === 'base') &&
      (!editId || r.id !== editId)
    );
  } catch(e) { allRecipesForSub = []; }

  // Separate regular ingredients and sub-recipe ingredients
  formIngredients = [];
  formSubRecipes = [];

  if (recipe) {
    for (const ing of recipe.ingredients) {
      if (ing.is_sub_recipe || ing.sub_recipe_id) {
        formSubRecipes.push({
          sub_recipe_id: ing.sub_recipe_id,
          name: ing.sub_recipe_name || ing.sub_recipe?.name || `Recette #${ing.sub_recipe_id}`,
          quantity: ing.gross_quantity,
          cost: ing.cost || 0
        });
      } else {
        formIngredients.push({
          name: ing.ingredient_name,
          ingredient_id: ing.ingredient_id,
          gross_quantity: ing.gross_quantity,
          net_quantity: ing.net_quantity,
          unit: ing.unit,
          waste_percent: ing.custom_waste_percent ?? ing.default_waste_percent ?? 0,
          notes: ing.notes || ''
        });
      }
    }
  }

  formSteps = recipe ? recipe.steps.map(s => s.instruction) : [];

  const recipeType = recipe?.recipe_type || 'plat';

  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour</a>
        <h1 style="margin-top:4px">${isEdit ? 'Modifier la fiche' : 'Nouvelle fiche technique'}</h1>
      </div>
    </div>

    ${!isEdit ? `
    <div class="mic-container">
      <button class="mic-btn" id="mic-btn" onclick="toggleMic()">
        <i data-lucide="mic"></i>
      </button>
      <div class="mic-status" id="mic-status">Appuyez pour dicter votre recette</div>
    </div>
    ` : ''}

    <div id="recipe-form-content">
      <div class="form-row">
        <div class="form-group">
          <label>Nom du plat</label>
          <input type="text" class="form-control" id="f-name" value="${escapeHtml(recipe?.name || '')}" placeholder="Tartare de bœuf...">
        </div>
        <div class="form-group">
          <label>Catégorie</label>
          <select class="form-control" id="f-category">
            <option value="">—</option>
            ${['entrée','plat','dessert','boisson','amuse-bouche','accompagnement','sauce','base'].map(c =>
              `<option value="${c}" ${recipe?.category === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Type de recette</label>
          <select class="form-control" id="f-recipe-type" onchange="onRecipeTypeChange()">
            <option value="plat" ${recipeType === 'plat' ? 'selected' : ''}>🍽️ Plat final</option>
            <option value="sous_recette" ${recipeType === 'sous_recette' ? 'selected' : ''}>📋 Sous-recette</option>
            <option value="base" ${recipeType === 'base' ? 'selected' : ''}>🫕 Base / Fond</option>
          </select>
        </div>
        <div class="form-group" id="f-price-group" style="${recipeType === 'plat' ? '' : 'display:none'}">
          <label>Prix de vente TTC (€)</label>
          <input type="number" class="form-control" id="f-price" value="${recipe?.selling_price || ''}" step="0.5" min="0" oninput="updateLiveMargin()">
        </div>
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label>Portions</label>
          <input type="number" class="form-control" id="f-portions" value="${recipe?.portions || 1}" min="1">
        </div>
        <div class="form-group">
          <label>Préparation (min)</label>
          <input type="number" class="form-control" id="f-prep" value="${recipe?.prep_time_min || ''}" min="0">
        </div>
        <div class="form-group">
          <label>Cuisson (min)</label>
          <input type="number" class="form-control" id="f-cooking" value="${recipe?.cooking_time_min || ''}" min="0">
        </div>
      </div>

      <div class="section-title">Ingrédients</div>
      <div id="ing-list"></div>
      <div style="display:flex;gap:8px;align-items:end;margin-top:8px;flex-wrap:wrap">
        <div class="autocomplete-wrapper" style="flex:1;min-width:150px">
          <input type="text" class="form-control" id="add-ing-name" placeholder="Nom de l'ingrédient" autocomplete="off">
          <div class="autocomplete-list hidden" id="ing-autocomplete"></div>
        </div>
        <input type="number" class="form-control" id="add-ing-qty" placeholder="Qté" style="width:80px" step="any">
        <select class="form-control" id="add-ing-unit" style="width:80px">
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="cl">cl</option>
          <option value="l">l</option>
          <option value="pièce">pièce</option>
          <option value="botte">botte</option>
        </select>
        <input type="number" class="form-control" id="add-ing-waste" placeholder="Perte%" style="width:80px" step="any" min="0" max="100">
        <input type="text" class="form-control" id="add-ing-notes" placeholder="Notes" style="width:120px">
        <button class="btn btn-primary btn-sm" onclick="addIngredientLine()"><i data-lucide="plus" style="width:16px;height:16px"></i></button>
      </div>

      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Sous-recettes</span>
      </div>
      <div id="sub-recipe-list"></div>
      <div style="display:flex;gap:8px;align-items:end;margin-top:8px;flex-wrap:wrap">
        <select class="form-control" id="add-sub-recipe" style="flex:1;min-width:180px">
          <option value="">— Choisir une sous-recette —</option>
          ${allRecipesForSub.map(r => `<option value="${r.id}">${r.recipe_type === 'base' ? '🫕' : '📋'} ${escapeHtml(r.name)}</option>`).join('')}
        </select>
        <input type="number" class="form-control" id="add-sub-qty" placeholder="Portions" style="width:100px" step="any" min="0.1" value="1">
        <button class="btn btn-primary btn-sm" onclick="addSubRecipeLine()"><i data-lucide="plus" style="width:16px;height:16px"></i></button>
      </div>
      ${allRecipesForSub.length === 0 ? '<p class="text-muted" style="font-size:var(--text-xs);margin-top:4px">Aucune sous-recette disponible. Créez d\'abord des fiches de type "Sous-recette" ou "Base".</p>' : ''}

      <div class="section-title">Procédure</div>
      <div id="steps-list"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="text" class="form-control" id="add-step" placeholder="Nouvelle étape..." style="flex:1">
        <button class="btn btn-primary btn-sm" onclick="addStepLine()"><i data-lucide="plus" style="width:16px;height:16px"></i></button>
      </div>

      <div class="section-title">Tarification</div>
      <div class="form-row">
        <div class="form-group" id="f-price-section">
          <label>Food Cost</label>
          <div id="live-margin" style="padding:12px 16px;font-family:var(--font-mono);font-size:var(--text-lg);font-weight:700;color:var(--text-secondary)">—</div>
        </div>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="f-notes" rows="2">${escapeHtml(recipe?.notes || '')}</textarea>
      </div>

      <div class="actions-row">
        <button class="btn btn-primary" onclick="saveRecipe(${editId || 'null'})">
          <i data-lucide="${isEdit ? 'save' : 'check'}" style="width:18px;height:18px"></i>
          ${isEdit ? 'Enregistrer' : 'Créer la fiche'}
        </button>
        <a href="#/" class="btn btn-secondary">Annuler</a>
      </div>
    </div>
  `;

  lucide.createIcons();
  renderIngredientLines();
  renderSubRecipeLines();
  renderStepLines();
  updateLiveMargin();
  setupIngredientAutocomplete();

  // Enter key for add step
  document.getElementById('add-step').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addStepLine(); }
  });
}

function onRecipeTypeChange() {
  const type = document.getElementById('f-recipe-type').value;
  const priceGroup = document.getElementById('f-price-group');
  if (priceGroup) {
    priceGroup.style.display = type === 'plat' ? '' : 'none';
  }
}

function renderIngredientLines() {
  const el = document.getElementById('ing-list');
  if (!el) return;
  if (formIngredients.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);padding:8px 0">Aucun ingrédient ajouté</p>';
    return;
  }
  el.innerHTML = formIngredients.map((ing, i) => {
    const net = ing.waste_percent > 0 ? (ing.gross_quantity * (1 - ing.waste_percent / 100)).toFixed(1) : ing.gross_quantity;
    return `
      <div class="ing-line">
        <span class="ing-name">${escapeHtml(ing.name)} ${ing.notes ? `<span class="ing-notes">(${escapeHtml(ing.notes)})</span>` : ''}</span>
        <span class="ing-qty">${ing.gross_quantity}${ing.unit}</span>
        <span class="ing-qty text-muted">→ ${net}${ing.unit}</span>
        <span class="text-muted" style="font-size:var(--text-sm);font-family:var(--font-mono)">${ing.waste_percent}%</span>
        <span class="ing-remove" onclick="removeIngredient(${i})"><i data-lucide="x" style="width:16px;height:16px"></i></span>
      </div>
    `;
  }).join('');
  lucide.createIcons();
  updateLiveMargin();
}

function renderSubRecipeLines() {
  const el = document.getElementById('sub-recipe-list');
  if (!el) return;
  if (formSubRecipes.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);padding:8px 0">Aucune sous-recette ajoutée</p>';
    return;
  }
  el.innerHTML = formSubRecipes.map((sr, i) => `
    <div class="ing-line">
      <span class="ing-name">📋 ${escapeHtml(sr.name)}</span>
      <span class="ing-qty">${sr.quantity} portion${sr.quantity !== 1 ? 's' : ''}</span>
      <span class="ing-qty text-muted">${sr.cost > 0 ? formatCurrency(sr.cost) : ''}</span>
      <span class="ing-remove" onclick="removeSubRecipe(${i})"><i data-lucide="x" style="width:16px;height:16px"></i></span>
    </div>
  `).join('');
  lucide.createIcons();
}

function addSubRecipeLine() {
  const select = document.getElementById('add-sub-recipe');
  const qtyInput = document.getElementById('add-sub-qty');
  const recipeId = parseInt(select.value);
  const qty = parseFloat(qtyInput.value) || 1;

  if (!recipeId) { showToast('Sélectionnez une sous-recette', 'error'); return; }

  // Check if already added
  if (formSubRecipes.some(sr => sr.sub_recipe_id === recipeId)) {
    showToast('Cette sous-recette est déjà ajoutée', 'error');
    return;
  }

  const recipe = allRecipesForSub.find(r => r.id === recipeId);
  formSubRecipes.push({
    sub_recipe_id: recipeId,
    name: recipe ? recipe.name : `#${recipeId}`,
    quantity: qty,
    cost: recipe ? (recipe.cost_per_portion || 0) * qty : 0
  });

  select.value = '';
  qtyInput.value = '1';
  renderSubRecipeLines();
}

function removeSubRecipe(i) {
  formSubRecipes.splice(i, 1);
  renderSubRecipeLines();
}

function renderStepLines() {
  const el = document.getElementById('steps-list');
  if (!el) return;
  if (formSteps.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm);padding:8px 0">Aucune étape ajoutée</p>';
    return;
  }
  el.innerHTML = `<ol class="steps-list">${formSteps.map((s, i) =>
    `<li><span style="flex:1">${escapeHtml(s)}</span><span class="ing-remove" onclick="removeStep(${i})"><i data-lucide="x" style="width:14px;height:14px"></i></span></li>`
  ).join('')}</ol>`;
  lucide.createIcons();
}

function addIngredientLine() {
  const name = document.getElementById('add-ing-name').value.trim();
  const qty = parseFloat(document.getElementById('add-ing-qty').value);
  const unit = document.getElementById('add-ing-unit').value;
  const waste = parseFloat(document.getElementById('add-ing-waste').value) || 0;
  const notes = document.getElementById('add-ing-notes').value.trim();

  if (!name || !qty) { showToast('Nom et quantité requis', 'error'); return; }

  const existing = allIngredients.find(i => i.name === name.toLowerCase());
  formIngredients.push({
    name: name.toLowerCase(),
    ingredient_id: existing?.id || null,
    gross_quantity: qty,
    net_quantity: qty * (1 - waste / 100),
    unit,
    waste_percent: waste || existing?.waste_percent || 0,
    notes
  });

  // Reset fields
  document.getElementById('add-ing-name').value = '';
  document.getElementById('add-ing-qty').value = '';
  document.getElementById('add-ing-waste').value = '';
  document.getElementById('add-ing-notes').value = '';
  document.getElementById('add-ing-name').focus();

  renderIngredientLines();
}

function removeIngredient(i) {
  formIngredients.splice(i, 1);
  renderIngredientLines();
}

function addStepLine() {
  const input = document.getElementById('add-step');
  const text = input.value.trim();
  if (!text) return;
  formSteps.push(text);
  input.value = '';
  input.focus();
  renderStepLines();
}

function removeStep(i) {
  formSteps.splice(i, 1);
  renderStepLines();
}

function updateLiveMargin() {
  const el = document.getElementById('live-margin');
  const priceInput = document.getElementById('f-price');
  if (!el || !priceInput) return;

  const price = parseFloat(priceInput.value) || 0;
  if (price <= 0) {
    el.innerHTML = '—';
    el.style.color = 'var(--text-secondary)';
    return;
  }
  el.innerHTML = `<span class="text-accent">Prix : ${formatCurrency(price)}</span>`;
}

function setupIngredientAutocomplete() {
  const input = document.getElementById('add-ing-name');
  const list = document.getElementById('ing-autocomplete');
  if (!input || !list) return;

  let highlighted = -1;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) { list.classList.add('hidden'); return; }

    const matches = allIngredients.filter(i => i.name.includes(q)).slice(0, 8);
    if (matches.length === 0) { list.classList.add('hidden'); return; }

    highlighted = -1;
    list.innerHTML = matches.map((m, i) =>
      `<div class="autocomplete-item" data-index="${i}" data-name="${escapeHtml(m.name)}" data-waste="${m.waste_percent}" data-unit="${m.default_unit}">${escapeHtml(m.name)}</div>`
    ).join('');
    list.classList.remove('hidden');

    list.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.name;
        document.getElementById('add-ing-waste').value = item.dataset.waste || '';
        document.getElementById('add-ing-unit').value = item.dataset.unit || 'g';
        list.classList.add('hidden');
        document.getElementById('add-ing-qty').focus();
      });
    });
  });

  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('.autocomplete-item');
    if (list.classList.contains('hidden') || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlighted = Math.min(highlighted + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlighted = Math.max(highlighted - 1, 0); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); items[highlighted].click(); return; }
    else return;
    items.forEach((it, i) => it.classList.toggle('highlighted', i === highlighted));
  });

  input.addEventListener('blur', () => {
    setTimeout(() => list.classList.add('hidden'), 200);
  });
}

// ─── Voice input ───
let recognition = null;
let isRecording = false;

function toggleMic() {
  if (isRecording) {
    stopMic();
  } else {
    startMic();
  }
}

function startMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Reconnaissance vocale non supportée', 'error');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  const btn = document.getElementById('mic-btn');
  const status = document.getElementById('mic-status');

  recognition.onstart = () => {
    isRecording = true;
    btn.classList.add('recording');
    status.textContent = 'Écoute en cours… Parlez naturellement';
    status.className = 'mic-status recording';
  };

  recognition.onresult = async (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + ' ';
    }
    transcript = transcript.trim();
    stopMic();

    status.textContent = 'Analyse en cours…';
    status.className = 'mic-status processing';

    try {
      const parsed = await API.parseVoice(transcript);
      status.textContent = 'Fiche analysée ! Vérifiez et ajustez ci-dessous.';
      status.className = 'mic-status success';
      populateFromAI(parsed);
    } catch (e) {
      status.textContent = 'Erreur : ' + e.message;
      status.className = 'mic-status';
      showToast('Erreur IA : ' + e.message, 'error');
    }
  };

  recognition.onerror = (event) => {
    stopMic();
    const status = document.getElementById('mic-status');
    if (event.error === 'no-speech') {
      status.textContent = 'Aucune parole détectée. Réessayez.';
    } else {
      status.textContent = 'Erreur : ' + event.error;
    }
    status.className = 'mic-status';
  };

  recognition.onend = () => {
    if (isRecording) {
      isRecording = false;
      btn.classList.remove('recording');
    }
  };

  recognition.start();
}

function stopMic() {
  if (recognition) {
    isRecording = false;
    recognition.stop();
    const btn = document.getElementById('mic-btn');
    if (btn) btn.classList.remove('recording');
  }
}

function populateFromAI(parsed) {
  if (parsed.name) document.getElementById('f-name').value = parsed.name;
  if (parsed.category) document.getElementById('f-category').value = parsed.category;
  if (parsed.portions) document.getElementById('f-portions').value = parsed.portions;
  if (parsed.prep_time_min) document.getElementById('f-prep').value = parsed.prep_time_min;
  if (parsed.cooking_time_min) document.getElementById('f-cooking').value = parsed.cooking_time_min;

  if (parsed.ingredients && parsed.ingredients.length > 0) {
    formIngredients = parsed.ingredients.map(ing => ({
      name: (ing.name || '').toLowerCase(),
      ingredient_id: null,
      gross_quantity: ing.gross_quantity || 0,
      net_quantity: ing.net_quantity || null,
      unit: ing.unit || 'g',
      waste_percent: ing.waste_percent || 0,
      notes: ing.notes || ''
    }));
    renderIngredientLines();
  }

  if (parsed.steps && parsed.steps.length > 0) {
    formSteps = parsed.steps;
    renderStepLines();
  }
}

async function saveRecipe(editId) {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('Nom du plat requis', 'error'); return; }

  const recipeType = document.getElementById('f-recipe-type').value;

  // Build combined ingredients array (regular + sub-recipes)
  const allIngs = formIngredients.map(ing => ({
    name: ing.name,
    ingredient_id: ing.ingredient_id,
    gross_quantity: ing.gross_quantity,
    net_quantity: ing.net_quantity,
    unit: ing.unit,
    waste_percent: ing.waste_percent,
    custom_waste_percent: ing.waste_percent,
    notes: ing.notes
  }));

  // Add sub-recipes
  for (const sr of formSubRecipes) {
    allIngs.push({
      sub_recipe_id: sr.sub_recipe_id,
      gross_quantity: sr.quantity,
      unit: 'portion'
    });
  }

  const data = {
    name,
    category: document.getElementById('f-category').value || null,
    portions: parseInt(document.getElementById('f-portions').value) || 1,
    prep_time_min: parseInt(document.getElementById('f-prep').value) || null,
    cooking_time_min: parseInt(document.getElementById('f-cooking').value) || null,
    selling_price: recipeType === 'plat' ? (parseFloat(document.getElementById('f-price').value) || null) : null,
    notes: document.getElementById('f-notes').value.trim() || null,
    recipe_type: recipeType,
    ingredients: allIngs,
    steps: formSteps
  };

  try {
    let result;
    if (editId) {
      result = await API.updateRecipe(editId, data);
      showToast('Fiche mise à jour', 'success');
    } else {
      result = await API.createRecipe(data);
      showToast('Fiche créée !', 'success');
    }
    location.hash = `#/recipe/${result.id}`;
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}
