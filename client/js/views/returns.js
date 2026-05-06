// ═══════════════════════════════════════════
// Returns / claims — list + new request modal + detail with status updates.
// Backed by /api/returns (server/routes/returns.js).
// ═══════════════════════════════════════════

const RETURN_STATUS_LABELS = {
  draft:       'Brouillon',
  sent:        'Envoyée',
  in_progress: 'En cours',
  resolved:    'Résolue',
  rejected:    'Refusée',
};

const RETURN_STATUS_COLORS = {
  draft:       '#6b7280',
  sent:        '#2563eb',
  in_progress: '#E8722A',
  resolved:    '#22c55e',
  rejected:    '#ef4444',
};

const RETURN_TYPE_LABELS = {
  return: 'Retour produit',
  credit: "Demande d'avoir",
};

const RETURN_REASON_LABELS = {
  qualite:  'Qualité non conforme',
  quantite: 'Erreur de quantité',
  dlc:      'DLC trop courte',
  abime:    'Produit abîmé',
  manquant: 'Produit manquant',
  autre:    'Autre',
};

function fmtRetDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return s; }
}

function returnStatusBadge(status) {
  const label = RETURN_STATUS_LABELS[status] || status || '—';
  const color = RETURN_STATUS_COLORS[status] || '#6b7280';
  return `<span class="badge" style="background:${color};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md)">${escapeHtml(label)}</span>`;
}

// ─── List view ──────────────────────────────────────────────────────────────

async function renderReturns() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div>
        <h1><i data-lucide="package-x" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Retours &amp; avoirs</h1>
        <p class="text-secondary">Demandes de retour produit et d'avoirs auprès de vos fournisseurs</p>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        <button id="return-new-btn" class="btn btn-primary" style="display:flex;align-items:center;gap:var(--space-2)">
          <i data-lucide="plus" style="width:16px;height:16px"></i>
          Nouvelle demande de retour
        </button>
      </div>
    </div>

    <div id="returns-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);margin-bottom:var(--space-5)"></div>

    <div class="invoice-tabs" style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <button class="btn btn-accent return-tab active" data-status="">Toutes</button>
      <button class="btn btn-secondary return-tab" data-status="draft">Brouillons</button>
      <button class="btn btn-secondary return-tab" data-status="sent">Envoyées</button>
      <button class="btn btn-secondary return-tab" data-status="in_progress">En cours</button>
      <button class="btn btn-secondary return-tab" data-status="resolved">Résolues</button>
      <button class="btn btn-secondary return-tab" data-status="rejected">Refusées</button>
    </div>

    <div id="returns-content">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('return-new-btn').addEventListener('click', () => openReturnFormModal());

  document.querySelectorAll('.return-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.return-tab').forEach(t => {
        t.classList.remove('active', 'btn-accent');
        t.classList.add('btn-secondary');
      });
      tab.classList.add('active', 'btn-accent');
      tab.classList.remove('btn-secondary');
      loadReturns(tab.dataset.status || null);
    });
  });

  loadReturnStats();
  loadReturns();
}

async function loadReturnStats() {
  const wrap = document.getElementById('returns-stats');
  if (!wrap) return;
  try {
    const stats = await API.getReturnStats();
    wrap.innerHTML = `
      ${returnStatCard('Total demandes', stats.total, 'depuis toujours', '#6b7280')}
      ${returnStatCard('À suivre', stats.open, 'envoyées + en cours', '#E8722A')}
      ${returnStatCard('Avoirs obtenus', stats.credit_total_resolved.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €', 'cumul résolus', '#22c55e')}
      ${returnStatCard('Refusées', (stats.by_status.find(s => s.status === 'rejected') || { count: 0 }).count, 'à investiguer', '#ef4444')}
    `;
  } catch (e) {
    wrap.innerHTML = `<p class="text-secondary text-sm">Statistiques indisponibles</p>`;
  }
}

function returnStatCard(label, value, sub, color) {
  return `
    <div class="card" style="padding:var(--space-3);border-left:4px solid ${color};border-radius:var(--radius-lg);background:var(--bg-elevated)">
      <div style="font-size:var(--text-xs);color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em">${escapeHtml(label)}</div>
      <div style="font-size:var(--text-2xl);font-weight:600;color:${color};margin-top:4px">${escapeHtml(String(value))}</div>
      <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">${escapeHtml(sub)}</div>
    </div>
  `;
}

