// ═══════════════════════════════════════════
// HACCP Dashboard — Route #/haccp
// ═══════════════════════════════════════════

// Shared subnav for all HACCP pages — actif dynamique selon la route courante
const HACCP_SUBNAV_ITEMS = [
  { href: '#/haccp',                       label: 'Dashboard' },
  { href: '#/haccp/temperatures',          label: 'Températures' },
  { href: '#/haccp/calibrations',          label: 'Étalonnage' },
  { href: '#/haccp/cleaning',              label: 'Nettoyage' },
  { href: '#/haccp/traceability',          label: 'Traçabilité' },
  { href: '#/haccp/cooking',               label: 'Cuisson (CCP2)' },
  { href: '#/haccp/cooling',               label: 'Refroidissement' },
  { href: '#/haccp/reheating',             label: 'Remise en T°' },
  { href: '#/haccp/fryers',                label: 'Friteuses' },
  { href: '#/haccp/non-conformities',      label: 'Non-conf.' },
  { href: '#/haccp/allergens',             label: 'Allergènes' },
  { href: '#/haccp/plan',                  label: 'Plan HACCP' },
  { href: '#/haccp/recall',                label: 'Retrait/Rappel' },
  { href: '#/haccp/training',              label: 'Formation' },
  { href: '#/haccp/pest-control',          label: 'Nuisibles' },
  { href: '#/haccp/maintenance',           label: 'Maintenance' },
  { href: '#/haccp/waste',                 label: 'Déchets' },
  { href: '#/haccp/corrective-actions',    label: 'Actions correctives' },
  { href: '#/haccp/allergens-plan',        label: 'Plan allergènes' },
  { href: '#/haccp/water',                 label: 'Eau' },
  { href: '#/haccp/pms-audit',             label: 'Audits PMS' },
  { href: '#/haccp/tiac',                  label: 'TIAC' },
  { href: '#/haccp/witness-meals',         label: 'Plats témoins' },
  { href: '#/haccp/staff-health',           label: 'Santé personnel' },
  { href: '#/pms/export',                  label: 'Export PMS', extra: ' haccp-subnav__link--export' },
];

const HACCP_SUBNAV_FULL = {
  toString() {
    const current = location.hash.replace('#', '') || '/';
    const links = HACCP_SUBNAV_ITEMS.map(item => {
      const route = item.href.replace('#', '');
      const isActive = route === current;
      return `<a href="${item.href}" class="haccp-subnav__link${item.extra || ''}${isActive ? ' active' : ''}">${item.label}</a>`;
    }).join('');
    return `<div class="haccp-subnav">${links}</div>`;
  }
};

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
        ${HACCP_SUBNAV_FULL}

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
                <button class="btn btn-primary haccp-record-btn" data-zone-id="${zone.id}" data-zone-name="${escapeHtml(zone.name)}" data-min="${zone.min_temp}" data-max="${zone.max_temp}" aria-label="Relever la température de ${escapeHtml(zone.name)}">
                  <i data-lucide="thermometer" style="width:18px;height:18px" aria-hidden="true"></i> Relever
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

        <div class="haccp-cleaning-list" role="list" aria-label="Tâches de nettoyage du jour">
          ${cleaningData.tasks.map(task => `
            <div class="haccp-cleaning-item ${task.done_today ? 'haccp-cleaning-item--done' : ''}" role="listitem">
              <button class="haccp-cleaning-check ${task.done_today ? 'checked' : ''}"
                      data-task-id="${task.id}" ${task.done_today ? 'disabled' : ''}
                      aria-label="${task.done_today ? 'Tâche effectuée' : 'Marquer comme effectuée'} : ${escapeHtml(task.name)}"
                      aria-pressed="${task.done_today ? 'true' : 'false'}">
                <span aria-hidden="true">${task.done_today ? '✓' : ''}</span>
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
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'temp-modal-title');
  overlay.innerHTML = `
    <div class="modal">
      <h2 id="temp-modal-title"><i data-lucide="thermometer" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Relevé — ${escapeHtml(zoneName)}</h2>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-4)">Plage normale : ${minTemp}°C à ${maxTemp}°C</p>
      <div class="form-group">
        <label for="modal-temp">Température (°C)</label>
        <input type="number" step="0.1" class="form-control haccp-temp-input" id="modal-temp"
               placeholder="ex: 3.5" inputmode="decimal" autofocus required
               aria-required="true"
               style="font-size:var(--text-2xl);text-align:center;font-family:var(--font-mono)">
      </div>
      <div class="form-group">
        <label for="modal-notes">Notes (optionnel)</label>
        <input type="text" class="form-control" id="modal-notes" placeholder="ex: porte restée ouverte">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="modal-cancel" aria-label="Annuler et fermer">Annuler</button>
        <button class="btn btn-primary" id="modal-save" style="min-width:140px">
          <i data-lucide="check" style="width:18px;height:18px" aria-hidden="true"></i> Enregistrer
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  // Focus trap — restores focus to trigger on close
  const releaseFocus = (typeof trapFocus === 'function') ? trapFocus(overlay) : () => {};
  const closeOverlay = () => {
    try { releaseFocus(); } catch {}
    overlay.remove();
  };

  const tempInput = document.getElementById('modal-temp');
  tempInput.focus();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });
  document.getElementById('modal-cancel').addEventListener('click', closeOverlay);
  document.getElementById('modal-save').addEventListener('click', async () => {
    const temperature = parseFloat(tempInput.value);
    if (isNaN(temperature)) {
      tempInput.classList.add('form-control--error');
      tempInput.setAttribute('aria-invalid', 'true');
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
      closeOverlay();
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

  // ESC to close
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape' && document.body.contains(overlay)) {
      closeOverlay();
      document.removeEventListener('keydown', escHandler);
    }
  });
}
