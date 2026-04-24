// ═══════════════════════════════════════════
// HACCP Réception manuelle — #/haccp/reception
// ═══════════════════════════════════════════

async function renderHACCPReception() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  let suppliers = [];
  try {
    suppliers = await API.getSuppliers();
  } catch(e) { /* non-fatal */ }

  const CATEGORIES = [
    { value: '', label: '— Catégorie produit —' },
    { value: 'viande', label: 'Viande fraîche' },
    { value: 'volaille', label: 'Volaille' },
    { value: 'poisson', label: 'Poisson / Fruits de mer' },
    { value: 'surgele', label: 'Surgelé' },
    { value: 'laitier', label: 'Produit laitier' },
    { value: 'ovo', label: 'Ovoproduit' },
    { value: 'charcuterie', label: 'Charcuterie' },
    { value: 'traiteur', label: 'Plat traiteur' },
    { value: 'legume', label: 'Légume / Fruit frais' },
    { value: 'sec', label: 'Épicerie sèche' },
    { value: 'autre', label: 'Autre' },
  ];

  app.innerHTML = `
    <section role="region" aria-label="Réception marchandise HACCP">
      <nav aria-label="Breadcrumb" class="breadcrumb">
        <a href="#/haccp">HACCP</a>
        <span class="breadcrumb-sep" aria-hidden="true">›</span>
        <span class="breadcrumb-current">Réception manuelle</span>
      </nav>
      <div class="view-header">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          <a href="#/haccp" aria-label="Retour HACCP" style="color:var(--text-secondary);text-decoration:none;font-size:1.5rem">←</a>
          <div>
            <h1><i data-lucide="package-check" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>Réception marchandise</h1>
            <p class="text-secondary">Saisie manuelle CCP1 — contrôle température à réception</p>
          </div>
        </div>
      </div>

      <form id="reception-form" onsubmit="return false;" style="max-width:720px">
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
          <div class="form-group">
            <label class="form-label" for="rec-supplier">Fournisseur</label>
            <select id="rec-supplier" class="input" aria-required="true">
              <option value="">— Sélectionner —</option>
              ${suppliers.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="rec-bl">N° bon de livraison</label>
            <input type="text" id="rec-bl" class="input" placeholder="BL-2024-001" autocomplete="off">
          </div>
        </div>

        <div style="margin-bottom:var(--space-4)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
            <label class="form-label" style="margin:0">Produits reçus</label>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-product" aria-label="Ajouter un produit">
              <i data-lucide="plus" style="width:16px;height:16px" aria-hidden="true"></i> Ajouter produit
            </button>
          </div>
          <div id="products-list" role="list" aria-label="Liste des produits"></div>
        </div>

        <div class="form-group" style="margin-bottom:var(--space-4)">
          <label class="form-label" for="rec-notes">Observations générales</label>
          <textarea id="rec-notes" class="input" rows="3" placeholder="Emballages intacts, températures conformes…" style="resize:vertical"></textarea>
        </div>

        <button type="button" class="btn btn-accent btn-lg" id="btn-submit-reception" style="width:100%" disabled>
          <i data-lucide="check-circle" style="width:18px;height:18px;margin-right:6px" aria-hidden="true"></i>
          Valider la réception
        </button>
      </form>

      <div style="margin-top:var(--space-6);max-width:720px">
        <h2 style="font-size:var(--text-base);margin-bottom:var(--space-3)">Réceptions récentes</h2>
        <div id="reception-history"></div>
      </div>
    </section>
  `;

  if (window.lucide) lucide.createIcons({ nodes: [app] });

  let productCount = 0;

  function addProductRow() {
    productCount++;
    const id = productCount;
    const row = document.createElement('div');
    row.className = 'reception-product-row';
    row.dataset.id = id;
    row.setAttribute('role', 'listitem');
    row.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-2);position:relative';
    row.innerHTML = `
      <button type="button" class="btn-remove-product" data-id="${id}" aria-label="Supprimer ce produit"
        style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--text-tertiary);font-size:18px;line-height:1;padding:4px">×</button>
      <div style="display:grid;grid-template-columns:2fr 1fr 80px 100px;gap:var(--space-2);margin-bottom:var(--space-2)">
        <div class="form-group" style="margin:0">
          <label class="form-label" for="prod-name-${id}" style="font-size:11px">Désignation *</label>
          <input type="text" id="prod-name-${id}" class="input prod-name" placeholder="Ex: Escalope de poulet" required autocomplete="off" style="font-size:var(--text-sm)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" for="prod-qty-${id}" style="font-size:11px">Quantité</label>
          <input type="number" id="prod-qty-${id}" class="input prod-qty" placeholder="5" min="0" step="any" style="font-size:var(--text-sm)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" for="prod-unit-${id}" style="font-size:11px">Unité</label>
          <select id="prod-unit-${id}" class="input prod-unit" style="font-size:var(--text-sm)">
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="l">L</option>
            <option value="pcs">pcs</option>
            <option value="bte">bte</option>
            <option value="carton">carton</option>
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" for="prod-temp-${id}" style="font-size:11px">Temp. (°C) *</label>
          <input type="number" id="prod-temp-${id}" class="input prod-temp" placeholder="4" step="0.1" style="font-size:var(--text-sm)">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-2)">
        <div class="form-group" style="margin:0">
          <label class="form-label" for="prod-cat-${id}" style="font-size:11px">Catégorie</label>
          <select id="prod-cat-${id}" class="input prod-cat" style="font-size:var(--text-sm)">
            ${CATEGORIES.map(c => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" for="prod-lot-${id}" style="font-size:11px">N° lot</label>
          <input type="text" id="prod-lot-${id}" class="input prod-lot" placeholder="LOT-240001" autocomplete="off" style="font-size:var(--text-sm)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label" for="prod-dlc-${id}" style="font-size:11px">DLC / DDM</label>
          <input type="date" id="prod-dlc-${id}" class="input prod-dlc" lang="fr" style="font-size:var(--text-sm)">
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-2)">
        <label style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;font-size:var(--text-sm)">
          <input type="checkbox" id="prod-conform-${id}" class="prod-conform" checked style="width:18px;height:18px;cursor:pointer" aria-label="Produit conforme">
          <span>Conforme</span>
        </label>
        <span id="prod-temp-badge-${id}" class="badge" style="font-size:11px"></span>
      </div>
    `;
    document.getElementById('products-list').appendChild(row);

    const tempInput = row.querySelector('.prod-temp');
    const badge = row.querySelector(`#prod-temp-badge-${id}`);
    tempInput.addEventListener('input', () => {
      const v = parseFloat(tempInput.value);
      if (isNaN(v)) { badge.textContent = ''; badge.className = 'badge'; return; }
      if (v <= 4) { badge.textContent = `${v}°C ✓`; badge.className = 'badge badge--success'; }
      else if (v <= 8) { badge.textContent = `${v}°C ⚠️`; badge.className = 'badge badge--warning'; }
      else { badge.textContent = `${v}°C ✗`; badge.className = 'badge badge--danger'; }
    });

    row.querySelector('.btn-remove-product').addEventListener('click', () => {
      row.remove();
      updateSubmitState();
    });

    updateSubmitState();
  }

  function updateSubmitState() {
    const hasProducts = document.querySelectorAll('#products-list .reception-product-row').length > 0;
    document.getElementById('btn-submit-reception').disabled = !hasProducts;
  }

  document.getElementById('btn-add-product').addEventListener('click', addProductRow);
  addProductRow();

  document.getElementById('btn-submit-reception').addEventListener('click', async () => {
    const supplier = document.getElementById('rec-supplier').value.trim();
    const bl = document.getElementById('rec-bl').value.trim();
    const notes = document.getElementById('rec-notes').value.trim();
    const rows = document.querySelectorAll('#products-list .reception-product-row');
    if (!rows.length) { showToast('Ajoutez au moins un produit', 'error'); return; }

    const btn = document.getElementById('btn-submit-reception');
    btn.disabled = true; btn.textContent = 'Enregistrement…';

    const account = getAccount();
    let errors = 0;

    for (const row of rows) {
      const id = row.dataset.id;
      const name = row.querySelector('.prod-name').value.trim();
      const temp = parseFloat(row.querySelector('.prod-temp').value);
      if (!name) { errors++; continue; }

      const payload = {
        product_name: name,
        supplier: supplier || null,
        batch_number: row.querySelector('.prod-lot').value.trim() || null,
        dlc: row.querySelector('.prod-dlc').value || null,
        temperature_at_reception: isNaN(temp) ? null : temp,
        quantity: parseFloat(row.querySelector('.prod-qty').value) || null,
        unit: row.querySelector('.prod-unit').value,
        product_category: row.querySelector('.prod-cat').value || null,
        conformite_organoleptique: row.querySelector('.prod-conform').checked ? 1 : 0,
        numero_bl: bl || null,
        received_by: account ? account.name : null,
        notes: notes || null,
      };

      try {
        await API.request('/haccp/traceability-log', { method: 'POST', body: JSON.stringify(payload) });
      } catch(e) {
        errors++;
      }
    }

    if (errors > 0) {
      showToast(`${errors} produit(s) non enregistré(s)`, 'error');
    } else {
      showToast('Réception enregistrée avec succès', 'success');
      document.getElementById('products-list').innerHTML = '';
      productCount = 0;
      document.getElementById('rec-supplier').value = '';
      document.getElementById('rec-bl').value = '';
      document.getElementById('rec-notes').value = '';
      addProductRow();
      loadRecentReceptions();
    }

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check-circle" style="width:18px;height:18px;margin-right:6px" aria-hidden="true"></i>Valider la réception';
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
    updateSubmitState();
  });

  loadRecentReceptions();
}

