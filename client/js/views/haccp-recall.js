// ═══════════════════════════════════════════
// HACCP Retrait/Rappel — Route #/haccp/recall
// ═══════════════════════════════════════════

async function renderHACCPRecall() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const { items } = await API.getRecallProcedures();

    // ── KPIs ──
    const active    = items.filter(r => r.status !== 'cloture');
    const closed    = items.filter(r => r.status === 'cloture');
    const critiques = active.filter(r => r.severity === 'critique');

    let avgResolutionDays = '—';
    if (closed.length > 0) {
      const total = closed.reduce((acc, r) => {
        if (r.closure_date) {
          const diff = (new Date(r.closure_date) - new Date(r.alert_date)) / 86400000;
          return acc + Math.max(0, diff);
        }
        return acc;
      }, 0);
      avgResolutionDays = (total / closed.length).toFixed(1) + ' j';
    }
    const closureRate = items.length > 0 ? Math.round((closed.length / items.length) * 100) + '%' : '—';

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="alert-triangle" style="width:22px;height:22px;vertical-align:middle;margin-right:6px;color:var(--color-warning)"></i>Retrait / Rappel produits</h1>
          <button class="btn btn-primary" id="btn-new-recall">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle alerte
          </button>
        </div>

        ${haccpBreadcrumb('autre')}

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:var(--space-5)">
          <div class="kpi-card ${critiques.length > 0 ? 'kpi-card--danger' : ''}">
            <div class="kpi-value">${active.length}</div>
            <div class="kpi-label">Alertes actives</div>
          </div>
          <div class="kpi-card ${critiques.length > 0 ? 'kpi-card--danger' : 'kpi-card--info'}">
            <div class="kpi-value">${critiques.length}</div>
            <div class="kpi-label">Critiques en cours</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${avgResolutionDays}</div>
            <div class="kpi-label">Délai moyen clôture</div>
          </div>
          <div class="kpi-card kpi-card--success">
            <div class="kpi-value">${closureRate}</div>
            <div class="kpi-label">Taux de clôture</div>
          </div>
        </div>

        <!-- Alertes actives -->
        ${active.length > 0 ? `
          <h3 style="margin-bottom:var(--space-3);color:var(--color-warning);display:flex;align-items:center;gap:8px">
            <i data-lucide="siren" style="width:18px;height:18px"></i> Alertes en cours (${active.length})
          </h3>
          <div class="table-container" style="margin-bottom:var(--space-5)">
            <table>
              <thead><tr>
                <th>Sévérité</th><th>Produit</th><th>Lot</th><th>Raison</th>
                <th>Source</th><th>Date alerte</th><th>Statut</th><th>Notifié</th><th></th>
              </tr></thead>
              <tbody id="recall-active-body">
                ${renderRecallRows(active)}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="margin-bottom:var(--space-5)">
            <i data-lucide="check-circle-2" style="width:40px;height:40px;color:var(--color-success);margin-bottom:8px"></i>
            <p>Aucune alerte active</p>
          </div>
        `}

        <!-- Historique clôturé -->
        ${closed.length > 0 ? `
          <details style="margin-top:var(--space-4)">
            <summary style="cursor:pointer;font-weight:600;padding:var(--space-3);background:var(--bg-secondary);border-radius:var(--radius-md);user-select:none">
              Historique clôturé (${closed.length})
            </summary>
            <div class="table-container" style="margin-top:var(--space-3)">
              <table>
                <thead><tr>
                  <th>Sévérité</th><th>Produit</th><th>Lot</th><th>Raison</th>
                  <th>Date alerte</th><th>Clôturé le</th><th>Durée</th><th></th>
                </tr></thead>
                <tbody>${renderRecallClosedRows(closed)}</tbody>
              </table>
            </div>
          </details>
        ` : ''}
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('btn-new-recall').addEventListener('click', () => showRecallModal(null));

    // Table button delegation
    app.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-recall-action]');
      if (!btn) return;
      const id   = Number(btn.dataset.id);
      const item = items.find(r => r.id === id);
      if (!item) return;

      switch (btn.dataset.recallAction) {
        case 'edit':     showRecallModal(item); break;
        case 'progress': advanceRecallStatus(item); break;
        case 'checklist': showRecallChecklist(item); break;
        case 'delete':   deleteRecall(id); break;
      }
    });

  } catch (err) {
    document.getElementById('app').innerHTML =
      `<div class="empty-state"><p>Erreur : ${escapeHtml(err.message)}</p></div>`;
  }
}

