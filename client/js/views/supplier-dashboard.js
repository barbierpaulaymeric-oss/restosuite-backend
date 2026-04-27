// ═══════════════════════════════════════════
// Supplier portal — Tableau de bord (default landing tab).
//
// Five widgets: revenue total, order counts (this month / lifetime), active
// clients (≥1 order in last 30 days), 5 most recent orders, and pending
// alerts (status='envoyée' or 'brouillon'). Reads /api/supplier-portal/dashboard.
// ═══════════════════════════════════════════

async function renderSupplierDashboardTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Tableau de bord</h2>
      <p class="text-secondary" style="margin:var(--space-1) 0 0">Vue d'ensemble de votre activité.</p>
    </div>
    <div id="supplier-dashboard-body">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  let data;
  try {
    data = await API.getSupplierDashboard();
  } catch (e) {
    document.getElementById('supplier-dashboard-body').innerHTML =
      `<p class="text-danger">Erreur : ${escapeHtml(e.message)}</p>`;
    return;
  }

  const fmt = (n) => formatCurrency(Number(n) || 0);
  const dt = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const statusPill = (status) => {
    const map = {
      'brouillon': { label: 'Brouillon',  cls: 'pill--draft' },
      'envoyée':   { label: 'Envoyée',    cls: 'pill--sent'  },
      'envoyee':   { label: 'Envoyée',    cls: 'pill--sent'  },
      'confirmée': { label: 'Confirmée',  cls: 'pill--ok'    },
      'confirmee': { label: 'Confirmée',  cls: 'pill--ok'    },
      'livrée':    { label: 'Livrée',     cls: 'pill--ok'    },
      'livree':    { label: 'Livrée',     cls: 'pill--ok'    },
      'annulée':   { label: 'Annulée',    cls: 'pill--cancel'},
      'annulee':   { label: 'Annulée',    cls: 'pill--cancel'},
    };
    const m = map[status] || { label: status || '—', cls: 'pill--draft' };
    return `<span class="supplier-pill ${m.cls}">${escapeHtml(m.label)}</span>`;
  };

  document.getElementById('supplier-dashboard-body').innerHTML = `
    <div class="supplier-kpi-grid">
      <div class="supplier-kpi-card">
        <div class="supplier-kpi-card__label">CA total</div>
        <div class="supplier-kpi-card__value">${fmt(data.revenue_total)}</div>
        <div class="supplier-kpi-card__sub">Ce mois : ${fmt(data.revenue_this_month)}</div>
      </div>
      <div class="supplier-kpi-card">
        <div class="supplier-kpi-card__label">Commandes</div>
        <div class="supplier-kpi-card__value">${data.orders_total}</div>
        <div class="supplier-kpi-card__sub">Ce mois : ${data.orders_this_month}</div>
      </div>
      <div class="supplier-kpi-card">
        <div class="supplier-kpi-card__label">Clients actifs</div>
        <div class="supplier-kpi-card__value">${data.active_clients}</div>
        <div class="supplier-kpi-card__sub">Au cours des 30 derniers jours</div>
      </div>
      <div class="supplier-kpi-card supplier-kpi-card--alert">
        <div class="supplier-kpi-card__label">À confirmer</div>
        <div class="supplier-kpi-card__value">${data.pending_alerts.length}</div>
        <div class="supplier-kpi-card__sub">Commandes en attente</div>
      </div>
    </div>

    <div class="supplier-dashboard-grid">
      <section class="supplier-dashboard-block">
        <div class="supplier-dashboard-block__head">
          <h3>Dernières commandes</h3>
        </div>
        ${data.recent_orders.length === 0
          ? `<p class="text-secondary" style="padding:var(--space-3) 0">Aucune commande pour le moment.</p>`
          : `<ul class="supplier-dashboard-list">
              ${data.recent_orders.map(o => `
                <li>
                  <div class="supplier-dashboard-list__main">
                    <strong>${escapeHtml(o.reference || '—')}</strong>
                    <span class="text-secondary text-sm">${escapeHtml(o.restaurant_name || '—')}</span>
                  </div>
                  <div class="supplier-dashboard-list__side">
                    ${statusPill(o.status)}
                    <span class="text-mono">${fmt(o.total_amount)}</span>
                    <span class="text-tertiary text-sm">${dt(o.created_at)}</span>
                  </div>
                </li>
              `).join('')}
            </ul>`
        }
      </section>

      <section class="supplier-dashboard-block">
        <div class="supplier-dashboard-block__head">
          <h3>Alertes — à confirmer</h3>
        </div>
        ${data.pending_alerts.length === 0
          ? `<p class="text-secondary" style="padding:var(--space-3) 0">Tout est à jour. ✓</p>`
          : `<ul class="supplier-dashboard-list">
              ${data.pending_alerts.slice(0, 8).map(o => `
                <li>
                  <div class="supplier-dashboard-list__main">
                    <strong>${escapeHtml(o.reference || '—')}</strong>
                    <span class="text-secondary text-sm">${escapeHtml(o.restaurant_name || '—')}</span>
                  </div>
                  <div class="supplier-dashboard-list__side">
                    ${statusPill(o.status)}
                    <span class="text-mono">${fmt(o.total_amount)}</span>
                  </div>
                </li>
              `).join('')}
            </ul>`
        }
      </section>
    </div>
  `;
}
