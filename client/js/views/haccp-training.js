// ═══════════════════════════════════════════
// BPH Formation du personnel — Route #/haccp/training
// ═══════════════════════════════════════════

async function renderHACCPTraining() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [{ items }, { items: expiring }] = await Promise.all([
      API.request('/training'),
      API.request('/training/expiring'),
    ]);

    const total = items.length;
    const upToDate = items.filter(i => i.status === 'réalisé').length;
    const pctUpToDate = total > 0 ? Math.round(upToDate / total * 100) : 0;
    const nextRenewal = items
      .filter(i => i.next_renewal_date)
      .sort((a, b) => a.next_renewal_date.localeCompare(b.next_renewal_date))[0];

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="graduation-cap" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Formation du personnel</h1>
          <button class="btn btn-primary" id="btn-new-training">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle formation
          </button>
        </div>
        ${haccpBreadcrumb('plan')}

        ${expiring.length > 0 ? `
        <div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#f59e0b;flex-shrink:0"></i>
          <span class="text-sm"><strong>${expiring.length} formation(s)</strong> arrivent à échéance dans les 30 prochains jours</span>
        </div>
        ` : ''}

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Total formations</div>
            <div class="kpi-card__value">${total}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">À jour (réalisé)</div>
            <div class="kpi-card__value">${pctUpToDate}<span style="font-size:1rem">%</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Prochaine échéance</div>
            <div class="kpi-card__value" style="font-size:1rem">${nextRenewal ? new Date(nextRenewal.next_renewal_date).toLocaleDateString('fr-FR') : '—'}</div>
          </div>
          <div class="kpi-card ${expiring.length > 0 ? 'kpi-card--warning' : ''}">
            <div class="kpi-card__label">Expirent sous 30j</div>
            <div class="kpi-card__value">${expiring.length}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Employé</th>
                <th>Sujet de formation</th>
                <th>Formateur</th>
                <th>Date formation</th>
                <th>Prochaine échéance</th>
                <th>Durée</th>
                <th>Référence certificat</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0 ? '<tr><td colspan="9" class="text-secondary text-center" style="padding:24px">Aucune formation enregistrée</td></tr>' : items.map(item => {
                const trainingDate = new Date(item.training_date).toLocaleDateString('fr-FR');
                const renewalDate = item.next_renewal_date ? new Date(item.next_renewal_date).toLocaleDateString('fr-FR') : '—';
                const isExpiringSoon = expiring.some(e => e.id === item.id);
                let statusBadge = '';
                if (item.status === 'réalisé') statusBadge = '<span class="badge badge--success">✓ Réalisé</span>';
                else if (item.status === 'planifié') statusBadge = '<span class="badge" style="background:#e0f0ff;color:#1a6fb5">Planifié</span>';
                else statusBadge = '<span class="badge badge--danger">Expiré</span>';
                return `
                  <tr${isExpiringSoon ? ' style="background:#fffbf0"' : ''}>
                    <td style="font-weight:500">${escapeHtml(item.employee_name)}</td>
                    <td>${escapeHtml(item.training_topic)}</td>
                    <td class="text-secondary">${escapeHtml(item.trainer || '—')}</td>
                    <td class="mono text-sm">${trainingDate}</td>
                    <td class="mono text-sm${isExpiringSoon ? ' text-warning' : ''}">${renewalDate}</td>
                    <td class="mono">${item.duration_hours ? item.duration_hours + 'h' : '—'}</td>
                    <td class="text-secondary text-sm">${escapeHtml(item.certificate_ref || '—')}</td>
                    <td>${statusBadge}</td>
                    <td style="white-space:nowrap">
                      <button class="btn btn-secondary btn-sm" data-action="edit-training" data-id="${item.id}" style="margin-right:4px">
                        <i data-lucide="pencil" style="width:14px;height:14px"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm" data-action="delete-training" data-id="${item.id}" style="color:var(--color-danger)">
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
    setupTrainingEvents(items);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupTrainingEvents(items) {
  document.getElementById('btn-new-training')?.addEventListener('click', () => showTrainingModal());
  document.querySelectorAll('[data-action="edit-training"]').forEach(btn => {
    const record = items.find(i => i.id === Number(btn.dataset.id));
    btn.addEventListener('click', () => showTrainingModal(record));
  });
  document.querySelectorAll('[data-action="delete-training"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette formation ?')) return;
      try {
        await API.request('/training/' + btn.dataset.id, { method: 'DELETE' });
        showToast('Formation supprimée', 'success');
        renderHACCPTraining();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

function showTrainingModal(record = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const isEdit = !!record;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <h2>
        <i data-lucide="graduation-cap" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>
        ${isEdit ? 'Modifier la formation' : 'Nouvelle formation'}
      </h2>
      <div class="form-row">
        <div class="form-group">
          <label>Employé *</label>
          <input type="text" class="form-control" id="tr-employee" value="${escapeHtml(record?.employee_name || '')}" placeholder="ex: Marie Dupont" autofocus>
        </div>
        <div class="form-group">
          <label>Formateur</label>
          <input type="text" class="form-control" id="tr-trainer" value="${escapeHtml(record?.trainer || '')}" placeholder="ex: AFPA Formation">
        </div>
      </div>
      <div class="form-group">
        <label>Sujet de formation *</label>
        <input type="text" class="form-control" id="tr-topic" value="${escapeHtml(record?.training_topic || '')}" placeholder="ex: Hygiène alimentaire HACCP">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de formation *</label>
          <input type="date" class="form-control" id="tr-date" value="${record?.training_date || ''}">
        </div>
        <div class="form-group">
          <label>Prochaine échéance</label>
          <input type="date" class="form-control" id="tr-renewal" value="${record?.next_renewal_date || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Durée (heures)</label>
          <input type="number" step="0.5" min="0" class="form-control" id="tr-duration" value="${record?.duration_hours || ''}" placeholder="ex: 14">
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select class="form-control" id="tr-status">
            <option value="planifié" ${(!record || record.status === 'planifié') ? 'selected' : ''}>Planifié</option>
            <option value="réalisé" ${record?.status === 'réalisé' ? 'selected' : ''}>Réalisé</option>
            <option value="expiré" ${record?.status === 'expiré' ? 'selected' : ''}>Expiré</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Référence certificat</label>
        <input type="text" class="form-control" id="tr-cert" value="${escapeHtml(record?.certificate_ref || '')}" placeholder="ex: HACCP-2026-001">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="tr-notes" value="${escapeHtml(record?.notes || '')}" placeholder="">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="tr-cancel">Annuler</button>
        <button class="btn btn-primary" id="tr-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('tr-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('tr-save').addEventListener('click', async () => {
    const employee_name = document.getElementById('tr-employee').value.trim();
    const training_topic = document.getElementById('tr-topic').value.trim();
    const training_date = document.getElementById('tr-date').value;
    if (!employee_name) { document.getElementById('tr-employee').classList.add('form-control--error'); return; }
    if (!training_topic) { document.getElementById('tr-topic').classList.add('form-control--error'); return; }
    if (!training_date) { document.getElementById('tr-date').classList.add('form-control--error'); return; }
    const payload = {
      employee_name,
      training_topic,
      trainer: document.getElementById('tr-trainer').value.trim() || null,
      training_date,
      next_renewal_date: document.getElementById('tr-renewal').value || null,
      duration_hours: document.getElementById('tr-duration').value ? Number(document.getElementById('tr-duration').value) : null,
      certificate_ref: document.getElementById('tr-cert').value.trim() || null,
      status: document.getElementById('tr-status').value,
      notes: document.getElementById('tr-notes').value.trim() || null,
    };
    try {
      if (isEdit) {
        await API.request('/training/' + record.id, { method: 'PUT', body: payload });
        showToast('Formation mise à jour ✓', 'success');
      } else {
        await API.request('/training', { method: 'POST', body: payload });
        showToast('Formation enregistrée ✓', 'success');
      }
      overlay.remove();
      renderHACCPTraining();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
