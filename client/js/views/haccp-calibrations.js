// ═══════════════════════════════════════════
// HACCP Étalonnage des thermomètres — Route #/haccp/calibrations
// DDPP requirement: without calibration records, temperature logs
// have no legal probative value during an inspection.
// Tolérance typique : ±0,5°C pour le froid, ±1°C pour le chaud.
// ═══════════════════════════════════════════

function calibrationStatus(thermo) {
  if (!thermo.next_calibration_date) return { level: 'red', label: 'Jamais étalonné' };
  const today = new Date().toISOString().slice(0, 10);
  const next = thermo.next_calibration_date.slice(0, 10);
  if (next <= today) return { level: 'red', label: 'En retard' };
  const diffDays = Math.ceil((new Date(next) - new Date(today)) / (24 * 60 * 60 * 1000));
  if (diffDays <= 30) return { level: 'orange', label: `À prévoir (${diffDays}j)` };
  return { level: 'green', label: 'OK' };
}

async function renderHACCPCalibrations() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [thermosResp, alertsResp, calibrationsResp] = await Promise.all([
      API.getThermometers(),
      API.getThermometerAlerts(),
      API.getCalibrations({ limit: 50 }),
    ]);
    const thermometers = (thermosResp && thermosResp.items) ? thermosResp.items : (Array.isArray(thermosResp) ? thermosResp : []);
    const alerts = {
      overdue: (alertsResp && Array.isArray(alertsResp.overdue)) ? alertsResp.overdue : [],
      due_soon: (alertsResp && Array.isArray(alertsResp.due_soon)) ? alertsResp.due_soon : [],
    };
    const calibrations = (calibrationsResp && calibrationsResp.items) ? calibrationsResp.items : (Array.isArray(calibrationsResp) ? calibrationsResp : []);

    const alertBanner = (alerts.overdue.length > 0 || alerts.due_soon.length > 0) ? `
      <div style="background:rgba(217,48,37,0.12);border:1px solid rgba(217,48,37,0.45);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start;color:var(--text-primary)">
        <i data-lucide="alert-triangle" style="width:18px;height:18px;color:var(--color-danger);flex-shrink:0;margin-top:1px"></i>
        <div>
          <strong>Étalonnage requis</strong>
          ${alerts.overdue.length > 0 ? `<div class="text-sm">⚠️ ${alerts.overdue.length} thermomètre(s) en retard d'étalonnage</div>` : ''}
          ${alerts.due_soon.length > 0 ? `<div class="text-sm">🕒 ${alerts.due_soon.length} thermomètre(s) à étalonner dans les 30 jours</div>` : ''}
          <div class="text-sm text-secondary" style="margin-top:4px">Sans certificat d'étalonnage récent, les relevés de température perdent leur valeur probante lors d'un contrôle DDPP.</div>
        </div>
      </div>
    ` : '';

    app.innerHTML = `
      <div class="haccp-page">
        <nav aria-label="Breadcrumb" class="breadcrumb">
          <a href="#/haccp">HACCP</a>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">Étalonnage</span>
        </nav>
        <div class="page-header">
          <h1><i data-lucide="ruler" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Étalonnage des thermomètres</h1>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" id="btn-new-thermometer">
              <i data-lucide="plus" style="width:18px;height:18px"></i> Thermomètre
            </button>
            <button class="btn btn-primary" id="btn-new-calibration" ${thermometers.filter(t => t.is_active).length === 0 ? 'disabled' : ''}>
              <i data-lucide="check-circle" style="width:18px;height:18px"></i> Nouvel étalonnage
            </button>
          </div>
        </div>

        ${haccpBreadcrumb('plan')}

        ${alertBanner}

        <div style="background:rgba(59,158,222,0.12);border:1px solid rgba(59,158,222,0.45);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start;color:var(--text-primary)">
          <i data-lucide="info" style="width:18px;height:18px;color:var(--color-info);flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">
            Exigence DDPP : chaque thermomètre doit être étalonné <strong>au moins une fois par an</strong>
            contre un thermomètre de référence. Tolérance typique :
            <strong>±0,5°C pour le froid</strong>, <strong>±1°C pour le chaud</strong>.
          </span>
        </div>

        <div class="section-title">Thermomètres (${thermometers.length})</div>
        ${thermometers.length === 0 ? `
          <div class="empty-state">
            <p>Aucun thermomètre enregistré.</p>
            <button class="btn btn-primary" id="btn-new-thermometer-empty">Ajouter un thermomètre</button>
          </div>
        ` : `
          <div class="table-container" style="margin-bottom:24px">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>N° série</th>
                  <th>Emplacement</th>
                  <th>Type</th>
                  <th>Dernier étalonnage</th>
                  <th>Prochain étalonnage</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${thermometers.map(t => {
                  const st = calibrationStatus(t);
                  const dot = st.level === 'red' ? '🔴' : st.level === 'orange' ? '🟠' : '🟢';
                  const last = t.last_calibration_date ? new Date(t.last_calibration_date).toLocaleDateString('fr-FR') : '—';
                  const next = t.next_calibration_date ? new Date(t.next_calibration_date).toLocaleDateString('fr-FR') : '—';
                  return `
                    <tr style="${t.is_active ? '' : 'opacity:0.4'}">
                      <td style="font-weight:500">${escapeHtml(t.name)}</td>
                      <td class="mono text-sm">${escapeHtml(t.serial_number || '—')}</td>
                      <td>${escapeHtml(t.location || '—')}</td>
                      <td>${escapeHtml(t.type || '—')}</td>
                      <td class="mono text-sm">${last}</td>
                      <td class="mono text-sm">${next}</td>
                      <td>${dot} ${st.label}</td>
                      <td>
                        <button class="btn btn-secondary btn-sm" data-action="calibrate" data-id="${t.id}" data-name="${escapeHtml(t.name)}" data-location="${escapeHtml(t.location || '')}" ${t.is_active ? '' : 'disabled'}>Étalonner</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}

        <div class="section-title">Historique des étalonnages (${calibrations.length})</div>
        ${calibrations.length === 0 ? `
          <div class="empty-state"><p>Aucun étalonnage enregistré.</p></div>
        ` : `
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Thermomètre</th>
                  <th>T° réf.</th>
                  <th>T° mesurée</th>
                  <th>Écart</th>
                  <th>Tolérance</th>
                  <th>Conformité</th>
                  <th>Par</th>
                  <th>Certificat</th>
                </tr>
              </thead>
              <tbody>
                ${calibrations.map(c => {
                  const date = c.calibration_date ? new Date(c.calibration_date).toLocaleDateString('fr-FR') : '—';
                  const compliance = c.is_compliant
                    ? '<span class="badge badge--success">✓ Conforme</span>'
                    : '<span class="badge badge--danger">✗ Non conforme</span>';
                  return `
                    <tr>
                      <td class="mono text-sm">${date}</td>
                      <td>${escapeHtml(c.thermometer_name || c.thermometer_id)}</td>
                      <td class="mono">${c.reference_temperature}°C</td>
                      <td class="mono">${c.measured_temperature}°C</td>
                      <td class="mono" style="font-weight:500">${c.deviation != null ? (c.deviation > 0 ? '+' : '') + c.deviation.toFixed(2) + '°C' : '—'}</td>
                      <td class="mono text-sm">±${c.tolerance ?? 0.5}°C</td>
                      <td>${compliance}</td>
                      <td>${escapeHtml(c.calibrated_by || '—')}</td>
                      <td class="mono text-sm">${escapeHtml(c.certificate_reference || '—')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupCalibrationEvents(thermometers);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupCalibrationEvents(thermometers) {
  document.getElementById('btn-new-thermometer')?.addEventListener('click', showThermometerModal);
  document.getElementById('btn-new-thermometer-empty')?.addEventListener('click', showThermometerModal);
  document.getElementById('btn-new-calibration')?.addEventListener('click', () => showCalibrationModal(thermometers));
  document.querySelectorAll('[data-action="calibrate"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showCalibrationModal(thermometers, {
        id: Number(btn.dataset.id),
        name: btn.dataset.name,
        location: btn.dataset.location,
      });
    });
  });
}

