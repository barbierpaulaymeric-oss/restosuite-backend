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

    <!-- Staff Password Section -->
    <div style="background:var(--bg-card);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-5);border:1px solid var(--border-color)">
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
        <i data-lucide="lock" style="width:20px;height:20px;color:var(--color-accent)"></i>
        <h3 style="margin:0;font-size:var(--text-lg)">Mot de passe équipe</h3>
      </div>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-3)">Ce mot de passe est partagé avec votre staff pour accéder au restaurant. Chaque membre crée ensuite son propre PIN personnel.</p>
      <div style="display:flex;gap:var(--space-2);align-items:center">
        <input type="password" class="form-control" id="staff-password-input" placeholder="Nouveau mot de passe" autocomplete="new-password" style="max-width:280px">
        <button class="btn btn-ghost" id="staff-password-toggle" style="padding:8px" title="Afficher/masquer">
          <i data-lucide="eye" style="width:18px;height:18px" id="staff-password-eye"></i>
        </button>
        <button class="btn btn-primary" id="staff-password-save-btn">Enregistrer</button>
      </div>
      <div id="staff-password-message" style="margin-top:var(--space-2);font-size:var(--text-sm)"></div>
    </div>

    <div id="team-list"><div class="loading"><div class="spinner"></div></div></div>

    <!-- Danger Zone — styled to match site DA -->
    <div style="margin-top:var(--space-8);padding:var(--space-4);border:1px solid rgba(217,48,37,0.3);border-radius:var(--radius-lg);background:linear-gradient(135deg, rgba(217,48,37,0.05), transparent)">
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
        <i data-lucide="alert-triangle" style="width:20px;height:20px;color:var(--color-danger)"></i>
        <h3 style="color:var(--color-danger);margin:0;font-size:var(--text-base)">Zone dangereuse</h3>
      </div>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-3)">Supprimer votre compte et toutes les données du restaurant. Cette action est irréversible.</p>
      <button class="btn btn-sm" id="delete-account-btn" style="color:var(--color-danger);border:1px solid rgba(217,48,37,0.4);background:transparent;border-radius:var(--radius-md);padding:8px 16px;transition:var(--transition-base)">
        <i data-lucide="trash-2" style="width:14px;height:14px"></i> Supprimer mon compte
      </button>
    </div>
  `;
  lucide.createIcons();

  // Toggle password visibility
  document.getElementById('staff-password-toggle').addEventListener('click', () => {
    const input = document.getElementById('staff-password-input');
    const icon = document.getElementById('staff-password-eye');
    if (input.type === 'password') {
      input.type = 'text';
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  });

  // Delete own account handler
  document.getElementById('delete-account-btn').addEventListener('click', () => showDeleteAccountModal());

  // Staff password handler
  document.getElementById('staff-password-save-btn').addEventListener('click', async () => {
    const input = document.getElementById('staff-password-input');
    const msg = document.getElementById('staff-password-message');
    const password = input.value.trim();

    if (!password || password.length < 4) {
      msg.style.color = 'var(--color-danger)';
      msg.textContent = 'Le mot de passe doit faire au moins 4 caractères';
      return;
    }

    try {
      await API.setStaffPassword(password);
      msg.style.color = 'var(--color-success)';
      msg.textContent = 'Mot de passe enregistré ✓';
      input.value = '';
      setTimeout(() => msg.textContent = '', 3000);
    } catch (e) {
      msg.style.color = 'var(--color-danger)';
      msg.textContent = e.message || 'Erreur';
    }
  });

  // Load team members
  let accounts = [];
  try {
    accounts = await API.getAccounts();
  } catch (e) {
    showToast('Erreur de chargement', 'error');
  }

  const listEl = document.getElementById('team-list');

  if (accounts.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>Aucun membre dans l\'équipe</p></div>';
    document.getElementById('add-member-btn').addEventListener('click', showAddMemberModal);
    return;
  }

  // Separate gérant from staff
  const gerant = accounts.find(a => a.role === 'gerant');
  const staff = accounts.filter(a => a.role !== 'gerant');

  let html = '';

  // Gérant card (non-editable)
  if (gerant) {
    html += `
      <div class="team-card" style="border-left:3px solid var(--color-accent)">
        <div class="team-card__header">
          ${renderAvatar(gerant.name, 44)}
          <div class="team-card__info">
            <span class="team-card__name">${escapeHtml(gerant.name)}</span>
            <span class="team-card__role">👑 Gérant</span>
          </div>
        </div>
        <div class="team-card__badge">Accès complet — non modifiable</div>
      </div>
    `;
  }

  // Staff cards with actions
  if (staff.length === 0) {
    html += `<p style="color:var(--text-tertiary);text-align:center;padding:var(--space-4)">Aucun membre d'équipe. Cliquez sur "Ajouter" pour commencer.</p>`;
  } else {
    for (const m of staff) {
      const lastLogin = m.last_login
        ? new Date(m.last_login).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'Jamais';
      const pinStatus = m.has_pin
        ? '<span style="color:var(--color-success);font-size:var(--text-xs)">PIN configuré</span>'
        : '<span style="color:var(--color-warning);font-size:var(--text-xs)">PIN non défini</span>';

      html += `
        <div class="team-card" data-member-id="${m.id}">
          <div class="team-card__header">
            ${renderAvatar(m.name, 44)}
            <div class="team-card__info">
              <span class="team-card__name">${escapeHtml(m.name)}</span>
              <span class="team-card__role">${_getRoleLabel(m.role)}</span>
            </div>
            <div style="text-align:right;font-size:var(--text-xs);color:var(--text-tertiary)">
              ${pinStatus}<br>
              Connexion : ${lastLogin}
            </div>
          </div>
          <div class="team-card__actions" style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-3)">
            <button class="btn btn-secondary btn-sm team-action" data-action="edit" data-id="${m.id}">
              <i data-lucide="pencil" style="width:14px;height:14px"></i> Modifier
            </button>
            <button class="btn btn-secondary btn-sm team-action" data-action="permissions" data-id="${m.id}">
              <i data-lucide="shield" style="width:14px;height:14px"></i> Permissions
            </button>
            <button class="btn btn-secondary btn-sm team-action" data-action="reset-pin" data-id="${m.id}" data-name="${escapeHtml(m.name)}" ${!m.has_pin ? 'disabled title="Pas de PIN à réinitialiser"' : ''}>
              <i data-lucide="key-round" style="width:14px;height:14px"></i> Reset PIN
            </button>
            <button class="btn btn-sm team-action" data-action="delete" data-id="${m.id}" data-name="${escapeHtml(m.name)}" style="color:var(--color-danger);border:1px solid rgba(217,48,37,0.3);background:transparent">
              <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
          </div>
        </div>
      `;
    }
  }

  listEl.innerHTML = html;
  lucide.createIcons();

  // Bind action buttons
  listEl.querySelectorAll('.team-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      const name = btn.dataset.name;
      const member = staff.find(m => m.id === id);

      switch (action) {
        case 'edit':
          showEditMemberModal(member);
          break;
        case 'permissions':
          showPermissionsModal(id);
          break;
        case 'reset-pin':
          await handleResetPin(id, name);
          break;
        case 'delete':
          await deleteTeamMember(id, name);
          break;
      }
    });
  });

  document.getElementById('add-member-btn').addEventListener('click', showAddMemberModal);
}

