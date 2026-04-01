// ═══════════════════════════════════════════
// Supplier Portal — Management (Restaurant side)
// ═══════════════════════════════════════════

async function renderSupplierPortalManage() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <button class="btn btn-secondary btn-sm" onclick="location.hash='#/suppliers'">
          <i data-lucide="arrow-left" style="width:16px;height:16px"></i>
        </button>
        <h1>Portail Fournisseur</h1>
      </div>
      <button class="btn btn-primary" id="btn-invite-supplier">
        <i data-lucide="user-plus" style="width:18px;height:18px"></i> Inviter
      </button>
    </div>

    <!-- Notifications -->
    <div id="portal-notifications" style="margin-bottom:var(--space-6)"></div>

    <!-- Supplier accounts list -->
    <div id="portal-accounts"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  document.getElementById('btn-invite-supplier').addEventListener('click', showInviteSupplierModal);

  await Promise.all([
    loadPortalNotifications(),
    loadPortalAccounts()
  ]);
}

async function loadPortalNotifications() {
  const container = document.getElementById('portal-notifications');
  if (!container) return;

  try {
    const [notifications, unread] = await Promise.all([
      API.getSupplierNotifications(),
      API.getSupplierNotificationsUnread()
    ]);

    const unreadNotifs = notifications.filter(n => !n.read);

    if (unreadNotifs.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="card" style="border-left:3px solid var(--color-info)">
        <div class="card-header" style="margin-bottom:var(--space-3)">
          <span class="card-title">
            <i data-lucide="bell" style="width:18px;height:18px;color:var(--color-info)"></i>
            Notifications <span class="badge badge-info">${unreadNotifs.length}</span>
          </span>
          <button class="btn btn-secondary btn-sm" id="btn-mark-all-read">Tout marquer lu</button>
        </div>
        <div class="notification-list">
          ${unreadNotifs.slice(0, 10).map(n => `
            <div class="notification-item" data-id="${n.id}">
              <div class="notification-icon">${getChangeIcon(n.change_type)}</div>
              <div class="notification-content">
                <strong>${escapeHtml(n.supplier_name)}</strong> — ${escapeHtml(n.product_name)}
                <br><span class="text-secondary text-sm">${getChangeLabel(n)}</span>
              </div>
              <button class="btn-icon" title="Marquer comme lu" data-dismiss="${n.id}">
                <i data-lucide="check" style="width:16px;height:16px"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    lucide.createIcons();

    document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
      await API.markAllNotificationsRead();
      loadPortalNotifications();
    });

    container.querySelectorAll('[data-dismiss]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await API.markNotificationRead(btn.dataset.dismiss);
        loadPortalNotifications();
      });
    });
  } catch (e) {
    container.innerHTML = '';
  }
}

function getChangeIcon(type) {
  switch (type) {
    case 'new': return '🆕';
    case 'update': return '💰';
    case 'removed': return '🗑️';
    case 'unavailable': return '⚠️';
    default: return '📦';
  }
}

function getChangeLabel(n) {
  switch (n.change_type) {
    case 'new':
      return `Nouveau produit — ${formatCurrency(n.new_price)}`;
    case 'update':
      return `Prix: ${formatCurrency(n.old_price)} → ${formatCurrency(n.new_price)}`;
    case 'removed':
      return `Produit retiré du catalogue`;
    case 'unavailable':
      return `Produit temporairement indisponible`;
    default:
      return 'Modification';
  }
}

async function loadPortalAccounts() {
  const container = document.getElementById('portal-accounts');
  if (!container) return;

  try {
    const accounts = await API.getSupplierAccounts();

    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="link"></i></div>
          <p>Aucun fournisseur connecté au portail</p>
          <p class="text-secondary text-sm">Invitez vos fournisseurs pour qu'ils mettent à jour leurs catalogues directement</p>
          <button class="btn btn-primary" onclick="showInviteSupplierModal()">
            <i data-lucide="user-plus" style="width:18px;height:18px"></i> Inviter un fournisseur
          </button>
        </div>`;
      lucide.createIcons();
      return;
    }

    container.innerHTML = accounts.map(a => `
      <div class="card" style="margin-bottom:var(--space-3)">
        <div class="card-header">
          <div>
            <span class="card-title">${escapeHtml(a.supplier_name || a.name)}</span>
            <span class="text-secondary text-sm" style="display:block;margin-top:2px">
              ${a.email ? escapeHtml(a.email) : 'Pas d\'email'}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <span class="badge ${a.last_login ? 'badge-success' : 'badge-warning'}">
              ${a.last_login ? 'Actif' : 'Jamais connecté'}
            </span>
          </div>
        </div>
        <div class="card-stats" style="margin-top:var(--space-3)">
          <div>
            <span class="stat-value text-sm">${a.last_login ? new Date(a.last_login).toLocaleDateString('fr-FR') : '—'}</span>
            <span class="stat-label">Dernière connexion</span>
          </div>
          <div>
            <span class="stat-value text-sm">${new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
            <span class="stat-label">Invité le</span>
          </div>
        </div>
        <div style="margin-top:var(--space-3);display:flex;gap:var(--space-2)">
          <button class="btn btn-danger btn-sm" onclick="revokeSupplierAccess(${a.id}, '${escapeHtml(a.supplier_name || a.name)}')">
            <i data-lucide="user-x" style="width:14px;height:14px"></i> Révoquer
          </button>
        </div>
      </div>
    `).join('');
    lucide.createIcons();
  } catch (e) {
    container.innerHTML = `<p class="text-danger">Erreur de chargement</p>`;
  }
}

async function showInviteSupplierModal() {
  let suppliers = [];
  try { suppliers = await API.getSuppliers(); } catch (e) { /* ignore */ }

  // Filter out suppliers that already have portal accounts
  let existingAccounts = [];
  try { existingAccounts = await API.getSupplierAccounts(); } catch (e) { /* ignore */ }
  const existingSupplierIds = new Set(existingAccounts.map(a => a.supplier_id));
  const availableSuppliers = suppliers.filter(s => !existingSupplierIds.has(s.id));

  if (availableSuppliers.length === 0) {
    showToast('Tous vos fournisseurs ont déjà un accès portail', 'info');
    return;
  }

  // Generate random 4-digit PIN
  const randomPin = String(Math.floor(1000 + Math.random() * 9000));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Inviter un fournisseur</h2>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-4)">
        Créez un accès portail pour que votre fournisseur puisse gérer son catalogue directement.
      </p>
      <div class="form-group">
        <label>Fournisseur</label>
        <select class="form-control" id="m-invite-supplier">
          <option value="">— Choisir —</option>
          ${availableSuppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Code PIN à communiquer</label>
        <input type="text" class="form-control" id="m-invite-pin" value="${randomPin}"
               style="font-family:var(--font-mono);font-size:var(--text-xl);text-align:center;letter-spacing:0.3em"
               maxlength="6" inputmode="numeric">
        <small class="text-secondary">Communiquez ce code au fournisseur par téléphone ou email</small>
      </div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-invite-save">
          <i data-lucide="send" style="width:18px;height:18px"></i> Créer l'accès
        </button>
        <button class="btn btn-secondary" id="m-invite-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  overlay.querySelector('#m-invite-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#m-invite-save').onclick = async () => {
    const supplier_id = document.getElementById('m-invite-supplier').value;
    const pin = document.getElementById('m-invite-pin').value.trim();

    if (!supplier_id) { showToast('Sélectionnez un fournisseur', 'error'); return; }
    if (!/^\d{4,6}$/.test(pin)) { showToast('Le PIN doit être entre 4 et 6 chiffres', 'error'); return; }

    try {
      await API.inviteSupplier({ supplier_id: parseInt(supplier_id), pin });
      showToast('Accès créé ! Communiquez le PIN au fournisseur.', 'success');
      overlay.remove();
      loadPortalAccounts();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };
}

async function revokeSupplierAccess(id, name) {
  if (!confirm(`Révoquer l'accès portail de "${name}" ?`)) return;
  try {
    await API.revokeSupplierAccess(id);
    showToast('Accès révoqué', 'success');
    loadPortalAccounts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
