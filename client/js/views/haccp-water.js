// ═══════════════════════════════════════════
// Gestion de l'eau — Route #/haccp/water
// ═══════════════════════════════════════════

async function renderHACCPWater() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.request('/water');

    const today = new Date().toISOString().slice(0, 10);
    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const lastAnalysis = items[0] || null;
    const dueSoon = items.filter(i => i.next_analysis_date && i.next_analysis_date <= in30Days && i.next_analysis_date >= today);
    const overdue = items.filter(i => i.next_analysis_date && i.next_analysis_date < today);
    const conformCount = items.filter(i => i.conformity).length;

    const SOURCE_ICONS = { 'réseau public': '🚿', forage: '⛏️', autre: '💧' };
    const TYPE_LABELS = { microbiologique: 'Microbiologique', 'physico-chimique': 'Physico-chimique', complète: 'Complète' };

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="droplets" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Gestion de l'eau</h1>
          <button class="btn btn-primary" id="btn-new-water">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle analyse
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm">La qualité de l'eau utilisée en cuisine est un point de maîtrise du PMS. Le <strong>Code de la Santé Publique</strong> impose des contrôles réguliers. Conservez les rapports d'analyse pendant au moins 5 ans.</span>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Analyses enregistrées</div>
            <div class="kpi-card__value">${items.length}</div>
          </div>
          <div class="kpi-card ${conformCount === items.length && items.length > 0 ? 'kpi-card--success' : ''}">
            <div class="kpi-card__label">Conformes</div>
            <div class="kpi-card__value">${conformCount}/${items.length}</div>
          </div>
          <div class="kpi-card ${dueSoon.length > 0 ? 'kpi-card--info' : ''}">
            <div class="kpi-card__label">Analyse à venir (30j)</div>
            <div class="kpi-card__value">${dueSoon.length}</div>
          </div>
          <div class="kpi-card ${overdue.length > 0 ? 'kpi-card--alert' : ''}">
            <div class="kpi-card__label">En retard</div>
            <div class="kpi-card__value">${overdue.length}</div>
          </div>
        </div>

        ${lastAnalysis ? `
        <div style="background:${lastAnalysis.conformity ? '#f0fff4' : '#fff5f5'};border:1px solid ${lastAnalysis.conformity ? '#27ae60' : '#dc3545'};border-radius:8px;padding:16px;margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <i data-lucide="${lastAnalysis.conformity ? 'check-circle' : 'x-circle'}" style="width:18px;height:18px;color:${lastAnalysis.conformity ? '#27ae60' : '#dc3545'}"></i>
            <strong>Dernière analyse — ${new Date(lastAnalysis.analysis_date).toLocaleDateString('fr-FR')}</strong>
            <span class="text-secondary text-sm">${SOURCE_ICONS[lastAnalysis.water_source] || '💧'} ${lastAnalysis.water_source} · ${TYPE_LABELS[lastAnalysis.analysis_type] || lastAnalysis.analysis_type}</span>
          </div>
          <p class="text-sm" style="margin:0 0 6px">${escapeHtml(lastAnalysis.results || 'Aucun résultat enregistré')}</p>
          ${lastAnalysis.next_analysis_date ? `<p class="text-sm text-secondary" style="margin:0">Prochaine analyse prévue : <strong>${new Date(lastAnalysis.next_analysis_date).toLocaleDateString('fr-FR')}</strong></p>` : ''}
        </div>
        ` : ''}

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date d'analyse</th>
                <th>Type</th>
                <th>Source</th>
                <th>Laboratoire</th>
                <th>Résultats</th>
                <th style="text-align:center">Conforme</th>
                <th>Prochaine analyse</th>
                <th>Réf. rapport</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items.length === 0
                ? '<tr><td colspan="9" class="text-secondary text-center" style="padding:24px">Aucune analyse enregistrée</td></tr>'
                : items.map(item => {
                  const isOverdue = item.next_analysis_date && item.next_analysis_date < today;
                  const isDueSoon = !isOverdue && item.next_analysis_date && item.next_analysis_date <= in30Days;
                  return `
                    <tr${!item.conformity ? ' style="background:#fff8f8"' : ''}>
                      <td class="mono">${new Date(item.analysis_date).toLocaleDateString('fr-FR')}</td>
                      <td class="text-sm">${TYPE_LABELS[item.analysis_type] || item.analysis_type}</td>
                      <td class="text-sm">${SOURCE_ICONS[item.water_source] || '💧'} ${escapeHtml(item.water_source || '—')}</td>
                      <td class="text-sm">${escapeHtml(item.provider || '—')}</td>
                      <td class="text-sm" style="max-width:260px;white-space:normal">${escapeHtml(item.results || '—')}</td>
                      <td style="text-align:center">
                        ${item.conformity
                          ? '<span style="color:#27ae60;font-weight:700">✔ Oui</span>'
                          : '<span style="color:#dc3545;font-weight:700">✘ Non</span>'}
                      </td>
                      <td class="mono text-sm${isOverdue ? ' text-danger' : isDueSoon ? ' text-warning' : ''}">
                        ${item.next_analysis_date ? new Date(item.next_analysis_date).toLocaleDateString('fr-FR') : '—'}
                        ${isOverdue ? ' ⚠️' : isDueSoon ? ' ⏰' : ''}
                      </td>
                      <td class="text-sm">${escapeHtml(item.report_ref || '—')}</td>
                      <td style="white-space:nowrap">
                        <button class="btn btn-ghost btn-sm" onclick="openWaterModal(${item.id})"><i data-lucide="edit-2" style="width:14px;height:14px"></i></button>
                        <button class="btn btn-ghost btn-sm text-danger" onclick="deleteWaterAnalysis(${item.id})"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
                      </td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal -->
      <div id="water-modal" class="modal-overlay" style="display:none">
        <div class="modal" style="max-width:560px;width:95%">
          <div class="modal-header">
            <h3 id="water-modal-title">Nouvelle analyse</h3>
            <button class="modal-close" onclick="closeWaterModal()">×</button>
          </div>
          <div class="modal-body" id="water-modal-body"></div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    window._waterItems = items;

    document.getElementById('btn-new-water').addEventListener('click', () => openWaterModal(null));

  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function openWaterModal(id) {
  const item = id ? (window._waterItems || []).find(i => i.id === id) : null;
  const today = new Date().toISOString().slice(0, 10);

  document.getElementById('water-modal-title').textContent = item ? 'Modifier l\'analyse' : 'Nouvelle analyse';
  document.getElementById('water-modal-body').innerHTML = `
    <form id="water-form" style="display:flex;flex-direction:column;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Date d'analyse *</label>
          <input type="date" name="analysis_date" class="form-control" required value="${item ? item.analysis_date : today}">
        </div>
        <div class="form-group">
          <label class="form-label">Type d'analyse</label>
          <select name="analysis_type" class="form-control">
            <option value="complète" ${(!item || item.analysis_type === 'complète') ? 'selected' : ''}>Complète</option>
            <option value="microbiologique" ${item && item.analysis_type === 'microbiologique' ? 'selected' : ''}>Microbiologique</option>
            <option value="physico-chimique" ${item && item.analysis_type === 'physico-chimique' ? 'selected' : ''}>Physico-chimique</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Laboratoire / Prestataire</label>
          <input type="text" name="provider" class="form-control" value="${escapeHtml(item ? item.provider || '' : '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Source d'eau</label>
          <select name="water_source" class="form-control">
            <option value="réseau public" ${(!item || item.water_source === 'réseau public') ? 'selected' : ''}>Réseau public</option>
            <option value="forage" ${item && item.water_source === 'forage' ? 'selected' : ''}>Forage</option>
            <option value="autre" ${item && item.water_source === 'autre' ? 'selected' : ''}>Autre</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Résultats de l'analyse</label>
        <textarea name="results" class="form-control" rows="3" placeholder="pH, turbidité, nitrates, coliformes...">${escapeHtml(item ? item.results || '' : '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Conformité</label>
          <select name="conformity" class="form-control">
            <option value="1" ${(!item || item.conformity) ? 'selected' : ''}>Conforme</option>
            <option value="0" ${item && !item.conformity ? 'selected' : ''}>Non conforme</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Référence rapport</label>
          <input type="text" name="report_ref" class="form-control" value="${escapeHtml(item ? item.report_ref || '' : '')}">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Prochaine analyse prévue</label>
          <input type="date" name="next_analysis_date" class="form-control" value="${item ? item.next_analysis_date || '' : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Traitement en place</label>
          <input type="text" name="treatment" class="form-control" value="${escapeHtml(item ? item.treatment || '' : '')}" placeholder="Adoucisseur, filtre UV...">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea name="notes" class="form-control" rows="2">${escapeHtml(item ? item.notes || '' : '')}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closeWaterModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">${item ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `;

  document.getElementById('water-modal').style.display = 'flex';

  document.getElementById('water-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      analysis_date: fd.get('analysis_date'),
      analysis_type: fd.get('analysis_type'),
      provider: fd.get('provider'),
      water_source: fd.get('water_source'),
      results: fd.get('results'),
      conformity: fd.get('conformity') === '1',
      report_ref: fd.get('report_ref'),
      next_analysis_date: fd.get('next_analysis_date'),
      treatment: fd.get('treatment'),
      notes: fd.get('notes'),
    };
    try {
      if (item) {
        await API.request(`/water/${item.id}`, { method: 'PUT', body: data });
      } else {
        await API.request('/water', { method: 'POST', body: data });
      }
      closeWaterModal();
      renderHACCPWater();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  });
}

function closeWaterModal() {
  document.getElementById('water-modal').style.display = 'none';
}

async function deleteWaterAnalysis(id) {
  if (!confirm('Supprimer cette analyse ?')) return;
  try {
    await API.request(`/water/${id}`, { method: 'DELETE' });
    renderHACCPWater();
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
}
