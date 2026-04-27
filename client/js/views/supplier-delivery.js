// ═══════════════════════════════════════════
// Supplier Delivery Notes — Supplier-side UI
// ═══════════════════════════════════════════

async function renderSupplierDeliveriesTab() {
  const content = document.getElementById('supplier-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
      <h2 style="margin:0;font-size:var(--text-xl)">Mes bons de livraison</h2>
      <button class="btn btn-primary" id="btn-new-delivery" style="background:#4A90D9;border-color:#4A90D9">
        <i data-lucide="plus" style="width:18px;height:18px"></i> Nouveau bon
      </button>
    </div>
    <div id="supplier-deliveries-list">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  document.getElementById('btn-new-delivery').addEventListener('click', showNewDeliveryForm);

  await loadSupplierDeliveries();
}

async function loadSupplierDeliveries() {
  const list = document.getElementById('supplier-deliveries-list');
  if (!list) return;

  try {
    const notes = await API.getSupplierDeliveryNotes();
    if (notes.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:var(--space-8);color:var(--text-secondary)">
          <div style="font-size:3rem;margin-bottom:var(--space-3)">📄</div>
          <p>Aucun bon de livraison</p>
          <p class="text-sm">Créez votre premier bon de livraison pour envoyer vos produits.</p>
        </div>
      `;
      return;
    }

    const statusColors = { pending: '#E8722A', received: '#22c55e', partial: '#eab308', rejected: '#ef4444' };
    const statusLabels = { pending: 'En attente', received: 'Reçu', partial: 'Partiel', rejected: 'Refusé' };

    list.innerHTML = notes.map(n => `
      <div class="card supplier-delivery-card" data-id="${n.id}" style="padding:var(--space-4);margin-bottom:var(--space-3);border-left:4px solid ${statusColors[n.status] || '#666'};border-radius:var(--radius-lg);background:var(--bg-elevated);cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>Bon #${n.id}</strong>
            <span class="text-secondary text-sm" style="margin-left:var(--space-2)">
              ${n.delivery_date || new Date(n.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <span class="badge" style="background:${statusColors[n.status]};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md)">
            ${statusLabels[n.status] || n.status}
          </span>
        </div>
        <div class="text-secondary text-sm" style="margin-top:var(--space-2)">
          ${n.item_count} produit${n.item_count > 1 ? 's' : ''}
          ${n.total_amount ? ` — ${n.total_amount.toFixed(2)} €` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.supplier-delivery-card').forEach(card => {
      card.addEventListener('click', () => showSupplierDeliveryDetail(Number(card.dataset.id)));
    });
  } catch (e) {
    list.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

async function showSupplierDeliveryDetail(id) {
  const content = document.getElementById('supplier-content');
  try {
    const d = await API.getSupplierDeliveryNote(id);
    const statusLabels = { pending: '🟠 En attente', received: '🟢 Reçu', partial: '🟡 Partiel', rejected: '🔴 Refusé' };

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-4)">
        <button class="btn btn-secondary btn-sm" id="back-supplier-deliveries">← Retour</button>
        <button class="btn btn-secondary btn-sm" id="supplier-bl-pdf">
          <i data-lucide="download" style="width:16px;height:16px"></i> Télécharger PDF
        </button>
      </div>
      <h2>Bon #${d.id} — ${statusLabels[d.status] || d.status}</h2>
      ${d.delivery_date ? `<p class="text-secondary">Date livraison : ${d.delivery_date}</p>` : ''}
      ${d.notes ? `<p class="text-secondary">📝 ${escapeHtml(d.notes)}</p>` : ''}
      <div style="overflow-x:auto;margin-top:var(--space-4)">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="background:var(--bg-sunken);text-align:left">
              <th style="padding:var(--space-3)">Produit</th>
              <th style="padding:var(--space-3)">Qté</th>
              <th style="padding:var(--space-3)">Prix/u</th>
              <th style="padding:var(--space-3)">N° Lot</th>
              <th style="padding:var(--space-3)">DLC</th>
              <th style="padding:var(--space-3)">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${d.items.map(item => {
              const sc = { accepted: '#22c55e', rejected: '#ef4444', pending: '#888' };
              const sl = { accepted: '✅', rejected: '❌', pending: '⏳' };
              return `
                <tr style="border-bottom:1px solid var(--border-default)">
                  <td style="padding:var(--space-3)">${escapeHtml(item.product_name)}</td>
                  <td style="padding:var(--space-3)">${item.quantity} ${escapeHtml(item.unit)}</td>
                  <td style="padding:var(--space-3)">${item.price_per_unit != null ? item.price_per_unit.toFixed(2) + '€' : '—'}</td>
                  <td style="padding:var(--space-3);font-family:monospace;font-size:var(--text-xs)">${escapeHtml(item.batch_number || '—')}</td>
                  <td style="padding:var(--space-3)">${item.dlc || '—'}</td>
                  <td style="padding:var(--space-3);color:${sc[item.status]}">${sl[item.status] || item.status}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${d.total_amount ? `<p style="text-align:right;font-weight:600;margin-top:var(--space-3)">Total : ${d.total_amount.toFixed(2)} €</p>` : ''}
    `;

    document.getElementById('back-supplier-deliveries').addEventListener('click', renderSupplierDeliveriesTab);
    const pdfBtn = document.getElementById('supplier-bl-pdf');
    if (pdfBtn) {
      if (window.lucide) lucide.createIcons();
      pdfBtn.addEventListener('click', async () => {
        pdfBtn.disabled = true;
        try {
          await API.downloadSupplierDeliveryNotePdf(id);
        } catch (err) {
          showToast(err.message || 'Erreur téléchargement', 'error');
        } finally {
          pdfBtn.disabled = false;
        }
      });
    }
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function showNewDeliveryForm() {
  const content = document.getElementById('supplier-content');
  content.innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <button class="btn btn-secondary btn-sm" id="back-supplier-deliveries-form">← Retour</button>
    </div>
    <h2 style="margin-bottom:var(--space-4)">Nouveau bon de livraison</h2>
    <div class="form-group" style="margin-bottom:var(--space-4)">
      <label class="form-label">Date de livraison</label>
      <input type="date" id="dn-date" class="input" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group" style="margin-bottom:var(--space-4)">
      <label class="form-label">Notes</label>
      <textarea id="dn-notes" class="input" rows="2" placeholder="Notes optionnelles..."></textarea>
    </div>
    <h3 style="margin-bottom:var(--space-3)">Produits</h3>
    <div id="dn-items-list"></div>
    <button class="btn btn-secondary" id="dn-add-item" style="margin-bottom:var(--space-5)">
      + Ajouter un produit
    </button>
    <div style="text-align:right">
      <button class="btn btn-primary btn-lg" id="dn-submit" style="background:#4A90D9;border-color:#4A90D9">
        📤 Envoyer le bon
      </button>
    </div>
  `;

  let itemIndex = 0;

  function addItemRow() {
    const list = document.getElementById('dn-items-list');
    const idx = itemIndex++;
    const row = document.createElement('div');
    row.className = 'dn-item-row';
    row.dataset.idx = idx;
    row.style.cssText = 'background:var(--bg-sunken);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3);position:relative';
    row.innerHTML = `
      <button class="btn btn-secondary btn-sm dn-remove-item" style="position:absolute;top:8px;right:8px;padding:2px 8px;font-size:var(--text-xs)">✕</button>
      <div style="display:grid;grid-template-columns:1fr 80px 80px 100px;gap:var(--space-2);margin-bottom:var(--space-2)">
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Produit *</label>
          <input type="text" class="input dn-product-name" placeholder="Nom du produit" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Quantité *</label>
          <input type="number" class="input dn-quantity" step="0.01" min="0.01" placeholder="0" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Unité</label>
          <select class="input dn-unit">
            <option value="kg">kg</option>
            <option value="L">L</option>
            <option value="pièce">pièce</option>
            <option value="barquette">barquette</option>
            <option value="colis">colis</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">Prix/unité (€)</label>
          <input type="number" class="input dn-price" step="0.01" min="0" placeholder="0.00">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 100px;gap:var(--space-2);margin-bottom:var(--space-2)">
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">N° Lot</label>
          <input type="text" class="input dn-batch" placeholder="N° lot">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">DLC</label>
          <input type="date" class="input dn-dlc">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:var(--text-xs)">T° max (°C)</label>
          <input type="number" class="input dn-temp" step="0.1" placeholder="4">
        </div>
      </div>
      <details style="margin-top:var(--space-2)">
        <summary style="cursor:pointer;font-size:var(--text-xs);color:var(--text-secondary)">🐟 Poisson / 🥩 Viande (optionnel)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-top:var(--space-2)">
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">Zone de pêche (FAO)</label>
            <input type="text" class="input dn-fishing-zone" placeholder="Ex: 27.7">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">Méthode de pêche</label>
            <input type="text" class="input dn-fishing-method" placeholder="Ex: chalut">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">Origine (viande)</label>
            <input type="text" class="input dn-origin" placeholder="Ex: France, Charolais">
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:var(--text-xs)">N° agrément sanitaire</label>
            <input type="text" class="input dn-sanitary" placeholder="Ex: FR 01.234.567 CE">
          </div>
        </div>
      </details>
    `;
    list.appendChild(row);

    row.querySelector('.dn-remove-item').addEventListener('click', () => row.remove());
  }

  // Add first row
  addItemRow();

  document.getElementById('dn-add-item').addEventListener('click', addItemRow);
  document.getElementById('back-supplier-deliveries-form').addEventListener('click', renderSupplierDeliveriesTab);

  document.getElementById('dn-submit').addEventListener('click', async () => {
    const delivery_date = document.getElementById('dn-date').value || null;
    const notes = document.getElementById('dn-notes').value || null;
    const rows = document.querySelectorAll('.dn-item-row');
    const items = [];

    for (const row of rows) {
      const product_name = row.querySelector('.dn-product-name').value.trim();
      const quantity = parseFloat(row.querySelector('.dn-quantity').value);
      if (!product_name || isNaN(quantity) || quantity <= 0) {
        showToast('Chaque produit doit avoir un nom et une quantité', 'error');
        return;
      }
      items.push({
        product_name,
        quantity,
        unit: row.querySelector('.dn-unit').value,
        price_per_unit: parseFloat(row.querySelector('.dn-price').value) || null,
        batch_number: row.querySelector('.dn-batch').value || null,
        dlc: row.querySelector('.dn-dlc').value || null,
        temperature_required: parseFloat(row.querySelector('.dn-temp').value) || null,
        fishing_zone: row.querySelector('.dn-fishing-zone').value || null,
        fishing_method: row.querySelector('.dn-fishing-method').value || null,
        origin: row.querySelector('.dn-origin').value || null,
        sanitary_approval: row.querySelector('.dn-sanitary').value || null
      });
    }

    if (items.length === 0) {
      showToast('Ajoutez au moins un produit', 'error');
      return;
    }

    try {
      await API.createSupplierDeliveryNote({ delivery_date, notes, items });
      showToast('Bon de livraison envoyé !', 'success');
      renderSupplierDeliveriesTab();
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  });
}
