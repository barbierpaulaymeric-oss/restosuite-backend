// ═══════════════════════════════════════════
// Supplier Integrations (FoodFlow + future Metro/Transgourmet)
// ═══════════════════════════════════════════
//
// Per-supplier external-provider connection. v1 ships file-import (the
// existing supplier-portal mercuriale upload remains the input path); this
// view manages the connection metadata + lets the gérant trigger a manual
// sync when items are available locally.

function closeSupplierIntegrationModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

async function renderSupplierIntegrations() {
  const app = document.getElementById('app');
  const isGerant = getRole() === 'gerant';
  if (!isGerant) {
    app.innerHTML = `<section role="region" aria-label="Réservé au gérant"><div class="empty-state"><p>Réservé au gérant</p></div></section>`;
    return;
  }

  app.innerHTML = `
    <section role="region" aria-label="Intégrations fournisseurs">
      <div class="page-header">
        <h1>Intégrations fournisseurs</h1>
      </div>

      <p style="color:var(--text-secondary);margin-bottom:var(--space-4)">
        Connectez vos fournisseurs à <strong>FoodFlow</strong> pour synchroniser
        automatiquement leur mercuriale et notifier vos commandes. Saisissez
        votre numéro client FoodFlow à 5 chiffres (ex. <code>89764</code>).
      </p>

      <div id="si-list" aria-live="polite" aria-busy="true">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </section>
  `;
  lucide.createIcons();

  let suppliers = [];
  let integrations = [];
  try {
    [suppliers, integrations] = await Promise.all([
      API.getSuppliers(),
      API.getSupplierIntegrations(),
    ]);
  } catch (e) {
    showToast('Erreur de chargement', 'error');
    return;
  }

  const integBySupplier = new Map();
  for (const i of integrations) integBySupplier.set(i.supplier_id, i);

  const listEl = document.getElementById('si-list');
  listEl.setAttribute('aria-busy', 'false');

  if (suppliers.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="truck"></i></div>
        <p>Aucun fournisseur enregistré.</p>
        <a href="#/suppliers" class="btn btn-primary">Ajouter un fournisseur</a>
      </div>`;
    lucide.createIcons();
    return;
  }

  listEl.innerHTML = suppliers.map(s => {
    const integ = integBySupplier.get(s.id);
    if (integ) {
      const last = integ.last_sync_at
        ? `Dernière synchro&nbsp;: ${escapeHtml(integ.last_sync_at)}`
        : 'Jamais synchronisée';
      const statusBadge = integ.status === 'error'
        ? `<span class="badge badge-warn" data-ui="custom">Erreur</span>`
        : `<span class="badge badge-ok" data-ui="custom">Connecté</span>`;
      return `
        <div class="card" data-ui="custom">
          <div class="card-header">
            <span class="card-title">${escapeHtml(s.name)}</span>
            ${statusBadge}
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-1);font-size:var(--text-sm);color:var(--text-secondary)">
            <div>FoodFlow&nbsp;: <code>${escapeHtml(integ.external_id)}</code></div>
            <div>${last}</div>
            ${integ.last_sync_error ? `<div style="color:var(--color-warn)">${escapeHtml(integ.last_sync_error)}</div>` : ''}
          </div>
          <div style="display:flex;gap:var(--space-2);margin-top:var(--space-3);flex-wrap:wrap">
            <button class="btn btn-secondary" data-sync-integ="${integ.id}" data-supplier-name="${escapeHtml(s.name)}">
              <i data-lucide="refresh-ccw" style="width:16px;height:16px"></i> Synchroniser
            </button>
            <button class="btn btn-secondary" onclick="disconnectSupplierIntegration(${integ.id})">
              <i data-lucide="unplug" style="width:16px;height:16px"></i> Déconnecter
            </button>
          </div>
        </div>
      `;
    }
    return `
      <div class="card" data-ui="custom">
        <div class="card-header">
          <span class="card-title">${escapeHtml(s.name)}</span>
          <span class="badge badge-muted" data-ui="custom">Non connecté</span>
        </div>
        <div style="margin-top:var(--space-3)">
          <button class="btn btn-primary" data-connect-supplier="${s.id}" data-supplier-name="${escapeHtml(s.name)}">
            <i data-lucide="plug" style="width:16px;height:16px"></i> Connecter à FoodFlow
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();

  // Nom de fournisseur (contrôlable par tout compte du restaurant) passé par
  // data-attribut + addEventListener, jamais en onclick inline : dans un onclick
  // escapeHtml échoue (le navigateur redécode &#39; en ' avant de compiler le
  // handler → chaîne refermée → XSS). Audit 2026-07-30.
  listEl.querySelectorAll('[data-sync-integ]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showSupplierIntegrationSync(Number(btn.dataset.syncInteg), btn.dataset.supplierName || '');
    });
  });
  listEl.querySelectorAll('[data-connect-supplier]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showSupplierIntegrationConnect(Number(btn.dataset.connectSupplier), btn.dataset.supplierName || '');
    });
  });
}