// ─── Add Member Modal ───
function showAddMemberModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Ajouter un membre</h2>
      <p style="color:var(--text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-4)">Le membre créera son propre code PIN lors de sa première connexion.</p>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-member-name" placeholder="Prénom ou surnom" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Rôle</label>
        <div style="display:flex;gap:var(--space-2)">
          <select class="form-control" id="m-member-role" style="flex:1">
            <option value="cuisinier">👨‍🍳 Cuisinier — cuisine + stock + HACCP</option>
            <option value="salle">🍽️ Salle — service + commandes</option>
            <option value="__custom__">✏️ Personnalisé…</option>
          </select>
          <input type="text" class="form-control" id="m-member-custom-role" placeholder="Ex: Pâtissier" style="flex:1;display:none">
        </div>
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

  const roleSelect = overlay.querySelector('#m-member-role');
  const customRoleInput = overlay.querySelector('#m-member-custom-role');
  roleSelect.addEventListener('change', () => {
    customRoleInput.style.display = roleSelect.value === '__custom__' ? '' : 'none';
    if (roleSelect.value === '__custom__') customRoleInput.focus();
  });

  overlay.querySelector('#m-member-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#m-member-save').onclick = async () => {
    const name = document.getElementById('m-member-name').value.trim();
    let role = document.getElementById('m-member-role').value;
    if (role === '__custom__') role = document.getElementById('m-member-custom-role').value.trim();
    const errorEl = document.getElementById('m-member-error');
    const caller = getAccount();

    if (!name) { errorEl.textContent = 'Le nom est requis'; return; }
    if (!role) { errorEl.textContent = 'Le rôle est requis'; return; }

    try {
      await API.createAccount({ name, role, caller_id: caller.id });
      showToast('Membre ajouté — il créera son PIN à sa première connexion', 'success');
      overlay.remove();
      renderTeam();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur';
    }
  };

  document.getElementById('m-member-name').focus();
}

