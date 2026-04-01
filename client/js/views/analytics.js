// ═══════════════════════════════════════════
// RestoSuite AI — Analytics Dashboard
// ═══════════════════════════════════════════

async function renderAnalytics() {
  const app = document.getElementById('app');
  const account = getAccount();

  // Permission check
  const isGerant = account && account.role === 'gerant';
  const perms = account ? (typeof account.permissions === 'string' ? JSON.parse(account.permissions || '{}') : (account.permissions || {})) : {};
  const canView = isGerant || perms.view_costs;

  if (!canView) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <p>Accès réservé au gérant</p>
        <a href="#/" class="btn btn-primary">Retour</a>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="view-header">
      <h1>📊 Analytics</h1>
      <p class="text-secondary">Vue d'ensemble · Food cost · Stock · HACCP · IA</p>
    </div>
    <div class="analytics-loading">
      <div class="spinner"></div>
      <p class="text-secondary">Calcul des métriques…</p>
    </div>
  `;

  try {
    // Load all data in parallel
    const [kpis, foodCost, stockData, pricesData, haccpData, insightsData] = await Promise.all([
      API.getAnalyticsKPIs(),
      API.getAnalyticsFoodCost(),
      API.getAnalyticsStock(),
      API.getAnalyticsPrices(),
      API.getAnalyticsHACCP(),
      API.getAnalyticsInsights()
    ]);

    renderAnalyticsDashboard(kpis, foodCost, stockData, pricesData, haccpData, insightsData);
  } catch (e) {
    console.error('Analytics error:', e);
    app.innerHTML = `
      <div class="view-header">
        <h1>📊 Analytics</h1>
      </div>
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Erreur de chargement</p>
        <p class="text-secondary text-sm">${escapeHtml(e.message)}</p>
        <button class="btn btn-primary" onclick="renderAnalytics()">Réessayer</button>
      </div>
    `;
  }
}

function renderAnalyticsDashboard(kpis, foodCost, stockData, pricesData, haccpData, insightsData) {
  const app = document.getElementById('app');

  // HACCP compliance % for KPI
  const haccpTemp = kpis.haccp_compliance_today.temperatures;
  const haccpClean = kpis.haccp_compliance_today.cleaning;
  const haccpPct = (haccpTemp.total + haccpClean.total) > 0
    ? Math.round(((haccpTemp.done + haccpClean.done) / (haccpTemp.total + haccpClean.total)) * 100)
    : 100;

  // Active alerts
  const activeAlerts = kpis.low_stock_count + (haccpData.alerts_count_7d || 0);

  // Food cost color
  const fcClass = kpis.avg_food_cost_pct < 30 ? 'kpi--success' : kpis.avg_food_cost_pct <= 35 ? 'kpi--warning' : 'kpi--danger';

  app.innerHTML = `
    <div class="view-header">
      <h1>📊 Analytics</h1>
      <p class="text-secondary">Vue d'ensemble de votre établissement</p>
    </div>

    <!-- KPIs -->
    <div class="analytics-kpis">
      <div class="kpi-card ${fcClass} anim-fadeIn" style="--delay:0">
        <div class="kpi-icon">📊</div>
        <div class="kpi-value font-mono">${kpis.avg_food_cost_pct}%</div>
        <div class="kpi-label">Food Cost moyen</div>
        <div class="kpi-detail">${kpis.total_recipes} recettes</div>
      </div>
      <div class="kpi-card anim-fadeIn" style="--delay:1">
        <div class="kpi-icon">💰</div>
        <div class="kpi-value font-mono">${formatCurrency(kpis.total_stock_value)}</div>
        <div class="kpi-label">Valeur du stock</div>
        <div class="kpi-detail">${kpis.low_stock_count} alerte${kpis.low_stock_count > 1 ? 's' : ''}</div>
      </div>
      <div class="kpi-card ${haccpPct >= 90 ? 'kpi--success' : haccpPct >= 70 ? 'kpi--warning' : 'kpi--danger'} anim-fadeIn" style="--delay:2">
        <div class="kpi-icon">🌡️</div>
        <div class="kpi-value font-mono">${haccpPct}%</div>
        <div class="kpi-label">Conformité HACCP</div>
        <div class="kpi-detail">${haccpTemp.done}/${haccpTemp.total} temp · ${haccpClean.done}/${haccpClean.total} nett.</div>
      </div>
      <div class="kpi-card ${activeAlerts > 0 ? 'kpi--danger' : 'kpi--success'} anim-fadeIn" style="--delay:3">
        <div class="kpi-icon">⚠️</div>
        <div class="kpi-value font-mono">${activeAlerts}</div>
        <div class="kpi-label">Alertes actives</div>
        <div class="kpi-detail">${kpis.price_changes_30d} chgmt prix/30j</div>
      </div>
    </div>

    <!-- Section 1: Food Cost -->
    <section class="analytics-section anim-fadeIn" style="--delay:4">
      <h2>🍽️ Food Cost par recette</h2>
      ${foodCost.best_margin ? `
      <div class="analytics-highlights">
        <div class="highlight highlight--success">
          <span class="highlight-label">Meilleure marge</span>
          <span class="highlight-value">${escapeHtml(foodCost.best_margin.name)} — ${foodCost.best_margin.margin_pct}%</span>
        </div>
        <div class="highlight highlight--danger">
          <span class="highlight-label">Pire marge</span>
          <span class="highlight-value">${escapeHtml(foodCost.worst_margin.name)} — ${foodCost.worst_margin.margin_pct}%</span>
        </div>
      </div>
      ` : ''}
      <div class="analytics-distribution">
        <span class="dist-chip dist-chip--success">&lt;25% : ${foodCost.distribution.under_25}</span>
        <span class="dist-chip dist-chip--ok">25-30% : ${foodCost.distribution['25_30']}</span>
        <span class="dist-chip dist-chip--warning">30-35% : ${foodCost.distribution['30_35']}</span>
        <span class="dist-chip dist-chip--danger">&gt;35% : ${foodCost.distribution.over_35}</span>
      </div>
      <div class="food-cost-table">
        ${foodCost.recipes.length === 0 ? '<p class="text-secondary text-sm">Aucune recette avec prix de vente</p>' :
          foodCost.recipes
            .filter(r => r.food_cost_pct !== null)
            .sort((a, b) => b.food_cost_pct - a.food_cost_pct)
            .map(r => {
              const barColor = r.food_cost_pct < 25 ? 'var(--color-success)' : r.food_cost_pct < 30 ? '#2D8B55' : r.food_cost_pct < 35 ? 'var(--color-warning)' : 'var(--color-danger)';
              return `
              <div class="fc-row">
                <div class="fc-name">${escapeHtml(r.name)}</div>
                <div class="fc-bar-wrap">
                  <div class="fc-bar" style="width:${Math.min(r.food_cost_pct, 100)}%;background:${barColor}"></div>
                </div>
                <div class="fc-pct font-mono ${r.food_cost_pct > 35 ? 'text-danger' : r.food_cost_pct > 30 ? 'text-warning' : ''}">${r.food_cost_pct}%</div>
                <div class="fc-cost font-mono">${formatCurrency(r.cost)} → ${formatCurrency(r.selling_price)}</div>
              </div>`;
            }).join('')
        }
      </div>
    </section>

    <!-- Section 2: Stock -->
    <section class="analytics-section anim-fadeIn" style="--delay:5">
      <h2>📦 Stock</h2>
      <div class="analytics-row">
        <div class="analytics-col">
          <h3>Valeur par catégorie</h3>
          <div class="css-chart-h">
            ${stockData.categories.length === 0 ? '<p class="text-secondary text-sm">Aucune donnée</p>' :
              (() => {
                const maxVal = Math.max(...stockData.categories.map(c => c.value), 1);
                return stockData.categories.map(c => `
                  <div class="bar-h-row">
                    <span class="bar-h-label">${escapeHtml(c.name)}</span>
                    <div class="bar-h-track">
                      <div class="bar-h-fill" style="width:${(c.value / maxVal) * 100}%"></div>
                    </div>
                    <span class="bar-h-val font-mono">${formatCurrency(c.value)}</span>
                  </div>
                `).join('');
              })()
            }
          </div>
        </div>
        <div class="analytics-col">
          <h3>Top 5 consommés (30j)</h3>
          ${stockData.top_consumed.length === 0 ? '<p class="text-secondary text-sm">Aucun mouvement</p>' :
            `<div class="top-consumed-list">${stockData.top_consumed.map((t, i) => `
              <div class="consumed-item">
                <span class="consumed-rank">${i + 1}.</span>
                <span class="consumed-name">${escapeHtml(t.name)}</span>
                <span class="consumed-qty font-mono">${t.quantity}</span>
              </div>
            `).join('')}</div>`
          }
          ${stockData.alerts.length > 0 ? `
          <h3 style="margin-top:var(--space-4)">⚠️ Alertes stock bas</h3>
          <div class="stock-alerts-list">
            ${stockData.alerts.slice(0, 5).map(a => `
              <div class="stock-alert-item stock-alert--${a.urgency}">
                <span>${escapeHtml(a.name)}</span>
                <span class="font-mono">${a.current} / ${a.minimum}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
      </div>
      <div class="movements-summary">
        <span class="mvt-chip">📥 ${stockData.movements_summary.receptions} réceptions</span>
        <span class="mvt-chip">📤 ${stockData.movements_summary.losses} pertes</span>
        <span class="mvt-chip">🔧 ${stockData.movements_summary.adjustments} ajustements</span>
      </div>
    </section>

    <!-- Section 3: Prix Fournisseurs -->
    <section class="analytics-section anim-fadeIn" style="--delay:6">
      <h2>💲 Prix Fournisseurs</h2>
      <div class="analytics-row">
        <div class="analytics-col">
          <div class="inflation-indicator ${pricesData.inflation_30d > 0 ? 'inflation--up' : pricesData.inflation_30d < 0 ? 'inflation--down' : ''}">
            <span class="inflation-label">Inflation 30j</span>
            <span class="inflation-value font-mono">${pricesData.inflation_30d > 0 ? '+' : ''}${pricesData.inflation_30d}%</span>
          </div>
          <h3>Changements récents</h3>
          ${pricesData.recent_changes.length === 0 ? '<p class="text-secondary text-sm">Aucun changement</p>' :
            `<div class="price-changes-list">${pricesData.recent_changes.slice(0, 8).map(c => `
              <div class="price-change-item">
                <div class="pc-product">${escapeHtml(c.product)}</div>
                <div class="pc-supplier text-secondary text-sm">${escapeHtml(c.supplier || '')}</div>
                <div class="pc-change font-mono ${c.change_pct > 0 ? 'text-danger' : 'text-success'}">
                  ${c.change_pct > 0 ? '↑' : '↓'} ${Math.abs(c.change_pct)}%
                </div>
              </div>
            `).join('')}</div>`
          }
        </div>
        <div class="analytics-col">
          <h3>💡 Suggestions d'économies</h3>
          ${pricesData.suggestions.length === 0 ? '<p class="text-secondary text-sm">Aucune suggestion</p>' :
            `<div class="savings-list">${pricesData.suggestions.slice(0, 5).map(s => `
              <div class="savings-item">
                <div class="savings-product">${escapeHtml(s.product)}</div>
                <div class="savings-detail text-sm">
                  ${escapeHtml(s.current_supplier)} (${formatCurrency(s.current_price)})
                  → ${escapeHtml(s.cheaper_supplier)} (${formatCurrency(s.cheaper_price)})
                </div>
                <div class="savings-pct font-mono text-success">-${s.savings_pct}%</div>
              </div>
            `).join('')}</div>`
          }
        </div>
      </div>
    </section>

    <!-- Section 4: HACCP -->
    <section class="analytics-section anim-fadeIn" style="--delay:7">
      <h2>🛡️ HACCP Compliance</h2>
      <div class="analytics-row">
        <div class="analytics-col">
          <h3>Conformité 7 jours</h3>
          <div class="compliance-bars">
            <div class="compliance-row">
              <span class="compliance-label">Températures</span>
              <div class="compliance-track">
                <div class="compliance-fill ${haccpData.temperature_compliance_7d >= 90 ? 'fill--success' : haccpData.temperature_compliance_7d >= 70 ? 'fill--warning' : 'fill--danger'}" style="width:${haccpData.temperature_compliance_7d}%"></div>
              </div>
              <span class="compliance-val font-mono">${haccpData.temperature_compliance_7d}%</span>
            </div>
            <div class="compliance-row">
              <span class="compliance-label">Nettoyage</span>
              <div class="compliance-track">
                <div class="compliance-fill ${haccpData.cleaning_compliance_7d >= 90 ? 'fill--success' : haccpData.cleaning_compliance_7d >= 70 ? 'fill--warning' : 'fill--danger'}" style="width:${haccpData.cleaning_compliance_7d}%"></div>
              </div>
              <span class="compliance-val font-mono">${haccpData.cleaning_compliance_7d}%</span>
            </div>
          </div>
          ${haccpData.alerts_count_7d > 0 ? `<p class="text-danger text-sm" style="margin-top:var(--space-2)">⚠️ ${haccpData.alerts_count_7d} alerte(s) température sur 7j</p>` : ''}
        </div>
        <div class="analytics-col">
          <h3>7 derniers jours</h3>
          <div class="haccp-mini-chart">
            ${haccpData.daily_scores.slice(-7).map(d => {
              const score = d.temp_score !== null ? d.temp_score : (d.cleaning_score !== null ? d.cleaning_score : 0);
              const avg = [d.temp_score, d.cleaning_score].filter(s => s !== null);
              const avgScore = avg.length > 0 ? Math.round(avg.reduce((a, b) => a + b, 0) / avg.length) : 0;
              const barClass = avgScore >= 90 ? 'bar-v--success' : avgScore >= 70 ? 'bar-v--warning' : 'bar-v--danger';
              const day = new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3);
              return `
                <div class="bar-v-col">
                  <div class="bar-v-track">
                    <div class="bar-v-fill ${barClass}" style="height:${avgScore}%"></div>
                  </div>
                  <span class="bar-v-label">${day}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- Section 5: AI Insights -->
    <section class="analytics-section analytics-section--ai anim-fadeIn" style="--delay:8">
      <div class="ai-section-header">
        <h2>🧠 Insights IA</h2>
        <button class="btn btn-secondary btn-sm" id="refresh-insights-btn" onclick="refreshInsights()">
          <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Actualiser
        </button>
      </div>
      ${insightsData.cached_at ? `<p class="text-secondary text-sm" id="insights-timestamp">Dernière analyse : ${formatTimeAgo(insightsData.cached_at)}</p>` : ''}
      <div class="ai-insights-grid" id="ai-insights-grid">
        ${renderInsightCards(insightsData.insights)}
      </div>
    </section>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderInsightCards(insights) {
  if (!insights || insights.length === 0) {
    return '<p class="text-secondary">Aucun insight disponible</p>';
  }
  return insights.map(insight => {
    const iconMap = { info: 'ℹ️', warning: '⚠️', danger: '🚨' };
    const severityClass = insight.severity || 'info';
    return `
      <div class="insight-card insight-card--${severityClass}">
        <div class="insight-icon">${iconMap[severityClass] || 'ℹ️'}</div>
        <div class="insight-content">
          <span class="insight-type">${escapeHtml(insight.type || '')}</span>
          <p class="insight-message">${escapeHtml(insight.message)}</p>
        </div>
      </div>
    `;
  }).join('');
}

async function refreshInsights() {
  const btn = document.getElementById('refresh-insights-btn');
  const grid = document.getElementById('ai-insights-grid');
  const timestamp = document.getElementById('insights-timestamp');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite"></i> Analyse…';
  }

  try {
    const data = await API.getAnalyticsInsights(true);
    if (grid) grid.innerHTML = renderInsightCards(data.insights);
    if (timestamp) timestamp.textContent = `Dernière analyse : à l'instant`;
    showToast('Insights actualisés', 'success');
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Actualiser';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function formatTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}
