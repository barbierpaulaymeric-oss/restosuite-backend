// ═══════════════════════════════════════════
// Diagrammes de fabrication — Route #/fabrication-diagrams
// ═══════════════════════════════════════════

async function renderFabricationDiagrams() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const diagrams = await API.request('/fabrication-diagrams');
    const account = getAccount();
    const isGerant = account && account.role === 'gerant';

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="git-branch" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Diagrammes de fabrication</h1>
          ${isGerant ? `
          <button class="btn btn-primary" id="btn-new-diagram">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau diagramme
          </button>
          ` : ''}
        </div>

        <p class="text-secondary text-sm" style="margin-bottom:var(--space-4)">
          Les diagrammes de fabrication représentent le flux de production de vos plats, du réception à la mise en service. Ils constituent un élément essentiel du Plan de Maîtrise Sanitaire (PMS).
        </p>

        ${diagrams.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon"><i data-lucide="git-branch" style="width:48px;height:48px;color:var(--text-tertiary)"></i></div>
            <p>Aucun diagramme de fabrication</p>
          </div>
        ` : diagrams.map(d => renderDiagram(d, isGerant)).join('')}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    setupDiagramEvents(diagrams);
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderDiagram(diagram, isGerant) {
  const etapes = Array.isArray(diagram.etapes) ? diagram.etapes : [];
  const etapesSorted = etapes.slice().sort((a, b) => a.ordre - b.ordre);
  return `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header" style="margin-bottom:var(--space-3)">
        <div>
          <span class="card-title" style="font-size:1.1rem">${escapeHtml(diagram.nom)}</span>
          ${diagram.description ? `<p class="text-secondary text-sm" style="margin-top:4px">${escapeHtml(diagram.description)}</p>` : ''}
        </div>
        ${isGerant ? `
        <div class="actions-row" style="gap:var(--space-2)">
          <button class="btn btn-ghost btn-sm btn-edit-diagram" data-id="${diagram.id}">✏️ Modifier</button>
          <button class="btn btn-ghost btn-sm btn-delete-diagram" data-id="${diagram.id}" data-name="${escapeHtml(diagram.nom)}">🗑️</button>
        </div>
        ` : ''}
      </div>

      <div class="fabrication-flow">
        ${etapesSorted.map((etape, idx) => `
          <div class="fabrication-step ${etape.ccp ? 'fabrication-step--ccp' : ''}">
            <div class="fabrication-step__number">${etape.ordre || idx + 1}</div>
            <div class="fabrication-step__content">
              <div class="fabrication-step__name">
                ${escapeHtml(etape.nom)}
                ${etape.ccp ? '<span class="badge" style="background:var(--color-danger);color:white;font-size:10px;padding:1px 6px;border-radius:20px;margin-left:6px">CCP</span>' : ''}
              </div>
              ${etape.description ? `<div class="fabrication-step__desc text-secondary text-sm">${escapeHtml(etape.description)}</div>` : ''}
              ${etape.point_maitrise ? `
                <div class="fabrication-step__pm text-sm" style="margin-top:4px;color:${etape.ccp ? 'var(--color-danger)' : 'var(--color-info)'};font-style:italic">
                  ⚠️ ${escapeHtml(etape.point_maitrise)}
                </div>
              ` : ''}
            </div>
          </div>
          ${idx < etapesSorted.length - 1 ? `<div class="fabrication-arrow">▼</div>` : ''}
        `).join('')}
      </div>
    </div>
  `;
}

function setupDiagramEvents(diagrams) {
  document.getElementById('btn-new-diagram')?.addEventListener('click', () => showDiagramModal(null));

  document.querySelectorAll('.btn-edit-diagram').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = diagrams.find(x => x.id === Number(btn.dataset.id));
      if (d) showDiagramModal(d);
    });
  });

  document.querySelectorAll('.btn-delete-diagram').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      showConfirmModal('Supprimer le diagramme', `Êtes-vous sûr de vouloir supprimer "${name}" ?`, async () => {
        try {
          await API.request(`/fabrication-diagrams/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Diagramme supprimé', 'success');
          renderFabricationDiagrams();
        } catch (err) {
          showToast('Erreur : ' + err.message, 'error');
        }
      }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
    });
  });
}

