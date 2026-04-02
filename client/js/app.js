// ═══════════════════════════════════════════
// RestoSuite AI — App Bootstrap
// ═══════════════════════════════════════════

// ─── PWA Install Prompt ───
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (localStorage.getItem('restosuite_install_dismissed')) return;

  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-content">
      <img src="assets/icon-192.png" width="40" height="40" style="border-radius:8px">
      <div>
        <strong>Installer RestoSuite</strong>
        <small>Accès rapide depuis votre écran d'accueil</small>
      </div>
    </div>
    <div class="install-actions">
      <button class="install-btn" id="installBtn">Installer</button>
      <button class="install-dismiss" id="dismissBtn">Plus tard</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
    banner.remove();
  });

  document.getElementById('dismissBtn').addEventListener('click', () => {
    localStorage.setItem('restosuite_install_dismissed', 'true');
    banner.remove();
  });
}

// ─── Trial status cache ───
let _trialStatus = null;

function getTrialStatus() { return _trialStatus; }

async function fetchTrialStatus() {
  const account = getAccount();
  if (!account) return null;
  try {
    const status = await API.request(`/accounts/${account.id}/status`);
    _trialStatus = status;
    return status;
  } catch (e) {
    console.warn('Could not fetch trial status:', e);
    return null;
  }
}

function renderTrialBanner() {
  // Remove existing banner
  const existing = document.querySelector('.trial-banner');
  if (existing) existing.remove();

  const status = _trialStatus;
  if (!status) return;

  // Pro users: no banner
  if (status.status === 'pro') {
    document.body.classList.remove('read-only-mode');
    return;
  }

  let bannerHTML = '';

  if (status.status === 'expired') {
    document.body.classList.add('read-only-mode');
    bannerHTML = `
      <div class="trial-banner trial-banner--expired">
        <span>Votre essai gratuit est terminé. Vos données sont en lecture seule.</span>
        <a href="#/subscribe" class="btn btn-primary btn-sm">Passer en Pro — 39€/mois</a>
      </div>
    `;
  } else if (status.status === 'trial') {
    document.body.classList.remove('read-only-mode');
    const daysLeft = status.daysLeft;
    
    if (daysLeft <= 3) {
      bannerHTML = `
        <div class="trial-banner trial-banner--urgent">
          <span>Plus que <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> d'essai gratuit — vos données passeront en lecture seule</span>
          <a href="#/subscribe">Passer en Pro</a>
        </div>
      `;
    } else if (daysLeft <= 14) {
      bannerHTML = `
        <div class="trial-banner trial-banner--warning">
          <span>Plus que ${daysLeft} jours d'essai gratuit</span>
          <a href="#/subscribe">Passer en Pro</a>
        </div>
      `;
    }
    // daysLeft > 14: no banner
  }

  if (bannerHTML) {
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);
  }

  // Also render a compact trial badge in the nav
  renderTrialHeaderBadge();
}

function renderTrialHeaderBadge() {
  const existing = document.querySelector('.trial-header-badge');
  if (existing) existing.remove();

  const status = _trialStatus;
  if (!status || status.status !== 'trial') return;

  const daysLeft = status.daysLeft;
  let badgeClass, label;
  if (daysLeft <= 3) {
    badgeClass = 'trial-header-badge--red';
    label = `🔴 Essai : ${daysLeft}j — Passer en Pro`;
  } else if (daysLeft <= 14) {
    badgeClass = 'trial-header-badge--yellow';
    label = `⚠️ Essai : ${daysLeft}j`;
  } else {
    badgeClass = 'trial-header-badge--green';
    label = `Essai : ${daysLeft}j restants`;
  }

  const nav = document.getElementById('nav');
  if (!nav) return;
  const navLinks = nav.querySelector('.nav-links');
  if (!navLinks) return;

  const badge = document.createElement('a');
  badge.href = '#/subscribe';
  badge.className = `trial-header-badge ${badgeClass}`;
  badge.textContent = label;
  navLinks.insertBefore(badge, navLinks.firstChild);
}

