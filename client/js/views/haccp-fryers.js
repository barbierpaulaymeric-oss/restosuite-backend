// ═══════════════════════════════════════════
// HACCP Huiles de friture — Route #/haccp/fryers
// Seuil légal : 25% composés polaires
// ═══════════════════════════════════════════

const FRYER_ACTION_LABELS = {
  mise_en_service: '🔧 Mise en service',
  controle_polaire: '🧪 Contrôle polaire',
  filtrage: '🔽 Filtrage',
  changement: '🔄 Changement huile',
};

async function renderHACCPFryers() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items: fryers } = await API.getFryers();
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="flame" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Huiles de friture</h1>
          <button class="btn btn-primary" id="btn-new-fryer">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter friteuse
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}
        <div style="background:rgba(59,158,222,0.12);border:1px solid rgba(59,158,222,0.45);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start;color:var(--text-primary)">
          <i data-lucide="info" style="width:18px;height:18px;color:var(--color-info);flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">Seuil légal : <strong>25% de composés polaires</strong>. Au-delà, changement obligatoire.</span>
        </div>
        <div id="fryers-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
          ${fryers.length === 0 ? '<p class="text-secondary" style="grid-column:1/-1;padding:16px">Aucune friteuse enregistrée. Ajoutez-en une pour commencer.</p>' : fryers.map(f => renderFryerCard(f)).join('')}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupFryerEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderFryerCard(fryer) {
  const lastPolar = fryer.last_check && fryer.last_check.action_type === 'controle_polaire' ? fryer.last_check : null;
  const polar = lastPolar ? lastPolar.polar_value : null;
  const polarClass = polar !== null ? (polar >= 25 ? 'color:var(--color-danger,#dc3545);' : polar >= 20 ? 'color:var(--color-warning,#ffc107);' : 'color:var(--color-success,#28a745);') : '';
  const serviceDate = fryer.service_start ? new Date(fryer.service_start.action_date).toLocaleDateString('fr-FR') : 'Non renseigné';
  const lastFilterDate = fryer.last_filter ? new Date(fryer.last_filter.action_date).toLocaleDateString('fr-FR') : '—';
  const lastChangeDate = fryer.last_change ? new Date(fryer.last_change.action_date).toLocaleDateString('fr-FR') : '—';
  return `
    <div class="card" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:var(--text-lg)">${escapeHtml(fryer.name)}</h3>
        ${polar !== null && polar >= 25 ? '<span class="badge badge--danger">Huile à changer !</span>' : ''}
        ${polar !== null && polar >= 20 && polar < 25 ? '<span class="badge badge--warning">Surveiller</span>' : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div><div class="text-secondary text-sm">Mise en service</div><div class="mono text-sm">${serviceDate}</div></div>
        <div><div class="text-secondary text-sm">Composés polaires</div><div class="mono" style="font-size:var(--text-xl);font-weight:700;${polarClass}">${polar !== null ? polar + '%' : '—'}</div></div>
        <div><div class="text-secondary text-sm">Dernier filtrage</div><div class="mono text-sm">${lastFilterDate}</div></div>
        <div><div class="text-secondary text-sm">Dernier changement</div><div class="mono text-sm">${lastChangeDate}</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-check" data-type="controle_polaire">🧪 Polaire</button>
        <button class="btn btn-secondary btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-check" data-type="filtrage">🔽 Filtrage</button>
        <button class="btn btn-secondary btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-check" data-type="changement">🔄 Changement</button>
        <button class="btn btn-ghost btn-sm" data-fryer-id="${fryer.id}" data-fryer-name="${escapeHtml(fryer.name)}" data-action="fryer-history">📋 Historique</button>
      </div>
    </div>
  `;
}

function setupFryerEvents() {
  document.getElementById('btn-new-fryer')?.addEventListener('click', () => showNewFryerModal());
  document.querySelectorAll('[data-action="fryer-check"]').forEach(btn => {
    btn.addEventListener('click', () => showFryerCheckModal(Number(btn.dataset.fryerId), btn.dataset.fryerName, btn.dataset.type));
  });
  document.querySelectorAll('[data-action="fryer-history"]').forEach(btn => {
    btn.addEventListener('click', () => showFryerHistoryModal(Number(btn.dataset.fryerId), btn.dataset.fryerName));
  });
}

function showNewFryerModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h2><i data-lucide="flame" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Ajouter une friteuse</h2>
      <div class="form-group">
        <label>Nom *</label>
        <input type="text" class="form-control" id="fryer-name-input" placeholder="ex: Friteuse 1, Grande friteuse" autofocus>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="fryer-cancel">Annuler</button>
        <button class="btn btn-primary" id="fryer-save">Ajouter</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('fryer-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('fryer-save').addEventListener('click', async () => {
    const name = document.getElementById('fryer-name-input').value.trim();
    if (!name) { document.getElementById('fryer-name-input').classList.add('form-control--error'); return; }
    try {
      const account = getAccount();
      const { id } = await API.createFryer({ name });
      await API.createFryerCheck(id, { action_type: 'mise_en_service', recorded_by: account ? account.id : null });
      overlay.remove();
      showToast('Friteuse ajoutée ✓', 'success');
      renderHACCPFryers();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}

function showFryerCheckModal(fryerId, fryerName, actionType) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();
  const now = new Date().toISOString().slice(0, 16);
  const isPolar = actionType === 'controle_polaire';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <h2>${FRYER_ACTION_LABELS[actionType]} — ${escapeHtml(fryerName)}</h2>
      <div class="form-group">
        <label>Date et heure</label>
        <input type="datetime-local" class="form-control" id="fryer-check-date" value="${now}">
      </div>
      ${isPolar ? `
      <div class="form-group">
        <label>Valeur (% composés polaires) *</label>
        <input type="number" step="0.1" min="0" max="100" class="form-control" id="fryer-polar-val"
               placeholder="ex: 18.5" inputmode="decimal" autofocus
               style="font-size:var(--text-2xl);text-align:center;font-family:var(--font-mono)">
        <p class="text-secondary text-sm">Seuil légal : 25%</p>
      </div>
      ` : ''}
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="fryer-check-notes" placeholder="Observations">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="fryer-check-cancel">Annuler</button>
        <button class="btn btn-primary" id="fryer-check-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('fryer-check-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('fryer-check-save').addEventListener('click', async () => {
    const polar_value = isPolar ? parseFloat(document.getElementById('fryer-polar-val').value) : null;
    if (isPolar && isNaN(polar_value)) { document.getElementById('fryer-polar-val').classList.add('form-control--error'); return; }
    try {
      await API.createFryerCheck(fryerId, {
        action_type: actionType,
        action_date: new Date(document.getElementById('fryer-check-date').value).toISOString(),
        polar_value: isPolar ? polar_value : null,
        notes: document.getElementById('fryer-check-notes').value.trim() || null,
        recorded_by: account ? account.id : null,
      });
      overlay.remove();
      if (isPolar && polar_value >= 25) {
        showToast(`⚠️ ${polar_value}% — Seuil dépassé ! Changement obligatoire`, 'error');
      } else {
        showToast(`${FRYER_ACTION_LABELS[actionType]} enregistré ✓`, 'success');
      }
      renderHACCPFryers();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}

async function showFryerHistoryModal(fryerId, fryerName) {
  try {
    const { items } = await API.getFryerChecks(fryerId);
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:600px">
        <h2><i data-lucide="clipboard-list" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Historique — ${escapeHtml(fryerName)}</h2>
        <div class="table-container" style="max-height:400px;overflow-y:auto">
          <table>
            <thead><tr><th>Date</th><th>Action</th><th>Polaire</th><th>Notes</th><th>Opérateur</th></tr></thead>
            <tbody>
              ${items.map(c => `
                <tr>
                  <td class="mono text-sm">${new Date(c.action_date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>${escapeHtml(FRYER_ACTION_LABELS[c.action_type] || c.action_type)}</td>
                  <td class="mono ${c.polar_value !== null && c.polar_value >= 25 ? 'text-danger' : ''}">${c.polar_value !== null ? c.polar_value + '%' : '—'}</td>
                  <td class="text-secondary text-sm">${escapeHtml(c.notes || '—')}</td>
                  <td>${escapeHtml(c.recorded_by_name || '—')}</td>
                </tr>
              `).join('')}
              ${items.length === 0 ? '<tr><td colspan="5" class="text-secondary" style="text-align:center">Aucun enregistrement</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        <div style="text-align:right;margin-top:16px">
          <button class="btn btn-secondary" id="fryer-hist-close">Fermer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('fryer-hist-close').addEventListener('click', () => overlay.remove());
  } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}
