// ═══════════════════════════════════════════
// Scan Invoice — AI-powered supplier invoice scanning
// ═══════════════════════════════════════════

async function renderScanInvoice() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <a href="#/stock" class="btn btn-secondary btn-sm">← Stock</a>
      <h1><i data-lucide="camera" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Scanner une facture</h1>
    </div>

    <div class="card" style="padding:var(--space-4);text-align:center">
      <p class="text-secondary" style="margin-bottom:var(--space-3)">
        Prenez en photo ou importez une facture fournisseur.<br>
        L'IA extraira automatiquement les données.
      </p>
      <label class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px">
        <i data-lucide="camera" style="width:20px;height:20px"></i>
        Choisir une image
        <input type="file" id="invoice-input" accept="image/*" capture="environment" style="display:none">
      </label>
      <div id="invoice-preview" style="margin-top:var(--space-3);display:none">
        <img id="invoice-img" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--color-border)">
      </div>
    </div>

    <div id="scan-loading" style="display:none;text-align:center;padding:var(--space-5)">
      <div class="skeleton" style="height:20px;width:60%;margin:0 auto var(--space-2)"></div>
      <p class="text-secondary">Analyse IA en cours...</p>
    </div>

    <div id="scan-results" style="display:none">
      <div class="card" style="padding:var(--space-4)">
        <h3 style="margin-bottom:var(--space-3)">Données extraites</h3>
        <div id="invoice-header" style="margin-bottom:var(--space-3)"></div>
        <div style="overflow-x:auto">
          <table class="scan-table" style="width:100%;border-collapse:collapse;font-size:0.9rem">
            <thead>
              <tr style="border-bottom:2px solid var(--color-border)">
                <th style="text-align:left;padding:8px 4px">Produit</th>
                <th style="text-align:center;padding:8px 4px">Qté</th>
                <th style="text-align:left;padding:8px 4px">Unité</th>
                <th style="text-align:right;padding:8px 4px">PU</th>
                <th style="text-align:right;padding:8px 4px">Total</th>
                <th style="text-align:left;padding:8px 4px">Lot</th>
                <th style="text-align:left;padding:8px 4px">DLC</th>
                <th style="text-align:left;padding:8px 4px">Ingrédient</th>
              </tr>
            </thead>
            <tbody id="invoice-items"></tbody>
          </table>
        </div>
        <div id="invoice-totals" style="margin-top:var(--space-3);text-align:right"></div>
        <div style="margin-top:var(--space-4);display:flex;gap:var(--space-2);justify-content:flex-end">
          <button class="btn btn-primary" id="btn-create-delivery">📦 Créer le bon de réception</button>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  let scanData = null;

  const fileInput = document.getElementById('invoice-input');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview
    const preview = document.getElementById('invoice-preview');
    const img = document.getElementById('invoice-img');
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.src = ev.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);

    // Send to API
    document.getElementById('scan-loading').style.display = 'block';
    document.getElementById('scan-results').style.display = 'none';

    try {
      const formData = new FormData();
      formData.append('invoice', file);

      const token = localStorage.getItem('restosuite_token');
      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const account = typeof getAccount === 'function' ? getAccount() : null;
      if (account && account.id) headers['X-Account-Id'] = String(account.id);

      const res = await fetch('/api/ai/scan-invoice', {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur scan');
      }

      scanData = await res.json();
      renderScanResults(scanData);
    } catch (err) {
      showToast(err.message || 'Erreur lors du scan', 'error');
    } finally {
      document.getElementById('scan-loading').style.display = 'none';
    }
  });

  document.getElementById('btn-create-delivery').addEventListener('click', () => {
    if (!scanData) return;
    createDeliveryFromScan(scanData);
  });
}

function renderScanResults(data) {
  document.getElementById('scan-results').style.display = 'block';

  // Header info
  const header = document.getElementById('invoice-header');
  header.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--space-2)">
      <div><strong>Fournisseur :</strong> ${escapeHtml(data.supplier_name || '—')}</div>
      <div><strong>N° Facture :</strong> ${escapeHtml(data.invoice_number || '—')}</div>
      <div><strong>Date :</strong> ${data.invoice_date ? new Date(data.invoice_date).toLocaleDateString('fr-FR') : '—'}</div>
    </div>
  `;

  // Items
  const tbody = document.getElementById('invoice-items');
  tbody.innerHTML = (data.items || []).map((item, i) => `
    <tr style="border-bottom:1px solid var(--color-border)">
      <td style="padding:8px 4px">${escapeHtml(item.product_name || '—')}</td>
      <td style="text-align:center;padding:8px 4px">
        <input type="number" value="${item.quantity || ''}" data-idx="${i}" data-field="quantity" 
               style="width:60px;text-align:center;background:var(--color-bg);border:1px solid var(--color-border);border-radius:4px;padding:4px;color:inherit" data-ui="custom">
      </td>
      <td style="padding:8px 4px">${escapeHtml(item.unit || '—')}</td>
      <td style="text-align:right;padding:8px 4px">${item.unit_price != null ? item.unit_price.toFixed(2) + '€' : '—'}</td>
      <td style="text-align:right;padding:8px 4px">${item.total_price != null ? item.total_price.toFixed(2) + '€' : '—'}</td>
      <td style="padding:8px 4px">${escapeHtml(item.batch_number || '—')}</td>
      <td style="padding:8px 4px">${escapeHtml(item.dlc || '—')}</td>
      <td style="padding:8px 4px">
        ${item.matched_ingredient 
          ? `<span style="color:var(--color-success)">✓ ${escapeHtml(item.matched_ingredient)}</span>` 
          : '<span style="color:var(--color-text-muted)">Non trouvé</span>'}
      </td>
    </tr>
  `).join('');

  // Totals
  const totals = document.getElementById('invoice-totals');
  totals.innerHTML = `
    <div style="display:inline-grid;grid-template-columns:auto auto;gap:4px 16px;text-align:right">
      <span>Total HT :</span><strong>${data.total_ht != null ? data.total_ht.toFixed(2) + '€' : '—'}</strong>
      <span>TVA :</span><strong>${data.tva != null ? data.tva.toFixed(2) + '€' : '—'}</strong>
      <span>Total TTC :</span><strong style="font-size:1.1em;color:var(--color-accent)">${data.total_ttc != null ? data.total_ttc.toFixed(2) + '€' : '—'}</strong>
    </div>
  `;
}

async function createDeliveryFromScan(data) {
  try {
    // Find or create supplier
    let suppliers = await API.getSuppliers();
    let supplier = suppliers.find(s => s.name.toLowerCase() === (data.supplier_name || '').toLowerCase());
    
    if (!supplier && data.supplier_name) {
      supplier = await API.createSupplier({ name: data.supplier_name });
    }

    if (!supplier) {
      showToast('Impossible de trouver le fournisseur', 'error');
      return;
    }

    // Build reception lines from scanned items
    const lines = (data.items || [])
      .filter(item => item.ingredient_id && item.quantity)
      .map(item => ({
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
        unit: item.unit || 'kg',
        unit_price: item.unit_price || null,
        supplier_id: supplier.id,
        batch_number: item.batch_number || null,
        dlc: item.dlc || null
      }));

    if (lines.length === 0) {
      showToast('Aucun ingrédient reconnu pour la réception', 'error');
      return;
    }

    const account = getAccount();
    await API.postReception({ lines, recorded_by: account ? account.id : null });
    showToast(`✅ Réception créée : ${lines.length} ligne(s)`, 'success');
    location.hash = '#/stock';
  } catch (e) {
    showToast(e.message || 'Erreur création réception', 'error');
  }
}
