// ═══════════════════════════════════════════
// Traçabilité aval — Route #/traceability/downstream
// ═══════════════════════════════════════════

const TD_DEST_LABELS = {
  salle:     'Salle',
  livraison: 'Livraison',
  traiteur:  'Traiteur',
  autre:     'Autre',
};

const TD_DEST_COLORS = {
  salle:     '#3b82f6',
  livraison: '#8b5cf6',
  traiteur:  '#10b981',
  autre:     '#f59e0b',
};

function tdDestBadge(type) {
  if (!type) return '<span style="color:var(--color-text-muted)">—</span>';
  const color = TD_DEST_COLORS[type] || 'var(--color-text-muted)';
  const label = TD_DEST_LABELS[type] || type;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;background:${color}18;color:${color};border:1px solid ${color}30">${label}</span>`;
}

function tdFmtDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch (e) { return d; }
}

function tdFmtTemp(t) {
  if (t == null || t === '') return '—';
  const v = parseFloat(t);
  const color = v < 4 ? '#3b82f6' : v < 8 ? '#10b981' : v < 63 ? '#f59e0b' : '#e3821b';
  return `<span style="font-weight:600;color:${color}">${v.toFixed(1)}°C</span>`;
}

function tdFmtQty(qty, unit) {
  if (qty == null) return '—';
  return `${parseFloat(qty).toFixed(1)} ${unit || 'kg'}`;
}

