// ═══════════════════════════════════════════
// Supplier portal — Mes clients (restaurant portfolio).
//
// Two views in one tab:
//   1. List view: every restaurant linked to this supplier with order count,
//      last order date, total revenue, average order value.
//   2. Detail view: clicking a card drills into a single restaurant — order
//      history table, summary KPIs, frequency, and top-5 favorite products.
// ═══════════════════════════════════════════

async function renderSupplierClientsTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Mes clients</h2>
      <p class="text-secondary" style="margin:var(--space-1) 0 0">Restaurants qui commandent vos produits.</p>
    </div>
    <div id="supplier-clients-body">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  let clients;
  try {
    clients = await API.getSupplierClients();
  } catch (e) {
    document.getElementById('supplier-clients-body').innerHTML =
      `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
    return;
  }

  const body = document.getElementById('supplier-clients-body');
  const fmtCurrency = (n) => formatCurrency(Number(n) || 0);
  const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!clients.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="users"></i></div>
        <p>Aucun restaurant lié pour l'instant.</p>
        <p class="text-secondary text-sm">Les restaurants apparaîtront ici dès qu'ils passeront leur première commande chez vous.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  body.innerHTML = `
    <div class="supplier-clients-grid">
      ${clients.map(c => `
        <button type="button" class="supplier-client-card" data-rid="${c.restaurant_id}">
          <div class="supplier-client-card__head">
            <div>
              <div class="supplier-client-card__name">${escapeHtml(c.restaurant_name || '—')}</div>
              <div class="text-secondary text-sm">
                ${c.restaurant_city ? escapeHtml(c.restaurant_city) : ''}
                ${c.restaurant_phone ? ` · ${escapeHtml(c.restaurant_phone)}` : ''}
              </div>
            </div>
            <div class="supplier-client-card__count">
              <span class="supplier-client-card__count-num">${c.orders_count}</span>
              <span class="text-tertiary text-sm">commande${c.orders_count > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div class="supplier-client-card__metrics">
            <div>
              <div class="text-tertiary text-sm">CA total</div>
              <div class="supplier-client-card__metric-value">${fmtCurrency(c.total_revenue)}</div>
            </div>
            <div>
              <div class="text-tertiary text-sm">Panier moyen</div>
              <div class="supplier-client-card__metric-value">${fmtCurrency(c.avg_order_value)}</div>
            </div>
            <div>
              <div class="text-tertiary text-sm">Dernière commande</div>
              <div class="supplier-client-card__metric-value">${fmtDate(c.last_order_at)}</div>
            </div>
          </div>
        </button>
      `).join('')}
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  body.querySelectorAll('.supplier-client-card').forEach(card => {
    card.addEventListener('click', () => {
      const rid = Number(card.dataset.rid);
      if (Number.isFinite(rid)) renderSupplierClientDetail(rid);
    });
  });
}