async function loadRecentReceptions() {
  const container = document.getElementById('reception-history');
  if (!container) return;
  try {
    const logs = await API.request('/haccp/traceability-logs?limit=10');
    if (!logs.length) {
      container.innerHTML = '<p class="text-secondary text-sm">Aucune réception enregistrée.</p>';
      return;
    }
    container.innerHTML = `
      <div class="haccp-receptions-list">
        ${logs.map(r => `
          <div style="background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-2)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <span style="font-weight:600;font-size:var(--text-sm)">${escapeHtml(r.product_name)}</span>
                ${r.supplier ? `<span class="text-secondary" style="font-size:12px;margin-left:8px">${escapeHtml(r.supplier)}</span>` : ''}
              </div>
              <div style="display:flex;gap:var(--space-2);align-items:center">
                ${r.temperature_at_reception != null ? `
                  <span class="badge ${r.temperature_at_reception <= 4 ? 'badge--success' : r.temperature_at_reception <= 8 ? 'badge--warning' : 'badge--danger'}" style="font-size:11px">
                    ${r.temperature_at_reception}°C
                  </span>` : ''}
                <span class="text-secondary" style="font-size:11px">${new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
            ${r.batch_number ? `<div class="text-secondary" style="font-size:11px;margin-top:4px">Lot : ${escapeHtml(r.batch_number)}${r.dlc ? ` · DLC : ${new Date(r.dlc).toLocaleDateString('fr-FR')}` : ''}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch(e) {
    container.innerHTML = '<p class="text-secondary text-sm">Erreur de chargement.</p>';
  }
}
