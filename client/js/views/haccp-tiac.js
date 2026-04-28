// ═══════════════════════════════════════════
// TIAC — Route #/haccp/tiac
// ═══════════════════════════════════════════

async function renderHACCPTIAC() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const procedures = await API.request('/tiac');
    const account = getAccount();
    const isGerant = account && account.role === 'gerant';

    const statutColors = {
      'en_cours': 'var(--color-danger)',
      'en_investigation': 'var(--color-warning)',
      'clos': 'var(--color-success)',
    };
    const statutLabels = {
      'en_cours': 'En cours',
      'en_investigation': 'En investigation',
      'clos': 'Clos',
    };

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="alert-octagon" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Procédures TIAC</h1>
          ${isGerant ? `
          <button class="btn btn-primary" id="btn-new-tiac">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle procédure
          </button>
          ` : ''}
        </div>

        ${haccpBreadcrumb('autre')}

        <div class="haccp-info-banner" style="background:var(--color-danger-light,rgba(239,68,68,0.08));border:1px solid var(--color-danger);border-radius:8px;padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);display:flex;gap:var(--space-3);align-items:flex-start">
          <i data-lucide="info" style="width:20px;height:20px;color:var(--color-danger);flex-shrink:0;margin-top:2px"></i>
          <div>
            <strong style="color:var(--color-danger)">Obligations légales TIAC</strong>
            <p class="text-secondary text-sm" style="margin-top:4px">Toute suspicion de TIAC doit être signalée sans délai à l'ARS (Agence Régionale de Santé) et à la DDPP. Les plats témoins doivent être conservés 5 jours. La traçabilité complète des aliments suspects est obligatoire.</p>
          </div>
        </div>

        ${procedures.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon"><i data-lucide="shield-check" style="width:48px;height:48px;color:var(--color-success)"></i></div>
            <p>Aucune procédure TIAC enregistrée</p>
            <p class="text-secondary text-sm">En cas d'incident, déclarez une procédure immédiatement.</p>
          </div>
        ` : `
          <div class="haccp-tasks-grid">
            ${procedures.map(p => `
              <div class="card" style="border-left:4px solid ${statutColors[p.statut] || 'var(--border-light)'}">
                <div class="card-header">
                  <span class="card-title">${escapeHtml(new Date(p.date_incident).toLocaleDateString('fr-FR'))} — ${escapeHtml(p.nb_personnes)} personne(s) touchée(s)</span>
                  <span class="badge" style="background:${statutColors[p.statut] || 'var(--color-info)'};color:white;font-size:11px;padding:2px 8px;border-radius:20px">${statutLabels[p.statut] || p.statut}</span>
                </div>
                <p class="text-sm" style="margin:var(--space-2) 0">${escapeHtml(p.description)}</p>
                ${p.aliments_suspects ? `<p class="text-secondary text-sm">🍽️ <strong>Aliments suspects :</strong> ${escapeHtml(p.aliments_suspects)}</p>` : ''}
                ${p.symptomes ? `<p class="text-secondary text-sm">🤒 <strong>Symptômes :</strong> ${escapeHtml(p.symptomes)}</p>` : ''}
                <div class="tiac-checks" style="display:flex;gap:var(--space-3);margin-top:var(--space-3);flex-wrap:wrap">
                  <span class="tiac-check ${p.declaration_ars ? 'tiac-check--ok' : 'tiac-check--nok'}">
                    ${p.declaration_ars ? '✅' : '❌'} Déclaration ARS
                  </span>
                  <span class="tiac-check ${p.plats_temoins_conserves ? 'tiac-check--ok' : 'tiac-check--nok'}">
                    ${p.plats_temoins_conserves ? '✅' : '❌'} Plats témoins conservés
                  </span>
                </div>
                ${p.contact_ddpp ? `<p class="text-secondary text-sm" style="margin-top:var(--space-2)">📞 DDPP : ${escapeHtml(p.contact_ddpp)}</p>` : ''}
                ${isGerant ? `
                <div class="actions-row" style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-light)">
                  <button class="btn btn-ghost btn-sm btn-edit-tiac" data-id="${p.id}">✏️ Modifier</button>
                  <button class="btn btn-ghost btn-sm btn-delete-tiac" data-id="${p.id}">🗑️ Supprimer</button>
                </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    setupTIACEvents(procedures);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function setupTIACEvents(procedures) {
  document.getElementById('btn-new-tiac')?.addEventListener('click', () => showTIACModal(null));

  document.querySelectorAll('.btn-edit-tiac').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = procedures.find(x => x.id === Number(btn.dataset.id));
      if (p) showTIACModal(p);
    });
  });

  document.querySelectorAll('.btn-delete-tiac').forEach(btn => {
    btn.addEventListener('click', async () => {
      showConfirmModal('Supprimer la procédure', 'Êtes-vous sûr de vouloir supprimer cette procédure TIAC ?', async () => {
        try {
          await API.request(`/tiac/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Procédure supprimée', 'success');
          renderHACCPTIAC();
        } catch (err) {
          showToast('Erreur : ' + err.message, 'error');
        }
      }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
    });
  });
}

function showTIACModal(procedure) {
  const isEdit = !!procedure;
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:640px">
      <h2><i data-lucide="${isEdit ? 'pencil' : 'plus'}" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>${isEdit ? 'Modifier la procédure TIAC' : 'Nouvelle procédure TIAC'}</h2>

      <div class="form-row">
        <div class="form-group">
          <label>Date de l'incident *</label>
          <input type="date" class="form-control" id="tiac-date" value="${isEdit && procedure.date_incident ? procedure.date_incident.slice(0, 10) : ''}">
        </div>
        <div class="form-group">
          <label>Nombre de personnes touchées</label>
          <input type="number" class="form-control" id="tiac-nb" min="0" value="${isEdit ? (procedure.nb_personnes || 0) : ''}" data-ui="custom">
        </div>
      </div>

      <div class="form-group">
        <label>Description de l'incident *</label>
        <textarea class="form-control" id="tiac-description" rows="3" placeholder="Décrivez le contexte, les repas concernés..." data-ui="custom">${isEdit ? escapeHtml(procedure.description || '') : ''}</textarea>
      </div>

      <div class="form-group">
        <label>Symptômes observés</label>
        <input type="text" class="form-control" id="tiac-symptomes" value="${isEdit ? escapeHtml(procedure.symptomes || '') : ''}" placeholder="ex: Nausées, vomissements, diarrhées (apparition 4-6h)" data-ui="custom">
      </div>

      <div class="form-group">
        <label>Aliments suspects</label>
        <input type="text" class="form-control" id="tiac-aliments" value="${isEdit ? escapeHtml(procedure.aliments_suspects || '') : ''}" placeholder="ex: Poulet rôti — lot LOT-2026-0312" data-ui="custom">
      </div>

      <div class="form-group">
        <label>Mesures conservatoires prises</label>
        <textarea class="form-control" id="tiac-mesures" rows="2" placeholder="ex: Mise en quarantaine du stock, arrêt du service, nettoyage..." data-ui="custom">${isEdit ? escapeHtml(procedure.mesures_conservatoires || '') : ''}</textarea>
      </div>

      <div class="form-group">
        <label>Contact DDPP</label>
        <input type="text" class="form-control" id="tiac-contact" value="${isEdit ? escapeHtml(procedure.contact_ddpp || '') : ''}" placeholder="ex: DDPP 75 — Tél : 01 40 07 22 00" data-ui="custom">
      </div>

      <div class="form-row" style="margin-top:var(--space-3)">
        <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="tiac-ars" ${isEdit && procedure.declaration_ars ? 'checked' : ''} data-ui="custom">
          <span>Déclaration ARS effectuée</span>
        </label>
        <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="tiac-plats" ${isEdit && procedure.plats_temoins_conserves ? 'checked' : ''} data-ui="custom">
          <span>Plats témoins conservés</span>
        </label>
      </div>

      <div class="form-group" style="margin-top:var(--space-3)">
        <label>Statut</label>
        <select class="form-control" id="tiac-statut" data-ui="custom">
          <option value="en_cours" ${isEdit && procedure.statut === 'en_cours' ? 'selected' : ''}>En cours</option>
          <option value="en_investigation" ${isEdit && procedure.statut === 'en_investigation' ? 'selected' : ''}>En investigation</option>
          <option value="clos" ${isEdit && procedure.statut === 'clos' ? 'selected' : ''}>Clos</option>
        </select>
      </div>

      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="tiac-cancel">Annuler</button>
        <button class="btn btn-primary" id="tiac-save">${isEdit ? 'Modifier' : 'Créer'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('tiac-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('tiac-save').addEventListener('click', async () => {
    const date_incident = document.getElementById('tiac-date').value;
    const description = document.getElementById('tiac-description').value.trim();
    if (!date_incident || !description) {
      showToast('La date et la description sont requises', 'error');
      return;
    }
    const payload = {
      date_incident,
      description,
      nb_personnes: parseInt(document.getElementById('tiac-nb').value) || 0,
      symptomes: document.getElementById('tiac-symptomes').value.trim() || null,
      aliments_suspects: document.getElementById('tiac-aliments').value.trim() || null,
      mesures_conservatoires: document.getElementById('tiac-mesures').value.trim() || null,
      contact_ddpp: document.getElementById('tiac-contact').value.trim() || null,
      declaration_ars: document.getElementById('tiac-ars').checked,
      plats_temoins_conserves: document.getElementById('tiac-plats').checked,
      statut: document.getElementById('tiac-statut').value,
    };
    try {
      if (isEdit) {
        await API.request(`/tiac/${procedure.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await API.request('/tiac', { method: 'POST', body: JSON.stringify(payload) });
      }
      overlay.remove();
      showToast(isEdit ? 'Procédure modifiée ✓' : 'Procédure créée ✓', 'success');
      renderHACCPTIAC();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
