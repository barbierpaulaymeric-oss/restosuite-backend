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
      <section class="haccp-page" role="region" aria-label="Traçabilité HACCP">
        <div class="page-header">
          <h1><i data-lucide="package" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Traçabilité</h1>
          <button class="btn btn-primary" id="btn-new-reception" aria-label="Nouvelle réception de marchandise">
            <i data-lucide="plus" style="width:18px;height:18px" aria-hidden="true"></i> Réception
          </button>
        </div>

        ${haccpBreadcrumb('tracabilite')}

        ${dlcAlerts.length > 0 ? `
        <div class="haccp-dlc-alert-banner" role="alert" aria-live="polite">
          <i data-lucide="alert-triangle" style="width:20px;height:20px" aria-hidden="true"></i>
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
        <div class="haccp-filters" role="search" aria-label="Filtres de traçabilité">
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <label for="filter-date" class="visually-hidden">Filtrer par date</label>
            <input type="date" class="form-control" id="filter-date" lang="fr" style="min-height:40px" placeholder="Date" aria-label="Filtrer par date">
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <label for="filter-supplier" class="visually-hidden">Filtrer par fournisseur</label>
            <input type="text" class="form-control" id="filter-supplier" style="min-height:40px" placeholder="Fournisseur" aria-label="Filtrer par fournisseur">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-filter" aria-label="Appliquer les filtres">Filtrer</button>
        </div>

        <!-- Export -->
        <div class="haccp-export-bar" role="group" aria-label="Export PDF de traçabilité">
          <label for="export-from" class="text-secondary text-sm">Export PDF :</label>
          <input type="date" class="form-control" id="export-from" lang="fr" style="min-height:36px;width:auto" aria-label="Date de début export">
          <span class="text-secondary" aria-hidden="true">→</span>
          <label for="export-to" class="visually-hidden">Date de fin export</label>
          <input type="date" class="form-control" id="export-to" lang="fr" style="min-height:36px;width:auto" aria-label="Date de fin export">
          <button class="btn btn-secondary btn-sm" id="btn-export-trace" aria-label="Exporter en PDF">📄 Exporter</button>
        </div>

        <!-- Table -->
        <div class="table-container" role="region" aria-label="Liste des réceptions" tabindex="0">
          <table>
            <caption class="visually-hidden">Journal de traçabilité des réceptions</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Produit</th>
                <th scope="col">N° BL</th>
                <th scope="col">Fournisseur</th>
                <th scope="col">N° Lot</th>
                <th scope="col">DLC</th>
                <th scope="col">DDM</th>
                <th scope="col">T° Réc.</th>
                <th scope="col">Emballage</th>
                <th scope="col">Aspect organo.</th>
                <th scope="col">Quantité</th>
                <th scope="col">Reçu par</th>
              </tr>
            </thead>
            <tbody id="trace-table-body" aria-live="polite">
              ${renderTraceRows(logs)}
            </tbody>
          </table>
        </div>
        ${logs.length === 0 ? '<div class="empty-state" role="status"><p>Aucune réception enregistrée</p></div>' : ''}
      </section>
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
        <td class="mono">${escapeHtml(log.numero_bl || '—')}</td>
        <td>${escapeHtml(log.supplier || '—')}</td>
        <td class="mono">${escapeHtml(log.batch_number || '—')}</td>
        <td class="${dlcClass}" style="font-weight:${dlcDays !== null && dlcDays <= 3 ? '600' : '400'}">
          ${log.dlc ? new Date(log.dlc).toLocaleDateString('fr-FR') : '—'}
          ${dlcDays !== null && dlcDays <= 3 && dlcDays >= 0 ? ` <span class="badge badge--warning">J-${dlcDays}</span>` : ''}
          ${dlcDays !== null && dlcDays < 0 ? ' <span class="badge badge--danger">Dépassée</span>' : ''}
        </td>
        <td>${log.ddm ? new Date(log.ddm).toLocaleDateString('fr-FR') : '—'}</td>
        <td class="mono">${log.temperature_at_reception != null ? log.temperature_at_reception + '°C' : '—'}</td>
        <td>${escapeHtml(log.etat_emballage || '—')}</td>
        <td>${escapeHtml(log.conformite_organoleptique || '—')}</td>
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
      <h2 id="modal-reception-title"><i data-lucide="package" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Réception marchandise</h2>
      <div class="form-group">
        <label for="rec-product">Produit *</label>
        <input type="text" class="form-control" id="rec-product" placeholder="ex: Filet de bœuf" autofocus required aria-required="true">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="rec-supplier">Fournisseur</label>
          <input type="text" class="form-control" id="rec-supplier" placeholder="ex: Metro">
        </div>
        <div class="form-group">
          <label for="rec-batch">N° de lot</label>
          <input type="text" class="form-control" id="rec-batch" placeholder="ex: LOT2024-001">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="rec-numero-bl">N° Bon de livraison</label>
          <input type="text" class="form-control" id="rec-numero-bl" placeholder="ex: BL-2026-04512">
        </div>
        <div class="form-group">
          <label for="rec-temp">T° à réception (°C)</label>
          <input type="number" step="0.1" class="form-control" id="rec-temp" placeholder="ex: 3.5" inputmode="decimal">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="rec-dlc">DLC</label>
          <input type="date" class="form-control" id="rec-dlc" lang="fr">
        </div>
        <div class="form-group">
          <label for="rec-ddm">DDM (Date de Durabilité Minimale)</label>
          <input type="date" class="form-control" id="rec-ddm" lang="fr">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="rec-qty">Quantité</label>
          <input type="number" step="0.01" class="form-control" id="rec-qty" placeholder="ex: 5" inputmode="decimal">
        </div>
        <div class="form-group">
          <label for="rec-unit">Unité</label>
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
        <label for="rec-emballage">État de l'emballage</label>
        <select class="form-control" id="rec-emballage">
          <option value="">— Sélectionner —</option>
          <option value="Conforme">Conforme</option>
          <option value="Légèrement abîmé">Légèrement abîmé</option>
          <option value="Abîmé — refusé">Abîmé — refusé</option>
          <option value="Gonflé">Gonflé</option>
          <option value="Ouvert">Ouvert</option>
        </select>
      </div>
      <div class="form-group">
        <label for="rec-organo">Conformité organoleptique (aspect, odeur, couleur)</label>
        <select class="form-control" id="rec-organo">
          <option value="">— Sélectionner —</option>
          <option value="Conforme">Conforme</option>
          <option value="Odeur anormale">Odeur anormale</option>
          <option value="Couleur anormale">Couleur anormale</option>
          <option value="Texture anormale">Texture anormale</option>
          <option value="Non conforme — refusé">Non conforme — refusé</option>
        </select>
      </div>
      <div class="form-group">
        <label for="rec-notes">Notes</label>
        <input type="text" class="form-control" id="rec-notes" placeholder="ex: Remarque complémentaire">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="rec-cancel" aria-label="Annuler la saisie">Annuler</button>
        <button class="btn btn-primary" id="rec-save" style="min-width:160px" aria-label="Enregistrer la réception">
          <i data-lucide="check" style="width:18px;height:18px" aria-hidden="true"></i> Enregistrer
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
      numero_bl: document.getElementById('rec-numero-bl').value.trim() || null,
      dlc: document.getElementById('rec-dlc').value || null,
      ddm: document.getElementById('rec-ddm').value || null,
      temperature_at_reception: document.getElementById('rec-temp').value ? parseFloat(document.getElementById('rec-temp').value) : null,
      quantity: document.getElementById('rec-qty').value ? parseFloat(document.getElementById('rec-qty').value) : null,
      unit: document.getElementById('rec-unit').value,
      etat_emballage: document.getElementById('rec-emballage').value || null,
      conformite_organoleptique: document.getElementById('rec-organo').value || null,
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
