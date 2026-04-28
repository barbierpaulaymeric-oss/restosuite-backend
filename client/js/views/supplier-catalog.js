// ═══════════════════════════════════════════
// Supplier Catalog — Dedicated supplier UI
// ═══════════════════════════════════════════

function bootSupplierApp(session) {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (nav) nav.style.display = 'none';

  // Set supplier mode on body
  document.body.classList.add('supplier-mode');

  // Render supplier shell — six tabs, dashboard is the default landing.
  // The Commandes tab carries an unread badge populated below.
  app.innerHTML = `
    <div class="supplier-shell">
      <header class="supplier-header">
        <div class="supplier-header__left">
          <img src="assets/logo-icon.svg" alt="RestoSuite" style="height: 28px; width: auto; margin-right: 8px; cursor: pointer" id="supplier-logo-home">
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
        <button class="supplier-nav__tab active" data-tab="dashboard">
          <i data-lucide="layout-dashboard" style="width:18px;height:18px"></i> Tableau de bord
        </button>
        <button class="supplier-nav__tab" data-tab="catalog">
          <i data-lucide="package" style="width:18px;height:18px"></i> Catalogue
        </button>
        <button class="supplier-nav__tab" data-tab="clients">
          <i data-lucide="users" style="width:18px;height:18px"></i> Mes clients
        </button>
        <button class="supplier-nav__tab" data-tab="orders">
          <i data-lucide="clipboard-list" style="width:18px;height:18px"></i> Commandes
          <span class="supplier-nav__badge" id="supplier-orders-badge" hidden>0</span>
        </button>
        <button class="supplier-nav__tab" data-tab="deliveries">
          <i data-lucide="truck" style="width:18px;height:18px"></i> Livraisons
        </button>
        <button class="supplier-nav__tab" data-tab="history">
          <i data-lucide="history" style="width:18px;height:18px"></i> Historique
        </button>
        <button class="supplier-nav__tab" data-tab="messages">
          <i data-lucide="message-square" style="width:18px;height:18px"></i> Messages
        </button>
        <button class="supplier-nav__tab" data-tab="notifications">
          <i data-lucide="bell" style="width:18px;height:18px"></i> Notifications
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

  document.getElementById('supplier-logo-home').addEventListener('click', () => {
    document.querySelectorAll('.supplier-nav__tab').forEach(t => t.classList.remove('active'));
    const dashTab = document.querySelector('.supplier-nav__tab[data-tab="dashboard"]');
    if (dashTab) dashTab.classList.add('active');
    renderSupplierDashboardTab();
  });

  // Tab navigation
  document.querySelectorAll('.supplier-nav__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.supplier-nav__tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const t = tab.dataset.tab;
      if (t === 'dashboard') renderSupplierDashboardTab();
      else if (t === 'catalog') renderSupplierCatalogTab();
      else if (t === 'clients') renderSupplierClientsTab();
      else if (t === 'orders') {
        renderSupplierOrdersTab();
        // The badge is "pending orders awaiting confirmation", not "unread
        // notifications" — clicking the tab doesn't change that state. The
        // badge will tick down as the supplier confirms/refuses orders.
      }
      else if (t === 'deliveries') renderSupplierDeliveriesTab();
      else if (t === 'history') renderSupplierHistoryTab();
      else if (t === 'messages') {
        if (typeof renderSupplierMessagesTab === 'function') renderSupplierMessagesTab();
      }
      else if (t === 'notifications') {
        if (typeof renderSupplierNotificationsTab === 'function') {
          renderSupplierNotificationsTab();
        }
      }
    });
  });

  // Initial: load dashboard + populate the two badges in parallel.
  renderSupplierDashboardTab();
  refreshSupplierOrdersBadge();
  if (typeof refreshSupplierMessagesNavBadge === 'function') refreshSupplierMessagesNavBadge();
  // Cheap auto-refresh every 60s while the portal is open. setInterval is
  // intentionally not cleaned up — bootSupplierApp is only called once per
  // session and a logout reloads the page, dropping the timer.
  setInterval(refreshSupplierOrdersBadge, 60_000);
  setInterval(() => {
    if (typeof refreshSupplierMessagesNavBadge === 'function') refreshSupplierMessagesNavBadge();
  }, 60_000);
}

function refreshSupplierOrdersBadge() {
  // Commandes-tab badge = orders awaiting confirmation (status 'brouillon' or
  // 'envoyée'). Reading from supplier_notifications.unread used to overcount
  // when the seed pre-populated read notifications and undercount when the
  // supplier muted notifications without acting on the order — the
  // pending-count endpoint always reflects the actual workload.
  if (typeof API.getSupplierOrdersPendingCount !== 'function') return;
  API.getSupplierOrdersPendingCount()
    .then(({ count }) => {
      const badge = document.getElementById('supplier-orders-badge');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = String(count);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    })
    .catch(() => { /* offline / 401 — silent */ });
}

// Catalog client-side state. We pull the full list once per render and do all
// search/sort/filter operations in memory — supplier catalogs are small (≤200
// rows for our biggest demo).
let _supplierCatalogState = {
  catalog: [],
  search: '',
  category: 'all',
  sortKey: 'category',
  sortDir: 'asc',
};

function _ttcFromCatalogRow(p) {
  const tva = p.tva_rate != null ? Number(p.tva_rate) : 5.5;
  return Number(p.price) * (1 + tva / 100);
}

function _formatLastUpdate(catalog) {
  if (!catalog.length) return '';
  let max = null;
  for (const p of catalog) {
    if (!p.updated_at) continue;
    if (!max || p.updated_at > max) max = p.updated_at;
  }
  if (!max) return '';
  const d = new Date(max);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function renderSupplierCatalogTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)">
      <h2 style="margin:0;font-size:var(--text-xl)">Mon catalogue</h2>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        <button class="btn btn-secondary" id="btn-export-csv" title="Exporter le catalogue au format CSV">
          <i data-lucide="download" style="width:18px;height:18px"></i> Exporter CSV
        </button>
        <button class="btn btn-secondary" id="btn-import-mercuriale">
          <i data-lucide="file-up" style="width:18px;height:18px"></i> Importer ma mercuriale
        </button>
        <button class="btn btn-primary" id="btn-add-product" style="background:#4A90D9;border-color:#4A90D9">
          <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter
        </button>
      </div>
    </div>
    <div id="supplier-catalog-toolbar"></div>
    <div id="supplier-catalog-chips"></div>
    <div id="supplier-catalog-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('btn-add-product').addEventListener('click', showAddProductModal);
  document.getElementById('btn-import-mercuriale').addEventListener('click', () => {
    if (typeof showSupplierMercurialeImport === 'function') {
      showSupplierMercurialeImport();
    }
  });
  document.getElementById('btn-export-csv').addEventListener('click', _exportSupplierCatalogCsv);

  try {
    const catalog = await API.getSupplierCatalog();
    _supplierCatalogState.catalog = catalog;
    _supplierCatalogState.search = '';
    _supplierCatalogState.category = 'all';
    _renderSupplierCatalogToolbar();
    _renderSupplierCatalogChips();
    _renderSupplierCatalogList();
  } catch (e) {
    document.getElementById('supplier-catalog-list').innerHTML =
      `<p class="text-danger">Erreur: ${escapeHtml(e.message)}</p>`;
  }
}

function _renderSupplierCatalogToolbar() {
  const host = document.getElementById('supplier-catalog-toolbar');
  if (!host) return;
  const lastUpdate = _formatLastUpdate(_supplierCatalogState.catalog);
  host.innerHTML = `
    <div class="supplier-catalog-toolbar">
      <div style="position:relative;flex:1;min-width:200px">
        <input type="search" id="supplier-catalog-search" class="form-control"
               placeholder="Rechercher un produit, SKU…"
               value="${escapeHtml(_supplierCatalogState.search)}"
               style="padding-left:34px">
        <i data-lucide="search" style="width:16px;height:16px;position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)" aria-hidden="true"></i>
      </div>
      <label class="supplier-catalog-sort">
        <span class="text-secondary text-sm">Trier&nbsp;:</span>
        <select class="form-control" id="supplier-catalog-sort">
          <option value="category-asc"  ${_supplierCatalogState.sortKey === 'category' && _supplierCatalogState.sortDir === 'asc'  ? 'selected' : ''}>Catégorie A→Z</option>
          <option value="name-asc"      ${_supplierCatalogState.sortKey === 'name'     && _supplierCatalogState.sortDir === 'asc'  ? 'selected' : ''}>Nom A→Z</option>
          <option value="name-desc"     ${_supplierCatalogState.sortKey === 'name'     && _supplierCatalogState.sortDir === 'desc' ? 'selected' : ''}>Nom Z→A</option>
          <option value="price-asc"     ${_supplierCatalogState.sortKey === 'price'    && _supplierCatalogState.sortDir === 'asc'  ? 'selected' : ''}>Prix croissant</option>
          <option value="price-desc"    ${_supplierCatalogState.sortKey === 'price'    && _supplierCatalogState.sortDir === 'desc' ? 'selected' : ''}>Prix décroissant</option>
          <option value="updated-desc"  ${_supplierCatalogState.sortKey === 'updated'  && _supplierCatalogState.sortDir === 'desc' ? 'selected' : ''}>Récemment modifiés</option>
        </select>
      </label>
      ${lastUpdate ? `<span class="text-tertiary text-sm" style="white-space:nowrap">Dernière MàJ : ${lastUpdate}</span>` : ''}
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  const search = document.getElementById('supplier-catalog-search');
  if (search) {
    search.addEventListener('input', () => {
      _supplierCatalogState.search = search.value;
      _renderSupplierCatalogList();
    });
  }
  const sort = document.getElementById('supplier-catalog-sort');
  if (sort) {
    sort.addEventListener('change', () => {
      const [k, d] = sort.value.split('-');
      _supplierCatalogState.sortKey = k;
      _supplierCatalogState.sortDir = d;
      _renderSupplierCatalogList();
    });
  }
}

