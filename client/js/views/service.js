// ═══════════════════════════════════════════
// Service View — Waitstaff Order Management
// ═══════════════════════════════════════════

const SERVICE_TABLE_COUNT = 20;
const SERVICE_POLL_INTERVAL = 10000;
let _serviceInterval = null;
let _serviceState = {
  selectedTable: null,
  tables: {},        // { tableNum: { orders: [], currentDraft: null } }
  menu: [],          // recipes grouped by category
  allOrders: [],
  account: null,
  mobileTab: 'tables' // 'tables' | 'order' | 'tracking'
};

async function renderServiceView() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  _serviceState.account = getAccount();

  // Full-screen layout — no #app max-width
  app.style.maxWidth = 'none';
  app.style.padding = '0';
  if (nav) nav.style.display = 'none';

  app.innerHTML = `
    <div class="svc-shell">
      <header class="svc-header">
        <div class="svc-header__left">
          <img src="assets/logo.png" alt="RestoSuite" style="height: 28px; width: auto;">
          <span class="svc-header__title">Service</span>
          <span class="svc-header__user">— ${escapeHtml(_serviceState.account?.name || 'Serveur')}</span>
        </div>
        <div class="svc-header__right">
          <button class="svc-header__btn" id="svc-notif-btn" title="Notifications">🔔 <span class="svc-notif-badge hidden" id="svc-notif-count">0</span></button>
          <button class="svc-header__btn svc-header__btn--logout" onclick="logout()">Déconnexion</button>
        </div>
      </header>

      <div class="svc-mobile-tabs" id="svc-mobile-tabs">
        <button class="svc-tab active" data-tab="tables">Tables</button>
        <button class="svc-tab" data-tab="order">Commande</button>
        <button class="svc-tab" data-tab="tracking">Suivi</button>
      </div>

      <div class="svc-body">
        <div class="svc-col-left" id="svc-tables-panel">
          <h2 class="svc-section-title">Plan de salle</h2>
          <div class="svc-tables-grid" id="svc-tables-grid"></div>
          <div class="svc-tracking-section" id="svc-tracking-inline"></div>
        </div>
        <div class="svc-col-right" id="svc-order-panel">
          <div class="svc-no-table" id="svc-no-table">
            <div class="svc-no-table__icon">🍽️</div>
            <p>Sélectionnez une table pour commencer</p>
          </div>
          <div class="svc-order-content hidden" id="svc-order-content">
            <div class="svc-order-header">
              <h2 id="svc-order-title">Table —</h2>
              <button class="btn btn-danger btn-sm" id="svc-close-table-btn" title="Terminer la table">Terminer la table</button>
            </div>
            <div class="svc-order-cols">
              <div class="svc-menu-panel" id="svc-menu-panel">
                <h3 class="svc-section-subtitle">Menu</h3>
                <div id="svc-menu-list"></div>
              </div>
              <div class="svc-cart-panel" id="svc-cart-panel">
                <h3 class="svc-section-subtitle">Commande en cours</h3>
                <div id="svc-cart-items"></div>
                <div class="svc-cart-notes">
                  <textarea class="form-control svc-notes-input" id="svc-order-notes" rows="2" placeholder="Notes (allergies, demandes spéciales...)"></textarea>
                </div>
                <div class="svc-cart-total" id="svc-cart-total">Total : 0,00 €</div>
                <div class="svc-cart-actions">
                  <button class="btn btn-secondary svc-action-btn" id="svc-save-btn">💾 Sauvegarder</button>
                  <button class="btn btn-primary svc-action-btn" id="svc-send-btn">🔔 Envoyer en cuisine</button>
                </div>
                <div class="svc-table-orders" id="svc-table-orders"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="svc-col-tracking hidden" id="svc-tracking-panel">
          <h2 class="svc-section-title">Suivi des commandes</h2>
          <div id="svc-tracking-list"></div>
        </div>
      </div>
    </div>
  `;

  // Mobile tab handlers
  document.querySelectorAll('.svc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _serviceState.mobileTab = tab.dataset.tab;
      document.querySelectorAll('.svc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _svcUpdateMobileVisibility();
    });
  });

  // Close table button
  document.getElementById('svc-close-table-btn').addEventListener('click', _svcCloseTable);
  document.getElementById('svc-save-btn').addEventListener('click', () => _svcSaveOrder(false));
  document.getElementById('svc-send-btn').addEventListener('click', () => _svcSaveOrder(true));

  // Load data
  await _svcLoadData();
  _svcRenderTables();
  _svcRenderMenu();
  _svcRenderTracking();

  // Start polling
  if (_serviceInterval) clearInterval(_serviceInterval);
  _serviceInterval = setInterval(async () => {
    if (!location.hash.startsWith('#/service')) {
      clearInterval(_serviceInterval);
      _serviceInterval = null;
      return;
    }
    await _svcRefreshOrders();
  }, SERVICE_POLL_INTERVAL);
}

