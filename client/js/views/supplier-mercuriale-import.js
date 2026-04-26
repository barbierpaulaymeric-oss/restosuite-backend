// ═══════════════════════════════════════════
// Supplier Mercuriale Import — drag-drop PDF/XLSX → review → save
//
// Renders inside the supplier portal "Mon catalogue" tab. Two states:
//
//   1. dropzone  — supplier drags or picks a PDF/XLSX. Server extracts items
//                  and tags each as 'new' (green) or 'update' (orange).
//   2. review    — editable table; supplier corrects/deletes rows, hits
//                  "Valider" → /save-mercuriale → toast → back to catalog.
//
// CSP note (feedback_external_css_under_csp.md): styling lives in
// css/style.css under the .mercuriale-import-* prefix. Do NOT inject <style>
// blocks via innerHTML — style-src-elem 'self' drops them silently.
// ═══════════════════════════════════════════

const MERCURIALE_CATEGORIES = [
  'Viandes',
  'Poissons',
  'Légumes',
  'Fruits',
  'Produits laitiers',
  'Épicerie',
  'Boissons',
  'Surgelés',
  'Charcuterie',
  'Condiments',
  'Autre',
];

const CATEGORY_COLORS = {
  'Viandes':           '#C53030',
  'Poissons':          '#3182CE',
  'Légumes':           '#38A169',
  'Fruits':            '#DD6B20',
  'Produits laitiers': '#D69E2E',
  'Épicerie':          '#805AD5',
  'Boissons':          '#319795',
  'Surgelés':          '#4A90D9',
  'Charcuterie':       '#9C4221',
  'Condiments':        '#B7791F',
  'Autre':             '#718096',
};

function categoryBadge(cat) {
  const safe = MERCURIALE_CATEGORIES.includes(cat) ? cat : 'Autre';
  const color = CATEGORY_COLORS[safe] || CATEGORY_COLORS['Autre'];
  return `<span class="mercuriale-cat-badge" style="background:${color}20;color:${color};border-color:${color}">${escapeHtml(safe)}</span>`;
}

function statusBadge(status) {
  if (status === 'new') {
    return `<span class="mercuriale-status mercuriale-status--new">Nouveau</span>`;
  }
  if (status === 'update') {
    return `<span class="mercuriale-status mercuriale-status--update">Mise à jour</span>`;
  }
  return '';
}