function _renderSupplierCatalogChips() {
  const host = document.getElementById('supplier-catalog-chips');
  if (!host) return;
  const counts = new Map();
  for (const p of _supplierCatalogState.catalog) {
    const key = p.category || 'Sans catégorie';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = _supplierCatalogState.catalog.length;
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const chipHtml = (label, key, count, active) => `
    <button type="button" class="supplier-cat-chip ${active ? 'supplier-cat-chip--active' : ''}" data-cat="${escapeHtml(key)}">
      ${escapeHtml(label)} <span class="supplier-cat-chip__count">${count}</span>
    </button>`;
  host.innerHTML = `
    <div class="supplier-cat-chips">
      ${chipHtml('Tout', 'all', total, _supplierCatalogState.category === 'all')}
      ${sorted.map(([cat, n]) => chipHtml(cat, cat, n, _supplierCatalogState.category === cat)).join('')}
    </div>
  `;
  host.querySelectorAll('.supplier-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _supplierCatalogState.category = btn.dataset.cat;
      _renderSupplierCatalogChips();
      _renderSupplierCatalogList();
    });
  });
}

function _filterAndSortCatalog() {
  const { catalog, search, category, sortKey, sortDir } = _supplierCatalogState;
  const q = search.trim().toLowerCase();
  let rows = catalog.filter(p => {
    if (category !== 'all' && (p.category || 'Sans catégorie') !== category) return false;
    if (!q) return true;
    return (p.product_name || '').toLowerCase().includes(q)
        || (p.sku || '').toLowerCase().includes(q)
        || (p.category || '').toLowerCase().includes(q);
  });
  const cmp = (a, b, key) => {
    if (key === 'price') return (a.price || 0) - (b.price || 0);
    if (key === 'updated') return String(a.updated_at || '').localeCompare(String(b.updated_at || ''));
    if (key === 'name') return (a.product_name || '').localeCompare(b.product_name || '', 'fr');
    // category: primary by category, secondary by name (so a category sort
    // still feels useful within the bucket).
    const c = (a.category || '').localeCompare(b.category || '', 'fr');
    return c !== 0 ? c : (a.product_name || '').localeCompare(b.product_name || '', 'fr');
  };
  rows.sort((a, b) => cmp(a, b, sortKey) * (sortDir === 'desc' ? -1 : 1));
  return rows;
}