function registerRoutes() {
  // Prevent double-registration
  if (Router.routes.length > 0) return;

  Router.add(/^\/$/, renderDashboard);
  Router.add(/^\/new$/, () => renderRecipeForm(null));
  Router.add(/^\/recipe\/(\d+)$/, (id) => renderRecipeDetail(parseInt(id)));
  Router.add(/^\/edit\/(\d+)$/, (id) => renderRecipeForm(parseInt(id)));
  Router.add(/^\/ingredients$/, renderIngredients);
  Router.add(/^\/stock$/, renderStockDashboard);
  Router.add(/^\/stock\/reception$/, renderStockReception);
  Router.add(/^\/stock\/movements$/, renderStockMovements);
  Router.add(/^\/orders$/, renderOrdersDashboard);
  Router.add(/^\/orders\/new$/, renderNewOrder);
  Router.add(/^\/orders\/kitchen$/, renderKitchenView);
  Router.add(/^\/suppliers$/, renderSuppliers);
  Router.add(/^\/haccp$/, renderHACCPDashboard);
  Router.add(/^\/haccp\/temperatures$/, renderHACCPTemperatures);
  Router.add(/^\/haccp\/cleaning$/, renderHACCPCleaning);
  Router.add(/^\/haccp\/traceability$/, renderHACCPTraceability);
  Router.add(/^\/analytics$/, renderAnalytics);
  Router.add(/^\/more$/, () => new MoreView().render());
  Router.add(/^\/team$/, renderTeam);
  Router.add(/^\/subscribe$/, renderSubscribe);
  Router.add(/^\/supplier-portal$/, renderSupplierPortalManage);
  Router.add(/^\/service$/, renderServiceView);
}

function bootApp(role, account, opts = {}) {
  applyRole(role);
  updateNavUser(account);
  registerRoutes();

  // Role-based redirect: salle goes to service view, hide nav
  if (role === 'salle') {
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = 'none';
    location.hash = '#/service';
  } else {
    location.hash = '#/';
  }
  Router.init();
  if (window.lucide) lucide.createIcons();
  const displayName = account ? account.name : role;
  console.log('%c RestoSuite AI ', 'background:#E8722A;color:#fff;border-radius:4px;padding:2px 8px;font-weight:600', `loaded (${displayName})`);

  // Fetch trial status and render banner
  fetchTrialStatus().then(() => renderTrialBanner());

  // Show onboarding wizard for new gérant accounts (first time only)
  if (opts.isNewAccount && role === 'gerant' && typeof showOnboardingIfNeeded === 'function') {
    showOnboardingIfNeeded();
  }
}

function updateNavUser(account) {
  // Remove existing user badge if any
  const existing = document.querySelector('.nav-user-badge');
  if (existing) existing.remove();

  if (!account) return;

  const nav = document.getElementById('nav');
  if (!nav) return;

  const badge = document.createElement('div');
  badge.className = 'nav-user-badge';
  badge.innerHTML = `${renderAvatar(account.name, 32)}<span class="nav-user-name">${escapeHtml(account.name)}</span>`;
  badge.addEventListener('click', () => {
    location.hash = '#/more';
  });

  // Insert into nav-links
  const navLinks = nav.querySelector('.nav-links');
  if (navLinks) {
    navLinks.appendChild(badge);
  }
}

(function init() {
  // Check supplier session first
  const supplierSession = getSupplierSession();
  if (supplierSession && getSupplierToken()) {
    document.body.classList.add('supplier-mode');
    bootSupplierApp(supplierSession);
    return;
  }

  const account = getAccount();

  // Check account-based auth first
  if (account) {
    // Fournisseur case (shouldn't happen but just in case)
    if (account.role === 'fournisseur') {
      const login = new LoginView();
      login.screen = 'fournisseur';
      login.render();
      return;
    }
    bootApp(account.role, account);
    return;
  }

  // Fallback: check old role system
  const role = localStorage.getItem('restosuite_role');
  if (role && role !== 'fournisseur') {
    // Migrate: old system, boot with role but no account
    bootApp(role, null);
    return;
  }

  if (role === 'fournisseur') {
    const login = new LoginView();
    login.screen = 'fournisseur';
    login.render();
    return;
  }

  // No auth → show login
  const login = new LoginView();
  login.render();
})();