function _svcCleanup() {
  if (_serviceInterval) {
    clearInterval(_serviceInterval);
    _serviceInterval = null;
  }
  const app = document.getElementById('app');
  if (app) {
    app.style.maxWidth = '';
    app.style.padding = '';
  }
}

// ─── Data Loading ───
async function _svcLoadData() {
  try {
    const [recipes, orders] = await Promise.all([
      API.getRecipes(),
      API.getOrders()
    ]);

    // Filter plats only, group by category
    const plats = recipes.filter(r => (r.recipe_type || 'plat') === 'plat');
    const grouped = {};
    const categoryOrder = ['entrée', 'plat', 'dessert', 'boisson', 'accompagnement'];
    for (const r of plats) {
      const cat = r.category || 'Autres';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }
    // Sort categories
    _serviceState.menu = Object.entries(grouped).sort((a, b) => {
      const ia = categoryOrder.indexOf(a[0]);
      const ib = categoryOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    _serviceState.allOrders = orders;
    _svcBuildTableState();
  } catch (e) {
    showToast('Erreur chargement données service', 'error');
  }
}

async function _svcRefreshOrders() {
  try {
    _serviceState.allOrders = await API.getOrders();
    const prevStates = {};
    // Track previous states for notifications
    for (let t = 1; t <= SERVICE_TABLE_COUNT; t++) {
      const td = _serviceState.tables[t];
      if (td) {
        prevStates[t] = td.orders.filter(o => o.status === 'prêt').length;
      }
    }
    _svcBuildTableState();
    // Check for newly ready orders
    for (let t = 1; t <= SERVICE_TABLE_COUNT; t++) {
      const td = _serviceState.tables[t];
      if (td) {
        const readyNow = td.orders.filter(o => o.status === 'prêt').length;
        if (readyNow > (prevStates[t] || 0)) {
          _svcNotifyReady(t);
        }
      }
    }
    _svcRenderTables();
    _svcRenderTracking();
    if (_serviceState.selectedTable) {
      _svcRenderTableOrders();
    }
  } catch (e) { /* silent */ }
}

function _svcBuildTableState() {
  const tables = {};
  for (let t = 1; t <= SERVICE_TABLE_COUNT; t++) {
    tables[t] = { orders: [], currentDraft: null };
  }
  for (const order of _serviceState.allOrders) {
    const tn = order.table_number;
    if (tn >= 1 && tn <= SERVICE_TABLE_COUNT) {
      if (!tables[tn]) tables[tn] = { orders: [], currentDraft: null };
      tables[tn].orders.push(order);
      if (order.status === 'en_cours') {
        tables[tn].currentDraft = order;
      }
    }
  }
  // Preserve local draft items for selected table
  const prev = _serviceState.tables;
  for (let t = 1; t <= SERVICE_TABLE_COUNT; t++) {
    if (prev[t] && prev[t]._localDraft) {
      tables[t]._localDraft = prev[t]._localDraft;
    }
  }
  _serviceState.tables = tables;
}

function _svcNotifyReady(tableNum) {
  showToast(`✅ Table ${tableNum} — Plat(s) prêt(s) !`, 'success');
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  // Update notification badge
  const badge = document.getElementById('svc-notif-count');
  if (badge) {
    const current = parseInt(badge.textContent) || 0;
    badge.textContent = current + 1;
    badge.classList.remove('hidden');
  }
}

// ─── Table State ───
function _svcGetTableStatus(tableNum) {
  const td = _serviceState.tables[tableNum];
  if (!td) return 'libre';
  const activeOrders = td.orders.filter(o => !['terminé', 'annulé'].includes(o.status));
  if (activeOrders.length === 0 && !td._localDraft) return 'libre';
  if (td._localDraft && td._localDraft.length > 0) return 'draft';
  if (activeOrders.some(o => o.status === 'en_cours')) return 'draft';
  if (activeOrders.some(o => o.status === 'prêt')) return 'ready';
  if (activeOrders.some(o => {
    const elapsed = (Date.now() - new Date(o.created_at).getTime()) / 60000;
    return o.status === 'envoyé' && elapsed > 20;
  })) return 'late';
  if (activeOrders.some(o => o.status === 'envoyé')) return 'sent';
  return 'libre';
}

// ─── Render Tables Grid ───
function _svcRenderTables() {
  const grid = document.getElementById('svc-tables-grid');
  if (!grid) return;

  let html = '';
  for (let t = 1; t <= SERVICE_TABLE_COUNT; t++) {
    const status = _svcGetTableStatus(t);
    const selected = _serviceState.selectedTable === t ? ' svc-table--selected' : '';
    const activeOrders = (_serviceState.tables[t]?.orders || []).filter(o => !['terminé', 'annulé'].includes(o.status));
    const itemCount = activeOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0);
    html += `
      <button class="svc-table-btn svc-table--${status}${selected}" data-table="${t}">
        <span class="svc-table-num">${t}</span>
        ${itemCount > 0 ? `<span class="svc-table-count">${itemCount}</span>` : ''}
        <span class="svc-table-status">${_svcStatusIcon(status)}</span>
      </button>
    `;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.svc-table-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _svcSelectTable(parseInt(btn.dataset.table));
    });
  });
}

