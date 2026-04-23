// ═══════════════════════════════════════════
// Stock Movements — Historique #/stock/movements
// ═══════════════════════════════════════════

async function renderStockMovements() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="view-header">
      <div>
        <nav aria-label="Breadcrumb" class="breadcrumb">
          <a href="#/stock">Stock</a>
          <span class="breadcrumb-sep" aria-hidden="true">›</span>
          <span class="breadcrumb-current">Mouvements</span>
        </nav>
        <h1><i data-lucide="trending-up" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Mouvements de stock</h1>
        <p class="text-secondary">Historique des entrées et sorties</p>
      </div>
    </div>

    <div class="movements-filters" style="display:flex;gap:var(--space-3);margin-bottom:var(--space-5);flex-wrap:wrap">
      <select id="mv-type-filter" class="input" style="min-width:140px">
        <option value="">Tous les types</option>
        <option value="reception">📥 Réception</option>
        <option value="consumption">📤 Consommation</option>
        <option value="loss">❌ Perte</option>
        <option value="adjustment">🔄 Ajustement</option>
        <option value="inventory">📋 Inventaire</option>
      </select>
      <input type="date" id="mv-from" class="input" lang="fr" style="min-width:140px">
      <input type="date" id="mv-to" class="input" lang="fr" style="min-width:140px">
      <button class="btn btn-secondary" id="mv-export-btn">📄 Export PDF</button>
    </div>

    <div id="movements-content">
      <div class="loading-spinner" style="text-align:center;padding:var(--space-8)">Chargement...</div>
    </div>
  `;

  // Set default dates (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  document.getElementById('mv-from').value = thirtyDaysAgo.toISOString().slice(0, 10);
  document.getElementById('mv-to').value = now.toISOString().slice(0, 10);

  const loadMovements = async () => {
    const type = document.getElementById('mv-type-filter').value;
    const from = document.getElementById('mv-from').value;
    const to = document.getElementById('mv-to').value;

    const params = {};
    if (type) params.type = type;
    if (from) params.from = from;
    if (to) params.to = to;

    try {
      const movements = await API.getStockMovements(params);
      renderMovementsList(movements);
    } catch (e) {
      document.getElementById('movements-content').innerHTML = `
        <div class="empty-state"><p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p></div>
      `;
    }
  };

  document.getElementById('mv-type-filter').addEventListener('change', loadMovements);
  document.getElementById('mv-from').addEventListener('change', loadMovements);
  document.getElementById('mv-to').addEventListener('change', loadMovements);

  document.getElementById('mv-export-btn').addEventListener('click', async () => {
    const from = document.getElementById('mv-from').value;
    const to = document.getElementById('mv-to').value;
    try {
      const url = await API.getStockExportUrl(from, to);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-mouvements-${from || 'all'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF exporté', 'success');
    } catch (e) {
      showToast('Erreur export PDF', 'error');
    }
  });

  await loadMovements();
}

function renderMovementsList(movements) {
  const content = document.getElementById('movements-content');

  if (movements.length === 0) {
    content.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:var(--space-10)">
        <div style="font-size:3rem;margin-bottom:var(--space-4)">📊</div>
        <p class="text-secondary">Aucun mouvement trouvé</p>
      </div>
    `;
    return;
  }

  const typeConfig = {
    reception:   { icon: '📥', label: 'Réception',    color: 'var(--color-success)' },
    consumption: { icon: '📤', label: 'Consommation', color: 'var(--color-warning)' },
    loss:        { icon: '❌', label: 'Perte',        color: 'var(--color-danger)' },
    adjustment:  { icon: '🔄', label: 'Ajustement',   color: 'var(--color-info)' },
    inventory:   { icon: '📋', label: 'Inventaire',   color: 'var(--text-secondary)' }
  };

  // Group by date
  const grouped = {};
  for (const mv of movements) {
    const date = new Date(mv.recorded_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(mv);
  }

  content.innerHTML = Object.entries(grouped).map(([date, items]) => `
    <div class="movements-day" style="margin-bottom:var(--space-5)">
      <h3 style="margin-bottom:var(--space-3);color:var(--text-secondary);font-size:var(--text-sm);text-transform:capitalize">${date}</h3>
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${items.map(mv => {
          const cfg = typeConfig[mv.movement_type] || { icon: '❓', label: mv.movement_type, color: 'var(--text-secondary)' };
          const time = new Date(mv.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const sign = mv.movement_type === 'reception' ? '+' : mv.movement_type === 'loss' ? '-' : '';
          return `
            <div class="movement-item" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-light)">
              <div style="font-size:1.5rem;flex-shrink:0">${cfg.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                  <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(mv.ingredient_name)}</span>
                  <span class="data-value" style="font-weight:600;color:${cfg.color}">${sign}${mv.quantity} ${mv.unit}</span>
                </div>
                <div style="display:flex;gap:var(--space-3);font-size:var(--text-xs);color:var(--text-tertiary);flex-wrap:wrap">
                  <span>${cfg.label}</span>
                  <span>${time}</span>
                  ${mv.supplier_name ? `<span>Fourn: ${escapeHtml(mv.supplier_name)}</span>` : ''}
                  ${mv.batch_number ? `<span>Lot: ${mv.batch_number}</span>` : ''}
                  ${mv.unit_price != null ? `<span>${mv.unit_price.toFixed(2)}€/u</span>` : ''}
                  ${mv.recorded_by_name ? `<span>Par: ${escapeHtml(mv.recorded_by_name)}</span>` : ''}
                </div>
                ${mv.reason ? `<div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px;font-style:italic">${escapeHtml(mv.reason)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}
