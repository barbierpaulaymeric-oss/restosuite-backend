// ═══════════════════════════════════════════
// Import de fiches techniques — Excel / CSV
//
// Trois étapes, comme le scan mercuriale : on téléverse un fichier, le serveur
// le parse et renvoie les fiches détectées (SANS rien écrire), le restaurateur
// vérifie et corrige tout dans un aperçu éditable, puis valide l'import final.
// L'aperçu est essentiel : c'est lui qui donne confiance avant d'enregistrer.
//
// Les photos / PDF / textes collés passent par Alto (#/ia) — ici on reste sur
// le chemin déterministe tableur, robuste et sans IA.
// ═══════════════════════════════════════════

let _recipeImportData = null; // { recipes: [...], format, warnings, summary }

async function renderRecipeImport() {
  const app = document.getElementById('app');
  _recipeImportData = null;

  app.innerHTML = `
    <div class="view-header">
      <a href="#/recipes" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-2);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Fiches techniques
      </a>
      <h1><i data-lucide="upload" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Importer des fiches</h1>
      <p class="text-secondary">Déjà des fiches techniques sur Excel ou dans un autre logiciel ? Importez-les en quelques clics — pas besoin de tout retaper.</p>
    </div>

    <div id="ri-upload-section">
      <div style="border:2px dashed var(--border-color);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;background:var(--bg-sunken);cursor:pointer" id="ri-drop-zone">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">📊</div>
        <h3 style="margin-bottom:var(--space-2)">Glissez votre fichier ici</h3>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-3)">
          Fichier Excel (.xlsx / .xls) ou CSV contenant vos recettes et ingrédients
        </p>
        <label class="btn btn-primary" style="cursor:pointer">
          <i data-lucide="file-up" style="width:16px;height:16px"></i> Choisir un fichier
          <input type="file" id="ri-file-input" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" style="display:none">
        </label>
        <p style="color:var(--text-tertiary);font-size:var(--text-xs);margin-top:var(--space-2)">Excel ou CSV — max 10 Mo</p>
      </div>

      <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:center;margin-top:var(--space-4);padding:var(--space-3);background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-md)">
        <i data-lucide="download" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0"></i>
        <div style="flex:1;min-width:200px">
          <strong style="font-size:var(--text-sm)">Pas encore de fichier au bon format ?</strong>
          <p style="margin:2px 0 0;font-size:var(--text-xs);color:var(--text-secondary)">Téléchargez notre modèle Excel pré-rempli, complétez-le, puis réimportez-le.</p>
        </div>
        <button class="btn btn-secondary" id="ri-template-btn" style="white-space:nowrap">
          <i data-lucide="file-spreadsheet" style="width:16px;height:16px"></i> Modèle Excel
        </button>
      </div>

      <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--color-accent-light);border-radius:var(--radius-md);font-size:var(--text-sm);color:var(--text-secondary)">
        <i data-lucide="lightbulb" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;color:var(--color-accent)"></i>
        Vous avez une <strong>photo</strong> ou un <strong>PDF</strong> de vos fiches, ou un texte à coller ?
        <a href="#/ia" style="color:var(--color-accent);font-weight:600;text-decoration:none">Passez par Alto</a> — il les lit et crée les fiches.
      </div>
    </div>

    <div id="ri-processing" class="hidden" style="text-align:center;padding:var(--space-8)">
      <div class="spinner" style="margin:0 auto var(--space-3)"></div>
      <h3>Analyse du fichier…</h3>
      <p class="text-secondary">On détecte vos recettes et leurs ingrédients</p>
    </div>

    <div id="ri-results" class="hidden"></div>
  `;
  if (window.lucide) lucide.createIcons();

  const fileInput = document.getElementById('ri-file-input');
  const dropZone = document.getElementById('ri-drop-zone');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleRecipeImportFile(e.target.files[0]);
  });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--color-accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    if (e.dataTransfer.files[0]) handleRecipeImportFile(e.dataTransfer.files[0]);
  });

  document.getElementById('ri-template-btn').addEventListener('click', downloadRecipeTemplate);
}

// Fetch the template as a blob (works with both cookie and legacy Bearer auth)
// and trigger a download.
async function downloadRecipeTemplate() {
  const btn = document.getElementById('ri-template-btn');
  const original = btn ? btn.innerHTML : '';
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Préparation…'; }
    const headers = {};
    const legacyToken = localStorage.getItem('restosuite_token');
    if (legacyToken) headers['Authorization'] = 'Bearer ' + legacyToken;
    const res = await fetch(API.recipeImportTemplateUrl(), { credentials: 'include', headers });
    if (!res.ok) throw new Error('Téléchargement impossible');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-fiches-techniques-restosuite.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = original; if (window.lucide) lucide.createIcons({ nodes: [btn] }); }
  }
}

