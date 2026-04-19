// ═══════════════════════════════════════════
// HACCP Label Scan — Scan étiquettes CCP1 réception viande/poisson
// Route: #/haccp/label-scan
// Camera: window.Capacitor.Plugins.Camera (native) | <input type="file"> (browser)
// Photo: compressed to 800px max / JPEG q=0.75 via Canvas API before storage
// ═══════════════════════════════════════════

async function renderHACCPLabelScan() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const { items, total } = await API.getLabelScans();
    app.innerHTML = buildLabelScanPage(items, total);
    lucide.createIcons();
    attachLabelScanEvents();
  } catch (e) {
    console.error('renderHACCPLabelScan error:', e);
    app.innerHTML = `<div class="error-state"><p>Erreur chargement des scans</p></div>`;
  }
}

function buildLabelScanPage(items, total) {
  const CATEGORY_LABELS = {
    viande: 'Viande', volaille: 'Volaille', poisson: 'Poisson',
    charcuterie: 'Charcuterie', fromage: 'Fromage', produit_laitier: 'Produit laitier', autre: 'Autre',
  };

  return `
    <section class="haccp-page" role="region" aria-label="Scan étiquettes HACCP">
      <div class="page-header">
        <h1>
          <i data-lucide="scan-line" style="width:20px;height:20px;vertical-align:middle;margin-right:6px" aria-hidden="true"></i>
          Scan étiquettes
        </h1>
        <button class="btn btn-primary" id="btn-open-scan" aria-label="Scanner une nouvelle étiquette">
          <i data-lucide="camera" style="width:18px;height:18px" aria-hidden="true"></i> Scanner
        </button>
      </div>

      <p class="text-secondary text-sm" style="margin-bottom:1.5rem">
        CCP1 — Réception viande, volaille, poisson. Photographiez l'étiquette pour extraction automatique (Alto) des données de traçabilité.
      </p>

      ${total === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="scan-line" style="width:48px;height:48px;color:var(--text-tertiary)"></i></div>
          <p>Aucun scan enregistré</p>
          <p class="text-secondary text-sm">Utilisez le bouton <strong>Scanner</strong> pour photographier une étiquette produit.</p>
        </div>
      ` : `
        <div class="table-container" role="region" aria-label="Liste des scans étiquettes">
          <table class="data-table" aria-label="Scans étiquettes HACCP">
            <thead>
              <tr>
                <th scope="col">Photo</th>
                <th scope="col">Produit</th>
                <th scope="col">Fournisseur</th>
                <th scope="col">N° Lot</th>
                <th scope="col">DLC/DDM</th>
                <th scope="col">Temp.</th>
                <th scope="col">Catégorie</th>
                <th scope="col">Scanné le</th>
                <th scope="col"><span class="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              ${items.map(scan => buildScanRow(scan, CATEGORY_LABELS)).join('')}
            </tbody>
          </table>
        </div>
      `}

      <!-- Scan modal -->
      <div id="label-scan-modal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="label-scan-modal-title">
        <div class="modal" style="max-width:560px;width:100%">
          <div class="modal-header">
            <h2 id="label-scan-modal-title" class="modal-title">Scanner une étiquette</h2>
            <button class="modal-close" id="btn-close-scan-modal" aria-label="Fermer">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Step 1: Capture -->
            <div id="step-capture">
              <div id="photo-preview-container" style="display:none;margin-bottom:1rem;text-align:center">
                <img id="photo-preview" src="" alt="Aperçu de l'étiquette" style="max-width:100%;max-height:280px;border-radius:var(--radius-md);border:1px solid var(--border-color)">
              </div>
              <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.5rem">
                <button class="btn btn-primary" id="btn-take-photo" type="button">
                  <i data-lucide="camera" style="width:16px;height:16px" aria-hidden="true"></i>
                  <span id="btn-take-photo-label">Prendre une photo</span>
                </button>
                <!-- File input fallback (shown in browser, hidden in native Capacitor) -->
                <label class="btn btn-secondary" id="btn-file-fallback" style="cursor:pointer;display:none">
                  <i data-lucide="upload" style="width:16px;height:16px" aria-hidden="true"></i>
                  Choisir une image
                  <input type="file" id="file-input-fallback" accept="image/*" capture="environment" style="display:none" aria-label="Choisir une image depuis l'appareil">
                </label>
              </div>
              <div id="extract-spinner" style="display:none;text-align:center;padding:1rem">
                <div class="spinner" style="margin:0 auto .75rem"></div>
                <p class="text-secondary text-sm">Extraction Alto en cours…</p>
              </div>
            </div>

            <!-- Step 2: Form (pre-filled by Gemini OCR, user reviews/corrects) -->
            <div id="step-form" style="display:none">
              <p class="text-secondary text-sm" style="margin-bottom:1rem">
                <i data-lucide="sparkles" style="width:14px;height:14px;vertical-align:middle;color:var(--accent)" aria-hidden="true"></i>
                Champs pré-remplis par Alto — vérifiez et corrigez si nécessaire.
              </p>
              <form id="label-scan-form" novalidate>
                <div class="form-group">
                  <label for="ls-product-name">Produit <span aria-hidden="true" style="color:var(--danger)">*</span></label>
                  <input type="text" class="form-control" id="ls-product-name" required
                    placeholder="Ex : Poulet fermier Label Rouge" autocomplete="off">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
                  <div class="form-group" style="margin-bottom:0">
                    <label for="ls-supplier">Fournisseur</label>
                    <input type="text" class="form-control" id="ls-supplier" placeholder="Nom du fournisseur" autocomplete="off">
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label for="ls-batch">N° de lot</label>
                    <input type="text" class="form-control" id="ls-batch" placeholder="LOT-XXXX" autocomplete="off">
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.75rem">
                  <div class="form-group" style="margin-bottom:0">
                    <label for="ls-expiry">DLC / DDM</label>
                    <input type="date" class="form-control" id="ls-expiry" lang="fr">
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label for="ls-temp">Température réception (°C)</label>
                    <input type="number" class="form-control" id="ls-temp" step="0.1" min="-30" max="30" placeholder="Ex : 3.5">
                  </div>
                </div>
                <div class="form-group" style="margin-top:.75rem">
                  <label for="ls-category">Catégorie</label>
                  <select class="form-control" id="ls-category">
                    <option value="">— Choisir —</option>
                    <option value="viande">Viande</option>
                    <option value="volaille">Volaille</option>
                    <option value="poisson">Poisson</option>
                    <option value="charcuterie">Charcuterie</option>
                    <option value="fromage">Fromage</option>
                    <option value="produit_laitier">Produit laitier</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </form>
            </div>
          </div>
          <div class="modal-footer" style="display:flex;gap:.5rem;justify-content:flex-end">
            <button class="btn btn-secondary" id="btn-cancel-scan" type="button">Annuler</button>
            <button class="btn btn-primary" id="btn-save-scan" style="display:none" type="button">
              <i data-lucide="save" style="width:16px;height:16px" aria-hidden="true"></i> Enregistrer
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildScanRow(scan, CATEGORY_LABELS) {
  const dlc = scan.expiry_date ? new Date(scan.expiry_date + 'T00:00:00') : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let dlcBadge = '';
  if (dlc) {
    const diffDays = Math.ceil((dlc - today) / 86400000);
    if (diffDays < 0)    dlcBadge = `<span class="badge badge-danger" title="DLC dépassée" aria-label="DLC dépassée">DLC !</span>`;
    else if (diffDays <= 2) dlcBadge = `<span class="badge badge-warning" title="DLC dans ${diffDays} jour(s)">J-${diffDays}</span>`;
  }

  const catLabel = CATEGORY_LABELS[scan.category] || escapeHtml(scan.category || '—');
  const scannedAt = scan.scanned_at
    ? new Date(scan.scanned_at.replace(' ', 'T')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return `
    <tr>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="showScanPhoto(${scan.id})"
          aria-label="Voir la photo de ${escapeHtml(scan.product_name)}" title="Voir la photo">
          <i data-lucide="image" style="width:14px;height:14px" aria-hidden="true"></i>
        </button>
      </td>
      <td>${escapeHtml(scan.product_name)}</td>
      <td>${escapeHtml(scan.supplier || '—')}</td>
      <td><code style="font-size:.8em">${escapeHtml(scan.batch_number || '—')}</code></td>
      <td>${scan.expiry_date ? escapeHtml(scan.expiry_date) : '—'} ${dlcBadge}</td>
      <td>${scan.temperature !== null && scan.temperature !== undefined ? `${Number(scan.temperature).toFixed(1)} °C` : '—'}</td>
      <td>${escapeHtml(catLabel)}</td>
      <td>${scannedAt}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteLabelScan(${scan.id})"
          aria-label="Supprimer le scan ${escapeHtml(scan.product_name)}">
          <i data-lucide="trash-2" style="width:14px;height:14px" aria-hidden="true"></i>
        </button>
      </td>
    </tr>
  `;
}

// ─── Canvas compression (800px max, JPEG q=0.75) ────────────────────────────
function compressImage(dataUrl, maxWidth, quality) {
  maxWidth = maxWidth || 800;
  quality = quality || 0.75;
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var scale = img.width > maxWidth ? maxWidth / img.width : 1;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function() { resolve(dataUrl); }; // fallback: return original
    img.src = dataUrl;
  });
}

