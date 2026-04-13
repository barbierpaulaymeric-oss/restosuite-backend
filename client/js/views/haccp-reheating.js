// ═══════════════════════════════════════════
// HACCP Remises en température — Route #/haccp/reheating
// Réglementation : atteindre +63°C en moins de 1h
// ═══════════════════════════════════════════

async function renderHACCPReheating() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.getReheatingLogs({ limit: 100 });
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="flame" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Remises en température</h1>
          <button class="btn btn-primary" id="btn-new-reheat">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">Réglementation : atteindre <strong>+63°C en moins de 1h</strong> depuis la mise en chauffe.</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Début</th>
                <th>T° initiale</th>
                <th>Atteinte 63°C</th>
                <th>Durée</th>
                <th>Conformité</th>
                <th>Opérateur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderReheatingRows(items)}</tbody>
          </table>
        </div>
        ${items.length === 0 ? '<div class="empty-state"><p>Aucun enregistrement</p></div>' : ''}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupReheatingEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderReheatingRows(items) {
  return items.map(item => {
    const startDate = new Date(item.start_time).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    const time63 = item.time_at_63c ? new Date(item.time_at_63c).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    let durationStr = '—';
    if (item.time_at_63c) {
      const mins = Math.round((new Date(item.time_at_63c) - new Date(item.start_time)) / 60000);
      durationStr = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
    }
    const complianceHtml = item.is_compliant === null
      ? '<span class="badge">En cours</span>'
      : item.is_compliant
        ? '<span class="badge badge--success">✓ Conforme</span>'
        : '<span class="badge badge--danger">✗ Non conforme</span>';
    return `
      <tr>
        <td style="font-weight:500">${escapeHtml(item.product_name)}</td>
        <td class="mono text-sm">${startDate}</td>
        <td class="mono">${item.temp_start}°C</td>
        <td class="mono">${time63}</td>
        <td class="mono">${durationStr}</td>
        <td>${complianceHtml}</td>
        <td>${escapeHtml(item.recorded_by_name || '—')}</td>
        <td>${item.is_compliant === null ? `<button class="btn btn-secondary btn-sm" data-id="${item.id}" data-product="${escapeHtml(item.product_name)}" data-action="update-reheat">Compléter</button>` : ''}</td>
      </tr>
    `;
  }).join('');
}

function setupReheatingEvents() {
  document.getElementById('btn-new-reheat')?.addEventListener('click', () => showReheatingModal());
  document.querySelectorAll('[data-action="update-reheat"]').forEach(btn => {
    btn.addEventListener('click', () => showReheatingUpdateModal(Number(btn.dataset.id), btn.dataset.product));
  });
}

function showReheatingModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();
  const now = new Date().toISOString().slice(0, 16);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <h2><i data-lucide="flame" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Nouvelle remise en température</h2>
      <p class="text-secondary text-sm" style="margin-bottom:16px">Complétez quand +63°C est atteint.</p>
      <div class="form-group">
        <label>Produit *</label>
        <input type="text" class="form-control" id="reheat-product" placeholder="ex: Bœuf bourguignon" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Heure début *</label>
          <input type="datetime-local" class="form-control" id="reheat-start" value="${now}">
        </div>
        <div class="form-group">
          <label>T° initiale (°C) *</label>
          <input type="number" step="0.1" class="form-control" id="reheat-temp" placeholder="ex: 4" inputmode="decimal">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="reheat-notes" placeholder="ex: Bain-marie">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="reheat-cancel">Annuler</button>
        <button class="btn btn-primary" id="reheat-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('reheat-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('reheat-save').addEventListener('click', async () => {
    const product_name = document.getElementById('reheat-product').value.trim();
    const temp_start = parseFloat(document.getElementById('reheat-temp').value);
    if (!product_name) { document.getElementById('reheat-product').classList.add('form-control--error'); return; }
    if (isNaN(temp_start)) { document.getElementById('reheat-temp').classList.add('form-control--error'); return; }
    try {
      await API.createReheatingLog({
        product_name,
        start_time: new Date(document.getElementById('reheat-start').value).toISOString(),
        temp_start,
        notes: document.getElementById('reheat-notes').value.trim() || null,
        recorded_by: account ? account.id : null,
      });
      overlay.remove();
      showToast('Remise en température enregistrée ✓', 'success');
      renderHACCPReheating();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}

function showReheatingUpdateModal(id, productName) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const now = new Date().toISOString().slice(0, 16);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:440px">
      <h2><i data-lucide="flame" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Compléter — ${escapeHtml(productName)}</h2>
      <div class="form-group">
        <label>Heure atteinte 63°C *</label>
        <input type="datetime-local" class="form-control" id="reheat-u-63c" value="${now}">
        <p class="text-secondary text-sm">Objectif : moins de 1h depuis le début</p>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="reheat-u-notes">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="reheat-u-cancel">Annuler</button>
        <button class="btn btn-primary" id="reheat-u-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('reheat-u-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('reheat-u-save').addEventListener('click', async () => {
    const t63 = document.getElementById('reheat-u-63c').value;
    try {
      await API.updateReheatingLog(id, {
        time_at_63c: t63 ? new Date(t63).toISOString() : null,
        notes: document.getElementById('reheat-u-notes').value.trim() || null,
      });
      overlay.remove();
      showToast('Remise en température complétée ✓', 'success');
      renderHACCPReheating();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}
