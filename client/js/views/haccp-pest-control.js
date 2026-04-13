// ═══════════════════════════════════════════
// BPH Lutte contre les nuisibles — Route #/haccp/pest-control
// ═══════════════════════════════════════════

async function renderHACCPPestControl() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.request('/pest-control');

    const lastVisit = items[0] || null;
    const nextVisitDate = lastVisit?.next_visit_date
      ? new Date(lastVisit.next_visit_date).toLocaleDateString('fr-FR')
      : '—';
    const actionRequired = items.filter(i => i.status === 'action-requise').length;
    const nonCompliant = items.filter(i => i.status === 'non-conforme').length;

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="bug" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Lutte contre les nuisibles</h1>
          <button class="btn btn-primary" id="btn-new-pest">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle visite
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        ${lastVisit?.next_visit_date ? `
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:14px 18px;margin-bottom:16px;display:flex;gap:12px;align-items:center">
          <i data-lucide="calendar-check" style="width:20px;height:20px;color:#3b9ede;flex-shrink:0"></i>
          <div>
            <strong>Prochaine visite programmée :</strong> ${nextVisitDate}
            ${lastVisit.provider_name ? ` — ${escapeHtml(lastVisit.provider_name)}` : ''}
            ${lastVisit.contract_ref ? ` (${escapeHtml(lastVisit.contract_ref)})` : ''}
          </div>
        </div>
        ` : ''}

        ${(actionRequired > 0 || nonCompliant > 0) ? `
        <div style="background:#fff0f0;border:1px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#ef4444;flex-shrink:0"></i>
          <span class="text-sm"><strong>${actionRequired + nonCompliant} visite(s)</strong> nécessitent une action ou sont non conformes</span>
        </div>
        ` : ''}

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Total visites</div>
            <div class="kpi-card__value">${items.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Dernière visite</div>
            <div class="kpi-card__value" style="font-size:1rem">${lastVisit ? new Date(lastVisit.visit_date).toLocaleDateString('fr-FR') : '—'}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Prochaine visite</div>
            <div class="kpi-card__value" style="font-size:1rem">${nextVisitDate}</div>
          </div>
          <div class="kpi-card ${lastVisit?.status === 'conforme' ? '' : lastVisit?.status === 'action-requise' ? 'kpi-card--warning' : 'kpi-card--danger'}">
            <div class="kpi-card__label">Statut dernière visite</div>
            <div class="kpi-card__value" style="font-size:1rem">${lastVisit ? renderPestBadge(lastVisit.status) : '—'}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Prestataire</th>
                <th>Réf. contrat</th>
                <th>Date visite</th>
                <th>Prochaine visite</th>
                <th>Constats</th>
                <th>Actions effectuées</th>
                <th>Appâts</th>
                <th>Statut</th>
                <th>Rapport</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0 ? '<tr><td colspan="10" class="text-secondary text-center" style="padding:24px">Aucune visite enregistrée</td></tr>' : items.map(item => `
                <tr>
                  <td style="font-weight:500">${escapeHtml(item.provider_name || '—')}</td>
                  <td class="text-secondary text-sm">${escapeHtml(item.contract_ref || '—')}</td>
                  <td class="mono text-sm">${new Date(item.visit_date).toLocaleDateString('fr-FR')}</td>
                  <td class="mono text-sm">${item.next_visit_date ? new Date(item.next_visit_date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td class="text-sm" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(item.findings || '')}">${escapeHtml(item.findings || '—')}</td>
                  <td class="text-sm" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(item.actions_taken || '')}">${escapeHtml(item.actions_taken || '—')}</td>
                  <td class="mono">${item.bait_stations_count ?? '—'}</td>
                  <td>${renderPestBadge(item.status)}</td>
                  <td class="text-secondary text-sm">${escapeHtml(item.report_ref || '—')}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-secondary btn-sm" data-action="edit-pest" data-id="${item.id}" style="margin-right:4px">
                      <i data-lucide="pencil" style="width:14px;height:14px"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm" data-action="delete-pest" data-id="${item.id}" style="color:var(--color-danger)">
                      <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupPestControlEvents(items);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderPestBadge(status) {
  if (status === 'conforme') return '<span class="badge badge--success">✓ Conforme</span>';
  if (status === 'non-conforme') return '<span class="badge badge--danger">✗ Non conforme</span>';
  return '<span class="badge badge--warning">⚠ Action requise</span>';
}

function setupPestControlEvents(items) {
  document.getElementById('btn-new-pest')?.addEventListener('click', () => showPestControlModal());
  document.querySelectorAll('[data-action="edit-pest"]').forEach(btn => {
    const record = items.find(i => i.id === Number(btn.dataset.id));
    btn.addEventListener('click', () => showPestControlModal(record));
  });
  document.querySelectorAll('[data-action="delete-pest"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette visite ?')) return;
      try {
        await API.request('/pest-control/' + btn.dataset.id, { method: 'DELETE' });
        showToast('Visite supprimée', 'success');
        renderHACCPPestControl();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

function showPestControlModal(record = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const isEdit = !!record;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <h2>
        <i data-lucide="bug" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>
        ${isEdit ? 'Modifier la visite' : 'Nouvelle visite'}
      </h2>
      <div class="form-row">
        <div class="form-group">
          <label>Prestataire</label>
          <input type="text" class="form-control" id="pc-provider" value="${escapeHtml(record?.provider_name || '')}" placeholder="ex: Anticimex Pro" autofocus>
        </div>
        <div class="form-group">
          <label>Réf. contrat</label>
          <input type="text" class="form-control" id="pc-contract" value="${escapeHtml(record?.contract_ref || '')}" placeholder="ex: ANTI-2026-0042">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de visite *</label>
          <input type="date" class="form-control" id="pc-date" value="${record?.visit_date || ''}">
        </div>
        <div class="form-group">
          <label>Prochaine visite</label>
          <input type="date" class="form-control" id="pc-next" value="${record?.next_visit_date || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Constats</label>
        <textarea class="form-control" id="pc-findings" rows="2" placeholder="ex: RAS — aucune trace d'infestation">${escapeHtml(record?.findings || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Actions effectuées</label>
        <textarea class="form-control" id="pc-actions" rows="2" placeholder="ex: Vérification et renouvellement des appâts">${escapeHtml(record?.actions_taken || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nombre de stations d'appât</label>
          <input type="number" min="0" class="form-control" id="pc-baits" value="${record?.bait_stations_count ?? ''}" placeholder="ex: 8">
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select class="form-control" id="pc-status">
            <option value="conforme" ${(!record || record.status === 'conforme') ? 'selected' : ''}>Conforme</option>
            <option value="non-conforme" ${record?.status === 'non-conforme' ? 'selected' : ''}>Non conforme</option>
            <option value="action-requise" ${record?.status === 'action-requise' ? 'selected' : ''}>Action requise</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Référence rapport</label>
        <input type="text" class="form-control" id="pc-report" value="${escapeHtml(record?.report_ref || '')}" placeholder="ex: RPT-2026-Q1">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="pc-cancel">Annuler</button>
        <button class="btn btn-primary" id="pc-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('pc-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('pc-save').addEventListener('click', async () => {
    const visit_date = document.getElementById('pc-date').value;
    if (!visit_date) { document.getElementById('pc-date').classList.add('form-control--error'); return; }
    const payload = {
      provider_name: document.getElementById('pc-provider').value.trim() || null,
      contract_ref: document.getElementById('pc-contract').value.trim() || null,
      visit_date,
      next_visit_date: document.getElementById('pc-next').value || null,
      findings: document.getElementById('pc-findings').value.trim() || null,
      actions_taken: document.getElementById('pc-actions').value.trim() || null,
      bait_stations_count: document.getElementById('pc-baits').value ? Number(document.getElementById('pc-baits').value) : 0,
      status: document.getElementById('pc-status').value,
      report_ref: document.getElementById('pc-report').value.trim() || null,
    };
    try {
      if (isEdit) {
        await API.request('/pest-control/' + record.id, { method: 'PUT', body: payload });
        showToast('Visite mise à jour ✓', 'success');
      } else {
        await API.request('/pest-control', { method: 'POST', body: payload });
        showToast('Visite enregistrée ✓', 'success');
      }
      overlay.remove();
      renderHACCPPestControl();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