function showThermometerModal() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:540px">
      <h2><i data-lucide="plus" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Nouveau thermomètre</h2>
      <div class="form-group">
        <label>Nom *</label>
        <input type="text" class="form-control" id="th-name" placeholder="ex: Sonde chambre froide A" autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>N° de série</label>
          <input type="text" class="form-control" id="th-serial" placeholder="SN-xxxx">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" id="th-type">
            <option value="digital">Digital</option>
            <option value="analogique">Analogique</option>
            <option value="infrarouge">Infrarouge</option>
            <option value="sonde">Sonde</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Emplacement</label>
        <input type="text" class="form-control" id="th-location" placeholder="ex: Chambre froide positive">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Dernier étalonnage</label>
          <input type="date" class="form-control" id="th-last" lang="fr">
        </div>
        <div class="form-group">
          <label>Prochain étalonnage</label>
          <input type="date" class="form-control" id="th-next" lang="fr">
        </div>
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="th-cancel">Annuler</button>
        <button class="btn btn-primary" id="th-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('th-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('th-save').addEventListener('click', async () => {
    const name = document.getElementById('th-name').value.trim();
    if (!name) {
      document.getElementById('th-name').classList.add('form-control--error');
      return;
    }
    try {
      await API.createThermometer({
        name,
        serial_number: document.getElementById('th-serial').value.trim() || null,
        location: document.getElementById('th-location').value.trim() || null,
        type: document.getElementById('th-type').value,
        last_calibration_date: document.getElementById('th-last').value || null,
        next_calibration_date: document.getElementById('th-next').value || null,
      });
      overlay.remove();
      showToast('Thermomètre ajouté ✓', 'success');
      renderHACCPCalibrations();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}

