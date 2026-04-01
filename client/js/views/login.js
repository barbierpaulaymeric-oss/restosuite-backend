// ═══════════════════════════════════════════
// Login — Multi-account with PIN
// ═══════════════════════════════════════════

const AVATAR_COLORS = [
  '#E8722A', '#2D8B55', '#4A90D9', '#D93025', '#E5A100',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316'
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function renderAvatar(name, size = 40) {
  const color = getAvatarColor(name);
  const letter = (name || '?').charAt(0).toUpperCase();
  return `<div class="account-avatar" style="width:${size}px;height:${size}px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size * 0.45}px;color:#fff;flex-shrink:0">${letter}</div>`;
}

class LoginView {
  constructor() {
    this.screen = 'landing'; // 'landing' | 'profiles' | 'pin' | 'create-gerant' | 'fournisseur'
    this.accounts = [];
    this.selectedAccount = null;
    this.pinDigits = [];
  }

  async render() {
    const app = document.getElementById('app');
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';

    switch (this.screen) {
      case 'landing':
        this.renderLanding(app);
        break;
      case 'profiles':
        await this.renderProfiles(app);
        break;
      case 'pin':
        this.renderPinScreen(app);
        break;
      case 'create-gerant':
        this.renderCreateGerant(app);
        break;
      case 'fournisseur':
        this.renderFournisseurPage(app);
        break;
    }
  }

  renderLanding(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content">
          <div class="login-logo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" class="login-logo-svg">
              <path d="M40 6 L74 40 L40 74 L6 40 Z" fill="#E8722A" />
              <path d="M40 6 L24 24 L40 20 L56 24 Z" fill="#1B2A4A" />
              <path d="M6 40 L24 24 L40 20 L56 24 L74 40" fill="none" stroke="#1B2A4A" stroke-width="3" />
            </svg>
          </div>
          <h1 class="login-title">Resto<span class="text-accent">Suite</span> <span class="login-ai-badge">AI</span></h1>
          <p class="login-tagline">Votre cuisine tourne. Vos chiffres suivent.</p>

          <div class="login-buttons">
            <button class="login-btn login-btn--restaurant" id="btn-restaurant">
              <span class="login-btn__icon">🍽️</span>
              <span class="login-btn__text">
                <span class="login-btn__label">Restaurant</span>
                <span class="login-btn__sub">Gérer vos fiches et votre cuisine</span>
              </span>
            </button>
            <button class="login-btn login-btn--fournisseur" id="btn-fournisseur">
              <span class="login-btn__icon">🚚</span>
              <span class="login-btn__text">
                <span class="login-btn__label">Fournisseur</span>
                <span class="login-btn__sub">Catalogue et tarifs</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-restaurant').addEventListener('click', async () => {
      try {
        this.accounts = await API.getAccounts();
      } catch (e) {
        this.accounts = [];
      }

      if (this.accounts.length === 0) {
        this.screen = 'create-gerant';
      } else {
        this.screen = 'profiles';
      }
      this.render();
    });

    document.getElementById('btn-fournisseur').addEventListener('click', () => {
      this.screen = 'fournisseur';
      this.render();
    });
  }

  async renderProfiles(app) {
    try {
      this.accounts = await API.getAccounts();
    } catch (e) { /* keep existing */ }

    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:440px">
          <button class="login-back" id="login-back">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
            Retour
          </button>
          <h2 class="login-subtitle">Qui êtes-vous ?</h2>
          <p class="login-tagline">Sélectionnez votre profil</p>

          <div class="profiles-list">
            ${this.accounts.map(a => `
              <button class="profile-card" data-id="${a.id}">
                ${renderAvatar(a.name, 48)}
                <div class="profile-info">
                  <span class="profile-name">${escapeHtml(a.name)}</span>
                  <span class="profile-role">${a.role === 'gerant' ? '👑 Gérant' : '👤 Équipier'}</span>
                </div>
                <i data-lucide="chevron-right" style="width:20px;height:20px;color:var(--text-tertiary)"></i>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('login-back').addEventListener('click', () => {
      this.screen = 'landing';
      this.render();
    });

    app.querySelectorAll('.profile-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        this.selectedAccount = this.accounts.find(a => a.id === id);
        this.pinDigits = [];
        this.screen = 'pin';
        this.render();
      });
    });
  }

  renderPinScreen(app) {
    const account = this.selectedAccount;
    if (!account) { this.screen = 'profiles'; this.render(); return; }

    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content pin-content">
          <button class="login-back" id="pin-back">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
            Retour
          </button>

          <div class="pin-avatar">
            ${renderAvatar(account.name, 64)}
            <span class="pin-name">${escapeHtml(account.name)}</span>
          </div>

          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>

          <div class="pin-error" id="pin-error"></div>

          <div class="pin-pad" id="pin-pad">
            <button class="pin-key" data-digit="1">1</button>
            <button class="pin-key" data-digit="2">2</button>
            <button class="pin-key" data-digit="3">3</button>
            <button class="pin-key" data-digit="4">4</button>
            <button class="pin-key" data-digit="5">5</button>
            <button class="pin-key" data-digit="6">6</button>
            <button class="pin-key" data-digit="7">7</button>
            <button class="pin-key" data-digit="8">8</button>
            <button class="pin-key" data-digit="9">9</button>
            <button class="pin-key pin-key--empty"></button>
            <button class="pin-key" data-digit="0">0</button>
            <button class="pin-key pin-key--delete" id="pin-delete">
              <i data-lucide="delete" style="width:24px;height:24px"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('pin-back').addEventListener('click', () => {
      this.screen = 'profiles';
      this.render();
    });

    this.setupPinHandlers();
  }

  setupPinHandlers() {
    const pad = document.getElementById('pin-pad');
    if (!pad) return;

    pad.querySelectorAll('.pin-key[data-digit]').forEach(key => {
      key.addEventListener('click', () => {
        if (this.pinDigits.length >= 4) return;
        this.pinDigits.push(key.dataset.digit);
        this.updatePinDots();

        if (this.pinDigits.length === 4) {
          this.attemptLogin();
        }
      });
    });

    document.getElementById('pin-delete')?.addEventListener('click', () => {
      this.pinDigits.pop();
      this.updatePinDots();
      document.getElementById('pin-error').textContent = '';
      document.getElementById('pin-dots').classList.remove('shake');
    });
  }

  updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < this.pinDigits.length);
    });
  }

  async attemptLogin() {
    const pin = this.pinDigits.join('');
    try {
      const account = await API.loginAccount(this.selectedAccount.id, pin);
      // Success — store in localStorage
      localStorage.setItem('restosuite_account', JSON.stringify(account));
      localStorage.removeItem('restosuite_role'); // clean up old system

      const nav = document.getElementById('nav');
      if (nav) nav.style.display = '';
      bootApp(account.role, account);
    } catch (e) {
      // Wrong PIN
      this.pinDigits = [];
      this.updatePinDots();
      const dotsEl = document.getElementById('pin-dots');
      const errorEl = document.getElementById('pin-error');
      dotsEl.classList.add('shake');
      errorEl.textContent = 'PIN incorrect';
      setTimeout(() => {
        dotsEl.classList.remove('shake');
      }, 600);
    }
  }

  renderCreateGerant(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content">
          <button class="login-back" id="create-back">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
            Retour
          </button>

          <div style="margin-bottom:var(--space-6)">
            <span style="font-size:3rem">👑</span>
          </div>
          <h2 class="login-subtitle">Créer votre compte Gérant</h2>
          <p class="login-tagline">Ce sera le compte principal avec accès complet</p>

          <div style="text-align:left;width:100%;max-width:320px;margin:0 auto">
            <div class="form-group">
              <label>Votre nom</label>
              <input type="text" class="form-control" id="create-name" placeholder="ex: Paul-Aymeric" autocomplete="off">
            </div>
            <div class="form-group">
              <label>Code PIN (4 chiffres)</label>
              <input type="password" class="form-control" id="create-pin" placeholder="••••" maxlength="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off" style="font-family:var(--font-mono);font-size:var(--text-xl);text-align:center;letter-spacing:0.5em">
            </div>
            <div class="form-group">
              <label>Confirmer le PIN</label>
              <input type="password" class="form-control" id="create-pin2" placeholder="••••" maxlength="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off" style="font-family:var(--font-mono);font-size:var(--text-xl);text-align:center;letter-spacing:0.5em">
            </div>
          </div>

          <button class="btn btn-primary" id="create-submit" style="margin-top:var(--space-4);min-width:200px">
            <i data-lucide="check" style="width:18px;height:18px"></i>
            Créer le compte
          </button>
          <div id="create-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-3);min-height:20px"></div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('create-back').addEventListener('click', () => {
      this.screen = 'landing';
      this.render();
    });

    document.getElementById('create-submit').addEventListener('click', async () => {
      const name = document.getElementById('create-name').value.trim();
      const pin = document.getElementById('create-pin').value;
      const pin2 = document.getElementById('create-pin2').value;
      const errorEl = document.getElementById('create-error');

      if (!name) { errorEl.textContent = 'Le nom est requis'; return; }
      if (!/^\d{4}$/.test(pin)) { errorEl.textContent = 'Le PIN doit être 4 chiffres'; return; }
      if (pin !== pin2) { errorEl.textContent = 'Les PIN ne correspondent pas'; return; }

      try {
        const account = await API.createAccount({ name, pin });
        // Auto-login
        localStorage.setItem('restosuite_account', JSON.stringify(account));
        localStorage.removeItem('restosuite_role');

        const nav = document.getElementById('nav');
        if (nav) nav.style.display = '';
        bootApp(account.role, account);
      } catch (e) {
        errorEl.textContent = e.message || 'Erreur lors de la création';
      }
    });
  }

  renderFournisseurPage(app) {
    renderSupplierLogin();
  }
}

// ─── Account utility ───
function getAccount() {
  try {
    const stored = localStorage.getItem('restosuite_account');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function getRole() {
  const account = getAccount();
  if (account) return account.role;
  // Fallback to old system
  return localStorage.getItem('restosuite_role');
}

function getPermissions() {
  const account = getAccount();
  if (!account) {
    // Fallback for old role system
    const role = localStorage.getItem('restosuite_role');
    if (role === 'gerant') {
      return { view_recipes: true, view_costs: true, edit_recipes: true, view_suppliers: true, export_pdf: true };
    }
    return { view_recipes: true, view_costs: false, edit_recipes: false, view_suppliers: false, export_pdf: false };
  }
  return account.permissions || {};
}

function applyRole(role) {
  document.body.className = role ? `role-${role}` : '';
  // Apply permission-based visibility
  const perms = getPermissions();
  document.body.classList.toggle('perm-no-costs', !perms.view_costs);
  document.body.classList.toggle('perm-no-edit', !perms.edit_recipes);
  document.body.classList.toggle('perm-no-suppliers', !perms.view_suppliers);
  document.body.classList.toggle('perm-no-export', !perms.export_pdf);
}

function logout() {
  localStorage.removeItem('restosuite_account');
  localStorage.removeItem('restosuite_role');
  document.body.className = '';
  location.hash = '';
  location.reload();
}
