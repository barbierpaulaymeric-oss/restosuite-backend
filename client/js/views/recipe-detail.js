// ═══════════════════════════════════════════
// Recipe Detail — Fiche Technique (with sub-recipes)
// ═══════════════════════════════════════════

async function renderRecipeDetail(id) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const perms = getPermissions();

  let recipe;
  try {
    recipe = await API.getRecipe(id);
  } catch (e) {
    app.innerHTML = '<div class="empty-state"><p>Fiche introuvable</p><a href="#/" class="btn btn-secondary">← Retour</a></div>';
    return;
  }

  const marginClass = getMarginClass(recipe.food_cost_percent);
  const recipeType = recipe.recipe_type || 'plat';
  const typeBadge = getRecipeTypeBadge(recipeType);
  const hasSubRecipes = recipe.ingredients.some(i => i.is_sub_recipe);

  app.innerHTML = `
    <nav aria-label="Breadcrumb" class="breadcrumb">
      <a href="#/">Fiches</a>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-current">${escapeHtml(recipe.name)}</span>
    </nav>
    <div class="page-header">
      <div>
        <a href="#/" class="back-link"><i data-lucide="arrow-left" style="width:16px;height:16px"></i> Fiches techniques</a>
        <h1 style="margin-top:4px">${typeBadge} ${escapeHtml(recipe.name)}</h1>
        ${recipe.category ? `<span class="card-category" style="margin-top:4px;display:inline-block">${escapeHtml(recipe.category)}</span>` : ''}
      </div>
    </div>

    <div class="recipe-summary">
      <div class="summary-card">
        <div class="summary-value">${recipe.portions || 1}</div>
        <div class="summary-label">Portions</div>
      </div>
      ${perms.view_costs ? `
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.total_cost)}</div>
        <div class="summary-label">Coût total</div>
      </div>
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.cost_per_portion)}</div>
        <div class="summary-label">Coût / portion</div>
      </div>
      <div class="summary-card">
        <div class="summary-value mono">${formatCurrency(recipe.selling_price)}</div>
        <div class="summary-label">Prix de vente</div>
      </div>
      <div class="summary-card">
        <div class="summary-value"><span class="margin-badge ${marginClass}">${formatPercent(recipe.food_cost_percent)}</span></div>
        <div class="summary-label">Food cost</div>
      </div>
      ${recipe.margin != null ? `
      <div class="summary-card">
        <div class="summary-value mono text-success">${formatCurrency(recipe.margin)}</div>
        <div class="summary-label">Marge</div>
      </div>` : ''}
      ` : ''}
    </div>

    ${recipe.prep_time_min || recipe.cooking_time_min ? `
    <div class="recipe-meta">
      ${recipe.prep_time_min ? `<span><i data-lucide="clock" style="width:16px;height:16px"></i> Préparation : ${recipe.prep_time_min} min</span>` : ''}
      ${recipe.cooking_time_min ? `<span><i data-lucide="flame" style="width:16px;height:16px"></i> Cuisson : ${recipe.cooking_time_min} min</span>` : ''}
    </div>` : ''}

    <div class="section-title">Ingrédients</div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Ingrédient</th>
            <th class="numeric">Brut</th>
            <th class="numeric">Net</th>
            <th class="numeric">Perte</th>
            ${perms.view_costs ? `<th class="numeric">Coût</th>` : ''}
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${renderMergedIngredientRows(recipe.ingredients, perms, 0)}
          ${perms.view_costs ? `
          <tr class="total-row">
            <td colspan="4" style="font-weight:600">TOTAL</td>
            <td class="mono" style="font-weight:600">${formatCurrency(recipe.total_cost)}</td>
            <td></td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>

    ${recipe.steps.length > 0 ? `
    <div class="section-title">Procédure</div>
    <ol class="steps-list">
      ${recipe.steps.map(s => `<li><span>${escapeHtml(s.instruction)}</span></li>`).join('')}
    </ol>` : ''}

    ${recipe.notes ? `
    <div class="section-title">Notes</div>
    <p style="color:var(--text-secondary);font-size:var(--text-sm)">${escapeHtml(recipe.notes)}</p>` : ''}

    <div class="actions-row">
      ${perms.view_costs ? `<button class="btn btn-secondary" onclick="openPriceSimulator(${recipe.id}, ${recipe.cost_per_portion}, ${recipe.selling_price})"><i data-lucide="sliders" style="width:18px;height:18px"></i> Simuler</button>` : ''}
      ${perms.edit_recipes ? `<a href="#/edit/${recipe.id}" class="btn btn-primary"><i data-lucide="pencil" style="width:18px;height:18px"></i> Modifier</a>` : ''}
      ${perms.export_pdf ? `<button class="btn btn-secondary" onclick="exportRecipe(${recipe.id})"><i data-lucide="download" style="width:18px;height:18px"></i> Exporter</button>` : ''}
      ${perms.edit_recipes ? `<button class="btn btn-danger" onclick="deleteRecipe(${recipe.id})"><i data-lucide="trash-2" style="width:18px;height:18px"></i> Supprimer</button>` : ''}
    </div>
  `;

  lucide.createIcons();
}

function renderMergedIngredientRows(ingredients, perms, depth) {
  return ingredients.map(ing => {
    const pad = depth * 24;
    if (ing.is_sub_recipe) {
      // Sub-recipe header row
      let html = `
        <tr style="background:${depth === 0 ? 'var(--color-accent-light)' : 'var(--bg-sunken)'}">
          <td style="padding-left:${pad + 12}px">📋 <strong>${escapeHtml(ing.sub_recipe_name || 'Sous-recette')}</strong>
            <span style="font-size:var(--text-xs);color:var(--text-tertiary);margin-left:4px">(×${ing.gross_quantity} portion${ing.gross_quantity !== 1 ? 's' : ''})</span>
          </td>
          <td class="mono">—</td>
          <td class="mono">—</td>
          <td class="mono">—</td>
          ${perms.view_costs ? `<td class="mono">${formatCurrency(ing.cost)}</td>` : ''}
          <td style="font-size:var(--text-sm);color:var(--text-tertiary);font-style:italic">${escapeHtml(ing.notes || '')}</td>
        </tr>`;
      // Sub-recipe children
      if (ing.sub_recipe && ing.sub_recipe.ingredients && ing.sub_recipe.ingredients.length > 0) {
        html += renderMergedIngredientRows(ing.sub_recipe.ingredients, perms, depth + 1);
      }
      return html;
    }
    const waste = ing.custom_waste_percent ?? ing.default_waste_percent ?? 0;
    return `
      <tr${depth > 0 ? ' style="color:var(--text-secondary)"' : ''}>
        <td style="padding-left:${pad + 12}px">${depth > 0 ? '<span style="color:var(--text-tertiary);margin-right:4px">└</span>' : ''}${escapeHtml(ing.ingredient_name)}</td>
        <td class="mono">${formatQuantity(ing.gross_quantity, ing.unit)}</td>
        <td class="mono">${formatQuantity(ing.net_quantity || ing.gross_quantity, ing.unit)}</td>
        <td class="mono">${waste}%</td>
        ${perms.view_costs ? `<td class="mono">${formatCurrency(ing.cost)}</td>` : ''}
        <td style="font-size:var(--text-sm);color:var(--text-tertiary);font-style:italic">${escapeHtml(ing.notes || '')}</td>
      </tr>`;
  }).join('');
}

function renderIngredientTree(ingredients, perms, indent = 0) {
  return ingredients.map(ing => {
    const prefix = indent > 0 ? '│   '.repeat(indent - 1) + '├── ' : '';
    if (ing.is_sub_recipe && ing.sub_recipe) {
      const subRecipe = ing.sub_recipe;
      let html = `<div class="tree-line" style="padding-left:${indent * 20}px">
        <span class="tree-icon">📋</span>
        <span class="tree-name">${escapeHtml(ing.sub_recipe_name)}</span>
        <span class="tree-qty mono">× ${ing.gross_quantity} portion${ing.gross_quantity !== 1 ? 's' : ''}</span>
        ${perms.view_costs ? `<span class="tree-cost mono">— ${formatCurrency(ing.cost)}</span>` : ''}
      </div>`;
      if (subRecipe.ingredients && subRecipe.ingredients.length > 0) {
        html += renderIngredientTree(subRecipe.ingredients, perms, indent + 1);
      }
      return html;
    } else {
      return `<div class="tree-line" style="padding-left:${indent * 20}px">
        <span class="tree-name">${escapeHtml(ing.ingredient_name || '')}</span>
        <span class="tree-qty mono">× ${formatQuantity(ing.gross_quantity, ing.unit)}</span>
        ${perms.view_costs ? `<span class="tree-cost mono">— ${formatCurrency(ing.cost)}</span>` : ''}
      </div>`;
    }
  }).join('');
}

function getRecipeTypeBadge(type) {
  switch (type) {
    case 'sous_recette': return '<span class="recipe-type-badge recipe-type--sub">📋 Sous-recette</span>';
    case 'base': return '<span class="recipe-type-badge recipe-type--base">🫕 Base</span>';
    default: return '';
  }
}

function deleteRecipe(id) {
  showConfirmModal('Supprimer cette fiche technique ?', 'Cette action supprimera définitivement la recette et tous ses ingrédients associés.', async () => {
    try {
      await API.deleteRecipe(id);
      showToast('Fiche supprimée', 'success');
      location.hash = '#/';
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  });
}

async function exportRecipe(id) {
  try {
    const text = await API.getRecipePdf(id);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiche-technique-${id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export téléchargé', 'success');
  } catch (e) {
    showToast('Erreur export', 'error');
  }
}

// ═══════════════════════════════════════════
// Price Simulator — Simulateur de prix
// ═══════════════════════════════════════════
function openPriceSimulator(recipeId, costPerPortion, initialSellingPrice) {
  const backdrop = document.createElement('div');
  backdrop.className = 'simulator-backdrop';
  backdrop.onclick = closePriceSimulator;

  const modal = document.createElement('div');
  modal.className = 'simulator-modal';
  modal.onclick = (e) => e.stopPropagation();

  let currentSellingPrice = initialSellingPrice || costPerPortion * 2;

  function updateSimulation() {
    const foodCostPercent = (costPerPortion / currentSellingPrice * 100);
    const margin = currentSellingPrice - costPerPortion;
    const marginPercent = (margin / currentSellingPrice * 100);

    let zoneClass = 'zone-green';
    let zoneLabel = '✓ Bon (25-30%)';

    if (foodCostPercent < 25) {
      zoneClass = 'zone-excellent';
      zoneLabel = '⭐ Excellent (< 25%)';
    } else if (foodCostPercent <= 30) {
      zoneClass = 'zone-green';
      zoneLabel = '✓ Bon (25-30%)';
    } else if (foodCostPercent <= 35) {
      zoneClass = 'zone-yellow';
      zoneLabel = '⚠ Acceptable (30-35%)';
    } else {
      zoneClass = 'zone-red';
      zoneLabel = '⚠️ À revoir (> 35%)';
    }

    const gaugePercent = Math.min(foodCostPercent, 100);

    modal.innerHTML = `
      <div style="padding:var(--space-4);border-bottom:1px solid var(--border-light)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h2 style="margin:0;font-size:var(--text-lg)">Simulateur de prix</h2>
          <button onclick="closePriceSimulator()" style="background:none;border:none;color:var(--text-secondary);font-size:20px;cursor:pointer">✕</button>
        </div>
      </div>

      <div style="padding:var(--space-4);overflow-y:auto;max-height:calc(70vh - 200px)">
        <div style="margin-bottom:var(--space-5)">
          <label style="display:block;font-weight:600;margin-bottom:var(--space-2);color:var(--text-primary)">
            Prix de vente
            <span style="float:right;font-weight:700;color:var(--color-accent);font-size:var(--text-lg)">${formatCurrency(currentSellingPrice)}</span>
          </label>
          <input
            type="range"
            id="price-slider"
            min="${costPerPortion * 1.2}"
            max="${costPerPortion * 5}"
            step="0.05"
            value="${currentSellingPrice}"
            style="width:100%;height:6px;border-radius:3px;background:linear-gradient(to right,var(--color-danger),var(--color-warning),var(--color-success));outline:none;-webkit-appearance:none;appearance:none"
          >
          <div style="display:flex;justify-content:space-between;margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary)">
            <span>${formatCurrency(costPerPortion * 1.2)} (min)</span>
            <span>${formatCurrency(costPerPortion * 5)} (max)</span>
          </div>
        </div>

        <div style="background:var(--color-surface);border-radius:var(--radius-md);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--border-light)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">Coût matière</div>
              <div style="font-weight:600;font-size:var(--text-lg);color:var(--text-primary)">${formatCurrency(costPerPortion)}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">Marge</div>
              <div style="font-weight:600;font-size:var(--text-lg);color:var(--color-success)">${formatCurrency(margin)}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">% Coût matière</div>
              <div style="font-weight:700;font-size:var(--text-lg);color:var(--color-warning)">${formatPercent(foodCostPercent)}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:4px">% Marge</div>
              <div style="font-weight:700;font-size:var(--text-lg);color:var(--color-success)">${formatPercent(marginPercent)}</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom:var(--space-4)">
          <div style="font-weight:600;margin-bottom:var(--space-2);color:var(--text-primary)">Zone</div>
          <div style="background:${getZoneColor(zoneClass)};border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-3);text-align:center;font-weight:600;color:white">${zoneLabel}</div>

          <div style="background:var(--bg-sunken);border-radius:var(--radius-md);overflow:hidden;height:12px">
            <div style="height:100%;width:${gaugePercent}%;background:${getGaugeColor(foodCostPercent)};transition:width 0.2s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:var(--text-xs);color:var(--text-tertiary)">
            <span>0%</span>
            <span>25%</span>
            <span>30%</span>
            <span>35%</span>
            <span>100%</span>
          </div>
        </div>

        <div style="background:var(--color-info);color:white;border-radius:var(--radius-md);padding:var(--space-3);font-size:var(--text-sm)">
          <strong>Point d'équilibre :</strong> Vous devez vendre au minimum <strong>${formatCurrency(costPerPortion)}</strong> pour couvrir les coûts.
        </div>
      </div>
    `;

    document.getElementById('price-slider').addEventListener('input', (e) => {
      currentSellingPrice = parseFloat(e.target.value);
      updateSimulation();
    });
  }

  updateSimulation();
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}

function closePriceSimulator() {
  const backdrop = document.querySelector('.simulator-backdrop');
  const modal = document.querySelector('.simulator-modal');
  if (backdrop) backdrop.remove();
  if (modal) modal.remove();
}

function getGaugeColor(percent) {
  if (percent < 25) return 'var(--color-success)';
  if (percent <= 30) return 'var(--color-success)';
  if (percent <= 35) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function getZoneColor(zoneClass) {
  switch (zoneClass) {
    case 'zone-excellent': return '#2D8B55';
    case 'zone-green': return '#2D8B55';
    case 'zone-yellow': return '#E5A100';
    case 'zone-red': return '#D93025';
    default: return '#2D8B55';
  }
}
