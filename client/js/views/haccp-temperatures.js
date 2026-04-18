// ═══════════════════════════════════════════
// HACCP Temperatures — Route #/haccp/temperatures
// ═══════════════════════════════════════════

async function renderHACCPTemperatures() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [zones, logs] = await Promise.all([
      API.getHACCPZones(),
      API.getTemperatures({}),
    ]);

    const account = getAccount();
    const isGerant = account && account.role === 'gerant';

    app.innerHTML = `
      <div class="haccp-page">
        <nav aria-label="Breadcrumb" class="breadcrumb">
          <a href="#/haccp">HACCP</a>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">Températures</span>
        </nav>
        <div class="page-header">
          <h1><i data-lucide="thermometer" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Températures</h1>
          <button class="btn btn-primary" id="btn-new-temp" aria-label="Créer un nouveau relevé de température">
            <i data-lucide="plus" style="width:18px;height:18px" aria-hidden="true"></i> Nouveau relevé
          </button>
        </div>

        ${HACCP_SUBNAV_FULL}

        <!-- Filters -->
        <div class="haccp-filters" role="search" aria-label="Filtrer les relevés">
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <label for="filter-zone" class="visually-hidden">Zone</label>
            <select class="form-control" id="filter-zone" style="min-height:40px" aria-label="Filtrer par zone">
              <option value="">Toutes les zones</option>
              ${zones.map(z => `<option value="${z.id}">${escapeHtml(z.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1;min-width:120px">
            <label for="filter-date" class="visually-hidden">Date</label>
            <input type="date" class="form-control" id="filter-date" lang="fr" style="min-height:40px" aria-label="Filtrer par date">
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-filter">Filtrer</button>
        </div>

        <!-- Zone management (gérant only) -->
        ${isGerant ? `
        <details class="haccp-zones-manager">
          <summary class="btn btn-ghost btn-sm">⚙️ Gérer les zones</summary>
          <div class="haccp-zones-list" style="margin-top:var(--space-3)">
            ${zones.map(z => `
              <div class="haccp-zone-manage-row">
                <span>${escapeHtml(z.name)} (${z.min_temp}° / ${z.max_temp}°)</span>
                <div class="gap-8" style="display:flex">
                  <button class="btn btn-ghost btn-sm btn-edit-zone" data-id="${z.id}" data-name="${escapeHtml(z.name)}" data-type="${z.type}" data-min="${z.min_temp}" data-max="${z.max_temp}">✏️</button>
                  <button class="btn btn-ghost btn-sm btn-delete-zone" aria-label="Supprimer la zone" data-id="${z.id}" data-name="${escapeHtml(z.name)}">🗑️</button>
                </div>
              </div>
            `).join('')}
            <button class="btn btn-secondary btn-sm" id="btn-add-zone" style="margin-top:var(--space-2)">
              <i data-lucide="plus" style="width:16px;height:16px"></i> Ajouter une zone
            </button>
          </div>
        </details>
        ` : ''}

        <!-- Export -->
        <div class="haccp-export-bar">
          <label class="text-secondary text-sm">Export PDF :</label>
          <input type="date" class="form-control" id="export-from" lang="fr" style="min-height:36px;width:auto">
          <span class="text-secondary">→</span>
          <input type="date" class="form-control" id="export-to" lang="fr" style="min-height:36px;width:auto">
          <button class="btn btn-secondary btn-sm" id="btn-export-temp">📄 Exporter</button>
        </div>

        <!-- Table -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date / Heure</th>
                <th>Zone</th>
                <th>Temp °C</th>
                <th>Plage</th>
                <th>Statut</th>
                <th>Relevé par</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody id="temp-table-body">
              ${renderTempRows(logs)}
            </tbody>
          </table>
        </div>
        ${logs.length === 0 ? '<div class="empty-state"><p>Aucun relevé enregistré</p></div>' : ''}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    setupTemperatureEvents(zones);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderTempRows(logs) {
  return logs.map(log => {
    const date = new Date(log.recorded_at);
    const isAlert = log.is_alert;
    return `
      <tr class="${isAlert ? 'haccp-row-alert' : ''}">
        <td>${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${escapeHtml(log.zone_name)}</td>
        <td class="mono" style="font-weight:600;color:${isAlert ? 'var(--color-danger)' : 'var(--color-success)'}">${log.temperature.toFixed(1)}°C</td>
        <td class="mono text-secondary">${log.min_temp}° / ${log.max_temp}°</td>
        <td>${isAlert ? '<span class="badge badge--danger">⚠ ALERTE</span>' : '<span class="badge badge--success">✓ OK</span>'}</td>
        <td>${escapeHtml(log.recorded_by_name || '—')}</td>
        <td class="text-secondary">${escapeHtml(log.notes || '')}</td>
      </tr>
    `;
  }).join('');
}

function setupTemperatureEvents(zones) {
  // New temperature
  document.getElementById('btn-new-temp')?.addEventListener('click', () => {
    showNewTempModal(zones);
  });

  // Filter
  document.getElementById('btn-filter')?.addEventListener('click', async () => {
    const zone_id = document.getElementById('filter-zone').value;
    const date = document.getElementById('filter-date').value;
    const params = {};
    if (zone_id) params.zone_id = zone_id;
    if (date) params.date = date;
    const logs = await API.getTemperatures(params);
    document.getElementById('temp-table-body').innerHTML = renderTempRows(logs);
  });

  // Export
  document.getElementById('btn-export-temp')?.addEventListener('click', async () => {
    const from = document.getElementById('export-from').value;
    const to = document.getElementById('export-to').value;
    try {
      const url = await API.getHACCPExportUrl('temperatures', from, to);
      const a = document.createElement('a');
      a.href = url;
      a.download = `haccp-temperatures-${from || 'all'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('PDF exporté ✓', 'success');
    } catch (err) {
      showToast('Erreur export : ' + err.message, 'error');
    }
  });

  // Zone management
  document.querySelectorAll('.btn-edit-zone').forEach(btn => {
    btn.addEventListener('click', () => showZoneModal(btn.dataset));
  });

  document.querySelectorAll('.btn-delete-zone').forEach(btn => {
    btn.addEventListener('click', async () => {
      const zoneName = btn.dataset.name;
      showConfirmModal('Supprimer la zone', `Êtes-vous sûr de vouloir supprimer la zone "${zoneName}" et tous ses relevés ?`, async () => {
        try {
          await API.deleteHACCPZone(Number(btn.dataset.id));
          showToast('Zone supprimée', 'success');
          renderHACCPTemperatures();
        } catch (err) {
          showToast('Erreur : ' + err.message, 'error');
        }
      }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
      return;
    });
  });

  document.getElementById('btn-add-zone')?.addEventListener('click', () => showZoneModal(null));
}

function showNewTempModal(zones) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'new-temp-modal-title');
  overlay.innerHTML = `
    <div class="modal">
      <h2 id="new-temp-modal-title"><i data-lucide="thermometer" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Nouveau relevé</h2>
      <div class="form-group">
        <label for="modal-zone">Zone</label>
        <select class="form-control" id="modal-zone" aria-required="true">
          ${zones.map(z => `<option value="${z.id}" data-min="${z.min_temp}" data-max="${z.max_temp}">${escapeHtml(z.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="modal-temp">Température (°C)</label>
        <input type="number" step="0.1" class="form-control" id="modal-temp" placeholder="ex: 3.5" inputmode="decimal"
               required aria-required="true"
               style="font-size:var(--text-2xl);text-align:center;font-family:var(--font-mono)">
      </div>
      <div class="form-group">
        <label for="modal-notes">Notes (optionnel)</label>
        <input type="text" class="form-control" id="modal-notes" placeholder="ex: porte restée ouverte">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="modal-cancel">Annuler</button>
        <button class="btn btn-primary" id="modal-save" style="min-width:140px">
          <i data-lucide="check" style="width:18px;height:18px" aria-hidden="true"></i> Enregistrer
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const releaseFocus = trapFocus(overlay);
  const closeModal = () => { try { releaseFocus(); } catch {} overlay.remove(); };
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', async () => {
    const zoneId = Number(document.getElementById('modal-zone').value);
    const tempInput = document.getElementById('modal-temp');
    const temperature = parseFloat(tempInput.value);
    if (isNaN(temperature)) {
      tempInput.classList.add('form-control--error');
      tempInput.setAttribute('aria-invalid', 'true');
      return;
    }
    tempInput.removeAttribute('aria-invalid');
    const notes = document.getElementById('modal-notes').value.trim();
    try {
      await API.recordTemperature({
        zone_id: zoneId,
        temperature,
        notes: notes || null,
        recorded_by: account ? account.id : null
      });
      closeModal();
      showToast('Relevé enregistré ✓', 'success');
      renderHACCPTemperatures();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}

function showZoneModal(data) {
  const isEdit = !!data && data.id;
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'zone-modal-title');
  overlay.innerHTML = `
    <div class="modal">
      <h2 id="zone-modal-title">${isEdit ? '<i data-lucide="pencil" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Modifier la zone' : '<i data-lucide="plus" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Nouvelle zone'}</h2>
      <div class="form-group">
        <label for="zone-name">Nom</label>
        <input type="text" class="form-control" id="zone-name" value="${isEdit ? escapeHtml(data.name) : ''}" placeholder="ex: Frigo 3" required aria-required="true">
      </div>
      <div class="form-group">
        <label for="zone-type">Type</label>
        <select class="form-control" id="zone-type">
          <option value="fridge" ${isEdit && data.type === 'fridge' ? 'selected' : ''}>Frigo</option>
          <option value="freezer" ${isEdit && data.type === 'freezer' ? 'selected' : ''}>Congélateur</option>
          <option value="cold_room" ${isEdit && data.type === 'cold_room' ? 'selected' : ''}>Chambre froide</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="zone-min">Temp min (°C)</label>
          <input type="number" step="0.5" class="form-control" id="zone-min" value="${isEdit ? data.min : '0'}">
        </div>
        <div class="form-group">
          <label for="zone-max">Temp max (°C)</label>
          <input type="number" step="0.5" class="form-control" id="zone-max" value="${isEdit ? data.max : '4'}">
        </div>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="zone-cancel">Annuler</button>
        <button class="btn btn-primary" id="zone-save">${isEdit ? 'Modifier' : 'Créer'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const releaseFocus = trapFocus(overlay);
  const closeModal = () => { try { releaseFocus(); } catch {} overlay.remove(); };
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('zone-cancel').addEventListener('click', closeModal);
  document.getElementById('zone-save').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('zone-name').value.trim(),
      type: document.getElementById('zone-type').value,
      min_temp: parseFloat(document.getElementById('zone-min').value),
      max_temp: parseFloat(document.getElementById('zone-max').value),
    };
    if (!payload.name) { showToast('Le nom est requis', 'error'); return; }
    try {
      if (isEdit) {
        await API.updateHACCPZone(Number(data.id), payload);
      } else {
        await API.createHACCPZone(payload);
      }
      closeModal();
      showToast(isEdit ? 'Zone modifiée ✓' : 'Zone créée ✓', 'success');
      renderHACCPTemperatures();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