function showDiagramModal(diagram) {
  const isEdit = !!diagram;
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const etapes = isEdit && Array.isArray(diagram.etapes) ? diagram.etapes.slice().sort((a, b) => a.ordre - b.ordre) : [
    { ordre: 1, nom: '', description: '', ccp: false, point_maitrise: '' }
  ];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const renderEtapeRows = (etapesList) => etapesList.map((e, i) => `
    <div class="diagram-etape-row" data-idx="${i}" style="background:var(--bg-secondary,var(--bg-card));border:1px solid var(--border-light);border-radius:8px;padding:var(--space-3);margin-bottom:var(--space-2)">
      <div class="form-row" style="align-items:center;margin-bottom:var(--space-2)">
        <span style="font-weight:600;min-width:28px;color:var(--text-tertiary)">${i + 1}.</span>
        <div class="form-group" style="flex:2;margin-bottom:0">
          <input type="text" class="form-control etape-nom" placeholder="Nom de l'étape *" value="${escapeHtml(e.nom || '')}">
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;white-space:nowrap">
          <input type="checkbox" class="etape-ccp" ${e.ccp ? 'checked' : ''}> CCP
        </label>
        <button class="btn btn-ghost btn-sm btn-remove-etape" ${etapesList.length <= 1 ? 'disabled' : ''} style="padding:4px 8px;color:var(--color-danger)">✕</button>
      </div>
      <div class="form-group" style="margin-bottom:var(--space-2)">
        <input type="text" class="form-control etape-desc" placeholder="Description de l'étape" value="${escapeHtml(e.description || '')}">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <input type="text" class="form-control etape-pm" placeholder="Point de maîtrise / limite critique" value="${escapeHtml(e.point_maitrise || '')}">
      </div>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:680px;max-height:90vh;overflow-y:auto">
      <h2><i data-lucide="${isEdit ? 'pencil' : 'plus'}" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>${isEdit ? 'Modifier le diagramme' : 'Nouveau diagramme'}</h2>

      <div class="form-group">
        <label>Nom du diagramme *</label>
        <input type="text" class="form-control" id="diag-nom" value="${isEdit ? escapeHtml(diagram.nom) : ''}" placeholder="ex: Service restaurant — liaison chaude">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-control" id="diag-desc" rows="2" placeholder="Description du diagramme...">${isEdit ? escapeHtml(diagram.description || '') : ''}</textarea>
      </div>

      <div style="margin-bottom:var(--space-3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)">
          <label style="margin:0;font-weight:600">Étapes</label>
          <button class="btn btn-secondary btn-sm" id="btn-add-etape"><i data-lucide="plus" style="width:14px;height:14px"></i> Ajouter une étape</button>
        </div>
        <div id="etapes-container">
          ${renderEtapeRows(etapes)}
        </div>
      </div>

      <div class="actions-row" style="justify-content:flex-end">
        <button class="btn btn-secondary" id="diag-cancel">Annuler</button>
        <button class="btn btn-primary" id="diag-save">${isEdit ? 'Modifier' : 'Créer'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();

  let etapesList = etapes.map(e => ({ ...e }));

  function refreshEtapes() {
    document.getElementById('etapes-container').innerHTML = renderEtapeRows(etapesList);
    // Re-bind remove buttons
    document.querySelectorAll('.btn-remove-etape').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (etapesList.length <= 1) return;
        etapesList.splice(i, 1);
        etapesList.forEach((e, idx) => { e.ordre = idx + 1; });
        refreshEtapes();
      });
    });
  }

  // Initial bind remove buttons
  document.querySelectorAll('.btn-remove-etape').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (etapesList.length <= 1) return;
      etapesList.splice(i, 1);
      etapesList.forEach((e, idx) => { e.ordre = idx + 1; });
      refreshEtapes();
    });
  });

  document.getElementById('btn-add-etape').addEventListener('click', () => {
    etapesList.push({ ordre: etapesList.length + 1, nom: '', description: '', ccp: false, point_maitrise: '' });
    refreshEtapes();
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('diag-cancel').addEventListener('click', () => overlay.remove());

  document.getElementById('diag-save').addEventListener('click', async () => {
    const nom = document.getElementById('diag-nom').value.trim();
    if (!nom) { showToast('Le nom est requis', 'error'); return; }

    // Read current etape values from DOM
    const rows = document.querySelectorAll('.diagram-etape-row');
    const finalEtapes = [];
    let valid = true;
    rows.forEach((row, i) => {
      const etapeNom = row.querySelector('.etape-nom').value.trim();
      if (!etapeNom) { valid = false; return; }
      finalEtapes.push({
        ordre: i + 1,
        nom: etapeNom,
        description: row.querySelector('.etape-desc').value.trim() || '',
        ccp: row.querySelector('.etape-ccp').checked,
        point_maitrise: row.querySelector('.etape-pm').value.trim() || '',
      });
    });

    if (!valid || finalEtapes.length === 0) {
      showToast('Chaque étape doit avoir un nom', 'error');
      return;
    }

    const payload = {
      nom,
      description: document.getElementById('diag-desc').value.trim() || null,
      etapes: finalEtapes,
    };

    try {
      if (isEdit) {
        await API.request(`/fabrication-diagrams/${diagram.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await API.request('/fabrication-diagrams', { method: 'POST', body: JSON.stringify(payload) });
      }
      overlay.remove();
      showToast(isEdit ? 'Diagramme modifié ✓' : 'Diagramme créé ✓', 'success');
      renderFabricationDiagrams();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
  });
}
