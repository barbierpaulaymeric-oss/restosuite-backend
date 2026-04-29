// ═══════════════════════════════════════════
// Supplier invoices — list / detail / reconcile
// Backed by /api/invoices (server/routes/invoices.js).
// ═══════════════════════════════════════════

const INVOICE_STATUS_LABELS = {
  pending:   'En attente',
  validated: 'Validée',
  paid:      'Payée',
  disputed:  'Litige',
};

const INVOICE_STATUS_COLORS = {
  pending:   '#E8722A',
  validated: '#2563eb',
  paid:      '#22c55e',
  disputed:  '#ef4444',
};

function fmtEur(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return s; }
}

function isOverdue(inv) {
  if (!inv.due_date) return false;
  if (inv.status === 'paid') return false;
  return new Date(inv.due_date + 'T23:59:59') < new Date();
}

function statusBadge(status) {
  const label = INVOICE_STATUS_LABELS[status] || status || '—';
  const color = INVOICE_STATUS_COLORS[status] || '#6b7280';
  return `<span class="badge" style="background:${color};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md)">${escapeHtml(label)}</span>`;
}

// ─── List view ──────────────────────────────────────────────────────────────

async function renderInvoices() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div>
        <h1><i data-lucide="receipt" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Factures fournisseurs</h1>
        <p class="text-secondary">Suivi des factures, rapprochement BL, paiements</p>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        <a href="#/scan-invoice" class="btn btn-secondary" style="display:flex;align-items:center;gap:var(--space-2)">
          <i data-lucide="scan-line" style="width:16px;height:16px"></i>
          Scanner une facture
        </a>
        <button id="invoice-new-btn" class="btn btn-primary" style="display:flex;align-items:center;gap:var(--space-2)">
          <i data-lucide="plus" style="width:16px;height:16px"></i>
          Nouvelle facture
        </button>
      </div>
    </div>

    <div id="invoices-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);margin-bottom:var(--space-5)"></div>

    <div class="invoice-tabs" style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <button class="btn btn-accent invoice-tab active" data-status="">Toutes</button>
      <button class="btn btn-secondary invoice-tab" data-status="pending">En attente</button>
      <button class="btn btn-secondary invoice-tab" data-status="validated">Validées</button>
      <button class="btn btn-secondary invoice-tab" data-status="paid">Payées</button>
      <button class="btn btn-secondary invoice-tab" data-status="disputed">Litige</button>
    </div>

    <div id="invoices-content">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('invoice-new-btn').addEventListener('click', () => openInvoiceFormModal());

  document.querySelectorAll('.invoice-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.invoice-tab').forEach(t => {
        t.classList.remove('active', 'btn-accent');
        t.classList.add('btn-secondary');
      });
      tab.classList.add('active', 'btn-accent');
      tab.classList.remove('btn-secondary');
      loadInvoices(tab.dataset.status || null);
    });
  });

  loadInvoiceStats();
  loadInvoices();
}

async function loadInvoiceStats() {
  const wrap = document.getElementById('invoices-stats');
  if (!wrap) return;
  try {
    const stats = await API.getInvoiceStats();
    const month = stats.monthly && stats.monthly.length
      ? stats.monthly[stats.monthly.length - 1]
      : { total_ttc: 0, invoice_count: 0 };
    wrap.innerHTML = `
      ${statCard('Mois en cours', fmtEur(month.total_ttc), `${month.invoice_count} factures`, '#E8722A')}
      ${statCard('À payer', fmtEur(stats.unpaid.total_ttc), `${stats.unpaid.count} factures`, '#2563eb')}
      ${statCard('En retard', fmtEur(stats.overdue.total_ttc), `${stats.overdue.count} factures`, '#ef4444')}
      ${statCard('Top fournisseur', stats.by_supplier[0] ? escapeHtml(stats.by_supplier[0].supplier_name || '—') : '—',
                 stats.by_supplier[0] ? fmtEur(stats.by_supplier[0].total_ttc) : '0 €', '#22c55e')}
    `;
  } catch (e) {
    wrap.innerHTML = `<p class="text-secondary text-sm">Statistiques indisponibles</p>`;
  }
}

function statCard(label, value, sub, color) {
  return `
    <div class="card" style="padding:var(--space-4);border-left:4px solid ${color};border-radius:var(--radius-lg);background:var(--bg-elevated)">
      <div class="text-secondary text-sm" style="margin-bottom:var(--space-1)">${escapeHtml(label)}</div>
      <div style="font-size:var(--text-xl);font-weight:600;line-height:1.2">${value}</div>
      <div class="text-secondary text-sm" style="margin-top:var(--space-1)">${sub}</div>
    </div>
  `;
}