// ─── Edit Member Modal ───
function showEditMemberModal(member) {
  const isCustomRole = !['cuisinier', 'salle', 'serveur'].includes(member.role);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Modifier — ${escapeHtml(member.name)}</h2>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" class="form-control" id="m-edit-name" value="${escapeHtml(member.name)}" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Rôle</label>
        <div style="display:flex;gap:var(--space-2)">
          <select class="form-control" id="m-edit-role" style="flex:1">
            <option value="cuisinier" ${member.role === 'cuisinier' ? 'selected' : ''}>👨‍🍳 Cuisinier</option>
            <option value="salle" ${member.role === 'salle' ? 'selected' : ''}>🍽️ Salle</option>
            <option value="serveur" ${member.role === 'serveur' ? 'selected' : ''}>🍽️ Serveur</option>
            <option value="__custom__" ${isCustomRole ? 'selected' : ''}>✏️ Personnalisé…</option>
          </select>
          <input type="text" class="form-control" id="m-edit-custom-role" placeholder="Ex: Pâtissier"
                 value="${escapeHtml(isCustomRole ? member.role : '')}"
                 style="flex:1;${isCustomRole ? '' : 'display:none'}">
        </div>
      </div>
      <div id="m-edit-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn btn-primary" id="m-edit-save">
          <i data-lucide="save" style="width:18px;height:18px"></i> Enregistrer
        </button>
        <button class="btn btn-secondary" id="m-edit-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  const roleSelect = overlay.querySelector('#m-edit-role');
  const customInput = overlay.querySelector('#m-edit-custom-role');
  roleSelect.addEventListener('change', () => {
    customInput.style.display = roleSelect.value === '__custom__' ? '' : 'none';
    if (roleSelect.value === '__custom__') customInput.focus();
  });

  overlay.querySelector('#m-edit-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#m-edit-save').onclick = async () => {
    const name = document.getElementById('m-edit-name').value.trim();
    let role = document.getElementById('m-edit-role').value;
    if (role === '__custom__') role = document.getElementById('m-edit-custom-role').value.trim();
    const errorEl = document.getElementById('m-edit-error');
    const caller = getAccount();

    if (!name) { errorEl.textContent = 'Le nom est requis'; return; }
    if (!role) { errorEl.textContent = 'Le rôle est requis'; return; }

    try {
      await API.updateAccount(member.id, { name, role, caller_id: caller.id });
      showToast('Membre mis à jour', 'success');
      overlay.remove();
      renderTeam();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur';
    }
  };

  document.getElementById('m-edit-name').focus();
}

// ─── Reset PIN ───
async function handleResetPin(accountId, name) {
  showConfirmModal('Réinitialiser le PIN', `Êtes-vous sûr de vouloir réinitialiser le PIN de ${name} ?\n\nIl devra créer un nouveau PIN à sa prochaine connexion.`, async () => {
    const caller = getAccount();
    try {
      await API.resetMemberPin(accountId, caller.id);
      showToast(`PIN de ${name} réinitialisé`, 'success');
      renderTeam();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, { confirmText: 'Réinitialiser', confirmClass: 'btn btn-primary' });
  return;
}

// ─── Permissions Modal ───
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

// ─── Delete Member ───
async function deleteTeamMember(accountId, name) {
  showConfirmModal('Supprimer le compte', `Êtes-vous sûr de vouloir supprimer définitivement le compte de ${name} ?\n\nCette action est irréversible.`, async () => {
    const caller = getAccount();
    try {
      await API.deleteAccount(accountId, caller.id);
      showToast('Compte supprimé', 'success');
      renderTeam();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, { confirmText: 'Supprimer', confirmClass: 'btn btn-danger' });
  return;
}

// ─── Delete Own Account (gérant full wipe) ───
function showDeleteAccountModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2 style="color:var(--color-danger)">Supprimer mon compte</h2>
      <div style="background:rgba(217,48,37,0.06);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-4);border:1px solid rgba(217,48,37,0.15)">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;margin:0">
          Cette action va <strong style="color:var(--color-danger)">supprimer définitivement</strong> votre compte gérant, tous les comptes équipe, le restaurant et toutes ses données (recettes, stocks, fournisseurs, commandes…).
        </p>
      </div>
      <div class="form-group">
        <label style="font-weight:600">Tapez <span style="color:var(--color-danger);font-family:var(--font-mono)">SUPPRIMER</span> pour confirmer</label>
        <input type="text" class="form-control" id="m-delete-confirm" placeholder="SUPPRIMER" autocomplete="off"
               style="font-family:var(--font-mono);text-align:center;font-size:var(--text-lg);letter-spacing:0.1em">
      </div>
      <div id="m-delete-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3)"></div>
      <div class="actions-row">
        <button class="btn" id="m-delete-submit" disabled style="color:white;background:var(--color-danger);border:none;border-radius:var(--radius-md);opacity:0.5;transition:var(--transition-base)">
          <i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer définitivement
        </button>
        <button class="btn btn-secondary" id="m-delete-cancel">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  lucide.createIcons();

  const confirmInput = document.getElementById('m-delete-confirm');
  const submitBtn = document.getElementById('m-delete-submit');

  // Enable button only when user types SUPPRIMER
  confirmInput.addEventListener('input', () => {
    const match = confirmInput.value.trim() === 'SUPPRIMER';
    submitBtn.disabled = !match;
    submitBtn.style.opacity = match ? '1' : '0.5';
  });

  overlay.querySelector('#m-delete-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  submitBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('m-delete-error');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Suppression...';

    try {
      await API.deleteSelfAccount('SUPPRIMER');
      // Clear local session
      localStorage.removeItem('restosuite_token');
      localStorage.removeItem('restosuite_account');
      overlay.remove();
      // Reload to login screen
      location.reload();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur lors de la suppression';
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer définitivement';
      submitBtn.style.opacity = '1';
      if (window.lucide) lucide.createIcons();
    }
  });

  confirmInput.focus();
}
