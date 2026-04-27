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
      <div class="supplier-kpi-card" title="Revenus issus des commandes confirmées et livrées (statuts confirmée + livrée). Hors brouillons, commandes envoyées non confirmées, refusées et annulées.">
        <div class="supplier-kpi-card__label">CA confirmé</div>
        <div class="supplier-kpi-card__value">${fmt(data.revenue_total)}</div>
        <div class="supplier-kpi-card__sub">Ce mois : ${fmt(data.revenue_this_month)}</div>
      </div>
      <div class="supplier-kpi-card" title="Total tous statuts confondus (inclut brouillons et commandes en attente de confirmation). Vue alignée avec l'historique.">
        <div class="supplier-kpi-card__label">CA total (tous statuts)</div>
        <div class="supplier-kpi-card__value">${fmt(data.revenue_total_all)}</div>
        <div class="supplier-kpi-card__sub">Ce mois : ${fmt(data.revenue_this_month_all)}</div>
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

    <section class="supplier-dashboard-block" style="margin-top:var(--space-5)" id="supplier-stats-host">
      <div class="supplier-dashboard-block__head">
        <h3>Statistiques de vente</h3>
        <span class="text-tertiary text-sm">Sur l'historique des commandes</span>
      </div>
      <div id="supplier-stats-body"><div class="loading"><div class="spinner"></div></div></div>
    </section>
  `;

  // Stats load is deferred — keeps the dashboard interactive instantly while
  // the bigger /stats query runs.
  _loadSupplierStats();
}

async function _loadSupplierStats() {
  const host = document.getElementById('supplier-stats-body');
  if (!host) return;
  let stats;
  try {
    stats = await API.getSupplierStats();
  } catch (e) {
    host.innerHTML = `<p class="text-secondary">Statistiques indisponibles : ${escapeHtml(e.message)}</p>`;
    return;
  }

  const fmt = (n) => formatCurrency(Number(n) || 0);
  const FR_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const monthLabel = (yyyymm) => {
    const [y, m] = String(yyyymm).split('-');
    return `${FR_MONTHS[Number(m) - 1] || m} ${String(y).slice(2)}`;
  };

  // CSS-based bar charts (no chart library — keeps the bundle small and CSP-clean).
  const monthMax = stats.revenue_by_month.reduce((m, r) => Math.max(m, Number(r.revenue) || 0), 0) || 1;
  const catMax = stats.revenue_by_category.reduce((m, r) => Math.max(m, Number(r.revenue) || 0), 0) || 1;

  // Top products — colored category-style category-agnostic palette by index.
  const PRODUCT_COLORS = ['#4A90D9', '#38A169', '#DD6B20', '#805AD5', '#319795', '#D69E2E', '#9C4221', '#C53030', '#319795', '#718096'];

  if (!stats.top_products.length && !stats.revenue_by_month.length && !stats.revenue_by_category.length) {
    host.innerHTML = `<p class="text-secondary" style="padding:var(--space-3) 0">Pas encore de données — les statistiques apparaîtront dès vos premières commandes.</p>`;
    return;
  }

  host.innerHTML = `
    <div class="supplier-stats-grid">
      <div class="supplier-stats-block">
        <h4 class="supplier-stats-title">Top 10 produits</h4>
        ${stats.top_products.length === 0
          ? `<p class="text-secondary text-sm">Aucun produit vendu.</p>`
          : `<ul class="supplier-stats-bars">
              ${stats.top_products.map((p, i) => {
                const pct = (Number(p.revenue) || 0) / (Number(stats.top_products[0].revenue) || 1) * 100;
                const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length];
                return `
                  <li>
                    <div class="supplier-stats-bar-row">
                      <span class="supplier-stats-bar-label" title="${escapeHtml(p.product_name)}">${escapeHtml(p.product_name)}</span>
                      <span class="supplier-stats-bar-value text-mono">${fmt(p.revenue)}</span>
                    </div>
                    <div class="supplier-stats-bar-track">
                      <div class="supplier-stats-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
                    </div>
                  </li>`;
              }).join('')}
            </ul>`
        }
      </div>

      <div class="supplier-stats-block">
        <h4 class="supplier-stats-title">CA par mois (12 derniers)</h4>
        ${stats.revenue_by_month.length === 0
          ? `<p class="text-secondary text-sm">Aucune commande sur les 12 derniers mois.</p>`
          : `<div class="supplier-stats-month-bars">
              ${stats.revenue_by_month.map(m => {
                const h = (Number(m.revenue) || 0) / monthMax * 100;
                return `
                  <div class="supplier-stats-month-bar" title="${escapeHtml(monthLabel(m.month))} — ${fmt(m.revenue)} (${m.orders_count} cmd)">
                    <div class="supplier-stats-month-bar__fill" style="height:${h.toFixed(1)}%"></div>
                    <span class="supplier-stats-month-bar__label">${escapeHtml(monthLabel(m.month))}</span>
                  </div>`;
              }).join('')}
            </div>`
        }
      </div>

      <div class="supplier-stats-block">
        <h4 class="supplier-stats-title">CA par catégorie</h4>
        ${stats.revenue_by_category.length === 0
          ? `<p class="text-secondary text-sm">Aucune catégorie avec des ventes.</p>`
          : `<ul class="supplier-stats-bars">
              ${stats.revenue_by_category.map((c, i) => {
                const pct = (Number(c.revenue) || 0) / catMax * 100;
                const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length];
                return `
                  <li>
                    <div class="supplier-stats-bar-row">
                      <span class="supplier-stats-bar-label">${escapeHtml(c.category)}</span>
                      <span class="supplier-stats-bar-value text-mono">${fmt(c.revenue)}</span>
                    </div>
                    <div class="supplier-stats-bar-track">
                      <div class="supplier-stats-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
                    </div>
                  </li>`;
              }).join('')}
            </ul>`
        }
      </div>
    </div>
  `;
}
