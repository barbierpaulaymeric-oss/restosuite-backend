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

// Start
Router.init();

console.log('🍽️ RestoSuite AI loaded');
