// ═══════════════════════════════════════════
// Login — Gérant (email/pwd) + Staff (restaurant pwd → team → PIN)
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
    // New 2026-04-19 flow:
    //   choice → restaurant (email+pwd → smart-login) → team-picker (only if
    //     branch = staff) → staff-pin / create-pin
    //   choice → fournisseur (supplier portal) — handled by its own view
    //   choice → register
    this.mode = 'choice';
    this.staffMembers = [];
    this.selectedMember = null;
    this.restaurantName = '';
    this.restaurantId = null;
    this.pinDigits = [];
    this.prefillEmail = '';
  }

  async render() {
    const app = document.getElementById('app');
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';

    switch (this.mode) {
      case 'choice': this.renderChoice(app); break;
      case 'restaurant': this.renderRestaurant(app); break;
      case 'register': this.renderRegister(app); break;
      case 'team-picker': this.renderTeamPicker(app); break;
      case 'staff-pin': this.renderStaffPin(app); break;
      case 'create-pin': this.renderCreatePin(app); break;
    }
  }

  // ─── Choice Screen — Restaurant vs Fournisseur ───
  renderChoice(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <div class="login-logo">
            <img src="assets/logo-icon.svg" alt="RestoSuite" style="height: 80px; width: auto;">
          </div>
          <h1 class="login-title">Resto<span class="text-accent">Suite</span></h1>
          <p class="login-tagline">Votre cuisine tourne. Vos chiffres suivent.</p>

          <div style="display:flex;flex-direction:column;gap:16px;margin-top:var(--space-6);width:100%">
            <button class="btn btn-primary" id="btn-restaurant" style="padding:16px;font-size:var(--text-base);display:flex;align-items:center;justify-content:center;gap:10px">
              <span style="font-size:1.4rem">🍽️</span> Restaurant
            </button>
            <button class="btn btn-secondary" id="btn-fournisseur" style="padding:16px;font-size:var(--text-base);display:flex;align-items:center;justify-content:center;gap:10px">
              <span style="font-size:1.4rem">🚚</span> Fournisseur
            </button>
          </div>

          <div style="margin-top:var(--space-6);text-align:center">
            <a href="#" id="link-register" style="color:var(--text-tertiary);font-size:var(--text-sm);text-decoration:none">
              Pas encore de compte ? <span style="color:var(--color-accent)">Essai gratuit 60 jours</span>
            </a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-restaurant').addEventListener('click', () => {
      this.mode = 'restaurant';
      this.render();
    });
    document.getElementById('btn-fournisseur').addEventListener('click', () => {
      // Route to the existing supplier portal view — dedicated flow owned by
      // supplier-login.js, no changes here.
      if (typeof renderSupplierLogin === 'function') {
        renderSupplierLogin();
      } else {
        location.hash = '#/supplier/login';
      }
    });
    document.getElementById('link-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.mode = 'register';
      this.render();
    });
  }

  // ─── Restaurant Login (unified — owner pwd OR staff pwd via /smart-login) ───
  renderRestaurant(app) {
    // Pre-fill with the last known restaurant email so returning users skip a
    // round of typing. This is pulled from the stored account (if they logged
    // out and are coming back) — strictly cosmetic, server still re-authenticates.
    const stored = (typeof getAccount === 'function') ? getAccount() : null;
    const prefill = this.prefillEmail || (stored && stored.email) || localStorage.getItem('restosuite_last_email') || '';

    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <button class="login-back" id="back-btn" aria-label="Revenir à l'écran précédent">
            <i data-lucide="arrow-left" style="width:20px;height:20px" aria-hidden="true"></i> Retour
          </button>
          <div class="login-logo">
            <img src="assets/logo-icon.svg" alt="RestoSuite" style="height: 60px; width: auto;">
          </div>
          <h2 class="login-subtitle">Connexion restaurant</h2>
          <p class="login-tagline" style="margin-bottom:var(--space-2)">Gérant ou équipe — un seul formulaire.</p>
          <p class="login-hint" style="font-size:var(--text-xs);color:var(--text-tertiary);margin:0 0 var(--space-4)">Utilisez votre mot de passe personnel (gérant) ou celui de l'équipe — c'est le mot de passe qui détermine votre accès.</p>

          <div style="text-align:left;width:100%;margin-top:var(--space-4)">
            <div class="form-group">
              <label for="login-email">Email du restaurant</label>
              <input type="email" class="form-control" id="login-email" value="${escapeHtml(prefill)}" placeholder="votre@email.com" autocomplete="email" required>
            </div>
            <div class="form-group">
              <label for="login-password">Mot de passe</label>
              <input type="password" class="form-control" id="login-password" placeholder="••••••••" autocomplete="current-password" required>
            </div>
          </div>

          <div id="login-error" role="alert" aria-live="assertive" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);min-height:20px"></div>

          <button class="btn btn-primary" id="login-submit" style="margin-top:var(--space-3);width:100%;padding:12px;font-size:var(--text-base)">
            Se connecter
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    document.getElementById('back-btn').addEventListener('click', () => {
      this.mode = 'choice';
      this.render();
    });
    document.getElementById('login-submit').addEventListener('click', () => this.handleRestaurantLogin());
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleRestaurantLogin();
    });

    // Auto-focus on the first empty field
    const emailField = document.getElementById('login-email');
    if (emailField.value) {
      document.getElementById('login-password').focus();
    } else {
      emailField.focus();
    }
  }

  async handleRestaurantLogin() {
    // Let the browser's autofill settle before reading values. Chrome can leave
    // .value empty until the first frame after click/Enter when a password
    // manager auto-fills — reading too early shows "Le mot de passe est requis"
    // even though the field is visually filled.
    await new Promise((r) => requestAnimationFrame(r));

    const emailEl = document.getElementById('login-email');
    const passwordEl = document.getElementById('login-password');
    const email = (emailEl && emailEl.value || '').trim();
    const password = (passwordEl && passwordEl.value) || '';
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    errorEl.textContent = '';
    if (!email) { errorEl.textContent = "L'email est requis"; return; }
    // Do NOT block on empty password client-side: autofilled values are
    // sometimes masked from JS until user interaction. Send to server; it will
    // return a clear error if the password really is missing or wrong.

    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      const result = await API.smartLogin(email, password);
      // Remember the email so the next login auto-fills.
      try { localStorage.setItem('restosuite_last_email', email); } catch {}

      if (result.mode === 'owner') {
        // Full gérant session — same wiring as the old handleGerantLogin path.
        localStorage.setItem('restosuite_token', result.token);
        localStorage.setItem('restosuite_account', JSON.stringify(result.account));

        const nav = document.getElementById('nav');
        if (nav) nav.style.display = '';

        if (result.account.onboarding_step < 7 && result.account.is_owner) {
          const wizard = new OnboardingWizard(() => {
            bootApp(result.account.role, result.account);
          });
          wizard.show();
        } else {
          bootApp(result.account.role, result.account);
        }
        return;
      }

      if (result.mode === 'staff') {
        // Continue to the team picker → PIN — same flow as the legacy staff
        // password entry, we just arrived via a unified form.
        this.staffMembers = result.members || [];
        this.restaurantName = result.restaurant_name || 'Mon restaurant';
        this.restaurantId = result.restaurant_id;

        if (this.staffMembers.length === 0) {
          errorEl.textContent = "Aucun membre d'équipe trouvé. Le gérant doit d'abord créer des comptes.";
          submitBtn.disabled = false;
          submitBtn.textContent = 'Se connecter';
          return;
        }

        this.mode = 'team-picker';
        this.render();
        return;
      }

      // Unknown mode — should not happen.
      errorEl.textContent = 'Erreur de connexion';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur de connexion';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    }
  }

  // ─── Register ───
  renderRegister(app) {
    const accountType = this.registerAccountType || 'restaurant';
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:400px">
          <button class="login-back" id="back-btn" aria-label="Revenir à l'écran précédent">
            <i data-lucide="arrow-left" style="width:20px;height:20px" aria-hidden="true"></i> Retour
          </button>
          <div class="login-logo">
            <img src="assets/logo-icon.svg" alt="RestoSuite" style="height: 60px; width: auto;">
          </div>
          <h2 class="login-subtitle">Créer un compte</h2>
          <p class="login-tagline">Essai gratuit 60 jours — aucun engagement</p>

          <div role="tablist" aria-label="Type de compte" style="display:flex;gap:8px;width:100%;background:var(--bg-secondary);padding:4px;border-radius:var(--radius-md);margin-bottom:var(--space-4)">
            <button type="button" role="tab" id="reg-tab-restaurant" aria-selected="${accountType === 'restaurant'}" class="btn ${accountType === 'restaurant' ? 'btn-primary' : 'btn-ghost'}" style="flex:1;padding:10px;font-size:var(--text-sm)">
              <i data-lucide="utensils-crossed" style="width:16px;height:16px" aria-hidden="true"></i> Restaurant
            </button>
            <button type="button" role="tab" id="reg-tab-fournisseur" aria-selected="${accountType === 'fournisseur'}" class="btn ${accountType === 'fournisseur' ? 'btn-primary' : 'btn-ghost'}" style="flex:1;padding:10px;font-size:var(--text-sm)">
              <i data-lucide="truck" style="width:16px;height:16px" aria-hidden="true"></i> Fournisseur
            </button>
          </div>

          ${accountType === 'fournisseur' ? `
          <div style="text-align:left;width:100%;padding:var(--space-4);background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:var(--space-3)">
            <div style="display:flex;align-items:flex-start;gap:var(--space-3);margin-bottom:var(--space-3)">
              <span style="font-size:1.5rem;line-height:1" aria-hidden="true">📦</span>
              <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5">
                <strong style="color:var(--text-primary)">Les comptes fournisseurs sont créés par invitation.</strong><br>
                Si un restaurant client vous a invité à rejoindre RestoSuite, connectez-vous au portail fournisseur avec l'email et le mot de passe qu'il vous a fournis.
              </div>
            </div>
            <button class="btn btn-primary" id="reg-go-supplier-login" style="width:100%;padding:12px;font-size:var(--text-base);background:#4A90D9;border-color:#4A90D9">
              <i data-lucide="log-in" style="width:18px;height:18px" aria-hidden="true"></i> Aller au portail fournisseur
            </button>
            <p style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-3);text-align:center">
              Vous gérez un restaurant ? <a href="#" id="reg-back-to-restaurant" style="color:var(--accent-primary);text-decoration:underline">Revenir au compte restaurant</a>
            </p>
          </div>
          ` : `
          <div style="text-align:left;width:100%;margin-top:var(--space-4)">
            <div style="display:flex;gap:var(--space-3)">
              <div class="form-group" style="flex:1">
                <label for="reg-firstname">Prénom</label>
                <input type="text" class="form-control" id="reg-firstname" placeholder="Paul" autocomplete="given-name">
              </div>
              <div class="form-group" style="flex:1">
                <label for="reg-lastname">Nom</label>
                <input type="text" class="form-control" id="reg-lastname" placeholder="Dupont" autocomplete="family-name">
              </div>
            </div>
            <div class="form-group">
              <label for="reg-email">Email</label>
              <input type="email" class="form-control" id="reg-email" placeholder="votre@email.com" autocomplete="email" required>
            </div>
            <div class="form-group">
              <label for="reg-password">Mot de passe (6 caractères min.)</label>
              <input type="password" class="form-control" id="reg-password" placeholder="••••••••" autocomplete="new-password" required aria-describedby="reg-password-help">
            </div>
            <div class="form-group">
              <label for="reg-password2">Confirmer le mot de passe</label>
              <input type="password" class="form-control" id="reg-password2" placeholder="••••••••" autocomplete="new-password" required>
            </div>
            <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border-default)">
              <div style="display:flex;align-items:flex-start;gap:var(--space-3);margin-bottom:var(--space-3);padding:var(--space-3);background:var(--bg-secondary);border-radius:var(--radius-md)">
                <span style="font-size:1.3rem;line-height:1">💡</span>
                <div style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5">
                  <strong>Deux mots de passe, deux accès :</strong><br>
                  <strong style="color:var(--text-primary)">Votre mot de passe</strong> (ci-dessus) est personnel et donne accès complet au logiciel.<br>
                  <strong style="color:var(--text-primary)">Le mot de passe équipe</strong> (ci-dessous) est un code simple que vous partagez avec votre staff pour qu'ils accèdent à leur espace limité.
                </div>
              </div>
              <div class="form-group">
                <label for="reg-staff-password">Mot de passe équipe (partagé avec le staff)</label>
                <input type="text" class="form-control" id="reg-staff-password" placeholder="ex: resto2026" autocomplete="off"
                       style="font-family:var(--font-mono);letter-spacing:0.05em">
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-1)">Optionnel — vous pourrez le configurer plus tard dans Équipe.</p>
            </div>
          </div>

          <div id="reg-error" role="alert" aria-live="assertive" style="color:var(--color-danger);font-size:var(--text-sm);margin-top:var(--space-2);min-height:20px"></div>

          <button class="btn btn-primary" id="reg-submit" style="margin-top:var(--space-3);width:100%;padding:12px;font-size:var(--text-base)">
            Créer mon compte
          </button>
          `}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    document.getElementById('back-btn').addEventListener('click', () => {
      this.mode = 'choice';
      this.render();
    });
    document.getElementById('reg-tab-restaurant').addEventListener('click', () => {
      this.registerAccountType = 'restaurant';
      this.renderRegister(app);
    });
    document.getElementById('reg-tab-fournisseur').addEventListener('click', () => {
      this.registerAccountType = 'fournisseur';
      this.renderRegister(app);
    });
    if (accountType === 'fournisseur') {
      document.getElementById('reg-go-supplier-login').addEventListener('click', () => {
        location.hash = '#/supplier/login';
      });
      const back = document.getElementById('reg-back-to-restaurant');
      if (back) back.addEventListener('click', (e) => {
        e.preventDefault();
        this.registerAccountType = 'restaurant';
        this.renderRegister(app);
      });
      return;
    }
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
    const staffPassword = document.getElementById('reg-staff-password').value.trim();
    const errorEl = document.getElementById('reg-error');
    const submitBtn = document.getElementById('reg-submit');

    errorEl.textContent = '';
    if (!email) { errorEl.textContent = "L'email est requis"; return; }
    if (!password || password.length < 6) { errorEl.textContent = 'Le mot de passe doit faire au moins 6 caractères'; return; }
    if (password !== password2) { errorEl.textContent = 'Les mots de passe ne correspondent pas'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Création...';

    try {
      const result = await API.register({ email, password, first_name: firstName, last_name: lastName, staff_password: staffPassword || undefined });
      localStorage.setItem('restosuite_token', result.token);
      localStorage.setItem('restosuite_account', JSON.stringify(result.account));

      const nav = document.getElementById('nav');
      if (nav) nav.style.display = 'none';
      const wizard = new OnboardingWizard(() => {
        if (nav) nav.style.display = '';
        bootApp(result.account.role, result.account);
      });
      wizard.show();
    } catch (e) {
      errorEl.textContent = e.message || "Erreur lors de l'inscription";
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer mon compte';
    }
  }

  // ─── Team Picker ───
  renderTeamPicker(app) {
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content" style="max-width:500px">
          <button class="login-back" id="back-btn" aria-label="Revenir à l'écran précédent">
            <i data-lucide="arrow-left" style="width:20px;height:20px" aria-hidden="true"></i> Retour
          </button>
          <h2 class="login-subtitle">${escapeHtml(this.restaurantName)}</h2>
          <p class="login-tagline">Qui êtes-vous ?</p>

          <div class="team-picker-grid" role="list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:16px;margin-top:var(--space-5);width:100%">
            ${this.staffMembers.map(m => `
              <button class="team-picker-card" data-id="${m.id}" role="listitem" aria-label="${escapeHtml(m.name)} — ${escapeHtml(_getRoleLabel(m.role).replace(/[^\p{L}\s]/gu, '').trim())}" style="
                display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 12px;
                border-radius:var(--radius-lg);border:2px solid var(--border-primary);
                background:var(--bg-secondary);cursor:pointer;transition:all 0.2s;
              ">
                ${renderAvatar(m.name, 56)}
                <span style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary);text-align:center">${escapeHtml(m.name)}</span>
                <span style="font-size:11px;color:var(--text-tertiary)" aria-hidden="true">${_getRoleLabel(m.role)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();

    document.getElementById('back-btn').addEventListener('click', () => {
      this.mode = 'restaurant';
      this.render();
    });

    document.querySelectorAll('.team-picker-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'var(--color-accent)';
        card.style.background = 'var(--bg-tertiary)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'var(--border-primary)';
        card.style.background = 'var(--bg-secondary)';
      });
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        this.selectedMember = this.staffMembers.find(m => m.id === id);
        // If member has no PIN yet, go to create-pin flow
        this.mode = this.selectedMember.has_pin ? 'staff-pin' : 'create-pin';
        this.render();
      });
    });
  }

  // ─── Staff PIN ───
  renderStaffPin(app) {
    const member = this.selectedMember;
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content pin-content">
          <button class="login-back" id="pin-back" aria-label="Revenir au choix d'utilisateur">
            <i data-lucide="arrow-left" style="width:20px;height:20px" aria-hidden="true"></i> Retour
          </button>

          <div style="margin-bottom:var(--space-3)">
            ${renderAvatar(member.name, 64)}
          </div>
          <h2 class="login-subtitle">${escapeHtml(member.name)}</h2>
          <p class="login-tagline">Entrez votre PIN</p>

          <div class="pin-dots" id="pin-dots" role="status" aria-live="polite" aria-label="Chiffres saisis">
            <span class="pin-dot" aria-hidden="true"></span>
            <span class="pin-dot" aria-hidden="true"></span>
            <span class="pin-dot" aria-hidden="true"></span>
            <span class="pin-dot" aria-hidden="true"></span>
          </div>

          <div class="pin-error" id="pin-error" role="alert" aria-live="assertive"></div>

          <div class="pin-pad" id="pin-pad" role="group" aria-label="Pavé numérique PIN">
            <button class="pin-key" data-digit="1" aria-label="1">1</button>
            <button class="pin-key" data-digit="2" aria-label="2">2</button>
            <button class="pin-key" data-digit="3" aria-label="3">3</button>
            <button class="pin-key" data-digit="4" aria-label="4">4</button>
            <button class="pin-key" data-digit="5" aria-label="5">5</button>
            <button class="pin-key" data-digit="6" aria-label="6">6</button>
            <button class="pin-key" data-digit="7" aria-label="7">7</button>
            <button class="pin-key" data-digit="8" aria-label="8">8</button>
            <button class="pin-key" data-digit="9" aria-label="9">9</button>
            <button class="pin-key pin-key--empty" aria-hidden="true" tabindex="-1"></button>
            <button class="pin-key" data-digit="0" aria-label="0">0</button>
            <button class="pin-key pin-key--delete" id="pin-delete" aria-label="Effacer le dernier chiffre">
              <i data-lucide="delete" style="width:24px;height:24px" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    this.pinDigits = [];

    document.getElementById('pin-back').addEventListener('click', () => {
      this.mode = 'team-picker';
      this.render();
    });

    const pad = document.getElementById('pin-pad');
    pad.querySelectorAll('.pin-key[data-digit]').forEach(key => {
      key.addEventListener('click', () => {
        if (this.pinDigits.length >= 4) return;
        this.pinDigits.push(key.dataset.digit);
        this.updatePinDots();
        if (this.pinDigits.length === 4) this.handleStaffPinLogin();
      });
    });

    document.getElementById('pin-delete').addEventListener('click', () => {
      this.pinDigits.pop();
      this.updatePinDots();
      document.getElementById('pin-error').textContent = '';
      document.getElementById('pin-dots').classList.remove('shake');
    });

    this._pinKeydownHandler = (e) => {
      if (!document.getElementById('pin-pad')) return;
      if (e.key >= '0' && e.key <= '9') {
        if (this.pinDigits.length >= 4) return;
        this.pinDigits.push(e.key);
        this.updatePinDots();
        if (this.pinDigits.length === 4) this.handleStaffPinLogin();
      } else if (e.key === 'Backspace') {
        this.pinDigits.pop();
        this.updatePinDots();
        document.getElementById('pin-error').textContent = '';
        document.getElementById('pin-dots').classList.remove('shake');
      }
    };
    document.addEventListener('keydown', this._pinKeydownHandler);
  }

  // ─── Create PIN (first-time) ───
  renderCreatePin(app) {
    const member = this.selectedMember;
    app.innerHTML = `
      <div class="login-screen">
        <div class="login-content pin-content">
          <button class="login-back" id="pin-back" aria-label="Revenir au choix d'utilisateur">
            <i data-lucide="arrow-left" style="width:20px;height:20px" aria-hidden="true"></i> Retour
          </button>

          <div style="margin-bottom:var(--space-3)">
            ${renderAvatar(member.name, 64)}
          </div>
          <h2 class="login-subtitle">${escapeHtml(member.name)}</h2>
          <p class="login-tagline" id="create-pin-label">Créez votre code PIN (4 chiffres)</p>

          <div class="pin-dots" id="pin-dots" role="status" aria-live="polite" aria-label="Chiffres saisis">
            <span class="pin-dot" aria-hidden="true"></span>
            <span class="pin-dot" aria-hidden="true"></span>
            <span class="pin-dot" aria-hidden="true"></span>
            <span class="pin-dot" aria-hidden="true"></span>
          </div>

          <div class="pin-error" id="pin-error" role="alert" aria-live="assertive"></div>

          <div class="pin-pad" id="pin-pad" role="group" aria-label="Pavé numérique PIN">
            <button class="pin-key" data-digit="1" aria-label="1">1</button>
            <button class="pin-key" data-digit="2" aria-label="2">2</button>
            <button class="pin-key" data-digit="3" aria-label="3">3</button>
            <button class="pin-key" data-digit="4" aria-label="4">4</button>
            <button class="pin-key" data-digit="5" aria-label="5">5</button>
            <button class="pin-key" data-digit="6" aria-label="6">6</button>
            <button class="pin-key" data-digit="7" aria-label="7">7</button>
            <button class="pin-key" data-digit="8" aria-label="8">8</button>
            <button class="pin-key" data-digit="9" aria-label="9">9</button>
            <button class="pin-key pin-key--empty" aria-hidden="true" tabindex="-1"></button>
            <button class="pin-key" data-digit="0" aria-label="0">0</button>
            <button class="pin-key pin-key--delete" id="pin-delete" aria-label="Effacer le dernier chiffre">
              <i data-lucide="delete" style="width:24px;height:24px" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    this.pinDigits = [];
    this.createPinStep = 'choose'; // 'choose' | 'confirm'
    this.chosenPin = '';

    document.getElementById('pin-back').addEventListener('click', () => {
      if (this.createPinStep === 'confirm') {
        // Go back to choose step
        this.createPinStep = 'choose';
        this.chosenPin = '';
        this.pinDigits = [];
        this.updatePinDots();
        document.getElementById('create-pin-label').textContent = 'Créez votre code PIN (4 chiffres)';
        document.getElementById('pin-error').textContent = '';
      } else {
        this.mode = 'team-picker';
        this.render();
      }
    });

    const pad = document.getElementById('pin-pad');
    pad.querySelectorAll('.pin-key[data-digit]').forEach(key => {
      key.addEventListener('click', () => {
        if (this.pinDigits.length >= 4) return;
        this.pinDigits.push(key.dataset.digit);
        this.updatePinDots();
        if (this.pinDigits.length === 4) {
          if (this.createPinStep === 'choose') {
            // Store chosen PIN, move to confirm
            this.chosenPin = this.pinDigits.join('');
            this.pinDigits = [];
            this.createPinStep = 'confirm';
            setTimeout(() => {
              this.updatePinDots();
              document.getElementById('create-pin-label').textContent = 'Confirmez votre code PIN';
              document.getElementById('pin-dots').querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
            }, 200);
          } else {
            // Confirm step — check match
            const confirmPin = this.pinDigits.join('');
            if (confirmPin === this.chosenPin) {
              this.handleCreatePinSubmit(this.chosenPin);
            } else {
              this.pinDigits = [];
              this.updatePinDots();
              const dotsEl = document.getElementById('pin-dots');
              dotsEl.classList.add('shake');
              document.getElementById('pin-error').textContent = 'Les PIN ne correspondent pas. Réessayez.';
              setTimeout(() => dotsEl.classList.remove('shake'), 600);
            }
          }
        }
      });
    });

    document.getElementById('pin-delete').addEventListener('click', () => {
      this.pinDigits.pop();
      this.updatePinDots();
      document.getElementById('pin-error').textContent = '';
      document.getElementById('pin-dots').classList.remove('shake');
    });
  }

  async handleCreatePinSubmit(pin) {
    try {
      const result = await API.staffPinLogin(this.selectedMember.id, pin, true);

      localStorage.setItem('restosuite_token', result.token);
      localStorage.setItem('restosuite_account', JSON.stringify(result.account));

      const nav = document.getElementById('nav');
      if (nav) nav.style.display = '';
      bootApp(result.account.role, result.account);
    } catch (e) {
      this.pinDigits = [];
      this.updatePinDots();
      const errorEl = document.getElementById('pin-error');
      errorEl.textContent = e.message || 'Erreur de création du PIN';
    }
  }

  updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < this.pinDigits.length);
    });
  }

  async handleStaffPinLogin() {
    const pin = this.pinDigits.join('');
    try {
      const result = await API.staffPinLogin(this.selectedMember.id, pin);

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
    default: return role ? `👤 ${role.charAt(0).toUpperCase() + role.slice(1)}` : '👤 Membre';
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
  // Clear trial status polling interval
  clearTrialStatusInterval();
  // Fire-and-forget: invalidates the JWT server-side (blacklist) AND clears the
  // HttpOnly cookie via Set-Cookie Max-Age=0. Even if this fails (network), the
  // client state is still wiped below.
  try {
    fetch((window.location.origin) + '/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: (typeof getCsrfToken === 'function' && getCsrfToken())
        ? { 'X-CSRF-Token': getCsrfToken() }
        : {},
    }).catch(() => {});
  } catch {}
  localStorage.removeItem('restosuite_account');
  localStorage.removeItem('restosuite_token');
  localStorage.removeItem('restosuite_role');
  if (typeof setCsrfToken === 'function') setCsrfToken(null);
  document.body.className = '';
  location.hash = '';
  location.reload();
}
