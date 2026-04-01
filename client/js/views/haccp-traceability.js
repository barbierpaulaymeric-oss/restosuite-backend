// ═══════════════════════════════════════════
// HACCP Traceability — Route #/haccp/traceability
// ═══════════════════════════════════════════

async function renderHACCPTraceability() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [logs, dlcAlerts] = await Promise.all([
      API.getTraceability(),
      API.getDLCAlerts(),
    ]);

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1>📦 Traçabilité</h1>
          <button class="btn btn-primary" id="btn-new-reception">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Réception
          </button>
        </div>

        <div class="haccp-subnav">
          <a href="#/haccp" class="haccp-subnav__link">Dashboard</a>
          <a href="#/haccp/temperatures" class="haccp-subnav__link">Températures</a>
          <a href="#/haccp/cleaning" class="haccp-subnav__link">Nettoyage</a>
          <a href="#/haccp/traceability" class="haccp-subnav__link active">Traçabilité</a>
        </div>

        ${dlcAlerts.length > 0 ? `
        <div class="haccp-dlc-alert-banner">
          <i data-lucide="alert-triangle" style="width:20px;height:20px"></i>
          <div>
            <strong>${dlcAlerts.length} produit(s) proche(s) de la DLC</strong>
            <div class="haccp-dlc-alert-list">
              ${dlcAlerts.map(a => {
                const days = Math.ceil(a.days_until_dlc);
                return `<span class="haccp-dlc-alert-item">${escapeHtml(a.product_name)} — ${days < 0 ? 'DLC dépassée' : `J-${days}`}</span>`;
              }).join('')}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Filters -->
        <div class="haccp-filters">
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <input type="date" class="form-control" id="filter-date" style="min-height:40px" placeholder="Date">
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <input type="text" class="form-control" id="filter-supplier" style="min-height:40px" placeholder="Fournisseur">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-filter">Filtrer</button>
        </div>

        <!-- Export -->
        <div class="haccp-export-bar">
          <label class="text-secondary text-sm">Export PDF :</label>
          <input type="date" class="form-control" id="export-from" style="min-height:36px;width:auto">
          <span class="text-secondary">→</span>
          <input type="date" class="form-control" id="export-to" style="min-height:36px;width:auto">
          <button class="btn btn-secondary btn-sm" id="btn-export-trace">📄 Exporter</button>
        </div>

        <!-- Table -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Produit</th>
                <th>Fournisseur</th>
                <th>N° Lot</th>
                <th>DLC</th>
                <th>T° Réc.</th>
                <th>Quantité</th>
                <th>Reçu par</th>
              </tr>
            </thead>
            <tbody id="trace-table-body">
              ${renderTraceRows(logs)}
            </tbody>
          </table>
        </div>
        ${logs.length === 0 ? '<div class="empty-state"><p>Aucune réception enregistrée</p></div>' : ''}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    setupTraceEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderTraceRows(logs) {
  return logs.map(log => {
    const date = new Date(log.received_at);
    const dlcDays = log.dlc ? Math.ceil((new Date(log.dlc) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    const dlcClass = dlcDays !== null && dlcDays <= 3 ? (dlcDays < 0 ? 'text-danger' : 'text-warning') : '';
    return `
      <tr>
        <td>${date.toLocaleDateString('fr-FR')}</td>
        <td style="font-weight:500">${escapeHtml(log.product_name)}</td>
        <td>${escapeHtml(log.supplier || '—')}</td>
        <td class="mono">${escapeHtml(log.batch_number || '—')}</td>
        <td class="${dlcClass}" style="font-weight:${dlcDays !== null && dlcDays <= 3 ? '600' : '400'}">
          ${log.dlc ? new Date(log.dlc).toLocaleDateString('fr-FR') : '—'}
          ${dlcDays !== null && dlcDays <= 3 && dlcDays >= 0 ? ` <span class="badge badge--warning">J-${dlcDays}</span>` : ''}
          ${dlcDays !== null && dlcDays < 0 ? ' <span class="badge badge--danger">Dépassée</span>' : ''}
        </td>
        <td class="mono">${log.temperature_at_reception != null ? log.temperature_at_reception + '°C' : '—'}</td>
        <td class="mono">${log.quantity != null ? `${log.quantity} ${log.unit || ''}` : '—'}</td>
        <td>${escapeHtml(log.received_by_name || '—')}</td>
      </tr>
    `;
  }).join('');
}

function setupTraceEvents() {
  // New reception
  document.getElementById('btn-new-reception')?.addEventListener('click', () => showReceptionModal());

  // Filter
  document.getElementById('btn-filter')?.addEventListener('click', async () => {
    const date = document.getElementById('filter-date').value;
    const supplier = document.getElementById('filter-supplier').value.trim();
    const params = {};
    if (date) params.date = date;
    if (supplier) params.supplier = supplier;
    const logs = await API.getTraceability(Object.keys(params).length ? params : null);
    document.getElementById('trace-table-body').innerHTML = renderTraceRows(logs);
  });

  // Export
  document.getElementById('btn-export-trace')?.addEventListener('click', async () => {
    const from = document.getElementById('export-from').value;
    const to = document.getElementById('export-to').value;
    try {
      const url = await API.getHACCPExportUrl('traceability', from, to);
      const a = document.createElement('a');
      a.href = url;
      a.download = `haccp-tracabilite-${from || 'all'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF exporté ✓', 'success');
    } catch (err) {
      showToast('Erreur export : ' + err.message, 'error');
    }
  });
}

function showReceptionModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h2>📦 Réception marchandise</h2>
      <div class="form-group">
        <label>Produit *</label>
        <input type="text" class="form-control" id="rec-product" placeholder="ex: Filet de bœuf" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fournisseur</label>
          <input type="text" class="form-control" id="rec-supplier" placeholder="ex: Metro">
        </div>
        <div class="form-group">
          <label>N° de lot</label>
          <input type="text" class="form-control" id="rec-batch" placeholder="ex: LOT2024-001">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>DLC</label>
          <input type="date" class="form-control" id="rec-dlc">
        </div>
        <div class="form-group">
          <label>T° à réception (°C)</label>
          <input type="number" step="0.1" class="form-control" id="rec-temp" placeholder="ex: 3.5" inputmode="decimal">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Quantité</label>
          <input type="number" step="0.01" class="form-control" id="rec-qty" placeholder="ex: 5" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Unité</label>
          <select class="form-control" id="rec-unit">
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="l">l</option>
            <option value="pièce">pièce</option>
            <option value="botte">botte</option>
            <option value="carton">carton</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="rec-notes" placeholder="ex: Emballage légèrement abîmé">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="rec-cancel">Annuler</button>
        <button class="btn btn-primary" id="rec-save" style="min-width:160px">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('rec-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('rec-save').addEventListener('click', async () => {
    const product_name = document.getElementById('rec-product').value.trim();
    if (!product_name) {
      document.getElementById('rec-product').classList.add('form-control--error');
      return;
    }
    const payload = {
      product_name,
      supplier: document.getElementById('rec-supplier').value.trim() || null,
      batch_number: document.getElementById('rec-batch').value.trim() || null,
      dlc: document.getElementById('rec-dlc').value || null,
      temperature_at_reception: document.getElementById('rec-temp').value ? parseFloat(document.getElementById('rec-temp').value) : null,
      quantity: document.getElementById('rec-qty').value ? parseFloat(document.getElementById('rec-qty').value) : null,
      unit: document.getElementById('rec-unit').value,
      received_by: account ? account.id : null,
      notes: document.getElementById('rec-notes').value.trim() || null,
    };
    try {
      await API.createTraceability(payload);
      overlay.remove();
      showToast('Réception enregistrée ✓', 'success');
      renderHACCPTraceability();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