function showSupplierMercurialeImport() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  let items = []; // [{ name, category, unit, price, status, existing_id?, existing_price? }]

  function renderDropzone() {
    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
        <button class="btn btn-secondary btn-sm" id="merc-back" aria-label="Revenir au catalogue">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
        </button>
        <h2 style="margin:0;font-size:var(--text-xl)">Importer ma mercuriale</h2>
      </div>

      <p style="color:var(--text-secondary);margin-bottom:var(--space-5)">
        Glissez-déposez votre tarif (PDF ou Excel) ou cliquez pour choisir un fichier.
        Vous pourrez vérifier et corriger les produits avant de valider.
      </p>

      <div class="mercuriale-dropzone" id="merc-dropzone" tabindex="0" role="button" aria-label="Choisir un fichier mercuriale">
        <i data-lucide="upload-cloud" style="width:48px;height:48px;color:#4A90D9"></i>
        <p style="font-weight:600;margin:var(--space-2) 0 0">Déposez votre fichier ici</p>
        <p style="color:var(--text-tertiary);font-size:var(--text-sm);margin:0">
          PDF ou XLSX, jusqu'à 10 Mo
        </p>
        <input type="file" id="merc-file" accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none">
        <button class="btn btn-primary" id="merc-pick" type="button" style="background:#4A90D9;border-color:#4A90D9;margin-top:var(--space-3)">
          <i data-lucide="file-up" style="width:18px;height:18px"></i> Choisir un fichier
        </button>
      </div>

      <div id="merc-error" class="mercuriale-error" style="display:none"></div>
      <div id="merc-loading" class="mercuriale-loading" style="display:none">
        <div class="spinner"></div>
        <p>Analyse du fichier en cours…</p>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    const dz = document.getElementById('merc-dropzone');
    const input = document.getElementById('merc-file');
    const pick = document.getElementById('merc-pick');
    const back = document.getElementById('merc-back');

    back.addEventListener('click', () => renderSupplierCatalogTab());

    pick.addEventListener('click', (e) => {
      e.stopPropagation();
      input.click();
    });
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });

    ['dragenter', 'dragover'].forEach(ev =>
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('mercuriale-dropzone--active');
      })
    );
    ['dragleave', 'drop'].forEach(ev =>
      dz.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('mercuriale-dropzone--active');
      })
    );
    dz.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (file) handleFile(file);
    });
  }

  async function handleFile(file) {
    const errEl = document.getElementById('merc-error');
    const loadingEl = document.getElementById('merc-loading');
    const dzEl = document.getElementById('merc-dropzone');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (file.size > 10 * 1024 * 1024) {
      if (errEl) { errEl.textContent = 'Fichier trop volumineux (max 10 Mo)'; errEl.style.display = 'block'; }
      return;
    }
    if (loadingEl) loadingEl.style.display = 'block';
    if (dzEl) dzEl.style.display = 'none';
    try {
      const result = await API.importSupplierMercuriale(file);
      items = result.items || [];
      if (items.length === 0) {
        if (errEl) {
          errEl.textContent = 'Aucun produit détecté dans ce fichier. Vérifiez le format ou complétez votre catalogue manuellement.';
          errEl.style.display = 'block';
        }
        if (loadingEl) loadingEl.style.display = 'none';
        if (dzEl) dzEl.style.display = '';
        return;
      }
      renderReview(result.summary);
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message || 'Erreur lors de la lecture du fichier';
        errEl.style.display = 'block';
      }
      if (loadingEl) loadingEl.style.display = 'none';
      if (dzEl) dzEl.style.display = '';
    }
  }

  function renderReview(summary) {
    const total = items.length;
    const newCount = items.filter(i => i.status === 'new').length;
    const updCount = items.filter(i => i.status === 'update').length;

    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)">
        <button class="btn btn-secondary btn-sm" id="merc-restart" aria-label="Choisir un autre fichier">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Autre fichier
        </button>
        <h2 style="margin:0;font-size:var(--text-xl)">Vérifier les produits</h2>
      </div>

      <div class="mercuriale-summary">
        <span><strong>${total}</strong> produit${total > 1 ? 's' : ''} détecté${total > 1 ? 's' : ''}</span>
        <span class="mercuriale-status mercuriale-status--new">${newCount} nouveau${newCount > 1 ? 'x' : ''}</span>
        <span class="mercuriale-status mercuriale-status--update">${updCount} mise${updCount > 1 ? 's' : ''} à jour</span>
      </div>

      <div class="mercuriale-table-wrap">
        <table class="mercuriale-table">
          <thead>
            <tr>
              <th>Statut</th>
              <th>Produit</th>
              <th>Catégorie</th>
              <th>Unité</th>
              <th style="text-align:right">Prix HT</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="merc-rows"></tbody>
        </table>
      </div>

      <div class="mercuriale-actions">
        <button class="btn btn-secondary" id="merc-cancel">Annuler</button>
        <button class="btn btn-primary" id="merc-save" style="background:#4A90D9;border-color:#4A90D9">
          <i data-lucide="check" style="width:18px;height:18px"></i> Valider l'import
        </button>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    renderRows();

    document.getElementById('merc-restart').addEventListener('click', renderDropzone);
    document.getElementById('merc-cancel').addEventListener('click', () => renderSupplierCatalogTab());
    document.getElementById('merc-save').addEventListener('click', handleSave);
  }

  function renderRows() {
    const tbody = document.getElementById('merc-rows');
    if (!tbody) return;
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--space-6);color:var(--text-tertiary)">Tous les produits ont été retirés.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map((it, idx) => {
      const dataPrice = (Number(it.price) || 0).toFixed(2);
      return `
      <tr data-idx="${idx}" class="mercuriale-row mercuriale-row--${it.status}">
        <td>${statusBadge(it.status)}</td>
        <td>
          <input type="text" class="mercuriale-input mercuriale-input--name"
                 data-field="name" data-idx="${idx}"
                 value="${escapeHtml(it.name)}" aria-label="Nom du produit">
          ${it.status === 'update' && it.existing_price != null && it.existing_price !== it.price
            ? `<div class="mercuriale-old-price">Ancien prix : ${formatCurrency(it.existing_price)}</div>`
            : ''}
        </td>
        <td>
          <select class="mercuriale-input mercuriale-input--category"
                  data-field="category" data-idx="${idx}" aria-label="Catégorie">
            ${MERCURIALE_CATEGORIES.map(c => `
              <option value="${c}" ${c === it.category ? 'selected' : ''}>${c}</option>
            `).join('')}
          </select>
          ${categoryBadge(it.category)}
        </td>
        <td>
          <input type="text" class="mercuriale-input mercuriale-input--unit"
                 data-field="unit" data-idx="${idx}"
                 value="${escapeHtml(it.unit)}" aria-label="Unité"
                 maxlength="16">
        </td>
        <td style="text-align:right">
          <input type="number" step="0.01" min="0" class="mercuriale-input mercuriale-input--price"
                 data-field="price" data-idx="${idx}"
                 value="${dataPrice}" aria-label="Prix unitaire">
        </td>
        <td style="text-align:center">
          <button class="btn-icon mercuriale-row__delete" data-delete-idx="${idx}" aria-label="Retirer la ligne" title="Retirer">
            <i data-lucide="trash-2" style="width:16px;height:16px"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();

    // Cell editing
    tbody.querySelectorAll('.mercuriale-input').forEach(el => {
      el.addEventListener('input', () => {
        const idx = Number(el.dataset.idx);
        const field = el.dataset.field;
        if (Number.isNaN(idx) || !items[idx]) return;
        if (field === 'price') {
          const v = parseFloat(el.value);
          items[idx].price = Number.isFinite(v) && v >= 0 ? v : 0;
        } else if (field === 'category') {
          items[idx].category = el.value;
          // Repaint just the category badge sibling
          const badgeHost = el.parentElement;
          const oldBadge = badgeHost.querySelector('.mercuriale-cat-badge');
          if (oldBadge) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = categoryBadge(el.value);
            oldBadge.replaceWith(wrapper.firstElementChild);
          }
        } else {
          items[idx][field] = el.value;
        }
      });
    });

    // Row delete
    tbody.querySelectorAll('[data-delete-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.deleteIdx);
        if (Number.isNaN(idx)) return;
        items.splice(idx, 1);
        renderRows();
      });
    });
  }

  async function handleSave() {
    const saveBtn = document.getElementById('merc-save');
    if (!saveBtn) return;

    // Final client-side filter: drop rows with empty name or non-positive price.
    const cleaned = items
      .map(it => ({
        name: String(it.name || '').trim(),
        category: it.category || 'Autre',
        unit: String(it.unit || 'kg').trim() || 'kg',
        price: Number(it.price) || 0,
      }))
      .filter(it => it.name && it.price > 0);

    if (cleaned.length === 0) {
      showToast('Aucun produit valide à enregistrer', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader" style="width:18px;height:18px"></i> Enregistrement…';
    if (window.lucide) lucide.createIcons();

    try {
      const result = await API.saveSupplierMercuriale(cleaned);
      const parts = [];
      if (result.created) parts.push(`${result.created} nouveau${result.created > 1 ? 'x' : ''}`);
      if (result.updated) parts.push(`${result.updated} mise${result.updated > 1 ? 's' : ''} à jour`);
      showToast(`Mercuriale enregistrée : ${parts.join(' · ') || result.total + ' produits'}`, 'success');
      renderSupplierCatalogTab();
    } catch (e) {
      showToast(e.message || 'Erreur enregistrement', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="check" style="width:18px;height:18px"></i> Valider l\'import';
      if (window.lucide) lucide.createIcons();
    }
  }

  renderDropzone();
}