// ── Row renderers ──

function _recallSeverityBadge(sev) {
  const map = {
    critique: '<span class="badge badge--danger">Critique</span>',
    majeur:   '<span class="badge badge--warning">Majeur</span>',
    mineur:   '<span class="badge badge--info">Mineur</span>',
  };
  return map[sev] || `<span class="badge">${escapeHtml(sev)}</span>`;
}

function _recallStatusBadge(status) {
  const map = {
    alerte:   '<span class="badge badge--danger">Alerte</span>',
    en_cours: '<span class="badge badge--warning">En cours</span>',
    cloture:  '<span class="badge badge--success">Clôturé</span>',
  };
  return map[status] || `<span class="badge">${escapeHtml(status)}</span>`;
}

function _recallReasonLabel(r) {
  const map = { sanitaire: 'Sanitaire', qualite: 'Qualité', etiquetage: 'Étiquetage', autre: 'Autre' };
  return map[r] || r;
}

function renderRecallRows(items) {
  if (items.length === 0) return '<tr><td colspan="9" style="text-align:center;color:var(--text-tertiary)">Aucune alerte</td></tr>';
  return items.map(r => {
    const dateStr = new Date(r.alert_date).toLocaleDateString('fr-FR');
    const canAdvance = r.status !== 'cloture';
    return `
      <tr>
        <td>${_recallSeverityBadge(r.severity)}</td>
        <td style="font-weight:500">${escapeHtml(r.product_name)}</td>
        <td class="mono text-sm">${escapeHtml(r.lot_number || '—')}</td>
        <td class="text-sm">${_recallReasonLabel(r.reason)}</td>
        <td class="text-sm">${escapeHtml(r.alert_source)}</td>
        <td class="text-sm">${dateStr}</td>
        <td>${_recallStatusBadge(r.status)}</td>
        <td>${r.notification_sent
          ? '<span style="color:var(--color-success);font-size:var(--text-sm)">✓ Envoyée</span>'
          : '<span style="color:var(--text-tertiary);font-size:var(--text-sm)">Non</span>'}</td>
        <td style="white-space:nowrap;display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm" data-recall-action="checklist" data-id="${r.id}" title="Checklist">
            <i data-lucide="list-checks" style="width:14px;height:14px"></i>
          </button>
          ${canAdvance ? `<button class="btn btn-primary btn-sm" data-recall-action="progress" data-id="${r.id}" title="Avancer">
            <i data-lucide="chevron-right" style="width:14px;height:14px"></i>
          </button>` : ''}
          <button class="btn btn-secondary btn-sm" data-recall-action="edit" data-id="${r.id}" title="Modifier">
            <i data-lucide="pencil" style="width:14px;height:14px"></i>
          </button>
          <button class="btn btn-sm" data-recall-action="delete" data-id="${r.id}" title="Supprimer"
                  style="color:var(--color-danger);border:1px solid rgba(217,48,37,0.3);background:transparent">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

function renderRecallClosedRows(items) {
  return items.map(r => {
    const dateAlert   = new Date(r.alert_date).toLocaleDateString('fr-FR');
    const dateClosure = r.closure_date ? new Date(r.closure_date).toLocaleDateString('fr-FR') : '—';
    let duration = '—';
    if (r.closure_date) {
      const d = Math.round((new Date(r.closure_date) - new Date(r.alert_date)) / 86400000);
      duration = `${d} j`;
    }
    return `
      <tr>
        <td>${_recallSeverityBadge(r.severity)}</td>
        <td style="font-weight:500">${escapeHtml(r.product_name)}</td>
        <td class="mono text-sm">${escapeHtml(r.lot_number || '—')}</td>
        <td class="text-sm">${_recallReasonLabel(r.reason)}</td>
        <td class="text-sm">${dateAlert}</td>
        <td class="text-sm">${dateClosure}</td>
        <td class="text-sm">${duration}</td>
        <td>
          <button class="btn btn-secondary btn-sm" data-recall-action="edit" data-id="${r.id}" title="Détails">
            <i data-lucide="eye" style="width:14px;height:14px"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

// ── Advance status ──

async function advanceRecallStatus(item) {
  const next = item.status === 'alerte' ? 'en_cours' : 'cloture';
  const label = next === 'en_cours' ? 'Passer en cours' : 'Clôturer';

  if (next === 'cloture') {
    showRecallCloseModal(item);
    return;
  }

  showConfirmModal(label, `Confirmer le passage en "En cours" pour le rappel de ${item.product_name} ?`, async () => {
    try {
      await API.updateRecallProcedure(item.id, { status: next });
      showToast('Statut mis à jour', 'success');
      renderHACCPRecall();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, { confirmText: label, confirmClass: 'btn btn-primary' });
}

// ── Checklist Modal ──

function showRecallChecklist(item) {
  const steps = [
    { id: 'identify',  label: 'Identifier tous les lots concernés en stock' },
    { id: 'isolate',   label: 'Retirer et isoler les produits (étiqueter "BLOQUÉ")' },
    { id: 'supplier',  label: 'Contacter le fournisseur / fabricant' },
    { id: 'authority', label: 'Notifier les autorités si nécessaire (DDPP/DGAL)' },
    { id: 'staff',     label: 'Informer l\'équipe en cuisine' },
    { id: 'document',  label: 'Documenter toutes les actions (traçabilité)' },
    { id: 'destroy',   label: 'Procéder à la destruction ou au retour documenté' },
  ];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <h2 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="list-checks" style="width:20px;height:20px;color:var(--color-warning)"></i>
        Checklist — ${escapeHtml(item.product_name)}
      </h2>
      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-4)">
        <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;font-size:var(--text-sm)">
          <span>Lot : <strong>${escapeHtml(item.lot_number || 'N/A')}</strong></span>
          <span>Sévérité : ${_recallSeverityBadge(item.severity)}</span>
          <span>Statut : ${_recallStatusBadge(item.status)}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-4)">
        ${steps.map(s => `
          <label style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);border-radius:var(--radius-sm);cursor:pointer;transition:background 0.15s"
                 onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
            <input type="checkbox" id="chk-${s.id}" style="width:16px;height:16px;cursor:pointer" data-ui="custom">
            <span style="font-size:var(--text-sm)">${escapeHtml(s.label)}</span>
          </label>
        `).join('')}
      </div>
      <div id="checklist-progress" style="height:6px;background:var(--border-color);border-radius:3px;margin-bottom:var(--space-4)">
        <div id="checklist-bar" style="height:100%;background:var(--color-success);border-radius:3px;width:0%;transition:width 0.3s"></div>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="checklist-done">Fermer</button>
        ${item.status !== 'cloture' ? `<button class="btn btn-secondary" id="checklist-close-recall">Clôturer le rappel</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  // Progress tracking
  const checkboxes = overlay.querySelectorAll('input[type="checkbox"]');
  const bar = overlay.querySelector('#checklist-bar');
  function updateProgress() {
    const done = [...checkboxes].filter(c => c.checked).length;
    bar.style.width = Math.round((done / checkboxes.length) * 100) + '%';
  }
  checkboxes.forEach(c => c.addEventListener('change', updateProgress));

  overlay.querySelector('#checklist-done').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const closeBtn = overlay.querySelector('#checklist-close-recall');
  if (closeBtn) {
    closeBtn.onclick = () => {
      overlay.remove();
      showRecallCloseModal(item);
    };
  }
}

// ── Close modal ──

function showRecallCloseModal(item) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <h2><i data-lucide="check-circle-2" style="width:20px;height:20px;color:var(--color-success);vertical-align:middle;margin-right:6px"></i>Clôturer le rappel</h2>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-4)">
        Rappel de <strong>${escapeHtml(item.product_name)}</strong> — Lot ${escapeHtml(item.lot_number || 'N/A')}
      </p>
      <div class="form-group">
        <label>Notes de clôture <span style="color:var(--text-tertiary)">(actions menées, résultats)</span></label>
        <textarea class="form-control" id="close-notes" rows="4" placeholder="Décrivez les actions réalisées, les quantités détruites, les retours fournisseurs..." data-ui="custom"></textarea>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:var(--space-2)">
          <input type="checkbox" id="close-notif" style="width:16px;height:16px" data-ui="custom">
          Notification envoyée aux autorités compétentes
        </label>
      </div>
      <div id="close-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn btn-primary" id="close-confirm">
          <i data-lucide="check" style="width:18px;height:18px"></i> Confirmer la clôture
        </button>
        <button class="btn btn-secondary" id="close-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  overlay.querySelector('#close-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#close-confirm').onclick = async () => {
    const notes = document.getElementById('close-notes').value.trim();
    const notifSent = document.getElementById('close-notif').checked;
    const errorEl = document.getElementById('close-error');

    try {
      await API.updateRecallProcedure(item.id, {
        status: 'cloture',
        closure_notes: notes,
        notification_sent: notifSent ? 1 : (item.notification_sent || 0),
      });
      showToast('Rappel clôturé', 'success');
      overlay.remove();
      renderHACCPRecall();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur';
    }
  };
}

// ── Create / Edit Modal ──

function showRecallModal(item) {
  const isEdit = !!item;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:560px">
      <h2>${isEdit
        ? `<i data-lucide="pencil" style="width:18px;height:18px;vertical-align:middle;margin-right:6px"></i>Modifier le rappel`
        : `<i data-lucide="alert-triangle" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;color:var(--color-warning)"></i>Nouvelle alerte retrait/rappel`}</h2>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
        <div class="form-group" style="grid-column:1/-1">
          <label>Produit <span style="color:var(--color-danger)">*</span></label>
          <input type="text" class="form-control" id="rc-product" value="${escapeHtml(item?.product_name || '')}" placeholder="Nom du produit concerné" data-ui="custom">
        </div>
        <div class="form-group">
          <label>Numéro de lot</label>
          <input type="text" class="form-control" id="rc-lot" value="${escapeHtml(item?.lot_number || '')}" placeholder="Ex: FB-2026-0312" data-ui="custom">
        </div>
        <div class="form-group">
          <label>Date d'alerte</label>
          <input type="datetime-local" class="form-control" id="rc-date"
            value="${item?.alert_date ? new Date(item.alert_date).toISOString().slice(0,16) : new Date().toISOString().slice(0,16)}">
        </div>
        <div class="form-group">
          <label>Raison</label>
          <select class="form-control" id="rc-reason" data-ui="custom">
            <option value="sanitaire" ${item?.reason === 'sanitaire' || !item ? 'selected' : ''}>🦠 Sanitaire (contamination)</option>
            <option value="qualite"   ${item?.reason === 'qualite'   ? 'selected' : ''}>⚠️ Qualité</option>
            <option value="etiquetage" ${item?.reason === 'etiquetage' ? 'selected' : ''}>🏷️ Étiquetage / Allergène</option>
            <option value="autre"     ${item?.reason === 'autre'     ? 'selected' : ''}>Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label>Source de l'alerte</label>
          <select class="form-control" id="rc-source" data-ui="custom">
            <option value="DGAL"       ${item?.alert_source === 'DGAL'       ? 'selected' : ''}>DGAL / Autorité</option>
            <option value="fournisseur" ${item?.alert_source === 'fournisseur' || !item ? 'selected' : ''}>Fournisseur</option>
            <option value="interne"    ${item?.alert_source === 'interne'    ? 'selected' : ''}>Détection interne</option>
            <option value="client"     ${item?.alert_source === 'client'     ? 'selected' : ''}>Réclamation client</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sévérité</label>
          <select class="form-control" id="rc-severity" data-ui="custom">
            <option value="critique" ${item?.severity === 'critique' ? 'selected' : ''}>🔴 Critique</option>
            <option value="majeur"   ${item?.severity === 'majeur' || !item ? 'selected' : ''}>🟠 Majeur</option>
            <option value="mineur"   ${item?.severity === 'mineur'   ? 'selected' : ''}>🟡 Mineur</option>
          </select>
        </div>
        <div class="form-group">
          <label>Quantité concernée</label>
          <div style="display:flex;gap:var(--space-2)">
            <input type="number" class="form-control" id="rc-qty" value="${item?.quantity_affected || ''}" placeholder="0" min="0" style="flex:2" data-ui="custom">
            <select class="form-control" id="rc-qty-unit" style="flex:1" data-ui="custom">
              <option value="kg"     ${item?.quantity_unit === 'kg'     || !item ? 'selected' : ''}>kg</option>
              <option value="unités" ${item?.quantity_unit === 'unités' ? 'selected' : ''}>unités</option>
              <option value="L"      ${item?.quantity_unit === 'L'      ? 'selected' : ''}>L</option>
              <option value="boîtes" ${item?.quantity_unit === 'boîtes' ? 'selected' : ''}>boîtes</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Actions prises</label>
          <textarea class="form-control" id="rc-actions" rows="3" placeholder="Ex: Lots retirés des frigos, fournisseur contacté..." data-ui="custom">${escapeHtml(item?.actions_taken || '')}</textarea>
        </div>
        ${isEdit ? `
        <div class="form-group" style="display:flex;align-items:center;gap:var(--space-2)">
          <input type="checkbox" id="rc-notif" style="width:16px;height:16px" ${item?.notification_sent ? 'checked' : ''} data-ui="custom">
          <label for="rc-notif" style="margin:0;cursor:pointer">Notification envoyée aux autorités</label>
        </div>
        ` : ''}
      </div>

      <div id="rc-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-top:var(--space-2)"></div>
      <div class="actions-row" style="margin-top:var(--space-3)">
        <button class="btn btn-primary" id="rc-save">
          <i data-lucide="${isEdit ? 'save' : 'alert-triangle'}" style="width:18px;height:18px"></i>
          ${isEdit ? 'Enregistrer' : 'Créer l\'alerte'}
        </button>
        <button class="btn btn-secondary" id="rc-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  overlay.querySelector('#rc-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#rc-save').onclick = async () => {
    const product_name    = document.getElementById('rc-product').value.trim();
    const lot_number      = document.getElementById('rc-lot').value.trim();
    const alert_date      = document.getElementById('rc-date').value;
    const reason          = document.getElementById('rc-reason').value;
    const alert_source    = document.getElementById('rc-source').value;
    const severity        = document.getElementById('rc-severity').value;
    const quantity_affected = document.getElementById('rc-qty').value || null;
    const quantity_unit   = document.getElementById('rc-qty-unit').value;
    const actions_taken   = document.getElementById('rc-actions').value.trim();
    const errorEl = document.getElementById('rc-error');

    if (!product_name) { errorEl.textContent = 'Le produit est requis'; return; }

    const payload = {
      product_name, lot_number: lot_number || null,
      alert_date, reason, alert_source, severity,
      quantity_affected: quantity_affected ? Number(quantity_affected) : null,
      quantity_unit, actions_taken: actions_taken || null,
    };

    if (isEdit) {
      payload.notification_sent = document.getElementById('rc-notif').checked ? 1 : 0;
    }

    try {
      if (isEdit) {
        await API.updateRecallProcedure(item.id, payload);
        showToast('Procédure mise à jour', 'success');
      } else {
        await API.createRecallProcedure(payload);
        showToast('Alerte créée', 'success');
      }
      overlay.remove();
      renderHACCPRecall();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur';
    }
  };

  document.getElementById('rc-product').focus();
}

// ── Delete ──

async function deleteRecall(id) {
  showConfirmModal('Supprimer', 'Supprimer définitivement cette procédure de rappel ?', async () => {
    try {
      await API.deleteRecallProcedure(id);
      showToast('Procédure supprimée', 'success');
      renderHACCPRecall();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
}