async function handleRecipeImportFile(file) {
  document.getElementById('ri-upload-section').classList.add('hidden');
  document.getElementById('ri-processing').classList.remove('hidden');
  try {
    const data = await API.previewRecipeImport(file);
    _recipeImportData = data;
    document.getElementById('ri-processing').classList.add('hidden');
    if (!data.recipes || data.recipes.length === 0) {
      renderRecipeImportEmpty(data);
    } else {
      renderRecipeImportPreview(data);
    }
  } catch (e) {
    document.getElementById('ri-processing').classList.add('hidden');
    document.getElementById('ri-upload-section').classList.remove('hidden');
    showToast('Erreur : ' + e.message, 'error');
  }
}

function renderRecipeImportEmpty(data) {
  const el = document.getElementById('ri-results');
  el.classList.remove('hidden');
  const warnings = (data.warnings || []).map(w => `<li>${escapeHtml(w)}</li>`).join('');
  el.innerHTML = `
    <div style="text-align:center;padding:var(--space-6)">
      <div style="font-size:2.5rem;margin-bottom:var(--space-3)">🤔</div>
      <h2>Aucune fiche détectée</h2>
      <p style="color:var(--text-secondary);max-width:520px;margin:var(--space-2) auto var(--space-3)">
        On n'a pas réussi à lire de recette dans ce fichier. Vérifiez qu'il contient au moins une colonne
        <strong>Recette</strong> et/ou <strong>Ingrédient</strong>, ou partez du modèle.
      </p>
      ${warnings ? `<ul style="text-align:left;display:inline-block;color:var(--color-warning);font-size:var(--text-sm)">${warnings}</ul>` : ''}
      <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap;margin-top:var(--space-4)">
        <button class="btn btn-primary" onclick="renderRecipeImport()">Réessayer</button>
        <button class="btn btn-secondary" id="ri-template-btn2"><i data-lucide="file-spreadsheet" style="width:16px;height:16px"></i> Télécharger le modèle</button>
        <a href="#/ia" class="btn btn-secondary">Essayer avec Alto</a>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  const t = document.getElementById('ri-template-btn2');
  if (t) t.addEventListener('click', downloadRecipeTemplate);
}

const RECIPE_IMPORT_UNITS = ['g', 'kg', 'mg', 'ml', 'cl', 'l', 'pièce', 'botte', 'sachet', 'barquette', 'portions'];

function recipeImportUnitOptions(selected) {
  const sel = (selected || 'g').toLowerCase();
  const known = RECIPE_IMPORT_UNITS.map(u =>
    `<option value="${u}" ${u === sel ? 'selected' : ''}>${u}</option>`
  ).join('');
  // Preserve an unrecognized parsed unit so we never silently change it.
  const extra = RECIPE_IMPORT_UNITS.includes(sel) ? '' : `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`;
  return known + extra;
}

function renderRecipeImportPreview(data) {
  const el = document.getElementById('ri-results');
  el.classList.remove('hidden');

  const topWarnings = (data.warnings || []).map(w =>
    `<div style="padding:8px 12px;background:rgba(245,158,11,0.1);border-radius:var(--radius-md);font-size:var(--text-sm);color:#B45309;margin-bottom:8px"><i data-lucide="alert-triangle" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>${escapeHtml(w)}</div>`
  ).join('');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-accent)">${data.summary.recipe_count}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Fiches détectées</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-success)">${data.summary.ingredient_count}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Ingrédients</div>
      </div>
    </div>

    ${topWarnings}

    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-3)">
      <i data-lucide="pencil" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>
      Vérifiez et corrigez les fiches ci-dessous avant d'importer. Décochez celles que vous ne voulez pas créer.
    </p>

    <div id="ri-recipe-cards">
      ${data.recipes.map((r, i) => renderRecipeImportCard(r, i)).join('')}
    </div>

    <div style="position:sticky;bottom:0;background:var(--bg-base);padding:var(--space-3) 0;display:flex;gap:var(--space-3);justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--border-light);margin-top:var(--space-4)">
      <button class="btn btn-secondary" onclick="renderRecipeImport()">
        <i data-lucide="x" style="width:16px;height:16px"></i> Annuler
      </button>
      <button class="btn btn-primary" id="ri-import-btn" style="min-width:200px">
        <i data-lucide="check" style="width:16px;height:16px"></i> Importer les fiches sélectionnées
      </button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('ri-import-btn').addEventListener('click', commitRecipeImport);

  // Wire add/remove ingredient buttons (delegated).
  document.getElementById('ri-recipe-cards').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-ri-remove-ing]');
    if (removeBtn) {
      const row = removeBtn.closest('.ri-ing-row');
      if (row) row.remove();
      return;
    }
    const addBtn = e.target.closest('[data-ri-add-ing]');
    if (addBtn) {
      const ridx = addBtn.getAttribute('data-ri-add-ing');
      const tbody = document.querySelector(`#ri-ing-body-${ridx}`);
      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', renderRecipeImportIngRow(ridx, { name: '', gross_quantity: '', unit: 'g' }));
        if (window.lucide) lucide.createIcons({ nodes: [tbody.lastElementChild] });
      }
      return;
    }
    const toggle = e.target.closest('[data-ri-toggle]');
    if (toggle) {
      const ridx = toggle.getAttribute('data-ri-toggle');
      const card = document.querySelector(`#ri-card-${ridx}`);
      if (card) card.style.opacity = toggle.checked ? '1' : '0.45';
    }
  });
  document.getElementById('ri-recipe-cards').addEventListener('change', (e) => {
    const toggle = e.target.closest('[data-ri-toggle]');
    if (toggle) {
      const ridx = toggle.getAttribute('data-ri-toggle');
      const card = document.querySelector(`#ri-card-${ridx}`);
      if (card) card.style.opacity = toggle.checked ? '1' : '0.45';
    }
  });
}

