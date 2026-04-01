// ═══════════════════════════════════════════
// Stock Dashboard — Vue d'ensemble #/stock
// ═══════════════════════════════════════════

async function renderStockDashboard() {
  const app = document.getElementById('app');
  const account = getAccount();
  const isGerant = account && account.role === 'gerant';

  app.innerHTML = `
    <div class="view-header">
      <h1>📦 Stock</h1>
      <p class="text-secondary">Vue d'ensemble du stock actuel</p>
    </div>
    <div class="stock-actions" style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap">
      <a href="#/stock/reception" class="btn btn-accent btn-lg" style="flex:1;min-width:180px;text-decoration:none;text-align:center">
        📥 Réception
      </a>
      ${isGerant ? `
      <button class="btn btn-secondary" id="stock-inventory-btn" style="flex:1;min-width:140px">
        📋 Inventaire
      </button>
      ` : ''}
      <a href="#/stock/movements" class="btn btn-secondary" style="min-width:120px;text-decoration:none;text-align:center">
        📊 Historique
      </a>
    </div>
    <div class="search-bar" style="margin-bottom:var(--space-5)">
      <input type="text" id="stock-search" placeholder="Rechercher un ingrédient..." class="input" style="width:100%">
    </div>
    <div id="stock-alerts-section"></div>
    <div id="stock-content">
      <div class="loading-spinner" style="text-align:center;padding:var(--space-8)">Chargement...</div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  let searchTimeout;
  const searchInput = document.getElementById('stock-search');
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadStock(searchInput.value), 300);
  });

  if (isGerant) {
    const invBtn = document.getElementById('stock-inventory-btn');
    if (invBtn) invBtn.addEventListener('click', () => showInventoryModal());
  }

  await loadStock();
}

async function loadStock(query) {
  try {
    const [stock, alerts] = await Promise.all([
      API.getStock(query),
      API.getStockAlerts()
    ]);

    // Alerts section
    const alertsSection = document.getElementById('stock-alerts-section');
    if (alerts.length > 0 && !query) {
      alertsSection.innerHTML = `
        <div class="stock-alert-banner" style="background:var(--color-danger-light);border:1px solid var(--color-danger);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
          <h3 style="color:var(--color-danger);margin-bottom:var(--space-2)">⚠️ ${alerts.length} alerte${alerts.length > 1 ? 's' : ''} stock bas</h3>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
            ${alerts.map(a => `
              <span class="badge badge--danger" style="font-size:var(--text-sm)">
                ${escapeHtml(a.ingredient_name)} : ${a.quantity} ${a.unit} (min: ${a.min_quantity})
              </span>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      alertsSection.innerHTML = '';
    }

    // Group by category
    const categories = {};
    for (const item of stock) {
      const cat = item.category || 'Autres';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    const categoryIcons = {
      'Viandes': '🥩', 'Poissons': '🐟', 'Légumes': '🥬', 'Fruits': '🍎',
      'Produits laitiers': '🧀', 'Épices': '🌶️', 'Féculents': '🌾',
      'Matières grasses': '🧈', 'Sucres': '🍯', 'Boissons': '🍷',
      'Autres': '📦'
    };

    const content = document.getElementById('stock-content');
    if (stock.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--space-10)">
          <div style="font-size:3rem;margin-bottom:var(--space-4)">📦</div>
          <p class="text-secondary">${query ? 'Aucun résultat' : 'Aucun stock enregistré'}</p>
          ${!query ? '<p class="text-secondary text-sm">Commencez par une réception de marchandise</p>' : ''}
        </div>
      `;
      return;
    }

    content.innerHTML = Object.entries(categories).map(([cat, items]) => `
      <div class="stock-category" style="margin-bottom:var(--space-6)">
        <h2 style="margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)">
          <span>${categoryIcons[cat] || '📦'}</span> ${escapeHtml(cat)}
          <span class="text-secondary text-sm" style="font-weight:400">(${items.length})</span>
        </h2>
        <div class="stock-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3)">
          ${items.map(item => renderStockCard(item)).join('')}
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (e) {
    document.getElementById('stock-content').innerHTML = `
      <div class="empty-state" style="text-align:center;padding:var(--space-8)">
        <p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}

function renderStockCard(item) {
  const isAlert = item.is_alert;
  const pct = item.min_quantity > 0 ? Math.min(100, (item.quantity / item.min_quantity) * 100) : 100;
  const barColor = pct <= 25 ? 'var(--color-danger)' : pct <= 50 ? 'var(--color-warning)' : 'var(--color-success)';

  return `
    <div class="card stock-card" style="padding:var(--space-4);border:1px solid ${isAlert ? 'var(--color-danger)' : 'var(--border-default)'};border-radius:var(--radius-lg);background:var(--bg-elevated);${isAlert ? 'box-shadow:0 0 12px rgba(217,48,37,0.15)' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-2)">
        <h3 style="font-size:var(--text-base);font-weight:600">${escapeHtml(item.ingredient_name)}</h3>
        ${isAlert ? '<span class="badge badge--danger" style="font-size:var(--text-xs)">Stock bas</span>' : ''}
      </div>
      <div style="display:flex;align-items:baseline;gap:var(--space-2);margin-bottom:var(--space-3)">
        <span class="data-value" style="font-size:var(--text-xl);font-weight:700;color:${isAlert ? 'var(--color-danger)' : 'var(--text-primary)'}">${item.quantity}</span>
        <span class="text-secondary">${escapeHtml(item.unit)}</span>
      </div>
      ${item.min_quantity > 0 ? `
      <div style="margin-bottom:var(--space-2)">
        <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">
          <span>Seuil min : ${item.min_quantity} ${item.unit}</span>
          <span>${Math.round(pct)}%</span>
        </div>
        <div style="height:4px;background:var(--bg-sunken);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100, pct)}%;background:${barColor};border-radius:2px;transition:width 0.3s"></div>
        </div>
      </div>
      ` : ''}
      <div style="font-size:var(--text-xs);color:var(--text-tertiary)">
        Màj : ${item.last_updated ? new Date(item.last_updated).toLocaleDateString('fr-FR') : '—'}
      </div>
    </div>
  `;
}

async function showInventoryModal() {
  const account = getAccount();
  let ingredients;
  try {
    ingredients = await API.getIngredients();
  } catch (e) {
    showToast('Erreur chargement ingrédients', 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:var(--z-modal-backdrop);display:flex;align-items:center;justify-content:center;padding:var(--space-4)';

  overlay.innerHTML = `
    <div class="modal" style="background:var(--bg-elevated);border-radius:var(--radius-xl);padding:var(--space-6);max-width:500px;width:100%;max-height:80vh;overflow-y:auto">
      <h2 style="margin-bottom:var(--space-4)">📋 Inventaire</h2>
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Ingrédient</label>
        <select id="inv-ingredient" class="input">
          <option value="">— Sélectionner —</option>
          ${ingredients.map(i => `<option value="${i.id}" data-unit="${escapeHtml(i.default_unit || 'kg')}">${escapeHtml(i.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Quantité réelle</label>
        <div style="display:flex;gap:var(--space-2)">
          <input type="number" id="inv-qty" class="input" step="0.01" min="0" placeholder="0" style="flex:1">
          <input type="text" id="inv-unit" class="input" value="kg" style="width:80px" readonly>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
        <button class="btn btn-secondary" id="inv-cancel">Annuler</button>
        <button class="btn btn-primary" id="inv-save">Enregistrer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const ingredientSelect = overlay.querySelector('#inv-ingredient');
  const unitInput = overlay.querySelector('#inv-unit');
  ingredientSelect.addEventListener('change', () => {
    const opt = ingredientSelect.options[ingredientSelect.selectedIndex];
    unitInput.value = opt.dataset.unit || 'kg';
  });

  overlay.querySelector('#inv-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#inv-save').addEventListener('click', async () => {
    const ingredientId = Number(ingredientSelect.value);
    const qty = parseFloat(overlay.querySelector('#inv-qty').value);
    const unit = unitInput.value;

    if (!ingredientId || isNaN(qty)) {
      showToast('Veuillez remplir tous les champs', 'error');
      return;
    }

    try {
      await API.postStockInventory({
        ingredient_id: ingredientId,
        new_quantity: qty,
        unit,
        recorded_by: account ? account.id : null
      });
      showToast('Inventaire enregistré', 'success');
      overlay.remove();
      await loadStock();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
}
