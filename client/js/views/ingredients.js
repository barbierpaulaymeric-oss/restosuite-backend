// ═══════════════════════════════════════════
// Ingredients Management
// ═══════════════════════════════════════════

async function renderIngredients() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <h1>Ingrédients</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary role-gerant-only" onclick="showCSVImportModal()"><i data-lucide="upload" style="width:16px;height:16px"></i> Importer</button>
        <a href="/api/ingredients/export-csv" class="btn btn-secondary role-gerant-only" download="ingredients.csv"><i data-lucide="download" style="width:16px;height:16px"></i> Exporter</a>
        <button class="btn btn-primary role-gerant-only" onclick="showIngredientModal()"><i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter</button>
      </div>
    </div>
    <div class="search-bar">
      <span class="search-icon"><i data-lucide="search"></i></span>
      <input type="text" id="ing-search" placeholder="Rechercher un ingrédient..." autocomplete="off">
    </div>
    <div id="ing-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  let ingredients = [];
  try {
    const response = await API.getIngredients();
    ingredients = response.ingredients || [];
  } catch(e) { showToast('Erreur', 'error'); }

  const listEl = document.getElementById('ing-list');
  const searchInput = document.getElementById('ing-search');

  function renderList(filter = '') {
    const filtered = filter
      ? ingredients.filter(i => i.name.includes(filter.toLowerCase()) || (i.category || '').includes(filter.toLowerCase()))
      : ingredients;

    if (filtered.length === 0) {
      listEl.innerHTML = filter ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="package"></i></div>
          <p>Aucun résultat</p>
        </div>` : `
        <div class="empty-state">
          <div class="empty-icon">🥕</div>
          <h3>Aucun ingrédient</h3>
          <p>Ajoutez vos premiers ingrédients pour calculer vos coûts.</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    const isGerant = getRole() === 'gerant';
    listEl.innerHTML = filtered.map(ing => `
      <div class="card" ${isGerant ? `onclick="showIngredientDetail(${ing.id})"` : ''}>
        <div class="card-header">
          <span class="card-title" style="text-transform:capitalize">${escapeHtml(ing.name)}</span>
          ${ing.category ? `<span class="card-category">${escapeHtml(ing.category)}</span>` : ''}
        </div>
        <div class="card-stats">
          <div>
            <span class="stat-value">${ing.waste_percent}%</span>
            <span class="stat-label">Perte</span>
          </div>
          <div>
            <span class="stat-value">${ing.default_unit}</span>
            <span class="stat-label">Unité</span>
          </div>
          <div>
            <span class="stat-value">${ing.price_per_unit > 0 ? ing.price_per_unit.toFixed(2) + '€' : '—'}</span>
            <span class="stat-label">${ing.price_per_unit > 0 ? '/' + (ing.price_unit || 'kg') : 'Prix'}</span>
          </div>
          ${ing.allergens ? `<div>
            <span class="stat-value" style="font-size:var(--text-xs)">${escapeHtml(ing.allergens)}</span>
            <span class="stat-label">Allergènes INCO</span>
          </div>` : ''}
        </div>
      </div>
    `).join('');
  }

  renderList();
  searchInput.addEventListener('input', (e) => renderList(e.target.value));
}

