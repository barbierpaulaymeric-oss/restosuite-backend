// ═══════════════════════════════════════════
// Deliveries — Restaurant-side delivery management
// ═══════════════════════════════════════════

function formatDeliveryDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (_) { return dateStr; }
}

async function renderDeliveries() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div>
        <h1><i data-lucide="truck" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Livraisons</h1>
        <p class="text-secondary">Réception et suivi des bons de livraison</p>
      </div>
      <a href="#/haccp/reception" class="btn btn-accent" style="display:flex;align-items:center;gap:var(--space-2)">
        <i data-lucide="plus" style="width:16px;height:16px"></i>
        Nouvelle réception
      </a>
    </div>
    <div class="delivery-tabs" style="display:flex;gap:var(--space-2);margin-bottom:var(--space-5);flex-wrap:wrap">
      <button class="btn btn-accent delivery-tab active" data-status="">Tous</button>
      <button class="btn btn-secondary delivery-tab" data-status="pending">🟠 En attente</button>
      <button class="btn btn-secondary delivery-tab" data-status="received">🟢 Reçus</button>
      <button class="btn btn-secondary delivery-tab" data-status="partial">🟡 Partiels</button>
      <button class="btn btn-secondary delivery-tab" data-status="rejected">🔴 Refusés</button>
    </div>
    <div id="dlc-alerts-banner"></div>
    <div id="deliveries-content">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;

  // Tab switching
  document.querySelectorAll('.delivery-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.delivery-tab').forEach(t => {
        t.classList.remove('active', 'btn-accent');
        t.classList.add('btn-secondary');
      });
      tab.classList.add('active', 'btn-accent');
      tab.classList.remove('btn-secondary');
      loadDeliveries(tab.dataset.status || null);
    });
  });

  // Load DLC alerts
  try {
    const alerts = await API.getDlcAlerts();
    const banner = document.getElementById('dlc-alerts-banner');
    if (alerts.length > 0) {
      banner.innerHTML = `
        <div style="background:var(--color-warning-light, #fff3cd);border:1px solid var(--color-warning, #ffc107);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5)">
          <h3 style="color:var(--color-warning-dark, #856404);margin-bottom:var(--space-2)"><i data-lucide="alert-triangle" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>${alerts.length} produit${alerts.length > 1 ? 's' : ''} avec DLC proche</h3>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
            ${alerts.map(a => `
              <span class="badge" style="background:${a.days_remaining <= 1 ? 'var(--color-danger)' : 'var(--color-warning)'};color:white;font-size:var(--text-sm);padding:4px 10px;border-radius:var(--radius-md)">
                ${escapeHtml(a.product_name)} — Lot ${escapeHtml(a.batch_number || '?')} — DLC ${a.dlc} (${a.days_remaining}j)
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }
  } catch (e) { /* ignore */ }

  await loadDeliveries();
}