function _renderSupplierCatalogList() {
  const listEl = document.getElementById('supplier-catalog-list');
  if (!listEl) return;
  const total = _supplierCatalogState.catalog.length;

  if (total === 0) {
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

  const rows = _filterAndSortCatalog();
  if (rows.length === 0) {
    listEl.innerHTML = `<p class="text-secondary" style="padding:var(--space-4);text-align:center">Aucun produit ne correspond à votre recherche.</p>`;
    return;
  }

  // Render as a grouped list (by category) when sortKey is 'category', else
  // flat. Keeps the cards visually scannable in both modes.
  const grouped = _supplierCatalogState.sortKey === 'category';
  if (grouped) {
    const cats = new Map();
    for (const p of rows) {
      const k = p.category || 'Sans catégorie';
      if (!cats.has(k)) cats.set(k, []);
      cats.get(k).push(p);
    }
    listEl.innerHTML = Array.from(cats.entries()).map(([cat, items]) => `
      <div class="supplier-category">
        <h3 class="supplier-category__title">${escapeHtml(cat)} <span class="text-tertiary text-sm">(${items.length})</span></h3>
        ${items.map(_supplierProductCardHtml).join('')}
      </div>
    `).join('');
  } else {
    listEl.innerHTML = `<div class="supplier-category">${rows.map(_supplierProductCardHtml).join('')}</div>`;
  }

  if (window.lucide) lucide.createIcons();
  _wireSupplierCatalogCardEvents(listEl);
}

function _supplierProductCardHtml(p) {
  const tva = p.tva_rate != null ? Number(p.tva_rate) : 5.5;
  const ttc = _ttcFromCatalogRow(p);
  return `
    <div class="supplier-product-card ${!p.available ? 'supplier-product-card--unavailable' : ''}" data-id="${p.id}">
      <div class="supplier-product-card__info">
        <span class="supplier-product-card__name">${escapeHtml(p.product_name)}</span>
        <span class="supplier-product-card__meta">
          ${p.sku ? `<span class="supplier-product-card__sku" data-id="${p.id}" data-sku="${escapeHtml(p.sku)}" title="Cliquer pour modifier">${escapeHtml(p.sku)}</span>` : `<span class="supplier-product-card__sku supplier-product-card__sku--missing" data-id="${p.id}" data-sku="" title="Ajouter un SKU">+ SKU</span>`}
          <span class="text-secondary">${escapeHtml(p.unit)}${p.min_order > 0 ? ` · Min : ${p.min_order}` : ''}</span>
          ${p.packaging ? `<span class="text-tertiary text-sm">· ${escapeHtml(p.packaging)}</span>` : ''}
        </span>
      </div>
      <div class="supplier-product-card__actions">
        <span class="supplier-product-card__price-wrap">
          <span class="supplier-product-card__price" data-id="${p.id}" data-price="${p.price}" title="Cliquer pour modifier">
            ${formatCurrency(p.price)} HT
          </span>
          <span class="supplier-product-card__tva text-tertiary text-sm">
            TVA ${tva}% · TTC ${formatCurrency(ttc)}
          </span>
        </span>
        <label class="supplier-toggle" title="${p.available ? 'Disponible' : 'Indisponible'}">
          <input type="checkbox" ${p.available ? 'checked' : ''} data-toggle-id="${p.id}">
          <span class="supplier-toggle__slider"></span>
        </label>
        <button class="btn-icon supplier-product-card__edit" aria-label="Modifier le produit" data-edit-id="${p.id}" title="Modifier">
          <i data-lucide="pencil" style="width:16px;height:16px"></i>
        </button>
        <button class="btn-icon supplier-product-card__delete" aria-label="Supprimer le produit" data-delete-id="${p.id}" data-delete-name="${escapeHtml(p.product_name)}" title="Supprimer">
          <i data-lucide="trash-2" style="width:16px;height:16px"></i>
        </button>
      </div>
    </div>`;
}

function _wireSupplierCatalogCardEvents(listEl) {
  // Inline price editing
  listEl.querySelectorAll('.supplier-product-card__price').forEach(priceEl => {
    priceEl.addEventListener('click', () => {
      const id = priceEl.dataset.id;
      const currentPrice = parseFloat(priceEl.dataset.price);
      startInlinePriceEdit(priceEl, id, currentPrice);
    });
  });
  // Inline SKU editing
  listEl.querySelectorAll('.supplier-product-card__sku').forEach(skuEl => {
    skuEl.addEventListener('click', () => {
      const id = skuEl.dataset.id;
      const currentSku = skuEl.dataset.sku || '';
      _startInlineSkuEdit(skuEl, id, currentSku);
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
  // Edit buttons → open edit modal
  listEl.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.editId);
      const product = _supplierCatalogState.catalog.find(p => p.id === id);
      if (product) showEditProductModal(product);
    });
  });
  // Delete buttons
  listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteId;
      const name = btn.dataset.deleteName;
      showConfirmModal('Retirer le produit', `Êtes-vous sûr de vouloir retirer "${name}" du catalogue ?`, async () => {
        try {
          await API.deleteSupplierProduct(id);
          showToast('Produit retiré', 'success');
          renderSupplierCatalogTab();
        } catch (e) {
          showToast(e.message, 'error');
        }
      }, { confirmText: 'Retirer', confirmClass: 'btn btn-danger' });
    });
  });
}

