// ═══════════════════════════════════════════
// Import Mercuriale — Scan et import de listes de prix fournisseur
// ═══════════════════════════════════════════

let _mercurialeData = null;

async function renderImportMercuriale() {
  const app = document.getElementById('app');
  _mercurialeData = null;

  app.innerHTML = `
    <div class="view-header">
      <a href="#/mercuriale" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-2);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Mercuriale
      </a>
      <h1><i data-lucide="camera" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Import mercuriale IA</h1>
      <p class="text-secondary">Scannez une liste de prix fournisseur et mettez à jour vos prix automatiquement</p>
    </div>

    <div id="merc-upload-section">
      <div style="border:2px dashed var(--border-color);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;background:var(--bg-sunken);cursor:pointer" id="merc-drop-zone">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">📄</div>
        <h3 style="margin-bottom:var(--space-2)">Glissez votre mercuriale ici</h3>
        <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-3)">
          Photo, PDF ou scan de la liste de prix fournisseur
        </p>
        <label class="btn btn-primary" style="cursor:pointer">
          <i data-lucide="camera" style="width:16px;height:16px"></i> Choisir un fichier
          <input type="file" id="merc-file-input" accept="image/*,application/pdf" capture="environment" style="display:none">
        </label>
        <p style="color:var(--text-tertiary);font-size:var(--text-xs);margin-top:var(--space-2)">JPG, PNG ou PDF — max 10 Mo</p>
      </div>
    </div>

    <div id="merc-preview" class="hidden" style="margin-top:var(--space-4)">
      <img id="merc-preview-img" style="max-width:100%;max-height:300px;border-radius:var(--radius-md);border:1px solid var(--border-light)" alt="">
    </div>

    <div id="merc-processing" class="hidden" style="text-align:center;padding:var(--space-8)">
      <div class="spinner" style="margin:0 auto var(--space-3)"></div>
      <h3>Analyse en cours…</h3>
      <p class="text-secondary">L'IA extrait les prix de votre mercuriale</p>
    </div>

    <div id="merc-results" class="hidden"></div>
  `;
  if (window.lucide) lucide.createIcons();

  const fileInput = document.getElementById('merc-file-input');
  const dropZone = document.getElementById('merc-drop-zone');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleMercurialeFile(e.target.files[0]);
  });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--color-accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    if (e.dataTransfer.files[0]) handleMercurialeFile(e.dataTransfer.files[0]);
  });
}

