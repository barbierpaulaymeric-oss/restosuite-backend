// ═══════════════════════════════════════════
// Ingredients Management
// ═══════════════════════════════════════════

async function renderIngredients() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <h1>Ingrédients</h1>
      <button class="btn btn-primary role-gerant-only" onclick="showIngredientModal()"><i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter</button>
    </div>
    <div class="search-bar">
      <span class="search-icon"><i data-lucide="search"></i></span>
      <input type="text" id="ing-search" placeholder="Rechercher un ingrédient..." autocomplete="off">
    </div>
    <div id="ing-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  let ingredients = [];
  try { ingredients = await API.getIngredients(); } catch(e) { showToast('Erreur', 'error'); }

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
            <span class="stat-label">Allergènes</span>
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
        <div class="form-group">
          <label>Allergènes</label>
          <input type="text" class="form-control" id="m-ing-allergens" value="${escapeHtml(ingredient?.allergens || '')}" placeholder="gluten, lait...">
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
      allergens: document.getElementById('m-ing-allergens').value.trim() || null,
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
    overlay.querySelector('#m-ing-delete').onclick = async () => {
      if (!confirm('Supprimer cet ingrédient ?')) return;
      try {
        await API.deleteIngredient(ingredient.id);
        showToast('Ingrédient supprimé', 'success');
        overlay.remove();
        renderIngredients();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }
}

async function showIngredientDetail(id) {
  let ingredients;
  try { ingredients = await API.getIngredients(); } catch(e) { return; }
  const ing = ingredients.find(i => i.id === id);
  if (!ing) return;
  showIngredientModal(ing);
}
