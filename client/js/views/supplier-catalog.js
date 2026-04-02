// ═══════════════════════════════════════════
// Supplier Catalog — Dedicated supplier UI
// ═══════════════════════════════════════════

function bootSupplierApp(session) {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (nav) nav.style.display = 'none';

  // Set supplier mode on body
  document.body.classList.add('supplier-mode');

  // Render supplier shell
  app.innerHTML = `
    <div class="supplier-shell">
      <header class="supplier-header">
        <div class="supplier-header__left">
          <img src="assets/logo.png" alt="RestoSuite" style="height: 28px; width: auto; margin-right: 8px;">
          <div>
            <span class="supplier-header__title">Portail Fournisseur</span>
            <span class="supplier-header__name">${escapeHtml(session.supplier_name || session.name)}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="supplier-logout">
          <i data-lucide="log-out" style="width:16px;height:16px"></i> Déconnexion
        </button>
      </header>
      <nav class="supplier-nav">
        <button class="supplier-nav__tab active" data-tab="catalog">
          <i data-lucide="package" style="width:18px;height:18px"></i> Catalogue
        </button>
        <button class="supplier-nav__tab" data-tab="history">
          <i data-lucide="history" style="width:18px;height:18px"></i> Historique
        </button>
      </nav>
      <main class="supplier-main" id="supplier-content"></main>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  document.getElementById('supplier-logout').addEventListener('click', () => {
    clearSupplierSession();
    document.body.classList.remove('supplier-mode');
    location.reload();
  });

  // Tab navigation
  document.querySelectorAll('.supplier-nav__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.supplier-nav__tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'catalog') renderSupplierCatalogTab();
      else renderSupplierHistoryTab();
    });
  });

  renderSupplierCatalogTab();
}

async function renderSupplierCatalogTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Mon catalogue</h2>
      <button class="btn btn-primary" id="btn-add-product" style="background:#4A90D9;border-color:#4A90D9">
        <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter
      </button>
    </div>
    <div id="supplier-catalog-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('btn-add-product').addEventListener('click', showAddProductModal);

  try {
    const catalog = await API.getSupplierCatalog();
    const listEl = document.getElementById('supplier-catalog-list');

    if (catalog.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="package-open"></i></div>
          <p>Votre catalogue est vide</p>
          <p class="text-secondary text-sm">Ajoutez vos produits pour que le restaurant puisse voir vos tarifs</p>
          <button class="btn btn-primary" onclick="showAddProductModal()" style="background:#4A90D9;border-color:#4A90D9">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter un produit
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Group by category
    const categories = {};
    catalog.forEach(p => {
      const cat = p.category || 'Sans catégorie';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    });

    listEl.innerHTML = Object.entries(categories).map(([cat, products]) => `
      <div class="supplier-category">
        <h3 class="supplier-category__title">${escapeHtml(cat)}</h3>
        ${products.map(p => `
          <div class="supplier-product-card ${!p.available ? 'supplier-product-card--unavailable' : ''}" data-id="${p.id}">
            <div class="supplier-product-card__info">
              <span class="supplier-product-card__name">${escapeHtml(p.product_name)}</span>
              <span class="supplier-product-card__unit">${escapeHtml(p.unit)}${p.min_order > 0 ? ` · Min: ${p.min_order}` : ''}</span>
            </div>
            <div class="supplier-product-card__actions">
              <span class="supplier-product-card__price" data-id="${p.id}" data-price="${p.price}" title="Cliquer pour modifier">
                ${formatCurrency(p.price)}
              </span>
              <label class="supplier-toggle" title="${p.available ? 'Disponible' : 'Indisponible'}">
                <input type="checkbox" ${p.available ? 'checked' : ''} data-toggle-id="${p.id}">
                <span class="supplier-toggle__slider"></span>
              </label>
              <button class="btn-icon supplier-product-card__delete" data-delete-id="${p.id}" data-delete-name="${escapeHtml(p.product_name)}" title="Supprimer">
                <i data-lucide="trash-2" style="width:16px;height:16px"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();

    // Inline price editing
    listEl.querySelectorAll('.supplier-product-card__price').forEach(priceEl => {
      priceEl.addEventListener('click', () => {
        const id = priceEl.dataset.id;
        const currentPrice = parseFloat(priceEl.dataset.price);
        startInlinePriceEdit(priceEl, id, currentPrice);
      });
    });

    // Availability toggles
    listEl.querySelectorAll('[data-toggle-id]').forEach(toggle => {
      toggle.addEventListener('change', async () => {
        const id = toggle.dataset.toggleId;
        try {
          await API.toggleSupplierProductAvailability(id, toggle.checked);
          showToast(toggle.checked ? 'Produit disponible' : 'Produit indisponible', 'success');
          renderSupplierCatalogTab();
        } catch (e) {
          showToast(e.message, 'error');
          toggle.checked = !toggle.checked;
        }
      });
    });

    // Delete buttons
    listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteId;
        const name = btn.dataset.deleteName;
        if (!confirm(`Retirer "${name}" du catalogue ?`)) return;
        try {
          await API.deleteSupplierProduct(id);
          showToast('Produit retiré', 'success');
          renderSupplierCatalogTab();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    document.getElementById('supplier-catalog-list').innerHTML =
      `<p class="text-danger">Erreur: ${escapeHtml(e.message)}</p>`;
  }
}

function startInlinePriceEdit(priceEl, id, currentPrice) {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.01';
  input.min = '0';
  input.value = currentPrice.toFixed(2);
  input.className = 'supplier-price-input';
  input.style.cssText = 'width:80px;font-family:var(--font-mono);font-size:var(--text-base);text-align:right;padding:4px 8px;border-radius:var(--radius-sm);border:2px solid #4A90D9;background:var(--bg-base);color:var(--text-primary)';

  const originalHTML = priceEl.innerHTML;
  priceEl.innerHTML = '';
  priceEl.appendChild(input);
  input.focus();
  input.select();

  async function savePrice() {
    const newPrice = parseFloat(input.value);
    if (isNaN(newPrice) || newPrice < 0) {
      priceEl.innerHTML = originalHTML;
      return;
    }
    if (newPrice === currentPrice) {
      priceEl.innerHTML = originalHTML;
      return;
    }
    try {
      await API.updateSupplierProduct(id, { price: newPrice });
      showToast('Prix mis à jour', 'success');
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message, 'error');
      priceEl.innerHTML = originalHTML;
    }
  }

  input.addEventListener('blur', savePrice);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { priceEl.innerHTML = originalHTML; }
  });
}

function showAddProductModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Ajouter un produit</h2>
      <div class="form-group">
        <label>Nom du produit</label>
        <input type="text" class="form-control" id="m-prod-name" placeholder="ex: Tomates bio">
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <input type="text" class="form-control" id="m-prod-category" placeholder="ex: Légumes, Viandes, Crèmerie...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix (€)</label>
          <input type="number" class="form-control" id="m-prod-price" step="0.01" min="0" placeholder="0.00"
                 style="font-family:var(--font-mono)">
        </div>
        <div class="form-group">
          <label>Unité</label>
          <select class="form-control" id="m-prod-unit">
            <option value="kg">kg</option>
            <option value="L">L</option>
            <option value="pièce">pièce</option>
            <option value="botte">botte</option>
            <option value="barquette">barquette</option>
            <option value="carton">carton</option>
            <option value="sac">sac</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Commande minimum (optionnel)</label>
        <input type="number" class="form-control" id="m-prod-min" step="0.1" min="0" value="0">
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-prod-save" style="background:#4A90D9;border-color:#4A90D9">
          <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter
        </button>
        <button class="btn btn-secondary" id="m-prod-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  overlay.querySelector('#m-prod-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#m-prod-save').onclick = async () => {
    const product_name = document.getElementById('m-prod-name').value.trim();
    const category = document.getElementById('m-prod-category').value.trim();
    const price = parseFloat(document.getElementById('m-prod-price').value);
    const unit = document.getElementById('m-prod-unit').value;
    const min_order = parseFloat(document.getElementById('m-prod-min').value) || 0;

    if (!product_name) { showToast('Nom du produit requis', 'error'); return; }
    if (isNaN(price) || price < 0) { showToast('Prix invalide', 'error'); return; }

    try {
      await API.addSupplierProduct({ product_name, category: category || null, price, unit, min_order });
      showToast('Produit ajouté', 'success');
      overlay.remove();
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  document.getElementById('m-prod-name').focus();
}

async function renderSupplierHistoryTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <h2 style="margin:0 0 var(--space-4);font-size:var(--text-xl)">Historique des modifications</h2>
    <div id="supplier-history-list"><div class="loading"><div class="spinner"></div></div></div>
  `;

  try {
    const history = await API.getSupplierHistory();
    const listEl = document.getElementById('supplier-history-list');

    if (history.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="clock"></i></div>
          <p>Aucune modification pour le moment</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = history.map(h => `
      <div class="notification-item" style="margin-bottom:var(--space-2)">
        <div class="notification-icon">${getHistoryIcon(h.change_type)}</div>
        <div class="notification-content">
          <strong>${escapeHtml(h.product_name)}</strong>
          <br><span class="text-secondary text-sm">${getHistoryLabel(h)}</span>
        </div>
        <span class="text-tertiary text-sm">${formatDateShort(h.created_at)}</span>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('supplier-history-list').innerHTML =
      `<p class="text-danger">Erreur: ${escapeHtml(e.message)}</p>`;
  }
}

function getHistoryIcon(type) {
  switch (type) {
    case 'new': return '🆕';
    case 'update': return '💰';
    case 'removed': return '🗑️';
    case 'unavailable': return '⚠️';
    default: return '📝';
  }
}

function getHistoryLabel(h) {
  switch (h.change_type) {
    case 'new': return `Ajouté au catalogue — ${formatCurrency(h.new_price)}`;
    case 'update': return `Prix modifié: ${formatCurrency(h.old_price)} → ${formatCurrency(h.new_price)}`;
    case 'removed': return 'Retiré du catalogue';
    case 'unavailable': return 'Marqué indisponible';
    default: return 'Modification';
  }
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