async function loadReturns(status) {
  const wrap = document.getElementById('returns-content');
  if (!wrap) return;
  try {
    const list = await API.getReturns({ status: status || undefined });
    if (!list.length) {
      wrap.innerHTML = `
        <div class="card" style="padding:var(--space-5);text-align:center;background:var(--bg-elevated);border-radius:var(--radius-lg)">
          <i data-lucide="inbox" style="width:48px;height:48px;color:var(--text-secondary)"></i>
          <h3 style="margin:var(--space-3) 0 var(--space-1)">Aucune demande</h3>
          <p class="text-secondary" style="margin:0">Cliquez sur « Nouvelle demande de retour » pour signaler un problème de livraison à un fournisseur.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ nodes: [wrap] });
      return;
    }
    wrap.innerHTML = `
      <div class="card" style="background:var(--bg-elevated);border-radius:var(--radius-lg);overflow:hidden">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead style="background:var(--bg-canvas)">
              <tr style="text-align:left">
                <th style="padding:var(--space-3)">Référence</th>
                <th style="padding:var(--space-3)">Fournisseur</th>
                <th style="padding:var(--space-3)">Type</th>
                <th style="padding:var(--space-3);text-align:center">Produits</th>
                <th style="padding:var(--space-3)">Statut</th>
                <th style="padding:var(--space-3)">Créée le</th>
                <th style="padding:var(--space-3)"></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(r => `
                <tr style="border-top:1px solid var(--border-color);cursor:pointer" data-id="${r.id}" class="return-row">
                  <td style="padding:var(--space-3);font-weight:500">${escapeHtml(r.reference || '—')}</td>
                  <td style="padding:var(--space-3)">${escapeHtml(r.supplier_name || '—')}</td>
                  <td style="padding:var(--space-3);color:var(--text-secondary);font-size:var(--text-sm)">${escapeHtml(RETURN_TYPE_LABELS[r.type] || r.type)}</td>
                  <td style="padding:var(--space-3);text-align:center">${r.item_count || 0}</td>
                  <td style="padding:var(--space-3)">${returnStatusBadge(r.status)}</td>
                  <td style="padding:var(--space-3);color:var(--text-secondary);font-size:var(--text-sm)">${escapeHtml(fmtRetDate(r.created_at))}</td>
                  <td style="padding:var(--space-3);text-align:right">
                    <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-secondary)"></i>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [wrap] });
    wrap.querySelectorAll('.return-row').forEach(row => {
      row.addEventListener('click', () => { location.hash = '#/retours/' + row.dataset.id; });
    });
  } catch (e) {
    wrap.innerHTML = `<p class="text-secondary">Liste indisponible. ${escapeHtml(e.message || '')}</p>`;
  }
}

// ─── Detail view ────────────────────────────────────────────────────────────

async function renderReturnDetail(id) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="margin-bottom:var(--space-3)"><a href="#/retours" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:var(--space-2)"><i data-lucide="arrow-left" style="width:16px;height:16px"></i>Retours</a></div>
    <div id="return-detail">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  let row;
  try {
    row = await API.getReturn(id);
  } catch (e) {
    document.getElementById('return-detail').innerHTML = `<p class="text-secondary">Demande introuvable</p>`;
    return;
  }
  const wrap = document.getElementById('return-detail');
  wrap.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div>
        <h1 style="margin:0">${escapeHtml(row.reference || ('Demande #' + row.id))}</h1>
        <p class="text-secondary" style="margin:4px 0 0">${escapeHtml(row.supplier_name || '—')} · ${escapeHtml(RETURN_TYPE_LABELS[row.type] || row.type)} · ${returnStatusBadge(row.status)}</p>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        ${row.status === 'draft' ? `
          <button id="return-send-btn" class="btn btn-primary" style="display:flex;align-items:center;gap:var(--space-2)">
            <i data-lucide="send" style="width:16px;height:16px"></i>Envoyer au fournisseur
          </button>
          <button id="return-delete-btn" class="btn btn-secondary" style="display:flex;align-items:center;gap:var(--space-2)">
            <i data-lucide="trash-2" style="width:16px;height:16px"></i>Supprimer
          </button>
        ` : ''}
        ${row.status !== 'draft' ? `
          <select id="return-status-select" data-ui="custom" style="min-width:180px">
            ${Object.entries(RETURN_STATUS_LABELS).filter(([k]) => k !== 'draft').map(([k, v]) => `
              <option value="${k}" ${k === row.status ? 'selected' : ''}>${escapeHtml(v)}</option>
            `).join('')}
          </select>
        ` : ''}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-lg)">
        <div style="font-size:var(--text-xs);color:var(--text-secondary);text-transform:uppercase">Créée le</div>
        <div style="font-size:var(--text-lg);margin-top:4px">${escapeHtml(fmtRetDate(row.created_at))}</div>
      </div>
      <div class="card" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-lg)">
        <div style="font-size:var(--text-xs);color:var(--text-secondary);text-transform:uppercase">Email envoyé à</div>
        <div style="font-size:var(--text-lg);margin-top:4px">${escapeHtml(row.email_sent_to || '—')}</div>
        <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px">${escapeHtml(row.email_sent_at ? fmtRetDate(row.email_sent_at) : 'Non envoyée')}</div>
      </div>
    </div>

    ${row.notes ? `<div class="card" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-lg);margin-bottom:var(--space-4)">
      <div style="font-size:var(--text-xs);color:var(--text-secondary);text-transform:uppercase;margin-bottom:var(--space-2)">Commentaire général</div>
      <div style="white-space:pre-wrap">${escapeHtml(row.notes)}</div>
    </div>` : ''}

    <div class="card" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-lg)">
      <h3 style="margin:0 0 var(--space-3)">Produits concernés (${row.items.length})</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="text-align:left;color:var(--text-secondary)">
            <th style="padding:var(--space-2)">Produit</th>
            <th style="padding:var(--space-2);text-align:right">Quantité</th>
            <th style="padding:var(--space-2)">Motif</th>
            <th style="padding:var(--space-2)">Commentaire</th>
            <th style="padding:var(--space-2)">Photo</th>
          </tr></thead>
          <tbody>
            ${row.items.map(it => `
              <tr style="border-top:1px solid var(--border-color)">
                <td style="padding:var(--space-2);font-weight:500">${escapeHtml(it.product_name)}</td>
                <td style="padding:var(--space-2);text-align:right">${escapeHtml(String(it.quantity))} ${escapeHtml(it.unit || '')}</td>
                <td style="padding:var(--space-2)">${escapeHtml(RETURN_REASON_LABELS[it.reason] || it.reason)}</td>
                <td style="padding:var(--space-2);color:var(--text-secondary)">${escapeHtml(it.comment || '—')}</td>
                <td style="padding:var(--space-2)">${it.photo_path ? `<a href="/${escapeHtml(it.photo_path)}" target="_blank" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:4px"><i data-lucide="image" style="width:14px;height:14px"></i>Voir</a>` : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${row.type === 'credit' && row.status === 'resolved' ? `
      <div class="card" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-lg);margin-top:var(--space-4);border-left:4px solid #22c55e">
        <div style="font-size:var(--text-xs);color:var(--text-secondary);text-transform:uppercase">Avoir obtenu</div>
        <div style="font-size:var(--text-2xl);color:#22c55e;font-weight:600">${(row.credit_amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
      </div>
    ` : ''}
  `;
  if (window.lucide) lucide.createIcons({ nodes: [wrap] });
  if (typeof enhanceUIComponents === 'function') enhanceUIComponents(wrap);

  const sendBtn = document.getElementById('return-send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Envoi…';
      try {
        await API.sendReturn(row.id);
        showToast && showToast('Demande envoyée au fournisseur', 'success');
        renderReturnDetail(row.id);
      } catch (e) {
        showToast && showToast(e.message || 'Envoi impossible', 'error');
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i data-lucide="send" style="width:16px;height:16px"></i>Envoyer au fournisseur`;
        if (window.lucide) lucide.createIcons({ nodes: [sendBtn] });
      }
    });
  }

  const delBtn = document.getElementById('return-delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette demande ? Cette action est irréversible.')) return;
      try {
        await API.deleteReturn(row.id);
        showToast && showToast('Demande supprimée', 'success');
        location.hash = '#/retours';
      } catch (e) {
        showToast && showToast(e.message || 'Suppression impossible', 'error');
      }
    });
  }

  const statusSel = document.getElementById('return-status-select');
  if (statusSel) {
    statusSel.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      let creditAmount;
      if (newStatus === 'resolved' && row.type === 'credit') {
        const v = prompt('Montant de l\'avoir obtenu (€) :', row.credit_amount || '');
        if (v == null) {
          e.target.value = row.status;
          return;
        }
        creditAmount = Number(v);
        if (!Number.isFinite(creditAmount) || creditAmount < 0) {
          showToast && showToast('Montant invalide', 'error');
          e.target.value = row.status;
          return;
        }
      }
      try {
        await API.setReturnStatus(row.id, { status: newStatus, credit_amount: creditAmount });
        showToast && showToast('Statut mis à jour', 'success');
        renderReturnDetail(row.id);
      } catch (err) {
        showToast && showToast(err.message || 'Mise à jour impossible', 'error');
        e.target.value = row.status;
      }
    });
  }
}