function showCalibrationModal(thermometers, preselected) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const account = typeof getAccount === 'function' ? getAccount() : null;
  const activeThermos = thermometers.filter(t => t.is_active);
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const selectedId = preselected ? preselected.id : (activeThermos[0] && activeThermos[0].id);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h2><i data-lucide="check-circle" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Nouvel étalonnage</h2>
      <p class="text-secondary text-sm" style="margin-bottom:16px">
        Mesurez la température d'un bain de glace fondante (0°C référence) ou d'eau bouillante (100°C référence),
        puis notez ce que votre thermomètre affiche.
      </p>
      <div class="form-group">
        <label>Thermomètre *</label>
        <select class="form-control" id="cal-thermo">
          ${activeThermos.map(t => `
            <option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>
              ${escapeHtml(t.name)}${t.location ? ' — ' + escapeHtml(t.location) : ''}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date d'étalonnage *</label>
          <input type="date" class="form-control" id="cal-date" value="${today}" lang="fr">
        </div>
        <div class="form-group">
          <label>Prochain étalonnage</label>
          <input type="date" class="form-control" id="cal-next" value="${nextYear}" lang="fr">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>T° référence (°C) *</label>
          <input type="number" step="0.1" class="form-control" id="cal-ref" value="0" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>T° mesurée (°C) *</label>
          <input type="number" step="0.1" class="form-control" id="cal-meas" placeholder="ex: 0.3" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Tolérance (±°C)</label>
          <input type="number" step="0.1" min="0" class="form-control" id="cal-tol" value="0.5" inputmode="decimal">
        </div>
      </div>
      <div id="cal-preview" class="text-sm" style="padding:8px 12px;background:var(--surface-alt,#f5f5f5);border-radius:6px;margin-bottom:12px">
        Écart : <strong id="cal-dev">—</strong> — <span id="cal-compliance">—</span>
      </div>
      <div class="form-group" id="cal-correction-wrap" style="display:none">
        <label>Action corrective *</label>
        <textarea class="form-control" id="cal-correction" rows="2" placeholder="ex: Sonde retirée, envoyée en réparation"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Étalonné par</label>
          <input type="text" class="form-control" id="cal-by" value="${account ? escapeHtml(account.name || '') : ''}">
        </div>
        <div class="form-group">
          <label>Réf. certificat</label>
          <input type="text" class="form-control" id="cal-cert" placeholder="ex: COFRAC-2026-001">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="cal-notes">
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="cal-cancel">Annuler</button>
        <button class="btn btn-primary" id="cal-save">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  function refreshPreview() {
    const ref = parseFloat(document.getElementById('cal-ref').value);
    const meas = parseFloat(document.getElementById('cal-meas').value);
    const tol = parseFloat(document.getElementById('cal-tol').value);
    if (Number.isNaN(ref) || Number.isNaN(meas)) {
      document.getElementById('cal-dev').textContent = '—';
      document.getElementById('cal-compliance').textContent = '—';
      document.getElementById('cal-correction-wrap').style.display = 'none';
      return;
    }
    const dev = Math.round((meas - ref) * 100) / 100;
    const devStr = (dev > 0 ? '+' : '') + dev.toFixed(2) + '°C';
    document.getElementById('cal-dev').textContent = devStr;
    const compliant = !Number.isNaN(tol) && Math.abs(dev) <= tol;
    document.getElementById('cal-compliance').innerHTML = compliant
      ? '<span style="color:var(--color-success)">✓ Conforme</span>'
      : '<span style="color:var(--color-danger)">✗ Non conforme — action corrective requise</span>';
    document.getElementById('cal-correction-wrap').style.display = compliant ? 'none' : 'block';
  }
  ['cal-ref', 'cal-meas', 'cal-tol'].forEach(id => {
    document.getElementById(id).addEventListener('input', refreshPreview);
  });
  refreshPreview();

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cal-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('cal-save').addEventListener('click', async () => {
    const thermometer_id = document.getElementById('cal-thermo').value;
    const calibration_date = document.getElementById('cal-date').value;
    const reference_temperature = parseFloat(document.getElementById('cal-ref').value);
    const measured_temperature = parseFloat(document.getElementById('cal-meas').value);
    const tolerance = parseFloat(document.getElementById('cal-tol').value);
    if (!thermometer_id) { showToast('Sélectionnez un thermomètre', 'error'); return; }
    if (!calibration_date) { showToast('Date d\'étalonnage requise', 'error'); return; }
    if (Number.isNaN(reference_temperature) || Number.isNaN(measured_temperature)) {
      showToast('Températures invalides', 'error'); return;
    }
    const dev = measured_temperature - reference_temperature;
    const compliant = !Number.isNaN(tolerance) && Math.abs(dev) <= tolerance;
    let corrective_action = null;
    if (!compliant) {
      corrective_action = document.getElementById('cal-correction').value.trim();
      if (!corrective_action) {
        showToast('Action corrective requise (non conforme)', 'error');
        return;
      }
    }
    try {
      await API.createCalibration({
        thermometer_id,
        calibration_date,
        next_calibration_date: document.getElementById('cal-next').value || null,
        reference_temperature,
        measured_temperature,
        tolerance: Number.isNaN(tolerance) ? 0.5 : tolerance,
        corrective_action,
        calibrated_by: document.getElementById('cal-by').value.trim() || null,
        certificate_reference: document.getElementById('cal-cert').value.trim() || null,
        notes: document.getElementById('cal-notes').value.trim() || null,
      });
      overlay.remove();
      showToast(compliant ? 'Étalonnage enregistré ✓ Conforme' : 'Étalonnage enregistré — non conforme', compliant ? 'success' : 'error');
      renderHACCPCalibrations();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
