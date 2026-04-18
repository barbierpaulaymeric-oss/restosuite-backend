// ═══════════════════════════════════════════
// Purchase Orders — Commandes fournisseurs
// ═══════════════════════════════════════════

// ─── Dashboard ───
async function renderOrdersDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section role="region" aria-label="Commandes fournisseurs">
    <div class="page-header">
      <h1>Commandes fournisseurs</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" id="btn-po-analytics" aria-label="Afficher les statistiques d'achat"><i data-lucide="bar-chart-3" style="width:16px;height:16px" aria-hidden="true"></i> Statistiques</button>
        <button class="btn btn-secondary" id="btn-suggest-orders" aria-label="Voir les suggestions de réapprovisionnement"><i data-lucide="lightbulb" style="width:16px;height:16px" aria-hidden="true"></i> Suggestions</button>
        <a href="#/orders/new" class="btn btn-primary" aria-label="Créer une nouvelle commande"><i data-lucide="plus" style="width:18px;height:18px" aria-hidden="true"></i> Nouvelle commande</a>
      </div>
    </div>
    <nav class="orders-subnav" role="tablist" aria-label="Filtrer les commandes par statut" style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto">
      <button class="haccp-subnav__link active" data-filter="" role="tab" aria-selected="true">Toutes</button>
      <button class="haccp-subnav__link" data-filter="brouillon" role="tab" aria-selected="false">Brouillon</button>
      <button class="haccp-subnav__link" data-filter="envoyée" role="tab" aria-selected="false">Envoyées</button>
      <button class="haccp-subnav__link" data-filter="confirmée" role="tab" aria-selected="false">Confirmées</button>
      <button class="haccp-subnav__link" data-filter="réceptionnée" role="tab" aria-selected="false">Réceptionnées</button>
      <button class="haccp-subnav__link" data-filter="annulée" role="tab" aria-selected="false">Annulées</button>
    </nav>
    <div id="orders-grid" role="region" aria-label="Liste des commandes" aria-live="polite" aria-busy="true"><div class="loading"><div class="spinner"></div></div></div>
    <div id="suggest-modal" class="hidden"></div>
    </section>
  `;
  lucide.createIcons();

  let allOrders = [];
  try {
    allOrders = await API.getPurchaseOrders();
  } catch (e) {
    showToast('Erreur chargement commandes', 'error');
  }

  const gridEl = document.getElementById('orders-grid');

  function renderOrders(filterStatus) {
    const orders = filterStatus
      ? allOrders.filter(o => o.status === filterStatus)
      : allOrders;

    gridEl.setAttribute('aria-busy', 'false');
    if (orders.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state" role="status">
          <div class="empty-icon" aria-hidden="true"><i data-lucide="package"></i></div>
          <h3>Aucune commande</h3>
          <p>Créez une nouvelle commande fournisseur pour commencer.</p>
          <a href="#/orders/new" class="btn btn-primary" aria-label="Créer une nouvelle commande">Nouvelle commande</a>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = `<div class="orders-table-grid">${orders.map(order => {
      const statusBadgeClass = getPOStatusBadgeClass(order.status);
      const statusLabel = getPOStatusLabel(order.status);
      const elapsed = getElapsedTime(order.created_at);
      const itemCount = (order.items || []).length;
      const totalAmount = (order.items || []).reduce((sum, item) => sum + (item.unit_price * item.quantity || 0), 0);

      let actionButtons = '';
      if (order.status === 'brouillon') {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="sendPurchaseOrder(${order.id})" aria-label="Envoyer la commande au fournisseur">Envoyer</button>
          <button class="btn btn-sm btn-secondary" aria-label="Modifier la commande" onclick="editPurchaseOrder(${order.id})"><i data-lucide="edit" style="width:14px;height:14px" aria-hidden="true"></i></button>
          <button class="btn btn-sm btn-danger" aria-label="Supprimer la commande" onclick="deletePurchaseOrderFromDash(${order.id})"><i data-lucide="trash-2" style="width:14px;height:14px" aria-hidden="true"></i></button>
        `;
      } else if (order.status === 'envoyée') {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="confirmPurchaseOrder(${order.id})" aria-label="Confirmer la réception">Confirmer</button>
          <button class="btn btn-sm btn-danger" aria-label="Annuler la commande" onclick="cancelPurchaseOrderFromDash(${order.id})"><i data-lucide="x" style="width:14px;height:14px" aria-hidden="true"></i></button>
        `;
      } else if (order.status === 'confirmée') {
        actionButtons = `
          <button class="btn btn-sm btn-primary" onclick="receivePurchaseOrderFromDash(${order.id})" aria-label="Réceptionner la commande">Réceptionner</button>
        `;
      }

      return `
        <div class="order-card" role="button" tabindex="0" aria-label="Ouvrir le détail de la commande ${escapeHtml(order.reference)}" style="cursor:pointer" onclick="location.hash='#/orders/${order.id}'" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();location.hash='#/orders/${order.id}';}">
          <div class="order-card__header">
            <span class="order-card__table" style="font-weight:600">${escapeHtml(order.reference)}</span>
            <span class="order-card__timer" aria-label="Créée il y a ${elapsed}">${elapsed}</span>
          </div>
          <div style="margin-bottom:8px">
            <span class="badge badge--info" style="background:#6366f1;color:white">${escapeHtml(order.supplier_name)}</span>
          </div>
          <span class="badge badge--${statusBadgeClass}">${statusLabel}</span>
          <div style="margin-top:8px;font-size:var(--text-sm);color:var(--text-secondary)">
            <div>${itemCount} article${itemCount > 1 ? 's' : ''}</div>
            <div style="font-weight:600;color:var(--text-primary);margin-top:4px">${formatCurrency(totalAmount)}</div>
          </div>
          <div class="order-card__actions" style="margin-top:12px">
            <a href="#/orders/${order.id}" class="btn btn-sm btn-secondary">Détail</a>
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('')}</div>`;
    lucide.createIcons();
  }

  renderOrders('');

  // Filter buttons
  document.querySelectorAll('.orders-subnav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.orders-subnav button').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      renderOrders(btn.dataset.filter);
    });
  });

  // Suggestions button
  document.getElementById('btn-suggest-orders').addEventListener('click', showSuggestionsModal);
  // Analytics button
  document.getElementById('btn-po-analytics').addEventListener('click', showPOAnalyticsModal);
}

