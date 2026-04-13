// ═══════════════════════════════════════════
// HACCP Plan formalisé — Route #/haccp/plan
// ═══════════════════════════════════════════

const HACCP_PLAN_STEPS = ['Réception', 'Stockage', 'Préparation', 'Cuisson', 'Refroidissement', 'Remise en T°', 'Service', 'Distribution'];

function riskScore(severity, probability) { return severity * probability; }
function riskColor(score) {
  if (score > 15) return 'var(--color-danger, #e53e3e)';
  if (score >= 6) return 'var(--color-warning, #d69e2e)';
  return 'var(--color-success, #38a169)';
}
function riskLabel(score) {
  if (score > 15) return 'ÉLEVÉ';
  if (score >= 6) return 'MODÉRÉ';
  return 'FAIBLE';
}
function hazardTypeBadge(type) {
  const map = { B: ['Biologique', '#3182ce'], C: ['Chimique', '#dd6b20'], P: ['Physique', '#805ad5'] };
  const [label, color] = map[type] || ['?', '#718096'];
  return `<span style="background:${color};color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600">${label}</span>`;
}
function dtResultBadge(result) {
  if (!result) return '<span style="color:var(--text-secondary);font-size:12px">—</span>';
  const map = {
    CCP:  ['CCP',  '#e53e3e'],
    PRPO: ['PRPO', '#d69e2e'],
    PRP:  ['PRP',  '#38a169'],
  };
  const [label, color] = map[result] || [result, '#718096'];
  return `<span style="background:${color};color:#fff;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:700">${label}</span>`;
}

let _haccpPlanTab = 'hazards';
let _haccpPlanData = null;

async function renderHACCPPlan() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    _haccpPlanData = await loadHACCPPlanData();
    renderHACCPPlanShell();
    activateHACCPPlanTab(_haccpPlanTab);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

async function loadHACCPPlanData() {
  const [hazardsRes, ccpsRes] = await Promise.all([
    API.getHACCPHazards(),
    API.getHACCPCCPs(),
  ]);
  return {
    hazards: hazardsRes.items || [],
    ccps: ccpsRes.items || [],
  };
}

function renderHACCPPlanShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="haccp-page">
      <div class="page-header">
        <h1><i data-lucide="shield-check" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Plan HACCP formalisé</h1>
        <button class="btn btn-primary" id="haccp-plan-add-btn" style="display:none">
          <i data-lucide="plus" style="width:16px;height:16px"></i> Ajouter
        </button>
      </div>

      ${HACCP_SUBNAV_FULL}

      <!-- Onglets -->
      <div style="display:flex;gap:4px;margin-bottom:var(--space-4);border-bottom:2px solid var(--border-light)">
        <button class="haccp-plan-tab" data-tab="hazards"  style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-2px">Analyse des dangers</button>
        <button class="haccp-plan-tab" data-tab="decision" style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-2px">Arbre de décision</button>
        <button class="haccp-plan-tab" data-tab="ccps"     style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-2px">Tableau de maîtrise</button>
        <button class="haccp-plan-tab" data-tab="summary"  style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600;color:var(--text-secondary);border-bottom:2px solid transparent;margin-bottom:-2px">Synthèse</button>
      </div>

      <div id="haccp-plan-content"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  document.querySelectorAll('.haccp-plan-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _haccpPlanTab = btn.dataset.tab;
      activateHACCPPlanTab(_haccpPlanTab);
    });
  });
}

function activateHACCPPlanTab(tab) {
  // Update tab styles
  document.querySelectorAll('.haccp-plan-tab').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.style.color = active ? 'var(--color-accent, #E8722A)' : 'var(--text-secondary)';
    btn.style.borderBottomColor = active ? 'var(--color-accent, #E8722A)' : 'transparent';
  });

  const addBtn = document.getElementById('haccp-plan-add-btn');
  if (addBtn) addBtn.style.display = (tab === 'hazards') ? '' : 'none';

  const content = document.getElementById('haccp-plan-content');
  if (!content) return;

  switch (tab) {
    case 'hazards':  renderHazardsTab(content); break;
    case 'decision': renderDecisionTab(content); break;
    case 'ccps':     renderCCPsTab(content); break;
    case 'summary':  renderSummaryTab(content); break;
  }
}

