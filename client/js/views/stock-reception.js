// ═══════════════════════════════════════════
// Stock Reception — #/stock/reception
// ═══════════════════════════════════════════

async function renderStockReception() {
  const app = document.getElementById('app');
  const account = getAccount();

  let suppliers = [], ingredients = [];
  try {
    const results = await Promise.all([
      API.getSuppliers(),
      API.getIngredients()
    ]);
    suppliers = results[0];
    const ingredientsResponse = results[1];
    ingredients = ingredientsResponse.ingredients || [];
  } catch (e) {
    app.innerHTML = `<div class="empty-state"><p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p></div>`;
    return;
  }

  app.innerHTML = `
    <nav aria-label="Breadcrumb" class="breadcrumb">
      <a href="#/stock">Stock</a>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-current">Réception</span>
    </nav>
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <a href="#/stock" style="color:var(--text-secondary);text-decoration:none;font-size:1.5rem">←</a>
        <div>
          <h1><i data-lucide="download" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Réception marchandise</h1>
          <p class="text-secondary">Enregistrez la réception d'une commande</p>
        </div>
      </div>
    </div>

    <div class="reception-form" style="margin-bottom:var(--space-5)">
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label">Fournisseur</label>
        <select id="rec-supplier" class="input">
          <option value="">— Sélectionner un fournisseur —</option>
          ${suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>

      <div id="reception-lines">
        <!-- Lines will be added here -->
      </div>

      <button class="btn btn-secondary" id="add-line-btn" style="width:100%;margin-bottom:var(--space-5)">
        + Ajouter un produit
      </button>

      <button class="btn btn-accent btn-lg" id="validate-reception-btn" style="width:100%" disabled>
        ✅ Valider la réception
      </button>
    </div>
  `;

  const linesContainer = document.getElementById('reception-lines');
  let lineCount = 0;

  function addLine() {
    lineCount++;
    const lineEl = document.createElement('div');
    lineEl.className = 'reception-line';
    lineEl.dataset.lineId = lineCount;
    lineEl.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3);position:relative';

    lineEl.innerHTML = `
      <button class="remove-line-btn" style="position:absolute;top:var(--space-2);right:var(--space-2);background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:1.2rem;padding:var(--space-1)" title="Supprimer">✕</button>
      <div style="font-weight:600;margin-bottom:var(--space-3);color:var(--text-secondary);font-size:var(--text-sm)">Produit #${lineCount}</div>
      <div class="form-group" style="margin-bottom:var(--space-3)">
        <label class="form-label">Ingrédient *</label>
        <div style="position:relative">
          <input type="text" class="input line-ingredient-search" placeholder="Rechercher un ingrédient..." autocomplete="off">
          <input type="hidden" class="line-ingredient-id">
          <div class="autocomplete-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-md);max-height:200px;overflow-y:auto;z-index:10"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 80px;gap:var(--space-2);margin-bottom:var(--space-3)">
        <div class="form-group">
          <label class="form-label">Quantité *</label>
          <input type="number" class="input line-qty" step="0.01" min="0.01" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Unité</label>
          <input type="text" class="input line-unit" value="kg">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:var(--space-3)">
        <div class="form-group">
          <label class="form-label">Prix unitaire (€)</label>
          <input type="number" class="input line-price" step="0.01" min="0" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">N° de lot</label>
          <input type="text" class="input line-batch" placeholder="Optionnel">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-bottom:var(--space-3)">
        <div class="form-group">
          <label class="form-label">DLC</label>
          <input type="date" class="input line-dlc">
        </div>
        <div class="form-group">
          <label class="form-label">T° réception (°C)</label>
          <input type="number" class="input line-temp" step="0.1" placeholder="Ex: 3.5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" class="input line-notes" placeholder="Remarques éventuelles">
      </div>
    `;

    linesContainer.appendChild(lineEl);

    // Remove line
    lineEl.querySelector('.remove-line-btn').addEventListener('click', () => {
      lineEl.remove();
      updateValidateBtn();
    });

    // Autocomplete
    const searchInput = lineEl.querySelector('.line-ingredient-search');
    const hiddenId = lineEl.querySelector('.line-ingredient-id');
    const dropdown = lineEl.querySelector('.autocomplete-dropdown');
    const unitInput = lineEl.querySelector('.line-unit');

    let acTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(acTimeout);
      const val = searchInput.value.trim().toLowerCase();
      if (val.length < 1) { dropdown.style.display = 'none'; return; }
      acTimeout = setTimeout(() => {
        const matches = ingredients.filter(i => i.name.toLowerCase().includes(val)).slice(0, 10);
        if (matches.length === 0) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = matches.map(m => `
          <div class="ac-option" data-id="${m.id}" data-name="${escapeHtml(m.name)}" data-unit="${m.default_unit || 'kg'}"
               style="padding:var(--space-2) var(--space-3);cursor:pointer;border-bottom:1px solid var(--border-light);font-size:var(--text-sm)">
            ${escapeHtml(m.name)} <span style="color:var(--text-tertiary)">(${m.category || '—'})</span>
          </div>
        `).join('');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.ac-option').forEach(opt => {
          opt.addEventListener('click', () => {
            searchInput.value = opt.dataset.name;
            hiddenId.value = opt.dataset.id;
            unitInput.value = opt.dataset.unit;
            dropdown.style.display = 'none';
            updateValidateBtn();
          });
        });
      }, 150);
    });

    searchInput.addEventListener('blur', () => {
      setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    });

    // Update validate button on change
    lineEl.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', updateValidateBtn);
    });

    updateValidateBtn();
    searchInput.focus();
  }

  function updateValidateBtn() {
    const lines = linesContainer.querySelectorAll('.reception-line');
    const btn = document.getElementById('validate-reception-btn');
    let valid = lines.length > 0;
    lines.forEach(line => {
      const ingId = line.querySelector('.line-ingredient-id').value;
      const qty = parseFloat(line.querySelector('.line-qty').value);
      if (!ingId || isNaN(qty) || qty <= 0) valid = false;
    });
    btn.disabled = !valid;
    btn.textContent = lines.length > 0
      ? `✅ Valider la réception (${lines.length} produit${lines.length > 1 ? 's' : ''})`
      : '✅ Valider la réception';
  }

  document.getElementById('add-line-btn').addEventListener('click', addLine);

  document.getElementById('validate-reception-btn').addEventListener('click', async () => {
    const btn = document.getElementById('validate-reception-btn');
    const supplierId = document.getElementById('rec-supplier').value || null;
    const lineEls = linesContainer.querySelectorAll('.reception-line');
    const lines = [];

    lineEls.forEach(el => {
      lines.push({
        ingredient_id: Number(el.querySelector('.line-ingredient-id').value),
        quantity: parseFloat(el.querySelector('.line-qty').value),
        unit: el.querySelector('.line-unit').value || 'kg',
        unit_price: parseFloat(el.querySelector('.line-price').value) || null,
        supplier_id: supplierId ? Number(supplierId) : null,
        batch_number: el.querySelector('.line-batch').value || null,
        dlc: el.querySelector('.line-dlc').value || null,
        temperature: parseFloat(el.querySelector('.line-temp').value) || null,
        notes: el.querySelector('.line-notes').value || null
      });
    });

    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
      await API.postReception({
        lines,
        recorded_by: account ? account.id : null
      });
      showToast(`✅ Réception enregistrée (${lines.length} produit${lines.length > 1 ? 's' : ''})`, 'success');
      location.hash = '#/stock';
    } catch (e) {
      showToast(e.message, 'error');
      btn.disabled = false;
      updateValidateBtn();
    }
  });

  // Add first line automatically
  addLine();
}
