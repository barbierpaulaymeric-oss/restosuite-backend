// ═══════════════════════════════════════════
// BPH Maintenance équipements — Route #/haccp/maintenance
// ═══════════════════════════════════════════

const EQUIPMENT_TYPE_ICONS = {
  froid: '❄️', cuisson: '🔥', ventilation: '💨', lavage: '🫧', autre: '🔧',
};

async function renderHACCPMaintenance() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [{ items }, { items: overdue }] = await Promise.all([
      API.request('/maintenance'),
      API.request('/maintenance/overdue'),
    ]);

    const total = items.length;
    const upToDate = items.filter(i => i.status === 'à_jour').length;
    const planned = items.filter(i => i.status === 'planifié').length;
    const late = items.filter(i => i.status === 'en_retard').length;

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="wrench" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Maintenance des équipements</h1>
          <button class="btn btn-primary" id="btn-new-maintenance">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter équipement
          </button>
        </div>
        ${haccpBreadcrumb('autre')}

        ${overdue.length > 0 ? `
        <div style="background:#fff0f0;border:1px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#ef4444;flex-shrink:0"></i>
          <span class="text-sm"><strong>${overdue.length} équipement(s)</strong> en retard de maintenance : ${overdue.map(e => escapeHtml(e.equipment_name)).join(', ')}</span>
        </div>
        ` : ''}

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Total équipements</div>
            <div class="kpi-card__value">${total}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">À jour</div>
            <div class="kpi-card__value">${upToDate}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Planifiés</div>
            <div class="kpi-card__value">${planned}</div>
          </div>
          <div class="kpi-card ${late > 0 ? 'kpi-card--danger' : ''}">
            <div class="kpi-card__label">En retard</div>
            <div class="kpi-card__value">${late}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Équipement</th>
                <th>Type</th>
                <th>Emplacement</th>
                <th>Dernière maintenance</th>
                <th>Prochaine maintenance</th>
                <th>Type maintenance</th>
                <th>Prestataire</th>
                <th>Coût</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0 ? '<tr><td colspan="10" class="text-secondary text-center" style="padding:24px">Aucun équipement enregistré</td></tr>' : items.map(item => {
                const isOverdue = overdue.some(o => o.id === item.id);
                let statusBadge = '';
                if (item.status === 'à_jour') statusBadge = '<span class="badge badge--success">✓ À jour</span>';
                else if (item.status === 'planifié') statusBadge = '<span class="badge" style="background:#e0f0ff;color:#1a6fb5">Planifié</span>';
                else statusBadge = '<span class="badge badge--danger">En retard</span>';
                return `
                  <tr${isOverdue ? ' style="background:#fff8f8"' : ''}>
                    <td style="font-weight:500">${EQUIPMENT_TYPE_ICONS[item.equipment_type] || '🔧'} ${escapeHtml(item.equipment_name)}</td>
                    <td class="text-secondary text-sm">${escapeHtml(item.equipment_type)}</td>
                    <td class="text-secondary text-sm">${escapeHtml(item.location || '—')}</td>
                    <td class="mono text-sm">${item.last_maintenance_date ? new Date(item.last_maintenance_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td class="mono text-sm${isOverdue ? ' text-danger' : ''}">${item.next_maintenance_date ? new Date(item.next_maintenance_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td class="text-secondary text-sm">${escapeHtml(item.maintenance_type || '—')}</td>
                    <td class="text-secondary text-sm">${escapeHtml(item.provider || '—')}</td>
                    <td class="mono text-sm">${item.cost ? item.cost.toLocaleString('fr-FR') + ' €' : '—'}</td>
                    <td>${statusBadge}</td>
                    <td style="white-space:nowrap">
                      <button class="btn btn-secondary btn-sm" data-action="edit-maint" data-id="${item.id}" style="margin-right:4px">
                        <i data-lucide="pencil" style="width:14px;height:14px"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm" data-action="delete-maint" data-id="${item.id}" style="color:var(--color-danger)">
                        <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupMaintenanceEvents(items);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupMaintenanceEvents(items) {
  document.getElementById('btn-new-maintenance')?.addEventListener('click', () => showMaintenanceModal());
  document.querySelectorAll('[data-action="edit-maint"]').forEach(btn => {
    const record = items.find(i => i.id === Number(btn.dataset.id));
    btn.addEventListener('click', () => showMaintenanceModal(record));
  });
  document.querySelectorAll('[data-action="delete-maint"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cet équipement ?')) return;
      try {
        await API.request('/maintenance/' + btn.dataset.id, { method: 'DELETE' });
        showToast('Équipement supprimé', 'success');
        renderHACCPMaintenance();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

function showMaintenanceModal(record = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const isEdit = !!record;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:620px">
      <h2>
        <i data-lucide="wrench" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>
        ${isEdit ? 'Modifier l\'équipement' : 'Ajouter un équipement'}
      </h2>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Nom de l'équipement *</label>
          <input type="text" class="form-control" id="maint-name" value="${escapeHtml(record?.equipment_name || '')}" placeholder="ex: Chambre froide positive" autofocus>
        </div>
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" id="maint-type">
            <option value="froid" ${record?.equipment_type === 'froid' ? 'selected' : ''}>❄️ Froid</option>
            <option value="cuisson" ${record?.equipment_type === 'cuisson' ? 'selected' : ''}>🔥 Cuisson</option>
            <option value="ventilation" ${record?.equipment_type === 'ventilation' ? 'selected' : ''}>💨 Ventilation</option>
            <option value="lavage" ${record?.equipment_type === 'lavage' ? 'selected' : ''}>🫧 Lavage</option>
            <option value="autre" ${(!record || record.equipment_type === 'autre') ? 'selected' : ''}>🔧 Autre</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Emplacement</label>
        <input type="text" class="form-control" id="maint-location" value="${escapeHtml(record?.location || '')}" placeholder="ex: Cuisine, Réserve, Salle...">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Dernière maintenance</label>
          <input type="date" class="form-control" id="maint-last" value="${record?.last_maintenance_date || ''}">
        </div>
        <div class="form-group">
          <label>Prochaine maintenance</label>
          <input type="date" class="form-control" id="maint-next" value="${record?.next_maintenance_date || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de maintenance</label>
          <select class="form-control" id="maint-mtype">
            <option value="préventive" ${(!record || record.maintenance_type === 'préventive') ? 'selected' : ''}>Préventive</option>
            <option value="corrective" ${record?.maintenance_type === 'corrective' ? 'selected' : ''}>Corrective</option>
          </select>
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select class="form-control" id="maint-status">
            <option value="à_jour" ${record?.status === 'à_jour' ? 'selected' : ''}>À jour</option>
            <option value="planifié" ${(!record || record.status === 'planifié') ? 'selected' : ''}>Planifié</option>
            <option value="en_retard" ${record?.status === 'en_retard' ? 'selected' : ''}>En retard</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Prestataire</label>
          <input type="text" class="form-control" id="maint-provider" value="${escapeHtml(record?.provider || '')}" placeholder="ex: FrigoTech SARL">
        </div>
        <div class="form-group">
          <label>Coût (€)</label>
          <input type="number" min="0" step="0.01" class="form-control" id="maint-cost" value="${record?.cost ?? ''}" placeholder="ex: 280">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="maint-notes" value="${escapeHtml(record?.notes || '')}" placeholder="">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="maint-cancel">Annuler</button>
        <button class="btn btn-primary" id="maint-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('maint-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('maint-save').addEventListener('click', async () => {
    const equipment_name = document.getElementById('maint-name').value.trim();
    if (!equipment_name) { document.getElementById('maint-name').classList.add('form-control--error'); return; }
    const payload = {
      equipment_name,
      equipment_type: document.getElementById('maint-type').value,
      location: document.getElementById('maint-location').value.trim() || null,
      last_maintenance_date: document.getElementById('maint-last').value || null,
      next_maintenance_date: document.getElementById('maint-next').value || null,
      maintenance_type: document.getElementById('maint-mtype').value,
      provider: document.getElementById('maint-provider').value.trim() || null,
      cost: document.getElementById('maint-cost').value ? Number(document.getElementById('maint-cost').value) : null,
      status: document.getElementById('maint-status').value,
      notes: document.getElementById('maint-notes').value.trim() || null,
    };
    try {
      if (isEdit) {
        await API.request('/maintenance/' + record.id, { method: 'PUT', body: payload });
        showToast('Équipement mis à jour ✓', 'success');
      } else {
        await API.request('/maintenance', { method: 'POST', body: payload });
        showToast('Équipement ajouté ✓', 'success');
      }
      overlay.remove();
      renderHACCPMaintenance();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
