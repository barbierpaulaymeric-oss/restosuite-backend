// ═══════════════════════════════════════════
// Login — Email/Password + PIN rapide
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
    this.mode = 'login'; // 'login' | 'register' | 'pin'
  }

  async render() {
    const app = document.getElementById('app');
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';

    switch (this.mode) {
      case 'login': this.renderLogin(app); break;
      case 'register': this.renderRegister(app); break;
      case 'pin': this.renderPinLogin(app); break;
    }
  }

  renderLogin(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <div class="login-logo">
            <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 80px; width: auto;">
          </div>
          <h1 class="login-title">Resto<span class="text-accent">Suite</span> <span class="login-ai-badge">AI</span></h1>
          <p class="login-tagline">Votre cuisine tourne. Vos chiffres suivent.</p>

          <div class="auth-tabs" style="display:flex;gap:0;margin-bottom:var(--space-5);border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-primary)">
            <button class="auth-tab active" id="tab-login" style="flex:1;padding:10px;font-weight:600;font-size:var(--text-sm);border:none;cursor:pointer;background:var(--color-primary);color:#fff;transition:all 0.2s">Connexion</button>
            <button class="auth-tab" id="tab-register" style="flex:1;padding:10px;font-weight:600;font-size:var(--text-sm);border:none;cursor:pointer;background:var(--bg-secondary);color:var(--text-secondary);transition:all 0.2s">Inscription</button>
          </div>

          <div style="text-align:left;width:100%">
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="login-email" placeholder="votre@email.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label>Mot de passe</label>
              <input type="password" class="form-control" id="login-password" placeholder="••••••••" autocomplete="current-password">
            </div>
          </div>

          <div id="login-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);min-height:20px"></div>

          <button class="btn btn-primary" id="login-submit" style="margin-top:var(--space-3);width:100%;padding:12px;font-size:var(--text-base)">
            Se connecter
          </button>

          <div style="margin-top:var(--space-4);text-align:center">
            <a href="#" id="forgot-password" style="color:var(--text-tertiary);font-size:var(--text-sm);text-decoration:none;cursor:not-allowed;opacity:0.5">Mot de passe oublié ?</a>
          </div>

          <div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--border-primary);text-align:center">
            <a href="#" id="pin-login-link" style="color:var(--text-secondary);font-size:var(--text-sm);text-decoration:none">
              🔢 Connexion rapide par PIN (équipiers)
            </a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('tab-register').addEventListener('click', () => {
      this.mode = 'register';
      this.render();
    });

    document.getElementById('pin-login-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.mode = 'pin';
      this.render();
    });

    document.getElementById('login-submit').addEventListener('click', () => this.handleLogin());
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });
  }

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    errorEl.textContent = '';
    if (!email) { errorEl.textContent = 'L\'email est requis'; return; }
    if (!password) { errorEl.textContent = 'Le mot de passe est requis'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      const result = await API.login({ email, password });
      localStorage.setItem('restosuite_token', result.token);
      localStorage.setItem('restosuite_account', JSON.stringify(result.account));

      const nav = document.getElementById('nav');
      if (nav) nav.style.display = '';

      if (result.account.onboarding_step < 7) {
        // Go to onboarding
        const wizard = new OnboardingWizard(() => {
          bootApp(result.account.role, result.account);
        });
        wizard.show();
      } else {
        bootApp(result.account.role, result.account);
      }
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur de connexion';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    }
  }

  renderRegister(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <div class="login-logo">
            <img src="assets/logo-outline-thin.png" alt="RestoSuite" style="height: 80px; width: auto;">
          </div>
          <h1 class="login-title">Resto<span class="text-accent">Suite</span> <span class="login-ai-badge">AI</span></h1>
          <p class="login-tagline">Créez votre compte — essai gratuit 60 jours</p>

          <div class="auth-tabs" style="display:flex;gap:0;margin-bottom:var(--space-5);border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-primary)">
            <button class="auth-tab" id="tab-login" style="flex:1;padding:10px;font-weight:600;font-size:var(--text-sm);border:none;cursor:pointer;background:var(--bg-secondary);color:var(--text-secondary);transition:all 0.2s">Connexion</button>
            <button class="auth-tab active" id="tab-register" style="flex:1;padding:10px;font-weight:600;font-size:var(--text-sm);border:none;cursor:pointer;background:var(--color-primary);color:#fff;transition:all 0.2s">Inscription</button>
          </div>

          <div style="text-align:left;width:100%">
            <div style="display:flex;gap:var(--space-3)">
              <div class="form-group" style="flex:1">
                <label>Prénom</label>
                <input type="text" class="form-control" id="reg-firstname" placeholder="Paul" autocomplete="given-name">
              </div>
              <div class="form-group" style="flex:1">
                <label>Nom</label>
                <input type="text" class="form-control" id="reg-lastname" placeholder="Dupont" autocomplete="family-name">
              </div>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="reg-email" placeholder="votre@email.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label>Mot de passe (6 caractères min.)</label>
              <input type="password" class="form-control" id="reg-password" placeholder="••••••••" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label>Confirmer le mot de passe</label>
              <input type="password" class="form-control" id="reg-password2" placeholder="••••••••" autocomplete="new-password">
            </div>
          </div>

          <div id="reg-error" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);min-height:20px"></div>

          <button class="btn btn-primary" id="reg-submit" style="margin-top:var(--space-3);width:100%;padding:12px;font-size:var(--text-base)">
            Créer mon compte
          </button>

          <div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--border-primary);text-align:center">
            <a href="#" id="pin-login-link" style="color:var(--text-secondary);font-size:var(--text-sm);text-decoration:none">
              🔢 Connexion rapide par PIN (équipiers)
            </a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('tab-login').addEventListener('click', () => {
      this.mode = 'login';
      this.render();
    });

    document.getElementById('pin-login-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.mode = 'pin';
      this.render();
    });

    document.getElementById('reg-submit').addEventListener('click', () => this.handleRegister());
    document.getElementById('reg-password2').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleRegister();
    });
  }

  async handleRegister() {
    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const errorEl = document.getElementById('reg-error');
    const submitBtn = document.getElementById('reg-submit');

    errorEl.textContent = '';

    if (!email) { errorEl.textContent = 'L\'email est requis'; return; }
    if (!password || password.length < 6) { errorEl.textContent = 'Le mot de passe doit faire au moins 6 caractères'; return; }
    if (password !== password2) { errorEl.textContent = 'Les mots de passe ne correspondent pas'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Création...';

    try {
      const result = await API.register({
        email,
        password,
        first_name: firstName,
        last_name: lastName
      });

      localStorage.setItem('restosuite_token', result.token);
      localStorage.setItem('restosuite_account', JSON.stringify(result.account));

      // Go directly to onboarding
      const nav = document.getElementById('nav');
      if (nav) nav.style.display = 'none';

      const wizard = new OnboardingWizard(() => {
        if (nav) nav.style.display = '';
        bootApp(result.account.role, result.account);
      });
      wizard.show();
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur lors de l\'inscription';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer mon compte';
    }
  }

  renderPinLogin(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content pin-content">
          <button class="login-back" id="pin-back">
            <i data-lucide="arrow-left" style="width:20px;height:20px"></i>
            Retour
          </button>

          <div style="margin-bottom:var(--space-4)">
            <span style="font-size:2.5rem">🔢</span>
          </div>
          <h2 class="login-subtitle">Connexion rapide</h2>
          <p class="login-tagline">Entrez votre PIN à 4 chiffres</p>

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
    this.pinDigits = [];

    document.getElementById('pin-back').addEventListener('click', () => {
      this.mode = 'login';
      this.render();
    });

    const pad = document.getElementById('pin-pad');
    pad.querySelectorAll('.pin-key[data-digit]').forEach(key => {
      key.addEventListener('click', () => {
        if (this.pinDigits.length >= 4) return;
        this.pinDigits.push(key.dataset.digit);
        this.updatePinDots();
        if (this.pinDigits.length === 4) this.handlePinLogin();
      });
    });

    document.getElementById('pin-delete').addEventListener('click', () => {
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

  async handlePinLogin() {
    const pin = this.pinDigits.join('');
    try {
      const result = await API.pinLogin({ pin });

      localStorage.setItem('restosuite_token', result.token);
      localStorage.setItem('restosuite_account', JSON.stringify(result.account));

      const nav = document.getElementById('nav');
      if (nav) nav.style.display = '';
      bootApp(result.account.role, result.account);
    } catch (e) {
      this.pinDigits = [];
      this.updatePinDots();
      const dotsEl = document.getElementById('pin-dots');
      const errorEl = document.getElementById('pin-error');
      dotsEl.classList.add('shake');
      errorEl.textContent = 'PIN incorrect';
      setTimeout(() => dotsEl.classList.remove('shake'), 600);
    }
  }
}

// ─── Account utility ───
function getAccount() {
  try {
    const stored = localStorage.getItem('restosuite_account');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function _getRoleLabel(role) {
  switch (role) {
    case 'gerant': return '👑 Gérant';
    case 'cuisinier': return '👨‍🍳 Cuisinier';
    case 'salle': return '🍽️ Salle';
    case 'serveur': return '🍽️ Serveur';
    default: return '👤 Équipier';
  }
}

function getRole() {
  const account = getAccount();
  if (account) return account.role;
  return localStorage.getItem('restosuite_role');
}

function getPermissions() {
  const account = getAccount();
  if (!account) {
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
  const perms = getPermissions();
  document.body.classList.toggle('perm-no-costs', !perms.view_costs);
  document.body.classList.toggle('perm-no-edit', !perms.edit_recipes);
  document.body.classList.toggle('perm-no-suppliers', !perms.view_suppliers);
  document.body.classList.toggle('perm-no-export', !perms.export_pdf);
}

function logout() {
  localStorage.removeItem('restosuite_account');
  localStorage.removeItem('restosuite_token');
  localStorage.removeItem('restosuite_role');
  document.body.className = '';
  location.hash = '';
  location.reload();
}
