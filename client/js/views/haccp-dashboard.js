// ═══════════════════════════════════════════
// HACCP Dashboard — Route #/haccp
// ═══════════════════════════════════════════

// Shared subnav for all HACCP pages (9 sections)
const HACCP_SUBNAV_FULL = `
  <div class="haccp-subnav">
    <a href="#/haccp" class="haccp-subnav__link" id="haccp-nav-dashboard">Dashboard</a>
    <a href="#/haccp/temperatures" class="haccp-subnav__link">Températures</a>
    <a href="#/haccp/cleaning" class="haccp-subnav__link">Nettoyage</a>
    <a href="#/haccp/traceability" class="haccp-subnav__link">Traçabilité</a>
    <a href="#/haccp/cooling" class="haccp-subnav__link">Refroidissement</a>
    <a href="#/haccp/reheating" class="haccp-subnav__link">Remise en T°</a>
    <a href="#/haccp/fryers" class="haccp-subnav__link">Friteuses</a>
    <a href="#/haccp/non-conformities" class="haccp-subnav__link">Non-conf.</a>
    <a href="#/haccp/allergens" class="haccp-subnav__link">Allergènes</a>
    <a href="#/haccp/plan" class="haccp-subnav__link">Plan HACCP</a>
    <a href="#/haccp/recall" class="haccp-subnav__link">Retrait/Rappel</a>
    <a href="#/haccp/training" class="haccp-subnav__link">Formation</a>
    <a href="#/haccp/pest-control" class="haccp-subnav__link">Nuisibles</a>
    <a href="#/haccp/maintenance" class="haccp-subnav__link">Maintenance</a>
    <a href="#/haccp/waste" class="haccp-subnav__link">Déchets</a>
  </div>
`;