function showSupplierIntegrationConnect(supplierId, supplierName) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" data-ui="custom">
      <h2>Connecter ${escapeHtml(supplierName)}</h2>
      <p style="color:var(--text-secondary);margin-bottom:var(--space-3)">
        Saisissez votre numéro client FoodFlow à 5 chiffres (visible sur votre
        compte FoodFlow ou communiqué par votre commercial, ex. <code>89764</code>).
      </p>
      <div class="form-group">
        <label for="si-extid">Référence client FoodFlow</label>
        <input type="text" id="si-extid" class="form-control" placeholder="89764" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" data-ui="custom" autofocus>
      </div>
      <div style="display:flex;gap:var(--space-2);justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeSupplierIntegrationModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitSupplierIntegrationConnect(${supplierId})">Connecter</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
}

async function submitSupplierIntegrationConnect(supplierId) {
  const externalId = (document.getElementById('si-extid').value || '').trim();
  if (!externalId) {
    showToast('Référence client FoodFlow requise', 'error');
    return;
  }
  try {
    await API.createSupplierIntegration({
      supplier_id: supplierId,
      provider: 'foodflow',
      external_id: externalId,
    });
    showToast('Fournisseur connecté à FoodFlow');
    closeSupplierIntegrationModal();
    renderSupplierIntegrations();
  } catch (e) {
    showToast(e.message || 'Erreur', 'error');
  }
}

function showSupplierIntegrationSync(integId, supplierName) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" data-ui="custom">
      <h2>Synchroniser ${escapeHtml(supplierName)}</h2>
      <p style="color:var(--text-secondary);margin-bottom:var(--space-3)">
        Mode v1 (file-import)&nbsp;: collez la mercuriale au format JSON
        (<code>[{"name":"…","unit":"kg","price":1.2}]</code>) ou demandez au
        fournisseur de la téléverser via le portail. La synchronisation directe
        FoodFlow API arrivera plus tard.
      </p>
      <div class="form-group">
        <label for="si-items">Items JSON</label>
        <textarea id="si-items" class="form-control" rows="8" data-ui="custom"
                  placeholder='[{"name":"Tomate grappe","category":"Légumes","unit":"kg","price":3.20}]'></textarea>
      </div>
      <div style="display:flex;gap:var(--space-2);justify-content:flex-end">
        <button class="btn btn-secondary" onclick="closeSupplierIntegrationModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitSupplierIntegrationSync(${integId})">Synchroniser</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();
}

async function submitSupplierIntegrationSync(integId) {
  const raw = (document.getElementById('si-items').value || '').trim();
  let items;
  try {
    items = JSON.parse(raw);
    if (!Array.isArray(items)) throw new Error('Le JSON doit être un tableau');
  } catch (e) {
    showToast('JSON invalide : ' + e.message, 'error');
    return;
  }
  try {
    const r = await API.syncSupplierIntegration(integId, items);
    showToast(`Synchronisé : ${r.created} créés, ${r.updated} mis à jour`);
    closeSupplierIntegrationModal();
    renderSupplierIntegrations();
  } catch (e) {
    showToast(e.message || 'Erreur', 'error');
  }
}

async function disconnectSupplierIntegration(integId) {
  if (!confirm('Déconnecter ce fournisseur de FoodFlow ?')) return;
  try {
    await API.deleteSupplierIntegration(integId);
    showToast('Déconnecté');
    renderSupplierIntegrations();
  } catch (e) {
    showToast(e.message || 'Erreur', 'error');
  }
}