// Edit-product modal — reuses the add-product field set with prefilled values.
// Submit calls PUT /catalog/:id rather than POST.
function showEditProductModal(product) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  // Build the unit options up-front so the right one starts selected.
  const UNIT_OPTS = ['kg', 'L', 'pièce', 'botte', 'barquette', 'carton', 'sac', 'bouteille', 'fût', 'lot', 'plateau'];
  if (product.unit && !UNIT_OPTS.includes(product.unit)) UNIT_OPTS.push(product.unit);
  const TVA_OPTS = [5.5, 10, 20];
  const tvaCurrent = product.tva_rate != null ? Number(product.tva_rate) : 5.5;
  if (!TVA_OPTS.includes(tvaCurrent)) TVA_OPTS.push(tvaCurrent);

  overlay.innerHTML = `
    <div class="modal">
      <h2>Modifier le produit</h2>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Nom du produit</label>
          <input type="text" class="form-control" id="me-name" value="${escapeHtml(product.product_name || '')}">
        </div>
        <div class="form-group" style="flex:1">
          <label>SKU</label>
          <input type="text" class="form-control" id="me-sku" value="${escapeHtml(product.sku || '')}" placeholder="ex: MET-LEG-042" maxlength="64">
        </div>
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <input type="text" class="form-control" id="me-category" value="${escapeHtml(product.category || '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix HT (€)</label>
          <input type="number" class="form-control" id="me-price" step="0.01" min="0" value="${Number(product.price || 0).toFixed(2)}" style="font-family:var(--font-mono)">
        </div>
        <div class="form-group">
          <label>Unité</label>
          <select class="form-control" id="me-unit">
            ${UNIT_OPTS.map(u => `<option value="${escapeHtml(u)}" ${u === product.unit ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>TVA (%)</label>
          <select class="form-control" id="me-tva">
            ${TVA_OPTS.sort((a, b) => a - b).map(t => `<option value="${t}" ${t === tvaCurrent ? 'selected' : ''}>${t} %</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Conditionnement</label>
          <input type="text" class="form-control" id="me-pkg" value="${escapeHtml(product.packaging || '')}" placeholder="ex: Carton 5 kg" maxlength="80">
        </div>
        <div class="form-group">
          <label>Commande min</label>
          <input type="number" class="form-control" id="me-min" step="0.1" min="0" value="${Number(product.min_order || 0)}">
        </div>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="me-save" style="background:#4A90D9;border-color:#4A90D9">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
        <button class="btn btn-secondary" id="me-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const close = () => overlay.remove();
  overlay.querySelector('#me-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#me-save').onclick = async () => {
    const name = document.getElementById('me-name').value.trim();
    const category = document.getElementById('me-category').value.trim();
    const price = parseFloat(document.getElementById('me-price').value);
    const unit = document.getElementById('me-unit').value;
    const min_order = parseFloat(document.getElementById('me-min').value) || 0;
    const sku = document.getElementById('me-sku').value.trim();
    const packaging = document.getElementById('me-pkg').value.trim();
    const tva_rate = parseFloat(document.getElementById('me-tva').value);

    if (!name) { showToast('Nom du produit requis', 'error'); return; }
    if (!Number.isFinite(price) || price < 0) { showToast('Prix invalide', 'error'); return; }

    try {
      await API.updateSupplierProduct(product.id, {
        product_name: name,
        category: category || null,
        price,
        unit,
        min_order,
        sku: sku || null,
        tva_rate: Number.isFinite(tva_rate) ? tva_rate : 5.5,
        packaging: packaging || null,
      });
      showToast('Produit mis à jour', 'success');
      close();
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message || 'Erreur de sauvegarde', 'error');
    }
  };

  document.getElementById('me-name').focus();
}

// CSV export of the current catalog. Downloaded client-side, no server round-
// trip — saves bandwidth and works offline. Quotes every cell to dodge embedded
// commas/quotes/newlines safely; UTF-8 BOM so Excel opens it without mojibake.
function _exportSupplierCatalogCsv() {
  const rows = _supplierCatalogState.catalog;
  if (!rows.length) {
    showToast('Catalogue vide — rien à exporter', 'warning');
    return;
  }
  const header = ['Nom', 'SKU', 'Catégorie', 'Unité', 'Conditionnement', 'Prix HT (€)', 'TVA (%)', 'Prix TTC (€)', 'Commande min', 'Disponible', 'Dernière MàJ'];
  const escapeCsv = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [header.map(escapeCsv).join(',')];
  for (const p of rows) {
    const tva = p.tva_rate != null ? Number(p.tva_rate) : 5.5;
    const ttc = (Number(p.price) || 0) * (1 + tva / 100);
    lines.push([
      p.product_name || '',
      p.sku || '',
      p.category || '',
      p.unit || '',
      p.packaging || '',
      (Number(p.price) || 0).toFixed(2),
      tva,
      ttc.toFixed(2),
      Number(p.min_order || 0),
      p.available ? 'Oui' : 'Non',
      p.updated_at || '',
    ].map(escapeCsv).join(','));
  }
  // ﻿ is the UTF-8 BOM — without it Excel mangles accents.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `catalogue-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${rows.length} produits exportés`, 'success');
}

function _startInlineSkuEdit(skuEl, id, currentSku) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentSku;
  input.placeholder = 'Code article';
  input.maxLength = 64;
  input.className = 'supplier-sku-input';
  input.style.cssText = 'min-width:120px;font-family:var(--font-mono);font-size:var(--text-sm);padding:2px 6px;border-radius:var(--radius-sm);border:2px solid #4A90D9;background:var(--bg-base);color:var(--text-primary)';
  const originalHTML = skuEl.innerHTML;
  skuEl.innerHTML = '';
  skuEl.appendChild(input);
  input.focus();
  input.select();

  async function saveSku() {
    const newSku = input.value.trim();
    if (newSku === currentSku) { skuEl.innerHTML = originalHTML; return; }
    try {
      await API.updateSupplierProduct(id, { sku: newSku || null });
      showToast(newSku ? 'SKU mis à jour' : 'SKU supprimé', 'success');
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message, 'error');
      skuEl.innerHTML = originalHTML;
    }
  }
  input.addEventListener('blur', saveSku);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { skuEl.innerHTML = originalHTML; }
  });
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
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Nom du produit</label>
          <input type="text" class="form-control" id="m-prod-name" placeholder="ex: Tomates bio">
        </div>
        <div class="form-group" style="flex:1">
          <label>SKU (optionnel)</label>
          <input type="text" class="form-control" id="m-prod-sku" placeholder="ex: MET-LEG-042" maxlength="64">
        </div>
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <input type="text" class="form-control" id="m-prod-category" placeholder="ex: Légumes, Viandes, Crèmerie...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix HT (€)</label>
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
            <option value="bouteille">bouteille</option>
            <option value="fût">fût</option>
            <option value="lot">lot</option>
            <option value="plateau">plateau</option>
          </select>
        </div>
        <div class="form-group">
          <label>TVA (%)</label>
          <select class="form-control" id="m-prod-tva">
            <option value="5.5" selected>5,5 % (alimentaire)</option>
            <option value="10">10 % (restauration)</option>
            <option value="20">20 % (alcools, autres)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Conditionnement (optionnel)</label>
          <input type="text" class="form-control" id="m-prod-pkg" placeholder="ex: Carton 5 kg, Lot de 6, Barquette 500g" maxlength="80">
        </div>
        <div class="form-group">
          <label>Commande min</label>
          <input type="number" class="form-control" id="m-prod-min" step="0.1" min="0" value="0">
        </div>
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
    const sku = document.getElementById('m-prod-sku').value.trim();
    const packaging = document.getElementById('m-prod-pkg').value.trim();
    const tva_rate = parseFloat(document.getElementById('m-prod-tva').value);

    if (!product_name) { showToast('Nom du produit requis', 'error'); return; }
    if (isNaN(price) || price < 0) { showToast('Prix invalide', 'error'); return; }

    try {
      await API.addSupplierProduct({
        product_name,
        category: category || null,
        price,
        unit,
        min_order,
        sku: sku || null,
        tva_rate: Number.isFinite(tva_rate) ? tva_rate : 5.5,
        packaging: packaging || null,
      });
      showToast('Produit ajouté', 'success');
      overlay.remove();
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  document.getElementById('m-prod-name').focus();
}

// HISTORIQUE TAB — orders feed (commercial history). Replaces the previous
// audit-log catalog-changes view; that data is still available via the price
// change notifications (gérant side) but the supplier needs to see SALES, not
// SKU edits, when they click "Historique".
async function renderSupplierHistoryTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  // Default range: last 90 days + status='all' + q=''. Stored at module scope
  // so re-rendering (filter change) keeps the user's selection.
  if (!_historiqueState) {
    const today = new Date();
    const from = new Date(today.getTime() - 90 * 86400_000);
    _historiqueState = {
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
      restaurantId: '',
      status: 'all',
      q: '',
    };
  }
  // Cache last fetched orders for the CSV export — avoids a re-fetch when
  // the user clicks "Exporter CSV" right after applying a filter.
  _historiqueLastOrders = _historiqueLastOrders || [];

  // Chip status keys map 1:1 to ?status= server values; the server accepts
  // both accented + unaccented spellings (see /historique tests).
  const STATUS_CHIPS = [
    { key: 'all',         label: 'Toutes' },
    { key: 'brouillon',   label: 'Brouillon' },
    { key: 'envoyée',     label: 'Envoyées' },
    { key: 'confirmée',   label: 'Confirmées' },
    { key: 'livrée',      label: 'Livrées' },
    { key: 'refusée',     label: 'Refusées' },
  ];

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)">
      <h2 style="margin:0;font-size:var(--text-xl)">Historique des commandes</h2>
      <button class="btn btn-secondary btn-sm" id="historique-csv">
        <i data-lucide="download" style="width:16px;height:16px"></i> Exporter CSV
      </button>
    </div>
    <div class="historique-toolbar">
      <label>
        <span class="text-secondary text-sm">Du</span>
        <input type="date" id="historique-from" class="form-control" value="${_historiqueState.from}">
      </label>
      <label>
        <span class="text-secondary text-sm">Au</span>
        <input type="date" id="historique-to" class="form-control" value="${_historiqueState.to}">
      </label>
      <label>
        <span class="text-secondary text-sm">Client</span>
        <select id="historique-restaurant" class="form-control">
          <option value="">Tous</option>
        </select>
      </label>
      <label style="flex:1;min-width:180px">
        <span class="text-secondary text-sm">Référence</span>
        <input type="search" id="historique-q" class="form-control"
               placeholder="ex: DEMO-PO-005"
               value="${escapeHtml(_historiqueState.q || '')}">
      </label>
      <div class="historique-totals" id="historique-totals"></div>
    </div>
    <div class="historique-chips">
      ${STATUS_CHIPS.map(c => `
        <button type="button"
                class="historique-chip ${c.key === _historiqueState.status ? 'historique-chip--active' : ''}"
                data-status="${escapeHtml(c.key)}">
          ${escapeHtml(c.label)}
        </button>
      `).join('')}
    </div>
    <div id="historique-body"><div class="loading"><div class="spinner"></div></div></div>
  `;

  // Populate the client dropdown from /clients (supplier_account is currently
  // single-tenant so this will list one option, but the wiring is future-proof).
  try {
    const clients = await API.getSupplierClients();
    const sel = document.getElementById('historique-restaurant');
    for (const c of clients) {
      const opt = document.createElement('option');
      opt.value = c.restaurant_id;
      opt.textContent = c.restaurant_name || `#${c.restaurant_id}`;
      if (String(c.restaurant_id) === String(_historiqueState.restaurantId)) opt.selected = true;
      sel.appendChild(opt);
    }
  } catch (_) { /* offline → leave the dropdown empty */ }

  document.getElementById('historique-from').addEventListener('change', (e) => {
    _historiqueState.from = e.target.value;
    _loadHistorique();
  });
  document.getElementById('historique-to').addEventListener('change', (e) => {
    _historiqueState.to = e.target.value;
    _loadHistorique();
  });
  document.getElementById('historique-restaurant').addEventListener('change', (e) => {
    _historiqueState.restaurantId = e.target.value;
    _loadHistorique();
  });
  document.querySelectorAll('.historique-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      _historiqueState.status = chip.dataset.status;
      // Repaint chips active state without re-fetching the client dropdown.
      document.querySelectorAll('.historique-chip').forEach(c => {
        c.classList.toggle('historique-chip--active', c.dataset.status === _historiqueState.status);
      });
      _loadHistorique();
    });
  });

  // Debounce the reference search so we don't fire a request per keystroke.
  let _historiqueQTimer = null;
  document.getElementById('historique-q').addEventListener('input', (e) => {
    _historiqueState.q = e.target.value;
    clearTimeout(_historiqueQTimer);
    _historiqueQTimer = setTimeout(_loadHistorique, 250);
  });

  document.getElementById('historique-csv').addEventListener('click', _exportHistoriqueCsv);

  _loadHistorique();
}

