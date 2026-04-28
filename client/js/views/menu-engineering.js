// ═══════════════════════════════════════════
// Menu Engineering — Matrice BCG Restauration
// ═══════════════════════════════════════════

async function renderMenuEngineering() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <a href="#/analytics" class="back-link" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:var(--space-1);color:var(--text-secondary);text-decoration:none;font-size:var(--text-sm)">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Analytics
      </a>
      <h1 style="display:flex;align-items:center;gap:8px">
        <i data-lucide="target" style="width:28px;height:28px;color:var(--color-accent)"></i>
        Menu Engineering
      </h1>
      <p class="text-secondary" style="font-size:var(--text-sm)">Optimisez votre carte avec la matrice popularité × marge</p>
    </div>

    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap">
      <select id="me-period" class="input" style="width:auto" data-ui="custom">
        <option value="7">7 jours</option>
        <option value="30" selected>30 jours</option>
        <option value="90">90 jours</option>
      </select>
      <select id="me-category" class="input" style="width:auto" data-ui="custom">
        <option value="">Toutes catégories</option>
      </select>
    </div>

    <div id="me-content">
      <div style="text-align:center;padding:var(--space-6)">
        <div class="loading-spinner"></div>
        <p class="text-secondary" style="margin-top:var(--space-2)">Analyse en cours…</p>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();

  document.getElementById('me-period').addEventListener('change', () => loadMenuEngineering());
  document.getElementById('me-category').addEventListener('change', () => filterMenuEngineering());

  await loadMenuEngineering();
}

let _meData = null;

async function loadMenuEngineering() {
  const days = document.getElementById('me-period').value;
  const content = document.getElementById('me-content');

  try {
    _meData = await API.request(`/analytics/menu-engineering?days=${days}`);
    populateMECategories();
    renderMEContent();
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger">Erreur : ${escapeHtml(e.message)}</div>`;
  }
}

