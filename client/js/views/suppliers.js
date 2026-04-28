// ═══════════════════════════════════════════
// Suppliers Management
// ═══════════════════════════════════════════

async function renderSuppliers() {
  const app = document.getElementById('app');
  const isGerant = getRole() === 'gerant';

  app.innerHTML = `
    <section role="region" aria-label="Gestion des fournisseurs">
    <div class="page-header">
      <h1>Fournisseurs</h1>
      <div style="display:flex;gap:var(--space-2)">
        <a href="#/orders" class="btn btn-secondary" aria-label="Voir les commandes fournisseur">
          <i data-lucide="clipboard-pen" style="width:18px;height:18px" aria-hidden="true"></i> <span class="btn-label-desktop">Commandes</span>
        </a>
        ${isGerant ? `<button class="btn btn-secondary" onclick="location.hash='#/supplier-portal'" id="btn-portal" aria-label="Ouvrir le portail fournisseur">
          <i data-lucide="link" style="width:18px;height:18px" aria-hidden="true"></i> <span class="btn-label-desktop">Portail</span>
          <span class="portal-badge" id="portal-badge" style="display:none" aria-label="Notifications non lues"></span>
        </button>` : ''}
        <button class="btn btn-primary" onclick="showSupplierModal()" aria-label="Ajouter un nouveau fournisseur"><i data-lucide="plus" style="width:18px;height:18px" aria-hidden="true"></i> Ajouter</button>
      </div>
    </div>
    <div id="supplier-list" aria-live="polite" aria-busy="true"><div class="loading"><div class="spinner"></div></div></div>
    </section>
  `;
  lucide.createIcons();

  let suppliers = [];
  try { suppliers = await API.getSuppliers(); } catch(e) { showToast('Erreur', 'error'); }

  const listEl = document.getElementById('supplier-list');

  if (suppliers.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="truck"></i></div>
        <p>Aucun fournisseur enregistré</p>
        <button class="btn btn-primary" onclick="showSupplierModal()"><i data-lucide="plus" style="width:18px;height:18px"></i> Ajouter un fournisseur</button>
      </div>`;
    lucide.createIcons();
    return;
  }

  // Load notification badge for portal button
  if (isGerant) {
    API.getSupplierNotificationsUnread().then(({ count }) => {
      const badge = document.getElementById('portal-badge');
      if (badge && count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
      }
    }).catch(() => {});
  }

  listEl.setAttribute('aria-busy', 'false');
  listEl.innerHTML = suppliers.map(s => `
    <div class="card" role="button" tabindex="0" aria-label="Détails du fournisseur ${escapeHtml(s.name)}" onclick="showSupplierDetail(${s.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showSupplierDetail(${s.id});}">
      <div class="card-header">
        <span class="card-title">${escapeHtml(s.name)}</span>
        <span>${renderStars(s.quality_rating)}</span>
      </div>
      <div class="card-stats">
        ${s.phone ? `<div><span class="stat-value">${escapeHtml(s.phone)}</span><span class="stat-label">Téléphone</span></div>` : ''}
        ${s.email ? `<div><span class="stat-value" style="font-size:var(--text-sm)">${escapeHtml(s.email)}</span><span class="stat-label">Email</span></div>` : ''}
        ${s.contact ? `<div><span class="stat-value">${escapeHtml(s.contact)}</span><span class="stat-label">Contact</span></div>` : ''}
      </div>
      ${s.quality_notes ? `<p style="font-size:var(--text-sm);color:var(--text-tertiary);margin-top:var(--space-2);font-style:italic">${escapeHtml(s.quality_notes)}</p>` : ''}
    </div>
  `).join('');
}

function showSupplierModal(supplier = null) {
  // Clean up any existing modal
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const isEdit = !!supplier;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-sup-name" value="${escapeHtml(supplier?.name || '')}" data-ui="custom">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Contact</label>
          <input type="text" class="form-control" id="m-sup-contact" value="${escapeHtml(supplier?.contact || '')}" data-ui="custom">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" class="form-control" id="m-sup-phone" value="${escapeHtml(supplier?.phone || '')}" data-ui="custom">
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" class="form-control" id="m-sup-email" value="${escapeHtml(supplier?.email || '')}" data-ui="custom">
      </div>
      <div class="form-group">
        <label>Qualité (1-5)</label>
        <div id="m-sup-stars" class="stars" style="font-size:1.8rem;cursor:pointer">
          ${[1,2,3,4,5].map(i => `<span class="star" data-value="${i}">${i <= (supplier?.quality_rating || 3) ? '★' : '☆'}</span>`).join('')}
        </div>
        <input type="hidden" id="m-sup-rating" value="${supplier?.quality_rating || 3}">
      </div>
      <div class="form-group">
        <label>Notes qualité</label>
        <textarea class="form-control" id="m-sup-notes" rows="2" data-ui="custom">${escapeHtml(supplier?.quality_notes || '')}</textarea>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-sup-save">
          <i data-lucide="${isEdit ? 'save' : 'plus'}" style="width:18px;height:18px"></i>
          ${isEdit ? 'Enregistrer' : 'Créer'}
        </button>
        <button class="btn btn-secondary" id="m-sup-cancel">Annuler</button>
        ${isEdit ? '<button class="btn btn-danger" id="m-sup-delete"><i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer</button>' : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  // Star rating interaction
  const starsEl = overlay.querySelector('#m-sup-stars');
  const ratingInput = overlay.querySelector('#m-sup-rating');
  starsEl.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.value);
      ratingInput.value = val;
      starsEl.querySelectorAll('.star').forEach((s, i) => {
        s.textContent = i < val ? '★' : '☆';
      });
    });
  });

  overlay.querySelector('#m-sup-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#m-sup-save').onclick = async () => {
    const data = {
      name: document.getElementById('m-sup-name').value.trim(),
      contact: document.getElementById('m-sup-contact').value.trim() || null,
      phone: document.getElementById('m-sup-phone').value.trim() || null,
      email: document.getElementById('m-sup-email').value.trim() || null,
      quality_rating: parseInt(document.getElementById('m-sup-rating').value) || 3,
      quality_notes: document.getElementById('m-sup-notes').value.trim() || null
    };
    if (!data.name) { showToast('Nom requis', 'error'); return; }
    try {
      if (isEdit) {
        await API.updateSupplier(supplier.id, data);
        showToast('Fournisseur mis à jour', 'success');
      } else {
        await API.createSupplier(data);
        showToast('Fournisseur créé', 'success');
      }
      overlay.remove();
      renderSuppliers();
    } catch (e) { showToast(e.message, 'error'); }
  };

  if (isEdit) {
    overlay.querySelector('#m-sup-delete').onclick = () => {
      showConfirmModal('Supprimer ce fournisseur ?', 'Cette action est irréversible.', async () => {
        try {
          await API.deleteSupplier(supplier.id);
          showToast('Fournisseur supprimé', 'success');
          overlay.remove();
          renderSuppliers();
        } catch (e) { showToast(e.message, 'error'); }
      });
    };
  }
}

async function showSupplierDetail(id) {
  let suppliers;
  try { suppliers = await API.getSuppliers(); } catch(e) { return; }
  const sup = suppliers.find(s => s.id === id);
  if (!sup) return;
  showSupplierModal(sup);
}