// CSV export of the LAST loaded historique result. Same UTF-8 BOM + quoted-cell
// pattern as the catalog CSV export. Columns: Date / Référence / Restaurant /
// Statut / Montant HT / TVA / Montant TTC. TVA is approximated at 5.5%
// (food default) — mixed-rate baskets will be slightly off, mirroring the
// table view in the historique tab.
function _exportHistoriqueCsv() {
  if (!_historiqueLastOrders || !_historiqueLastOrders.length) {
    showToast('Aucune commande à exporter sur la période sélectionnée', 'warning');
    return;
  }
  const header = ['Date', 'Référence', 'Restaurant', 'Statut', 'Montant HT (€)', 'TVA (€)', 'Montant TTC (€)'];
  const escapeCsv = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? String(s)
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const lines = [header.map(escapeCsv).join(',')];
  for (const o of _historiqueLastOrders) {
    const ht = Number(o.total_amount) || 0;
    const tva = Math.round(ht * 0.055 * 100) / 100;
    const ttc = Math.round((ht + tva) * 100) / 100;
    lines.push([
      fmtDate(o.created_at),
      o.reference || '',
      o.restaurant_name || '',
      o.status || '',
      ht.toFixed(2),
      tva.toFixed(2),
      ttc.toFixed(2),
    ].map(escapeCsv).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `historique-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${_historiqueLastOrders.length} commandes exportées`, 'success');
}

let _historiqueState = null;
let _historiqueLastOrders = null;

async function _loadHistorique() {
  const body = document.getElementById('historique-body');
  const totalsEl = document.getElementById('historique-totals');
  if (!body) return;
  body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  let data;
  try {
    data = await API.getSupplierHistorique({
      from: _historiqueState.from,
      to: _historiqueState.to,
      restaurant_id: _historiqueState.restaurantId || undefined,
      status: _historiqueState.status,
      q: _historiqueState.q || undefined,
    });
    _historiqueLastOrders = data.orders || [];
  } catch (e) {
    body.innerHTML = `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
    return;
  }

  const fmtCurrency = (n) => formatCurrency(Number(n) || 0);
  const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const statusPill = (status) => {
    const map = {
      'brouillon': 'pill--draft', 'envoyée': 'pill--sent', 'envoyee': 'pill--sent',
      'confirmée': 'pill--ok', 'confirmee': 'pill--ok', 'livrée': 'pill--ok', 'livree': 'pill--ok',
      'annulée': 'pill--cancel', 'annulee': 'pill--cancel',
    };
    return `<span class="supplier-pill ${map[status] || 'pill--draft'}">${escapeHtml(status || '—')}</span>`;
  };

  if (totalsEl) {
    totalsEl.innerHTML = `
      <span><strong>${data.totals.count}</strong> commande${data.totals.count > 1 ? 's' : ''}</span>
      <span><strong class="text-mono">${fmtCurrency(data.totals.revenue_ht)}</strong> HT</span>
    `;
  }

  if (!data.orders.length) {
    body.innerHTML = `
      <p class="text-secondary" style="padding:var(--space-4) 0;text-align:center">
        Aucune commande sur cette période.
      </p>
    `;
    return;
  }

  body.innerHTML = `
    <div class="supplier-orders-table-wrap">
      <table class="supplier-orders-table">
        <thead>
          <tr>
            <th>Référence</th>
            <th>Date</th>
            <th>Client</th>
            <th>Statut</th>
            <th style="text-align:right">Montant HT</th>
            <th style="text-align:right">Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          ${data.orders.map(o => {
            // Display TTC at a flat 5.5% — the per-line TVA isn't on
            // purchase_order_items so we approximate with the food default.
            // Mixed-rate baskets (alcohol etc.) may differ slightly.
            const ttc = (Number(o.total_amount) || 0) * 1.055;
            return `
              <tr>
                <td><strong>${escapeHtml(o.reference || `#${o.id}`)}</strong></td>
                <td>${fmtDate(o.created_at)}</td>
                <td>${escapeHtml(o.restaurant_name || '—')}</td>
                <td>${statusPill(o.status)}</td>
                <td style="text-align:right" class="text-mono">${fmtCurrency(o.total_amount)}</td>
                <td style="text-align:right" class="text-mono text-tertiary">${fmtCurrency(ttc)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