async function renderSupplierClientDetail(restaurantId) {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="margin-bottom:var(--space-3)">
      <button class="btn btn-secondary btn-sm" id="supplier-client-back">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
      </button>
    </div>
    <div id="supplier-client-detail">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  document.getElementById('supplier-client-back').addEventListener('click', renderSupplierClientsTab);

  let detail;
  try {
    detail = await API.getSupplierClient(restaurantId);
  } catch (e) {
    document.getElementById('supplier-client-detail').innerHTML =
      `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
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
      'confirmée': 'pill--ok',   'confirmee': 'pill--ok', 'livrée': 'pill--ok', 'livree': 'pill--ok',
      'annulée': 'pill--cancel', 'annulee': 'pill--cancel',
    };
    return `<span class="supplier-pill ${map[status] || 'pill--draft'}">${escapeHtml(status || '—')}</span>`;
  };

  const r = detail.restaurant;
  const s = detail.summary;

  document.getElementById('supplier-client-detail').innerHTML = `
    <div class="supplier-client-detail__head">
      <div>
        <h2 style="margin:0;font-size:var(--text-2xl)">${escapeHtml(r.name)}</h2>
        <p class="text-secondary" style="margin:var(--space-1) 0 0">
          ${[r.address, r.postal_code, r.city].filter(Boolean).map(escapeHtml).join(' · ') || '—'}
          ${r.phone ? ` · ${escapeHtml(r.phone)}` : ''}
        </p>
      </div>
    </div>

    <div class="supplier-kpi-grid" style="margin-top:var(--space-4)">
      <div class="supplier-kpi-card">
        <div class="supplier-kpi-card__label">CA total</div>
        <div class="supplier-kpi-card__value">${fmtCurrency(s.total_revenue)}</div>
      </div>
      <div class="supplier-kpi-card">
        <div class="supplier-kpi-card__label">Commandes</div>
        <div class="supplier-kpi-card__value">${s.orders_count}</div>
      </div>
      <div class="supplier-kpi-card">
        <div class="supplier-kpi-card__label">Panier moyen</div>
        <div class="supplier-kpi-card__value">${fmtCurrency(s.avg_order_value)}</div>
      </div>
      <div class="supplier-kpi-card">
        <div class="supplier-kpi-card__label">Fréquence</div>
        <div class="supplier-kpi-card__value">${detail.frequency_days != null ? `${detail.frequency_days} j` : '—'}</div>
        <div class="supplier-kpi-card__sub">Dernière : ${fmtDate(s.last_order_at)}</div>
      </div>
    </div>

    <section class="supplier-dashboard-block" style="margin-top:var(--space-5)">
      <div class="supplier-dashboard-block__head"><h3>Produits favoris</h3></div>
      ${detail.favorites.length === 0
        ? `<p class="text-secondary" style="padding:var(--space-3) 0">Aucun produit récurrent encore.</p>`
        : `<ul class="supplier-dashboard-list">
            ${detail.favorites.map(f => `
              <li>
                <div class="supplier-dashboard-list__main">
                  <strong>${escapeHtml(f.product_name)}</strong>
                  <span class="text-secondary text-sm">${f.times_ordered} commande${f.times_ordered > 1 ? 's' : ''} · ${f.total_quantity} u</span>
                </div>
                <div class="supplier-dashboard-list__side">
                  <span class="text-mono">${fmtCurrency(f.total_spent)}</span>
                </div>
              </li>
            `).join('')}
          </ul>`
      }
    </section>

    <section class="supplier-dashboard-block" style="margin-top:var(--space-5)">
      <div class="supplier-dashboard-block__head"><h3>Historique des commandes</h3></div>
      ${detail.orders.length === 0
        ? `<p class="text-secondary" style="padding:var(--space-3) 0">Aucune commande pour ce client.</p>`
        : `<div class="supplier-orders-table-wrap">
            <table class="supplier-orders-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th style="text-align:right">Montant</th>
                </tr>
              </thead>
              <tbody>
                ${detail.orders.map(o => `
                  <tr data-order-id="${o.id}">
                    <td><strong>${escapeHtml(o.reference || `#${o.id}`)}</strong></td>
                    <td>${fmtDate(o.created_at)}</td>
                    <td>${statusPill(o.status)}</td>
                    <td style="text-align:right" class="text-mono">${fmtCurrency(o.total_amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
      }
    </section>
  `;
  if (window.lucide) lucide.createIcons();

  document.querySelectorAll('.supplier-orders-table tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      const id = Number(row.dataset.orderId);
      if (Number.isFinite(id)) showSupplierClientOrderDetail(restaurantId, id);
    });
  });
}

async function showSupplierClientOrderDetail(restaurantId, orderId) {
  let order;
  try {
    order = await API.getSupplierClientOrder(restaurantId, orderId);
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }
  const fmtCurrency = (n) => formatCurrency(Number(n) || 0);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:720px">
      <h2>Commande ${escapeHtml(order.reference || `#${order.id}`)}</h2>
      <p class="text-secondary" style="margin:0 0 var(--space-3)">
        ${escapeHtml(order.restaurant_name || '')}
        ${order.created_at ? ` · ${new Date(order.created_at).toLocaleString('fr-FR')}` : ''}
      </p>
      <div class="supplier-orders-table-wrap">
        <table class="supplier-orders-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Qté</th>
              <th>Unité</th>
              <th style="text-align:right">Prix unitaire</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(it => `
              <tr>
                <td>${escapeHtml(it.product_name)}</td>
                <td class="text-mono">${it.quantity}</td>
                <td>${escapeHtml(it.unit || '')}</td>
                <td style="text-align:right" class="text-mono">${fmtCurrency(it.unit_price)}</td>
                <td style="text-align:right" class="text-mono">${fmtCurrency(it.total_price)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-3);font-weight:600">
        <span>Total HT</span>
        <span class="text-mono">${fmtCurrency(order.total_amount)}</span>
      </div>
      <div class="actions-row">
        <button class="btn btn-secondary" id="supplier-order-detail-close">Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#supplier-order-detail-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}