async function loadInvoices(status) {
  const content = document.getElementById('invoices-content');
  if (!content) return;
  try {
    const invoices = await API.getInvoices({ status: status || undefined });
    if (!invoices.length) {
      content.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--space-8)">
          <div style="font-size:3rem;margin-bottom:var(--space-3)">🧾</div>
          <h3>Aucune facture</h3>
          <p class="text-secondary">Scannez ou ajoutez une facture pour commencer.</p>
        </div>
      `;
      return;
    }
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-4)">
        ${invoices.map(renderInvoiceCard).join('')}
      </div>
    `;
    content.querySelectorAll('.invoice-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        location.hash = '#/invoices/' + card.dataset.id;
      });
    });
    if (window.lucide) lucide.createIcons({ nodes: [content] });
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message || 'chargement impossible')}</p>`;
  }
}

function renderInvoiceCard(inv) {
  const overdue = isOverdue(inv);
  const borderColor = overdue ? '#ef4444' : (INVOICE_STATUS_COLORS[inv.status] || '#666');
  return `
    <div class="card invoice-card" data-id="${inv.id}" data-ui="custom"
         style="padding:var(--space-4);border-left:4px solid ${borderColor};border-radius:var(--radius-lg);background:var(--bg-elevated);cursor:pointer;transition:transform 0.15s">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-2);margin-bottom:var(--space-3)">
        <div style="min-width:0;flex:1">
          <h3 style="font-size:var(--text-base);font-weight:600;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escapeHtml(inv.supplier_name || 'Fournisseur inconnu')}
          </h3>
          <div class="text-secondary text-sm">
            ${escapeHtml(inv.invoice_number || `Facture #${inv.id}`)}
          </div>
        </div>
        ${statusBadge(inv.status)}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div class="text-secondary text-xs">Date</div>
          <div class="text-sm">${fmtDate(inv.invoice_date)}</div>
          ${inv.due_date ? `<div class="text-secondary text-xs" style="margin-top:var(--space-2)">Échéance</div>
          <div class="text-sm" style="${overdue ? 'color:#ef4444;font-weight:600' : ''}">${fmtDate(inv.due_date)}${overdue ? ' (en retard)' : ''}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="text-secondary text-xs">Total TTC</div>
          <div style="font-size:var(--text-lg);font-weight:600">${fmtEur(inv.total_ttc)}</div>
        </div>
      </div>
    </div>
  `;
}

// ─── Detail view ────────────────────────────────────────────────────────────

