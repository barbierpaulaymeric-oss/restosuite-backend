// ═══════════════════════════════════════════
// Health Dashboard — Santé du Restaurant
// Vue d'ensemble de la performance opérationnelle
// ═══════════════════════════════════════════

async function renderHealthDashboard() {
  const app = document.getElementById('app');
  const perms = getPermissions();

  if (!perms.view_costs) {
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
      <a href="#/" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-2);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Accueil
      </a>
      <h1><i data-lucide="heart-pulse" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Santé du restaurant</h1>
      <p class="text-secondary">Vue d'ensemble de la performance opérationnelle</p>
    </div>
    <div id="health-content">
      <div class="skeleton skeleton-card" style="height:120px"></div>
      <div class="skeleton skeleton-card" style="height:200px;margin-top:16px"></div>
      <div class="skeleton skeleton-card" style="height:200px;margin-top:16px"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  try {
    const [kpis, varianceSummary, alerts, haccpData, stockAlerts, availability] = await Promise.all([
      API.getAnalyticsKPIs(),
      API.getVarianceSummary(),
      API.request('/alerts/daily-summary').catch(() => null),
      API.getAnalyticsHACCP().catch(() => null),
      API.getStockAlerts().catch(() => []),
      API.getRecipeAvailability().catch(() => null)
    ]);

    renderHealthContent(kpis, varianceSummary, alerts, haccpData, stockAlerts, availability);
  } catch (e) {
    document.getElementById('health-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="alert-triangle"></i></div>
        <p>Erreur de chargement</p>
        <p class="text-secondary text-sm">${escapeHtml(e.message)}</p>
        <button class="btn btn-primary" onclick="renderHealthDashboard()">Réessayer</button>
      </div>
    `;
  }
}

function renderHealthContent(kpis, variance, alerts, haccp, stockAlerts, availability) {
  const el = document.getElementById('health-content');
  if (!el) return;

  // ─── Overall health score ───
  let healthScore = 100;
  const issues = [];

  // Food cost penalty
  if (kpis.avg_food_cost_pct > 35) {
    healthScore -= 20;
    issues.push({ icon: '🔴', text: `Food cost moyen élevé : ${kpis.avg_food_cost_pct.toFixed(1)}% (cible < 30%)`, severity: 'critical' });
  } else if (kpis.avg_food_cost_pct > 30) {
    healthScore -= 10;
    issues.push({ icon: '🟡', text: `Food cost moyen acceptable : ${kpis.avg_food_cost_pct.toFixed(1)}% (cible < 30%)`, severity: 'warning' });
  }

  // Variance penalty
  if (variance.health === 'critical') {
    healthScore -= 20;
    issues.push({ icon: '🔴', text: `Pertes élevées : ratio ${variance.loss_ratio_pct.toFixed(1)}% des achats`, severity: 'critical' });
  } else if (variance.health === 'warning') {
    healthScore -= 10;
    issues.push({ icon: '🟡', text: `Pertes à surveiller : ratio ${variance.loss_ratio_pct.toFixed(1)}% des achats`, severity: 'warning' });
  }

  // Stock alerts penalty
  if (stockAlerts.length > 5) {
    healthScore -= 15;
    issues.push({ icon: '🔴', text: `${stockAlerts.length} alertes de stock bas`, severity: 'critical' });
  } else if (stockAlerts.length > 0) {
    healthScore -= 5;
    issues.push({ icon: '🟡', text: `${stockAlerts.length} alerte(s) de stock bas`, severity: 'warning' });
  }

  // HACCP penalty
  if (haccp) {
    const tempCompliance = haccp.temperature_compliance_7d || 100;
    const cleanCompliance = haccp.cleaning_compliance_7d || 100;
    if (tempCompliance < 80 || cleanCompliance < 80) {
      healthScore -= 15;
      issues.push({ icon: '🔴', text: `HACCP insuffisant : températures ${tempCompliance}%, nettoyage ${cleanCompliance}%`, severity: 'critical' });
    } else if (tempCompliance < 95 || cleanCompliance < 95) {
      healthScore -= 5;
      issues.push({ icon: '🟡', text: `HACCP à améliorer : températures ${tempCompliance}%, nettoyage ${cleanCompliance}%`, severity: 'warning' });
    }
  }

  // Alerts penalty
  if (alerts && alerts.summary) {
    if (alerts.summary.critical > 0) {
      healthScore -= 10;
      issues.push({ icon: '🔴', text: `${alerts.summary.critical} alerte(s) critique(s) active(s) (DLC, températures)`, severity: 'critical' });
    }
  }

  // Availability penalty
  if (availability && availability.summary) {
    const unavailable = availability.summary.unavailable || 0;
    if (unavailable > 0) {
      healthScore -= 5;
      issues.push({ icon: '🟡', text: `${unavailable} recette(s) indisponible(s) par manque de stock`, severity: 'warning' });
    }
  }

  healthScore = Math.max(0, healthScore);
  const scoreColor = healthScore >= 80 ? 'var(--color-success)' : healthScore >= 60 ? 'var(--color-warning)' : 'var(--color-danger)';
  const scoreLabel = healthScore >= 80 ? 'Bon' : healthScore >= 60 ? 'À surveiller' : 'Critique';
  const scoreEmoji = healthScore >= 80 ? '✅' : healthScore >= 60 ? '⚠️' : '🚨';

  // ─── Critical alerts section ───
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');

  el.innerHTML = `
    <!-- Health Score -->
    <div style="background:linear-gradient(135deg, var(--bg-elevated), var(--color-surface));border:2px solid ${scoreColor};border-radius:var(--radius-lg);padding:var(--space-5);margin-bottom:var(--space-5);text-align:center">
      <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);flex-wrap:wrap">
        <div>
          <div style="font-size:3.5rem;font-weight:800;color:${scoreColor};line-height:1">${healthScore}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:4px">/ 100</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:var(--text-lg);font-weight:600;color:var(--text-primary)">${scoreEmoji} ${scoreLabel}</div>
          <div style="font-size:var(--text-sm);color:var(--text-secondary)">
            ${issues.length === 0 ? 'Tout est en ordre, bravo !' : `${criticalIssues.length} problème(s), ${warningIssues.length} avertissement(s)`}
          </div>
        </div>
      </div>
      <!-- Score bar -->
      <div style="margin-top:var(--space-3);background:var(--bg-sunken);border-radius:6px;height:10px;overflow:hidden">
        <div style="height:100%;width:${healthScore}%;background:${scoreColor};border-radius:6px;transition:width 0.5s"></div>
      </div>
    </div>

    ${issues.length > 0 ? `
    <!-- Issues -->
    <div style="margin-bottom:var(--space-5)">
      <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Points d'attention</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${issues.map(i => `
          <div style="padding:var(--space-3);background:${i.severity === 'critical' ? 'rgba(217,48,37,0.08)' : 'rgba(229,161,0,0.08)'};border-radius:var(--radius-md);border-left:3px solid ${i.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)'}">
            <span style="font-size:var(--text-sm)">${i.icon} ${i.text}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- KPI Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-3);margin-bottom:var(--space-5)">
      ${_healthKpiCard('Food cost moyen', `${kpis.avg_food_cost_pct.toFixed(1)}%`,
        kpis.avg_food_cost_pct < 30 ? 'var(--color-success)' : kpis.avg_food_cost_pct <= 35 ? 'var(--color-warning)' : 'var(--color-danger)',
        'Cible : < 30%')}
      ${_healthKpiCard('Fiches techniques', kpis.total_recipes, 'var(--color-accent)', '')}
      ${_healthKpiCard('Valeur stock', formatCurrency(kpis.stock_value), 'var(--color-info)', '')}
      ${_healthKpiCard('Stock bas', kpis.low_stock_count,
        kpis.low_stock_count > 5 ? 'var(--color-danger)' : kpis.low_stock_count > 0 ? 'var(--color-warning)' : 'var(--color-success)',
        kpis.low_stock_count === 0 ? 'Tout est OK' : 'À réapprovisionner')}
      ${_healthKpiCard('Pertes (30j)', formatCurrency(variance.total_loss_value),
        variance.health === 'critical' ? 'var(--color-danger)' : variance.health === 'warning' ? 'var(--color-warning)' : 'var(--color-success)',
        `${variance.loss_ratio_pct.toFixed(1)}% des achats`)}
      ${_healthKpiCard('Achats (30j)', formatCurrency(variance.total_purchase_value), 'var(--text-primary)', '')}
    </div>

    <!-- Sections Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-4);margin-bottom:var(--space-5)">
      <!-- HACCP Compliance -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)"><i data-lucide="shield" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Conformité HACCP</h3>
        ${haccp ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <div style="text-align:center">
              <div style="font-size:var(--text-2xl);font-weight:700;color:${_complianceColor(haccp.temperature_compliance_7d)}">${haccp.temperature_compliance_7d || 0}%</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Températures (7j)</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:var(--text-2xl);font-weight:700;color:${_complianceColor(haccp.cleaning_compliance_7d)}">${haccp.cleaning_compliance_7d || 0}%</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Nettoyage (7j)</div>
            </div>
          </div>
          ${haccp.alerts_count_7d > 0 ? `<div style="margin-top:var(--space-3);padding:var(--space-2);background:rgba(217,48,37,0.08);border-radius:var(--radius-sm);font-size:var(--text-sm);color:var(--color-danger)">⚠️ ${haccp.alerts_count_7d} alerte(s) sur 7 jours</div>` : ''}
        ` : '<p class="text-secondary text-sm">Données HACCP non disponibles</p>'}
        <a href="#/haccp" style="display:block;text-align:center;margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-accent)">Voir le détail →</a>
      </div>

      <!-- Stock Health -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)"><i data-lucide="package" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>État des stocks</h3>
        ${stockAlerts.length > 0 ? `
          <div style="max-height:180px;overflow-y:auto">
            ${stockAlerts.slice(0, 8).map(a => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:var(--text-sm)">
                <span style="font-weight:500">${escapeHtml(a.ingredient_name || a.name || `#${a.ingredient_id}`)}</span>
                <span style="color:var(--color-danger);font-weight:600">${a.quantity != null ? formatQuantity(a.quantity, a.unit) : '—'}</span>
              </div>
            `).join('')}
            ${stockAlerts.length > 8 ? `<div style="font-size:var(--text-xs);color:var(--text-tertiary);padding-top:8px">+${stockAlerts.length - 8} autre(s)…</div>` : ''}
          </div>
        ` : '<div style="text-align:center;padding:var(--space-4);color:var(--color-success);font-weight:600">✅ Tous les stocks sont OK</div>'}
        <a href="#/stock" style="display:block;text-align:center;margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-accent)">Gérer le stock →</a>
      </div>

      <!-- Recipe Availability -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)"><i data-lucide="utensils" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Disponibilité des plats</h3>
        ${availability && availability.summary ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);text-align:center;margin-bottom:var(--space-3)">
            <div>
              <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-success)">${availability.summary.available || 0}</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Disponibles</div>
            </div>
            <div>
              <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-warning)">${availability.summary.low || 0}</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Stock faible</div>
            </div>
            <div>
              <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-danger)">${availability.summary.unavailable || 0}</div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Indisponibles</div>
            </div>
          </div>
          ${availability.items && availability.items.filter(i => i.available_portions === 0).length > 0 ? `
            <div style="font-size:var(--text-sm);color:var(--text-secondary)">
              <strong>Indisponibles :</strong> ${availability.items.filter(i => i.available_portions === 0).slice(0, 5).map(i => escapeHtml(i.name)).join(', ')}
            </div>
          ` : ''}
        ` : '<p class="text-secondary text-sm">Activez le module de disponibilité pour voir les données</p>'}
      </div>

      <!-- Variance Summary -->
      <div class="card" style="padding:var(--space-4)">
        <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)"><i data-lucide="bar-chart-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Analyse des écarts (30j)</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);text-align:center">
          <div>
            <div style="font-size:var(--text-xl);font-weight:700;color:${variance.health === 'good' ? 'var(--color-success)' : variance.health === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)'}">
              ${formatCurrency(variance.total_loss_value)}
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Pertes déclarées</div>
          </div>
          <div>
            <div style="font-size:var(--text-xl);font-weight:700">${variance.ingredients_with_losses}</div>
            <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Ingrédients impactés</div>
          </div>
        </div>
        <a href="#/stock/variance" style="display:block;text-align:center;margin-top:var(--space-3);font-size:var(--text-sm);color:var(--color-accent)">Analyse détaillée →</a>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="margin-top:var(--space-4)">
      <h3 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Actions rapides</h3>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
        <a href="#/stock/reception" class="btn btn-secondary">📥 Réception stock</a>
        <a href="#/stock/variance" class="btn btn-secondary">📊 Analyse écarts</a>
        <a href="#/haccp" class="btn btn-secondary">🛡️ HACCP</a>
        <a href="#/analytics" class="btn btn-secondary">📈 Analytics complet</a>
        <a href="#/orders" class="btn btn-secondary">📋 Commandes fournisseurs</a>
      </div>
    </div>
  `;
}

function _healthKpiCard(label, value, color, subtitle) {
  return `
    <div class="card" style="padding:var(--space-3);text-align:center">
      <div style="font-size:var(--text-xl);font-weight:700;color:${color}">${value}</div>
      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">${label}</div>
      ${subtitle ? `<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">${subtitle}</div>` : ''}
    </div>
  `;
}

function _complianceColor(pct) {
  if (pct == null) return 'var(--text-tertiary)';
  if (pct >= 95) return 'var(--color-success)';
  if (pct >= 80) return 'var(--color-warning)';
  return 'var(--color-danger)';
}
