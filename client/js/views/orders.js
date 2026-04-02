// ═══════════════════════════════════════════
// Orders — Dashboard / New Order / Kitchen View
// ═══════════════════════════════════════════

// ─── Orders Dashboard ───
async function renderOrdersDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <h1>Commandes</h1>
      <div style="display:flex;gap:8px">
        <a href="#/orders/kitchen" class="btn btn-secondary btn-sm"><i data-lucide="chef-hat" style="width:16px;height:16px"></i> Cuisine</a>
        <a href="#/orders/new" class="btn btn-primary"><i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle</a>
      </div>
    </div>
    <div class="orders-subnav" style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto">
      <button class="haccp-subnav__link active" data-filter="">Toutes</button>
      <button class="haccp-subnav__link" data-filter="en_cours">En cours</button>
      <button class="haccp-subnav__link" data-filter="envoyé">Envoyées</button>
      <button class="haccp-subnav__link" data-filter="prêt">Prêtes</button>
      <button class="haccp-subnav__link" data-filter="terminé">Terminées</button>
    </div>
    <div id="orders-grid"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  let allOrders = [];
  try {
    allOrders = await API.getOrders();
  } catch (e) {
    showToast('Erreur chargement commandes', 'error');
  }

  const gridEl = document.getElementById('orders-grid');

  function renderOrders(filterStatus) {
    const orders = filterStatus
      ? allOrders.filter(o => o.status === filterStatus)
      : allOrders;

    if (orders.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>Aucune commande</h3>
          <p>Créez une nouvelle commande pour commencer.</p>
          <a href="#/orders/new" class="btn btn-primary">Nouvelle commande</a>
        </div>
      `;
      return;
    }

    // Group by table
    const byTable = {};
    for (const o of orders) {
      if (!byTable[o.table_number]) byTable[o.table_number] = [];
      byTable[o.table_number].push(o);
    }

    gridEl.innerHTML = `<div class="orders-table-grid">${Object.entries(byTable).map(([table, tableOrders]) => {
      return tableOrders.map(order => {
        const statusClass = getOrderStatusClass(order.status);
        const statusLabel = getOrderStatusLabel(order.status);
        const elapsed = getElapsedTime(order.created_at);
        const itemsHtml = order.items.map(it =>
          `<div class="order-item-line">
            <span>${it.quantity > 1 ? it.quantity + '× ' : ''}${escapeHtml(it.recipe_name)}</span>
            <span class="order-item-status order-item-status--${it.status}">${getItemStatusIcon(it.status)}</span>
          </div>`
        ).join('');

        return `
          <div class="order-card order-card--${statusClass}">
            <div class="order-card__header">
              <span class="order-card__table">Table ${table}</span>
              <span class="order-card__timer">${elapsed}</span>
            </div>
            <span class="badge order-badge--${statusClass}">${statusLabel}</span>
            <div class="order-card__items">${itemsHtml}</div>
            <div class="order-card__footer">
              <span class="order-card__total mono">${formatCurrency(order.total_cost)}</span>
              <div class="order-card__actions">
                ${order.status === 'en_cours' ? `
                  <button class="btn btn-primary btn-sm" onclick="sendOrderFromDash(${order.id})">Envoyer</button>
                  <button class="btn btn-danger btn-sm" onclick="cancelOrderFromDash(${order.id})"><i data-lucide="x" style="width:14px;height:14px"></i></button>
                ` : ''}
                ${order.status === 'prêt' ? `
                  <button class="btn btn-primary btn-sm" onclick="completeOrderFromDash(${order.id})">Terminé</button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }).join('')}</div>`;
    lucide.createIcons();
  }

  renderOrders('');

  // Filter buttons
  document.querySelectorAll('.orders-subnav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.orders-subnav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOrders(btn.dataset.filter);
    });
  });
}

async function sendOrderFromDash(id) {
  try {
    const result = await API.sendOrder(id);
    if (result.warnings && result.warnings.length > 0) {
      showToast(`⚠️ Stock insuffisant pour ${result.warnings.length} ingrédient(s)`, 'info');
    }
    showToast('Commande envoyée en cuisine', 'success');
    renderOrdersDashboard();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function cancelOrderFromDash(id) {
  if (!confirm('Annuler cette commande ?')) return;
  try {
    await API.cancelOrder(id);
    showToast('Commande annulée', 'success');
    renderOrdersDashboard();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function completeOrderFromDash(id) {
  try {
    await API.updateOrder(id, { status: 'terminé' });
    showToast('Commande terminée', 'success');
    renderOrdersDashboard();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── New Order ───
let orderItems = [];

async function renderNewOrder() {
  const app = document.getElementById('app');
  orderItems = [];

  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/orders" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Commandes</a>
        <h1 style="margin-top:4px">Nouvelle commande</h1>
      </div>
    </div>
    <div class="form-group">
      <label>Numéro de table</label>
      <input type="number" class="form-control" id="order-table" min="1" placeholder="1" style="max-width:120px">
    </div>
    <div class="section-title">Menu — Plats disponibles</div>
    <div id="menu-list"><div class="loading"><div class="spinner"></div></div></div>
    <div class="section-title">Commande</div>
    <div id="order-summary">
      <p class="text-muted" style="font-size:var(--text-sm)">Aucun plat sélectionné</p>
    </div>
    <div class="form-group" style="margin-top:16px">
      <label>Notes</label>
      <textarea class="form-control" id="order-notes" rows="2" placeholder="Allergies, demandes spéciales..."></textarea>
    </div>
    <div class="actions-row">
      <button class="btn btn-primary" id="btn-send-order" disabled>
        <i data-lucide="send" style="width:18px;height:18px"></i> Envoyer en cuisine
      </button>
      <button class="btn btn-secondary" id="btn-save-order" disabled>
        <i data-lucide="save" style="width:18px;height:18px"></i> Sauvegarder
      </button>
    </div>
  `;
  lucide.createIcons();

  // Load plats (only type 'plat')
  let recipes = [];
  try {
    recipes = await API.getRecipes();
    recipes = recipes.filter(r => (r.recipe_type || 'plat') === 'plat');
  } catch (e) {
    showToast('Erreur chargement menu', 'error');
  }

  const menuEl = document.getElementById('menu-list');
  if (recipes.length === 0) {
    menuEl.innerHTML = '<p class="text-muted">Aucun plat disponible. Créez des fiches techniques de type "Plat".</p>';
  } else {
    menuEl.innerHTML = `<div class="menu-grid">${recipes.map(r => `
      <div class="menu-card" data-id="${r.id}">
        <div class="menu-card__info">
          <span class="menu-card__name">${escapeHtml(r.name)}</span>
          <span class="menu-card__price mono">${r.selling_price ? formatCurrency(r.selling_price) : '—'}</span>
        </div>
        <div class="menu-card__actions">
          <button class="btn btn-sm btn-secondary menu-minus" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-price="${r.selling_price || 0}">−</button>
          <span class="menu-card__qty" id="menu-qty-${r.id}">0</span>
          <button class="btn btn-sm btn-primary menu-plus" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-price="${r.selling_price || 0}">+</button>
        </div>
      </div>
    `).join('')}</div>`;
  }

  // Menu +/- handlers
  menuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-plus, .menu-minus');
    if (!btn) return;

    const recipeId = Number(btn.dataset.id);
    const name = btn.dataset.name;
    const price = parseFloat(btn.dataset.price);
    const isPlus = btn.classList.contains('menu-plus');

    let existing = orderItems.find(i => i.recipe_id === recipeId);
    if (isPlus) {
      if (existing) {
        existing.quantity++;
      } else {
        orderItems.push({ recipe_id: recipeId, name, price, quantity: 1, notes: '' });
      }
    } else if (existing && existing.quantity > 0) {
      existing.quantity--;
      if (existing.quantity === 0) {
        orderItems = orderItems.filter(i => i.recipe_id !== recipeId);
      }
    }

    // Update qty display
    const qtyEl = document.getElementById(`menu-qty-${recipeId}`);
    const item = orderItems.find(i => i.recipe_id === recipeId);
    if (qtyEl) qtyEl.textContent = item ? item.quantity : '0';

    renderOrderSummary();
  });

  // Send / Save buttons
  document.getElementById('btn-send-order').addEventListener('click', async () => {
    await submitOrder(true);
  });
  document.getElementById('btn-save-order').addEventListener('click', async () => {
    await submitOrder(false);
  });
}

function renderOrderSummary() {
  const el = document.getElementById('order-summary');
  const sendBtn = document.getElementById('btn-send-order');
  const saveBtn = document.getElementById('btn-save-order');

  const active = orderItems.filter(i => i.quantity > 0);
  if (active.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:var(--text-sm)">Aucun plat sélectionné</p>';
    if (sendBtn) sendBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  if (sendBtn) sendBtn.disabled = false;
  if (saveBtn) saveBtn.disabled = false;

  let total = 0;
  el.innerHTML = active.map(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    return `
      <div class="order-summary-line">
        <span>${item.quantity}× ${escapeHtml(item.name)}</span>
        <span class="mono">${formatCurrency(subtotal)}</span>
      </div>
    `;
  }).join('') + `
    <div class="order-summary-total">
      <span style="font-weight:700">TOTAL</span>
      <span class="mono" style="font-weight:700;color:var(--color-accent)">${formatCurrency(total)}</span>
    </div>
  `;
}

async function submitOrder(sendImmediately) {
  const tableNumber = parseInt(document.getElementById('order-table').value);
  if (!tableNumber || tableNumber < 1) {
    showToast('Numéro de table requis', 'error');
    return;
  }

  const active = orderItems.filter(i => i.quantity > 0);
  if (active.length === 0) {
    showToast('Ajoutez au moins un plat', 'error');
    return;
  }

  try {
    const order = await API.createOrder({
      table_number: tableNumber,
      notes: document.getElementById('order-notes').value.trim() || null,
      items: active.map(i => ({
        recipe_id: i.recipe_id,
        quantity: i.quantity,
        notes: i.notes || null
      }))
    });

    if (sendImmediately) {
      const result = await API.sendOrder(order.id);
      if (result.warnings && result.warnings.length > 0) {
        showToast(`⚠️ Stock insuffisant pour ${result.warnings.length} ingrédient(s)`, 'info');
      }
      showToast('Commande envoyée en cuisine !', 'success');
    } else {
      showToast('Commande sauvegardée', 'success');
    }

    location.hash = '#/orders';
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── Kitchen View ───
let kitchenRefreshInterval = null;

async function renderKitchenView() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/orders" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Commandes</a>
        <h1 style="margin-top:4px">🍳 Cuisine</h1>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="renderKitchenView()"><i data-lucide="refresh-cw" style="width:16px;height:16px"></i></button>
    </div>
    <div id="kitchen-tickets"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  // Clear previous interval
  if (kitchenRefreshInterval) {
    clearInterval(kitchenRefreshInterval);
    kitchenRefreshInterval = null;
  }

  await loadKitchenTickets();

  // Auto-refresh every 15s
  kitchenRefreshInterval = setInterval(async () => {
    // Only refresh if still on kitchen view
    if (location.hash === '#/orders/kitchen') {
      await loadKitchenTickets();
    } else {
      clearInterval(kitchenRefreshInterval);
      kitchenRefreshInterval = null;
    }
  }, 15000);
}

async function loadKitchenTickets() {
  let orders = [];
  try {
    orders = await API.getOrders();
    // Show only envoyé and prêt orders
    orders = orders.filter(o => o.status === 'envoyé' || o.status === 'prêt');
    orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } catch (e) {
    return;
  }

  const el = document.getElementById('kitchen-tickets');
  if (!el) return;

  if (orders.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <h3>Pas de commande en attente</h3>
        <p>Les nouvelles commandes apparaîtront ici automatiquement.</p>
      </div>
    `;
    return;
  }

  el.innerHTML = `<div class="kitchen-grid">${orders.map(order => {
    const elapsed = getElapsedTime(order.created_at);
    const isReady = order.status === 'prêt';

    return `
      <div class="kitchen-ticket ${isReady ? 'kitchen-ticket--ready' : ''}">
        <div class="kitchen-ticket__header">
          <span class="kitchen-ticket__table">Table ${order.table_number}</span>
          <span class="kitchen-ticket__id">#${order.id}</span>
          <span class="kitchen-ticket__timer">${elapsed}</span>
        </div>
        ${order.notes ? `<div class="kitchen-ticket__notes">📌 ${escapeHtml(order.notes)}</div>` : ''}
        <div class="kitchen-ticket__items">
          ${order.items.map(item => {
            const itemStatusClass = item.status === 'prêt' ? 'kitchen-item--ready' :
              item.status === 'en_préparation' ? 'kitchen-item--cooking' : '';
            return `
              <div class="kitchen-item ${itemStatusClass}">
                <span class="kitchen-item__qty">${item.quantity}×</span>
                <span class="kitchen-item__name">${escapeHtml(item.recipe_name)}</span>
                ${item.notes ? `<span class="kitchen-item__notes">(${escapeHtml(item.notes)})</span>` : ''}
                <div class="kitchen-item__actions">
                  ${item.status === 'en_attente' ?
                    `<button class="btn btn-sm btn-secondary" onclick="updateKitchenItem(${order.id}, ${item.id}, 'en_préparation')">🔥 Prép.</button>` : ''}
                  ${item.status === 'en_préparation' ?
                    `<button class="btn btn-sm btn-primary" onclick="updateKitchenItem(${order.id}, ${item.id}, 'prêt')">✅ Prêt</button>` : ''}
                  ${item.status === 'prêt' ?
                    `<span class="badge badge-success">✅ Prêt</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

async function updateKitchenItem(orderId, itemId, status) {
  try {
    await API.updateOrderItem(orderId, itemId, { status });
    await loadKitchenTickets();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── Helpers ───
function getOrderStatusClass(status) {
  switch (status) {
    case 'en_cours': return 'pending';
    case 'envoyé': return 'sent';
    case 'prêt': return 'ready';
    case 'terminé': return 'done';
    case 'annulé': return 'cancelled';
    default: return 'pending';
  }
}

function getOrderStatusLabel(status) {
  switch (status) {
    case 'en_cours': return 'En cours';
    case 'envoyé': return 'Envoyée';
    case 'prêt': return 'Prête';
    case 'terminé': return 'Terminée';
    case 'annulé': return 'Annulée';
    default: return status;
  }
}

function getItemStatusIcon(status) {
  switch (status) {
    case 'en_attente': return '⏳';
    case 'en_préparation': return '🔥';
    case 'prêt': return '✅';
    case 'servi': return '🍽️';
    case 'annulé': return '❌';
    default: return '⏳';
  }
}

function getElapsedTime(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h${mins > 0 ? String(mins).padStart(2, '0') : ''}`;
}