async function renderInvoiceDetail(id) {
  const app = document.getElementById('app');
  app.innerHTML = `<div id="invoice-detail-content"><div class="skeleton skeleton-row"></div></div>`;
  const content = document.getElementById('invoice-detail-content');

  let inv;
  try {
    inv = await API.getInvoice(id);
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">${escapeHtml(e.message || 'Facture introuvable')}</p>
      <a href="#/invoices" class="btn btn-secondary" style="margin-top:var(--space-3)">← Retour</a>`;
    return;
  }

  const overdue = isOverdue(inv);

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
      <a href="#/invoices" class="btn btn-secondary" style="display:flex;align-items:center;gap:var(--space-2)">
        <i data-lucide="arrow-left" style="width:14px;height:14px"></i>Retour
      </a>
    </div>

    <div class="card" style="padding:var(--space-5);border-radius:var(--radius-lg);background:var(--bg-elevated);margin-bottom:var(--space-4)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
        <div>
          <h1 style="margin:0">${escapeHtml(inv.invoice_number || `Facture #${inv.id}`)}</h1>
          <p class="text-secondary" style="margin:var(--space-1) 0 0">${escapeHtml(inv.supplier_name || 'Fournisseur inconnu')}</p>
        </div>
        ${statusBadge(inv.status)}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
        <div><div class="text-secondary text-xs">Date facture</div><div>${fmtDate(inv.invoice_date)}</div></div>
        <div><div class="text-secondary text-xs">Échéance</div>
          <div style="${overdue ? 'color:#ef4444;font-weight:600' : ''}">${fmtDate(inv.due_date)}${overdue ? ' (en retard)' : ''}</div>
        </div>
        <div><div class="text-secondary text-xs">Total HT</div><div>${fmtEur(inv.total_ht)}</div></div>
        <div><div class="text-secondary text-xs">TVA</div><div>${fmtEur(inv.tva_amount)}</div></div>
        <div><div class="text-secondary text-xs">Total TTC</div><div style="font-size:var(--text-lg);font-weight:600">${fmtEur(inv.total_ttc)}</div></div>
        ${inv.payment_date ? `<div><div class="text-secondary text-xs">Payée le</div><div>${fmtDate(inv.payment_date.slice(0,10))}</div></div>` : ''}
        ${inv.payment_method ? `<div><div class="text-secondary text-xs">Mode</div><div>${escapeHtml(inv.payment_method)}</div></div>` : ''}
      </div>

      ${(inv.delivery_note_id || inv.purchase_order_id) ? `
        <div class="text-secondary text-sm" style="margin-bottom:var(--space-3)">
          ${inv.delivery_note_id ? `BL lié : <a href="#/deliveries/${inv.delivery_note_id}">#${inv.delivery_note_id}</a> · ` : ''}
          ${inv.purchase_order_id ? `Commande : #${inv.purchase_order_id}` : ''}
        </div>
      ` : ''}

      ${inv.notes ? `<div style="margin-bottom:var(--space-3);padding:var(--space-3);background:var(--bg-base);border-radius:var(--radius-md)">
        <div class="text-secondary text-xs">Notes</div>
        <div style="white-space:pre-wrap">${escapeHtml(inv.notes)}</div>
      </div>` : ''}

      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        ${renderStatusActions(inv)}
        ${inv.delivery_note_id ? `<a href="#/invoices/${inv.id}/reconcile" class="btn btn-secondary">Rapprocher BL</a>` : ''}
        ${inv.status !== 'paid' ? `<button id="invoice-edit-btn" class="btn btn-secondary">Modifier</button>` : ''}
        <button id="invoice-delete-btn" class="btn btn-secondary" style="color:#ef4444">Supprimer</button>
      </div>
    </div>

    <div class="card" style="padding:var(--space-5);border-radius:var(--radius-lg);background:var(--bg-elevated)">
      <h3 style="margin:0 0 var(--space-3)">Lignes</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="text-align:left;border-bottom:1px solid var(--border-color)">
              <th style="padding:var(--space-2)">Description</th>
              <th style="padding:var(--space-2);text-align:right">Quantité</th>
              <th style="padding:var(--space-2);text-align:right">PU HT</th>
              <th style="padding:var(--space-2);text-align:right">TVA</th>
              <th style="padding:var(--space-2);text-align:right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || []).map(it => `
              <tr style="border-bottom:1px solid var(--border-color-soft, var(--border-color))">
                <td style="padding:var(--space-2)">
                  ${escapeHtml(it.description || '—')}
                  ${it.ingredient_name ? `<div class="text-secondary text-xs">${escapeHtml(it.ingredient_name)}</div>` : ''}
                </td>
                <td style="padding:var(--space-2);text-align:right">${Number(it.quantity || 0)}</td>
                <td style="padding:var(--space-2);text-align:right">${fmtEur(it.unit_price_ht)}</td>
                <td style="padding:var(--space-2);text-align:right">${Number(it.tva_rate || 0)}%</td>
                <td style="padding:var(--space-2);text-align:right">${fmtEur(it.total_ht)}</td>
              </tr>
            `).join('')}
            ${(inv.items || []).length === 0 ? `<tr><td colspan="5" style="padding:var(--space-3);text-align:center" class="text-secondary">Aucune ligne</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindStatusActions(inv);

  const editBtn = document.getElementById('invoice-edit-btn');
  if (editBtn) editBtn.addEventListener('click', () => openInvoiceFormModal(inv));

  const delBtn = document.getElementById('invoice-delete-btn');
  if (delBtn) delBtn.addEventListener('click', async () => {
    if (!confirm('Supprimer cette facture ?')) return;
    try {
      await API.deleteInvoice(inv.id);
      showToast && showToast('Facture supprimée', 'success');
      location.hash = '#/invoices';
    } catch (e) {
      showToast && showToast(e.message || 'Erreur', 'error');
    }
  });

  if (window.lucide) lucide.createIcons({ nodes: [content] });
}

function renderStatusActions(inv) {
  // pending → validated, validated → paid, anywhere → disputed (except after paid)
  const buttons = [];
  if (inv.status === 'pending') {
    buttons.push(`<button class="btn btn-primary invoice-status-btn" data-target="validated">Valider</button>`);
  }
  if (inv.status === 'pending' || inv.status === 'validated') {
    buttons.push(`<button class="btn btn-primary invoice-status-btn" data-target="paid">Marquer payée</button>`);
  }
  if (inv.status !== 'disputed' && inv.status !== 'paid') {
    buttons.push(`<button class="btn btn-secondary invoice-status-btn" data-target="disputed" style="color:#ef4444">Litige</button>`);
  }
  if (inv.status === 'disputed') {
    buttons.push(`<button class="btn btn-primary invoice-status-btn" data-target="pending">Rouvrir</button>`);
    buttons.push(`<button class="btn btn-primary invoice-status-btn" data-target="validated">Valider</button>`);
  }
  return buttons.join('');
}

function bindStatusActions(inv) {
  document.querySelectorAll('.invoice-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      let payload = { status: target };
      if (target === 'paid') {
        const method = prompt('Mode de paiement (virement, CB, chèque…)', inv.payment_method || 'virement');
        if (method === null) return;
        payload.payment_method = method;
      }
      try {
        btn.disabled = true;
        await API.setInvoiceStatus(inv.id, payload);
        showToast && showToast('Statut mis à jour', 'success');
        renderInvoiceDetail(inv.id);
      } catch (e) {
        btn.disabled = false;
        showToast && showToast(e.message || 'Erreur', 'error');
      }
    });
  });
}