async function loadDeliveries(status) {
  const content = document.getElementById('deliveries-content');
  try {
    const deliveries = await API.getDeliveries(status);
    if (deliveries.length === 0) {
      content.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:var(--space-8)">
          <div style="font-size:3rem;margin-bottom:var(--space-3)">🚚</div>
          <h3>Aucune livraison</h3>
          <p class="text-secondary">Les bons de livraison créés par vos fournisseurs apparaîtront ici.</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-4)">
        ${deliveries.map(d => renderDeliveryCard(d)).join('')}
      </div>
    `;

    // Bind click handlers
    content.querySelectorAll('.delivery-card').forEach(card => {
      card.addEventListener('click', () => {
        renderDeliveryDetail(Number(card.dataset.id));
      });
    });
  } catch (e) {
    content.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function renderDeliveryCard(d) {
  const statusColors = { pending: '#E8722A', received: '#22c55e', partial: '#eab308', rejected: '#ef4444' };
  const statusLabels = { pending: '🟠 En attente', received: '🟢 Reçu', partial: '🟡 Partiel', rejected: '🔴 Refusé' };
  const borderColor = statusColors[d.status] || '#666';

  return `
    <div class="card delivery-card" data-id="${d.id}" style="padding:var(--space-4);border-left:4px solid ${borderColor};border-radius:var(--radius-lg);background:var(--bg-elevated);cursor:pointer;transition:transform 0.15s">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3)">
        <div>
          <h3 style="font-size:var(--text-base);font-weight:600;margin:0">${escapeHtml(d.supplier_name)}</h3>
          <span class="text-secondary text-sm">Bon #${d.id}</span>
        </div>
        <span class="badge" style="background:${borderColor};color:white;font-size:var(--text-xs);padding:2px 8px;border-radius:var(--radius-md)">
          ${statusLabels[d.status] || d.status}
        </span>
      </div>
      <div style="display:flex;gap:var(--space-4);font-size:var(--text-sm);color:var(--text-secondary)">
        <span>📅 ${formatDeliveryDate(d.delivery_date) || new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
        <span>📦 ${d.item_count} produit${d.item_count > 1 ? 's' : ''}</span>
        ${d.total_amount ? `<span>💰 ${d.total_amount.toFixed(2)}€</span>` : ''}
      </div>
    </div>
  `;
}

async function renderDeliveryDetail(id) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="padding:var(--space-4)">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row"></div>
    </div>
  `;

  try {
    const d = await API.getDelivery(id);
    const account = getAccount();
    const isPending = d.status === 'pending';

    app.innerHTML = `
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3)">
        <div>
          <button class="btn btn-secondary btn-sm" id="back-deliveries" style="margin-bottom:var(--space-2)">
            ← Retour
          </button>
          <h1><i data-lucide="truck" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"></i>Bon #${d.id} — ${escapeHtml(d.supplier_name)}</h1>
          <p class="text-secondary">
            ${d.delivery_date ? `Livraison prévue : ${formatDeliveryDate(d.delivery_date)}` : `Créé le ${new Date(d.created_at).toLocaleDateString('fr-FR')}`}
            ${d.received_at ? ` — Réceptionné le ${new Date(d.received_at).toLocaleDateString('fr-FR')} par ${escapeHtml(d.received_by_name || '?')}` : ''}
          </p>
        </div>
      </div>
      ${d.notes ? `<div style="background:var(--bg-sunken);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-4);font-size:var(--text-sm)">📝 ${escapeHtml(d.notes)}</div>` : ''}
      <div style="overflow-x:auto;margin-bottom:var(--space-5)">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="background:var(--bg-sunken);text-align:left">
              <th style="padding:var(--space-3)">Produit</th>
              <th style="padding:var(--space-3)">Qté</th>
              <th style="padding:var(--space-3)">N° Lot</th>
              <th style="padding:var(--space-3)">DLC</th>
              <th style="padding:var(--space-3)">T° requise</th>
              ${isPending ? '<th style="padding:var(--space-3)">T° mesurée</th>' : ''}
              <th style="padding:var(--space-3)">Infos</th>
              ${isPending ? '<th style="padding:var(--space-3)">Action</th>' : '<th style="padding:var(--space-3)">Statut</th>'}
            </tr>
          </thead>
          <tbody>
            ${d.items.map(item => renderDeliveryItemRow(item, isPending)).join('')}
          </tbody>
        </table>
      </div>
      ${d.total_amount ? `<p style="text-align:right;font-weight:600;font-size:var(--text-lg);margin-bottom:var(--space-4)">Total : ${d.total_amount.toFixed(2)} €</p>` : ''}
      ${isPending ? `
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;justify-content:flex-end;margin-bottom:var(--space-4)">
          <div class="form-group" style="flex:1;max-width:400px">
            <label class="form-label">Notes de réception</label>
            <textarea id="reception-notes" class="input" rows="2" placeholder="Notes optionnelles..."></textarea>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
          <button class="btn btn-accent btn-lg" id="btn-accept-all">✅ Tout accepter</button>
          <button class="btn btn-primary btn-lg" id="btn-validate-selection">📋 Valider la sélection</button>
        </div>
        <p class="text-secondary text-sm" style="text-align:right;margin-top:var(--space-2)">
          Réceptionné par : <strong>${escapeHtml(account ? account.name : '?')}</strong>
        </p>
      ` : ''}
    `;

    document.getElementById('back-deliveries').addEventListener('click', () => renderDeliveries());

    if (isPending) {
      // Accept all
      document.getElementById('btn-accept-all').addEventListener('click', () => {
        document.querySelectorAll('.item-action-select').forEach(sel => sel.value = 'accepted');
        submitReception(d);
      });

      // Validate selection
      document.getElementById('btn-validate-selection').addEventListener('click', () => submitReception(d));
    }

    if (window.lucide) lucide.createIcons();
  } catch (e) {
    app.innerHTML = `<p style="color:var(--color-danger);padding:var(--space-4)">Erreur : ${escapeHtml(e.message)}</p>`;
  }
}

function renderDeliveryItemRow(item, isPending) {
  const dlcDays = item.dlc ? Math.ceil((new Date(item.dlc) - new Date()) / 86400000) : null;
  const dlcWarning = dlcDays !== null && dlcDays <= 3;
  const statusColors = { accepted: '#22c55e', rejected: '#ef4444', pending: '#888' };
  const statusLabels = { accepted: '✅ Accepté', rejected: '❌ Refusé', pending: '⏳ En attente' };

  // Extra info (fishing/meat)
  const extraInfo = [];
  if (item.fishing_zone) extraInfo.push(`🎣 Zone ${item.fishing_zone}`);
  if (item.fishing_method) extraInfo.push(`🪝 ${item.fishing_method}`);
  if (item.origin) extraInfo.push(`🏷️ ${item.origin}`);
  if (item.sanitary_approval) extraInfo.push(`📋 Agr. ${item.sanitary_approval}`);

  return `
    <tr style="border-bottom:1px solid var(--border-default)" data-item-id="${item.id}">
      <td style="padding:var(--space-3);font-weight:500">${escapeHtml(item.product_name)}</td>
      <td style="padding:var(--space-3)">${formatQuantity(item.quantity, item.unit)}</td>
      <td style="padding:var(--space-3);font-family:var(--font-mono,monospace);font-size:var(--text-xs)">${escapeHtml(item.batch_number || '—')}</td>
      <td style="padding:var(--space-3);${dlcWarning ? 'color:var(--color-warning);font-weight:700' : ''}">
        ${item.dlc || '—'}
        ${dlcWarning ? `<br><small style="color:${dlcDays <= 1 ? 'var(--color-danger)' : 'var(--color-warning)'}">⚠️ ${dlcDays}j restant${dlcDays > 1 ? 's' : ''}</small>` : ''}
      </td>
      <td style="padding:var(--space-3)">${item.temperature_required != null ? item.temperature_required + '°C' : '—'}</td>
      ${isPending ? `
        <td style="padding:var(--space-3)">
          <input type="number" class="input item-temp" step="0.1" value="${item.temperature_required ?? ''}"
                 style="width:80px;font-size:var(--text-sm)" data-item-id="${item.id}" data-temp-required="${item.temperature_required ?? ''}">
          <span class="temp-warning" data-item-id="${item.id}" style="display:none;color:var(--color-danger);font-size:var(--text-xs);font-weight:700">⚠️ T° trop haute !</span>
        </td>
      ` : ''}
      <td style="padding:var(--space-3);font-size:var(--text-xs)">${extraInfo.length ? extraInfo.join('<br>') : '—'}</td>
      ${isPending ? `
        <td style="padding:var(--space-3)">
          <select class="input item-action-select" data-item-id="${item.id}" style="font-size:var(--text-sm)">
            <option value="accepted">✅ Accepter</option>
            <option value="rejected">❌ Refuser</option>
          </select>
          <input type="text" class="input item-rejection-reason" data-item-id="${item.id}" placeholder="Motif refus..."
                 style="display:none;margin-top:4px;font-size:var(--text-xs);width:140px">
        </td>
      ` : `
        <td style="padding:var(--space-3)">
          <span style="color:${statusColors[item.status] || '#888'};font-weight:600">${statusLabels[item.status] || item.status}</span>
          ${item.rejection_reason ? `<br><small style="color:var(--text-tertiary)">${escapeHtml(item.rejection_reason)}</small>` : ''}
          ${item.temperature_measured != null ? `<br><small>T° mesurée : ${item.temperature_measured}°C</small>` : ''}
        </td>
      `}
    </tr>
  `;
}

// Bind temperature warning + rejection reason toggle after render
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('item-temp')) {
    const tempReq = parseFloat(e.target.dataset.tempRequired);
    const tempMeasured = parseFloat(e.target.value);
    const warning = document.querySelector(`.temp-warning[data-item-id="${e.target.dataset.itemId}"]`);
    if (warning && !isNaN(tempReq) && !isNaN(tempMeasured) && tempMeasured > tempReq) {
      warning.style.display = 'block';
    } else if (warning) {
      warning.style.display = 'none';
    }
  }
  if (e.target.classList.contains('item-action-select')) {
    const reasonInput = document.querySelector(`.item-rejection-reason[data-item-id="${e.target.dataset.itemId}"]`);
    if (reasonInput) {
      reasonInput.style.display = e.target.value === 'rejected' ? 'block' : 'none';
    }
  }
});

async function submitReception(delivery) {
  const items = delivery.items.map(item => {
    const select = document.querySelector(`.item-action-select[data-item-id="${item.id}"]`);
    const tempInput = document.querySelector(`.item-temp[data-item-id="${item.id}"]`);
    const reasonInput = document.querySelector(`.item-rejection-reason[data-item-id="${item.id}"]`);

    return {
      id: item.id,
      status: select ? select.value : 'accepted',
      temperature_measured: tempInput ? parseFloat(tempInput.value) || null : null,
      rejection_reason: reasonInput ? reasonInput.value || null : null
    };
  });

  const receptionNotes = document.getElementById('reception-notes')?.value || null;

  try {
    const result = await API.receiveDelivery(delivery.id, { items, reception_notes: receptionNotes });
    showToast(`Réception enregistrée : ${result.accepted} accepté(s), ${result.rejected} refusé(s)`, 'success');
    renderDeliveryDetail(delivery.id);
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}
