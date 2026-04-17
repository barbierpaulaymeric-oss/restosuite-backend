// ═══════════════════════════════════════════
// Plats témoins (witness meals) — Route #/haccp/witness-meals
// Arrêté du 21 décembre 2009, Article 32
// ═══════════════════════════════════════════

const MEAL_TYPE_LABELS = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner:       'Déjeuner',
  diner:          'Dîner',
  gouter:         'Goûter',
  collation:      'Collation',
};

const SERVICE_TYPE_LABELS = {
  sur_place:  'Sur place',
  livraison:  'Livraison',
  emporter:   'À emporter',
  traiteur:   'Traiteur',
};

function fmtCountdown(keptUntil) {
  if (!keptUntil) return '—';
  const end = new Date(keptUntil.replace(' ', 'T') + 'Z');
  const now = new Date();
  const ms = end - now;
  if (ms <= 0) return 'Expiré';
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h} h restantes`;
  const d = Math.floor(h / 24);
  return `${d} j ${h % 24} h`;
}

function parseSamples(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

async function renderHACCPWitnessMeals() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [{ items }, active, overdue, alerts] = await Promise.all([
      API.request('/haccp/witness-meals'),
      API.request('/haccp/witness-meals/active'),
      API.request('/haccp/witness-meals/overdue'),
      API.request('/haccp/witness-meals/alerts'),
    ]);

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="package-2" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Plats témoins</h1>
          <button class="btn btn-primary" id="btn-new-wm">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau prélèvement
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        ${overdue.total > 0 ? `
        <div style="background:#fff0f0;border:1px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <i data-lucide="alert-triangle" style="width:18px;height:18px;color:#ef4444;flex-shrink:0"></i>
          <span class="text-sm"><strong>${overdue.total} prélèvement(s)</strong> au-delà de la période de conservation — à éliminer et tracer</span>
        </div>
        ` : ''}

        ${alerts.total > 0 ? `
        <div style="background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <i data-lucide="clock" style="width:18px;height:18px;color:#f59e0b;flex-shrink:0"></i>
          <span class="text-sm"><strong>${alerts.total} jour(s)</strong> sur les 7 derniers sans aucun plat témoin enregistré — vérifier si service concerné</span>
        </div>
        ` : ''}

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Total enregistrements</div>
            <div class="kpi-card__value">${items.length}</div>
          </div>
          <div class="kpi-card ${active.total > 0 ? 'kpi-card--success' : ''}">
            <div class="kpi-card__label">Actifs (en conservation)</div>
            <div class="kpi-card__value">${active.total}</div>
          </div>
          <div class="kpi-card ${overdue.total > 0 ? 'kpi-card--danger' : ''}">
            <div class="kpi-card__label">À éliminer</div>
            <div class="kpi-card__value">${overdue.total}</div>
          </div>
          <div class="kpi-card ${alerts.total > 0 ? 'kpi-card--warning' : ''}">
            <div class="kpi-card__label">Jours sans prélèvement (7j)</div>
            <div class="kpi-card__value">${alerts.total}</div>
          </div>
        </div>

        <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:0.85rem;color:#3730a3">
          <strong>Rappel réglementaire</strong> — Arrêté du 21/12/2009 (art. 32) : 100 g minimum par plat servi, conservation 0–3 °C pendant 5 jours minimum à compter de la dernière présentation au consommateur. Obligatoire pour collectivités (&gt;150 repas/jour), livraison et traiteur.
        </div>

        ${active.total > 0 ? `
        <h2 class="section-title" style="margin-top:0">Actuellement en conservation</h2>
        <div class="table-container" style="margin-bottom:24px">
          <table>
            <thead>
              <tr>
                <th>Date repas</th>
                <th>Service</th>
                <th>Plats</th>
                <th>T° stockage</th>
                <th>Emplacement</th>
                <th>Échéance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${active.items.map(item => {
                const samples = parseSamples(item.samples);
                const nb = samples.length;
                const temp = item.storage_temperature != null ? `${item.storage_temperature} °C` : '—';
                const tempBad = item.storage_temperature != null && (item.storage_temperature < 0 || item.storage_temperature > 3);
                return `
                  <tr>
                    <td class="mono text-sm">${new Date(item.meal_date).toLocaleDateString('fr-FR')}</td>
                    <td><span class="badge">${MEAL_TYPE_LABELS[item.meal_type] || item.meal_type}</span>${item.service_type ? ` <span class="text-secondary text-xs">${SERVICE_TYPE_LABELS[item.service_type] || item.service_type}</span>` : ''}</td>
                    <td>${nb} plat${nb > 1 ? 's' : ''}</td>
                    <td class="mono text-sm${tempBad ? ' text-danger' : ''}">${temp}</td>
                    <td class="text-sm">${escapeHtml(item.storage_location || '—')}</td>
                    <td class="mono text-sm">${fmtCountdown(item.kept_until)}</td>
                    <td style="white-space:nowrap">
                      <button class="btn btn-secondary btn-sm" data-action="edit-wm" data-id="${item.id}">
                        <i data-lucide="pencil" style="width:14px;height:14px"></i>
                      </button>
                      <button class="btn btn-ghost btn-sm" data-action="dispose-wm" data-id="${item.id}" title="Marquer comme éliminé">
                        <i data-lucide="trash" style="width:14px;height:14px"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <h2 class="section-title">Historique complet</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Plats</th>
                <th>T°</th>
                <th>Statut</th>
                <th>Opérateur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0
                ? '<tr><td colspan="7" class="text-secondary text-center" style="padding:24px">Aucun plat témoin enregistré</td></tr>'
                : items.map(item => {
                  const samples = parseSamples(item.samples);
                  const disposed = !!item.disposed_date;
                  const overdueRow = !disposed && new Date(item.kept_until.replace(' ', 'T') + 'Z') < new Date();
                  const statusBadge = disposed
                    ? '<span class="badge badge--success">Éliminé</span>'
                    : overdueRow
                      ? '<span class="badge badge--danger">À éliminer</span>'
                      : '<span class="badge badge--info">En conservation</span>';
                  return `
                    <tr${overdueRow ? ' style="background:#fff5f5"' : ''}>
                      <td class="mono text-sm">${new Date(item.meal_date).toLocaleDateString('fr-FR')}</td>
                      <td><span class="badge">${MEAL_TYPE_LABELS[item.meal_type] || item.meal_type}</span></td>
                      <td>${samples.length} plat${samples.length > 1 ? 's' : ''}</td>
                      <td class="mono text-sm">${item.storage_temperature != null ? item.storage_temperature + ' °C' : '—'}</td>
                      <td>${statusBadge}</td>
                      <td class="text-sm">${escapeHtml(item.operator || '—')}</td>
                      <td style="white-space:nowrap">
                        <button class="btn btn-secondary btn-sm" data-action="edit-wm" data-id="${item.id}" style="margin-right:4px">
                          <i data-lucide="pencil" style="width:14px;height:14px"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm" data-action="delete-wm" data-id="${item.id}" style="color:var(--color-danger)">
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
    setupWitnessMealsEvents(items, active.items);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupWitnessMealsEvents(items, activeItems) {
  const all = [...items];
  document.getElementById('btn-new-wm')?.addEventListener('click', () => showWitnessMealModal());
  document.querySelectorAll('[data-action="edit-wm"]').forEach(btn => {
    const id = Number(btn.dataset.id);
    const record = all.find(i => i.id === id) || activeItems.find(i => i.id === id);
    btn.addEventListener('click', () => showWitnessMealModal(record));
  });
  document.querySelectorAll('[data-action="dispose-wm"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const operator = prompt('Qui effectue l\'élimination ?') || '';
      if (!operator.trim()) return;
      try {
        await API.request('/haccp/witness-meals/' + btn.dataset.id, {
          method: 'PUT',
          body: {
            disposed_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            disposed_by: operator.trim(),
          },
        });
        showToast('Élimination tracée ✓', 'success');
        renderHACCPWitnessMeals();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
  document.querySelectorAll('[data-action="delete-wm"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cet enregistrement ?')) return;
      try {
        await API.request('/haccp/witness-meals/' + btn.dataset.id, { method: 'DELETE' });
        showToast('Enregistrement supprimé', 'success');
        renderHACCPWitnessMeals();
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    });
  });
}

