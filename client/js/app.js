// ═══════════════════════════════════════════
// RestoSuite AI — App Bootstrap
// ═══════════════════════════════════════════

// Register routes
Router.add(/^\/$/, renderDashboard);
Router.add(/^\/new$/, () => renderRecipeForm(null));
Router.add(/^\/recipe\/(\d+)$/, (id) => renderRecipeDetail(parseInt(id)));
Router.add(/^\/edit\/(\d+)$/, (id) => renderRecipeForm(parseInt(id)));
Router.add(/^\/ingredients$/, renderIngredients);
Router.add(/^\/suppliers$/, renderSuppliers);
Router.add(/^\/more$/, () => new MoreView().render());

// Start
Router.init();

// Initialize Lucide icons in nav
if (window.lucide) lucide.createIcons();

console.log('%c RestoSuite AI ', 'background:#E8722A;color:#fff;border-radius:4px;padding:2px 8px;font-weight:600', 'loaded');