// ─── Suggestions Modal ───
async function showSuggestionsModal() {
  const modalEl = document.getElementById('suggest-modal');
  modalEl.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="max-width:600px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2>Articles à réapprovisionner</h2>
          <button class="btn btn-sm btn-secondary" onclick="document.getElementById('suggest-modal').innerHTML=''"><i data-lucide="x" style="width:18px;height:18px"></i></button>
        </div>
        <div id="suggest-loading"><div class="spinner"></div></div>
      </div>
    </div>
  `;
  modalEl.classList.remove('hidden');
  lucide.createIcons();

  try {
    const suggestions = await API.getPurchaseOrderSuggestions();
    const loadingEl = document.getElementById('suggest-loading');

    if (!suggestions || suggestions.length === 0) {
      loadingEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="check-circle"></i></div>
          <p>Tous les stocks sont corrects. Aucun réapprovisionnement nécessaire.</p>
        </div>
      `;
      return;
    }

    // Group by supplier
    const bySupplier = {};
    for (const item of suggestions) {
      if (!bySupplier[item.supplier_id]) {
        bySupplier[item.supplier_id] = { name: item.supplier_name, items: [] };
      }
      bySupplier[item.supplier_id].items.push(item);
    }

    loadingEl.innerHTML = `
      ${Object.entries(bySupplier).map(([supplierId, group]) => `
        <div style="margin-bottom:20px;border:1px solid var(--border-color);border-radius:6px;padding:12px">
          <h4 style="margin-bottom:12px">${escapeHtml(group.name)}</h4>
          <table style="width:100%;font-size:var(--text-sm);border-collapse:collapse">
            <tbody>
              ${group.items.map(item => `
                <tr style="border-top:1px solid var(--border-color);padding:8px 0">
                  <td style="padding:8px">${escapeHtml(item.ingredient_name)}</td>
                  <td style="padding:8px;text-align:right">${item.current_quantity} ${escapeHtml(item.unit)} <span style="color:var(--text-secondary)">(min: ${item.min_quantity})</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="createPurchaseOrderFromSuggestions(${supplierId})">Créer la commande</button>
        </div>
      `).join('')}
    `;
  } catch (e) {
    document.getElementById('suggest-loading').innerHTML = `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