function _svcStatusIcon(status) {
  switch (status) {
    case 'libre': return '';
    case 'draft': return '📝';
    case 'sent': return '🔵';
    case 'ready': return '✅';
    case 'late': return '🔴';
    default: return '';
  }
}

// ─── Select Table ───
function _svcSelectTable(tableNum) {
  _serviceState.selectedTable = tableNum;
  _svcRenderTables();

  const noTable = document.getElementById('svc-no-table');
  const content = document.getElementById('svc-order-content');
  noTable.classList.add('hidden');
  content.classList.remove('hidden');

  document.getElementById('svc-order-title').textContent = `Table ${tableNum}`;

  // Initialize local draft if needed
  const td = _serviceState.tables[tableNum];
  if (!td._localDraft) {
    // Load from existing en_cours order if any
    if (td.currentDraft && td.currentDraft.items) {
      td._localDraft = td.currentDraft.items.map(it => ({
        recipe_id: it.recipe_id,
        name: it.recipe_name,
        price: it.selling_price || 0,
        quantity: it.quantity,
        notes: it.notes || ''
      }));
    } else {
      td._localDraft = [];
    }
  }

  // Load notes from draft order
  const notesEl = document.getElementById('svc-order-notes');
  if (notesEl) {
    notesEl.value = td.currentDraft?.notes || '';
  }

  _svcRenderCart();
  _svcRenderTableOrders();
  _svcUpdateMenuQuantities();

  // Mobile: switch to order tab
  if (window.innerWidth < 768) {
    _serviceState.mobileTab = 'order';
    document.querySelectorAll('.svc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'order'));
    _svcUpdateMobileVisibility();
  }
}

// ─── Render Menu ───
function _svcRenderMenu() {
  const el = document.getElementById('svc-menu-list');
  if (!el) return;

  if (_serviceState.menu.length === 0) {
    el.innerHTML = '<p class="text-muted" style="padding:16px">Aucun plat au menu. Ajoutez des fiches de type "Plat" avec un prix de vente.</p>';
    return;
  }

  const categoryEmojis = {
    'entrée': '🥗',
    'plat': '🍽️',
    'dessert': '🍰',
    'boisson': '🥂',
    'accompagnement': '🥬',
    'Autres': '📋'
  };

  let html = '';
  for (const [cat, items] of _serviceState.menu) {
    const emoji = categoryEmojis[cat] || '📋';
    html += `<div class="svc-menu-category">
      <h4 class="svc-menu-cat-title">${emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</h4>
      <div class="svc-menu-items">`;
    for (const item of items) {
      html += `
        <button class="svc-menu-item" data-id="${item.id}" data-name="${escapeHtml(item.name)}" data-price="${item.selling_price || 0}">
          <span class="svc-menu-item__name">${escapeHtml(item.name)}</span>
          <span class="svc-menu-item__price">${item.selling_price ? formatCurrency(item.selling_price) : '—'}</span>
          <span class="svc-menu-item__add">+</span>
        </button>
      `;
    }
    html += '</div></div>';
  }
  el.innerHTML = html;

  el.querySelectorAll('.svc-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_serviceState.selectedTable) { showToast('Sélectionnez une table', 'error'); return; }
      _svcAddItem(parseInt(btn.dataset.id), btn.dataset.name, parseFloat(btn.dataset.price));
    });
  });
}

