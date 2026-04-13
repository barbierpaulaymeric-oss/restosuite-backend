// ═══════════════════════════════════════════
// HACCP Refroidissements rapides — Route #/haccp/cooling
// Réglementation : de +63°C à +10°C en moins de 2h
// ═══════════════════════════════════════════

async function renderHACCPCooling() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.getCoolingLogs({ limit: 100 });
    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="snowflake" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Refroidissements rapides</h1>
          <button class="btn btn-primary" id="btn-new-cooling">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}
        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">Réglementation : passage de <strong>+63°C à +10°C en moins de 2h</strong>.</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Début</th>
                <th>T° initiale</th>
                <th>Passage 63°C</th>
                <th>Passage 10°C</th>
                <th>Durée 63→10°C</th>
                <th>Conformité</th>
                <th>Opérateur</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="cooling-table-body">
              ${renderCoolingRows(items)}
            </tbody>
          </table>
        </div>
        ${items.length === 0 ? '<div class="empty-state"><p>Aucun enregistrement</p></div>' : ''}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupCoolingEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderCoolingRows(items) {
  return items.map(item => {
    const startDate = new Date(item.start_time).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    const time63 = item.time_at_63c ? new Date(item.time_at_63c).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const time10 = item.time_at_10c ? new Date(item.time_at_10c).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    let durationStr = '—';
    if (item.time_at_63c && item.time_at_10c) {
      const mins = Math.round((new Date(item.time_at_10c) - new Date(item.time_at_63c)) / 60000);
      durationStr = `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
    }
    const complianceHtml = item.is_compliant === null
      ? '<span class="badge">En cours</span>'
      : item.is_compliant
        ? '<span class="badge badge--success">✓ Conforme</span>'
        : '<span class="badge badge--danger">✗ Non conforme</span>';
    const needsUpdate = item.is_compliant === null;
    return `
      <tr>
        <td style="font-weight:500">${escapeHtml(item.product_name)}</td>
        <td class="mono text-sm">${startDate}</td>
        <td class="mono">${item.temp_start}°C</td>
        <td class="mono">${time63}</td>
        <td class="mono">${time10}</td>
        <td class="mono">${durationStr}</td>
        <td>${complianceHtml}</td>
        <td>${escapeHtml(item.recorded_by_name || '—')}</td>
        <td>${needsUpdate ? `<button class="btn btn-secondary btn-sm" data-id="${item.id}" data-product="${escapeHtml(item.product_name)}" data-action="update-cooling">Compléter</button>` : ''}</td>
      </tr>
    `;
  }).join('');
}

function setupCoolingEvents() {
  document.getElementById('btn-new-cooling')?.addEventListener('click', () => showCoolingModal());
  document.querySelectorAll('[data-action="update-cooling"]').forEach(btn => {
    btn.addEventListener('click', () => showCoolingUpdateModal(Number(btn.dataset.id), btn.dataset.product));
  });
}

function showCoolingModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = getAccount();
  const now = new Date().toISOString().slice(0, 16);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <h2><i data-lucide="snowflake" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Nouveau refroidissement</h2>
      <p class="text-secondary text-sm" style="margin-bottom:16px">Enregistrez le début. Complétez les temps de passage ultérieurement.</p>
      <div class="form-group">
        <label>Produit *</label>
        <input type="text" class="form-control" id="cool-product" placeholder="ex: Blanquette de veau" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Heure début *</label>
          <input type="datetime-local" class="form-control" id="cool-start" value="${now}">
        </div>
        <div class="form-group">
          <label>T° initiale (°C) *</label>
          <input type="number" step="0.1" class="form-control" id="cool-temp" placeholder="ex: 85" inputmode="decimal">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="cool-notes" placeholder="ex: Cellule de refroidissement n°1">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="cool-cancel">Annuler</button>
        <button class="btn btn-primary" id="cool-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cool-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('cool-save').addEventListener('click', async () => {
    const product_name = document.getElementById('cool-product').value.trim();
    const temp_start = parseFloat(document.getElementById('cool-temp').value);
    if (!product_name) { document.getElementById('cool-product').classList.add('form-control--error'); return; }
    if (isNaN(temp_start)) { document.getElementById('cool-temp').classList.add('form-control--error'); return; }
    try {
      await API.createCoolingLog({
        product_name,
        start_time: new Date(document.getElementById('cool-start').value).toISOString(),
        temp_start,
        notes: document.getElementById('cool-notes').value.trim() || null,
        recorded_by: account ? account.id : null,
      });
      overlay.remove();
      showToast('Refroidissement enregistré ✓', 'success');
      renderHACCPCooling();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}

function showCoolingUpdateModal(id, productName) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const now = new Date().toISOString().slice(0, 16);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h2><i data-lucide="snowflake" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Compléter — ${escapeHtml(productName)}</h2>
      <div class="form-group">
        <label>Heure passage 63°C ↓</label>
        <input type="datetime-local" class="form-control" id="cool-u-63c" value="${now}">
      </div>
      <div class="form-group">
        <label>Heure passage 10°C ↓</label>
        <input type="datetime-local" class="form-control" id="cool-u-10c" value="${now}">
        <p class="text-secondary text-sm">Objectif : moins de 2h entre 63°C et 10°C</p>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="cool-u-notes">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="cool-u-cancel">Annuler</button>
        <button class="btn btn-primary" id="cool-u-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cool-u-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('cool-u-save').addEventListener('click', async () => {
    const t63 = document.getElementById('cool-u-63c').value;
    const t10 = document.getElementById('cool-u-10c').value;
    try {
      await API.updateCoolingLog(id, {
        time_at_63c: t63 ? new Date(t63).toISOString() : null,
        time_at_10c: t10 ? new Date(t10).toISOString() : null,
        notes: document.getElementById('cool-u-notes').value.trim() || null,
      });
      overlay.remove();
      if (t63 && t10) {
        const mins = Math.round((new Date(t10) - new Date(t63)) / 60000);
        showToast(mins <= 120 ? `✅ Conforme — ${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}` : `⚠️ Non conforme — ${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')} > 2h`, mins <= 120 ? 'success' : 'error');
      }
      renderHACCPCooling();
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
  });
}
