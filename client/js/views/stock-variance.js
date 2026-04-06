// ═══════════════════════════════════════════
// Stock Variance — Analyse des écarts #/stock/variance
// ═══════════════════════════════════════════

async function renderStockVariance() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/stock" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-2);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour stock
      </a>
      <h1>Analyse des ecarts</h1>
      <p class="text-secondary">Consommation theorique vs reelle</p>
    </div>
    <div class="variance-controls" style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="margin:0">
        <label class="form-label" style="font-size:var(--text-xs)">Du</label>
        <input type="date" id="var-from" class="input" style="width:160px">
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label" style="font-size:var(--text-xs)">Au</label>
        <input type="date" id="var-to" class="input" style="width:160px">
      </div>
      <button class="btn btn-primary" id="var-refresh">Analyser</button>
    </div>
    <div id="var-summary" style="margin-bottom:var(--space-5)"></div>
    <div id="var-content">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // Default: last 7 days
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  document.getElementById('var-from').value = weekAgo.toISOString().split('T')[0];
  document.getElementById('var-to').value = now.toISOString().split('T')[0];

  document.getElementById('var-refresh').addEventListener('click', loadVariance);

  await loadVariance();
}

async function loadVariance() {
  const from = document.getElementById('var-from').value;
  const to = document.getElementById('var-to').value;
  const summaryEl = document.getElementById('var-summary');
  const contentEl = document.getElementById('var-content');

  contentEl.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';

  try {
    const data = await API.getVarianceAnalysis(from, to);

    // Summary cards
    const healthColor = data.total_variance_value > 0 ? 'var(--color-danger)' : 'var(--color-success)';
    const healthIcon = data.critical_count > 0 ? '!!' : data.warning_count > 0 ? '!' : 'OK';

    summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-3)">
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:${healthColor}">
            ${data.total_variance_value > 0 ? '+' : ''}${formatCurrency(data.total_variance_value)}
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Ecart total (valeur)</div>
        </div>
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700">${data.total_items}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Ingredients analyses</div>
        </div>
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-danger)">${data.critical_count}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Critiques (>15%)</div>
        </div>
        <div class="card" style="padding:var(--space-4);text-align:center">
          <div style="font-size:var(--text-2xl);font-weight:700;color:var(--color-warning)">${data.warning_count}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Alertes (>5%)</div>
        </div>
      </div>
    `;

    if (data.items.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--space-8)">
          <div class="empty-icon" style="font-size:48px;margin-bottom:var(--space-3)">--</div>
          <h3>Aucun ecart detecte</h3>
          <p style="color:var(--text-secondary)">Pas de mouvements ou de ventes sur cette periode.</p>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th class="numeric">Theorique</th>
              <th class="numeric">Reel</th>
              <th class="numeric">Ecart</th>
              <th class="numeric">Ecart %</th>
              <th class="numeric">Valeur</th>
              <th class="numeric">Pertes</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => {
              const statusBadge = item.status === 'critical'
                ? '<span class="badge badge--danger">Critique</span>'
                : item.status === 'warning'
                ? '<span class="badge badge--warning">Alerte</span>'
                : '<span class="badge badge--success">OK</span>';
              const varColor = item.variance_qty > 0 ? 'var(--color-danger)' : item.variance_qty < 0 ? 'var(--color-success)' : 'inherit';
              return `
                <tr>
                  <td style="font-weight:500">${escapeHtml(item.ingredient_name)}</td>
                  <td class="numeric mono">${formatQuantity(item.theoretical_qty, item.unit)}</td>
                  <td class="numeric mono">${formatQuantity(item.actual_qty, item.unit)}</td>
                  <td class="numeric mono" style="color:${varColor};font-weight:600">
                    ${item.variance_qty > 0 ? '+' : ''}${formatQuantity(item.variance_qty, item.unit)}
                  </td>
                  <td class="numeric mono" style="color:${varColor}">
                    ${item.variance_pct > 0 ? '+' : ''}${item.variance_pct.toFixed(1)}%
                  </td>
                  <td class="numeric mono" style="color:${varColor};font-weight:600">
                    ${item.variance_value > 0 ? '+' : ''}${formatCurrency(item.variance_value)}
                  </td>
                  <td class="numeric mono">${item.losses > 0 ? formatQuantity(item.losses, item.unit) : '--'}</td>
                  <td>${statusBadge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:var(--space-4);padding:var(--space-3);background:var(--bg-sunken);border-radius:var(--radius-md);font-size:var(--text-sm);color:var(--text-tertiary)">
        <strong>Lecture :</strong> Un ecart positif = surconsommation reelle par rapport au theorique (pertes, vol, surdosage).
        Un ecart negatif = consommation inferieure au prevu (sous-dosage ou stock non mis a jour).
      </div>
    `;
  } catch (e) {
    summaryEl.innerHTML = '';
    contentEl.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:var(--space-8)">
        <p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}