async function renderHACCPDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [tempData, cleaningData, receptions, dlcAlerts] = await Promise.all([
      API.getTemperaturesToday(),
      API.getCleaningToday(),
      API.getTraceability(),
      API.getDLCAlerts(),
    ]);

    const account = getAccount();
    const isGerant = account && account.role === 'gerant';
    const lastReceptions = receptions.slice(0, 5);

    app.innerHTML = `
      <div class="haccp-dashboard">
        <div class="page-header">
          <h1><i data-lucide="shield-check" style="width:28px;height:28px;vertical-align:middle;color:var(--color-accent)"></i> HACCP</h1>
        </div>

        <!-- HACCP Sub-navigation -->
        ${HACCP_SUBNAV_FULL.replace('id="haccp-nav-dashboard"', 'id="haccp-nav-dashboard" style="font-weight:700"')}

        <!-- SECTION: Températures du jour -->
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>🌡️ Températures du jour</span>
          <a href="#/haccp/temperatures" class="btn btn-ghost btn-sm">Historique →</a>
        </div>

        <div class="haccp-temp-grid">
          ${tempData.map(zone => {
            const statusClass = zone.status === 'alert' ? 'haccp-zone--alert' :
                               zone.status === 'missing' ? 'haccp-zone--missing' :
                               zone.needs_recording ? 'haccp-zone--warning' : 'haccp-zone--ok';
            const lastTemp = zone.last_log ? zone.last_log.temperature.toFixed(1) : '—';
            const lastTime = zone.last_log
              ? new Date(zone.last_log.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : 'Aucun relevé';
            const typeIcons = { fridge: '❄️', freezer: '🧊', cold_room: '🏔️' };
            return `
              <div class="haccp-zone-card ${statusClass}">
                <div class="haccp-zone-card__header">
                  <span class="haccp-zone-card__icon">${typeIcons[zone.type] || '🌡️'}</span>
                  <span class="haccp-zone-card__name">${escapeHtml(zone.name)}</span>
                  <span class="haccp-zone-card__status">
                    ${zone.status === 'alert' ? '⚠️ ALERTE' : zone.status === 'missing' ? '⏰ Manquant' : zone.needs_recording ? '⏰ >4h' : '✅ OK'}
                  </span>
                </div>
                <div class="haccp-zone-card__temp">
                  <span class="haccp-zone-card__value">${lastTemp}°C</span>
                  <span class="haccp-zone-card__range">${zone.min_temp}° / ${zone.max_temp}°</span>
                </div>
                <div class="haccp-zone-card__time">${lastTime}</div>
                <button class="btn btn-primary haccp-record-btn" data-zone-id="${zone.id}" data-zone-name="${escapeHtml(zone.name)}" data-min="${zone.min_temp}" data-max="${zone.max_temp}">
                  <i data-lucide="thermometer" style="width:18px;height:18px"></i> Relever
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <!-- SECTION: Nettoyage du jour -->
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>🧹 Nettoyage du jour — ${cleaningData.done}/${cleaningData.total} effectuées</span>
          <a href="#/haccp/cleaning" class="btn btn-ghost btn-sm">Gérer →</a>
        </div>

        <div class="haccp-cleaning-progress">
          <div class="haccp-cleaning-progress__bar">
            <div class="haccp-cleaning-progress__fill" style="width:${cleaningData.total > 0 ? (cleaningData.done / cleaningData.total * 100) : 0}%"></div>
          </div>
        </div>

        <div class="haccp-cleaning-list">
          ${cleaningData.tasks.map(task => `
            <div class="haccp-cleaning-item ${task.done_today ? 'haccp-cleaning-item--done' : ''}">
              <button class="haccp-cleaning-check ${task.done_today ? 'checked' : ''}" 
                      data-task-id="${task.id}" ${task.done_today ? 'disabled' : ''}>
                ${task.done_today ? '✓' : ''}
              </button>
              <div class="haccp-cleaning-item__info">
                <span class="haccp-cleaning-item__name">${escapeHtml(task.name)}</span>
                <span class="haccp-cleaning-item__zone">${escapeHtml(task.zone)} · ${task.frequency === 'daily' ? 'Quotidien' : task.frequency === 'weekly' ? 'Hebdo' : 'Mensuel'}</span>
              </div>
              ${task.done_today ? `<span class="haccp-cleaning-item__done-by">${escapeHtml(task.done_by || '')} ${new Date(task.done_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
            </div>
          `).join('')}
          ${cleaningData.tasks.length === 0 ? '<p class="text-secondary" style="padding:var(--space-4)">Aucune tâche prévue aujourd\'hui</p>' : ''}
        </div>

        <!-- SECTION: Dernières réceptions -->
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>📦 Dernières réceptions</span>
          <a href="#/haccp/traceability" class="btn btn-ghost btn-sm">Voir tout →</a>
        </div>

        <div class="haccp-receptions-list">
          ${lastReceptions.map(rec => {
            const dlcDays = rec.dlc ? Math.ceil((new Date(rec.dlc) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const dlcClass = dlcDays !== null && dlcDays <= 3 ? 'haccp-dlc--warning' : '';
            const dlcExpired = dlcDays !== null && dlcDays < 0;
            return `
              <div class="haccp-reception-card">
                <div class="haccp-reception-card__main">
                  <span class="haccp-reception-card__product">${escapeHtml(rec.product_name)}</span>
                  <span class="haccp-reception-card__supplier">${escapeHtml(rec.supplier || '—')}</span>
                </div>
                <div class="haccp-reception-card__meta">
                  ${rec.dlc ? `<span class="badge ${dlcExpired ? 'badge--danger' : dlcClass ? 'badge--warning' : 'badge--success'}">${dlcExpired ? 'DLC dépassée' : dlcDays <= 3 ? `DLC J-${dlcDays}` : `DLC ${new Date(rec.dlc).toLocaleDateString('fr-FR')}`}</span>` : ''}
                  <span class="text-secondary text-sm">${new Date(rec.received_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            `;
          }).join('')}
          ${lastReceptions.length === 0 ? '<p class="text-secondary" style="padding:var(--space-4)">Aucune réception enregistrée</p>' : ''}
        </div>

        ${dlcAlerts.length > 0 ? `
        <div class="haccp-dlc-alert-banner">
          <i data-lucide="alert-triangle" style="width:20px;height:20px"></i>
          <span><strong>${dlcAlerts.length} produit(s)</strong> proche(s) de la DLC ou dépassé(s)</span>
        </div>
        ` : ''}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    setupDashboardEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur de chargement HACCP : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupDashboardEvents() {
  // Temperature recording buttons
  document.querySelectorAll('.haccp-record-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showTemperatureModal(
        Number(btn.dataset.zoneId),
        btn.dataset.zoneName,
        Number(btn.dataset.min),
        Number(btn.dataset.max)
      );
    });
  });

  // Cleaning checkboxes
  document.querySelectorAll('.haccp-cleaning-check:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = Number(btn.dataset.taskId);
      const account = getAccount();
      try {
        await API.markCleaningDone(taskId, { completed_by: account ? account.id : null });
        showToast('Tâche validée ✓', 'success');
        renderHACCPDashboard(); // Refresh
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

function showTemperatureModal(zoneId, zoneName, minTemp, maxTemp) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const account = getAccount();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2><i data-lucide="thermometer" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Relevé — ${escapeHtml(zoneName)}</h2>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-4)">Plage normale : ${minTemp}°C à ${maxTemp}°C</p>
      <div class="form-group">
        <label>Température (°C)</label>
        <input type="number" step="0.1" class="form-control haccp-temp-input" id="modal-temp" 
               placeholder="ex: 3.5" inputmode="decimal" autofocus
               style="font-size:var(--text-2xl);text-align:center;font-family:var(--font-mono)">
      </div>
      <div class="form-group">
        <label>Notes (optionnel)</label>
        <input type="text" class="form-control" id="modal-notes" placeholder="ex: porte restée ouverte">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="modal-cancel">Annuler</button>
        <button class="btn btn-primary" id="modal-save" style="min-width:140px">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  const tempInput = document.getElementById('modal-temp');
  tempInput.focus();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById('modal-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('modal-save').addEventListener('click', async () => {
    const temperature = parseFloat(tempInput.value);
    if (isNaN(temperature)) {
      tempInput.classList.add('form-control--error');
      return;
    }
    const notes = document.getElementById('modal-notes').value.trim();
    try {
      await API.recordTemperature({
        zone_id: zoneId,
        temperature,
        notes: notes || null,
        recorded_by: account ? account.id : null
      });
      overlay.remove();
      const isAlert = temperature < minTemp || temperature > maxTemp;
      showToast(isAlert ? `⚠️ ALERTE : ${temperature}°C hors norme !` : `✅ ${temperature}°C enregistré`, isAlert ? 'error' : 'success');
      renderHACCPDashboard();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });

  // Enter key to submit
  tempInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('modal-save').click();
  });
}
