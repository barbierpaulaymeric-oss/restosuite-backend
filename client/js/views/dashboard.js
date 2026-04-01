// ═══════════════════════════════════════════
// Dashboard — Fiches Techniques
// ═══════════════════════════════════════════

async function renderDashboard() {
  const app = document.getElementById('app');
  const perms = getPermissions();
  app.innerHTML = `
    <div class="page-header">
      <h1>Fiches Techniques</h1>
      ${perms.edit_recipes ? `<a href="#/new" class="btn btn-primary"><i data-lucide="plus" style="width:18px;height:18px"></i> Nouvelle fiche</a>` : ''}
    </div>
    <div class="search-bar">
      <span class="search-icon"><i data-lucide="search"></i></span>
      <input type="text" id="recipe-search" placeholder="Rechercher une fiche..." autocomplete="off">
    </div>
    <div id="recipe-list"><div class="loading"><div class="spinner"></div></div></div>
  `;
  lucide.createIcons();

  let recipes = [];
  try {
    recipes = await API.getRecipes();
  } catch (e) {
    showToast('Erreur de chargement', 'error');
  }

  const listEl = document.getElementById('recipe-list');
  const searchInput = document.getElementById('recipe-search');

  function renderList(filter = '') {
    const filtered = filter
      ? recipes.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()) || (r.category || '').toLowerCase().includes(filter.toLowerCase()))
      : recipes;

    if (filtered.length === 0) {
      listEl.innerHTML = filter ? `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="clipboard-list"></i></div>
          <p>Aucun résultat</p>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-icon">🎤</div>
          <h3>Créez votre première fiche technique</h3>
          <p>Dictez votre recette, l'IA fait le reste — coûts, portions, procédure.</p>
          ${perms.edit_recipes ? '<a href="#/new" class="btn btn-primary">Nouvelle fiche</a>' : ''}
        </div>
      `;
      lucide.createIcons();
      return;
    }

    const p = perms;
    listEl.innerHTML = filtered.map(r => {
      const marginClass = getMarginClass(r.food_cost_percent);
      const costBorderClass = !p.view_costs || r.food_cost_percent == null ? '' :
        r.food_cost_percent < 30 ? 'card--cost-good' :
        r.food_cost_percent <= 35 ? 'card--cost-warning' : 'card--cost-danger';

      return `
        <div class="card ${costBorderClass}" onclick="location.hash='#/recipe/${r.id}'">
          <div class="card-header">
            <span class="card-title">${escapeHtml(r.name)}</span>
            ${r.category ? `<span class="card-category">${escapeHtml(r.category)}</span>` : ''}
          </div>
          <div class="card-stats">
            <div>
              <span class="stat-value">${r.portions || 1}</span>
              <span class="stat-label">Portions</span>
            </div>
            ${p.view_costs ? `
            <div>
              <span class="stat-value">${formatCurrency(r.cost_per_portion)}</span>
              <span class="stat-label">Coût matière</span>
            </div>
            <div>
              <span class="stat-value">${formatCurrency(r.selling_price)}</span>
              <span class="stat-label">Prix de vente</span>
            </div>
            <div>
              <span class="stat-value"><span class="margin-badge ${marginClass}">${formatPercent(r.food_cost_percent)}</span></span>
              <span class="stat-label">Food cost</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  renderList();

  searchInput.addEventListener('input', (e) => {
    renderList(e.target.value);
  });
}
