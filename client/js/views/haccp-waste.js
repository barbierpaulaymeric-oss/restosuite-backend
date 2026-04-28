// ═══════════════════════════════════════════
// BPH Gestion des déchets — Route #/haccp/waste
// ═══════════════════════════════════════════

const WASTE_TYPE_ICONS = {
  alimentaire: '🍃', emballage: '📦', huile: '🛢️', verre: '🪟', autre: '🗑️',
};

async function renderHACCPWaste() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.request('/waste');

    const today = new Date().toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const collectionsThisWeek = items.filter(i => i.next_collection_date && i.next_collection_date >= today && i.next_collection_date <= in7Days).length;
    const providers = new Set(items.filter(i => i.collection_provider).map(i => i.collection_provider));
    const contracts = items.filter(i => i.contract_ref).length;

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="trash-2" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Gestion des déchets</h1>
          <button class="btn btn-primary" id="btn-new-waste">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter filière
          </button>
        </div>
        ${haccpBreadcrumb('autre')}

        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">La gestion des déchets alimentaires est réglementée par le <strong>règlement CE 1069/2009</strong>. L'huile de friture usagée nécessite un contrat BSDA.</span>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Filières</div>
            <div class="kpi-card__value">${items.length}</div>
          </div>
          <div class="kpi-card ${collectionsThisWeek > 0 ? 'kpi-card--info' : ''}">
            <div class="kpi-card__label">Collectes cette semaine</div>
            <div class="kpi-card__value">${collectionsThisWeek}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Prestataires</div>
            <div class="kpi-card__value">${providers.size}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Contrats actifs</div>
            <div class="kpi-card__value">${contracts}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Type de déchet</th>
                <th>Prestataire</th>
                <th>Fréquence</th>
                <th>Dernière collecte</th>
                <th>Prochaine collecte</th>
                <th>Réf. contrat</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0 ? '<tr><td colspan="8" class="text-secondary text-center" style="padding:24px">Aucune filière enregistrée</td></tr>' : items.map(item => {
                const isOverdue = item.next_collection_date && item.next_collection_date < today;
                const isDueSoon = !isOverdue && item.next_collection_date && item.next_collection_date <= in7Days;
                return `
                  <tr${isOverdue ? ' style="background:#fff8f8"' : isDueSoon ? ' style="background:#fffbf0"' : ''}>
                    <td style="font-weight:500">${WASTE_TYPE_ICONS[item.waste_type] || '🗑️'} ${escapeHtml(item.waste_type)}</td>
                    <td>${escapeHtml(item.collection_provider || '—')}</td>
                    <td class="text-secondary text-sm">${escapeHtml(item.collection_frequency || '—')}</td>
                    <td class="mono text-sm">${item.last_collection_date ? new Date(item.last_collection_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td class="mono text-sm${isOverdue ? ' text-danger' : isDueSoon ? ' text-warning' : ''}">
                      ${item.next_collection_date ? new Date(item.next_collection_date).toLocaleDateString('fr-FR') : '—'}
                      ${isOverdue ? ' <span class="badge badge--danger" style="font-size:0.65rem">En retard</span>' : ''}
                      ${isDueSoon && !isOverdue ? ' <span class="badge badge--warning" style="font-size:0.65rem">Cette semaine</span>' : ''}
                    </td>
                    <td class="text-secondary text-sm">${escapeHtml(item.contract_ref || '—')}</td>
                    <td class="text-secondary text-sm" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(item.notes || '')}">${escapeHtml(item.notes || '—')}</td>
                    <td style="white-space:nowrap">
                      <button class="btn btn-secondary btn-sm" data-action="edit-waste" data-id="${item.id}" style="margin-right:4px">
                        <i data-lucide="pencil" style="width:14px;height:14px"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm" data-action="delete-waste" data-id="${item.id}" style="color:var(--color-danger)">
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
    setupWasteEvents(items);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupWasteEvents(items) {
  document.getElementById('btn-new-waste')?.addEventListener('click', () => showWasteModal());
  document.querySelectorAll('[data-action="edit-waste"]').forEach(btn => {
    const record = items.find(i => i.id === Number(btn.dataset.id));
    btn.addEventListener('click', () => showWasteModal(record));
  });
  document.querySelectorAll('[data-action="delete-waste"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette filière ?')) return;
      try {
        await API.request('/waste/' + btn.dataset.id, { method: 'DELETE' });
        showToast('Filière supprimée', 'success');
        renderHACCPWaste();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

function showWasteModal(record = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const isEdit = !!record;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h2>
        <i data-lucide="trash-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>
        ${isEdit ? 'Modifier la filière' : 'Nouvelle filière de déchets'}
      </h2>
      <div class="form-row">
        <div class="form-group">
          <label>Type de déchet *</label>
          <select class="form-control" id="wst-type" data-ui="custom">
            <option value="alimentaire" ${(!record || record.waste_type === 'alimentaire') ? 'selected' : ''}>🍃 Alimentaire</option>
            <option value="emballage" ${record?.waste_type === 'emballage' ? 'selected' : ''}>📦 Emballage</option>
            <option value="huile" ${record?.waste_type === 'huile' ? 'selected' : ''}>🛢️ Huile</option>
            <option value="verre" ${record?.waste_type === 'verre' ? 'selected' : ''}>🪟 Verre</option>
            <option value="autre" ${record?.waste_type === 'autre' ? 'selected' : ''}>🗑️ Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label>Fréquence de collecte</label>
          <select class="form-control" id="wst-freq" data-ui="custom">
            <option value="quotidienne" ${record?.collection_frequency === 'quotidienne' ? 'selected' : ''}>Quotidienne</option>
            <option value="hebdomadaire" ${(!record || record.collection_frequency === 'hebdomadaire') ? 'selected' : ''}>Hebdomadaire</option>
            <option value="bimestrielle" ${record?.collection_frequency === 'bimestrielle' ? 'selected' : ''}>Bimestrielle</option>
            <option value="mensuelle" ${record?.collection_frequency === 'mensuelle' ? 'selected' : ''}>Mensuelle</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Prestataire</label>
          <input type="text" class="form-control" id="wst-provider" value="${escapeHtml(record?.collection_provider || '')}" placeholder="ex: Veolia, Paprec Group" autofocus data-ui="custom">
        </div>
        <div class="form-group">
          <label>Réf. contrat</label>
          <input type="text" class="form-control" id="wst-contract" value="${escapeHtml(record?.contract_ref || '')}" placeholder="ex: VEO-2026-C088" data-ui="custom">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Dernière collecte</label>
          <input type="date" class="form-control" id="wst-last" value="${record?.last_collection_date || ''}">
        </div>
        <div class="form-group">
          <label>Prochaine collecte</label>
          <input type="date" class="form-control" id="wst-next" value="${record?.next_collection_date || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="wst-notes" rows="2" placeholder="ex: Bac vert 240L — déchets organiques" data-ui="custom">${escapeHtml(record?.notes || '')}</textarea>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="wst-cancel">Annuler</button>
        <button class="btn btn-primary" id="wst-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('wst-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('wst-save').addEventListener('click', async () => {
    const payload = {
      waste_type: document.getElementById('wst-type').value,
      collection_provider: document.getElementById('wst-provider').value.trim() || null,
      collection_frequency: document.getElementById('wst-freq').value,
      last_collection_date: document.getElementById('wst-last').value || null,
      next_collection_date: document.getElementById('wst-next').value || null,
      contract_ref: document.getElementById('wst-contract').value.trim() || null,
      notes: document.getElementById('wst-notes').value.trim() || null,
    };
    try {
      if (isEdit) {
        await API.request('/waste/' + record.id, { method: 'PUT', body: payload });
        showToast('Filière mise à jour ✓', 'success');
      } else {
        await API.request('/waste', { method: 'POST', body: payload });
        showToast('Filière créée ✓', 'success');
      }
      overlay.remove();
      renderHACCPWaste();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