function renderTDRows(items) {
  if (!items.length) {
    return `<tr><td colspan="8" style="text-align:center;color:var(--color-text-muted);padding:32px">
      <i data-lucide="package-x" style="width:32px;height:32px;margin-bottom:8px;opacity:0.4"></i><br>Aucune expédition trouvée
    </td></tr>`;
  }
  return items.map(r => `
    <tr data-id="${r.id}" style="cursor:pointer" class="td-row">
      <td>${tdFmtDate(r.dispatch_date)}${r.dispatch_time ? `<br><small style="color:var(--color-text-muted)">${r.dispatch_time}</small>` : ''}</td>
      <td>
        <strong>${escapeHtml(r.product_name)}</strong>
        ${r.production_date ? `<br><small style="color:var(--color-text-muted)">Fab: ${tdFmtDate(r.production_date)}</small>` : ''}
      </td>
      <td>
        ${r.batch_number
          ? `<code style="font-size:0.8rem;background:var(--color-bg-secondary);padding:2px 6px;border-radius:4px">${escapeHtml(r.batch_number)}</code>`
          : '<span style="color:var(--color-text-muted)">—</span>'}
      </td>
      <td>
        ${tdDestBadge(r.destination_type)}
        ${r.destination_name ? `<br><small style="color:var(--color-text-muted)">${escapeHtml(r.destination_name)}</small>` : ''}
      </td>
      <td>${tdFmtQty(r.quantity, r.unit)}</td>
      <td>${tdFmtTemp(r.temperature_at_dispatch)}</td>
      <td>${r.responsible_person ? escapeHtml(r.responsible_person) : '<span style="color:var(--color-text-muted)">—</span>'}</td>
      <td>
        <button class="btn btn-sm td-btn-edit" data-id="${r.id}" title="Modifier" style="margin-right:4px">
          <i data-lucide="pencil" style="width:14px;height:14px"></i>
        </button>
        <button class="btn btn-sm btn-danger td-btn-delete" data-id="${r.id}" title="Supprimer">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function tdModalHtml(item) {
  const isEdit = !!item;
  const v = item || {};
  return `
    <div class="modal-overlay active" id="td-modal">
      <div class="modal" style="max-width:580px;width:95vw">
        <div class="modal-header">
          <h3><i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}" style="width:18px;height:18px;vertical-align:middle;margin-right:6px"></i>${isEdit ? 'Modifier l\'expédition' : 'Nouvelle expédition'}</h3>
          <button class="modal-close" id="td-modal-close">
            <i data-lucide="x" style="width:18px;height:18px"></i>
          </button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label">Produit <span style="color:var(--color-danger)">*</span></label>
              <input type="text" class="form-control" id="td-product-name" value="${escapeHtml(v.product_name || '')}" placeholder="Ex: Blanquette de veau" required>
            </div>
            <div class="form-group">
              <label class="form-label">N° de lot</label>
              <input type="text" class="form-control" id="td-batch-number" value="${escapeHtml(v.batch_number || '')}" placeholder="Ex: BV-2026-04-13-001">
            </div>
            <div class="form-group">
              <label class="form-label">Date de fabrication</label>
              <input type="date" class="form-control" id="td-production-date" lang="fr" value="${v.production_date || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Type de destination</label>
              <select class="form-control" id="td-destination-type">
                <option value="">— Choisir —</option>
                <option value="salle" ${v.destination_type === 'salle' ? 'selected' : ''}>Salle</option>
                <option value="livraison" ${v.destination_type === 'livraison' ? 'selected' : ''}>Livraison</option>
                <option value="traiteur" ${v.destination_type === 'traiteur' ? 'selected' : ''}>Traiteur</option>
                <option value="autre" ${v.destination_type === 'autre' ? 'selected' : ''}>Autre</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nom de la destination</label>
              <input type="text" class="form-control" id="td-destination-name" value="${escapeHtml(v.destination_name || '')}" placeholder="Ex: Salle principale">
            </div>
            <div class="form-group">
              <label class="form-label">Quantité</label>
              <input type="number" class="form-control" id="td-quantity" value="${v.quantity != null ? v.quantity : ''}" step="0.1" min="0" placeholder="0.0">
            </div>
            <div class="form-group">
              <label class="form-label">Unité</label>
              <select class="form-control" id="td-unit">
                <option value="kg" ${(v.unit || 'kg') === 'kg' ? 'selected' : ''}>kg</option>
                <option value="L" ${v.unit === 'L' ? 'selected' : ''}>L</option>
                <option value="portion" ${v.unit === 'portion' ? 'selected' : ''}>portion(s)</option>
                <option value="pièce" ${v.unit === 'pièce' ? 'selected' : ''}>pièce(s)</option>
                <option value="g" ${v.unit === 'g' ? 'selected' : ''}>g</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date d'expédition</label>
              <input type="date" class="form-control" id="td-dispatch-date" lang="fr" value="${v.dispatch_date || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Heure d'expédition</label>
              <input type="time" class="form-control" id="td-dispatch-time" value="${v.dispatch_time || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Température au départ (°C)</label>
              <input type="number" class="form-control" id="td-temperature" value="${v.temperature_at_dispatch != null ? v.temperature_at_dispatch : ''}" step="0.1" placeholder="Ex: 4.0">
            </div>
            <div class="form-group">
              <label class="form-label">Responsable</label>
              <input type="text" class="form-control" id="td-responsible" value="${escapeHtml(v.responsible_person || '')}" placeholder="Ex: Marie Dupont">
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label class="form-label">Notes</label>
              <textarea class="form-control" id="td-notes" rows="3" placeholder="Observations, remarques...">${escapeHtml(v.notes || '')}</textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:var(--space-4);border-top:1px solid var(--color-border)">
          <button class="btn btn-secondary" id="td-modal-cancel">Annuler</button>
          <button class="btn btn-primary" id="td-modal-save">
            <i data-lucide="${isEdit ? 'save' : 'plus'}" style="width:16px;height:16px"></i>
            ${isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  `;
}

async function renderTraceabilityDownstream() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  let allItems = [];
  let filteredItems = [];
  let searchHighlightBatch = null;

  async function loadItems(params = {}) {
    const qs = new URLSearchParams();
    if (params.batch) qs.set('batch', params.batch);
    if (params.product) qs.set('product', params.product);
    if (params.date) qs.set('date', params.date);
    const resp = await API.request('/traceability/downstream' + (qs.toString() ? '?' + qs.toString() : ''));
    return resp.items || [];
  }

  try {
    allItems = await loadItems();
    filteredItems = allItems;
  } catch (e) {
    app.innerHTML = `<div class="error-state"><p>Erreur lors du chargement : ${escapeHtml(e.message)}</p></div>`;
    return;
  }

  function computeKPIs(items) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const thisMonth = items.filter(i => i.dispatch_date && i.dispatch_date >= monthStart).length;
    const uniqueDests = new Set(items.filter(i => i.destination_name).map(i => i.destination_name)).size;
    return { thisMonth, uniqueDests };
  }

  function renderPage(items, highlightBatch) {
    const kpis = computeKPIs(allItems);

    app.innerHTML = `
      <div class="haccp-page">
        <div class="page-header">
          <h1><i data-lucide="package-check" style="width:22px;height:22px;vertical-align:middle;margin-right:8px;color:var(--color-primary)"></i>Traçabilité aval</h1>
          <button class="btn btn-primary" id="td-btn-new">
            <i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle expédition
          </button>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:var(--space-5)">
          <div class="kpi-card">
            <div class="kpi-value">${kpis.thisMonth}</div>
            <div class="kpi-label">Expéditions ce mois</div>
          </div>
          <div class="kpi-card kpi-card--info">
            <div class="kpi-value">${kpis.uniqueDests}</div>
            <div class="kpi-label">Destinations uniques</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${allItems.length}</div>
            <div class="kpi-label">Total enregistrements</div>
          </div>
        </div>

        <!-- Recherche par lot -->
        <div style="background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:var(--radius-2);padding:var(--space-4);margin-bottom:var(--space-4)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--space-2)">
            <i data-lucide="search" style="width:16px;height:16px;color:var(--color-primary)"></i>
            <strong style="font-size:0.9rem">Recherche par numéro de lot</strong>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" class="form-control" id="td-search-batch" placeholder="Ex: BV-2026-04-13-001" value="${escapeHtml(searchHighlightBatch || '')}" style="max-width:320px">
            <button class="btn btn-primary" id="td-search-btn">
              <i data-lucide="search" style="width:15px;height:15px"></i> Rechercher
            </button>
            ${highlightBatch ? `<button class="btn btn-secondary" id="td-search-clear"><i data-lucide="x" style="width:15px;height:15px"></i> Effacer</button>` : ''}
          </div>
          ${highlightBatch ? `<p style="margin-top:var(--space-2);color:var(--color-primary);font-size:0.85rem">
            <i data-lucide="info" style="width:13px;height:13px;vertical-align:middle"></i>
            ${items.length} résultat(s) pour le lot <strong>"${escapeHtml(highlightBatch)}"</strong>
          </p>` : ''}
        </div>

        <!-- Filtres -->
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4);align-items:flex-end">
          <div class="form-group" style="margin:0;min-width:180px">
            <label class="form-label" style="margin-bottom:4px">Destination</label>
            <select class="form-control" id="td-filter-dest" style="font-size:0.85rem">
              <option value="">Tous types</option>
              <option value="salle">Salle</option>
              <option value="livraison">Livraison</option>
              <option value="traiteur">Traiteur</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="margin-bottom:4px">Produit</label>
            <input type="text" class="form-control" id="td-filter-product" placeholder="Nom du produit" style="font-size:0.85rem;max-width:220px">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="margin-bottom:4px">Du</label>
            <input type="date" class="form-control" id="td-filter-from" lang="fr" style="font-size:0.85rem">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="margin-bottom:4px">Au</label>
            <input type="date" class="form-control" id="td-filter-to" lang="fr" style="font-size:0.85rem">
          </div>
          <button class="btn btn-secondary" id="td-filter-apply" style="align-self:flex-end">
            <i data-lucide="filter" style="width:15px;height:15px"></i> Filtrer
          </button>
          <button class="btn btn-secondary" id="td-filter-reset" style="align-self:flex-end">
            <i data-lucide="rotate-ccw" style="width:15px;height:15px"></i> Réinitialiser
          </button>
        </div>

        <!-- Tableau -->
        <div class="table-container">
          <table>
            <thead><tr>
              <th>Date / Heure</th>
              <th>Produit</th>
              <th>N° Lot</th>
              <th>Destination</th>
              <th>Quantité</th>
              <th>Temp.</th>
              <th>Responsable</th>
              <th style="width:80px">Actions</th>
            </tr></thead>
            <tbody id="td-tbody">
              ${renderTDRows(items)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Event: new
    document.getElementById('td-btn-new').addEventListener('click', () => openModal(null));

    // Event: search by batch
    document.getElementById('td-search-btn').addEventListener('click', async () => {
      const batch = document.getElementById('td-search-batch').value.trim();
      if (!batch) { refreshList(); return; }
      try {
        const resp = await API.request(`/traceability/downstream/search?batch=${encodeURIComponent(batch)}`);
        const found = resp.items || [];
        searchHighlightBatch = batch;
        renderPage(found, batch);
      } catch (e) {
        alert('Erreur lors de la recherche : ' + e.message);
      }
    });

    // Enter key for search
    document.getElementById('td-search-batch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('td-search-btn').click();
    });

    // Clear search
    const clearBtn = document.getElementById('td-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchHighlightBatch = null;
        refreshList();
      });
    }

    // Event: filter apply
    document.getElementById('td-filter-apply').addEventListener('click', applyFilters);

    // Event: filter reset
    document.getElementById('td-filter-reset').addEventListener('click', () => {
      document.getElementById('td-filter-dest').value = '';
      document.getElementById('td-filter-product').value = '';
      document.getElementById('td-filter-from').value = '';
      document.getElementById('td-filter-to').value = '';
      searchHighlightBatch = null;
      refreshList();
    });

    // Event: row actions
    document.getElementById('td-tbody').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.td-btn-edit');
      const deleteBtn = e.target.closest('.td-btn-delete');
      if (editBtn) {
        e.stopPropagation();
        const id = parseInt(editBtn.dataset.id);
        const item = allItems.find(r => r.id === id) || filteredItems.find(r => r.id === id);
        if (item) openModal(item);
      } else if (deleteBtn) {
        e.stopPropagation();
        const id = parseInt(deleteBtn.dataset.id);
        confirmDelete(id);
      }
    });
  }

  async function applyFilters() {
    const destType = document.getElementById('td-filter-dest').value;
    const product  = document.getElementById('td-filter-product').value.trim();
    const from     = document.getElementById('td-filter-from').value;
    const to       = document.getElementById('td-filter-to').value;

    let items = allItems;
    if (destType) items = items.filter(i => i.destination_type === destType);
    if (product) items = items.filter(i => i.product_name && i.product_name.toLowerCase().includes(product.toLowerCase()));
    if (from) items = items.filter(i => i.dispatch_date && i.dispatch_date >= from);
    if (to) items = items.filter(i => i.dispatch_date && i.dispatch_date <= to);

    filteredItems = items;
    const tbody = document.getElementById('td-tbody');
    if (tbody) {
      tbody.innerHTML = renderTDRows(items);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  async function refreshList() {
    try {
      allItems = await loadItems();
      filteredItems = allItems;
      renderPage(allItems, null);
    } catch (e) {
      console.error('refreshList error:', e);
    }
  }

  function openModal(item) {
    const existing = document.getElementById('td-modal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', tdModalHtml(item));
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const modal = document.getElementById('td-modal');
    const closeModal = () => modal.remove();

    document.getElementById('td-modal-close').addEventListener('click', closeModal);
    document.getElementById('td-modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.getElementById('td-modal-save').addEventListener('click', async () => {
      const productName = document.getElementById('td-product-name').value.trim();
      if (!productName) {
        document.getElementById('td-product-name').focus();
        document.getElementById('td-product-name').style.borderColor = 'var(--color-danger)';
        return;
      }

      const payload = {
        product_name:            productName,
        batch_number:            document.getElementById('td-batch-number').value.trim() || null,
        production_date:         document.getElementById('td-production-date').value || null,
        destination_type:        document.getElementById('td-destination-type').value || null,
        destination_name:        document.getElementById('td-destination-name').value.trim() || null,
        quantity:                document.getElementById('td-quantity').value !== '' ? parseFloat(document.getElementById('td-quantity').value) : null,
        unit:                    document.getElementById('td-unit').value || 'kg',
        dispatch_date:           document.getElementById('td-dispatch-date').value || null,
        dispatch_time:           document.getElementById('td-dispatch-time').value || null,
        temperature_at_dispatch: document.getElementById('td-temperature').value !== '' ? parseFloat(document.getElementById('td-temperature').value) : null,
        responsible_person:      document.getElementById('td-responsible').value.trim() || null,
        notes:                   document.getElementById('td-notes').value.trim() || null,
      };

      const saveBtn = document.getElementById('td-modal-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Enregistrement…';

      try {
        if (item) {
          await API.request(`/traceability/downstream/${item.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await API.request('/traceability/downstream', { method: 'POST', body: JSON.stringify(payload) });
        }
        closeModal();
        await refreshList();
      } catch (e) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="save" style="width:16px;height:16px"></i> Enregistrer`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        alert('Erreur : ' + e.message);
      }
    });
  }

  async function confirmDelete(id) {
    const item = allItems.find(r => r.id === id) || filteredItems.find(r => r.id === id);
    const name = item ? item.product_name : `#${id}`;
    if (!confirm(`Supprimer l'expédition "${name}" ?\nCette action est irréversible.`)) return;
    try {
      await API.request(`/traceability/downstream/${id}`, { method: 'DELETE' });
      await refreshList();
    } catch (e) {
      alert('Erreur lors de la suppression : ' + e.message);
    }
  }

  renderPage(allItems, null);
}
