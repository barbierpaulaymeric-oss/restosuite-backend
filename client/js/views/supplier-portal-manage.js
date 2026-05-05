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
          <div class="empty-icon"><i data-lucide="user-plus"></i></div>
          <p>Invitez vos fournisseurs à rejoindre RestoSuite</p>
          <p class="text-secondary text-sm" style="max-width:480px;margin:0 auto">
            Entrez leurs coordonnées et nous les contacterons pour créer leur compte portail —
            ils pourront alors mettre à jour leur catalogue et recevoir vos commandes directement.
          </p>
          <button class="btn btn-primary" onclick="showInviteSupplierModal()" style="margin-top:var(--space-3)">
            <i data-lucide="send" style="width:18px;height:18px"></i> Inviter un fournisseur
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
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Inviter un fournisseur</h2>
      <p class="text-secondary text-sm" style="margin-bottom:var(--space-4)">
        Entrez les coordonnées de votre fournisseur. S'il a un email, nous lui enverrons une invitation
        automatiquement. Sinon, notre équipe le contactera par téléphone pour créer son accès.
      </p>
      <div class="form-group">
        <label for="m-invite-name">Nom de l'entreprise *</label>
        <input type="text" class="form-control" id="m-invite-name" placeholder="Ex: Metro, Pomona, Terre Azur" autocomplete="off" data-ui="custom">
      </div>
      <div class="form-group">
        <label for="m-invite-contact">Personne de contact</label>
        <input type="text" class="form-control" id="m-invite-contact" placeholder="Ex: Jean Dupont (optionnel)" autocomplete="off" data-ui="custom">
      </div>
      <div class="form-group">
        <label for="m-invite-email">Email du fournisseur</label>
        <input type="email" class="form-control" id="m-invite-email" placeholder="contact@fournisseur.fr" autocomplete="off" data-ui="custom">
        <small class="text-secondary">Si renseigné, une invitation est envoyée automatiquement.</small>
      </div>
      <div class="form-group">
        <label for="m-invite-phone">Téléphone du fournisseur</label>
        <input type="tel" class="form-control" id="m-invite-phone" placeholder="01 23 45 67 89" autocomplete="off" data-ui="custom">
        <small class="text-secondary">Si seul le téléphone est fourni, nous le contacterons par appel.</small>
      </div>
      <div id="m-invite-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-invite-save">
          <i data-lucide="send" style="width:18px;height:18px"></i> Envoyer l'invitation
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
    const name = document.getElementById('m-invite-name').value.trim();
    const contact_name = document.getElementById('m-invite-contact').value.trim();
    const email = document.getElementById('m-invite-email').value.trim();
    const phone = document.getElementById('m-invite-phone').value.trim();
    const errorEl = document.getElementById('m-invite-error');

    if (!name) { errorEl.textContent = 'Le nom de l\'entreprise est requis'; return; }
    if (!email && !phone) { errorEl.textContent = 'Veuillez renseigner au moins un email ou un téléphone'; return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errorEl.textContent = 'Email invalide'; return; }

    const btn = document.getElementById('m-invite-save');
    btn.disabled = true; btn.textContent = 'Envoi…';

    try {
      const res = await API.inviteSupplierByContact({ name, contact_name, email, phone });
      overlay.remove();
      if (res.email_status === 'sent_to_supplier') {
        showToast(`Invitation envoyée à ${email}`, 'success');
      } else if (res.email_status === 'sent_to_admin') {
        showToast('Notre équipe va contacter le fournisseur par téléphone', 'success');
      } else if (res.email_status === 'error') {
        showToast(`Fournisseur créé, mais email non envoyé : ${res.email_error || 'erreur SMTP'}`, 'warning');
      } else {
        showToast('Fournisseur créé', 'success');
      }
      loadPortalAccounts();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur lors de l\'envoi de l\'invitation';
      btn.disabled = false; btn.innerHTML = '<i data-lucide="send" style="width:18px;height:18px"></i> Envoyer l\'invitation';
      if (window.lucide) lucide.createIcons();
    }
  };

  document.getElementById('m-invite-name').focus();
}

async function revokeSupplierAccess(id, name) {
  showConfirmModal('Révoquer l\'accès', `Êtes-vous sûr de vouloir révoquer l'accès portail de "${name}" ?`, async () => {
    try {
      await API.revokeSupplierAccess(id);
      showToast('Accès révoqué', 'success');
      loadPortalAccounts();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, { confirmText: 'Révoquer', confirmClass: 'btn btn-danger' });
  return;
}