// ─── Capacitor Camera detection ─────────────────────────────────────────────
function isCapacitorAvailable() {
  return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera);
}

var _capturedPhotoData = null; // raw base64 (no data: prefix), set after capture + compress

async function captureWithCapacitor() {
  var Camera = window.Capacitor.Plugins.Camera;
  try {
    var photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: 'base64', // returns photo.base64String
      source: 'CAMERA',
    });
    // base64String has no data: prefix
    var dataUrl = 'data:image/jpeg;base64,' + photo.base64String;
    return dataUrl;
  } catch (e) {
    if (e && e.message && (e.message.includes('cancelled') || e.message.includes('canceled'))) return null;
    throw e;
  }
}

function attachLabelScanEvents() {
  document.getElementById('btn-open-scan')?.addEventListener('click', openScanModal);
  document.getElementById('btn-close-scan-modal')?.addEventListener('click', closeScanModal);
  document.getElementById('btn-cancel-scan')?.addEventListener('click', closeScanModal);

  // Show file input fallback when not in native Capacitor
  if (!isCapacitorAvailable()) {
    var fallback = document.getElementById('btn-file-fallback');
    if (fallback) fallback.style.display = '';
  }

  document.getElementById('btn-take-photo')?.addEventListener('click', async function() {
    if (isCapacitorAvailable()) {
      try {
        var dataUrl = await captureWithCapacitor();
        if (dataUrl) await handleCapturedPhoto(dataUrl);
      } catch (e) {
        console.error('Capacitor camera error:', e);
        showToast('Erreur appareil photo', 'error');
      }
    } else {
      // In browser: trigger file input
      document.getElementById('file-input-fallback')?.click();
    }
  });

  document.getElementById('file-input-fallback')?.addEventListener('change', async function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev) {
      var compressed = await compressImage(ev.target.result, 800, 0.75);
      await handleCapturedPhoto(compressed);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-save-scan')?.addEventListener('click', saveLabelScan);
}

function openScanModal() {
  _capturedPhotoData = null;
  var modal = document.getElementById('label-scan-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('step-form').style.display = 'none';
  document.getElementById('step-capture').style.display = '';
  document.getElementById('photo-preview-container').style.display = 'none';
  document.getElementById('extract-spinner').style.display = 'none';
  document.getElementById('btn-save-scan').style.display = 'none';
  var form = document.getElementById('label-scan-form');
  if (form) form.reset();
}

function closeScanModal() {
  var modal = document.getElementById('label-scan-modal');
  if (modal) modal.style.display = 'none';
  _capturedPhotoData = null;
}

async function handleCapturedPhoto(dataUrl) {
  // Compress
  var compressed = await compressImage(dataUrl, 800, 0.75);

  // Show preview
  var preview = document.getElementById('photo-preview');
  var previewContainer = document.getElementById('photo-preview-container');
  if (preview) preview.src = compressed;
  if (previewContainer) previewContainer.style.display = '';

  // Store raw base64 (strip prefix for DB)
  _capturedPhotoData = compressed.replace(/^data:image\/\w+;base64,/, '');

  // Call /extract
  document.getElementById('extract-spinner').style.display = '';
  document.getElementById('step-form').style.display = 'none';
  document.getElementById('btn-save-scan').style.display = 'none';

  try {
    var extracted = await API.extractLabelScan(_capturedPhotoData);
    if (extracted.product_name) document.getElementById('ls-product-name').value = extracted.product_name;
    if (extracted.supplier)     document.getElementById('ls-supplier').value     = extracted.supplier;
    if (extracted.batch_number) document.getElementById('ls-batch').value        = extracted.batch_number;
    if (extracted.expiry_date)  document.getElementById('ls-expiry').value       = extracted.expiry_date;
    if (extracted.category) {
      var sel = document.getElementById('ls-category');
      if (sel) sel.value = extracted.category;
    }
  } catch (e) {
    console.warn('Extraction IA échouée, formulaire vide:', e);
    // Don't block — user fills manually
  }

  document.getElementById('extract-spinner').style.display = 'none';
  document.getElementById('step-form').style.display = '';
  document.getElementById('btn-save-scan').style.display = '';
  lucide.createIcons();
}

async function saveLabelScan() {
  var productName = document.getElementById('ls-product-name')?.value?.trim();
  if (!productName) {
    showToast('Le nom du produit est requis', 'error');
    document.getElementById('ls-product-name')?.focus();
    return;
  }

  var tempRaw = document.getElementById('ls-temp')?.value;
  var temperature = (tempRaw !== undefined && tempRaw !== null && tempRaw !== '') ? parseFloat(tempRaw) : null;

  var payload = {
    product_name:  productName,
    supplier:      document.getElementById('ls-supplier')?.value?.trim()  || null,
    batch_number:  document.getElementById('ls-batch')?.value?.trim()     || null,
    expiry_date:   document.getElementById('ls-expiry')?.value            || null,
    temperature:   temperature,
    category:      document.getElementById('ls-category')?.value          || null,
    photo_data:    _capturedPhotoData || null,
  };

  var btn = document.getElementById('btn-save-scan');
  if (btn) btn.disabled = true;

  try {
    await API.saveLabelScan(payload);
    showToast('Scan enregistré avec succès', 'success');
    closeScanModal();
    renderHACCPLabelScan(); // reload list
  } catch (e) {
    console.error('saveLabelScan error:', e);
    showToast('Erreur lors de l\'enregistrement', 'error');
    if (btn) btn.disabled = false;
  }
}

async function showScanPhoto(id) {
  try {
    var scan = await API.getLabelScan(id);
    if (!scan.photo_data) {
      showToast('Aucune photo pour ce scan', 'warning');
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Photo étiquette');
    overlay.innerHTML = `
      <div class="modal" style="max-width:620px;width:100%">
        <div class="modal-header">
          <h2 class="modal-title" id="photo-modal-title">${escapeHtml(scan.product_name)}</h2>
          <button class="modal-close" aria-label="Fermer la photo">&times;</button>
        </div>
        <div class="modal-body" style="text-align:center;padding:1rem">
          <img src="data:image/jpeg;base64,${scan.photo_data}"
            alt="Étiquette ${escapeHtml(scan.product_name)}"
            style="max-width:100%;border-radius:var(--radius-md)">
        </div>
      </div>
    `;
    overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    lucide.createIcons();
  } catch (e) {
    console.error('showScanPhoto error:', e);
    showToast('Erreur chargement photo', 'error');
  }
}

async function deleteLabelScan(id) {
  if (!confirm('Supprimer ce scan d\'étiquette ?')) return;
  try {
    await API.deleteLabelScan(id);
    showToast('Scan supprimé', 'success');
    renderHACCPLabelScan();
  } catch (e) {
    console.error('deleteLabelScan error:', e);
    showToast('Erreur lors de la suppression', 'error');
  }
}
