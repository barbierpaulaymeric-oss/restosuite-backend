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
}

function bootApp(role) {
  applyRole(role);
  registerRoutes();
  location.hash = '#/';
  Router.init();
  if (window.lucide) lucide.createIcons();
  console.log('%c RestoSuite AI ', 'background:#E8722A;color:#fff;border-radius:4px;padding:2px 8px;font-weight:600', `loaded (${role})`);
}

(function init() {
  const role = getRole();

  // No role → show login screen
  if (!role) {
    const login = new LoginView();
    login.render();
    return;
  }

  // Fournisseur → show coming-soon page
  if (role === 'fournisseur') {
    const login = new LoginView();
    login.selectRole('fournisseur');
    return;
  }

  // Gérant or Équipier → boot
  bootApp(role);
})();
