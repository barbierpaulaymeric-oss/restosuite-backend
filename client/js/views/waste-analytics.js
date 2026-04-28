// ═══════════════════════════════════════════
// RestoSuite — Pertes & gaspillage (analytics)
// Aggregates POST /api/stock/loss into a 12-week trend, top wasted
// ingredients, breakdown by reason, and waste % of food cost.
// ═══════════════════════════════════════════

let _wasteCurrentDays = 84; // 12 weeks default

async function renderWasteAnalytics() {
  const app = document.getElementById('app');
  let account = getAccount();

  // Stale-localStorage refresh — match the analytics view pattern.
  const _staleAccount = !account || !account.role || account.permissions == null;
  if (_staleAccount) {
    try {
      const me = await API.getMe();
      if (me && me.account) {
        try { localStorage.setItem('restosuite_account', JSON.stringify(me.account)); } catch {}
        account = me.account;
      }
    } catch (_) { /* /auth/me handles cleanup if dead */ }
  }

  const isGerant = account && account.role === 'gerant';
  const perms = (() => {
    if (!account) return {};
    return typeof account.permissions === 'string'
      ? (JSON.parse(account.permissions || '{}') || {})
      : (account.permissions || {});
  })();
  const canView = isGerant || perms.view_costs;

  if (!canView) {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="lock"></i></div>
        <p>Accès réservé au gérant</p>
        <a href="#/" class="btn btn-primary">Retour</a>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  app.innerHTML = `
    <div class="view-header">
      <nav aria-label="Breadcrumb" class="breadcrumb">
        <a href="#/">Accueil</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <a href="#/analytics">Pilotage</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <span class="breadcrumb-current">Pertes</span>
      </nav>
      <h1><i data-lucide="trash-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Pertes & gaspillage</h1>
      <p class="text-secondary">Coût des pertes, tendance hebdomadaire et top des ingrédients gaspillés</p>
    </div>
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <button class="btn btn-sm waste-period-btn" data-days="28">4 sem.</button>
      <button class="btn btn-sm waste-period-btn" data-days="84">12 sem.</button>
      <button class="btn btn-sm waste-period-btn" data-days="180">6 mois</button>
      <button class="btn btn-sm waste-period-btn" data-days="365">12 mois</button>
    </div>
    <div id="waste-content">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;
  lucide.createIcons();

  app.querySelectorAll('.waste-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _wasteCurrentDays = Number(btn.dataset.days) || 84;
      _loadWasteData();
    });
  });

  _loadWasteData();
}

async function _loadWasteData() {
  const container = document.getElementById('waste-content');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  // Highlight active period button
  document.querySelectorAll('.waste-period-btn').forEach(b => {
    const active = Number(b.dataset.days) === _wasteCurrentDays;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-secondary', !active);
  });

  let data;
  try {
    data = await API.getAnalyticsWaste(_wasteCurrentDays);
  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="alert-triangle"></i></div>
        <p>Erreur de chargement</p>
        <p class="text-secondary text-sm">${escapeHtml(e.message || '')}</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  if (!data || data.total_count === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8) var(--space-4)">
        <div class="empty-icon"><i data-lucide="check-circle-2" style="width:48px;height:48px;color:var(--color-success)"></i></div>
        <h3 style="margin:var(--space-3) 0 var(--space-1)">Aucune perte enregistrée</h3>
        <p class="text-secondary">Sur les ${_wasteCurrentDays} derniers jours. Enregistrez vos pertes depuis Stock &amp; Réception &gt; Perte / casse.</p>
        <a href="#/stock" class="btn btn-primary" style="margin-top:var(--space-4)">
          <i data-lucide="warehouse" style="width:16px;height:16px"></i> Aller au stock
        </a>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const fmtEur = (n) => `${(Math.round(Number(n) * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const fmtNum = (n) => Number(n).toLocaleString('fr-FR');

  container.innerHTML = `
    <!-- KPIs -->
    <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);margin-bottom:var(--space-5)">
      ${_wasteKpiCard('Coût total des pertes', fmtEur(data.total_cost), 'banknote', 'var(--color-danger)')}
      ${_wasteKpiCard('% du coût matière', `${(data.waste_pct_of_food_cost || 0).toFixed(1)} %`, 'percent', data.waste_pct_of_food_cost > 5 ? 'var(--color-danger)' : data.waste_pct_of_food_cost > 2 ? 'var(--color-warning)' : 'var(--color-success)')}
      ${_wasteKpiCard('Mouvements de perte', fmtNum(data.total_count), 'list', 'var(--color-accent)')}
      ${_wasteKpiCard('Réceptions sur la période', fmtEur(data.reception_cost), 'truck', 'var(--text-secondary)')}
    </div>

    <!-- Weekly trend chart -->
    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
      <h3 style="margin:0 0 var(--space-3);font-size:var(--text-base)">
        <i data-lucide="trending-down" style="width:16px;height:16px;vertical-align:middle"></i>
        Tendance hebdomadaire
      </h3>
      ${_wasteWeeklyChart(data.weekly || [])}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--space-4)">
      <!-- Top wasted ingredients -->
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--space-4)">
        <h3 style="margin:0 0 var(--space-3);font-size:var(--text-base)">
          <i data-lucide="package-x" style="width:16px;height:16px;vertical-align:middle"></i>
          Top ingrédients gaspillés
        </h3>
        ${_wasteIngredientsTable(data.top_ingredients || [], data.total_cost)}
      </div>

      <!-- By reason -->
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--space-4)">
        <h3 style="margin:0 0 var(--space-3);font-size:var(--text-base)">
          <i data-lucide="tag" style="width:16px;height:16px;vertical-align:middle"></i>
          Par motif
        </h3>
        ${_wasteReasonsTable(data.by_reason || [], data.total_cost)}
      </div>
    </div>
  `;
  lucide.createIcons();
}

function _wasteKpiCard(label, value, icon, color) {
  return `
    <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4)">
      <div style="display:flex;align-items:center;gap:var(--space-2);color:var(--text-secondary);font-size:var(--text-xs);margin-bottom:var(--space-1)">
        <i data-lucide="${icon}" style="width:14px;height:14px;color:${color}"></i>
        ${escapeHtml(label)}
      </div>
      <div style="font-size:var(--text-2xl);font-weight:600;color:${color};font-variant-numeric:tabular-nums">${value}</div>
    </div>
  `;
}

function _wasteWeeklyChart(weeks) {
  if (!weeks.length) return '<p class="text-secondary text-sm">Pas de données</p>';
  const W = 800, H = 180, P = { l: 48, r: 12, t: 12, b: 28 };
  const innerW = W - P.l - P.r;
  const innerH = H - P.t - P.b;
  const max = Math.max(1, ...weeks.map(w => w.cost || 0));
  const step = innerW / Math.max(1, weeks.length - 1);

  const points = weeks.map((w, i) => {
    const x = P.l + i * step;
    const y = P.t + innerH - (max > 0 ? (w.cost / max) * innerH : 0);
    return [x, y, w];
  });

  const polyline = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dots = points.map(([x, y, w]) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--color-danger)">
       <title>${w.week_start} — ${w.cost.toFixed(2)} €</title>
     </circle>`
  ).join('');

  // Y-axis labels (4 ticks)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const v = max * t;
    const y = P.t + innerH - t * innerH;
    return `
      <line x1="${P.l}" x2="${W - P.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border-color)" stroke-dasharray="2,3" />
      <text x="${P.l - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-tertiary)" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${v.toFixed(0)} €</text>
    `;
  }).join('');

  // X-axis labels — show first/middle/last only to avoid clutter
  const labelIdx = [0, Math.floor(weeks.length / 2), weeks.length - 1];
  const xLabels = labelIdx.map(i => {
    if (i < 0 || i >= weeks.length) return '';
    const [x] = points[i];
    const date = new Date(weeks[i].week_start);
    const lbl = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    return `<text x="${x.toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">${lbl}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" role="img" aria-label="Coût des pertes par semaine">
      ${ticks}
      <polyline points="${polyline}" fill="none" stroke="var(--color-danger)" stroke-width="2" />
      ${dots}
      ${xLabels}
    </svg>
  `;
}

function _wasteIngredientsTable(items, total) {
  if (!items.length) return '<p class="text-secondary text-sm">Pas de données</p>';
  const rows = items.map(it => {
    const pct = total > 0 ? (it.cost / total) * 100 : 0;
    const qty = (Number(it.quantity) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    return `
      <tr>
        <td style="padding:6px 8px">
          <div style="font-weight:500">${escapeHtml(it.ingredient_name)}</div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary)">${escapeHtml(it.category || '')}</div>
        </td>
        <td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-secondary)">${qty}</td>
        <td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:var(--color-danger)">${it.cost.toFixed(2)} €</td>
        <td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text-tertiary);font-size:var(--text-xs)">${pct.toFixed(0)}%</td>
      </tr>
    `;
  }).join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
      <thead style="border-bottom:1px solid var(--border-color);color:var(--text-secondary);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.04em">
        <tr>
          <th style="padding:6px 8px;text-align:left;font-weight:500">Ingrédient</th>
          <th style="padding:6px 8px;text-align:right;font-weight:500">Quantité</th>
          <th style="padding:6px 8px;text-align:right;font-weight:500">Coût</th>
          <th style="padding:6px 8px;text-align:right;font-weight:500">%</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function _wasteReasonsTable(reasons, total) {
  if (!reasons.length) return '<p class="text-secondary text-sm">Pas de données</p>';
  return `
    <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:var(--space-2)">
      ${reasons.map(r => {
        const pct = total > 0 ? (r.cost / total) * 100 : 0;
        return `
          <li>
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:var(--space-2);margin-bottom:4px">
              <span style="font-size:var(--text-sm)">${escapeHtml(r.reason)}</span>
              <span style="font-variant-numeric:tabular-nums;color:var(--color-danger);font-weight:600">${r.cost.toFixed(2)} €</span>
            </div>
            <div style="height:6px;background:var(--bg-secondary,var(--border-color));border-radius:3px;overflow:hidden">
              <div style="width:${Math.max(2, pct).toFixed(1)}%;height:100%;background:var(--color-danger)"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px">
              <span>${r.count} mouvement${r.count > 1 ? 's' : ''}</span>
              <span>${pct.toFixed(0)}% du total</span>
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}