function showIngredientModal(ingredient = null) {
  const isEdit = !!ingredient;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient'}</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-ing-name" value="${escapeHtml(ingredient?.name || '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Catégorie</label>
          <select class="form-control" id="m-ing-cat">
            <option value="">—</option>
            ${['viande','poisson','légume','féculent','produit laitier','épice','condiment','autre'].map(c =>
              `<option value="${c}" ${ingredient?.category === c ? 'selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Unité par défaut</label>
          <select class="form-control" id="m-ing-unit">
            ${['g','kg','cl','l','pièce','botte'].map(u =>
              `<option value="${u}" ${ingredient?.default_unit === u ? 'selected' : ''}>${u}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Perte (%)</label>
          <input type="number" class="form-control" id="m-ing-waste" value="${ingredient?.waste_percent || 0}" min="0" max="100" step="0.5">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Allergènes INCO</label>
          <div id="m-ing-allergens-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-top:4px">
            ${getAllergenCheckboxes(ingredient?.allergens || '')}
          </div>
          <input type="hidden" id="m-ing-allergens" value="${escapeHtml(ingredient?.allergens || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix unitaire (€)</label>
          <input type="number" class="form-control" id="m-ing-price" value="${ingredient?.price_per_unit || ''}" min="0" step="0.1" placeholder="ex: 4.50€/kg">
        </div>
        <div class="form-group">
          <label>Unité de prix</label>
          <select class="form-control" id="m-ing-price-unit">
            ${['kg','l','pièce','botte'].map(u =>
              `<option value="${u}" ${(ingredient?.price_unit || 'kg') === u ? 'selected' : ''}>${u}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-ing-save">
          <i data-lucide="${isEdit ? 'save' : 'plus'}" style="width:18px;height:18px"></i>
          ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
        <button class="btn btn-secondary" id="m-ing-cancel">Annuler</button>
        ${isEdit ? '<button class="btn btn-danger" id="m-ing-delete"><i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer</button>' : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  overlay.querySelector('#m-ing-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#m-ing-save').onclick = async () => {
    const data = {
      name: document.getElementById('m-ing-name').value.trim(),
      category: document.getElementById('m-ing-cat').value || null,
      default_unit: document.getElementById('m-ing-unit').value,
      waste_percent: parseFloat(document.getElementById('m-ing-waste').value) || 0,
      allergens: getSelectedAllergens() || null,
      price_per_unit: parseFloat(document.getElementById('m-ing-price').value) || 0,
      price_unit: document.getElementById('m-ing-price-unit').value || 'kg'
    };
    if (!data.name) { showToast('Nom requis', 'error'); return; }
    try {
      if (isEdit) {
        await API.updateIngredient(ingredient.id, data);
        showToast('Ingrédient mis à jour', 'success');
      } else {
        await API.createIngredient(data);
        showToast('Ingrédient créé', 'success');
      }
      overlay.remove();
      renderIngredients();
    } catch (e) { showToast(e.message, 'error'); }
  };

  if (isEdit) {
    overlay.querySelector('#m-ing-delete').onclick = () => {
      showConfirmModal('Supprimer cet ingrédient ?', 'Cette action est irréversible. Les fiches techniques utilisant cet ingrédient seront affectées.', async () => {
        try {
          await API.deleteIngredient(ingredient.id);
          showToast('Ingrédient supprimé', 'success');
          overlay.remove();
          renderIngredients();
        } catch (e) { showToast(e.message, 'error'); }
      });
    };
  }
}

function showCSVImportModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <h2>📥 Importer des ingrédients (CSV)</h2>
      <p class="text-muted" style="font-size:var(--text-sm);margin-bottom:12px">Format attendu : <code>nom;catégorie;unité;prix_unitaire;pourcentage_perte</code><br>Séparateur : <code>;</code> ou <code>,</code></p>
      <div class="form-group">
        <input type="file" id="csv-file-input" accept=".csv,.txt" class="form-control">
      </div>
      <div id="csv-preview" style="display:none">
        <h3 style="font-size:var(--text-sm);margin-bottom:8px">Aperçu (5 premières lignes)</h3>
        <div id="csv-preview-content"></div>
      </div>
      <div class="actions-row" style="margin-top:16px">
        <button class="btn btn-primary" id="csv-confirm-btn" disabled>Confirmer l'import</button>
        <button class="btn btn-secondary" id="csv-cancel-btn">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let parsedRows = [];

  overlay.querySelector('#csv-cancel-btn').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#csv-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      // Detect delimiter
      const delimiter = lines[0].includes(';') ? ';' : ',';
      // Skip header if it looks like one
      let startIdx = 0;
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('nom') || firstLine.includes('name')) startIdx = 1;

      parsedRows = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(s => s.trim());
        if (parts.length >= 1 && parts[0]) {
          parsedRows.push({
            name: parts[0],
            category: parts[1] || null,
            default_unit: parts[2] || 'g',
            price_per_unit: parseFloat(parts[3]) || 0,
            waste_percent: parseFloat(parts[4]) || 0
          });
        }
      }

      // Show preview
      const preview = overlay.querySelector('#csv-preview');
      const content = overlay.querySelector('#csv-preview-content');
      if (parsedRows.length === 0) {
        content.innerHTML = '<p class="text-muted">Aucune ligne valide détectée.</p>';
        preview.style.display = 'block';
        return;
      }

      const previewRows = parsedRows.slice(0, 5);
      content.innerHTML = `
        <table class="csv-preview-table">
          <thead><tr><th>Nom</th><th>Catégorie</th><th>Unité</th><th>Prix unitaire</th><th>Perte %</th></tr></thead>
          <tbody>${previewRows.map(r => `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td>${escapeHtml(r.category || '—')}</td>
              <td>${r.default_unit}</td>
              <td>${r.price_per_unit}</td>
              <td>${r.waste_percent}%</td>
            </tr>
          `).join('')}</tbody>
        </table>
        <p class="text-muted" style="font-size:var(--text-xs)">${parsedRows.length} ingrédient(s) détecté(s)</p>
      `;
      preview.style.display = 'block';
      overlay.querySelector('#csv-confirm-btn').disabled = false;
    };
    reader.readAsText(file);
  });

  overlay.querySelector('#csv-confirm-btn').addEventListener('click', async () => {
    if (parsedRows.length === 0) return;
    const btn = overlay.querySelector('#csv-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Import en cours…';

    let success = 0, errors = 0;
    for (const row of parsedRows) {
      try {
        await API.createIngredient({
          name: row.name,
          category: row.category,
          default_unit: row.default_unit,
          waste_percent: row.waste_percent,
          price_per_unit: row.price_per_unit
        });
        success++;
      } catch (e) { errors++; }
    }

    overlay.remove();
    showToast(`${success} ingrédient(s) importé(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`, errors > 0 ? 'info' : 'success');
    renderIngredients();
  });
}

async function showIngredientDetail(id) {
  let ingredients;
  try {
    const response = await API.getIngredients();
    ingredients = response.ingredients || [];
  } catch(e) { return; }
  const ing = ingredients.find(i => i.id === id);
  if (!ing) return;
  showIngredientModal(ing);
}

// ═══════════════════════════════════════════
// INCO Allergens (14 categories)
// ═══════════════════════════════════════════
const INCO_ALLERGENS = [
  { code: 'gluten',       name: 'Gluten',         icon: '\u{1F33E}' },
  { code: 'crustaces',    name: 'Crustaces',       icon: '\u{1F990}' },
  { code: 'oeufs',        name: 'Oeufs',           icon: '\u{1F95A}' },
  { code: 'poissons',     name: 'Poissons',        icon: '\u{1F41F}' },
  { code: 'arachides',    name: 'Arachides',       icon: '\u{1F95C}' },
  { code: 'soja',         name: 'Soja',            icon: '\u{1FAD8}' },
  { code: 'lait',         name: 'Lait',            icon: '\u{1F95B}' },
  { code: 'fruits_coque', name: 'Fruits a coque',  icon: '\u{1F330}' },
  { code: 'celeri',       name: 'Celeri',          icon: '\u{1F96C}' },
  { code: 'moutarde',     name: 'Moutarde',        icon: '\u{1F7E1}' },
  { code: 'sesame',       name: 'Sesame',          icon: '\u26AA' },
  { code: 'sulfites',     name: 'Sulfites',        icon: '\u{1F377}' },
  { code: 'lupin',        name: 'Lupin',           icon: '\u{1F33F}' },
  { code: 'mollusques',   name: 'Mollusques',      icon: '\u{1F9AA}' }
];

function getAllergenCheckboxes(currentValue) {
  const current = (currentValue || '').toLowerCase();
  return INCO_ALLERGENS.map(a => {
    const checked = current.includes(a.name.toLowerCase()) || current.includes(a.code) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:4px;font-size:var(--text-sm);cursor:pointer;padding:4px 6px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-color)">
      <input type="checkbox" class="allergen-cb" value="${a.code}" data-name="${a.name}" ${checked} style="margin:0">
      <span>${a.icon} ${a.name}</span>
    </label>`;
  }).join('');
}

function getSelectedAllergens() {
  const checked = document.querySelectorAll('.allergen-cb:checked');
  if (checked.length === 0) return null;
  return Array.from(checked).map(cb => cb.dataset.name).join(', ');
}
