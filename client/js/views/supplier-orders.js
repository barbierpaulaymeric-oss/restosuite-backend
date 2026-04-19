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
      return `
        <div class="card supplier-order-card" data-id="${o.id}" style="padding:var(--space-4);margin-bottom:var(--space-3);border-left:4px solid ${s.color};border-radius:var(--radius-lg);background:var(--bg-elevated);cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${escapeHtml(o.reference || `Commande #${o.id}`)}</strong>
              <span class="text-secondary text-sm" style="margin-left:var(--space-2)">${escapeHtml(created)}</span>
            </div>
            <span class="badge" style="background:${s.color};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md)">
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

    content.innerHTML = `
      <div style="margin-bottom:var(--space-4)">
        <button class="btn btn-secondary btn-sm" id="back-supplier-orders">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
        </button>
      </div>
      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4);border-left:4px solid ${s.color};border-radius:var(--radius-lg);background:var(--bg-elevated)">
        <div style="display:flex;justify-content:space-between;align-items:center">
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
    `;

    if (window.lucide) lucide.createIcons();
    document.getElementById('back-supplier-orders').addEventListener('click', renderSupplierOrdersTab);
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}