function renderRecipeImportIngRow(ridx, ing) {
  const qty = ing.gross_quantity == null ? '' : ing.gross_quantity;
  const missing = qty === '' || qty == null;
  return `
    <tr class="ri-ing-row" data-recipe-idx="${ridx}">
      <td><input type="text" class="input input--sm" data-ri-field="ing-name" value="${escapeHtml(ing.name || '')}" placeholder="Ingrédient" style="width:100%"></td>
      <td><input type="number" step="any" min="0" class="input input--sm" data-ri-field="ing-qty" value="${qty}" placeholder="—" style="width:80px;${missing ? 'border-color:var(--color-warning)' : ''}"></td>
      <td>
        <select class="input input--sm" data-ri-field="ing-unit" data-ui="custom" style="width:90px">${recipeImportUnitOptions(ing.unit)}</select>
      </td>
      <td><input type="number" step="any" min="0" class="input input--sm" data-ri-field="ing-cost" value="${ing.price_per_unit == null ? '' : ing.price_per_unit}" placeholder="—" style="width:90px"></td>
      <td style="text-align:center"><button type="button" class="btn-icon" data-ri-remove-ing aria-label="Retirer l'ingrédient" style="color:var(--color-danger)"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button></td>
    </tr>
  `;
}

function renderRecipeImportCard(recipe, i) {
  const warnings = (recipe.warnings || []).map(w =>
    `<span style="display:inline-block;font-size:var(--text-xs);color:#B45309;background:rgba(245,158,11,0.12);padding:2px 8px;border-radius:999px;margin-right:6px">${escapeHtml(w)}</span>`
  ).join('');

  const typeOpt = (val, label) => `<option value="${val}" ${recipe.recipe_type === val ? 'selected' : ''}>${label}</option>`;

  return `
    <div class="card" id="ri-card-${i}" data-recipe-idx="${i}" style="margin-bottom:var(--space-3);padding:var(--space-3)">
      <div style="display:flex;gap:var(--space-2);align-items:center;margin-bottom:var(--space-3)">
        <input type="checkbox" data-ri-toggle="${i}" checked data-ui="custom" aria-label="Inclure cette fiche" style="flex-shrink:0">
        <input type="text" class="input" data-ri-field="name" value="${escapeHtml(recipe.name || '')}" placeholder="Nom de la recette" style="flex:1;font-weight:600;font-size:var(--text-base)">
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--space-2);margin-bottom:var(--space-3)">
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:var(--text-xs)">Type</label>
          <select class="input input--sm" data-ri-field="recipe_type" data-ui="custom">
            ${typeOpt('plat', '🍽️ Plat')}${typeOpt('sous_recette', '📋 Sous-recette')}${typeOpt('base', '🫕 Base')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:var(--text-xs)">Catégorie</label>
          <input type="text" class="input input--sm" data-ri-field="category" value="${escapeHtml(recipe.category || '')}" placeholder="—">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:var(--text-xs)">Portions</label>
          <input type="number" min="1" step="1" class="input input--sm" data-ri-field="portions" value="${recipe.portions || 1}">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" style="font-size:var(--text-xs)">Prix de vente (€)</label>
          <input type="number" min="0" step="any" class="input input--sm" data-ri-field="selling_price" value="${recipe.selling_price == null ? '' : recipe.selling_price}" placeholder="—">
        </div>
      </div>

      ${warnings ? `<div style="margin-bottom:var(--space-2)">${warnings}</div>` : ''}

      <div class="table-container" style="margin-bottom:var(--space-2)">
        <table style="font-size:var(--text-sm)">
          <thead>
            <tr>
              <th>Ingrédient</th>
              <th style="width:90px">Quantité</th>
              <th style="width:100px">Unité</th>
              <th style="width:100px">Coût unit. (€)</th>
              <th style="width:40px"></th>
            </tr>
          </thead>
          <tbody id="ri-ing-body-${i}">
            ${(recipe.ingredients || []).map(ing => renderRecipeImportIngRow(i, ing)).join('')}
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-secondary btn--sm" data-ri-add-ing="${i}">
        <i data-lucide="plus" style="width:14px;height:14px"></i> Ajouter un ingrédient
      </button>
    </div>
  `;
}

