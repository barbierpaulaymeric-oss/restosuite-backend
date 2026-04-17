// ═══════════════════════════════════════════
// Santé du personnel — Route #/haccp/staff-health
// Arrêté 21/12/2009 + Règlement CE 852/2004 Chap. VIII
// ═══════════════════════════════════════════

const RECORD_TYPE_LABELS = {
  aptitude:          'Aptitude médicale',
  visite_medicale:   'Visite médicale',
  maladie:           'Arrêt maladie',
  blessure:          'Blessure / Plaie',
  formation_hygiene: 'Formation hygiène',
};

const RECORD_TYPE_BADGES = {
  aptitude:          'badge--success',
  visite_medicale:   'badge--info',
  maladie:           'badge--danger',
  blessure:          'badge--warning',
  formation_hygiene: '',
};

async function renderHACCPStaffHealth() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [{ items }, { items: unfit }, { items: expiring }] = await Promise.all([
      API.request('/sanitary/staff-health'),
      API.request('/sanitary/staff-health/unfit'),
      API.request('/sanitary/staff-health/expiring'),
    ]);

    const totalStaff = [...new Set(items.map(i => i.staff_name))].length;

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="heart-pulse" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Santé du personnel</h1>
          <button class="btn btn-primary" id="btn-new-health">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvel enregistrement
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        ${unfit.length > 0 ? `
        <div style="background:#fff0f0;border:1px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#ef4444;flex-shrink:0"></i>
          <span class="text-sm"><strong>${unfit.length} membre(s) du personnel</strong> en arrêt (maladie ou blessure) — exclusion de la manipulation des aliments requise</span>
        </div>
        ` : ''}

        ${expiring.length > 0 ? `
        <div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <i data-lucide="clock" style="width:18px;height:18px;color:#f59e0b;flex-shrink:0"></i>
          <span class="text-sm"><strong>${expiring.length} aptitude(s)/visite(s)</strong> arrivent à échéance dans les 90 prochains jours</span>
        </div>
        ` : ''}

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Membres du personnel</div>
            <div class="kpi-card__value">${totalStaff}</div>
          </div>
          <div class="kpi-card ${unfit.length > 0 ? 'kpi-card--danger' : ''}">
            <div class="kpi-card__label">En arrêt actuellement</div>
            <div class="kpi-card__value">${unfit.length}</div>
          </div>
          <div class="kpi-card ${expiring.length > 0 ? 'kpi-card--warning' : ''}">
            <div class="kpi-card__label">Aptitudes expirant (90j)</div>
            <div class="kpi-card__value">${expiring.length}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Total enregistrements</div>
            <div class="kpi-card__value">${items.length}</div>
          </div>
        </div>

        <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:0.85rem;color:#3730a3">
          <strong>Obligation légale</strong> — Arrêté du 21/12/2009 (art. 3.3) &amp; Règlement CE 852/2004 (Chap. VIII) : toute personne présentant une maladie susceptible d'être transmise par les aliments (gastro-entérite, plaies infectées, infections cutanées) doit être déclarée inapte à la manipulation des denrées et exclue de la zone de production.
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Personnel</th>
                <th>Type de fiche</th>
                <th>Date</th>
                <th>Date d'expiration</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0
                ? '<tr><td colspan="6" class="text-secondary text-center" style="padding:24px">Aucun enregistrement de santé du personnel</td></tr>'
                : items.map(item => {
                  const dateRecord = new Date(item.date_record).toLocaleDateString('fr-FR');
                  const dateExpiry = item.date_expiry ? new Date(item.date_expiry).toLocaleDateString('fr-FR') : '—';
                  const isExpiringSoon = expiring.some(e => e.id === item.id);
                  const isUnfit = unfit.some(u => u.id === item.id);
                  const badgeClass = RECORD_TYPE_BADGES[item.record_type] || '';
                  return `
                    <tr${isUnfit ? ' style="background:#fff5f5"' : isExpiringSoon ? ' style="background:#fffbf0"' : ''}>
                      <td style="font-weight:500">${escapeHtml(item.staff_name)}</td>
                      <td><span class="badge ${badgeClass}">${RECORD_TYPE_LABELS[item.record_type] || item.record_type}</span></td>
                      <td class="mono text-sm">${dateRecord}</td>
                      <td class="mono text-sm${isExpiringSoon ? ' text-warning' : ''}">${dateExpiry}</td>
                      <td class="text-secondary text-sm">${escapeHtml(item.notes || '—')}</td>
                      <td style="white-space:nowrap">
                        <button class="btn btn-secondary btn-sm" data-action="edit-health" data-id="${item.id}" style="margin-right:4px">
                          <i data-lucide="pencil" style="width:14px;height:14px"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" data-action="delete-health" data-id="${item.id}" style="color:var(--color-danger)">
                          <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupStaffHealthEvents(items);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupStaffHealthEvents(items) {
  document.getElementById('btn-new-health')?.addEventListener('click', () => showStaffHealthModal());
  document.querySelectorAll('[data-action="edit-health"]').forEach(btn => {
    const record = items.find(i => i.id === Number(btn.dataset.id));
    btn.addEventListener('click', () => showStaffHealthModal(record));
  });
  document.querySelectorAll('[data-action="delete-health"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cet enregistrement ?')) return;
      try {
        await API.request('/sanitary/staff-health/' + btn.dataset.id, { method: 'DELETE' });
        showToast('Enregistrement supprimé', 'success');
        renderHACCPStaffHealth();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

function showStaffHealthModal(record = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const isEdit = !!record;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <h2>
        <i data-lucide="heart-pulse" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>
        ${isEdit ? 'Modifier l\'enregistrement' : 'Nouvel enregistrement de santé'}
      </h2>
      <div class="form-row">
        <div class="form-group">
          <label>Nom du personnel *</label>
          <input type="text" class="form-control" id="sh-staff" value="${escapeHtml(record?.staff_name || '')}" placeholder="ex: Marie Dupont" autofocus>
        </div>
        <div class="form-group">
          <label>Type de fiche *</label>
          <select class="form-control" id="sh-type">
            <option value="aptitude"          ${(!record || record.record_type === 'aptitude')          ? 'selected' : ''}>Aptitude médicale</option>
            <option value="visite_medicale"    ${record?.record_type === 'visite_medicale'    ? 'selected' : ''}>Visite médicale</option>
            <option value="maladie"            ${record?.record_type === 'maladie'            ? 'selected' : ''}>Arrêt maladie</option>
            <option value="blessure"           ${record?.record_type === 'blessure'           ? 'selected' : ''}>Blessure / Plaie</option>
            <option value="formation_hygiene"  ${record?.record_type === 'formation_hygiene'  ? 'selected' : ''}>Formation hygiène</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date *</label>
          <input type="date" class="form-control" id="sh-date" value="${record?.date_record || ''}">
        </div>
        <div class="form-group">
          <label>Date d'expiration / retour</label>
          <input type="date" class="form-control" id="sh-expiry" value="${record?.date_expiry || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="sh-notes" rows="3" placeholder="ex: Gastro-entérite — exclu du service jusqu'au retour">${escapeHtml(record?.notes || '')}</textarea>
      </div>
      <div style="background:#f0f4ff;border-radius:6px;padding:10px 14px;font-size:0.82rem;color:#3730a3;margin-bottom:16px">
        <strong>Rappel légal :</strong> En cas de maladie ou blessure infectieuse, le membre du personnel doit être exclu immédiatement de la manipulation des aliments (CE 852/2004, Chap. VIII, art. 2).
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="sh-cancel">Annuler</button>
        <button class="btn btn-primary" id="sh-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('sh-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('sh-save').addEventListener('click', async () => {
    const staff_name = document.getElementById('sh-staff').value.trim();
    const record_type = document.getElementById('sh-type').value;
    const date_record = document.getElementById('sh-date').value;
    if (!staff_name) { document.getElementById('sh-staff').classList.add('form-control--error'); return; }
    if (!date_record) { document.getElementById('sh-date').classList.add('form-control--error'); return; }
    const payload = {
      staff_name,
      record_type,
      date_record,
      date_expiry: document.getElementById('sh-expiry').value || null,
      notes: document.getElementById('sh-notes').value.trim() || null,
    };
    try {
      if (isEdit) {
        await API.request('/sanitary/staff-health/' + record.id, { method: 'PUT', body: payload });
        showToast('Enregistrement mis à jour ✓', 'success');
      } else {
        await API.request('/sanitary/staff-health', { method: 'POST', body: payload });
        showToast('Enregistrement créé ✓', 'success');
      }
      overlay.remove();
      renderHACCPStaffHealth();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
