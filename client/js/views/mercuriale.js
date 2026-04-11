// ═══════════════════════════════════════════
// Mercuriale — Suivi prix fournisseurs
// ═══════════════════════════════════════════

async function renderMercuriale() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/analytics" class="btn btn-secondary btn-sm">← Analytics</a>
        <h1 style="margin-top:4px">📊 Mercuriale</h1>
      </div>
      <a href="#/import-mercuriale" class="btn btn-primary"><i data-lucide="camera" style="width:16px;height:16px"></i> Scanner une mercuriale</a>
    </div>

    <div id="price-alerts-section">
      <h2 style="margin-bottom:var(--space-3)">⚠️ Alertes prix</h2>
      <div id="price-alerts-list">
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>

    <div style="margin-top:var(--space-5)">
      <h2 style="margin-bottom:var(--space-3)">📋 Tous les ingrédients</h2>
      <div id="mercuriale-table">
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>

    <div id="price-chart-modal" class="modal-overlay" style="display:none">
      <div class="modal" style="max-width:600px">
        <div class="modal-header">
          <h3 id="chart-title">Évolution du prix</h3>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('price-chart-modal').style.display='none'">✕</button>
        </div>
        <div id="price-chart-container" style="padding:var(--space-4)"></div>
        <div style="padding:0 var(--space-4) var(--space-4);display:flex;gap:var(--space-2)">
          <button class="btn btn-secondary btn-sm period-btn active" data-period="30d">30 jours</button>
          <button class="btn btn-secondary btn-sm period-btn" data-period="90d">90 jours</button>
          <button class="btn btn-secondary btn-sm period-btn" data-period="1y">1 an</button>
        </div>
      </div>
    </div>
  `;

  // Load data
  let alerts = [];
  let ingredients = [];

  try {
    [alerts, ingredients] = await Promise.all([
      API.request('/analytics/price-alerts'),
      API.getIngredients()
    ]);
  } catch (e) {
    showToast('Erreur chargement données', 'error');
  }

  // Render alerts
  const alertsList = document.getElementById('price-alerts-list');
  if (alerts.length === 0) {
    alertsList.innerHTML = `<div class="card" style="padding:var(--space-3);text-align:center;color:var(--color-success)">
      ✅ Aucune variation significative détectée
    </div>`;
  } else {
    alertsList.innerHTML = alerts.map(a => {
      const isUp = a.variation_percent > 0;
      const color = isUp ? 'var(--color-danger)' : 'var(--color-success)';
      const arrow = isUp ? '↑' : '↓';
      return `
        <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-2);border-left:4px solid ${color}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong>${escapeHtml(a.ingredient_name)}</strong>
              <span class="text-secondary text-sm"> — ${escapeHtml(a.supplier_name || '')}</span>
            </div>
            <div style="text-align:right">
              <span style="color:${color};font-weight:600;font-size:1.1em">${arrow} ${Math.abs(a.variation_percent).toFixed(1)}%</span>
              <div class="text-secondary text-sm">${a.current_price.toFixed(2)}€ (moy: ${a.avg_price.toFixed(2)}€)</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Enrich ingredients with latest price from supplier_prices
  const enriched = [];
  for (const ing of ingredients) {
    const priceInfo = alerts.find(a => a.ingredient_id === ing.id);
    enriched.push({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      current_price: priceInfo ? priceInfo.current_price : (ing.price_per_unit || 0),
      avg_price: priceInfo ? priceInfo.avg_price : null,
      variation: priceInfo ? priceInfo.variation_percent : null,
      supplier: priceInfo ? priceInfo.supplier_name : null
    });
  }

  // Render table
  const tableDiv = document.getElementById('mercuriale-table');
  if (enriched.length === 0) {
    tableDiv.innerHTML = '<div class="empty-state"><p>Aucun ingrédient</p></div>';
  } else {
    tableDiv.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="border-bottom:2px solid var(--color-border)">
              <th style="text-align:left;padding:10px 6px">Ingrédient</th>
              <th style="text-align:left;padding:10px 6px">Catégorie</th>
              <th style="text-align:right;padding:10px 6px">Prix actuel</th>
              <th style="text-align:right;padding:10px 6px">Moy. 30j</th>
              <th style="text-align:center;padding:10px 6px">Tendance</th>
              <th style="text-align:center;padding:10px 6px">Détails</th>
            </tr>
          </thead>
          <tbody>
            ${enriched.map(ing => {
              const trend = ing.variation == null ? '→' : ing.variation > 2 ? '↑' : ing.variation < -2 ? '↓' : '→';
              const trendColor = trend === '↑' ? 'var(--color-danger)' : trend === '↓' ? 'var(--color-success)' : 'var(--color-text-muted)';
              return `
                <tr style="border-bottom:1px solid var(--color-border)">
                  <td style="padding:10px 6px"><strong>${escapeHtml(ing.name)}</strong></td>
                  <td style="padding:10px 6px" class="text-secondary">${escapeHtml(ing.category || '—')}</td>
                  <td style="text-align:right;padding:10px 6px">${ing.current_price > 0 ? ing.current_price.toFixed(2) + '€' : '—'}</td>
                  <td style="text-align:right;padding:10px 6px">${ing.avg_price ? ing.avg_price.toFixed(2) + '€' : '—'}</td>
                  <td style="text-align:center;padding:10px 6px;color:${trendColor};font-size:1.3em;font-weight:bold">${trend}</td>
                  <td style="text-align:center;padding:10px 6px">
                    <button class="btn btn-secondary btn-sm btn-chart" data-id="${ing.id}" data-name="${escapeHtml(ing.name)}">📈</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Chart click handlers
  let currentChartIngredientId = null;

  document.querySelectorAll('.btn-chart').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const name = btn.dataset.name;
      currentChartIngredientId = id;
      document.getElementById('chart-title').textContent = `📈 ${name}`;
      document.getElementById('price-chart-modal').style.display = 'flex';
      
      // Reset period buttons
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.period-btn[data-period="30d"]').classList.add('active');
      
      await loadChart(id, '30d');
    });
  });

  // Period buttons
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (currentChartIngredientId) {
        await loadChart(currentChartIngredientId, btn.dataset.period);
      }
    });
  });

  // Close modal on overlay click
  document.getElementById('price-chart-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.target.style.display = 'none';
  });
}

async function loadChart(ingredientId, period) {
  const container = document.getElementById('price-chart-container');
  container.innerHTML = '<div class="skeleton" style="height:200px"></div>';

  try {
    const data = await API.request(`/analytics/price-trends?ingredient_id=${ingredientId}&period=${period}`);
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-secondary" style="text-align:center;padding:var(--space-4)">Aucune donnée de prix pour cette période</p>';
      return;
    }

    container.innerHTML = renderSVGChart(data);
  } catch (e) {
    container.innerHTML = '<p style="color:var(--color-danger);text-align:center">Erreur chargement données</p>';
  }
}

function renderSVGChart(data) {
  const W = 540, H = 220, PAD_L = 55, PAD_R = 15, PAD_T = 15, PAD_B = 35;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const prices = data.map(d => d.price);
  const minP = Math.min(...prices) * 0.95;
  const maxP = Math.max(...prices) * 1.05;
  const rangeP = maxP - minP || 1;

  const dates = data.map(d => new Date(d.date));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const rangeDate = maxDate - minDate || 1;

  const points = data.map((d, i) => {
    const x = PAD_L + ((dates[i] - minDate) / rangeDate) * chartW;
    const y = PAD_T + chartH - ((d.price - minP) / rangeP) * chartH;
    return { x, y, price: d.price, date: d.date, supplier: d.supplier_name };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Y-axis labels (5 ticks)
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const val = minP + (rangeP * i / 4);
    const y = PAD_T + chartH - (chartH * i / 4);
    yLabels.push(`<text x="${PAD_L - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-muted)" font-size="11">${val.toFixed(2)}€</text>`);
    yLabels.push(`<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="4,4"/>`);
  }

  // X-axis labels (max 5)
  const xLabels = [];
  const step = Math.max(1, Math.floor(data.length / 5));
  for (let i = 0; i < data.length; i += step) {
    const d = new Date(data[i].date);
    const label = `${d.getDate()}/${d.getMonth() + 1}`;
    xLabels.push(`<text x="${points[i].x}" y="${H - 5}" text-anchor="middle" fill="var(--color-text-muted)" font-size="11">${label}</text>`);
  }

  const circles = points.map(p => 
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--color-accent)" stroke="#fff" stroke-width="1.5">
      <title>${p.price.toFixed(2)}€ — ${new Date(p.date).toLocaleDateString('fr-FR')}${p.supplier ? ' (' + p.supplier + ')' : ''}</title>
    </circle>`
  ).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;font-family:inherit">
      ${yLabels.join('')}
      ${xLabels.join('')}
      <path d="${linePath}" fill="none" stroke="var(--color-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${circles}
    </svg>
  `;
}
