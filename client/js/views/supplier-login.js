// ═══════════════════════════════════════════
// Supplier Login — PIN-based auth
// ═══════════════════════════════════════════

function renderSupplierLogin() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  if (nav) nav.style.display = 'none';

  app.innerHTML = `
    <div class="login-screen supplier-theme">
      <div class="login-content">
        <div class="login-logo">
          <img src="assets/logo-outline.png" alt="RestoSuite" style="height: 60px; width: auto;">
        </div>
        <h1 class="login-title" style="font-size:var(--text-2xl)">Portail <span style="color:#4A90D9">Fournisseur</span></h1>
        <p class="login-tagline">Entrez votre code d'accès</p>

        <div style="width:100%;max-width:320px;margin:var(--space-6) auto 0">
          <div class="form-group">
            <label>Code fournisseur (PIN)</label>
            <input type="password" class="form-control" id="supplier-pin"
                   placeholder="••••"
                   maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
                   style="font-family:var(--font-mono);font-size:var(--text-2xl);text-align:center;letter-spacing:0.5em">
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

  const pinInput = document.getElementById('supplier-pin');
  const loginBtn = document.getElementById('supplier-login-btn');
  const errorEl = document.getElementById('supplier-login-error');

  async function doLogin() {
    const pin = pinInput.value.trim();
    if (!/^\d{4,6}$/.test(pin)) {
      errorEl.textContent = 'Entrez votre code PIN (4-6 chiffres)';
      return;
    }
    errorEl.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Connexion...';

    try {
      const result = await API.supplierLogin(pin);
      setSupplierSession(result);
      bootSupplierApp(result);
    } catch (e) {
      errorEl.textContent = e.message || 'Erreur de connexion';
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i data-lucide="log-in" style="width:20px;height:20px"></i> Se connecter';
      if (window.lucide) lucide.createIcons();
    }
  }

  loginBtn.addEventListener('click', doLogin);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  pinInput.focus();
}