function populateMECategories() {
  if (!_meData) return;
  const sel = document.getElementById('me-category');
  const cats = [...new Set(_meData.items.map(i => i.category))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">Toutes catégories</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}" ${c === current ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function filterMenuEngineering() {
  renderMEContent();
}

function renderMEContent() {
  if (!_meData) return;
  const content = document.getElementById('me-content');
  const catFilter = document.getElementById('me-category').value;
  const data = _meData;
  const items = catFilter ? data.items.filter(i => i.category === catFilter) : data.items;

  const noSalesBanner = !data.summary.has_sales_data ? `
    <div class="alert" style="background:var(--color-info-light,#EFF6FF);border:1px solid var(--color-info,#3B82F6);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:flex-start;gap:var(--space-3)">
      <i data-lucide="info" style="width:20px;height:20px;color:var(--color-info,#3B82F6);flex-shrink:0;margin-top:2px"></i>
      <div>
        <strong>Pas encore de données de ventes</strong>
        <p class="text-secondary text-sm" style="margin:4px 0 0">La classification Stars / Puzzles / Plowhorses / Dogs nécessite des données de ventes. Connectez votre caisse ou utilisez le module Service pour enregistrer des commandes. Les recettes sont affichées ci-dessous triées par marge.</p>
      </div>
    </div>
  ` : '';

  const stars = items.filter(i => i.classification === 'star');
  const puzzles = items.filter(i => i.classification === 'puzzle');
  const plowhorses = items.filter(i => i.classification === 'plowhorse');
  const dogs = items.filter(i => i.classification === 'dog');

  content.innerHTML = `
    ${noSalesBanner}
    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #F59E0B">
        <div style="font-size:1.5rem">⭐</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#F59E0B">${stars.length}</div>
        <div class="text-secondary text-sm">Stars</div>
        <div class="text-secondary" style="font-size:10px">Haute marge + populaire</div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #8B5CF6">
        <div style="font-size:1.5rem">🧩</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#8B5CF6">${puzzles.length}</div>
        <div class="text-secondary text-sm">Puzzles</div>
        <div class="text-secondary" style="font-size:10px">Haute marge, peu vendu</div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #3B82F6">
        <div style="font-size:1.5rem">🐴</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#3B82F6">${plowhorses.length}</div>
        <div class="text-secondary text-sm">Plowhorses</div>
        <div class="text-secondary" style="font-size:10px">Populaire, faible marge</div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-3);border-left:4px solid #EF4444">
        <div style="font-size:1.5rem">🐕</div>
        <div style="font-size:var(--text-2xl);font-weight:700;color:#EF4444">${dogs.length}</div>
        <div class="text-secondary text-sm">Dogs</div>
        <div class="text-secondary" style="font-size:10px">Faible marge + peu vendu</div>
      </div>
    </div>

    <!-- KPI Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Revenu total</div>
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.total_revenue.toFixed(0)} €</div>
      </div>
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Profit total</div>
        <div style="font-size:var(--text-xl);font-weight:700;color:var(--color-success)">${data.summary.total_profit.toFixed(0)} €</div>
      </div>
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Marge moyenne</div>
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.avg_margin.toFixed(2)} €</div>
      </div>
      <div class="card" style="padding:var(--space-3)">
        <div class="text-secondary text-sm">Ventes moy./plat</div>
        <div style="font-size:var(--text-xl);font-weight:700">${data.summary.avg_qty_sold.toFixed(1)}</div>
      </div>
    </div>

    <!-- Visual Matrix -->
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Matrice Menu Engineering</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:2px;border-radius:var(--radius-lg);overflow:hidden;min-height:300px">
        <!-- Top-left: Puzzle (high margin, low popularity) -->
        <div style="background:rgba(139,92,246,0.1);padding:var(--space-3);border:1px solid rgba(139,92,246,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#8B5CF6">🧩 Puzzles <span class="text-secondary text-sm">(à promouvoir)</span></div>
          ${puzzles.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : puzzles.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit">${escapeHtml(i.name)}</a>
              <span style="color:#8B5CF6;font-weight:600">${i.margin.toFixed(2)}€</span>
            </div>
          `).join('')}
        </div>
        <!-- Top-right: Star (high margin, high popularity) -->
        <div style="background:rgba(245,158,11,0.1);padding:var(--space-3);border:1px solid rgba(245,158,11,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#F59E0B">⭐ Stars <span class="text-secondary text-sm">(à maintenir)</span></div>
          ${stars.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : stars.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit">${escapeHtml(i.name)}</a>
              <span style="color:#F59E0B;font-weight:600">${i.qty_sold} vendus</span>
            </div>
          `).join('')}
        </div>
        <!-- Bottom-left: Dog (low margin, low popularity) -->
        <div style="background:rgba(239,68,68,0.1);padding:var(--space-3);border:1px solid rgba(239,68,68,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#EF4444">🐕 Dogs <span class="text-secondary text-sm">(à repenser)</span></div>
          ${dogs.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : dogs.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit;opacity:0.7">${escapeHtml(i.name)}</a>
              <span style="color:#EF4444;font-size:var(--text-xs)">${i.qty_sold} vendus · ${i.margin.toFixed(2)}€</span>
            </div>
          `).join('')}
        </div>
        <!-- Bottom-right: Plowhorse (low margin, high popularity) -->
        <div style="background:rgba(59,130,246,0.1);padding:var(--space-3);border:1px solid rgba(59,130,246,0.2)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:#3B82F6">🐴 Plowhorses <span class="text-secondary text-sm">(à optimiser)</span></div>
          ${plowhorses.length === 0 ? '<p class="text-secondary text-sm">Aucun</p>' : plowhorses.map(i => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:var(--text-sm)">
              <a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit">${escapeHtml(i.name)}</a>
              <span style="color:#3B82F6;font-size:var(--text-xs)">FC: ${i.food_cost_pct}%</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary)">
        <span>← Faible popularité</span>
        <span>Forte popularité →</span>
      </div>
      <div style="text-align:center;margin-top:2px;font-size:var(--text-xs);color:var(--text-tertiary)">
        ↑ Haute marge &nbsp;&nbsp; ↓ Faible marge
      </div>
    </div>

    <!-- Recommendations -->
    ${data.recommendations.length > 0 ? `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <h3 style="margin-bottom:var(--space-3)">Recommandations</h3>
      ${data.recommendations.map(r => `
        <div style="padding:var(--space-2) var(--space-3);margin-bottom:var(--space-2);background:${r.severity === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)'};border-radius:var(--radius-md);font-size:var(--text-sm);border-left:3px solid ${r.severity === 'warning' ? '#F59E0B' : '#3B82F6'}">
          ${r.type === 'remove' ? '🗑️' : r.type === 'optimize' ? '🔧' : '📣'} ${escapeHtml(r.message)}
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Detailed Table -->
    <div class="card" style="padding:var(--space-4);overflow-x:auto">
      <h3 style="margin-bottom:var(--space-3)">Détail par plat</h3>
      <table class="table" style="font-size:var(--text-sm)">
        <thead>
          <tr>
            <th>Plat</th>
            <th>Catégorie</th>
            <th style="text-align:right">Prix</th>
            <th style="text-align:right">Coût</th>
            <th style="text-align:right">Marge</th>
            <th style="text-align:right">FC %</th>
            <th style="text-align:right">Vendus</th>
            <th style="text-align:right">Profit</th>
            <th>Classif.</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td><a href="#/recipes/${i.id}" style="text-decoration:none;color:inherit;font-weight:500">${escapeHtml(i.name)}</a></td>
              <td class="text-secondary">${escapeHtml(i.category)}</td>
              <td style="text-align:right">${i.selling_price.toFixed(2)} €</td>
              <td style="text-align:right">${i.cost.toFixed(2)} €</td>
              <td style="text-align:right;font-weight:600;color:${i.margin >= data.summary.avg_margin ? 'var(--color-success)' : 'var(--color-danger)'}">${i.margin.toFixed(2)} €</td>
              <td style="text-align:right;color:${i.food_cost_pct > 35 ? 'var(--color-danger)' : i.food_cost_pct > 30 ? 'var(--color-warning)' : 'var(--color-success)'}">${i.food_cost_pct}%</td>
              <td style="text-align:right">${i.qty_sold}</td>
              <td style="text-align:right;font-weight:600">${i.total_profit.toFixed(2)} €</td>
              <td>
                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:var(--text-xs);font-weight:600;background:${classifColor(i.classification)}20;color:${classifColor(i.classification)}">
                  ${i.emoji} ${i.label}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function classifColor(c) {
  return { star: '#F59E0B', puzzle: '#8B5CF6', plowhorse: '#3B82F6', dog: '#EF4444' }[c] || '#666';
}
