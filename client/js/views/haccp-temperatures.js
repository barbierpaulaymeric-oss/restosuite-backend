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
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-secondary" id="btn-batch-temps" aria-label="Saisie groupée de tous les relevés" aria-expanded="false">
              <i data-lucide="table-2" style="width:18px;height:18px" aria-hidden="true"></i> Saisie groupée
            </button>
            <button class="btn btn-primary" id="btn-new-temp" aria-label="Créer un nouveau relevé de température">
              <i data-lucide="plus" style="width:18px;height:18px" aria-hidden="true"></i> Nouveau relevé
            </button>
          </div>
        </div>

        ${haccpBreadcrumb('temperatures')}

        <!-- Batch entry panel -->
        <div id="batch-temp-panel" style="display:none;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)">
          <h2 style="margin:0 0 var(--space-3) 0;font-size:var(--text-base)">
            <i data-lucide="table-2" style="width:18px;height:18px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>
            Saisie groupée — ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <div style="overflow-x:auto">
            <table class="data-table" style="width:100%;min-width:480px" role="grid" aria-label="Saisie groupée des températures">
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col" style="width:140px">Température (°C)</th>
                  <th scope="col" style="width:120px">Conformité</th>
                </tr>
              </thead>
              <tbody id="batch-zones-body">
                ${zones.map(z => `
                  <tr data-zone-id="${z.id}" data-min="${z.min_temp}" data-max="${z.max_temp}">
                    <td style="font-weight:500">${escapeHtml(z.name)}<br><span class="text-secondary" style="font-size:11px">Seuil : ${z.min_temp}° / ${z.max_temp}°</span></td>
                    <td>
                      <input type="number" class="input batch-temp-input" step="0.1"
                        placeholder="—" style="max-width:110px;font-size:var(--text-sm)"
                        aria-label="Température pour ${escapeHtml(z.name)}">
                    </td>
                    <td>
                      <span class="batch-conform-badge badge" style="font-size:11px">—</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-3);position:sticky;bottom:8px;z-index:10;background:var(--bg-elevated);padding:var(--space-2) 0;border-top:1px solid var(--border-subtle, var(--border-default))">
            <button class="btn btn-secondary" id="btn-batch-cancel" style="min-height:48px;padding:0 var(--space-4)">Annuler</button>
            <button class="btn btn-accent" id="btn-batch-submit" style="min-height:48px;min-width:200px;padding:0 var(--space-5);font-size:var(--text-base);font-weight:600">
              <i data-lucide="save" style="width:18px;height:18px;margin-right:6px" aria-hidden="true"></i>
              Enregistrer tout
            </button>
          </div>
        </div>

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
  // ─── Batch temperature entry ───
  const batchBtn = document.getElementById('btn-batch-temps');
  const batchPanel = document.getElementById('batch-temp-panel');
  const batchCancel = document.getElementById('btn-batch-cancel');
  const batchSubmit = document.getElementById('btn-batch-submit');

  batchBtn?.addEventListener('click', () => {
    const open = batchPanel.style.display !== 'none';
    batchPanel.style.display = open ? 'none' : 'block';
    batchBtn.setAttribute('aria-expanded', String(!open));
    if (!open && window.lucide) lucide.createIcons({ nodes: [batchPanel] });
  });

  batchCancel?.addEventListener('click', () => {
    batchPanel.style.display = 'none';
    batchBtn.setAttribute('aria-expanded', 'false');
  });

  // Live badge update on input
  document.getElementById('batch-zones-body')?.addEventListener('input', e => {
    if (!e.target.classList.contains('batch-temp-input')) return;
    const row = e.target.closest('tr');
    const badge = row.querySelector('.batch-conform-badge');
    const min = parseFloat(row.dataset.min);
    const max = parseFloat(row.dataset.max);
    const val = parseFloat(e.target.value);
    if (isNaN(val)) { badge.textContent = '—'; badge.className = 'batch-conform-badge badge'; return; }
    if (val >= min && val <= max) {
      badge.textContent = 'Conforme ✓';
      badge.className = 'batch-conform-badge badge badge--success';
    } else {
      badge.textContent = 'Non conforme ✗';
      badge.className = 'batch-conform-badge badge badge--danger';
    }
  });

  batchSubmit?.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#batch-zones-body tr');
    const toSave = [];
    rows.forEach(row => {
      const input = row.querySelector('.batch-temp-input');
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        toSave.push({ zone_id: parseInt(row.dataset.zoneId), temperature: val });
      }
    });
    if (!toSave.length) { showToast('Saisissez au moins une température', 'error'); return; }

    batchSubmit.disabled = true;
    batchSubmit.innerHTML = '<i data-lucide="loader-2" class="spin" style="width:18px;height:18px;margin-right:6px" aria-hidden="true"></i>Enregistrement…';
    if (window.lucide) lucide.createIcons({ nodes: [batchSubmit] });
    let errors = 0;
    // BUGFIX 2026-04-27: every save was 404'ing because the previous code
    // POSTed via API.request to a non-existent path; the actual server
    // route is POST /haccp/temperatures (see server/routes/haccp.js).
    // The single-temperature modal already used API.recordTemperature()
    // and worked; the batch handler bypassed the helper and got the path
    // wrong. Aligning with the helper kills the bug AND keeps a single
    // source of truth for the URL.
    // (Regression test: server/tests/haccp-batch-temperatures.test.js)
    for (const entry of toSave) {
      try {
        await API.recordTemperature({ zone_id: entry.zone_id, temperature: entry.temperature });
      } catch(e) { errors++; }
    }

    batchSubmit.disabled = false;
    batchSubmit.innerHTML = '<i data-lucide="save" style="width:18px;height:18px;margin-right:6px"></i>Enregistrer tout';
    if (window.lucide) lucide.createIcons({ nodes: [batchSubmit] });

    if (errors > 0) {
      showToast(`${errors} relevé(s) non enregistré(s)`, 'error');
    } else {
      showToast(`${toSave.length} relevé(s) enregistré(s)`, 'success');
      batchPanel.style.display = 'none';
      batchBtn.setAttribute('aria-expanded', 'false');
      rows.forEach(row => {
        row.querySelector('.batch-temp-input').value = '';
        const badge = row.querySelector('.batch-conform-badge');
        badge.textContent = '—'; badge.className = 'batch-conform-badge badge';
      });
      document.getElementById('btn-filter')?.click();
    }
  });

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

// ─── Batch temperature entry modal ───
function showBatchTempModal(zones) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();

  if (!zones || zones.length === 0) {
    showToast('Aucune zone configurée. Ajoutez une zone d\'abord.', 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'batch-temp-title');
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <h2 id="batch-temp-title"><i data-lucide="table" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Saisie groupée des températures</h2>
      <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-4)">Entrez les températures pour toutes vos zones en une seule fois.</p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="border-bottom:2px solid var(--border-default)">
              <th style="text-align:left;padding:var(--space-2) var(--space-3);color:var(--text-secondary)">Zone</th>
              <th style="text-align:left;padding:var(--space-2) var(--space-3);color:var(--text-secondary)">Plage (°C)</th>
              <th style="text-align:center;padding:var(--space-2) var(--space-3);color:var(--text-secondary)">Température relevée</th>
              <th style="text-align:center;padding:var(--space-2) var(--space-3);color:var(--text-secondary)">Conformité</th>
            </tr>
          </thead>
          <tbody id="batch-zone-rows">
            ${zones.map(z => `
              <tr data-zone-id="${z.id}" data-min="${z.min_temp}" data-max="${z.max_temp}" style="border-bottom:1px solid var(--border-light)">
                <td style="padding:var(--space-2) var(--space-3);font-weight:500">${escapeHtml(z.name)}</td>
                <td style="padding:var(--space-2) var(--space-3);color:var(--text-tertiary);font-size:var(--text-xs)">${z.min_temp}° / ${z.max_temp}°</td>
                <td style="padding:var(--space-2) var(--space-3)">
                  <input type="number" step="0.1" class="form-control batch-temp-input"
                    placeholder="ex: 3.5" inputmode="decimal"
                    style="text-align:center;font-family:var(--font-mono);font-size:var(--text-base);min-height:40px"
                    aria-label="Température pour ${escapeHtml(z.name)}">
                </td>
                <td style="padding:var(--space-2) var(--space-3);text-align:center">
                  <span class="batch-conformite" aria-live="polite">—</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="form-group" style="margin-top:var(--space-4)">
        <label for="batch-notes">Notes communes (optionnel)</label>
        <input type="text" class="form-control" id="batch-notes" placeholder="ex: Relevé du matin">
      </div>
      <div class="actions-row" style="justify-content:flex-end;margin-top:var(--space-4)">
        <button class="btn btn-secondary" id="batch-cancel">Annuler</button>
        <button class="btn btn-primary" id="batch-save" style="min-width:160px">
          <i data-lucide="check" style="width:18px;height:18px" aria-hidden="true"></i> Enregistrer tout
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  // Live conformity feedback
  overlay.querySelectorAll('.batch-temp-input').forEach(input => {
    input.addEventListener('input', () => {
      const row = input.closest('tr');
      const min = parseFloat(row.dataset.min);
      const max = parseFloat(row.dataset.max);
      const val = parseFloat(input.value);
      const badge = row.querySelector('.batch-conformite');
      if (isNaN(val)) {
        badge.innerHTML = '—';
        input.style.borderColor = '';
      } else if (val >= min && val <= max) {
        badge.innerHTML = '<span class="badge badge--success">✓ OK</span>';
        input.style.borderColor = 'var(--color-success)';
      } else {
        badge.innerHTML = '<span class="badge badge--danger">⚠ ALERTE</span>';
        input.style.borderColor = 'var(--color-danger)';
      }
    });
  });

  const releaseFocus = trapFocus(overlay);
  const closeModal = () => { try { releaseFocus(); } catch {} overlay.remove(); };
  const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('batch-cancel').addEventListener('click', closeModal);

  document.getElementById('batch-save').addEventListener('click', async () => {
    const notes = document.getElementById('batch-notes').value.trim() || null;
    const rows = overlay.querySelectorAll('#batch-zone-rows tr[data-zone-id]');
    const entries = [];
    rows.forEach(row => {
      const input = row.querySelector('.batch-temp-input');
      const temp = parseFloat(input.value);
      if (!isNaN(temp)) {
        entries.push({
          zone_id: Number(row.dataset.zoneId),
          temperature: temp,
          notes,
          recorded_by: account ? account.id : null
        });
      }
    });

    if (entries.length === 0) {
      showToast('Veuillez saisir au moins une température.', 'error');
      return;
    }

    const saveBtn = document.getElementById('batch-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Enregistrement...';

    let saved = 0, failed = 0;
    for (const entry of entries) {
      try {
        await API.recordTemperature(entry);
        saved++;
      } catch {
        failed++;
      }
    }

    closeModal();
    if (failed === 0) {
      showToast(`✓ ${saved} relevé${saved > 1 ? 's' : ''} enregistré${saved > 1 ? 's' : ''}`, 'success');
    } else {
      showToast(`${saved} enregistrés, ${failed} erreur(s)`, 'error');
    }
    renderHACCPTemperatures();
  });
}