function _svcUpdateMenuQuantities() {
  // Could add quantity badges on menu items — skip for perf
}

// ─── Cart Management ───
function _svcAddItem(recipeId, name, price) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft;
  const existing = draft.find(i => i.recipe_id === recipeId);
  if (existing) {
    existing.quantity++;
  } else {
    draft.push({ recipe_id: recipeId, name, price, quantity: 1, notes: '' });
  }
  _svcRenderCart();
  _svcRenderTables();
}

function _svcChangeQty(recipeId, delta) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  const draft = _serviceState.tables[tn]._localDraft;
  const item = draft.find(i => i.recipe_id === recipeId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    _serviceState.tables[tn]._localDraft = draft.filter(i => i.recipe_id !== recipeId);
  }
  _svcRenderCart();
  _svcRenderTables();
}

function _svcRemoveItem(recipeId) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;
  _serviceState.tables[tn]._localDraft = _serviceState.tables[tn]._localDraft.filter(i => i.recipe_id !== recipeId);
  _svcRenderCart();
  _svcRenderTables();
}

function _svcRenderCart() {
  const el = document.getElementById('svc-cart-items');
  const totalEl = document.getElementById('svc-cart-total');
  const tn = _serviceState.selectedTable;
  if (!el || !tn) return;

  const draft = _serviceState.tables[tn]._localDraft || [];
  if (draft.length === 0) {
    el.innerHTML = '<p class="text-muted svc-empty-cart">Aucun plat ajouté</p>';
    totalEl.textContent = 'Total : 0,00 €';
    return;
  }

  let total = 0;
  el.innerHTML = draft.map(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    return `
      <div class="svc-cart-item">
        <span class="svc-cart-item__qty">${item.quantity}×</span>
        <span class="svc-cart-item__name">${escapeHtml(item.name)}</span>
        <span class="svc-cart-item__price">${formatCurrency(subtotal)}</span>
        <div class="svc-cart-item__actions">
          <button class="svc-qty-btn" onclick="_svcChangeQty(${item.recipe_id}, -1)">−</button>
          <button class="svc-qty-btn" onclick="_svcChangeQty(${item.recipe_id}, 1)">+</button>
          <button class="svc-qty-btn svc-qty-btn--delete" onclick="_svcRemoveItem(${item.recipe_id})">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  totalEl.textContent = `Total : ${formatCurrency(total)}`;
}

// ─── Save / Send Order ───
async function _svcSaveOrder(sendImmediately) {
  const tn = _serviceState.selectedTable;
  if (!tn) return;

  const draft = _serviceState.tables[tn]._localDraft || [];
  if (draft.length === 0) {
    showToast('Ajoutez au moins un plat', 'error');
    return;
  }

  const notes = document.getElementById('svc-order-notes')?.value?.trim() || null;
  const td = _serviceState.tables[tn];

  try {
    let order;
    if (td.currentDraft) {
      // Update existing draft — delete and recreate (simpler than PATCH)
      await API.cancelOrder(td.currentDraft.id);
    }

    order = await API.createOrder({
      table_number: tn,
      notes,
      items: draft.map(i => ({ recipe_id: i.recipe_id, quantity: i.quantity, notes: i.notes || null }))
    });

    if (sendImmediately) {
      const result = await API.sendOrder(order.id);
      if (result.warnings && result.warnings.length > 0) {
        showToast(`⚠️ Stock insuffisant pour ${result.warnings.length} ingrédient(s)`, 'info');
      }
      showToast(`Table ${tn} — Commande envoyée en cuisine !`, 'success');
      // Clear local draft
      _serviceState.tables[tn]._localDraft = [];
    } else {
      showToast(`Table ${tn} — Commande sauvegardée`, 'success');
      // Keep draft synced with server
      _serviceState.tables[tn]._localDraft = null;
    }

    await _svcRefreshOrders();
    if (_serviceState.selectedTable === tn) {
      _svcSelectTable(tn);
    }
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── Close / Finish Table ───
async function _svcCloseTable() {
  const tn = _serviceState.selectedTable;
  if (!tn) return;

  const td = _serviceState.tables[tn];
  const activeOrders = td.orders.filter(o => !['terminé', 'annulé'].includes(o.status));

  if (activeOrders.length === 0 && (!td._localDraft || td._localDraft.length === 0)) {
    showToast('Cette table est déjà libre', 'info');
    return;
  }

  if (!confirm(`Terminer la table ${tn} ? Toutes les commandes seront marquées comme terminées.`)) return;

  try {
    for (const order of activeOrders) {
      await API.updateOrder(order.id, { status: 'terminé' });
    }
    _serviceState.tables[tn]._localDraft = [];
    showToast(`Table ${tn} terminée`, 'success');
    _serviceState.selectedTable = null;
    document.getElementById('svc-no-table').classList.remove('hidden');
    document.getElementById('svc-order-content').classList.add('hidden');
    await _svcRefreshOrders();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── Render Table's Sent Orders ───
function _svcRenderTableOrders() {
  const el = document.getElementById('svc-table-orders');
  const tn = _serviceState.selectedTable;
  if (!el || !tn) return;

  const td = _serviceState.tables[tn];
  const sentOrders = td.orders.filter(o => ['envoyé', 'prêt'].includes(o.status));

  if (sentOrders.length === 0) {
    el.innerHTML = '';
    return;
  }

  var html = '<h4 class="svc-section-subtitle" style="margin-top:16px">Commandes envoyées</h4>';
  for (var order of sentOrders) {
    var readyCls = order.status === 'prêt' ? 'svc-sent-order--ready' : '';
    var badgeCls = order.status === 'prêt' ? 'badge-success' : 'badge-info';
    var badgeLabel = order.status === 'prêt' ? '✅ Prêt' : '⏳ En cuisine';
    html += '<div class="svc-sent-order ' + readyCls + '">';
    html += '<div class="svc-sent-order__header">';
    html += '<span class="badge ' + badgeCls + '">' + badgeLabel + '</span>';
    html += '<span class="svc-sent-order__time">' + getElapsedTime(order.created_at) + '</span>';
    html += '</div>';
    for (var item of order.items) {
      html += '<div class="svc-sent-item">';
      html += '<span>' + item.quantity + '× ' + escapeHtml(item.recipe_name) + '</span>';
      html += '<span class="svc-sent-item__status">' + getItemStatusIcon(item.status) + '</span>';
      html += '</div>';
    }
    if (order.status === 'prêt') {
      html += '<button class="btn btn-primary btn-sm svc-served-btn" onclick="_svcMarkServed(' + order.id + ')">🍽️ Marquer servi</button>';
    }
    html += '</div>';
  }
  el.innerHTML = html;
}

async function _svcMarkServed(orderId) {
  try {
    await API.updateOrder(orderId, { status: 'terminé' });
    showToast('Commande marquée comme servie', 'success');
    await _svcRefreshOrders();
    if (_serviceState.selectedTable) _svcRenderTableOrders();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── Render Tracking Panel ───
function _svcRenderTracking() {
  const el = document.getElementById('svc-tracking-list');
  const inlineEl = document.getElementById('svc-tracking-inline');
  if (!el) return;

  const activeOrders = _serviceState.allOrders.filter(o => ['envoyé', 'prêt'].includes(o.status));
  activeOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  var html = '';
  if (activeOrders.length === 0) {
    html = '<div class="svc-empty-tracking"><p class="text-muted">Aucune commande en cours</p></div>';
  } else {
    for (var order of activeOrders) {
      var elapsed = getElapsedTime(order.created_at);
      var isReady = order.status === 'prêt';
      var isLate = !isReady && (Date.now() - new Date(order.created_at).getTime()) > 20 * 60000;
      var cardCls = isReady ? 'svc-track-card--ready' : isLate ? 'svc-track-card--late' : '';
      var badgeCls = isReady ? 'badge-success' : isLate ? 'badge--danger' : 'badge-info';
      var badgeTxt = isReady ? '✅ Prêt' : isLate ? '⚠️ En retard' : '⏳ En cuisine';
      html += '<div class="svc-track-card ' + cardCls + '">';
      html += '<div class="svc-track-card__header">';
      html += '<span class="svc-track-card__table" onclick="_svcSelectTable(' + order.table_number + ')">Table ' + order.table_number + '</span>';
      html += '<span class="svc-track-card__time">' + elapsed + '</span>';
      html += '<span class="badge ' + badgeCls + '">' + badgeTxt + '</span>';
      html += '</div>';
      html += '<div class="svc-track-card__items">';
      for (var it of order.items) {
        html += '<span class="svc-track-item">' + it.quantity + '× ' + escapeHtml(it.recipe_name) + ' ' + getItemStatusIcon(it.status) + '</span>';
      }
      html += '</div>';
      if (isReady) {
        html += '<button class="btn btn-primary btn-sm" onclick="_svcMarkServed(' + order.id + ')" style="margin-top:8px">🍽️ Servi</button>';
      }
      html += '</div>';
    }
  }

  el.innerHTML = html;
  // Also render inline tracking on desktop (below tables)
  if (inlineEl) {
    inlineEl.innerHTML = activeOrders.length > 0 ? `<h3 class="svc-section-subtitle" style="margin-top:20px">Suivi rapide</h3>${html}` : '';
  }
}

// ─── Mobile Tab Visibility ───
function _svcUpdateMobileVisibility() {
  const tables = document.getElementById('svc-tables-panel');
  const order = document.getElementById('svc-order-panel');
  const tracking = document.getElementById('svc-tracking-panel');
  if (!tables || !order || !tracking) return;

  if (window.innerWidth >= 768) {
    tables.classList.remove('hidden');
    order.classList.remove('hidden');
    tracking.classList.add('hidden'); // tracking is inline on desktop
    return;
  }

  tables.classList.toggle('hidden', _serviceState.mobileTab !== 'tables');
  order.classList.toggle('hidden', _serviceState.mobileTab !== 'order');
  tracking.classList.toggle('hidden', _serviceState.mobileTab !== 'tracking');
}

// Listen for resize
window.addEventListener('resize', _svcUpdateMobileVisibility);