function showWitnessMealModal(record = null) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  const isEdit = !!record;
  const samples = record ? (typeof record.samples === 'string' ? (() => { try { return JSON.parse(record.samples) || []; } catch { return []; } })() : (record.samples || [])) : [];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:720px">
      <h2>
        <i data-lucide="package-2" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>
        ${isEdit ? 'Modifier le prélèvement' : 'Nouveau plat témoin'}
      </h2>
      <div class="form-row">
        <div class="form-group">
          <label>Date du repas *</label>
          <input type="date" class="form-control" id="wm-date" value="${record?.meal_date || new Date().toISOString().slice(0,10)}">
        </div>
        <div class="form-group">
          <label>Type de repas *</label>
          <select class="form-control" id="wm-type">
            <option value="petit_dejeuner" ${record?.meal_type === 'petit_dejeuner' ? 'selected' : ''}>Petit-déjeuner</option>
            <option value="dejeuner"       ${(!record || record.meal_type === 'dejeuner') ? 'selected' : ''}>Déjeuner</option>
            <option value="diner"          ${record?.meal_type === 'diner' ? 'selected' : ''}>Dîner</option>
            <option value="gouter"         ${record?.meal_type === 'gouter' ? 'selected' : ''}>Goûter</option>
            <option value="collation"      ${record?.meal_type === 'collation' ? 'selected' : ''}>Collation</option>
          </select>
        </div>
        <div class="form-group">
          <label>Mode de service</label>
          <select class="form-control" id="wm-service">
            <option value="" ${!record?.service_type ? 'selected' : ''}>—</option>
            <option value="sur_place" ${record?.service_type === 'sur_place' ? 'selected' : ''}>Sur place</option>
            <option value="livraison" ${record?.service_type === 'livraison' ? 'selected' : ''}>Livraison</option>
            <option value="emporter"  ${record?.service_type === 'emporter'  ? 'selected' : ''}>À emporter</option>
            <option value="traiteur"  ${record?.service_type === 'traiteur'  ? 'selected' : ''}>Traiteur</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>T° stockage (°C) *</label>
          <input type="number" step="0.1" min="-2" max="10" class="form-control" id="wm-temp" value="${record?.storage_temperature ?? '2'}" placeholder="0 à 3 °C">
        </div>
        <div class="form-group">
          <label>Emplacement frigo</label>
          <input type="text" class="form-control" id="wm-loc" value="${escapeHtml(record?.storage_location || '')}" placeholder="ex: Chambre froide plats témoins">
        </div>
        <div class="form-group">
          <label>Opérateur</label>
          <input type="text" class="form-control" id="wm-op" value="${escapeHtml(record?.operator || '')}" placeholder="Prénom NOM">
        </div>
      </div>

      <div class="form-group">
        <label>Plats prélevés (≥ 100 g chacun)</label>
        <div id="wm-samples-list"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="wm-add-sample">
          <i data-lucide="plus" style="width:14px;height:14px"></i> Ajouter un plat
        </button>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="wm-notes" rows="2" placeholder="ex: Buffet de midi, 180 couverts">${escapeHtml(record?.notes || '')}</textarea>
      </div>

      ${isEdit ? `
      <div class="form-row">
        <div class="form-group">
          <label>Date d'élimination</label>
          <input type="datetime-local" class="form-control" id="wm-disposed-date" value="${record?.disposed_date ? record.disposed_date.replace(' ', 'T').slice(0,16) : ''}">
        </div>
        <div class="form-group">
          <label>Éliminé par</label>
          <input type="text" class="form-control" id="wm-disposed-by" value="${escapeHtml(record?.disposed_by || '')}" placeholder="Prénom NOM">
        </div>
      </div>
      ` : ''}

      <div style="background:#f0f4ff;border-radius:6px;padding:10px 14px;font-size:0.82rem;color:#3730a3;margin-bottom:16px">
        <strong>Rappel :</strong> 100 g minimum par plat, conservation 0–3 °C, 5 jours minimum. L'échéance est calculée automatiquement à partir de la date du repas.
      </div>
      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="wm-cancel">Annuler</button>
        <button class="btn btn-primary" id="wm-save">
          <i data-lucide="check" style="width:18px;height:18px"></i> ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('wm-cancel').addEventListener('click', () => overlay.remove());

  const samplesList = document.getElementById('wm-samples-list');
  const sampleState = samples.length ? samples.slice() : [{ name: '', quantity: '100g', location: '' }];
  function renderSamples() {
    samplesList.innerHTML = sampleState.map((s, i) => `
      <div class="form-row" style="margin-bottom:6px">
        <input type="text" class="form-control" data-i="${i}" data-k="name"     placeholder="Nom du plat"   value="${escapeHtml(s.name || '')}" style="flex:2">
        <input type="text" class="form-control" data-i="${i}" data-k="quantity" placeholder="Quantité (≥100g)" value="${escapeHtml(s.quantity || '')}" style="flex:1">
        <input type="text" class="form-control" data-i="${i}" data-k="location" placeholder="Emplacement"    value="${escapeHtml(s.location || '')}" style="flex:1">
        <button type="button" class="btn btn-ghost btn-sm" data-rm="${i}" style="color:var(--color-danger)"><i data-lucide="x" style="width:14px;height:14px"></i></button>
      </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
    samplesList.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = Number(inp.dataset.i);
        sampleState[i][inp.dataset.k] = inp.value;
      });
    });
    samplesList.querySelectorAll('[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        sampleState.splice(Number(btn.dataset.rm), 1);
        if (sampleState.length === 0) sampleState.push({ name: '', quantity: '100g', location: '' });
        renderSamples();
      });
    });
  }
  renderSamples();
  document.getElementById('wm-add-sample').addEventListener('click', () => {
    sampleState.push({ name: '', quantity: '100g', location: '' });
    renderSamples();
  });

  document.getElementById('wm-save').addEventListener('click', async () => {
    const meal_date = document.getElementById('wm-date').value;
    const meal_type = document.getElementById('wm-type').value;
    const service_type = document.getElementById('wm-service').value || null;
    const storage_temperature = document.getElementById('wm-temp').value;
    const storage_location = document.getElementById('wm-loc').value.trim();
    const operator = document.getElementById('wm-op').value.trim();
    const notes = document.getElementById('wm-notes').value.trim();
    if (!meal_date) { document.getElementById('wm-date').classList.add('form-control--error'); return; }
    const cleanSamples = sampleState.filter(s => (s.name || '').trim());
    const payload = {
      meal_date,
      meal_type,
      service_type,
      storage_temperature: storage_temperature !== '' ? Number(storage_temperature) : null,
      storage_location: storage_location || null,
      operator: operator || null,
      notes: notes || null,
      samples: cleanSamples,
      is_complete: cleanSamples.length > 0 ? 1 : 0,
    };
    if (isEdit) {
      const dd = document.getElementById('wm-disposed-date')?.value;
      const db = document.getElementById('wm-disposed-by')?.value.trim();
      if (dd) payload.disposed_date = dd.replace('T', ' ');
      if (db !== undefined) payload.disposed_by = db || null;
    }
    try {
      if (isEdit) {
        await API.request('/haccp/witness-meals/' + record.id, { method: 'PUT', body: payload });
        showToast('Plat témoin mis à jour ✓', 'success');
      } else {
        await API.request('/haccp/witness-meals', { method: 'POST', body: payload });
        showToast('Plat témoin enregistré ✓', 'success');
      }
      overlay.remove();
      renderHACCPWitnessMeals();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
