// ═══════════════════════════════════════════
// RestoSuite — Pilotage (Analytics + Santé fusionnés)
// ═══════════════════════════════════════════

async function renderAnalytics() {
  const app = document.getElementById('app');
  let account = getAccount();

  // Stale-localStorage refresh: if the cached account is missing role or
  // permissions (saw this in test rounds — user logged in as gérant but the
  // Pilotage page reported "Accès réservé au gérant" because the stored
  // copy had been written by an older login flow that omitted those
  // fields). Pull the canonical shape from /auth/me before deciding access.
  // /auth/me uses the strict 401 path — a real expired session takes the
  // user to /login here, which is the right outcome.
  function _readPerms(a) {
    if (!a) return {};
    return typeof a.permissions === 'string'
      ? (JSON.parse(a.permissions || '{}') || {})
      : (a.permissions || {});
  }
  const _staleAccount = !account || !account.role || account.permissions == null;
  if (_staleAccount) {
    try {
      const me = await API.getMe();
      if (me && me.account) {
        try { localStorage.setItem('restosuite_account', JSON.stringify(me.account)); } catch {}
        account = me.account;
      }
    } catch (_) { /* /auth/me will have triggered the global cleanup if dead */ }
  }

  const isGerant = account && account.role === 'gerant';
  const perms = _readPerms(account);
  const canView = isGerant || perms.view_costs;

  if (!canView) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="lock"></i></div>
        <p>Accès réservé au gérant</p>
        <a href="#/" class="btn btn-primary">Retour</a>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="view-header">
      <nav aria-label="Breadcrumb" class="breadcrumb">
        <a href="#/">Accueil</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <span class="breadcrumb-current">Pilotage</span>
      </nav>
      <h1><i data-lucide="bar-chart-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Pilotage</h1>
      <p class="text-secondary">Score de santé · Food cost · Stock · HACCP · Fournisseurs · IA</p>
    </div>
    <div class="analytics-loading">
      <div class="spinner"></div>
      <p class="text-secondary">Calcul des métriques…</p>
    </div>
  `;

  try {
    // Load all data in parallel — analytics + health
    const [kpis, foodCost, stockData, pricesData, haccpData, insightsData, varianceSummary, dailyAlerts, stockAlerts, availability, coversData] = await Promise.all([
      API.getAnalyticsKPIs(),
      API.getAnalyticsFoodCost(),
      API.getAnalyticsStock(),
      API.getAnalyticsPrices(),
      API.getAnalyticsHACCP(),
      API.getAnalyticsInsights(),
      API.getVarianceSummary().catch(() => ({ total_loss_value: 0, total_purchase_value: 0, loss_ratio_pct: 0, ingredients_with_losses: 0, health: 'good' })),
      API.request('/alerts/daily-summary').catch(() => null),
      API.getStockAlerts().catch(() => []),
      API.getRecipeAvailability().catch(() => null),
      API.getAnalyticsCovers(30).catch(() => null)
    ]);

    renderPilotageDashboard(kpis, foodCost, stockData, pricesData, haccpData, insightsData, varianceSummary, dailyAlerts, stockAlerts, availability, coversData);
  } catch (e) {
    console.error('Pilotage error:', e);
    app.innerHTML = `
      <div class="view-header">
        <h1><i data-lucide="bar-chart-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Pilotage</h1>
      </div>
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="alert-triangle"></i></div>
        <p>Erreur de chargement</p>
        <p class="text-secondary text-sm">${escapeHtml(e.message)}</p>
        <button class="btn btn-primary" onclick="renderAnalytics()">Réessayer</button>
      </div>
    `;
  }
}

function renderPilotageDashboard(kpis, foodCost, stockData, pricesData, haccpData, insightsData, variance, alerts, stockAlerts, availability, coversData) {
  const app = document.getElementById('app');

  // ─── Health score calculation ───
  let healthScore = 100;
  const issues = [];

  if (kpis.avg_food_cost_pct > 35) {
    healthScore -= 20;
    issues.push({ icon: '🔴', text: `Food cost moyen élevé : ${kpis.avg_food_cost_pct.toFixed(1)}% (cible < 30%)`, severity: 'critical' });
  } else if (kpis.avg_food_cost_pct > 30) {
    healthScore -= 10;
    issues.push({ icon: '🟡', text: `Food cost moyen acceptable : ${kpis.avg_food_cost_pct.toFixed(1)}% (cible < 30%)`, severity: 'warning' });
  }

  if (variance.health === 'critical') {
    healthScore -= 20;
    issues.push({ icon: '🔴', text: `Pertes élevées : ratio ${variance.loss_ratio_pct.toFixed(1)}% des achats`, severity: 'critical' });
  } else if (variance.health === 'warning') {
    healthScore -= 10;
    issues.push({ icon: '🟡', text: `Pertes à surveiller : ratio ${variance.loss_ratio_pct.toFixed(1)}% des achats`, severity: 'warning' });
  }

  if (stockAlerts.length > 5) {
    healthScore -= 15;
    issues.push({ icon: '🔴', text: `${stockAlerts.length} alertes de stock bas`, severity: 'critical' });
  } else if (stockAlerts.length > 0) {
    healthScore -= 5;
    issues.push({ icon: '🟡', text: `${stockAlerts.length} alerte(s) de stock bas`, severity: 'warning' });
  }

  const tempCompliance = haccpData.temperature_compliance_7d || 100;
  const cleanCompliance = haccpData.cleaning_compliance_7d || 100;
  if (tempCompliance < 80 || cleanCompliance < 80) {
    healthScore -= 15;
    issues.push({ icon: '🔴', text: `HACCP insuffisant : températures ${tempCompliance}%, nettoyage ${cleanCompliance}%`, severity: 'critical' });
  } else if (tempCompliance < 95 || cleanCompliance < 95) {
    healthScore -= 5;
    issues.push({ icon: '🟡', text: `HACCP à améliorer : températures ${tempCompliance}%, nettoyage ${cleanCompliance}%`, severity: 'warning' });
  }

  if (alerts && alerts.summary && alerts.summary.critical > 0) {
    healthScore -= 10;
    issues.push({ icon: '🔴', text: `${alerts.summary.critical} alerte(s) critique(s) active(s) (DLC, températures)`, severity: 'critical' });
  }

  if (availability && availability.summary && (availability.summary.unavailable || 0) > 0) {
    healthScore -= 5;
    issues.push({ icon: '🟡', text: `${availability.summary.unavailable} recette(s) indisponible(s) par manque de stock`, severity: 'warning' });
  }

  healthScore = Math.max(0, healthScore);
  const scoreColor = healthScore >= 80 ? 'var(--color-success)' : healthScore >= 60 ? 'var(--color-warning)' : 'var(--color-danger)';
  const scoreLabel = healthScore >= 80 ? 'Bon' : healthScore >= 60 ? 'À surveiller' : 'Critique';
  const scoreEmoji = healthScore >= 80 ? '✅' : healthScore >= 60 ? '⚠️' : '🚨';
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  // ─── HACCP KPI for top bar ───
  const haccpTemp = kpis.haccp_compliance_today.temperatures;
  const haccpClean = kpis.haccp_compliance_today.cleaning;
  // Use 7-day compliance from haccpData (more meaningful than today-only zone coverage,
  // which shows 0% when no readings have been logged yet today).
  const haccpPct = Math.round(
    ((haccpData.temperature_compliance_7d || 100) + (haccpData.cleaning_compliance_7d || 100)) / 2
  );

  const activeAlerts = kpis.low_stock_count + (haccpData.alerts_count_7d || 0);
  const fcClass = kpis.avg_food_cost_pct < 30 ? 'kpi--success' : kpis.avg_food_cost_pct <= 35 ? 'kpi--warning' : 'kpi--danger';

  app.innerHTML = `
    <div class="view-header">
      <nav aria-label="Breadcrumb" class="breadcrumb">
        <a href="#/">Accueil</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <span class="breadcrumb-current">Pilotage</span>
      </nav>
      <h1><i data-lucide="bar-chart-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Pilotage</h1>
      <p class="text-secondary">Score de santé · Food cost · Stock · HACCP · Fournisseurs · IA</p>
    </div>

    <!-- ═══ Score de santé global ═══ -->
    <div style="background:linear-gradient(135deg,var(--bg-elevated),var(--color-surface));border:2px solid ${scoreColor};border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-5)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4)">
        <div style="display:flex;align-items:center;gap:var(--space-4)">
          <div style="text-align:center">
            <div style="font-size:3rem;font-weight:800;color:${scoreColor};line-height:1">${healthScore}</div>
            <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px">/ 100</div>
          </div>
          <div>
            <div style="font-size:var(--text-lg);font-weight:600;color:var(--text-primary)">${scoreEmoji} Score de santé — ${scoreLabel}</div>
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">
              ${issues.length === 0 ? 'Tout est en ordre, bravo !' : `${criticalCount} problème(s), ${warningCount} avertissement(s)`}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          <a href="#/stock/reception" class="btn btn-secondary" style="font-size:var(--text-sm)"><i data-lucide="download" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Réception</a>
          <a href="#/stock/variance" class="btn btn-secondary" style="font-size:var(--text-sm)"><i data-lucide="bar-chart-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Écarts</a>
          <a href="#/haccp" class="btn btn-secondary" style="font-size:var(--text-sm)"><i data-lucide="shield" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>HACCP</a>
          <a href="#/orders" class="btn btn-secondary" style="font-size:var(--text-sm)"><i data-lucide="clipboard-list" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Commandes</a>
        </div>
      </div>
      <div style="margin-top:var(--space-3);background:var(--bg-sunken);border-radius:6px;height:8px;overflow:hidden">
        <div style="height:100%;width:${healthScore}%;background:${scoreColor};border-radius:6px;transition:width 0.5s"></div>
      </div>
      ${issues.length > 0 ? `
      <div style="margin-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)">
        ${issues.map(i => `
          <div style="padding:var(--space-2) var(--space-3);background:${i.severity === 'critical' ? 'rgba(217,48,37,0.08)' : 'rgba(229,161,0,0.08)'};border-radius:var(--radius-sm);border-left:3px solid ${i.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)'}">
            <span style="font-size:var(--text-sm)">${i.icon} ${i.text}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>

    <!-- ═══ KPIs principaux ═══ -->
    <div class="analytics-kpis">
      <div class="kpi-card ${fcClass} anim-fadeIn" style="--delay:0">
        <div class="kpi-icon"><i data-lucide="bar-chart-2" style="width:28px;height:28px"></i></div>
        <div class="kpi-value font-mono">${kpis.avg_food_cost_pct}%</div>
        <div class="kpi-label">Food Cost moyen</div>
        <div class="kpi-detail">${kpis.total_recipes} recettes</div>
      </div>
      <div class="kpi-card anim-fadeIn" style="--delay:1">
        <div class="kpi-icon"><i data-lucide="dollar-sign" style="width:28px;height:28px"></i></div>
        <div class="kpi-value font-mono">${formatCurrency(kpis.total_stock_value)}</div>
        <div class="kpi-label">Valeur du stock</div>
        <div class="kpi-detail">${kpis.low_stock_count} alerte${kpis.low_stock_count > 1 ? 's' : ''}</div>
      </div>
      <div class="kpi-card ${haccpPct >= 90 ? 'kpi--success' : haccpPct >= 70 ? 'kpi--warning' : 'kpi--danger'} anim-fadeIn" style="--delay:2">
        <div class="kpi-icon"><i data-lucide="thermometer" style="width:28px;height:28px"></i></div>
        <div class="kpi-value font-mono">${haccpPct}%</div>
        <div class="kpi-label">Conformité HACCP</div>
        <div class="kpi-detail">${haccpTemp.done}/${haccpTemp.total} temp · ${haccpClean.done}/${haccpClean.total} nett.</div>
      </div>
      <div class="kpi-card ${activeAlerts > 0 ? 'kpi--danger' : 'kpi--success'} anim-fadeIn" style="--delay:3">
        <div class="kpi-icon"><i data-lucide="alert-triangle" style="width:28px;height:28px"></i></div>
        <div class="kpi-value font-mono">${activeAlerts}</div>
        <div class="kpi-label">Alertes actives</div>
        <div class="kpi-detail">${kpis.price_changes_30d} chgmt prix/30j</div>
      </div>
    </div>

    <!-- ═══ Section Food Cost ═══ -->
    <section class="analytics-section anim-fadeIn" style="--delay:4">
      <h2><i data-lucide="utensils" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Food Cost par recette</h2>
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

    <!-- ═══ Section Couverts ═══ -->
    ${coversData ? `
    <section class="analytics-section anim-fadeIn" style="--delay:5">
      <h2><i data-lucide="users" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Couverts (30j)</h2>
      <div class="analytics-kpis" style="margin-bottom:var(--space-4)">
        <div class="kpi-card">
          <div class="kpi-icon"><i data-lucide="users" style="width:28px;height:28px"></i></div>
          <div class="kpi-value font-mono">${coversData.total_covers || 0}</div>
          <div class="kpi-label">Total couverts</div>
          <div class="kpi-detail">${coversData.avg_covers_per_day || 0} / jour</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon"><i data-lucide="utensils-crossed" style="width:28px;height:28px"></i></div>
          <div class="kpi-value font-mono">${formatCurrency(coversData.food_cost_per_cover || 0)}</div>
          <div class="kpi-label">Food cost / couvert</div>
          <div class="kpi-detail">${coversData.total_food_cost ? formatCurrency(coversData.total_food_cost) + ' total' : '—'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon"><i data-lucide="banknote" style="width:28px;height:28px"></i></div>
          <div class="kpi-value font-mono">${formatCurrency(coversData.revenue_per_cover || 0)}</div>
          <div class="kpi-label">CA / couvert</div>
          <div class="kpi-detail">${coversData.avg_covers_per_service || 0} / service</div>
        </div>
        <div class="kpi-card ${coversData.trend_pct > 0 ? 'kpi--success' : coversData.trend_pct < -10 ? 'kpi--danger' : ''}">
          <div class="kpi-icon"><i data-lucide="${coversData.trend_pct >= 0 ? 'trending-up' : 'trending-down'}" style="width:28px;height:28px"></i></div>
          <div class="kpi-value font-mono">${coversData.trend_pct > 0 ? '+' : ''}${coversData.trend_pct}%</div>
          <div class="kpi-label">Tendance</div>
          <div class="kpi-detail">vs début de période</div>
        </div>
      </div>
      ${(coversData.per_day || []).length > 0 ? `
      <h3 style="font-size:var(--text-sm);margin-bottom:var(--space-2)">Couverts par jour (30 derniers jours)</h3>
      <div class="css-chart-h">
        ${(() => {
          const maxC = Math.max(...coversData.per_day.map(d => d.covers || 0), 1);
          return coversData.per_day.slice(-15).map(d => `
            <div class="bar-h-row">
              <span class="bar-h-label">${escapeHtml(new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }))}</span>
              <div class="bar-h-track">
                <div class="bar-h-fill" style="width:${((d.covers || 0) / maxC) * 100}%"></div>
              </div>
              <span class="bar-h-val font-mono">${d.covers || 0}</span>
            </div>
          `).join('');
        })()}
      </div>
      ` : '<p class="text-secondary text-sm">Aucun couvert enregistré sur la période. Saisissez le nombre de couverts à l\'envoi des commandes pour suivre cet indicateur.</p>'}
    </section>
    ` : ''}

    <!-- ═══ Section Stock ═══ -->
    <section class="analytics-section anim-fadeIn" style="--delay:5">
      <h2><i data-lucide="package" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Stock</h2>
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
          <h3 style="margin-top:var(--space-4)"><i data-lucide="alert-triangle" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Alertes stock bas</h3>
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

    <!-- ═══ Section HACCP ═══ -->
    <section class="analytics-section anim-fadeIn" style="--delay:6">
      <h2><i data-lucide="shield" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>HACCP Compliance</h2>
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
          <a href="#/haccp" style="display:inline-block;margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-accent)">Voir le détail HACCP →</a>
        </div>
        <div class="analytics-col">
          <h3>7 derniers jours</h3>
          <div class="haccp-mini-chart">
            ${haccpData.daily_scores.slice(-7).map(d => {
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

    <!-- ═══ Section Fournisseurs ═══ -->
    <section class="analytics-section anim-fadeIn" style="--delay:7">
      <h2><i data-lucide="dollar-sign" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Prix Fournisseurs</h2>
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
          <h3><i data-lucide="lightbulb" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Suggestions d'économies</h3>
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

    <!-- ═══ Section Insights IA ═══ -->
    <section class="analytics-section analytics-section--ai anim-fadeIn" style="--delay:8">
      <div class="ai-section-header">
        <h2><i data-lucide="brain" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Insights IA</h2>
        <button class="btn btn-secondary btn-sm" id="refresh-insights-btn" onclick="refreshInsights()">
          <i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Actualiser
        </button>
      </div>
      ${insightsData.cached_at ? `<p class="text-secondary text-sm" id="insights-timestamp">Dernière analyse : ${formatTimeAgo(insightsData.cached_at)}</p>` : ''}
      <div class="ai-insights-grid" id="ai-insights-grid">
        ${renderInsightCards(insightsData.insights)}
      </div>
    </section>

    <!-- ═══ Actions rapides ═══ -->
    <section class="analytics-section anim-fadeIn" style="--delay:9">
      <h2><i data-lucide="zap" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Actions rapides</h2>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
        <a href="#/stock/reception" class="btn btn-secondary"><i data-lucide="download" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Réception stock</a>
        <a href="#/stock/variance" class="btn btn-secondary"><i data-lucide="bar-chart-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Analyse écarts</a>
        <a href="#/haccp" class="btn btn-secondary"><i data-lucide="shield" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>HACCP</a>
        <a href="#/orders" class="btn btn-secondary"><i data-lucide="clipboard-list" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Commandes fournisseurs</a>
        <a href="#/menu-engineering" class="btn btn-secondary"><i data-lucide="target" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Menu Engineering</a>
        <a href="#/predictions" class="btn btn-secondary"><i data-lucide="brain" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Prédictions IA</a>
        <a href="#/waste-analytics" class="btn btn-secondary"><i data-lucide="trash-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Pertes &amp; gaspillage</a>
        <a href="#/mercuriale" class="btn btn-secondary"><i data-lucide="trending-up" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Mercuriale</a>
        <a href="#/suppliers" class="btn btn-secondary"><i data-lucide="factory" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i>Fournisseurs</a>
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
