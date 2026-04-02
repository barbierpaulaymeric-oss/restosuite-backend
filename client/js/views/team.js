// ═══════════════════════════════════════════
// Team Management — Gérant only
// ═══════════════════════════════════════════

async function renderTeam() {
  const account = getAccount();
  if (!account || account.role !== 'gerant') {
    location.hash = '#/';
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <div>
        <a href="#/more" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Plus</a>
        <h1 style="margin-top:4px">Gérer l'équipe</h1>
      </div>
      <button class="btn btn-primary" id="add-member-btn">
        <i data-lucide="user-plus" style="width:18px;height:18px"></i> Ajouter
      </button>
    </div>
    <div id="team-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  let accounts = [];
  try {
    accounts = await API.getAccounts();
  } catch (e) {
    showToast('Erreur de chargement', 'error');
  }

  const listEl = document.getElementById('team-list');

  if (accounts.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>Aucun compte</p></div>';
    return;
  }

  listEl.innerHTML = accounts.map(a => {
    const lastLogin = a.last_login ? new Date(a.last_login).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Jamais';
    const isGerant = a.role === 'gerant';

    return `
      <div class="team-card">
        <div class="team-card__header">
          ${renderAvatar(a.name, 44)}
          <div class="team-card__info">
            <span class="team-card__name">${escapeHtml(a.name)}</span>
            <span class="team-card__role">${_getRoleLabel(a.role)}</span>
          </div>
          <span class="team-card__login">Dernière connexion : ${lastLogin}</span>
        </div>
        ${!isGerant ? `
        <div class="team-card__actions">
          <button class="btn btn-secondary btn-sm" onclick="showPermissionsModal(${a.id})">
            <i data-lucide="shield" style="width:16px;height:16px"></i> Permissions
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteTeamMember(${a.id}, '${escapeHtml(a.name)}')">
            <i data-lucide="trash-2" style="width:16px;height:16px"></i>
          </button>
        </div>
        ` : `
        <div class="team-card__badge">Accès complet — non modifiable</div>
        `}
      </div>
    `;
  }).join('');

  lucide.createIcons();

  document.getElementById('add-member-btn').addEventListener('click', () => {
    showAddMemberModal();
  });
}

function showAddMemberModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Ajouter un membre</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-member-name" placeholder="Prénom ou surnom" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Rôle</label>
        <select class="form-control" id="m-member-role">
          <option value="equipier">👤 Équipier — accès limité</option>
          <option value="cuisinier">👨‍🍳 Cuisinier — accès cuisine</option>
          <option value="salle">🍽️ Salle — commandes uniquement</option>
        </select>
      </div>
      <div class="form-group">
        <label>Code PIN (4 chiffres)</label>
        <input type="password" class="form-control" id="m-member-pin" placeholder="••••" maxlength="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off" style="font-family:var(--font-mono);font-size:var(--text-xl);text-align:center;letter-spacing:0.5em">
      </div>
      <div id="m-member-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-member-save">
          <i data-lucide="user-plus" style="width:18px;height:18px"></i> Créer
        </button>
        <button class="btn btn-secondary" id="m-member-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  overlay.querySelector('#m-member-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#m-member-save').onclick = async () => {
    const name = document.getElementById('m-member-name').value.trim();
    const role = document.getElementById('m-member-role').value;
    const pin = document.getElementById('m-member-pin').value;
    const errorEl = document.getElementById('m-member-error');

    if (!name) { errorEl.textContent = 'Le nom est requis'; return; }
    if (!/^\d{4}$/.test(pin)) { errorEl.textContent = 'Le PIN doit être 4 chiffres'; return; }

    try {
      await API.createAccount({ name, pin, role });
      showToast('Membre ajouté', 'success');
      overlay.remove();
      renderTeam();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur';
    }
  };
}

async function showPermissionsModal(accountId) {
  let accounts;
  try { accounts = await API.getAccounts(); } catch(e) { return; }
  const target = accounts.find(a => a.id === accountId);
  if (!target) return;

  const perms = target.permissions;
  const caller = getAccount();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Permissions — ${escapeHtml(target.name)}</h2>
      <div class="perm-list">
        <label class="perm-toggle">
          <span class="perm-toggle__label">📖 Voir les fiches techniques</span>
          <input type="checkbox" checked disabled>
          <span class="perm-toggle__hint">Toujours actif</span>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">💰 Voir les coûts et marges</span>
          <input type="checkbox" id="perm-view_costs" ${perms.view_costs ? 'checked' : ''}>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">✏️ Créer/modifier les fiches</span>
          <input type="checkbox" id="perm-edit_recipes" ${perms.edit_recipes ? 'checked' : ''}>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">🚚 Voir les fournisseurs</span>
          <input type="checkbox" id="perm-view_suppliers" ${perms.view_suppliers ? 'checked' : ''}>
        </label>
        <label class="perm-toggle">
          <span class="perm-toggle__label">📄 Exporter en PDF</span>
          <input type="checkbox" id="perm-export_pdf" ${perms.export_pdf ? 'checked' : ''}>
        </label>
      </div>
      <div class="actions-row" style="margin-top:var(--space-5)">
        <button class="btn btn-primary" id="perm-save">
          <i data-lucide="save" style="width:18px;height:18px"></i> Enregistrer
        </button>
        <button class="btn btn-secondary" id="perm-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  overlay.querySelector('#perm-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#perm-save').onclick = async () => {
    const newPerms = {
      view_recipes: true,
      view_costs: document.getElementById('perm-view_costs').checked,
      edit_recipes: document.getElementById('perm-edit_recipes').checked,
      view_suppliers: document.getElementById('perm-view_suppliers').checked,
      export_pdf: document.getElementById('perm-export_pdf').checked
    };

    try {
      await API.updateAccount(accountId, { permissions: newPerms, caller_id: caller.id });
      showToast('Permissions mises à jour', 'success');
      overlay.remove();
      renderTeam();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };
}

async function deleteTeamMember(accountId, name) {
  if (!confirm(`Supprimer le compte de ${name} ?`)) return;
  const caller = getAccount();
  try {
    await API.deleteAccount(accountId, caller.id);
    showToast('Compte supprimé', 'success');
    renderTeam();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