async function handleMercurialeFile(file) {
  // Show preview for images
  if (file.type.startsWith('image/')) {
    const preview = document.getElementById('merc-preview');
    const img = document.getElementById('merc-preview-img');
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; preview.classList.remove('hidden'); };
    reader.readAsDataURL(file);
  }

  document.getElementById('merc-upload-section').classList.add('hidden');
  document.getElementById('merc-processing').classList.remove('hidden');

  try {
    const data = await API.scanMercuriale(file);
    _mercurialeData = data;
    document.getElementById('merc-processing').classList.add('hidden');
    renderMercurialeResults(data);
  } catch (e) {
    document.getElementById('merc-processing').classList.add('hidden');
    document.getElementById('merc-upload-section').classList.remove('hidden');
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function renderMercurialeResults(data) {
  const el = document.getElementById('merc-results');
  el.classList.remove('hidden');

  // Load suppliers for the dropdown
  let suppliers = [];
  try { suppliers = await API.getSuppliers(); } catch {}

  const supplierOptions = suppliers.map(s =>
    `<option value="${s.id}" ${data.supplier_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  el.innerHTML = `
    <!-- Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-accent)">${data.summary.total_items}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Produits détectés</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-success)">${data.summary.matched_items}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Correspondances</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-warning)">${data.summary.unmatched_items}</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Non reconnus</div>
      </div>
      <div class="card" style="padding:var(--space-3);text-align:center">
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.match_rate}%</div>
        <div style="font-size:var(--text-xs);color:var(--text-tertiary)">Taux de correspondance</div>
      </div>
    </div>

    <!-- Supplier selector -->
    <div style="display:flex;gap:var(--space-3);align-items:flex-end;margin-bottom:var(--space-4);flex-wrap:wrap">
      <div class="form-group" style="margin:0;flex:1;min-width:200px">
        <label class="form-label">Fournisseur</label>
        <select class="input" id="merc-supplier-select" data-ui="custom">
          <option value="">— Sélectionner un fournisseur —</option>
          ${supplierOptions}
        </select>
      </div>
      ${data.supplier_name ? `<div style="font-size:var(--text-sm);color:var(--text-secondary);padding-bottom:8px">Détecté : <strong>${escapeHtml(data.supplier_name)}</strong></div>` : ''}
      ${data.date ? `<div style="font-size:var(--text-sm);color:var(--text-secondary);padding-bottom:8px">Date : ${new Date(data.date).toLocaleDateString('fr-FR')}</div>` : ''}
    </div>

    <!-- Items table -->
    <div class="table-container" style="margin-bottom:var(--space-4)">
      <table>
        <thead>
          <tr>
            <th style="width:30px"><input type="checkbox" id="merc-check-all" checked data-ui="custom"></th>
            <th>Produit (mercuriale)</th>
            <th>Correspondance</th>
            <th class="numeric">Prix</th>
            <th>Unité</th>
            <th>Catégorie</th>
          </tr>
        </thead>
        <tbody id="merc-items-body">
          ${(data.items || []).map((item, i) => {
            const matched = item.ingredient_id ? true : false;
            const confidence = item.match_confidence === 'exact' ? '✅' : item.match_confidence === 'fuzzy' ? '🔶' : '❌';
            return `
              <tr style="${!matched ? 'opacity:0.6' : ''}">
                <td><input type="checkbox" class="merc-item-cb" data-idx="${i}" ${matched ? 'checked' : ''} data-ui="custom"></td>
                <td style="font-weight:500">${escapeHtml(item.product_name || '—')}
                  ${item.organic ? '<span style="color:var(--color-success);font-size:11px"> 🌿 Bio</span>' : ''}
                </td>
                <td>
                  ${matched ? `<span style="color:var(--color-success)">${confidence} ${escapeHtml(item.matched_ingredient)}</span>` :
                    `<span style="color:var(--text-tertiary)">Non reconnu</span>`}
                </td>
                <td class="numeric mono" style="font-weight:600">${item.price != null ? formatCurrency(item.price) : '—'}</td>
                <td>${escapeHtml(item.unit || '—')}</td>
                <td style="font-size:var(--text-xs);color:var(--text-secondary)">${escapeHtml(item.category || '—')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:var(--space-3);justify-content:flex-end;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="renderImportMercuriale()">
        <i data-lucide="refresh-cw" style="width:16px;height:16px"></i> Nouveau scan
      </button>
      <button class="btn btn-primary" id="merc-import-btn" style="min-width:200px">
        <i data-lucide="download" style="width:16px;height:16px"></i> Importer les prix sélectionnés
      </button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  // Check all / uncheck all
  document.getElementById('merc-check-all').addEventListener('change', (e) => {
    document.querySelectorAll('.merc-item-cb').forEach(cb => cb.checked = e.target.checked);
  });

  // Import button
  document.getElementById('merc-import-btn').addEventListener('click', importMercurialeItems);
}

async function importMercurialeItems() {
  const supplierId = document.getElementById('merc-supplier-select').value;
  if (!supplierId) {
    showToast('Sélectionnez un fournisseur', 'error');
    return;
  }

  const checkedIdxs = [];
  document.querySelectorAll('.merc-item-cb:checked').forEach(cb => checkedIdxs.push(parseInt(cb.dataset.idx)));

  if (checkedIdxs.length === 0) {
    showToast('Sélectionnez au moins un produit', 'error');
    return;
  }

  const items = checkedIdxs
    .map(i => _mercurialeData.items[i])
    .filter(item => item.ingredient_id && item.price > 0)
    .map(item => ({
      ingredient_id: item.ingredient_id,
      price: item.price,
      unit: item.unit || 'kg'
    }));

  if (items.length === 0) {
    showToast('Aucun produit reconnu dans la sélection', 'error');
    return;
  }

  try {
    const result = await API.importMercuriale({ supplier_id: Number(supplierId), items });
    showToast(`Import réussi : ${result.updated} mis à jour, ${result.created} nouveaux prix`, 'success');

    // Show result summary
    const el = document.getElementById('merc-results');
    el.innerHTML = `
      <div style="text-align:center;padding:var(--space-8)">
        <div style="font-size:3rem;margin-bottom:var(--space-3)">✅</div>
        <h2>Import terminé</h2>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-4)">
          <strong>${result.updated}</strong> prix mis à jour ·
          <strong>${result.created}</strong> nouveaux prix ·
          <strong>${result.skipped}</strong> ignorés
        </p>
        <div style="display:flex;gap:var(--space-3);justify-content:center">
          <button class="btn btn-primary" onclick="renderImportMercuriale()">Nouveau scan</button>
          <a href="#/mercuriale" class="btn btn-secondary">Voir la mercuriale</a>
        </div>
      </div>
    `;
  } catch (e) {
    showToast('Erreur import : ' + e.message, 'error');
  }
}
