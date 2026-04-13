// ═══════════════════════════════════════════
// Plan de gestion des allergènes — Route #/haccp/allergens-plan
// Règlement INCO (UE) n°1169/2011
// ═══════════════════════════════════════════

const RISK_CONFIG = {
  élevé:  { color: '#dc3545', bg: '#fff5f5', badge: 'danger',  label: 'Élevé'  },
  moyen:  { color: '#e67e22', bg: '#fff8f0', badge: 'warning', label: 'Moyen'  },
  faible: { color: '#27ae60', bg: '#f0fff4', badge: 'success', label: 'Faible' },
};

function riskBadge(level) {
  const c = RISK_CONFIG[level] || { color: '#888', bg: '#f5f5f5', label: level };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;color:${c.color};background:${c.bg};border:1px solid ${c.color}33">${c.label}</span>`;
}

async function renderHACCPAllergensplan() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const { items } = await API.request('/allergen-plan');

    const present = items.filter(i => i.presence_in_menu);
    const byRisk = {
      élevé:  items.filter(i => i.presence_in_menu && i.risk_level === 'élevé').length,
      moyen:  items.filter(i => i.presence_in_menu && i.risk_level === 'moyen').length,
      faible: items.filter(i => i.presence_in_menu && i.risk_level === 'faible').length,
    };

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="shield-alert" style="width:22px;height:22px;vertical-align:middle;margin-right:8px"></i>Plan de gestion des allergènes</h1>
          <button class="btn btn-secondary" onclick="window.print()">
            <i data-lucide="printer" style="width:18px;height:18px"></i> Imprimer
          </button>
        </div>
        ${HACCP_SUBNAV_FULL}

        <div style="background:#e8f4fd;border:1px solid #3b9ede;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start">
          <i data-lucide="info" style="width:18px;height:18px;color:#3b9ede;flex-shrink:0;margin-top:1px"></i>
          <span class="text-sm"><strong>Règlement INCO (UE) n°1169/2011</strong> — Les 14 allergènes majeurs doivent être maîtrisés dans le cadre du PMS. Ce plan documente les mesures préventives et les procédures de nettoyage pour chaque allergène présent dans l'établissement.</span>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card__label">Allergènes réglementaires</div>
            <div class="kpi-card__value">${items.length}</div>
          </div>
          <div class="kpi-card kpi-card--alert">
            <div class="kpi-card__label">Présents (risque élevé)</div>
            <div class="kpi-card__value">${byRisk.élevé}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__label">Présents (risque moyen)</div>
            <div class="kpi-card__value">${byRisk.moyen}</div>
          </div>
          <div class="kpi-card kpi-card--success">
            <div class="kpi-card__label">Absents ou maîtrisés</div>
            <div class="kpi-card__value">${items.length - present.length}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="min-width:180px">Allergène</th>
                <th style="text-align:center">Présent</th>
                <th>Niveau de risque</th>
                <th>Contamination croisée</th>
                <th>Mesures préventives</th>
                <th>Procédure nettoyage</th>
                <th>Affichage</th>
                <th>Dernière révision</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="allergens-plan-tbody">
              ${items.map(item => {
                const risk = RISK_CONFIG[item.risk_level] || {};
                const rowBg = item.presence_in_menu ? (risk.bg || '') : '';
                return `
                  <tr style="background:${rowBg}" data-id="${item.id}">
                    <td style="font-weight:600">${escapeHtml(item.allergen_name)}</td>
                    <td style="text-align:center">
                      <span style="font-size:18px">${item.presence_in_menu ? '🔴' : '⚪'}</span>
                    </td>
                    <td>${item.presence_in_menu ? riskBadge(item.risk_level) : '<span class="text-secondary text-sm">N/A</span>'}</td>
                    <td class="text-sm" style="max-width:200px;white-space:normal">${escapeHtml(item.cross_contamination_risk || '—')}</td>
                    <td class="text-sm" style="max-width:220px;white-space:normal">${escapeHtml(item.preventive_measures || '—')}</td>
                    <td class="text-sm" style="max-width:200px;white-space:normal">${escapeHtml(item.cleaning_procedure || '—')}</td>
                    <td class="text-sm">${escapeHtml(item.display_method || '—')}</td>
                    <td class="mono text-sm">${item.last_review_date ? new Date(item.last_review_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="openAllergenPlanModal(${item.id})">
                        <i data-lucide="edit-2" style="width:14px;height:14px"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal édition allergène -->
      <div id="allergen-plan-modal" class="modal-overlay" style="display:none">
        <div class="modal" style="max-width:620px;width:95%">
          <div class="modal-header">
            <h3 id="allergen-plan-modal-title">Modifier l'allergène</h3>
            <button class="modal-close" onclick="closeAllergenPlanModal()">×</button>
          </div>
          <div class="modal-body" id="allergen-plan-modal-body"></div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Store items globally for modal access
    window._allergenPlanItems = items;

  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function openAllergenPlanModal(id) {
  const item = (window._allergenPlanItems || []).find(i => i.id === id);
  if (!item) return;

  const modal = document.getElementById('allergen-plan-modal');
  document.getElementById('allergen-plan-modal-title').textContent = `Gérer — ${item.allergen_name}`;

  document.getElementById('allergen-plan-modal-body').innerHTML = `
    <form id="allergen-plan-form" style="display:flex;flex-direction:column;gap:14px">
      <input type="hidden" name="id" value="${item.id}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Présent dans le menu</label>
          <select name="presence_in_menu" class="form-control">
            <option value="1" ${item.presence_in_menu ? 'selected' : ''}>Oui</option>
            <option value="0" ${!item.presence_in_menu ? 'selected' : ''}>Non</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Niveau de risque</label>
          <select name="risk_level" class="form-control">
            <option value="élevé"  ${item.risk_level === 'élevé'  ? 'selected' : ''}>Élevé</option>
            <option value="moyen"  ${item.risk_level === 'moyen'  ? 'selected' : ''}>Moyen</option>
            <option value="faible" ${item.risk_level === 'faible' ? 'selected' : ''}>Faible</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Risque de contamination croisée</label>
        <textarea name="cross_contamination_risk" class="form-control" rows="2">${escapeHtml(item.cross_contamination_risk || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Mesures préventives</label>
        <textarea name="preventive_measures" class="form-control" rows="3">${escapeHtml(item.preventive_measures || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Procédure de nettoyage</label>
        <textarea name="cleaning_procedure" class="form-control" rows="2">${escapeHtml(item.cleaning_procedure || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Méthode d'affichage</label>
          <input type="text" name="display_method" class="form-control" value="${escapeHtml(item.display_method || '')}" placeholder="Carte, ardoise, oral...">
        </div>
        <div class="form-group">
          <label class="form-label">Date de révision</label>
          <input type="date" name="last_review_date" class="form-control" value="${item.last_review_date || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Référence formation</label>
        <input type="text" name="staff_training_ref" class="form-control" value="${escapeHtml(item.staff_training_ref || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea name="notes" class="form-control" rows="2">${escapeHtml(item.notes || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closeAllergenPlanModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  modal.style.display = 'flex';
  if (window.lucide) lucide.createIcons();

  document.getElementById('allergen-plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      presence_in_menu: fd.get('presence_in_menu') === '1',
      risk_level: fd.get('risk_level'),
      cross_contamination_risk: fd.get('cross_contamination_risk'),
      preventive_measures: fd.get('preventive_measures'),
      cleaning_procedure: fd.get('cleaning_procedure'),
      display_method: fd.get('display_method'),
      last_review_date: fd.get('last_review_date'),
      staff_training_ref: fd.get('staff_training_ref'),
      notes: fd.get('notes'),
    };
    try {
      await API.request(`/allergen-plan/${item.id}`, { method: 'PUT', body: data });
      closeAllergenPlanModal();
      renderHACCPAllergensplan();
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  });
}

function closeAllergenPlanModal() {
  document.getElementById('allergen-plan-modal').style.display = 'none';
}