// ─── Reconciliation view ────────────────────────────────────────────────────

async function renderInvoiceReconcile(id) {
  const app = document.getElementById('app');
  app.innerHTML = `<div id="invoice-reconcile-content"><div class="skeleton skeleton-row"></div></div>`;
  const content = document.getElementById('invoice-reconcile-content');

  let result;
  try {
    result = await API.reconcileInvoice(id);
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">${escapeHtml(e.message || 'Rapprochement impossible')}</p>
      <a href="#/invoices/${id}" class="btn btn-secondary" style="margin-top:var(--space-3)">← Retour</a>`;
    return;
  }

  const s = result.summary;
  const cleanColor = s.clean ? '#22c55e' : '#E8722A';

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
      <a href="#/invoices/${id}" class="btn btn-secondary" style="display:flex;align-items:center;gap:var(--space-2)">
        <i data-lucide="arrow-left" style="width:14px;height:14px"></i>Retour
      </a>
    </div>

    <h1 style="margin-bottom:var(--space-3)">Rapprochement BL ↔ Facture</h1>

    <div class="card" style="padding:var(--space-4);border-left:4px solid ${cleanColor};border-radius:var(--radius-lg);background:var(--bg-elevated);margin-bottom:var(--space-4)">
      <strong style="color:${cleanColor}">${s.clean ? '✅ Rapprochement OK' : '⚠️ Écarts détectés'}</strong>
      <div class="text-secondary text-sm" style="margin-top:var(--space-1)">
        ${s.matched} OK · ${s.qty_discrepancies} qté · ${s.price_discrepancies} prix · ${s.missing_in_invoice} manquant facture · ${s.missing_in_delivery} manquant BL
      </div>
    </div>

    ${s.qty_discrepancies > 0 ? sectionTable('Écarts de quantité', '#E8722A',
      ['Produit', 'BL', 'Facture', 'Écart'],
      result.qty_discrepancies.map(d => [
        escapeHtml(d.description || '—'),
        Number(d.delivery_quantity || 0),
        Number(d.invoice_quantity || 0),
        `<span style="color:${d.qty_delta > 0 ? '#ef4444' : '#22c55e'}">${d.qty_delta > 0 ? '+' : ''}${d.qty_delta}</span>`,
      ])
    ) : ''}

    ${s.price_discrepancies > 0 ? sectionTable('Écarts de prix unitaire HT', '#2563eb',
      ['Produit', 'BL', 'Facture', 'Écart'],
      result.price_discrepancies.map(d => [
        escapeHtml(d.description || '—'),
        fmtEur(d.delivery_unit_price),
        fmtEur(d.invoice_unit_price),
        `<span style="color:${d.price_delta > 0 ? '#ef4444' : '#22c55e'}">${d.price_delta > 0 ? '+' : ''}${fmtEur(d.price_delta)}</span>`,
      ])
    ) : ''}

    ${s.missing_in_delivery > 0 ? sectionTable('Lignes facture sans BL', '#ef4444',
      ['Produit', 'Quantité', 'PU HT'],
      result.missing_in_delivery.map(d => [
        escapeHtml(d.description || '—'),
        Number(d.quantity || 0),
        fmtEur(d.unit_price_ht),
      ])
    ) : ''}

    ${s.missing_in_invoice > 0 ? sectionTable('Lignes BL sans facture', '#ef4444',
      ['Produit', 'Quantité', 'PU HT'],
      result.missing_in_invoice.map(d => [
        escapeHtml(d.product_name || '—'),
        Number(d.quantity || 0),
        fmtEur(d.price_per_unit),
      ])
    ) : ''}

    ${s.matched > 0 ? sectionTable('Lignes correspondantes', '#22c55e',
      ['Produit', 'Quantité', 'PU HT', 'Total HT'],
      result.matched.map(d => [
        escapeHtml(d.description || '—'),
        Number(d.invoice_quantity || 0),
        fmtEur(d.invoice_unit_price),
        fmtEur((Number(d.invoice_quantity) || 0) * (Number(d.invoice_unit_price) || 0)),
      ])
    ) : ''}
  `;

  if (window.lucide) lucide.createIcons({ nodes: [content] });
}

function sectionTable(title, color, headers, rows) {
  return `
    <div class="card" style="padding:var(--space-4);border-left:4px solid ${color};border-radius:var(--radius-lg);background:var(--bg-elevated);margin-bottom:var(--space-3)">
      <h3 style="margin:0 0 var(--space-3)">${escapeHtml(title)}</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="text-align:left;border-bottom:1px solid var(--border-color)">
              ${headers.map(h => `<th style="padding:var(--space-2)">${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `<tr style="border-bottom:1px solid var(--border-color-soft, var(--border-color))">${
              r.map((c, i) => `<td style="padding:var(--space-2);${i === 0 ? '' : 'text-align:right'}">${c}</td>`).join('')
            }</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Create / edit modal ────────────────────────────────────────────────────

async function openInvoiceFormModal(existing) {
  let suppliers = [];
  try { suppliers = await API.getSuppliers(); } catch { /* ignore */ }

  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:720px;width:95%">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center">
        <h2>${isEdit ? 'Modifier la facture' : 'Nouvelle facture'}</h2>
        <button class="btn btn-secondary modal-close-btn">×</button>
      </div>
      <div class="modal-body">
        <form id="invoice-form" style="display:grid;gap:var(--space-3)">
          <label>Fournisseur
            <select name="supplier_id" data-ui="custom" required>
              <option value="">— Choisir —</option>
              ${suppliers.map(s => `<option value="${s.id}" ${existing && existing.supplier_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <label>N° de facture
              <input type="text" name="invoice_number" data-ui="custom" value="${existing ? escapeHtml(existing.invoice_number || '') : ''}">
            </label>
            <label>Date facture
              <input type="date" name="invoice_date" data-ui="custom" value="${existing ? (existing.invoice_date || '') : ''}">
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-3)">
            <label>Total HT
              <input type="number" step="0.01" name="total_ht" data-ui="custom" value="${existing ? (existing.total_ht || 0) : 0}">
            </label>
            <label>TVA
              <input type="number" step="0.01" name="tva_amount" data-ui="custom" value="${existing ? (existing.tva_amount || 0) : 0}">
            </label>
            <label>Total TTC
              <input type="number" step="0.01" name="total_ttc" data-ui="custom" value="${existing ? (existing.total_ttc || 0) : 0}">
            </label>
          </div>
          <label>Échéance
            <input type="date" name="due_date" data-ui="custom" value="${existing ? (existing.due_date || '') : ''}">
          </label>
          <label>Notes
            <textarea name="notes" data-ui="custom" rows="3">${existing ? escapeHtml(existing.notes || '') : ''}</textarea>
          </label>
          <div style="display:flex;gap:var(--space-2);justify-content:flex-end">
            <button type="button" class="btn btn-secondary modal-close-btn">Annuler</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => overlay.remove()));

  overlay.querySelector('#invoice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      supplier_id: fd.get('supplier_id') ? Number(fd.get('supplier_id')) : null,
      invoice_number: fd.get('invoice_number') || null,
      invoice_date: fd.get('invoice_date') || null,
      due_date: fd.get('due_date') || null,
      total_ht: Number(fd.get('total_ht')) || 0,
      tva_amount: Number(fd.get('tva_amount')) || 0,
      total_ttc: Number(fd.get('total_ttc')) || 0,
      notes: fd.get('notes') || null,
    };
    try {
      if (isEdit) {
        await API.updateInvoice(existing.id, data);
        overlay.remove();
        showToast && showToast('Facture mise à jour', 'success');
        renderInvoiceDetail(existing.id);
      } else {
        const created = await API.createInvoice(data);
        overlay.remove();
        showToast && showToast('Facture créée', 'success');
        location.hash = '#/invoices/' + created.id;
      }
    } catch (err) {
      showToast && showToast(err.message || 'Erreur', 'error');
    }
  });

  if (window.lucide) lucide.createIcons({ nodes: [overlay] });
}
