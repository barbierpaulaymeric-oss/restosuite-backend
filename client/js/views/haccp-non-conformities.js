// ═══════════════════════════════════════════
// HACCP Non-conformités — Route #/haccp/non-conformities
// ═══════════════════════════════════════════

const NC_CATEGORIES = {
  temperature: '🌡️ Température',
  dlc: '📅 DLC/DLUO',
  hygiene: '🧹 Hygiène',
  reception: '📦 Réception',
  equipement: '⚙️ Équipement',
  allergen: '⚠️ Allergène',
  autre: '📋 Autre',
};

const NC_SEVERITIES = {
  mineure: { label: 'Mineure', class: 'badge--info' },
  majeure: { label: 'Majeure', class: 'badge--warning' },
  critique: { label: 'Critique', class: 'badge--danger' },
};

async function renderHACCPNonConformities() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [openData, closedData] = await Promise.all([
      API.getNonConformities('ouvert'),
      API.getNonConformities('resolu'),
    ]);
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="alert-triangle" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Non-conformités</h1>
          <button class="btn btn-primary" id="btn-new-nc">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Déclarer
          </button>
        </div>
        ${haccpBreadcrumb('hygiene')}

        ${openData.items.length > 0 ? `
        <div class="section-title" style="display:flex;align-items:center;gap:8px">
          <span>🔴 En cours (${openData.items.length})</span>
        </div>
        <div>
          ${openData.items.map(nc => renderNCCard(nc, false)).join('')}
        </div>
        ` : '<div style="background:#d4edda;border:1px solid #28a745;border-radius:8px;padding:12px 16px;margin-bottom:16px">✅ Aucune non-conformité ouverte</div>'}

        ${closedData.items.length > 0 ? `
        <div class="section-title" style="margin-top:24px">✅ Résolues (${closedData.items.length})</div>
        <div>
          ${closedData.items.slice(0, 10).map(nc => renderNCCard(nc, true)).join('')}
        </div>
        ` : ''}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupNCEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderNCCard(nc, resolved) {
  const sev = NC_SEVERITIES[nc.severity] || NC_SEVERITIES.mineure;
  const cat = NC_CATEGORIES[nc.category] || nc.category;
  const detectedDate = new Date(nc.detected_at).toLocaleDateString('fr-FR');
  const borderColor = nc.severity === 'critique' ? 'var(--color-danger,#dc3545)' : nc.severity === 'majeure' ? 'var(--color-warning,#ffc107)' : 'var(--color-info,#3b9ede)';
  return `
    <div class="card" style="padding:16px;margin-bottom:12px;border-left:4px solid ${borderColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="badge ${sev.class}">${sev.label}</span>
            <span class="text-secondary text-sm">${cat}</span>
            <span class="text-secondary text-sm">· ${detectedDate}</span>
          </div>
          <div style="font-weight:600;margin-bottom:4px">${escapeHtml(nc.title)}</div>
          ${nc.description ? `<div class="text-secondary text-sm" style="margin-bottom:8px">${escapeHtml(nc.description)}</div>` : ''}
          ${nc.corrective_action ? `<div style="background:var(--color-bg-secondary,#f8f9fa);border-radius:4px;padding:8px 12px;margin-top:8px;font-size:var(--text-sm)"><strong>Action corrective :</strong> ${escapeHtml(nc.corrective_action)}</div>` : ''}
          ${resolved && nc.resolved_at ? `<div class="text-secondary text-sm" style="margin-top:4px">Résolu le ${new Date(nc.resolved_at).toLocaleDateString('fr-FR')} par ${escapeHtml(nc.resolved_by_name || '—')}</div>` : ''}
        </div>
        ${!resolved ? `<button class="btn btn-secondary btn-sm" data-nc-id="${nc.id}" data-nc-title="${escapeHtml(nc.title)}" data-action="nc-resolve">Résoudre</button>` : ''}
      </div>
    </div>
  `;
}

function setupNCEvents() {
  document.getElementById('btn-new-nc')?.addEventListener('click', () => showNCModal());
  document.querySelectorAll('[data-action="nc-resolve"]').forEach(btn => {
    btn.addEventListener('click', () => showNCResolveModal(Number(btn.dataset.ncId), btn.dataset.ncTitle));
  });
}

function showNCModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <h2><i data-lucide="alert-triangle" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Déclarer une non-conformité</h2>
      <div class="form-group">
        <label>Titre *</label>
        <input type="text" class="form-control" id="nc-title" placeholder="ex: Température frigo hors norme" autofocus data-ui="custom">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Catégorie</label>
          <select class="form-control" id="nc-category" data-ui="custom">
            ${Object.entries(NC_CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Sévérité</label>
          <select class="form-control" id="nc-severity" data-ui="custom">
            ${Object.entries(NC_SEVERITIES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-control" id="nc-description" rows="3" placeholder="Décrivez la non-conformité..." data-ui="custom"></textarea>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="nc-cancel">Annuler</button>
        <button class="btn btn-primary" id="nc-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Déclarer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('nc-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('nc-save').addEventListener('click', async () => {
    const title = document.getElementById('nc-title').value.trim();
    if (!title) { document.getElementById('nc-title').classList.add('form-control--error'); return; }
    try {
      await API.createNonConformity({
        title,
        description: document.getElementById('nc-description').value.trim() || null,
        category: document.getElementById('nc-category').value,
        severity: document.getElementById('nc-severity').value,
        detected_by: account ? account.id : null,
      });
      overlay.remove();
      showToast('Non-conformité déclarée ✓', 'success');
      renderHACCPNonConformities();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}

function showNCResolveModal(id, title) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h2><i data-lucide="check-circle" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Résoudre — ${escapeHtml(title)}</h2>
      <div class="form-group">
        <label>Action corrective *</label>
        <textarea class="form-control" id="nc-corrective" rows="4" placeholder="Décrivez l'action corrective mise en place..." autofocus data-ui="custom"></textarea>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="nc-r-cancel">Annuler</button>
        <button class="btn btn-primary" id="nc-r-save" style="background:var(--color-success,#28a745)">
          <i data-lucide="check-circle" style="width:18px;height:18px"></i> Marquer résolue
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('nc-r-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('nc-r-save').addEventListener('click', async () => {
    const corrective_action = document.getElementById('nc-corrective').value.trim();
    if (!corrective_action) { document.getElementById('nc-corrective').classList.add('form-control--error'); return; }
    try {
      await API.updateNonConformity(id, {
        corrective_action,
        status: 'resolu',
        resolved_by: account ? account.id : null,
      });
      overlay.remove();
      showToast('Non-conformité résolue ✓', 'success');
      renderHACCPNonConformities();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}
