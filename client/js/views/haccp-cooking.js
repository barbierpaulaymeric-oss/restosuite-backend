// ═══════════════════════════════════════════
// HACCP Registre de cuisson (CCP2) — Route #/haccp/cooking
// Réglementation : CE 852/2004 — preuve de maîtrise de la cuisson
// Seuils : 63°C min (plats), 70°C (volailles), 75°C (remise en T°)
// ═══════════════════════════════════════════

const COOKING_PRODUCT_PRESETS = [
  { label: 'Viande rouge / poisson',    target: 63 },
  { label: 'Porc / agneau',             target: 65 },
  { label: 'Volaille',                  target: 70 },
  { label: 'Viande hachée',             target: 70 },
  { label: 'Produit remis en T° / plat témoin réchauffé', target: 75 },
  { label: 'Œufs / plats à base d\'œuf', target: 65 },
];

async function renderHACCPCooking() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [recordsRes, stats] = await Promise.all([
      API.getCookingRecords({ limit: 100 }),
      API.getCookingStats(),
    ]);
    const items = recordsRes.items || [];

    const complianceRateText = stats.compliance_rate == null
      ? '—'
      : `${stats.compliance_rate}%`;
    const complianceColor = stats.compliance_rate == null
      ? '#666'
      : stats.compliance_rate >= 98 ? '#2D8B55'
      : stats.compliance_rate >= 90 ? '#E8722A'
      : '#D93025';

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="flame" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Registre de cuisson (CCP2)</h1>
          <button class="btn btn-primary btn-large" id="btn-new-cooking">
            <i data-lucide="plus" style="width:20px;height:20px"></i> Nouvelle cuisson
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">
            CCP2 — Cuisson : mesure à cœur avec sonde étalonnée. Seuils :
            <strong>63°C</strong> (viande rouge/poisson),
            <strong>70°C</strong> (volailles, haché),
            <strong>75°C</strong> (remise en température).
            En cas de non-conformité, prolonger la cuisson ou jeter, et renseigner l'action corrective.
          </span>
        </div>

        <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
          <div class="card" style="padding:14px;text-align:center">
            <div class="text-secondary text-sm">Total cuissons</div>
            <div style="font-size:28px;font-weight:600;margin-top:4px">${stats.total}</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div class="text-secondary text-sm">Taux de conformité</div>
            <div style="font-size:28px;font-weight:600;color:${complianceColor};margin-top:4px">${complianceRateText}</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div class="text-secondary text-sm">Conformes</div>
            <div style="font-size:28px;font-weight:600;color:#2D8B55;margin-top:4px">${stats.compliant}</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div class="text-secondary text-sm">Non conformes</div>
            <div style="font-size:28px;font-weight:600;color:${stats.non_compliant > 0 ? '#D93025' : '#666'};margin-top:4px">${stats.non_compliant}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Produit</th>
                <th>Lot</th>
                <th>T° cible</th>
                <th>T° mesurée</th>
                <th>Conformité</th>
                <th>Opérateur</th>
                <th>Action corrective</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${renderCookingRows(items)}</tbody>
          </table>
        </div>
        ${items.length === 0 ? '<div class="empty-state"><p>Aucun enregistrement de cuisson</p></div>' : ''}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    setupCookingEvents();
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderCookingRows(items) {
  return items.map(item => {
    const date = new Date(item.cooking_date).toLocaleDateString('fr-FR');
    const isCompliant = item.is_compliant === 1;
    const complianceHtml = isCompliant
      ? '<span class="badge badge--success">✓ Conforme</span>'
      : '<span class="badge badge--danger">✗ Non conforme</span>';
    const rowStyle = isCompliant ? '' : 'background:#FFF0F0';
    return `
      <tr style="${rowStyle}">
        <td class="mono text-sm">${date}</td>
        <td style="font-weight:500">${escapeHtml(item.product_name)}</td>
        <td class="mono text-sm">${escapeHtml(item.batch_number || '—')}</td>
        <td class="mono">${item.target_temperature.toFixed(1)}°C</td>
        <td class="mono" style="font-weight:600;color:${isCompliant ? '#2D8B55' : '#D93025'}">${item.measured_temperature.toFixed(1)}°C</td>
        <td>${complianceHtml}</td>
        <td>${escapeHtml(item.operator || '—')}</td>
        <td class="text-sm">${escapeHtml(item.corrective_action || (isCompliant ? '—' : '⚠ à renseigner'))}</td>
        <td>
          <button class="btn btn-ghost btn-sm" data-id="${item.id}" data-action="edit-cooking" title="Modifier">
            <i data-lucide="pencil" style="width:14px;height:14px"></i>
          </button>
          <button class="btn btn-ghost btn-sm" data-id="${item.id}" data-action="delete-cooking" title="Supprimer">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function setupCookingEvents() {
  document.getElementById('btn-new-cooking')?.addEventListener('click', () => showCookingModal());
  document.querySelectorAll('[data-action="edit-cooking"]').forEach(btn => {
    btn.addEventListener('click', () => showCookingModal(Number(btn.dataset.id)));
  });
  document.querySelectorAll('[data-action="delete-cooking"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cet enregistrement de cuisson ?')) return;
      try {
        await API.deleteCookingRecord(Number(btn.dataset.id));
        showToast('Enregistrement supprimé ✓', 'success');
        renderHACCPCooking();
      } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
    });
  });
}

async function showCookingModal(editId = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  let existingRecord = null;
  if (editId) {
    try {
      const { items } = await API.getCookingRecords({ limit: 500 });
      existingRecord = items.find(r => r.id === editId) || null;
    } catch {}
  }

  const account = getAccount();
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const presetOptions = COOKING_PRODUCT_PRESETS.map((p, i) =>
    `<option value="${p.target}">${p.label} (≥${p.target}°C)</option>`
  ).join('');

  // Autocomplete: recipe names from the user's fiches techniques
  let recipeOptions = '';
  try {
    const recipes = await API.getRecipes();
    const plats = (recipes || []).filter(r => r.recipe_type === 'plat' || !r.recipe_type);
    recipeOptions = plats.map(r => `<option value="${escapeHtml(r.name)}">`).join('');
  } catch (_) { /* non-blocking: autocomplete is a convenience */ }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:580px">
      <h2>
        <i data-lucide="flame" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>
        ${editId ? 'Modifier cuisson' : 'Nouvelle cuisson'}
      </h2>
      <p class="text-secondary text-sm" style="margin-bottom:16px">
        Mesurer la température à cœur du produit. CCP2 — preuve de cuisson maîtrisée.
      </p>

      <div class="form-group">
        <label>Type de produit (préréglage T° cible)</label>
        <select class="form-control" id="cook-preset">
          <option value="">— Choisir un préréglage —</option>
          ${presetOptions}
        </select>
      </div>

      <div class="form-group">
        <label>Nom du produit *</label>
        <input type="text" class="form-control" id="cook-product"
               list="cook-product-list"
               placeholder="ex: Poulet rôti — tapez pour voir vos fiches" autofocus
               value="${existingRecord ? escapeHtml(existingRecord.product_name) : ''}">
        <datalist id="cook-product-list">${recipeOptions}</datalist>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Date de cuisson *</label>
          <input type="date" class="form-control" id="cook-date"
                 value="${existingRecord ? existingRecord.cooking_date : today}">
        </div>
        <div class="form-group">
          <label>N° de lot</label>
          <input type="text" class="form-control" id="cook-batch"
                 placeholder="optionnel"
                 value="${existingRecord && existingRecord.batch_number ? escapeHtml(existingRecord.batch_number) : ''}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Début cuisson</label>
          <input type="time" class="form-control" id="cook-start"
                 value="${existingRecord && existingRecord.cooking_time_start ? existingRecord.cooking_time_start : ''}">
        </div>
        <div class="form-group">
          <label>Fin cuisson</label>
          <input type="time" class="form-control" id="cook-end"
                 value="${existingRecord && existingRecord.cooking_time_end ? existingRecord.cooking_time_end : nowTime}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>T° cible (°C) *</label>
          <input type="number" step="0.1" class="form-control" id="cook-target"
                 inputmode="decimal"
                 value="${existingRecord ? existingRecord.target_temperature : '63'}">
        </div>
        <div class="form-group">
          <label>T° mesurée à cœur (°C) *</label>
          <input type="number" step="0.1" class="form-control" id="cook-measured"
                 inputmode="decimal" placeholder="ex: 72.5"
                 value="${existingRecord ? existingRecord.measured_temperature : ''}">
        </div>
      </div>

      <div id="cook-compliance-indicator" style="padding:10px 14px;border-radius:8px;margin-bottom:12px;display:none;font-weight:600"></div>

      <div class="form-group" id="cook-corrective-group" style="display:none">
        <label>Action corrective *</label>
        <select class="form-control" id="cook-corrective-select">
          <option value="">— Choisir —</option>
          <option value="Prolongation de la cuisson jusqu'à atteinte de la T° cible">Prolongation de la cuisson</option>
          <option value="Produit jeté (non-conformité critique)">Produit jeté</option>
          <option value="Remise en cuisson immédiate">Remise en cuisson immédiate</option>
          <option value="Autre">Autre (préciser dans les notes)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Opérateur</label>
        <input type="text" class="form-control" id="cook-operator"
               placeholder="Qui a effectué la cuisson"
               value="${existingRecord && existingRecord.operator ? escapeHtml(existingRecord.operator) : ''}">
      </div>

      <div class="form-group">
        <label>Notes</label>
        <input type="text" class="form-control" id="cook-notes"
               value="${existingRecord && existingRecord.notes ? escapeHtml(existingRecord.notes) : ''}">
      </div>

      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="cook-cancel">Annuler</button>
        <button class="btn btn-primary" id="cook-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> Enregistrer
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cook-cancel').addEventListener('click', () => overlay.remove());

  const targetInput = document.getElementById('cook-target');
  const measuredInput = document.getElementById('cook-measured');
  const indicator = document.getElementById('cook-compliance-indicator');
  const correctiveGroup = document.getElementById('cook-corrective-group');

  function updateComplianceIndicator() {
    const target = parseFloat(targetInput.value);
    const measured = parseFloat(measuredInput.value);
    if (isNaN(target) || isNaN(measured)) {
      indicator.style.display = 'none';
      correctiveGroup.style.display = 'none';
      return;
    }
    indicator.style.display = 'block';
    if (measured >= target) {
      indicator.textContent = `✓ Conforme — ${measured.toFixed(1)}°C ≥ ${target.toFixed(1)}°C`;
      indicator.style.background = '#E6F4EA';
      indicator.style.color = '#2D8B55';
      indicator.style.border = '1px solid #7EC394';
      correctiveGroup.style.display = 'none';
    } else {
      const delta = (target - measured).toFixed(1);
      indicator.textContent = `✗ Non conforme — ${measured.toFixed(1)}°C < ${target.toFixed(1)}°C (−${delta}°C)`;
      indicator.style.background = '#FDEAEA';
      indicator.style.color = '#D93025';
      indicator.style.border = '1px solid #F2A8A8';
      correctiveGroup.style.display = 'block';
    }
  }

  targetInput.addEventListener('input', updateComplianceIndicator);
  measuredInput.addEventListener('input', updateComplianceIndicator);

  document.getElementById('cook-preset').addEventListener('change', e => {
    if (e.target.value) {
      targetInput.value = e.target.value;
      updateComplianceIndicator();
    }
  });

  // Pre-fill corrective action if editing a non-compliant record
  if (existingRecord && existingRecord.is_compliant === 0 && existingRecord.corrective_action) {
    updateComplianceIndicator();
    const sel = document.getElementById('cook-corrective-select');
    const matching = Array.from(sel.options).find(o => o.value === existingRecord.corrective_action);
    if (matching) sel.value = existingRecord.corrective_action;
  }

  if (existingRecord) updateComplianceIndicator();

  document.getElementById('cook-save').addEventListener('click', async () => {
    const product_name = document.getElementById('cook-product').value.trim();
    const cooking_date = document.getElementById('cook-date').value;
    const target_temperature = parseFloat(targetInput.value);
    const measured_temperature = parseFloat(measuredInput.value);

    if (!product_name) {
      document.getElementById('cook-product').classList.add('form-control--error');
      return showToast('Nom du produit requis', 'error');
    }
    if (!cooking_date) {
      document.getElementById('cook-date').classList.add('form-control--error');
      return showToast('Date de cuisson requise', 'error');
    }
    if (isNaN(target_temperature)) {
      targetInput.classList.add('form-control--error');
      return showToast('T° cible requise', 'error');
    }
    if (isNaN(measured_temperature)) {
      measuredInput.classList.add('form-control--error');
      return showToast('T° mesurée requise', 'error');
    }

    const isCompliant = measured_temperature >= target_temperature;
    const corrective_action = document.getElementById('cook-corrective-select').value || null;
    if (!isCompliant && !corrective_action) {
      return showToast('Action corrective obligatoire pour non-conformité', 'error');
    }

    const payload = {
      product_name,
      cooking_date,
      batch_number: document.getElementById('cook-batch').value.trim() || null,
      cooking_time_start: document.getElementById('cook-start').value || null,
      cooking_time_end: document.getElementById('cook-end').value || null,
      target_temperature,
      measured_temperature,
      corrective_action: isCompliant ? null : corrective_action,
      operator: document.getElementById('cook-operator').value.trim() || (account ? account.name : null),
      notes: document.getElementById('cook-notes').value.trim() || null,
    };

    try {
      if (editId) {
        await API.updateCookingRecord(editId, payload);
        showToast('Enregistrement modifié ✓', 'success');
      } else {
        await API.createCookingRecord(payload);
        showToast(isCompliant ? 'Cuisson conforme enregistrée ✓' : 'Cuisson non conforme enregistrée — action corrective requise', isCompliant ? 'success' : 'warning');
      }
      overlay.remove();
      renderHACCPCooking();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
