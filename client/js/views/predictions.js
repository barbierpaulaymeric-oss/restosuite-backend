// ═══════════════════════════════════════════
// Prédictions IA — Anticipation de la demande
// ═══════════════════════════════════════════

async function renderPredictions() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/analytics" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Analytics
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="brain" style="width:28px;height:28px;color:#7C3AED"></i>
        Prédictions IA
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Anticipez la demande des 7 prochains jours</p>
    </div>
    <div id="pred-content">
      <div style="text-align:center;padding:var(--space-6)">
        <div class="loading-spinner"></div>
        <p class="text-secondary" style="margin-top:var(--space-2)">Analyse en cours…</p>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
  await loadPredictions();
}

async function loadPredictions() {
  const content = document.getElementById('pred-content');
  try {
    const data = await API.request('/predictions/demand');
    renderPredictionsContent(data);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}

function renderPredictionsContent(data) {
  const content = document.getElementById('pred-content');
  const maxOrders = Math.max(...data.forecast.map(f => f.predicted_orders), 1);

  content.innerHTML = `
    <!-- AI Insight -->
    ${data.ai_insight ? `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4);background:rgba(124,58,237,0.05);border-color:rgba(124,58,237,0.2)">
      <div style="display:flex;align-items:start;gap:var(--space-2)">
        <span style="font-size:1.2rem">🧠</span>
        <div>
          <strong style="color:#7C3AED">Analyse IA</strong>
          <p style="margin:8px 0 0;font-size:var(--text-sm)">${escapeHtml(data.ai_insight)}</p>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-4);text-align:center">
      <span class="text-secondary text-sm">Basé sur <strong>${data.data_points}</strong> jours de données historiques</span>
      ${data.cached ? '<span class="text-secondary text-sm"> · Résultats en cache</span>' : ''}
    </div>

    <!-- 7-Day Forecast -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Prévisions 7 jours</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        ${data.forecast.map(f => `
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div style="min-width:90px">
              <div style="font-weight:600;font-size:var(--text-sm)">${f.day_name}</div>
              <div class="text-secondary" style="font-size:10px">${f.date}</div>
            </div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px">
                <div style="flex:1;height:24px;background:var(--bg-sunken);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${(f.predicted_orders / maxOrders * 100).toFixed(0)}%;background:linear-gradient(90deg,#7C3AED,#A78BFA);border-radius:4px;display:flex;align-items:center;padding-left:8px">
                    <span style="color:white;font-size:11px;font-weight:600">${f.predicted_orders} cmd</span>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:var(--space-3);font-size:10px;color:var(--text-tertiary)">
                <span>${f.predicted_revenue.toFixed(0)} € prévu</span>
                ${f.trend_pct !== 0 ? `<span style="color:${f.trend_pct > 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
                  ${f.trend_pct > 0 ? '↑' : '↓'} ${Math.abs(f.trend_pct)}% vs moyenne
                </span>` : ''}
                <span style="color:${f.confidence === 'high' ? 'var(--color-success)' : f.confidence === 'medium' ? 'var(--color-warning)' : 'var(--text-tertiary)'}">
                  Confiance: ${f.confidence === 'high' ? 'haute' : f.confidence === 'medium' ? 'moyenne' : 'faible'}
                </span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Weekly Pattern & Peak Hours -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Pattern hebdo. moyen</h3>
        ${data.weekly_pattern.map(d => {
          const maxWeekly = Math.max(...data.weekly_pattern.map(w => w.avg_orders), 1);
          return `
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:6px">
            <span style="min-width:60px;font-size:var(--text-xs)">${d.day_name.slice(0, 3)}</span>
            <div style="flex:1;height:16px;background:var(--bg-sunken);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${(d.avg_orders / maxWeekly * 100).toFixed(0)}%;background:var(--color-accent);border-radius:3px"></div>
            </div>
            <span style="min-width:35px;text-align:right;font-size:var(--text-xs);font-weight:600">${d.avg_orders}</span>
          </div>`;
        }).join('')}
      </div>

      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Heures de pointe</h3>
        ${data.peak_hours.length === 0 ? '<p class="text-secondary text-sm">Pas assez de données</p>' : ''}
        ${data.peak_hours.map((h, i) => `
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:8px">
            <span style="font-size:1.2rem">${i === 0 ? '🔥' : i === 1 ? '🟠' : '🟡'}</span>
            <span style="font-weight:600;min-width:50px">${h.hour}</span>
            <span class="text-secondary text-sm">${h.count} commandes</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Stock suggestions -->
    ${data.stock_suggestions.length > 0 ? `
    <div class="card" style="padding:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Suggestion de commande (7j)</h3>
      <table class="table" style="font-size:var(--text-sm)">
        <thead>
          <tr>
            <th>Ingrédient</th>
            <th style="text-align:right">Besoin 7j</th>
            <th style="text-align:right">Stock actuel</th>
            <th style="text-align:right">À commander</th>
            <th>Urgence</th>
          </tr>
        </thead>
        <tbody>
          ${data.stock_suggestions.map(s => `
            <tr>
              <td>${escapeHtml(s.ingredient_name)}</td>
              <td style="text-align:right">${s.needed_7d} ${s.unit}</td>
              <td style="text-align:right">${s.current_stock} ${s.unit}</td>
              <td style="text-align:right;font-weight:600">${s.to_order} ${s.unit}</td>
              <td>
                <span style="padding:2px 8px;border-radius:12px;font-size:var(--text-xs);font-weight:600;background:${s.urgency === 'critical' ? 'rgba(239,68,68,0.1);color:#EF4444' : s.urgency === 'high' ? 'rgba(245,158,11,0.1);color:#F59E0B' : 'rgba(59,130,246,0.1);color:#3B82F6'}">
                  ${s.urgency === 'critical' ? 'Critique' : s.urgency === 'high' ? 'Élevée' : 'Normale'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
  `;
}
