// ═══════════════════════════════════════════
// Supplier Login — Email/Password + Member PIN
// ═══════════════════════════════════════════

function renderSupplierLogin() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (nav) nav.style.display = 'none';

  // State
  let mode = 'login'; // 'login' | 'member-picker' | 'member-pin'
  let supplierData = null; // { supplier_id, supplier_name, members }
  let selectedMember = null;

  function render() {
    if (mode === 'login') renderLoginForm();
    else if (mode === 'member-picker') renderMemberPicker();
    else if (mode === 'member-pin') renderMemberPin();
  }

  function renderLoginForm() {
    app.innerHTML = `
      <div class="login-screen supplier-theme">
        <div class="login-content">
          <div class="login-logo">
            <img src="assets/logo-icon.svg" alt="RestoSuite" style="height: 60px; width: auto;">
          </div>
          <h1 class="login-title" style="font-size:var(--text-2xl)">Portail <span style="color:#4A90D9">Fournisseur</span></h1>
          <p class="login-tagline">Connectez-vous à votre espace fournisseur</p>

          <div style="width:100%;max-width:360px;margin:var(--space-6) auto 0">
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-control" id="supplier-email"
                     placeholder="contact@fournisseur.fr" autocomplete="email" data-ui="custom">
            </div>
            <div class="form-group">
              <label>Mot de passe</label>
              <input type="password" class="form-control" id="supplier-password"
                     placeholder="••••••••" autocomplete="current-password" data-ui="custom">
            </div>
            <div id="supplier-login-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3);text-align:center"></div>
            <button class="btn btn-primary" id="supplier-login-btn" style="width:100%;padding:14px;font-size:var(--text-lg);background:#4A90D9;border-color:#4A90D9">
              <i data-lucide="log-in" style="width:20px;height:20px"></i> Se connecter
            </button>
          </div>

          <button class="btn btn-secondary" id="supplier-login-back" style="margin-top:var(--space-6)">
            <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
          </button>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('supplier-login-back').addEventListener('click', () => {
      const login = new LoginView();
      login.render();
    });

    const emailInput = document.getElementById('supplier-email');
    const passwordInput = document.getElementById('supplier-password');
    const loginBtn = document.getElementById('supplier-login-btn');
    const errorEl = document.getElementById('supplier-login-error');

    async function doLogin() {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        errorEl.textContent = 'Email et mot de passe requis';
        return;
      }
      errorEl.textContent = '';
      loginBtn.disabled = true;
      loginBtn.textContent = 'Connexion...';

      try {
        const result = await API.supplierCompanyLogin(email, password);

        // If auto_login (single member), go straight to portal
        if (result.token && result.auto_login) {
          setSupplierSession(result);
          bootSupplierApp(result);
          return;
        }

        // If members returned, show picker
        if (result.members && result.members.length > 0) {
          supplierData = result;
          mode = 'member-picker';
          render();
          return;
        }

        // No members yet — the gérant hasn't added member accounts
        // Store supplier info and show a message
        errorEl.textContent = 'Aucun membre configuré. Demandez au restaurant d\'ajouter vos comptes.';
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i data-lucide="log-in" style="width:20px;height:20px"></i> Se connecter';
        if (window.lucide) lucide.createIcons();
      } catch (e) {
        errorEl.textContent = e.message || 'Erreur de connexion';
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i data-lucide="log-in" style="width:20px;height:20px"></i> Se connecter';
        if (window.lucide) lucide.createIcons();
      }
    }

    loginBtn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
    emailInput.focus();
  }

  function renderMemberPicker() {
    const members = supplierData.members || [];
    app.innerHTML = `
      <div class="login-screen supplier-theme">
        <div class="login-content">
          <div class="login-logo">
            <img src="assets/logo-icon.svg" alt="RestoSuite" style="height: 50px; width: auto;">
          </div>
          <h1 class="login-title" style="font-size:var(--text-xl)">${escapeHtml(supplierData.supplier_name)}</h1>
          <p class="login-tagline">Qui se connecte ?</p>

          <div class="team-picker-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-4);width:100%;max-width:480px;margin:var(--space-6) auto 0">
            ${members.map(m => `
              <button class="team-picker-card" data-id="${m.id}" data-name="${escapeHtml(m.name)}"
                style="display:flex;flex-direction:column;align-items:center;gap:var(--space-2);padding:var(--space-5) var(--space-3);
                       background:var(--bg-elevated);border:2px solid var(--border-default);border-radius:var(--radius-lg);
                       cursor:pointer;transition:all 0.15s ease;color:var(--text-primary);font-size:var(--text-base)">
                ${renderAvatar(m.name, 56)}
                <span style="font-weight:600">${escapeHtml(m.name)}</span>
              </button>
            `).join('')}
          </div>

          <button class="btn btn-secondary" id="supplier-picker-back" style="margin-top:var(--space-6)">
            <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Changer de compte
          </button>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Member card click
    document.querySelectorAll('.team-picker-card').forEach(card => {
      card.addEventListener('mouseenter', () => { card.style.borderColor = '#4A90D9'; card.style.transform = 'translateY(-2px)'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border-default)'; card.style.transform = ''; });
      card.addEventListener('click', () => {
        selectedMember = {
          id: Number(card.dataset.id),
          name: card.dataset.name
        };
        mode = 'member-pin';
        render();
      });
    });

    document.getElementById('supplier-picker-back').addEventListener('click', () => {
      mode = 'login';
      supplierData = null;
      render();
    });
  }

  function renderMemberPin() {
    app.innerHTML = `
      <div class="login-screen supplier-theme">
        <div class="login-content">
          <div class="login-logo">
            ${renderAvatar(selectedMember.name, 72)}
          </div>
          <h1 class="login-title" style="font-size:var(--text-xl)">${escapeHtml(selectedMember.name)}</h1>
          <p class="login-tagline">Entrez votre code PIN</p>

          <div style="width:100%;max-width:280px;margin:var(--space-5) auto 0">
            <div class="pin-display" id="pin-display" style="display:flex;justify-content:center;gap:var(--space-3);margin-bottom:var(--space-5)">
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
              <span class="pin-dot" style="width:18px;height:18px;border-radius:50%;border:2px solid #4A90D9;background:transparent;transition:background 0.15s"></span>
            </div>
            <div id="supplier-pin-error" style="color:var(--color-danger);font-size:var(--text-sm);min-height:20px;margin-bottom:var(--space-3);text-align:center"></div>
            <div class="pin-pad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);max-width:240px;margin:0 auto">
              ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => k === '' ? '<div></div>' : `
                <button class="pin-key" data-key="${k}"
                  style="padding:var(--space-4);font-size:var(--text-xl);font-weight:600;border-radius:var(--radius-lg);
                         background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);
                         cursor:pointer;transition:background 0.1s">${k}</button>
              `).join('')}
            </div>
          </div>

          <button class="btn btn-secondary" id="supplier-pin-back" style="margin-top:var(--space-6)">
            <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Retour
          </button>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    let pinValue = '';
    const dots = document.querySelectorAll('.pin-dot');
    const errorEl = document.getElementById('supplier-pin-error');

    function updateDots() {
      dots.forEach((dot, i) => {
        dot.style.background = i < pinValue.length ? '#4A90D9' : 'transparent';
      });
    }

    async function submitPin() {
      errorEl.textContent = '';
      try {
        const result = await API.supplierMemberPin(supplierData.supplier_id, selectedMember.id, pinValue);
        setSupplierSession(result);
        bootSupplierApp(result);
      } catch (e) {
        errorEl.textContent = e.message || 'PIN incorrect';
        pinValue = '';
        updateDots();
        // Shake animation
        const display = document.getElementById('pin-display');
        if (display) {
          display.style.animation = 'shake 0.4s';
          setTimeout(() => display.style.animation = '', 400);
        }
      }
    }

    document.querySelectorAll('.pin-key').forEach(key => {
      key.addEventListener('click', () => {
        const k = key.dataset.key;
        if (k === '⌫') {
          pinValue = pinValue.slice(0, -1);
          updateDots();
        } else if (pinValue.length < 4) {
          pinValue += k;
          updateDots();
          if (pinValue.length === 4) {
            setTimeout(submitPin, 200);
          }
        }
      });
    });

    // Keyboard support
    document.addEventListener('keydown', function pinKeyHandler(e) {
      if (mode !== 'member-pin') {
        document.removeEventListener('keydown', pinKeyHandler);
        return;
      }
      if (/^\d$/.test(e.key) && pinValue.length < 4) {
        pinValue += e.key;
        updateDots();
        if (pinValue.length === 4) setTimeout(submitPin, 200);
      } else if (e.key === 'Backspace') {
        pinValue = pinValue.slice(0, -1);
        updateDots();
      }
    });

    document.getElementById('supplier-pin-back').addEventListener('click', () => {
      mode = 'member-picker';
      selectedMember = null;
      render();
    });
  }

  // Start
  render();
}
