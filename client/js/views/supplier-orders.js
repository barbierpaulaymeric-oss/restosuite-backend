// ═══════════════════════════════════════════
// Supplier Orders — read-only view of purchase orders
// placed by the restaurant with this supplier
// ═══════════════════════════════════════════

const SUPPLIER_ORDER_STATUS = {
  brouillon:    { label: 'Brouillon',   color: '#94a3b8' },
  envoyée:      { label: 'À confirmer', color: '#E8722A' },
  confirmée:    { label: 'Confirmée',   color: '#4A90D9' },
  réceptionnée: { label: 'Réceptionnée',color: '#22c55e' },
  annulée:      { label: 'Annulée',     color: '#ef4444' }
};

async function renderSupplierOrdersTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Commandes reçues</h2>
    </div>
    <div id="supplier-orders-list">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  try {
    const orders = await API.getSupplierOrders();
    const list = document.getElementById('supplier-orders-list');
    if (!list) return;

    if (!orders || orders.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="inbox"></i></div>
          <p>Aucune commande</p>
          <p class="text-secondary text-sm">Les commandes du restaurant apparaîtront ici.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    list.innerHTML = orders.map(o => {
      const s = SUPPLIER_ORDER_STATUS[o.status] || { label: o.status, color: '#666' };
      const created = o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '';
      const expected = o.expected_delivery
        ? new Date(o.expected_delivery).toLocaleDateString('fr-FR')
        : null;
      // Cards surface the client restaurant name up-front so the supplier
      // can scan their queue without opening each order. The /orders endpoint
      // returns restaurant_name (INNER JOIN restaurants r ON r.id = po.restaurant_id),
      // so this should always be populated; we still fall back to
      // "Restaurant #<id>" when missing so the row never silently loses the
      // client identifier (recurring "name doesn't show" bug — having the row
      // ALWAYS render makes the difference between data + bundle out of sync
      // immediately visible at a glance).
      const clientLabel = o.restaurant_name
        || (o.restaurant_id ? `Restaurant #${o.restaurant_id}` : 'Client');
      return `
        <div class="card supplier-order-card" data-id="${o.id}" style="padding:var(--space-4);margin-bottom:var(--space-3);border-left:4px solid ${s.color};border-radius:var(--radius-lg);background:var(--bg-elevated);cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-3)">
            <div style="min-width:0">
              <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">
                <strong>${escapeHtml(o.reference || `Commande #${o.id}`)}</strong>
                <span class="text-secondary text-sm">${escapeHtml(created)}</span>
              </div>
              <div class="supplier-order-card__client" style="margin-top:4px;font-size:var(--text-sm);color:#1B2A4A;font-weight:500"><i data-lucide="utensils-crossed" style="width:14px;height:14px;margin-right:4px;vertical-align:-2px"></i>${escapeHtml(clientLabel)}</div>
            </div>
            <span class="badge" style="background:${s.color};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md);white-space:nowrap;flex-shrink:0">
              ${escapeHtml(s.label)}
            </span>
          </div>
          <div class="text-secondary text-sm" style="margin-top:var(--space-2)">
            ${o.total_amount ? `${formatCurrency(o.total_amount)}` : '—'}
            ${expected ? ` · Livraison prévue : ${escapeHtml(expected)}` : ''}
          </div>
        </div>
      `;
    }).join('');
    if (window.lucide) lucide.createIcons();

    list.querySelectorAll('.supplier-order-card').forEach(card => {
      card.addEventListener('click', () => showSupplierOrderDetail(Number(card.dataset.id)));
    });
  } catch (e) {
    const list = document.getElementById('supplier-orders-list');
    if (list) list.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

async function showSupplierOrderDetail(id) {
  const content = document.getElementById('supplier-content');
  if (!content) return;
  try {
    const order = await API.getSupplierOrder(id);
    const s = SUPPLIER_ORDER_STATUS[order.status] || { label: order.status, color: '#666' };

    // Pending statuses are the only ones for which Confirmer/Refuser show.
    const isPending = ['brouillon', 'envoyée', 'envoyee'].includes(order.status);
    // Confirmed-but-not-yet-delivered orders get the "Créer le BL" CTA so the
    // supplier can drop a delivery note pre-filled with this order's items
    // without retyping every line.
    const canCreateBl = ['confirmée', 'confirmee'].includes(order.status);
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-4)">
        <button class="btn btn-secondary btn-sm" id="back-supplier-orders">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
        </button>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="supplier-order-message">
            <i data-lucide="message-square" style="width:16px;height:16px"></i> Contacter le restaurant
          </button>
          <button class="btn btn-secondary btn-sm" id="supplier-order-pdf">
            <i data-lucide="download" style="width:16px;height:16px"></i> Télécharger PDF
          </button>
        </div>
      </div>
      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4);border-left:4px solid ${s.color};border-radius:var(--radius-lg);background:var(--bg-elevated)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap">
          <h2 style="margin:0;font-size:var(--text-xl)">${escapeHtml(order.reference || `Commande #${order.id}`)}</h2>
          <span class="badge" style="background:${s.color};color:white;padding:4px 10px;border-radius:var(--radius-md)">${escapeHtml(s.label)}</span>
        </div>
        <div class="text-secondary text-sm" style="margin-top:var(--space-2)">
          Créée le ${order.created_at ? escapeHtml(new Date(order.created_at).toLocaleDateString('fr-FR')) : '—'}
          ${order.expected_delivery ? ` · Livraison prévue : ${escapeHtml(new Date(order.expected_delivery).toLocaleDateString('fr-FR'))}` : ''}
        </div>
        ${order.notes ? `<p style="margin-top:var(--space-3);white-space:pre-wrap">${escapeHtml(order.notes)}</p>` : ''}
      </div>
      <h3 style="font-size:var(--text-lg);margin-bottom:var(--space-3)">Produits</h3>
      <div style="display:grid;gap:var(--space-2)">
        ${(order.items || []).map(it => `
          <div class="card" style="padding:var(--space-3);display:flex;justify-content:space-between;align-items:center;border-radius:var(--radius-md);background:var(--bg-elevated)">
            <div>
              <strong>${escapeHtml(it.product_name)}</strong>
              <div class="text-secondary text-sm">${it.quantity} ${escapeHtml(it.unit || '')}</div>
            </div>
            <div style="text-align:right;font-family:var(--font-mono)">
              ${it.unit_price != null ? formatCurrency(it.unit_price) + '/' + escapeHtml(it.unit || '') : '—'}
              <div class="text-secondary text-sm">${it.total_price != null ? formatCurrency(it.total_price) : ''}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:var(--space-4);text-align:right;font-size:var(--text-lg)">
        <strong>Total : ${order.total_amount != null ? formatCurrency(order.total_amount) : '—'}</strong>
      </div>
      ${isPending ? `
        <div class="supplier-order-actions">
          <button class="btn supplier-order-btn supplier-order-btn--confirm" id="supplier-order-confirm">
            <i data-lucide="check-circle" style="width:18px;height:18px"></i> Confirmer la commande
          </button>
          <button class="btn supplier-order-btn supplier-order-btn--refuse" id="supplier-order-refuse">
            <i data-lucide="x-circle" style="width:18px;height:18px"></i> Refuser la commande
          </button>
        </div>
      ` : ''}
      ${canCreateBl ? `
        <div class="supplier-order-actions">
          <button class="btn supplier-order-btn supplier-order-btn--create-bl" id="supplier-order-create-bl">
            <i data-lucide="package-plus" style="width:18px;height:18px"></i> Créer le bon de livraison
          </button>
        </div>
      ` : ''}
    `;

    if (window.lucide) lucide.createIcons();
    document.getElementById('back-supplier-orders').addEventListener('click', renderSupplierOrdersTab);

    document.getElementById('supplier-order-message').addEventListener('click', () => {
      // The supplier order has restaurant_id (the buyer); thread is keyed on that.
      if (typeof showSupplierMessageThread === 'function') {
        showSupplierMessageThread(order.restaurant_id, {
          related_to: 'order',
          related_id: order.id,
          ref: order.reference || `#${order.id}`,
        });
      }
    });

    document.getElementById('supplier-order-pdf').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await API.downloadSupplierOrderPdf(order.id);
      } catch (err) {
        showToast(err.message || 'Erreur téléchargement', 'error');
      } finally {
        btn.disabled = false;
      }
    });

    if (canCreateBl) {
      // "Créer le BL" — stash the order's items + restaurant for the
      // delivery-form to pre-fill, then switch to the Livraisons tab. The
      // form (in supplier-delivery.js) reads + clears the pending payload
      // on render. We use a module-global because the SPA tab nav doesn't
      // carry route state; this keeps the contract simple and explicit.
      document.getElementById('supplier-order-create-bl').addEventListener('click', () => {
        if (typeof setPendingDeliveryPrefill === 'function') {
          setPendingDeliveryPrefill({
            from_order_id: order.id,
            from_order_ref: order.reference || `#${order.id}`,
            restaurant_id: order.restaurant_id,
            items: (order.items || []).map(it => ({
              product_name: it.product_name,
              quantity: it.quantity,
              unit: it.unit,
              price_per_unit: it.unit_price,
            })),
          });
        }
        // Activate the Livraisons tab + render its form.
        const tabs = document.querySelectorAll('.supplier-nav__tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'deliveries'));
        if (typeof renderSupplierDeliveriesTab === 'function') renderSupplierDeliveriesTab();
        // The deliveries tab landing shows the list — explicitly open the
        // new-form because the user's intent is to immediately create a BL.
        if (typeof showNewDeliveryForm === 'function') {
          // Defer one frame so the tab DOM mounts before the form replaces it.
          setTimeout(() => showNewDeliveryForm(), 0);
        }
      });
    }

    if (isPending) {
      document.getElementById('supplier-order-confirm').addEventListener('click', () => {
        _supplierOrderActionPrompt({
          orderId: order.id,
          title: 'Confirmer la commande',
          body: `Confirmer la commande ${order.reference || `#${order.id}`} ?`,
          placeholder: 'Note pour le client (optionnel)',
          confirmLabel: 'Confirmer',
          confirmClass: 'btn supplier-order-btn--confirm',
          action: 'confirm',
        });
      });
      document.getElementById('supplier-order-refuse').addEventListener('click', () => {
        _supplierOrderActionPrompt({
          orderId: order.id,
          title: 'Refuser la commande',
          body: `Refuser la commande ${order.reference || `#${order.id}`} ?`,
          placeholder: 'Motif (recommandé)',
          confirmLabel: 'Refuser',
          confirmClass: 'btn supplier-order-btn--refuse',
          action: 'refuse',
        });
      });
    }
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

// Confirm/refuse modal — captures an optional reason then fires the matching
// API call. On success, refresh the badge (pending count just dropped) and
// re-render the detail so the supplier sees the new status without a manual
// reload.
function _supplierOrderActionPrompt({ orderId, title, body, placeholder, confirmLabel, confirmClass, action }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      <div class="form-group">
        <label>${escapeHtml(placeholder)}</label>
        <textarea id="supplier-order-reason" class="form-control" rows="3" maxlength="500" placeholder="${escapeHtml(placeholder)}" data-ui="custom"></textarea>
      </div>
      <div class="actions-row">
        <button class="${confirmClass}" id="supplier-order-action-confirm">${escapeHtml(confirmLabel)}</button>
        <button class="btn btn-secondary" id="supplier-order-action-cancel">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#supplier-order-action-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#supplier-order-action-confirm').onclick = async () => {
    const reason = document.getElementById('supplier-order-reason').value.trim();
    try {
      if (action === 'confirm') {
        await API.confirmSupplierOrder(orderId, reason);
        showToast('Commande confirmée', 'success');
      } else {
        await API.refuseSupplierOrder(orderId, reason);
        showToast('Commande refusée', 'success');
      }
      close();
      // Pending count just dropped — refresh the badge.
      if (typeof refreshSupplierOrdersBadge === 'function') refreshSupplierOrdersBadge();
      showSupplierOrderDetail(orderId);
    } catch (e) {
      showToast(e.message || 'Erreur', 'error');
    }
  };
  document.getElementById('supplier-order-reason').focus();
}