// Read the (edited) state back out of the DOM and build the import payload.
function collectRecipeImportPayload() {
  const recipes = [];
  document.querySelectorAll('#ri-recipe-cards .card[data-recipe-idx]').forEach(card => {
    const idx = card.getAttribute('data-recipe-idx');
    const toggle = document.querySelector(`[data-ri-toggle="${idx}"]`);
    if (toggle && !toggle.checked) return; // deselected

    const field = (name) => {
      const el = card.querySelector(`[data-ri-field="${name}"]`);
      return el ? el.value.trim() : '';
    };
    const name = field('name');
    if (!name) return;

    const ingredients = [];
    card.querySelectorAll('.ri-ing-row').forEach(row => {
      const ingName = (row.querySelector('[data-ri-field="ing-name"]') || {}).value || '';
      if (!ingName.trim()) return;
      const qty = (row.querySelector('[data-ri-field="ing-qty"]') || {}).value || '';
      const unit = (row.querySelector('[data-ri-field="ing-unit"]') || {}).value || 'g';
      const cost = (row.querySelector('[data-ri-field="ing-cost"]') || {}).value || '';
      const ing = { name: ingName.trim(), gross_quantity: qty === '' ? null : Number(qty), unit };
      if (cost !== '') { ing.price_per_unit = Number(cost); ing.price_unit = unit; }
      ingredients.push(ing);
    });

    recipes.push({
      name,
      category: field('category') || null,
      recipe_type: field('recipe_type') || 'plat',
      portions: field('portions') ? parseInt(field('portions'), 10) : 1,
      selling_price: field('selling_price') === '' ? null : Number(field('selling_price')),
      ingredients,
    });
  });
  return recipes;
}

async function commitRecipeImport() {
  const recipes = collectRecipeImportPayload();
  if (recipes.length === 0) {
    showToast('Sélectionnez au moins une fiche à importer', 'error');
    return;
  }

  const btn = document.getElementById('ri-import-btn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Import en cours…';

  try {
    const result = await API.importRecipes(recipes);
    const imported = result.imported || 0;
    const failed = result.failed || 0;
    showToast(`${imported} fiche${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}`, imported > 0 ? 'success' : 'error');

    const errorsHtml = (result.errors || []).length
      ? `<div style="text-align:left;max-width:480px;margin:var(--space-3) auto 0;font-size:var(--text-sm);color:var(--color-warning)">
           <strong>${failed} fiche(s) non importée(s) :</strong>
           <ul style="margin:6px 0 0;padding-left:18px">
             ${result.errors.map(er => `<li>${escapeHtml(er.name || 'Fiche')} — ${escapeHtml(er.reason || '')}</li>`).join('')}
           </ul>
         </div>`
      : '';

    document.getElementById('ri-results').innerHTML = `
      <div style="text-align:center;padding:var(--space-8)">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">✅</div>
        <h2>Import terminé</h2>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-2)">
          <strong>${imported}</strong> fiche${imported > 1 ? 's' : ''} technique${imported > 1 ? 's' : ''} créée${imported > 1 ? 's' : ''} avec succès.
        </p>
        ${errorsHtml}
        <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap;margin-top:var(--space-4)">
          <a href="#/recipes" class="btn btn-primary">Voir mes fiches</a>
          <button class="btn btn-secondary" onclick="renderRecipeImport()">Importer d'autres fiches</button>
        </div>
      </div>
    `;
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = original;
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
    showToast('Erreur import : ' + e.message, 'error');
  }
}