// ─── New Purchase Order ───
let _poItems = [];
let _poSelectedSupplierId = null;

async function renderNewOrder() {
  const app = document.getElementById('app');
  _poItems = [];
  _poSelectedSupplierId = null;

  let suppliers = [];
  let ingredients = [];
  try {
    suppliers = await API.getSuppliers();
    const ingredientsResponse = await API.getIngredients();
    ingredients = ingredientsResponse.ingredients || [];
  } catch (e) {
    showToast('Erreur chargement données', 'error');
  }

  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/orders" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Commandes</a>
        <h1 style="margin-top:4px">Nouvelle commande fournisseur</h1>
      </div>
    </div>

    <div style="max-width:800px">
      <div class="form-group">
        <label for="po-supplier">Fournisseur *</label>
        <select class="form-control" id="po-supplier" required aria-required="true">
          <option value="">— Sélectionner un fournisseur —</option>
          ${suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>

      <div class="section-title" id="section-ingredients">Ingrédients</div>
      <div id="ingredients-list" role="region" aria-labelledby="section-ingredients">
        <label for="ingredient-search" class="visually-hidden">Rechercher un ingrédient</label>
        <input type="search" class="form-control" id="ingredient-search" placeholder="Rechercher un ingrédient..." style="margin-bottom:12px" aria-label="Rechercher un ingrédient">
        <div id="ingredients-filtered" role="list" aria-label="Ingrédients disponibles" style="max-height:300px;overflow-y:auto;border:1px solid var(--border-color);border-radius:4px">
          ${ingredients.map(ing => `
            <div class="ingredient-item" data-id="${ing.id}" role="listitem" style="padding:8px 12px;border-bottom:1px solid var(--border-color);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
              <span>${escapeHtml(ing.name)}</span>
              <button type="button" class="btn btn-sm btn-primary" aria-label="Ajouter ${escapeHtml(ing.name)} à la commande">+</button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section-title" id="section-po-items" style="margin-top:20px">Articles de la commande</div>
      <div id="po-items-table" role="region" aria-labelledby="section-po-items" aria-live="polite" style="overflow-x:auto">
        <p class="text-muted">Aucun article pour le moment. Ajoutez des ingrédients ci-dessus.</p>
      </div>

      <div class="section-title" style="margin-top:20px">Total</div>
      <div style="font-size:1.5rem;font-weight:600;color:var(--color-accent);margin-bottom:20px">
        <span id="po-total">${formatCurrency(0)}</span>
      </div>

      <div class="actions-row">
        <button class="btn btn-primary" id="btn-send-po" disabled aria-label="Envoyer la commande au fournisseur">
          <i data-lucide="send" style="width:18px;height:18px" aria-hidden="true"></i> Envoyer
        </button>
        <button class="btn btn-secondary" id="btn-save-po" disabled aria-label="Sauvegarder la commande en brouillon">
          <i data-lucide="save" style="width:18px;height:18px" aria-hidden="true"></i> Sauvegarder en brouillon
        </button>
        <a href="#/orders" class="btn btn-secondary" aria-label="Annuler et retourner à la liste">Annuler</a>
      </div>
    </div>
  `;
  lucide.createIcons();

  const supplierSelect = document.getElementById('po-supplier');
  const ingredientSearch = document.getElementById('ingredient-search');
  const ingredientsFiltered = document.getElementById('ingredients-filtered');

  // Supplier selection
  supplierSelect.addEventListener('change', (e) => {
    _poSelectedSupplierId = e.target.value ? parseInt(e.target.value) : null;
    updatePOItemsDisplay();
  });

  // Ingredient search
  ingredientSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.ingredient-item');
    items.forEach(item => {
      const name = item.textContent.toLowerCase();
      item.style.display = name.includes(query) ? '' : 'none';
    });
  });

  // Add ingredient to order
  ingredientsFiltered.addEventListener('click', (e) => {
    const btn = e.target.closest('.ingredient-item button');
    if (!btn) return;

    const ingredientItem = e.target.closest('.ingredient-item');
    const ingredientId = parseInt(ingredientItem.dataset.id);
    const ingredientName = ingredientItem.textContent.trim();

    const existing = _poItems.find(i => i.ingredient_id === ingredientId);
    if (existing) {
      existing.quantity++;
    } else {
      _poItems.push({
        ingredient_id: ingredientId,
        name: ingredientName,
        quantity: 1,
        unit: 'unité',
        unit_price: 0
      });
    }

    updatePOItemsDisplay();
  });

  // Send / Save buttons
  document.getElementById('btn-send-po').addEventListener('click', async () => {
    await submitPurchaseOrder(true);
  });
  document.getElementById('btn-save-po').addEventListener('click', async () => {
    await submitPurchaseOrder(false);
  });
}

function updatePOItemsDisplay() {
  const itemsTableEl = document.getElementById('po-items-table');
  const sendBtn = document.getElementById('btn-send-po');
  const saveBtn = document.getElementById('btn-save-po');

  if (_poItems.length === 0) {
    itemsTableEl.innerHTML = '<p class="text-muted">Aucun article pour le moment. Ajoutez des ingrédients ci-dessus.</p>';
    if (sendBtn) sendBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  if (sendBtn) sendBtn.disabled = !_poSelectedSupplierId || _poItems.length === 0;
  if (saveBtn) saveBtn.disabled = !_poSelectedSupplierId || _poItems.length === 0;

  let total = 0;
  itemsTableEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
      <thead>
        <tr style="border-bottom:2px solid var(--border-color)">
          <th style="text-align:left;padding:8px">Article</th>
          <th style="text-align:right;padding:8px">Quantité</th>
          <th style="text-align:right;padding:8px">Unité</th>
          <th style="text-align:right;padding:8px">Prix unitaire</th>
          <th style="text-align:right;padding:8px">Total</th>
          <th style="text-align:center;padding:8px">Action</th>
        </tr>
      </thead>
      <tbody>
        ${_poItems.map((item, idx) => {
          const lineTotal = item.quantity * (item.unit_price || 0);
          total += lineTotal;
          return `
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:8px">${escapeHtml(item.name)}</td>
              <td style="padding:8px;text-align:right">
                <input type="number" class="form-control" style="max-width:80px" value="${item.quantity}" min="1" onchange="updatePOItemQuantity(${idx}, this.value)">
              </td>
              <td style="padding:8px;text-align:right">
                <input type="text" class="form-control" style="max-width:80px" value="${escapeHtml(item.unit)}" onchange="updatePOItemUnit(${idx}, this.value)">
              </td>
              <td style="padding:8px;text-align:right">
                <input type="number" class="form-control" style="max-width:100px" step="0.01" value="${item.unit_price || ''}" placeholder="0.00" onchange="updatePOItemPrice(${idx}, this.value)">
              </td>
              <td style="padding:8px;text-align:right;font-weight:600">${formatCurrency(lineTotal)}</td>
              <td style="padding:8px;text-align:center">
                <button class="btn btn-sm btn-danger" onclick="removePOItem(${idx})"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  const totalEl = document.getElementById('po-total');
  if (totalEl) totalEl.textContent = formatCurrency(total);

  lucide.createIcons();
}

function updatePOItemQuantity(idx, value) {
  _poItems[idx].quantity = parseInt(value) || 1;
  updatePOItemsDisplay();
}

function updatePOItemUnit(idx, value) {
  _poItems[idx].unit = value.trim() || 'unité';
  updatePOItemsDisplay();
}

function updatePOItemPrice(idx, value) {
  _poItems[idx].unit_price = parseFloat(value) || 0;
  updatePOItemsDisplay();
}

function removePOItem(idx) {
  _poItems.splice(idx, 1);
  updatePOItemsDisplay();
}

async function submitPurchaseOrder(sendImmediately) {
  if (!_poSelectedSupplierId) {
    showToast('Sélectionnez un fournisseur', 'error');
    return;
  }

  if (_poItems.length === 0) {
    showToast('Ajoutez au moins un article', 'error');
    return;
  }

  try {
    const po = await API.createPurchaseOrder({
      supplier_id: _poSelectedSupplierId,
      status: sendImmediately ? 'envoyée' : 'brouillon',
      items: _poItems.map(i => ({
        ingredient_id: i.ingredient_id,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price
      }))
    });

    showToast(sendImmediately ? 'Commande envoyée' : 'Commande sauvegardée', 'success');
    location.hash = '#/orders';
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function createPurchaseOrderFromSuggestions(supplierId) {
  try {
    const suggestions = await API.getPurchaseOrderSuggestions();
    const supplierSuggestions = suggestions.filter(s => s.supplier_id == supplierId);

    if (supplierSuggestions.length === 0) {
      showToast('Aucune suggestion pour ce fournisseur', 'error');
      return;
    }

    const items = supplierSuggestions.map(s => ({
      ingredient_id: s.ingredient_id,
      quantity: Math.max(s.min_quantity - s.current_quantity, 1),
      unit: s.unit,
      unit_price: s.supplier_price || 0
    }));

    const po = await API.createPurchaseOrder({
      supplier_id: supplierId,
      status: 'brouillon',
      items
    });

    showToast('Commande créée', 'success');
    document.getElementById('suggest-modal').innerHTML = '';
    location.hash = '#/orders';
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function editPurchaseOrder(id) {
  try {
    const po = await API.getPurchaseOrder(id);
    if (po.status !== 'brouillon') {
      showToast('Seules les brouillons peuvent être modifiés', 'error');
      return;
    }
    // Redirect to new order with pre-filled data
    // This would require a more complex implementation
    location.hash = '#/orders/' + id;
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ─── Order Detail ───
async function renderOrderDetail(id) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/orders" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Commandes</a>
        <h1 style="margin-top:4px" id="po-title">Chargement...</h1>
      </div>
    </div>
    <div id="po-detail"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  try {
    const po = await API.getPurchaseOrder(id);
    renderPODetail(po);
  } catch (e) {
    document.getElementById('po-detail').innerHTML = `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function renderPODetail(po) {
  const detailEl = document.getElementById('po-detail');
  const titleEl = document.getElementById('po-title');
  const statusLabel = getPOStatusLabel(po.status);
  const statusBadgeClass = getPOStatusBadgeClass(po.status);
  const totalAmount = (po.items || []).reduce((sum, item) => sum + (item.unit_price * item.quantity || 0), 0);

  titleEl.textContent = po.reference;

  let actionButtons = '';
  if (po.status === 'brouillon') {
    actionButtons = `
      <button class="btn btn-primary" onclick="sendPurchaseOrder(${po.id})"><i data-lucide="send" style="width:16px;height:16px"></i> Envoyer</button>
      <button class="btn btn-secondary" onclick="editPurchaseOrder(${po.id})"><i data-lucide="edit" style="width:16px;height:16px"></i> Modifier</button>
      <button class="btn btn-danger" onclick="deletePurchaseOrder(${po.id})"><i data-lucide="trash-2" style="width:16px;height:16px"></i> Supprimer</button>
    `;
  } else if (po.status === 'envoyée') {
    actionButtons = `
      <button class="btn btn-primary" onclick="confirmPurchaseOrder(${po.id})">Confirmer la réception</button>
      <button class="btn btn-danger" onclick="cancelPurchaseOrder(${po.id})">Annuler</button>
    `;
  } else if (po.status === 'confirmée') {
    actionButtons = `
      <button class="btn btn-primary" onclick="receivePurchaseOrderFromDash(${po.id})">Réceptionner</button>
    `;
  }

  detailEl.innerHTML = `
    <div style="max-width:900px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">Fournisseur</div>
          <div style="font-size:1.1rem;font-weight:500">${escapeHtml(po.supplier_name)}</div>
        </div>
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">Statut</div>
          <div><span class="badge badge--${statusBadgeClass}">${statusLabel}</span></div>
        </div>
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">Créée le</div>
          <div>${formatDateFR(po.created_at)}</div>
        </div>
        <div>
          <div class="text-muted" style="font-size:var(--text-sm)">Référence</div>
          <div>${escapeHtml(po.reference)}</div>
        </div>
      </div>

      <div class="section-title">Articles</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:var(--text-sm)">
        <thead>
          <tr style="border-bottom:2px solid var(--border-color)">
            <th style="text-align:left;padding:8px">Article</th>
            <th style="text-align:right;padding:8px">Quantité</th>
            <th style="text-align:right;padding:8px">Unité</th>
            <th style="text-align:right;padding:8px">Prix unitaire</th>
            <th style="text-align:right;padding:8px">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(po.items || []).map(item => {
            const lineTotal = item.quantity * (item.unit_price || 0);
            return `
              <tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:8px">${escapeHtml(item.ingredient_name)}</td>
                <td style="padding:8px;text-align:right">${item.quantity}</td>
                <td style="padding:8px;text-align:right">${escapeHtml(item.unit || '—')}</td>
                <td style="padding:8px;text-align:right">${formatCurrency(item.unit_price)}</td>
                <td style="padding:8px;text-align:right;font-weight:600">${formatCurrency(lineTotal)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;padding-top:12px;border-top:2px solid var(--border-color)">
        <div style="font-size:1.3rem;font-weight:700">
          Total : <span style="color:var(--color-accent)">${formatCurrency(totalAmount)}</span>
        </div>
      </div>

      <div class="actions-row">
        ${actionButtons}
        <button class="btn btn-secondary" onclick="clonePurchaseOrder(${po.id})"><i data-lucide="copy" style="width:16px;height:16px"></i> Dupliquer</button>
        <a href="#/orders" class="btn btn-secondary">Retour</a>
      </div>
    </div>
  `;
  lucide.createIcons();
}

// ─── Action handlers ───
async function sendPurchaseOrder(id) {
  showConfirmModal('Envoyer la commande', 'Êtes-vous sûr de vouloir envoyer cette commande au fournisseur ?', async () => {
    try {
      await API.updatePurchaseOrder(id, { status: 'envoyée' });
      showToast('Commande envoyée', 'success');
      location.hash = '#/orders';
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  }, { confirmText: 'Envoyer', confirmClass: 'btn btn-primary' });
  return;
}

async function confirmPurchaseOrder(id) {
  showConfirmModal('Confirmer la réception', 'Êtes-vous sûr de vouloir confirmer la réception de cette commande ?', async () => {
    try {
      await API.updatePurchaseOrder(id, { status: 'confirmée' });
      showToast('Commande confirmée', 'success');
      location.hash = '#/orders';
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  }, { confirmText: 'Confirmer', confirmClass: 'btn btn-primary' });
  return;
}

async function receivePurchaseOrderFromDash(id) {
  try {
    const po = await API.getPurchaseOrder(id);
    if (po.status !== 'confirmée') {
      showToast('Seules les commandes confirmées peuvent être réceptionnées', 'error');
      return;
    }

    // Create stock reception entries for each item
    const receptionData = {
      items: (po.items || []).map(item => ({
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
        unit: item.unit,
        batch_number: '',
        dlc: null
      }))
    };

    await API.receivePurchaseOrder(id, receptionData);
    await API.updatePurchaseOrder(id, { status: 'réceptionnée' });
    showToast('Commande réceptionnée et stock mis à jour', 'success');
    location.hash = '#/orders';
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function cancelPurchaseOrderFromDash(id) {
  showConfirmModal('Annuler la commande', 'Êtes-vous sûr de vouloir annuler cette commande ?', async () => {
    try {
      await API.updatePurchaseOrder(id, { status: 'annulée' });
      showToast('Commande annulée', 'success');
      renderOrdersDashboard();
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  }, { confirmText: 'Annuler', confirmClass: 'btn btn-danger' });
  return;
}

async function deletePurchaseOrderFromDash(id) {
  showConfirmModal('Supprimer la commande', 'Êtes-vous sûr de vouloir supprimer cette commande ?', async () => {
    try {
      await API.deletePurchaseOrder(id);
      showToast('Commande supprimée', 'success');
      renderOrdersDashboard();
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
  return;
}

async function deletePurchaseOrder(id) {
  showConfirmModal('Supprimer la commande', 'Êtes-vous sûr de vouloir supprimer cette commande ?', async () => {
    try {
      await API.deletePurchaseOrder(id);
      showToast('Commande supprimée', 'success');
      location.hash = '#/orders';
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
  return;
}

async function cancelPurchaseOrder(id) {
  showConfirmModal('Annuler la commande', 'Êtes-vous sûr de vouloir annuler cette commande ?', async () => {
    try {
      await API.updatePurchaseOrder(id, { status: 'annulée' });
      showToast('Commande annulée', 'success');
      location.hash = '#/orders';
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  }, { confirmText: 'Annuler', confirmClass: 'btn btn-danger' });
  return;
}

// ─── Helpers ───
function getPOStatusBadgeClass(status) {
  switch (status) {
    case 'brouillon': return 'secondary';
    case 'envoyée': return 'info';
    case 'confirmée': return 'warning';
    case 'réceptionnée': return 'success';
    case 'annulée': return 'danger';
    default: return 'secondary';
  }
}

function getPOStatusLabel(status) {
  switch (status) {
    case 'brouillon': return 'Brouillon';
    case 'envoyée': return 'Envoyée';
    case 'confirmée': return 'Confirmée';
    case 'réceptionnée': return 'Réceptionnée';
    case 'annulée': return 'Annulée';
    default: return status;
  }
}

function getOrderStatusClass(status) {
  // Kept for backward compatibility with service.js
  return getPOStatusBadgeClass(status);
}

function getOrderStatusLabel(status) {
  // Kept for backward compatibility with service.js
  return getPOStatusLabel(status);
}

function getItemStatusIcon(status) {
  // Kept for backward compatibility with service.js
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

// ═══════════════════════════════════════════
// Clone Purchase Order
// ═══════════════════════════════════════════
async function clonePurchaseOrder(id) {
  try {
    const cloned = await API.clonePurchaseOrder(id);
    showToast('Commande dupliquée — brouillon créé', 'success');
    location.hash = `#/orders/${cloned.id}`;
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════
// Purchase Order Analytics Modal
// ═══════════════════════════════════════════
async function showPOAnalyticsModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:700px;max-height:80vh;overflow-y:auto;padding:var(--space-5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
        <h2 style="margin:0"><i data-lucide="bar-chart-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Statistiques d'achat</h2>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div id="po-analytics-content"><div class="loading"><div class="spinner"></div></div></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  try {
    const data = await API.getPurchaseOrderAnalytics(60);
    const el = document.getElementById('po-analytics-content');
    if (!el) return;

    el.innerHTML = `
      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-accent)">${data.overall.total_orders}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Commandes</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-accent)">${formatCurrency(data.overall.total_spent)}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Total achats</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700">${formatCurrency(data.overall.avg_order)}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Panier moyen</div>
        </div>
        <div style="text-align:center;padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md)">
          <div style="font-size:var(--text-xl);font-weight:700">${data.overall.avg_lead_time_days ? data.overall.avg_lead_time_days + 'j' : '—'}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Délai moyen</div>
        </div>
      </div>

      <!-- By supplier -->
      ${data.by_supplier.length > 0 ? `
      <h3 style="font-size:var(--text-sm);margin-bottom:var(--space-2)">Dépenses par fournisseur</h3>
      <div style="margin-bottom:var(--space-4)">
        ${data.by_supplier.map(s => {
          const pct = data.overall.total_spent > 0 ? Math.round(s.total_spent / data.overall.total_spent * 100) : 0;
          return `
            <div style="display:flex;align-items:center;gap:var(--space-2);padding:8px 0;border-bottom:1px solid var(--border-light)">
              <span style="flex:1;font-weight:500;font-size:var(--text-sm)">${escapeHtml(s.supplier_name)}</span>
              <span style="font-size:var(--text-sm);color:var(--text-secondary)">${s.order_count} cmd</span>
              <div style="width:100px;height:8px;background:var(--bg-sunken);border-radius:4px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:var(--color-accent);border-radius:4px"></div>
              </div>
              <span style="font-weight:600;font-size:var(--text-sm);min-width:80px;text-align:right">${formatCurrency(s.total_spent)}</span>
            </div>
          `;
        }).join('')}
      </div>
      ` : ''}

      <!-- Top items -->
      ${data.top_items.length > 0 ? `
      <h3 style="font-size:var(--text-sm);margin-bottom:var(--space-2)">Top articles achetés</h3>
      <div style="max-height:200px;overflow-y:auto;margin-bottom:var(--space-4)">
        ${data.top_items.slice(0, 10).map(item => `
          <div style="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:var(--text-sm)">
            <span style="flex:1;font-weight:500">${escapeHtml(item.ingredient_name || 'Inconnu')}</span>
            <span style="color:var(--text-secondary);margin-right:12px">${item.total_qty} ${item.unit || ''}</span>
            <span style="font-weight:600">${formatCurrency(item.total_spent)}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div style="font-size:var(--text-xs);color:var(--text-tertiary);text-align:center;margin-top:var(--space-3)">
        Période : ${data.period_days} derniers jours · ${data.overall.supplier_count} fournisseur(s) actif(s)
      </div>
    `;
  } catch (e) {
    const el = document.getElementById('po-analytics-content');
    if (el) el.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
