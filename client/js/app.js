// ═══════════════════════════════════════════
// RestoSuite AI — App Bootstrap
// ═══════════════════════════════════════════

function registerRoutes() {
  // Prevent double-registration
  if (Router.routes.length > 0) return;

  Router.add(/^\/$/, renderDashboard);
  Router.add(/^\/new$/, () => renderRecipeForm(null));
  Router.add(/^\/recipe\/(\d+)$/, (id) => renderRecipeDetail(parseInt(id)));
  Router.add(/^\/edit\/(\d+)$/, (id) => renderRecipeForm(parseInt(id)));
  Router.add(/^\/ingredients$/, renderIngredients);
  Router.add(/^\/suppliers$/, renderSuppliers);
  Router.add(/^\/more$/, () => new MoreView().render());
  Router.add(/^\/team$/, renderTeam);
}

function bootApp(role, account) {
  applyRole(role);
  updateNavUser(account);
  registerRoutes();
  location.hash = '#/';
  Router.init();
  if (window.lucide) lucide.createIcons();
  const displayName = account ? account.name : role;
  console.log('%c RestoSuite AI ', 'background:#E8722A;color:#fff;border-radius:4px;padding:2px 8px;font-weight:600', `loaded (${displayName})`);
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