// ─── Tab 1 : Analyse des dangers ───────────────────────────────────────────

function renderHazardsTab(container) {
  const { hazards } = _haccpPlanData;

  const addBtn = document.getElementById('haccp-plan-add-btn');
  if (addBtn) {
    addBtn.onclick = () => openHazardModal(null);
  }

  if (!hazards.length) {
    container.innerHTML = `<div class="empty-state"><i data-lucide="shield-off" style="width:40px;height:40px;margin-bottom:12px;opacity:.4"></i><p>Aucun danger identifié.</p><button class="btn btn-primary" onclick="openHazardModal(null)">Ajouter un danger</button></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Group by step
  const byStep = {};
  hazards.forEach(h => {
    if (!byStep[h.step_name]) byStep[h.step_name] = [];
    byStep[h.step_name].push(h);
  });

  container.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:var(--bg-secondary);text-align:left">
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light)">Étape</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light)">Type</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light);min-width:200px">Danger identifié</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light);text-align:center">G</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light);text-align:center">P</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light);text-align:center">Score</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light);text-align:center">Arbre</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light);min-width:200px">Mesures préventives</th>
            <th style="padding:10px 12px;border-bottom:2px solid var(--border-light)"></th>
          </tr>
        </thead>
        <tbody id="haccp-hazards-tbody">
          ${hazards.map((h, i) => {
            const score = riskScore(h.severity, h.probability);
            const prevStep = i > 0 ? hazards[i - 1].step_name : null;
            const isNewGroup = h.step_name !== prevStep;
            return `
              ${isNewGroup ? `<tr><td colspan="9" style="padding:8px 12px;background:var(--bg-tertiary,var(--bg-secondary));font-weight:700;font-size:12px;letter-spacing:.05em;color:var(--text-secondary);border-top:2px solid var(--border-light)">${escapeHtml(h.step_name)}</td></tr>` : ''}
              <tr class="haccp-hazard-row" data-id="${h.id}" style="border-bottom:1px solid var(--border-light)">
                <td style="padding:10px 12px;color:var(--text-secondary);font-size:12px"></td>
                <td style="padding:10px 12px">${hazardTypeBadge(h.hazard_type)}</td>
                <td style="padding:10px 12px">${escapeHtml(h.hazard_description)}</td>
                <td style="padding:10px 12px;text-align:center;font-weight:600">${h.severity}</td>
                <td style="padding:10px 12px;text-align:center;font-weight:600">${h.probability}</td>
                <td style="padding:10px 12px;text-align:center">
                  <span style="background:${riskColor(score)};color:#fff;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:700">${score} — ${riskLabel(score)}</span>
                </td>
                <td style="padding:10px 12px;text-align:center">${dtResultBadge(h.dt_result)}</td>
                <td style="padding:10px 12px;font-size:13px;color:var(--text-secondary)">${escapeHtml(h.preventive_measures || '—')}</td>
                <td style="padding:10px 12px;white-space:nowrap">
                  <button class="btn btn-ghost btn-sm btn-edit-hazard" data-id="${h.id}" title="Modifier">✏️</button>
                  <button class="btn btn-ghost btn-sm btn-delete-hazard" data-id="${h.id}" title="Supprimer">🗑️</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p style="margin-top:12px;font-size:12px;color:var(--text-secondary)">G = Gravité (1–5) &nbsp;·&nbsp; P = Probabilité (1–5) &nbsp;·&nbsp; Score = G × P &nbsp;·&nbsp; Vert &lt;6 / Orange 6–15 / Rouge &gt;15</p>
  `;

  container.querySelectorAll('.btn-edit-hazard').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = _haccpPlanData.hazards.find(x => x.id === Number(btn.dataset.id));
      if (h) openHazardModal(h);
    });
  });

  container.querySelectorAll('.btn-delete-hazard').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce danger ?')) return;
      try {
        await API.deleteHACCPHazard(Number(btn.dataset.id));
        _haccpPlanData = await loadHACCPPlanData();
        renderHazardsTab(container);
        showToast('Danger supprimé', 'success');
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    });
  });

  if (window.lucide) lucide.createIcons();
}

function openHazardModal(hazard) {
  const isEdit = !!hazard;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:560px;width:100%">
      <div class="modal-header">
        <h3>${isEdit ? 'Modifier le danger' : 'Ajouter un danger'}</h3>
        <button class="modal-close btn btn-ghost btn-sm">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="form-label">Étape *</label>
          <select class="form-control" id="hz-step">
            ${HACCP_PLAN_STEPS.map(s => `<option value="${s}" ${hazard && hazard.step_name === s ? 'selected' : ''}>${s}</option>`).join('')}
            <option value="__custom__">Autre…</option>
          </select>
          <input type="text" class="form-control" id="hz-step-custom" placeholder="Étape personnalisée" style="margin-top:6px;display:none" value="${hazard && !HACCP_PLAN_STEPS.includes(hazard.step_name) ? escapeHtml(hazard.step_name) : ''}">
        </div>
        <div>
          <label class="form-label">Type de danger *</label>
          <select class="form-control" id="hz-type">
            <option value="B" ${!hazard || hazard.hazard_type === 'B' ? 'selected' : ''}>B — Biologique</option>
            <option value="C" ${hazard && hazard.hazard_type === 'C' ? 'selected' : ''}>C — Chimique</option>
            <option value="P" ${hazard && hazard.hazard_type === 'P' ? 'selected' : ''}>P — Physique</option>
          </select>
        </div>
        <div>
          <label class="form-label">Description du danger *</label>
          <textarea class="form-control" id="hz-desc" rows="2" placeholder="Ex: Contamination par Salmonella spp.">${hazard ? escapeHtml(hazard.hazard_description) : ''}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">Gravité (1–5)</label>
            <input type="number" class="form-control" id="hz-severity" min="1" max="5" value="${hazard ? hazard.severity : 3}">
          </div>
          <div>
            <label class="form-label">Probabilité (1–5)</label>
            <input type="number" class="form-control" id="hz-probability" min="1" max="5" value="${hazard ? hazard.probability : 3}">
          </div>
        </div>
        <div>
          <label class="form-label">Mesures préventives</label>
          <textarea class="form-control" id="hz-measures" rows="3" placeholder="Ex: Contrôle température à réception, audit fournisseur…">${hazard ? escapeHtml(hazard.preventive_measures || '') : ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-modal-cancel">Annuler</button>
        <button class="btn btn-primary btn-modal-save">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const stepSel = modal.querySelector('#hz-step');
  const stepCustom = modal.querySelector('#hz-step-custom');

  // Show custom input if needed
  if (hazard && !HACCP_PLAN_STEPS.includes(hazard.step_name)) {
    stepSel.value = '__custom__';
    stepCustom.style.display = '';
  }
  stepSel.addEventListener('change', () => {
    stepCustom.style.display = stepSel.value === '__custom__' ? '' : 'none';
  });

  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('.btn-modal-cancel').addEventListener('click', () => modal.remove());

  modal.querySelector('.btn-modal-save').addEventListener('click', async () => {
    const step = stepSel.value === '__custom__' ? stepCustom.value.trim() : stepSel.value;
    const desc = modal.querySelector('#hz-desc').value.trim();
    if (!step || !desc) { showToast('Étape et description requis', 'error'); return; }

    const data = {
      step_name: step,
      hazard_type: modal.querySelector('#hz-type').value,
      hazard_description: desc,
      severity: Number(modal.querySelector('#hz-severity').value),
      probability: Number(modal.querySelector('#hz-probability').value),
      preventive_measures: modal.querySelector('#hz-measures').value.trim(),
    };

    try {
      if (isEdit) {
        await API.updateHACCPHazard(hazard.id, data);
      } else {
        await API.createHACCPHazard(data);
      }
      modal.remove();
      _haccpPlanData = await loadHACCPPlanData();
      const content = document.getElementById('haccp-plan-content');
      if (content) renderHazardsTab(content);
      showToast(isEdit ? 'Danger mis à jour' : 'Danger ajouté', 'success');
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  });
}

// ─── Tab 2 : Arbre de décision ─────────────────────────────────────────────

async function renderDecisionTab(container) {
  const { hazards } = _haccpPlanData;

  if (!hazards.length) {
    container.innerHTML = `<div class="empty-state"><p>Ajoutez d'abord des dangers dans l'onglet "Analyse des dangers".</p></div>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  // Load all decision tree results
  const results = await Promise.all(hazards.map(h => API.getHACCPDecisionTree(h.id).catch(() => null)));
  const dtByHazard = {};
  hazards.forEach((h, i) => { dtByHazard[h.id] = results[i]; });

  container.innerHTML = `
    <div style="margin-bottom:16px;padding:12px 16px;background:var(--bg-secondary);border-radius:8px;font-size:13px;line-height:1.6">
      <strong>Arbre de décision Codex Alimentarius (CAC/RCP 1-1969) :</strong><br>
      <strong>Q1</strong> Des mesures préventives existent-elles ? &nbsp;·&nbsp;
      <strong>Q2</strong> L'étape est-elle conçue pour éliminer/réduire le danger ? &nbsp;·&nbsp;
      <strong>Q3</strong> Une contamination peut-elle survenir ? &nbsp;·&nbsp;
      <strong>Q4</strong> Une étape ultérieure élimine-t-elle le danger ?
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${hazards.map(h => {
        const dt = dtByHazard[h.id];
        const score = riskScore(h.severity, h.probability);
        return `
          <div class="card" style="border-left:4px solid ${riskColor(score)}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                  ${hazardTypeBadge(h.hazard_type)}
                  <strong style="font-size:14px">${escapeHtml(h.step_name)}</strong>
                  <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(h.hazard_description)}</span>
                </div>
                <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:8px">
                  ${['Q1','Q2','Q3','Q4'].map((q, qi) => {
                    const keys = ['q1_preventive_measure','q2_step_designed_eliminate','q3_contamination_possible','q4_subsequent_step_eliminate'];
                    const val = dt ? dt[keys[qi]] : null;
                    return `
                      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                        <span style="font-weight:600;color:var(--text-secondary)">${q}</span>
                        <select class="form-control dt-select" data-hazard="${h.id}" data-q="${qi+1}" style="padding:4px 8px;font-size:13px;width:80px">
                          <option value="" ${val === null ? 'selected' : ''}>—</option>
                          <option value="1" ${val === 1 ? 'selected' : ''}>Oui</option>
                          <option value="0" ${val === 0 ? 'selected' : ''}>Non</option>
                        </select>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:80px">
                <span style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">Résultat</span>
                <span class="dt-result-badge-${h.id}">${dtResultBadge(dt ? dt.result : null)}</span>
                <button class="btn btn-primary btn-sm dt-save-btn" data-hazard="${h.id}" style="font-size:12px;padding:4px 10px">Valider</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('.dt-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const hazardId = Number(btn.dataset.hazard);
      const card = btn.closest('.card');
      const selects = card.querySelectorAll('.dt-select');
      const vals = Array.from(selects).map(s => s.value);

      if (vals.some(v => v === '')) { showToast('Répondez à toutes les questions', 'error'); return; }

      const [q1, q2, q3, q4] = vals.map(v => v === '1');
      try {
        const result = await API.saveHACCPDecisionTree(hazardId, { q1, q2, q3, q4 });
        card.querySelector(`.dt-result-badge-${hazardId}`).innerHTML = dtResultBadge(result.result);
        // Refresh hazard list so tab 1 reflects changes
        _haccpPlanData = await loadHACCPPlanData();
        showToast(`Résultat : ${result.result}`, 'success');
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    });
  });
}

// ─── Tab 3 : Tableau de maîtrise (CCP) ────────────────────────────────────

function renderCCPsTab(container) {
  const { hazards, ccps } = _haccpPlanData;
  const ccpHazards = hazards.filter(h => h.is_ccp);

  if (!ccpHazards.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="shield-off" style="width:40px;height:40px;margin-bottom:12px;opacity:.4"></i>
        <p>Aucun CCP identifié. Utilisez l'arbre de décision pour qualifier vos dangers.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${ccpHazards.map((h, idx) => {
        const ccp = ccps.find(c => c.hazard_analysis_id === h.id);
        const num = ccp ? ccp.ccp_number : `CCP${idx + 1}`;
        return `
          <div class="card" style="border-left:4px solid var(--color-danger,#e53e3e)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="background:var(--color-danger,#e53e3e);color:#fff;border-radius:6px;padding:4px 12px;font-weight:700;font-size:14px">${escapeHtml(num)}</span>
                ${hazardTypeBadge(h.hazard_type)}
                <strong>${escapeHtml(h.step_name)}</strong>
                <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(h.hazard_description)}</span>
              </div>
              <button class="btn btn-primary btn-sm btn-save-ccp" data-hazard="${h.id}" data-ccp="${ccp ? ccp.id : ''}">
                <i data-lucide="save" style="width:14px;height:14px"></i> Enregistrer
              </button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <label class="form-label">Numéro CCP</label>
                <input type="text" class="form-control ccp-number" data-hazard="${h.id}" value="${escapeHtml(num)}" placeholder="Ex: CCP1">
              </div>
              <div>
                <label class="form-label">Responsable</label>
                <input type="text" class="form-control ccp-responsible" data-hazard="${h.id}" value="${escapeHtml(ccp ? ccp.responsible_person || '' : '')}" placeholder="Ex: Chef de cuisine">
              </div>
              <div style="grid-column:1/-1">
                <label class="form-label">Limites critiques</label>
                <input type="text" class="form-control ccp-limits" data-hazard="${h.id}" value="${escapeHtml(ccp ? ccp.critical_limits || '' : '')}" placeholder="Ex: Température à cœur ≥75°C pendant 2 min">
              </div>
              <div>
                <label class="form-label">Procédure de surveillance</label>
                <textarea class="form-control ccp-monitoring" data-hazard="${h.id}" rows="2" placeholder="Ex: Mesure thermomètre sonde à chaque cuisson">${escapeHtml(ccp ? ccp.monitoring_procedure || '' : '')}</textarea>
              </div>
              <div>
                <label class="form-label">Fréquence de surveillance</label>
                <input type="text" class="form-control ccp-frequency" data-hazard="${h.id}" value="${escapeHtml(ccp ? ccp.monitoring_frequency || '' : '')}" placeholder="Ex: À chaque cuisson (100% des lots)">
              </div>
              <div>
                <label class="form-label">Actions correctives</label>
                <textarea class="form-control ccp-corrective" data-hazard="${h.id}" rows="2" placeholder="Ex: Poursuivre la cuisson, rejeter le lot si T° non atteinte">${escapeHtml(ccp ? ccp.corrective_actions || '' : '')}</textarea>
              </div>
              <div>
                <label class="form-label">Procédure de vérification</label>
                <textarea class="form-control ccp-verification" data-hazard="${h.id}" rows="2" placeholder="Ex: Calibration mensuelle du thermomètre, audit trimestriel">${escapeHtml(ccp ? ccp.verification_procedure || '' : '')}</textarea>
              </div>
              <div style="grid-column:1/-1">
                <label class="form-label">Enregistrements</label>
                <input type="text" class="form-control ccp-records" data-hazard="${h.id}" value="${escapeHtml(ccp ? ccp.records_kept || '' : '')}" placeholder="Ex: Fiche cuisson journalière, registre thermomètre">
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('.btn-save-ccp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const hazardId = Number(btn.dataset.hazard);
      const card = btn.closest('.card');
      const data = {
        hazard_analysis_id: hazardId,
        ccp_number: card.querySelector('.ccp-number').value.trim() || `CCP${hazardId}`,
        critical_limits: card.querySelector('.ccp-limits').value.trim(),
        monitoring_procedure: card.querySelector('.ccp-monitoring').value.trim(),
        monitoring_frequency: card.querySelector('.ccp-frequency').value.trim(),
        corrective_actions: card.querySelector('.ccp-corrective').value.trim(),
        verification_procedure: card.querySelector('.ccp-verification').value.trim(),
        records_kept: card.querySelector('.ccp-records').value.trim(),
        responsible_person: card.querySelector('.ccp-responsible').value.trim(),
      };
      try {
        await API.saveHACCPCCP(data);
        _haccpPlanData = await loadHACCPPlanData();
        showToast('CCP enregistré', 'success');
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    });
  });

  if (window.lucide) lucide.createIcons();
}

// ─── Tab 4 : Synthèse ─────────────────────────────────────────────────────

async function renderSummaryTab(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  try {
    const summary = await API.getHACCPPlanSummary();
    const { hazards, ccps, stats } = summary;

    container.innerHTML = `
      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:var(--color-accent)">${stats.total_hazards}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Dangers identifiés</div>
        </div>
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:var(--color-danger,#e53e3e)">${stats.total_ccp}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">CCP</div>
        </div>
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#3182ce">${stats.biological}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Biologiques</div>
        </div>
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#dd6b20">${stats.chemical}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Chimiques</div>
        </div>
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#805ad5">${stats.physical}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Physiques</div>
        </div>
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:var(--color-danger,#e53e3e)">${stats.high_risk}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Risque élevé</div>
        </div>
      </div>

      <!-- Tableau récapitulatif -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0;font-size:16px">Tableau récapitulatif des mesures de maîtrise</h3>
        <button class="btn btn-secondary btn-sm" onclick="window.print()" title="Imprimer ce tableau">🖨️ Imprimer</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px" id="haccp-summary-table">
          <thead>
            <tr style="background:var(--bg-secondary)">
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:left">Étape</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light)">Type</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:left">Danger</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:center">G</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:center">P</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:center">Score</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:center">Qualification</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:left">Limites critiques</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:left">Surveillance</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:left">Actions correctives</th>
              <th style="padding:10px 12px;border:1px solid var(--border-light);text-align:left">Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${hazards.map(h => {
              const score = riskScore(h.severity, h.probability);
              const ccp = ccps.find(c => c.hazard_analysis_id === h.id);
              const dtResult = summary.dtResults.find(d => d.hazard_analysis_id === h.id);
              return `
                <tr style="border-bottom:1px solid var(--border-light);${h.is_ccp ? 'background:rgba(229,62,62,.04)' : ''}">
                  <td style="padding:8px 12px;border:1px solid var(--border-light)">${escapeHtml(h.step_name)}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);text-align:center">${hazardTypeBadge(h.hazard_type)}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light)">${escapeHtml(h.hazard_description)}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);text-align:center;font-weight:600">${h.severity}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);text-align:center;font-weight:600">${h.probability}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);text-align:center">
                    <span style="background:${riskColor(score)};color:#fff;border-radius:3px;padding:1px 6px;font-size:11px;font-weight:700">${score}</span>
                  </td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);text-align:center">
                    ${dtResultBadge(dtResult ? dtResult.result : (h.is_ccp ? 'CCP' : null))}
                  </td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);font-size:12px">${escapeHtml(ccp ? ccp.critical_limits || '—' : '—')}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);font-size:12px">${escapeHtml(ccp ? ccp.monitoring_procedure || '—' : '—')}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);font-size:12px">${escapeHtml(ccp ? ccp.corrective_actions || '—' : '—')}</td>
                  <td style="padding:8px 12px;border:1px solid var(--border-light);font-size:12px">${escapeHtml(ccp ? ccp.responsible_person || '—' : '—')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p style="margin-top:12px;font-size:12px;color:var(--text-secondary)">Document généré par RestoSuite — Conforme Codex Alimentarius CAC/RCP 1-1969 · ${new Date().toLocaleDateString('fr-FR')}</p>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(e.message)}</p></div>`;
  }
}