// ─── Create modal ──────────────────────────────────────────────────────────

async function openReturnFormModal() {
  let suppliers = [];
  let deliveries = [];
  try { suppliers = await API.getSuppliers(); } catch { /* ignore */ }
  try {
    const r = await API.request('/deliveries', { noRedirectOn401: true });
    deliveries = Array.isArray(r) ? r : (r.deliveries || []);
  } catch { /* ignore */ }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:760px;width:95%">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center">
        <h2>Nouvelle demande de retour</h2>
        <button class="btn btn-secondary modal-close-btn">×</button>
      </div>
      <div class="modal-body">
        <form id="return-form" style="display:grid;gap:var(--space-3)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <label>Fournisseur *
              <select name="supplier_id" data-ui="custom" required>
                <option value="">— Choisir —</option>
                ${suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
              </select>
            </label>
            <label>Bon de livraison (optionnel)
              <select name="delivery_note_id" data-ui="custom">
                <option value="">— Aucun —</option>
                ${deliveries.map(d => `<option value="${d.id}" data-supplier="${d.supplier_id}">BL #${d.id}${d.delivery_date ? ' du ' + fmtRetDate(d.delivery_date) : ''} — ${escapeHtml(d.supplier_name || '')}</option>`).join('')}
              </select>
            </label>
          </div>

          <label>Type de demande
            <select name="type" data-ui="custom">
              <option value="return">Retour produit</option>
              <option value="credit">Demande d'avoir</option>
            </select>
          </label>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
              <strong>Produits concernés</strong>
              <button type="button" id="add-return-item" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:4px">
                <i data-lucide="plus" style="width:14px;height:14px"></i>Ajouter
              </button>
            </div>
            <div id="return-items" style="display:grid;gap:var(--space-3)"></div>
          </div>

          <label>Commentaire général (optionnel)
            <textarea name="notes" data-ui="custom" rows="3" placeholder="Précisions à transmettre au fournisseur"></textarea>
          </label>

          <div style="display:flex;gap:var(--space-2);justify-content:flex-end">
            <button type="button" class="btn btn-secondary modal-close-btn">Annuler</button>
            <button type="button" id="return-save-draft" class="btn btn-secondary">Enregistrer brouillon</button>
            <button type="submit" class="btn btn-primary">Créer &amp; envoyer</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => overlay.remove()));

  const itemsWrap = overlay.querySelector('#return-items');
  let itemSeq = 0;
  function addItemRow() {
    itemSeq++;
    const row = document.createElement('div');
    row.className = 'return-item-row card';
    row.dataset.idx = String(itemSeq);
    row.style.cssText = 'padding:var(--space-3);background:var(--bg-canvas);border-radius:var(--radius-md);display:grid;gap:var(--space-2)';
    row.innerHTML = `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:var(--space-2)">
        <input type="text" name="product_name" placeholder="Nom du produit" data-ui="custom" required>
        <input type="number" step="0.01" name="quantity" placeholder="Qté" data-ui="custom" required>
        <input type="text" name="unit" placeholder="Unité (kg, pcs)" data-ui="custom">
        <select name="reason" data-ui="custom">
          <option value="qualite">Qualité non conforme</option>
          <option value="quantite">Erreur de quantité</option>
          <option value="dlc">DLC trop courte</option>
          <option value="abime">Produit abîmé</option>
          <option value="manquant">Produit manquant</option>
          <option value="autre">Autre</option>
        </select>
        <button type="button" class="btn btn-secondary remove-row" title="Retirer">×</button>
      </div>
      <input type="text" name="comment" placeholder="Commentaire (optionnel)" data-ui="custom">
      <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm);color:var(--text-secondary);cursor:pointer">
        <i data-lucide="image" style="width:16px;height:16px"></i>
        Ajouter une photo
        <input type="file" name="photo" accept="image/*" style="display:none">
        <span class="photo-status" style="font-size:var(--text-xs);color:var(--text-secondary)"></span>
      </label>
    `;
    itemsWrap.appendChild(row);
    if (window.lucide) lucide.createIcons({ nodes: [row] });
    if (typeof enhanceUIComponents === 'function') enhanceUIComponents(row);

    row.querySelector('.remove-row').addEventListener('click', () => {
      if (itemsWrap.children.length > 1) row.remove();
    });

    const fileInput = row.querySelector('input[type="file"]');
    const fileLabel = row.querySelector('label');
    const photoStatus = row.querySelector('.photo-status');
    fileLabel.addEventListener('click', (e) => {
      if (e.target !== fileInput) fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) { photoStatus.textContent = ''; row.dataset.photo = ''; return; }
      if (f.size > 8 * 1024 * 1024) {
        showToast && showToast('Image trop lourde (8 Mo max)', 'error');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        row.dataset.photo = reader.result;
        photoStatus.textContent = `· ${f.name}`;
      };
      reader.readAsDataURL(f);
    });
  }

  overlay.querySelector('#add-return-item').addEventListener('click', addItemRow);
  addItemRow();

  // Auto-fill supplier when delivery note selected
  const dnSel = overlay.querySelector('[name="delivery_note_id"]');
  const supplierSel = overlay.querySelector('[name="supplier_id"]');
  dnSel.addEventListener('change', () => {
    const opt = dnSel.options[dnSel.selectedIndex];
    if (opt && opt.dataset.supplier) {
      supplierSel.value = opt.dataset.supplier;
      supplierSel.dispatchEvent(new Event('change'));
    }
  });

  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
  if (typeof enhanceUIComponents === 'function') enhanceUIComponents(overlay);

  function collectFormData() {
    const fd = new FormData(overlay.querySelector('#return-form'));
    const items = [];
    overlay.querySelectorAll('.return-item-row').forEach(row => {
      const name = row.querySelector('[name="product_name"]').value.trim();
      if (!name) return;
      items.push({
        product_name: name,
        quantity: Number(row.querySelector('[name="quantity"]').value) || 0,
        unit: row.querySelector('[name="unit"]').value || null,
        reason: row.querySelector('[name="reason"]').value || 'autre',
        comment: row.querySelector('[name="comment"]').value || null,
        photo_data_url: row.dataset.photo || null,
      });
    });
    return {
      supplier_id: fd.get('supplier_id') ? Number(fd.get('supplier_id')) : null,
      delivery_note_id: fd.get('delivery_note_id') ? Number(fd.get('delivery_note_id')) : null,
      type: fd.get('type') || 'return',
      notes: fd.get('notes') || null,
      items,
    };
  }

  function validate(data) {
    if (!data.supplier_id) { showToast && showToast('Sélectionnez un fournisseur', 'error'); return false; }
    if (!data.items.length) { showToast && showToast('Ajoutez au moins un produit', 'error'); return false; }
    return true;
  }

  overlay.querySelector('#return-save-draft').addEventListener('click', async () => {
    const data = collectFormData();
    if (!validate(data)) return;
    try {
      const created = await API.createReturn({ ...data, status: 'draft' });
      overlay.remove();
      showToast && showToast('Brouillon enregistré', 'success');
      location.hash = '#/retours/' + created.id;
    } catch (e) {
      showToast && showToast(e.message || 'Erreur', 'error');
    }
  });

  overlay.querySelector('#return-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectFormData();
    if (!validate(data)) return;
    let created;
    try {
      created = await API.createReturn(data);
    } catch (err) {
      showToast && showToast(err.message || 'Erreur', 'error');
      return;
    }
    try {
      await API.sendReturn(created.id);
      overlay.remove();
      showToast && showToast('Demande envoyée au fournisseur', 'success');
      location.hash = '#/retours/' + created.id;
    } catch (err) {
      // Created but send failed — leave it as draft, navigate to detail
      overlay.remove();
      showToast && showToast('Brouillon créé mais envoi impossible : ' + (err.message || ''), 'warning');
      location.hash = '#/retours/' + created.id;
    }
  });
}
